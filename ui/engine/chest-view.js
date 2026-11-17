// The Chest tab: the room's chest as a framed box of square slots, and under it (or
// beside it when there is room) the chosen item's details with its upgrade and the control that
// sends it to another room of the world. "Move items" on the lid turns the slots into a choice of
// several items, sent together from a bar under them. A slot can also be dragged onto a room chip
// above the tabs. The slots are buttons reached with the arrow keys; the chosen one is kept per
// room across redraws.
import { chestOrder, chestSlotCount, itemFactors, slotAfterKey } from './arsenal-model.js'
import { createChestSender } from './chest-send.js'
import { button, el } from './dom.js'
import { replaceKeepingFocus } from './game-controls.js'
import { formatFactor } from './game-format.js'
import { holderName } from './game-model.js'
import { emptyChestSlot, itemSlot } from './item-slot-view.js'
import { ARSENAL, holderText, itemEffectText, itemSlotLabel, slotText, tierLevel } from './labels.js'
import { LEGENDARY_ITEM, madeForText, sourceText } from './legendary-labels.js'
import { legendaryDetails } from './legendary-model.js'
import { purchase } from './price-view.js'
import { SEND } from './send-labels.js'
import { ITEM_DRAG_TYPE, chosenItems } from './send-model.js'

/**
 * @param {{
 *   actions: Record<string, (...args: unknown[]) => Promise<boolean>>,
 *   onChosenChange: () => void,
 *   base?: string
 * }} options `onChosenChange` is called when another item is chosen, so the materials can show
 *   what its price is short of; `base` is where the surface loads legendary pictures from
 */
export function createChestView({ actions, onChosenChange, base }) {
  const element = el('div', 'ac-game-chest-section')
  const chest = el('section', 'ac-game-chest')
  const lid = el('div', 'ac-game-chest-lid')
  const lidTitle = el('h2', 'ac-game-chest-title')
  const moveButton = button(SEND.move, 'ac-button ac-game-chest-move', { onClick: () => setMoving(!isMoving) })
  moveButton.dataset.key = 'send:move-toggle'
  lid.append(lidTitle, moveButton)
  const grid = el('div', 'ac-game-chest-grid')
  grid.setAttribute('role', 'group')
  grid.setAttribute('aria-label', ARSENAL.chestSlots)
  const empty = el('p', 'ac-game-card-line ac-game-chest-empty', ARSENAL.noItems)
  const legend = el('p', 'ac-game-chest-legend', ARSENAL.chestLegend)
  legend.setAttribute('aria-hidden', 'true')
  const moveBar = el('div', 'ac-game-move')
  // Says where sent items went: the detail is redrawn without them once they have left the chest.
  const sendStatus = el('p', 'ac-game-card-line ac-game-send-status')
  sendStatus.setAttribute('role', 'status')
  const ask = el('div', 'ac-game-send-ask')
  ask.hidden = true
  chest.append(lid, grid, empty, legend, moveBar, ask, sendStatus)
  const detail = el('section', 'ac-game-card ac-game-item-detail')
  detail.setAttribute('aria-live', 'polite')
  element.append(chest, detail)
  const sender = createChestSender({ actions, status: sendStatus, ask })

  /** The chosen item of each room, by room id. */
  const chosenByRoom = new Map()
  let current = null
  let gridDrawn = null
  let detailDrawn = null
  let shownRoomId = null
  let isMoving = false
  /** The items picked in "Move items" mode, in the room shown. */
  const movingIds = new Set()
  /** The room a slot is being dragged from, or null. */
  let draggingFrom = null

  grid.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isMoving) {
      event.preventDefault()
      setMoving(false)
      return
    }
    const slots = [...grid.querySelectorAll('button.ac-game-slotbox')]
    const index = slots.indexOf(event.target)
    if (index < 0) return
    const next = slotAfterKey(index, event.key, slots.length, columnsOf(slots))
    if (next === null) return
    event.preventDefault()
    slots[next].focus()
    // In "Move items" mode the arrows only move; Space or a click picks.
    if (!isMoving) choose(slots[next].dataset.itemId)
  })
  moveBar.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isMoving) return
    event.preventDefault()
    setMoving(false)
  })

  function canSend() {
    return typeof actions.sendItem === 'function' && current?.state.game?.viewOnly !== true
  }

  function setMoving(on) {
    isMoving = on
    if (!on) movingIds.clear()
    sender.clearAsk()
    moveButton.setAttribute('aria-pressed', String(on))
    chest.classList.toggle('ac-game-chest-moving', on)
    markChosen()
    drawMoveBar()
    ;(on ? grid.querySelector('button.ac-game-slotbox[tabindex="0"]') : moveButton)?.focus()
  }

  /** How many slots a row holds as laid out now: the slots on the first one's line. */
  function columnsOf(slots) {
    const top = slots[0]?.offsetTop
    return slots.filter((slot) => slot.offsetTop === top).length || 1
  }

  function chosenItem() {
    if (!current) return null
    const id = chosenByRoom.get(current.roomId)
    return current.room.chest?.find((item) => item.id === id) ?? null
  }

  function choose(itemId) {
    if (!current || chosenByRoom.get(current.roomId) === itemId) return
    chosenByRoom.set(current.roomId, itemId)
    markChosen()
    drawDetail()
    onChosenChange()
  }

  function toggleMoving(itemId) {
    if (movingIds.has(itemId)) movingIds.delete(itemId)
    else movingIds.add(itemId)
    markChosen()
    drawMoveBar()
  }

  /**
   * Only the chosen slot (or the first) is in the page's tab order; arrows reach the rest. In
   * "Move items" mode a slot is pressed while it is picked to go.
   */
  function markChosen() {
    const chosenId = chosenItem()?.id ?? null
    const slots = [...grid.querySelectorAll('button.ac-game-slotbox')]
    const focusId = isMoving ? null : chosenId
    slots.forEach((slot, index) => {
      const isPressed = isMoving ? movingIds.has(slot.dataset.itemId) : slot.dataset.itemId === chosenId
      slot.setAttribute('aria-pressed', String(isPressed))
      slot.classList.toggle('ac-game-slotbox-moving', isMoving && isPressed)
      slot.tabIndex = slot.dataset.itemId === focusId || (!focusId && index === 0) ? 0 : -1
    })
  }

  /** What a drag carries: the item, or every item picked in "Move items" mode when it is one. */
  function dragged(item) {
    return isMoving && movingIds.has(item.id) ? [...movingIds] : [item.id]
  }

  function chestSlot(item) {
    const holder = holderName(item, current.state, current.roomId)
    const canUpgrade = item.affordable === true
    const node = itemSlot({
      item,
      slot: item.slot,
      damageType: item.damageType,
      label: itemSlotLabel(item, holder, canUpgrade),
      isHeld: Boolean(item.heldBy),
      canUpgrade,
      isButton: true,
      base
    })
    node.dataset.itemId = item.id
    node.dataset.key = `slot:${item.id}`
    node.addEventListener('click', () => (isMoving ? toggleMoving(item.id) : choose(item.id)))
    if (canSend()) {
      node.draggable = true
      node.addEventListener('dragstart', (event) => {
        draggingFrom = current.roomId
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData(ITEM_DRAG_TYPE, JSON.stringify({ roomId: current.roomId, itemIds: dragged(item) }))
      })
      node.addEventListener('dragend', () => {
        draggingFrom = null
      })
    }
    return node
  }

  function drawGrid() {
    const { room, state, roomId } = current
    const items = chestOrder(room.chest)
    const holders = items.map((item) => holderName(item, state, roomId))
    const signature = JSON.stringify([roomId, items, holders, room.chestSize, base, canSend()])
    if (signature === gridDrawn) return
    gridDrawn = signature
    lidTitle.textContent = ARSENAL.chest(items.length, room.chestSize ?? items.length)
    empty.hidden = items.length > 0
    detail.hidden = items.length === 0
    const slots = items.map(chestSlot)
    const slotCount = chestSlotCount(items.length)
    for (let index = items.length; index < slotCount; index += 1) slots.push(emptyChestSlot())
    replaceKeepingFocus(grid, slots)
    markChosen()
  }

  let moveBarDrawn = null

  function drawMoveBar() {
    moveButton.hidden = !canSend() || !current || (current.room.chest ?? []).length === 0
    if (!isMoving || !current) {
      moveBarDrawn = null
      moveBar.replaceChildren()
      return
    }
    const items = chosenItems(chestOrder(current.room.chest), movingIds)
    const worlds = Object.entries(current.state.game?.rooms ?? {}).map(([id, entry]) => [id, entry.worldId, entry.joined])
    const signature = JSON.stringify([current.roomId, items, worlds])
    if (signature === moveBarDrawn) return
    moveBarDrawn = signature
    replaceKeepingFocus(moveBar, [sender.moveBar(current.state, current.roomId, items, {
      onDone: () => setMoving(false),
      onSent: () => setMoving(false)
    })])
  }

  function detailFacts(item, holder, legendary) {
    const factors = itemFactors(item)
    const facts = el('dl', 'ac-game-item-facts')
    const rows = [
      [ARSENAL.now, itemEffectText(item.slot, formatFactor(factors.now))],
      [ARSENAL.nextLevel, itemEffectText(item.slot, formatFactor(factors.next))],
      [ARSENAL.heldBy, holderText(holder)]
    ]
    // A legendary item also says what its buff does, who it is made for and where it came from.
    if (legendary) {
      rows.unshift([LEGENDARY_ITEM.buff, legendary.text])
      rows.push([LEGENDARY_ITEM.madeFor, madeForText(legendary)], [LEGENDARY_ITEM.source, sourceText(legendary)])
    }
    for (const [term, value] of rows) {
      const pair = el('div', 'ac-game-item-fact')
      pair.append(el('dt', '', term), el('dd', '', value))
      facts.append(pair)
    }
    return facts
  }

  /** On a page that only watches, a line instead of the control. */
  function sendPart(item) {
    if (typeof actions.sendItem !== 'function') return [el('p', 'ac-game-card-line ac-muted', SEND.viewOnly)]
    return [sender.itemPart(current.state, current.roomId, item)]
  }

  function drawDetail() {
    const { state, roomId, world } = current
    const item = chosenItem()
    const holder = item ? holderName(item, state, roomId) : null
    const legendary = legendaryDetails(current.game, item)
    // The rooms the item can go to and what they own decide the send control.
    const rooms = Object.entries(state.game?.rooms ?? {})
      .map(([id, entry]) => [id, entry.worldId, entry.joined, (entry.chest ?? []).filter((owned) => owned.legendary).map((owned) => owned.entryId)])
    const signature = JSON.stringify([roomId, item, holder, item ? world.materials : null, legendary, rooms, state.rooms.map((entry) => entry.id)])
    if (signature === detailDrawn) return
    detailDrawn = signature
    if (!item) {
      replaceKeepingFocus(detail, [el('p', 'ac-game-card-line', ARSENAL.pickItem)])
      return
    }
    const head = el('div', 'ac-game-item-head')
    const what = el('div', 'ac-game-item-what')
    what.append(
      el('h3', `ac-game-item-name${legendary ? ' ac-legendary-name' : ''}`, item.name),
      el('span', 'ac-muted', `${slotText(item)} · ${tierLevel(item)}`)
    )
    if (legendary) what.append(el('p', 'ac-legendary-flavour', legendary.flavour))
    const picture = itemSlot({
      item,
      slot: item.slot,
      damageType: item.damageType,
      label: itemSlotLabel(item, holder, false),
      isHeld: Boolean(item.heldBy),
      base
    })
    picture.setAttribute('aria-hidden', 'true')
    head.append(picture, what)
    replaceKeepingFocus(detail, [
      head,
      detailFacts(item, holder, legendary),
      purchase({
        cost: item.upgradeCost,
        affordable: item.affordable,
        materials: world.materials,
        label: ARSENAL.upgrade,
        ariaLabel: ARSENAL.upgradeItem(item.name),
        key: `item:${item.id}`,
        onBuy: actions.upgradeItem && (() => actions.upgradeItem(roomId, item.id))
      }),
      ...sendPart(item)
    ])
  }

  return {
    element,
    /**
     * @param {{ state: object, roomId: string, room: object, world: object }} next
     */
    update(next) {
      current = next
      if (shownRoomId !== next.roomId) {
        sender.reset()
        if (isMoving) setMoving(false)
      }
      shownRoomId = next.roomId
      // An item that left the chest is no longer chosen, nor picked to move.
      if (chosenByRoom.has(next.roomId) && !chosenItem()) chosenByRoom.delete(next.roomId)
      const ids = new Set((next.room.chest ?? []).map((item) => item.id))
      for (const id of [...movingIds]) if (!ids.has(id)) movingIds.delete(id)
      drawGrid()
      drawDetail()
      drawMoveBar()
    },
    /** The item chosen in the room shown now, or null. */
    chosenItem,
    /** The room a chest slot is being dragged from, or null: a chip of another room takes it. */
    draggingFrom: () => draggingFrom,
    /**
     * Sends items dropped on a room chip, asking first when characters hold some of them.
     *
     * @param {{ roomId: string, itemIds: string[] }} payload what the drag carried
     * @param {string} toRoomId
     */
    dropOn(payload, toRoomId) {
      draggingFrom = null
      if (!current || payload.roomId !== current.roomId || toRoomId === current.roomId) return
      const items = chosenItems(current.room.chest ?? [], new Set(payload.itemIds))
      if (items.length === 0) return
      sender.sendAsking(current.state, current.roomId, items, toRoomId, () => {
        if (isMoving) setMoving(false)
      })
    }
  }
}
