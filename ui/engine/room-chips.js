// The room switcher above the game's tabs, as data: one chip per room that plays, with a short
// name, its host and a few signs of what goes on in it, which chip is picked, where the keys and
// the `[` `]` shortcuts lead, and how far the row scrolls. Never touches the DOM.
import { joinedRooms, partyStatusOf, roomCharacters } from './game-model.js'

/** The value of the "All rooms" chip on Rooms: a room id is never empty. */
export const ALL_ROOMS = ''
/** A room's name longer than this is cut on its chip; the full name stays its accessible name. */
export const CHIP_NAME_LIMIT = 16
/** A host name longer than this is cut on its chip. */
export const CHIP_HOST_LIMIT = 9
/**
 * From this many rooms a compact list sits at the end of the row as well, so a room far along
 * the row is one choice away instead of a long scroll.
 */
export const MANY_ROOMS = 8
/** How much of a chip's neighbours stays visible when the picked chip is scrolled into view. */
export const SCROLL_MARGIN = 24
/** How much of the row one press of an arrow button scrolls. */
export const SCROLL_PAGE_SHARE = 0.7

/**
 * A name cut to `limit` characters with an ellipsis, or as it is when it fits.
 *
 * @param {string} text
 * @param {number} limit
 */
export function shortText(text, limit) {
  const value = String(text ?? '')
  return value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}…`
}

/**
 * @typedef {object} RoomChip
 * @property {string} value the room id, or ALL_ROOMS
 * @property {string} name what the chip shows
 * @property {string} fullName the room's whole name, with its host when it is not local
 * @property {string | null} host the host shown on the chip, or null for this computer
 * @property {number | null} characters the room's characters (guests left out); null for All rooms
 * @property {boolean} isFighting its party fights a monster now
 * @property {boolean} canUpgrade an item of its chest can be upgraded now
 * @property {boolean} isPicked
 */

/** The facts of one room's chip. */
function roomChip(state, room, pickedValue) {
  const game = state.game.rooms[room.id]
  const isRemote = Boolean(room.host && room.host !== 'local')
  return {
    value: room.id,
    name: shortText(room.name, CHIP_NAME_LIMIT),
    fullName: isRemote ? `${room.name} · ${room.host}` : room.name,
    host: isRemote ? shortText(room.host, CHIP_HOST_LIMIT) : null,
    characters: roomCharacters(state, room.id).members.length,
    isFighting: partyStatusOf(game) === 'fighting' && Boolean(game.monster),
    canUpgrade: (game.chest ?? []).some((item) => item.affordable === true),
    isPicked: room.id === pickedValue
  }
}

/**
 * The chips of the switcher: every room that plays, in the order the rooms are listed, with "All
 * rooms" first on the Rooms tab. Rooms out of the game or not joined yet get none.
 *
 * @param {object} state the view state
 * @param {{ tab: string, roomId: string | null, filterId: string | null, allRoomsName: string }} shown
 *   `roomId` is the room Party and Chest show, `filterId` the one Rooms is narrowed to
 * @returns {{ chips: RoomChip[], pickedValue: string | null }}
 */
export function roomChips(state, { tab, roomId, filterId, allRoomsName }) {
  const isRoomsTab = tab === 'rooms'
  const pickedValue = isRoomsTab ? filterId ?? ALL_ROOMS : roomId
  const chips = joinedRooms(state).map((room) => roomChip(state, room, pickedValue))
  if (isRoomsTab && chips.length > 0) {
    chips.unshift({
      value: ALL_ROOMS,
      name: allRoomsName,
      fullName: allRoomsName,
      host: null,
      characters: null,
      isFighting: false,
      canUpgrade: false,
      isPicked: pickedValue === ALL_ROOMS
    })
  }
  return { chips, pickedValue }
}

/**
 * The chip a key moves to in the row, which is a radio group: Left and Right step and wrap round,
 * Home and End go to the ends. Null for any other key.
 *
 * @param {number} index the chip that has the focus
 * @param {string} key
 * @param {number} count
 * @returns {number | null}
 */
export function chipAfterKey(index, key, count) {
  if (count < 1) return null
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % count
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

/**
 * The room `[` (back) or `]` (on) leads to from the picked one, without wrapping round; null at
 * an end, for another key, or when there is no other room. "All rooms" is not a stop.
 *
 * @param {string[]} roomIds the rooms that play, in order
 * @param {string | null} current
 * @param {string} key
 */
export function roomAfterShortcut(roomIds, current, key) {
  const step = key === ']' ? 1 : key === '[' ? -1 : 0
  if (step === 0 || roomIds.length < 2) return null
  const index = roomIds.indexOf(current)
  if (index < 0) return step > 0 ? roomIds[0] : roomIds[roomIds.length - 1]
  return roomIds[index + step] ?? null
}

/**
 * Whether a key press is the person typing, not a shortcut: in a field, a list or editable text,
 * or with a modifier held.
 *
 * @param {{ tagName?: string, isContentEditable?: boolean } | null} target
 * @param {{ altKey?: boolean, ctrlKey?: boolean, metaKey?: boolean }} modifiers
 */
export function isTypingKey(target, modifiers = {}) {
  if (modifiers.altKey || modifiers.ctrlKey || modifiers.metaKey) return true
  const tag = String(target?.tagName ?? '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable === true
}

/**
 * Where the row should scroll so a chip is in view with a little of its neighbours, or null when
 * it already is. Coordinates are the row's own: `left` from the start of its content.
 *
 * @param {{ left: number, width: number }} chip
 * @param {{ scrollLeft: number, clientWidth: number, scrollWidth: number }} row
 * @returns {number | null}
 */
export function scrollToShow(chip, { scrollLeft, clientWidth, scrollWidth }) {
  const max = Math.max(0, scrollWidth - clientWidth)
  const start = chip.left - SCROLL_MARGIN
  const end = chip.left + chip.width + SCROLL_MARGIN
  let target = scrollLeft
  // A row too narrow for the chip and both margins centres it, so its start is never cut.
  if (end - start > clientWidth) target = chip.left - Math.max(0, (clientWidth - chip.width) / 2)
  else if (start < scrollLeft) target = start
  else if (end > scrollLeft + clientWidth) target = end - clientWidth
  target = Math.min(max, Math.max(0, Math.round(target)))
  return target === Math.round(scrollLeft) ? null : target
}

/** Below a pixel the row counts as at its end: scroll positions are fractions on some screens. */
const END_TOLERANCE = 1

/**
 * Whether the row overflows and which way it can still scroll, for the arrow buttons.
 *
 * @param {{ scrollLeft: number, clientWidth: number, scrollWidth: number }} row
 */
export function rowOverflow({ scrollLeft, clientWidth, scrollWidth }) {
  const overflows = scrollWidth - clientWidth > END_TOLERANCE
  return {
    overflows,
    canGoBack: overflows && scrollLeft > END_TOLERANCE,
    canGoOn: overflows && scrollLeft + clientWidth < scrollWidth - END_TOLERANCE
  }
}

/**
 * The room a surface saved, under `room` or, from before the Arsenal became tabs, `arsenalRoom`.
 *
 * @param {unknown} room
 * @param {unknown} arsenalRoom
 * @returns {string | null}
 */
export function savedRoomOf(room, arsenalRoom) {
  return [room, arsenalRoom].find((value) => typeof value === 'string' && value !== '') ?? null
}
