// What sits above the game's tabs on every tab: the room switcher (a row of chips, one per room
// that plays) with the world's settlement badge and the room's world and level, and one strip with
// the world's coins and materials. It keeps the same size on every tab, so the tab bar under it never moves: the row
// of chips never wraps, it scrolls sideways. On the tabs that show a whole world the switcher is
// dimmed and says so. It draws what the shell gives it and reports the room picked.
import { el, setOptions } from './dom.js'
import { CONTEXT } from './context-labels.js'
import { WORLD_TABS } from './game-model.js'
import { ARSENAL, levelShort } from './labels.js'
import { createMaterialStrip } from './material-strip.js'
import { createSettlementBadge } from './settlement-badge.js'
import { ITEM_DRAG_TYPE } from './send-model.js'
import { ALL_ROOMS, MANY_ROOMS, SCROLL_PAGE_SHARE, chipAfterKey, roomChips, rowOverflow, scrollToShow } from './room-chips.js'

export { ALL_ROOMS }

/** The value of the "More…" list's prompt: a room id never starts with a space. */
const JUMP_PROMPT = ' more'

/**
 * Lets a chip take chest slots dragged onto it, to send them to its room. Only a drag that carries
 * items, onto a room the drop is accepted for, is highlighted and taken.
 *
 * @param {HTMLElement} node
 * @param {{ accepts: (roomId: string) => boolean, take: (roomId: string, payload: object) => void }} drop
 */
function takeDrops(node, drop) {
  const isItemDrag = (event) => [...(event.dataTransfer?.types ?? [])].includes(ITEM_DRAG_TYPE)
  const isTaken = (event) => isItemDrag(event) && drop.accepts(node.dataset.value)
  node.addEventListener('dragover', (event) => {
    if (!isTaken(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    node.classList.add('ac-game-room-chip-drop')
  })
  node.addEventListener('dragleave', () => node.classList.remove('ac-game-room-chip-drop'))
  node.addEventListener('drop', (event) => {
    node.classList.remove('ac-game-room-chip-drop')
    if (!isTaken(event)) return
    event.preventDefault()
    let payload = null
    try {
      payload = JSON.parse(event.dataTransfer.getData(ITEM_DRAG_TYPE))
    } catch (error) {
      console.error('game: a dropped item could not be read', error)
    }
    if (payload && Array.isArray(payload.itemIds)) drop.take(node.dataset.value, payload)
  })
}

/** One chip: a radio button with the room's short name, its host and its signs. */
function createChip(onPick, drop) {
  const node = el('button', 'ac-game-room-chip')
  node.type = 'button'
  node.setAttribute('role', 'radio')
  const name = el('span', 'ac-game-room-chip-name')
  const host = el('span', 'ac-game-room-chip-host')
  const count = el('span', 'ac-game-room-chip-count')
  // Shapes, not only colours: a round mark while the party fights, a triangle when an upgrade is ready.
  const fighting = el('span', 'ac-game-room-chip-fight', '●')
  const upgrade = el('span', 'ac-game-room-chip-upgrade', '▲')
  for (const part of [host, count, fighting, upgrade]) part.setAttribute('aria-hidden', 'true')
  node.append(name, host, count, fighting, upgrade)
  node.addEventListener('click', () => onPick(node.dataset.value))
  if (drop) takeDrops(node, drop)
  let drawn = null
  return {
    node,
    /** @param {import('./room-chips.js').RoomChip} chip */
    set(chip) {
      const signature = JSON.stringify(chip)
      if (signature === drawn) return
      drawn = signature
      node.dataset.value = chip.value
      node.dataset.key = `room-chip:${chip.value}`
      name.textContent = chip.name
      host.textContent = chip.host ?? ''
      host.hidden = !chip.host
      count.textContent = chip.characters === null ? '' : String(chip.characters)
      count.hidden = chip.characters === null
      fighting.hidden = !chip.isFighting
      upgrade.hidden = !chip.canUpgrade
      const label = CONTEXT.chip(chip)
      node.setAttribute('aria-label', label)
      node.title = label
      node.setAttribute('aria-checked', String(chip.isPicked))
      node.classList.toggle('ac-game-room-chip-picked', chip.isPicked)
      node.tabIndex = chip.isPicked ? 0 : -1
    }
  }
}

/** The arrow buttons at the ends of the row; for the mouse, the keys move along the row anyway. */
function arrowButton(text, label, onClick) {
  const node = el('button', 'ac-button ac-game-rooms-arrow', text)
  node.type = 'button'
  node.tabIndex = -1
  node.setAttribute('aria-label', label)
  node.title = label
  node.addEventListener('click', onClick)
  return node
}

/**
 * @param {{ onPick: (roomId: string) => void,
 *   drop?: { accepts: (roomId: string) => boolean, take: (roomId: string, payload: object) => void },
 *   onOpenSettlement?: () => void, base?: string }} options
 *   `onPick` gets ALL_ROOMS or a room id; `drop` lets a chip take chest slots dragged onto it;
 *   `onOpenSettlement` opens the Camp tab from the settlement badge, whose picture loads from `base`
 */
export function createGameContext({ onPick, drop, onOpenSettlement, base = '' }) {
  const element = el('div', 'ac-game-context')
  const row = el('div', 'ac-game-context-row')
  const switcher = el('div', 'ac-game-rooms')
  const scroller = el('div', 'ac-game-rooms-scroll')
  scroller.setAttribute('role', 'radiogroup')
  scroller.setAttribute('aria-label', CONTEXT.room)
  const note = el('span', 'ac-visually-hidden')
  note.id = 'ac-game-context-note'
  scroller.setAttribute('aria-describedby', note.id)
  const back = arrowButton('‹', CONTEXT.scrollBack, () => scrollByPage(-1))
  const on = arrowButton('›', CONTEXT.scrollOn, () => scrollByPage(1))
  // "More…": a compact list of every room, for a row too long to scroll through. It always reads
  // "More…"; the picked room is the highlighted chip.
  const jump = el('select', 'ac-select ac-game-rooms-jump')
  jump.setAttribute('aria-label', CONTEXT.jump)
  jump.title = CONTEXT.jump
  jump.dataset.key = 'context:room'
  jump.addEventListener('change', () => {
    const value = jump.value
    jump.value = JUMP_PROMPT
    if (value !== JUMP_PROMPT) onPick(value)
  })
  switcher.append(back, scroller, on, jump, note)
  // The word "World" steps out where the row is narrow (game.css); the label keeps it.
  const worldTag = el('span', 'ac-game-context-world')
  const worldWord = el('span', 'ac-game-context-world-word')
  const worldText = el('span', '')
  worldWord.setAttribute('aria-hidden', 'true')
  worldText.setAttribute('aria-hidden', 'true')
  worldTag.append(worldWord, worldText)
  const badge = createSettlementBadge({ onOpen: onOpenSettlement, base })
  row.append(switcher, badge.element, worldTag)
  const strip = createMaterialStrip()
  const empty = el('p', 'ac-game-card-line ac-game-context-empty', ARSENAL.noRooms)
  element.append(row, strip.element, empty)

  /** The chips by value, kept so the one with the focus is never rebuilt. */
  const chips = new Map()
  let pickedShown = null

  function scrollByPage(direction) {
    scroller.scrollBy({ left: direction * scroller.clientWidth * SCROLL_PAGE_SHARE })
  }

  function showArrows() {
    const overflow = rowOverflow(scroller)
    back.hidden = !overflow.overflows
    on.hidden = !overflow.overflows
    back.disabled = !overflow.canGoBack
    on.disabled = !overflow.canGoOn
  }

  function scrollPickedIntoView() {
    const picked = [...chips.values()].find((chip) => chip.node.getAttribute('aria-checked') === 'true')
    if (!picked) return
    const target = scrollToShow({ left: picked.node.offsetLeft, width: picked.node.offsetWidth }, scroller)
    if (target !== null) scroller.scrollLeft = target
  }

  // A mouse wheel scrolls the row sideways; a trackpad's sideways swipe already does.
  scroller.addEventListener('wheel', (event) => {
    if (!rowOverflow(scroller).overflows || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    event.preventDefault()
    scroller.scrollLeft += event.deltaY
  }, { passive: false })
  scroller.addEventListener('scroll', showArrows, { passive: true })
  new ResizeObserver(() => {
    showArrows()
    scrollPickedIntoView()
  }).observe(scroller)

  // A radio group: the arrows, Home and End move the focus and pick the room they land on.
  scroller.addEventListener('keydown', (event) => {
    const nodes = [...scroller.children]
    const index = nodes.indexOf(event.target)
    const next = index < 0 ? null : chipAfterKey(index, event.key, nodes.length)
    if (next === null) return
    event.preventDefault()
    nodes[next].focus()
    onPick(nodes[next].dataset.value)
  })

  function drawChips(shown) {
    const nodes = shown.map((chip) => {
      if (!chips.has(chip.value)) chips.set(chip.value, createChip(onPick, chip.value === ALL_ROOMS ? null : drop))
      const view = chips.get(chip.value)
      view.set(chip)
      return view.node
    })
    const kept = new Set(shown.map((chip) => chip.value))
    for (const value of [...chips.keys()]) if (!kept.has(value)) chips.delete(value)
    const isSame = nodes.length === scroller.children.length && nodes.every((node, at) => scroller.children[at] === node)
    // Moving the nodes would lose the focus: put back the chip that had it.
    if (!isSame) {
      const focused = nodes.find((node) => node === node.ownerDocument.activeElement)
      scroller.replaceChildren(...nodes)
      focused?.focus()
    }
  }

  function drawJump(shown) {
    const roomCount = shown.filter((chip) => chip.characters !== null).length
    jump.hidden = roomCount < MANY_ROOMS
    if (jump.hidden) return
    setOptions(jump, [[JUMP_PROMPT, CONTEXT.jumpShort], ...shown.map((chip) => [chip.value, chip.fullName])])
    jump.value = JUMP_PROMPT
  }

  return {
    element,
    /**
     * @param {{ state: object, tab: string, roomId: string | null, filterId: string | null,
     *   world: object | null, short: Map<string, { prices: number, most: number }> }} shown
     *   `roomId` the room Party and Chest show, `filterId` the one Rooms is narrowed to
     */
    update({ state, tab, roomId, filterId, world, short }) {
      const isReady = Boolean(roomId && world)
      row.hidden = !isReady
      strip.element.hidden = !isReady
      empty.hidden = isReady
      if (!isReady) return
      const { chips: shownChips, pickedValue } = roomChips(state, { tab, roomId, filterId, allRoomsName: CONTEXT.allRooms })
      drawChips(shownChips)
      drawJump(shownChips)
      const isRoomsTab = tab === 'rooms'
      const isSecondary = WORLD_TABS.includes(tab)
      row.classList.toggle('ac-game-context-secondary', isSecondary)
      const scope = isRoomsTab ? CONTEXT.roomsTab : isSecondary ? CONTEXT.worldTabs : ''
      note.textContent = [scope, CONTEXT.keys].filter(Boolean).join(' ')
      const worldLabel = ARSENAL.world(world.id, world.level)
      worldTag.setAttribute('aria-label', worldLabel)
      worldTag.title = worldLabel
      worldWord.textContent = `${CONTEXT.world} `
      worldText.textContent = `${world.id} · ${levelShort(world.level)}`
      badge.update(world)
      strip.update(world, short)
      showArrows()
      const pickedKey = `${isRoomsTab}|${pickedValue}`
      if (pickedKey !== pickedShown) {
        pickedShown = pickedKey
        scrollPickedIntoView()
      }
    }
  }
}
