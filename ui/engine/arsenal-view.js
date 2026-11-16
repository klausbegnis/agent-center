// The Arsenal tab: a head that stays in view, with the room, its world and the world's materials
// as a strip, over a row of section tabs; then the open section: Items (the chest, and what rooms
// no longer on screen left behind), Party (the characters and retirees) or Camp (the group
// upgrades and auto-spend).
import { ARSENAL_SECTIONS, costsOnScreen, sectionOrDefault, shortMaterials } from './arsenal-model.js'
import { createArsenalTabs, sectionPanelId, sectionTabId } from './arsenal-tabs.js'
import { createCampView } from './camp-view.js'
import { createChestView } from './chest-view.js'
import { el, select, setOptions } from './dom.js'
import { chosenRoomId, joinedRooms, worldById } from './game-model.js'
import { ARSENAL, roomTitle } from './labels.js'
import { createMaterialStrip } from './material-strip.js'
import { createOrphansCard } from './orphans-view.js'
import { createPartyView } from './party-view.js'

/** The space kept between the head and the top of a section scrolled under it, in pixels. */
const SECTION_GAP_PX = 8

/**
 * @param {{
 *   panel: HTMLElement,
 *   actions: Record<string, (...args: unknown[]) => Promise<boolean>>,
 *   prefs?: { get: (key: string) => unknown, set: (key: string, value: string) => unknown }
 * }} options
 */
export function createArsenalView({ panel, actions, prefs }) {
  let wantedRoomId = null
  let sectionId = sectionOrDefault(null)
  let hasChosenSection = false
  let state = null

  const head = el('div', 'ac-game-arsenal-head')
  const headRow = el('div', 'ac-game-arsenal-row')
  const roomField = el('label', 'ac-game-field')
  const roomSelect = select('ac-select', ARSENAL.room)
  roomSelect.removeAttribute('aria-label')
  roomSelect.addEventListener('change', () => {
    wantedRoomId = roomSelect.value
    prefs?.set('arsenalRoom', wantedRoomId)
    draw()
  })
  roomField.append(el('span', 'ac-game-field-label', ARSENAL.room), roomSelect)
  const worldTag = el('span', 'ac-game-arsenal-world')
  headRow.append(roomField, worldTag)
  const strip = createMaterialStrip()
  const tabs = createArsenalTabs({ onSelect: (next) => open(next) })
  head.append(headRow, strip.element, tabs.element)

  const views = {
    items: createChestView({ actions, onChosenChange: () => draw() }),
    party: createPartyView({ actions }),
    camp: createCampView({ actions })
  }
  const sections = {}
  for (const id of ARSENAL_SECTIONS) {
    const node = el('section', `ac-game-arsenal-section ac-game-arsenal-section-${id}`)
    node.id = sectionPanelId(id)
    node.setAttribute('role', 'tabpanel')
    node.setAttribute('aria-labelledby', sectionTabId(id))
    node.append(views[id].element)
    sections[id] = node
  }
  // Below the chest: what rooms no longer on screen left behind in this world.
  const orphans = createOrphansCard({ actions })
  sections.items.append(orphans.element)
  const noRooms = el('p', 'ac-game-card-line ac-game-arsenal-empty', ARSENAL.noRooms)
  panel.append(head, noRooms, ...Object.values(sections))

  Promise.all([prefs?.get('arsenalRoom'), prefs?.get('section')])
    .then(([savedRoom, savedSection]) => {
      if (typeof savedRoom === 'string' && savedRoom && wantedRoomId === null) wantedRoomId = savedRoom
      if (!hasChosenSection) sectionId = sectionOrDefault(savedSection)
      draw()
    })
    .catch(() => {})

  function open(next) {
    hasChosenSection = true
    if (next === sectionId) return
    sectionId = sectionOrDefault(next)
    prefs?.set('section', sectionId)
    draw()
    bringSectionToTop()
  }

  /** A section opened while the page is scrolled down starts right under the head, at its top. */
  function bringSectionToTop() {
    const scroller = panel.closest('.ac-root')
    if (!scroller || head.offsetParent === null) return
    const headBottom = head.getBoundingClientRect().bottom
    const overlap = headBottom + SECTION_GAP_PX - sections[sectionId].getBoundingClientRect().top
    if (overlap > 0) scroller.scrollTop -= overlap
  }

  function draw() {
    if (!state) return
    const game = state.game
    setOptions(roomSelect, joinedRooms(state).map((room) => [room.id, roomTitle(room)]))
    const roomId = chosenRoomId(state, wantedRoomId)
    const room = roomId ? game.rooms[roomId] : null
    const world = room ? worldById(game, room.worldId) : null
    const isReady = Boolean(room && world)
    if (roomId) roomSelect.value = roomId
    head.hidden = !isReady
    noRooms.hidden = isReady
    tabs.setSelected(sectionId)
    for (const [id, node] of Object.entries(sections)) node.hidden = !isReady || id !== sectionId
    if (!isReady) return

    worldTag.textContent = ARSENAL.world(world.id, world.level)
    // Only the open section is drawn; the others are drawn when they are opened.
    views[sectionId].update({ state, game, roomId, room, world })
    if (sectionId === 'items') {
      const shown = state.rooms.find((entry) => entry.id === roomId)
      orphans.update({ roomId, roomName: shown ? roomTitle(shown) : roomId, world })
    }
    const onScreen = { chosenItem: views.items.chosenItem(), upgrades: world.upgrades }
    strip.update(world, shortMaterials(costsOnScreen(sectionId, onScreen), world.materials))
  }

  return {
    /** @param {object} next the view state, with the game running */
    update(next) {
      state = next
      draw()
    }
  }
}
