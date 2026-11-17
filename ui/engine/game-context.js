// What sits above the game's tabs on every tab: the room picker with the room's world and level,
// and one strip with the world's coins and materials. It keeps the same size on every tab, so
// the tab bar under it never moves; on the tabs that show a whole world the picker is dimmed and
// says so. It draws what the shell gives it and reports the room picked.
import { el, select, setOptions } from './dom.js'
import { CONTEXT } from './context-labels.js'
import { WORLD_TABS, joinedRooms } from './game-model.js'
import { ARSENAL, roomTitle } from './labels.js'
import { createMaterialStrip } from './material-strip.js'

/** The value of the picker's "All rooms" choice on Rooms: a room id is never empty. */
export const ALL_ROOMS = ''

/** @param {{ onPick: (roomId: string) => void }} options `onPick` gets ALL_ROOMS or a room id */
export function createGameContext({ onPick }) {
  const element = el('div', 'ac-game-context')
  const row = el('div', 'ac-game-context-row')
  const field = el('label', 'ac-game-field ac-game-context-field')
  const picker = select('ac-select', CONTEXT.room)
  picker.removeAttribute('aria-label')
  picker.dataset.key = 'context:room'
  const note = el('span', 'ac-visually-hidden')
  note.id = 'ac-game-context-note'
  picker.setAttribute('aria-describedby', note.id)
  picker.addEventListener('change', () => onPick(picker.value))
  field.append(el('span', 'ac-game-field-label', CONTEXT.room), picker, note)
  const worldTag = el('span', 'ac-game-context-world')
  row.append(field, worldTag)
  const strip = createMaterialStrip()
  const empty = el('p', 'ac-game-card-line ac-game-context-empty', ARSENAL.noRooms)
  element.append(row, strip.element, empty)

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
      const rooms = joinedRooms(state).map((room) => [room.id, roomTitle(room)])
      const isRoomsTab = tab === 'rooms'
      setOptions(picker, isRoomsTab ? [[ALL_ROOMS, CONTEXT.allRooms], ...rooms] : rooms)
      picker.value = isRoomsTab ? filterId ?? ALL_ROOMS : roomId
      const isSecondary = WORLD_TABS.includes(tab)
      row.classList.toggle('ac-game-context-secondary', isSecondary)
      note.textContent = isRoomsTab ? CONTEXT.roomsTab : isSecondary ? CONTEXT.worldTabs : ''
      worldTag.textContent = ARSENAL.world(world.id, world.level)
      strip.update(world, short)
    }
  }
}
