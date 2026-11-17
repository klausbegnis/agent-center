// The Chest tab: the room's chest as a framed box of square slots, and under it (or
// beside it when there is room) the chosen item's details with its upgrade. The slots are buttons
// reached with the arrow keys; the chosen one is kept per room across redraws.
import { chestOrder, chestSlotCount, itemFactors, slotAfterKey } from './arsenal-model.js'
import { el } from './dom.js'
import { replaceKeepingFocus } from './game-controls.js'
import { formatFactor } from './game-format.js'
import { holderName } from './game-model.js'
import { emptyChestSlot, itemSlot } from './item-slot-view.js'
import { ARSENAL, holderText, itemEffectText, itemSlotLabel, slotText, tierLevel } from './labels.js'
import { LEGENDARY_ITEM, madeForText, sourceText } from './legendary-labels.js'
import { legendaryDetails } from './legendary-model.js'
import { purchase } from './price-view.js'

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
  const lid = el('h2', 'ac-game-chest-lid')
  const grid = el('div', 'ac-game-chest-grid')
  grid.setAttribute('role', 'group')
  grid.setAttribute('aria-label', ARSENAL.chestSlots)
  const empty = el('p', 'ac-game-card-line ac-game-chest-empty', ARSENAL.noItems)
  const legend = el('p', 'ac-game-chest-legend', ARSENAL.chestLegend)
  legend.setAttribute('aria-hidden', 'true')
  chest.append(lid, grid, empty, legend)
  const detail = el('section', 'ac-game-card ac-game-item-detail')
  detail.setAttribute('aria-live', 'polite')
  element.append(chest, detail)

  /** The chosen item of each room, by room id. */
  const chosenByRoom = new Map()
  let current = null
  let gridDrawn = null
  let detailDrawn = null

  grid.addEventListener('keydown', (event) => {
    const slots = [...grid.querySelectorAll('button.ac-game-slotbox')]
    const index = slots.indexOf(event.target)
    if (index < 0) return
    const next = slotAfterKey(index, event.key, slots.length, columnsOf(slots))
    if (next === null) return
    event.preventDefault()
    slots[next].focus()
    choose(slots[next].dataset.itemId)
  })

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

  /** Only the chosen slot (or the first) is in the page's tab order; arrows reach the rest. */
  function markChosen() {
    const chosenId = chosenItem()?.id ?? null
    const slots = [...grid.querySelectorAll('button.ac-game-slotbox')]
    slots.forEach((slot, index) => {
      const isChosen = slot.dataset.itemId === chosenId
      slot.setAttribute('aria-pressed', String(isChosen))
      slot.tabIndex = isChosen || (!chosenId && index === 0) ? 0 : -1
    })
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
    node.addEventListener('click', () => choose(item.id))
    return node
  }

  function drawGrid() {
    const { room, state, roomId } = current
    const items = chestOrder(room.chest)
    const holders = items.map((item) => holderName(item, state, roomId))
    const signature = JSON.stringify([roomId, items, holders, room.chestSize, base])
    if (signature === gridDrawn) return
    gridDrawn = signature
    lid.textContent = ARSENAL.chest(items.length, room.chestSize ?? items.length)
    empty.hidden = items.length > 0
    detail.hidden = items.length === 0
    const slots = items.map(chestSlot)
    const slotCount = chestSlotCount(items.length)
    for (let index = items.length; index < slotCount; index += 1) slots.push(emptyChestSlot())
    replaceKeepingFocus(grid, slots)
    markChosen()
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

  function drawDetail() {
    const { state, roomId, world } = current
    const item = chosenItem()
    const holder = item ? holderName(item, state, roomId) : null
    const legendary = legendaryDetails(current.game, item)
    const signature = JSON.stringify([roomId, item, holder, item ? world.materials : null, legendary])
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
      })
    ])
  }

  return {
    element,
    /**
     * @param {{ state: object, roomId: string, room: object, world: object }} next
     */
    update(next) {
      current = next
      // An item that left the chest is no longer chosen.
      if (chosenByRoom.has(next.roomId) && !chosenItem()) chosenByRoom.delete(next.roomId)
      drawGrid()
      drawDetail()
    },
    /** The item chosen in the room shown now, or null. */
    chosenItem
  }
}
