// Where a room's monster stands and how large it is drawn. A theme may name the spot with its
// `monster` station; otherwise the spot is the free stretch of floor with the most room around
// it, away from the entrance and from every station. Never touches the DOM.
import { bandHeight } from './game-band.js'

/** How tall a monster is drawn, in character heights: a boss is clearly larger than the rest. */
const MONSTER_HEIGHT = { common: 1.5, elite: 1.6, boss: 1.9 }

/** Room kept above a character's head for its bubble, in character heights. */
const BUBBLE_ROOM = 0.45
/** Room kept below a character's feet for its name, in character heights. */
const LABEL_ROOM = 0.35
/** A character's name is wider than its sprite: half its footprint, in character widths. */
const CHARACTER_HALF_WIDTH = 0.85
/** Room kept above the monster's head for its health bar and tag, in character heights. */
const PLATE_ROOM = 0.45
/** The entrance counts this many times over: newcomers walk in through it. */
const ENTRANCE_WEIGHT = 0.5
/** Candidate spots are tried on a grid this many steps across and down the floor. */
const GRID_COLUMNS = 48
const GRID_ROWS = 24
/** A spot keeps this share of the room's width clear of each side wall. */
const SIDE_MARGIN = 0.02

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ left: number, right: number, top: number, bottom: number }} Box
 */

/** The size class of a monster: `boss`, `elite` for one with an affix, otherwise `common`. */
export function monsterRank(monster) {
  if (monster?.kind === 'boss') return 'boss'
  return monster?.affix ? 'elite' : 'common'
}

/**
 * How tall, and as wide, a monster is drawn, in the theme's room units.
 *
 * @param {{ actors: { height: number } }} theme
 * @param {{ kind?: string, affix?: string | null } | null} monster
 */
export function monsterHeight(theme, monster) {
  return theme.actors.height * MONSTER_HEIGHT[monsterRank(monster)]
}

/** Every slot of every station but the entrance, which characters only pass through. */
function stationSlots(theme) {
  return Object.entries(theme.stations ?? {})
    .filter(([name, slots]) => name !== 'enter' && name !== 'monster' && Array.isArray(slots))
    .flatMap(([, slots]) => slots)
}

/** What a character at a slot covers: its sprite, the bubble over it and the name under it. */
function characterBox(theme, slot) {
  const { width, height } = theme.actors
  return {
    left: slot.x - width * CHARACTER_HALF_WIDTH,
    right: slot.x + width * CHARACTER_HALF_WIDTH,
    top: slot.y - height * (1 + BUBBLE_ROOM),
    bottom: slot.y + height * LABEL_ROOM
  }
}

/** What a common monster standing at a point covers, health bar included. */
function monsterBox(theme, point) {
  const size = monsterHeight(theme, null)
  return {
    left: point.x - size / 2,
    right: point.x + size / 2,
    top: point.y - size - theme.actors.height * PLATE_ROOM,
    bottom: point.y
  }
}

/**
 * How far apart two boxes are: the larger of the horizontal and vertical gaps, negative when they
 * overlap (then it is how far the shallower overlap goes).
 *
 * @param {Box} first
 * @param {Box} second
 */
export function boxGap(first, second) {
  const across = Math.max(first.left - second.right, second.left - first.right)
  const down = Math.max(first.top - second.bottom, second.top - first.bottom)
  return Math.max(across, down)
}

/** How much room a spot leaves: its gap to the nearest character, the entrance weighed in. */
function roomAround(theme, point, slots) {
  const box = monsterBox(theme, point)
  let nearest = Infinity
  for (const slot of slots) nearest = Math.min(nearest, boxGap(box, characterBox(theme, slot)))
  const enter = theme.stations?.enter
  if (enter) nearest = Math.min(nearest, boxGap(box, characterBox(theme, enter)) / ENTRANCE_WEIGHT)
  return nearest
}

/**
 * The stretch of floor a spot is looked for in: between the highest and the lowest station, as
 * stations stand on the floor, with the monster's head below the band the fight's words use.
 */
function floorArea(theme, slots) {
  const { width, height } = theme.room
  const size = monsterHeight(theme, null)
  const ys = slots.map((slot) => slot.y)
  const lowest = ys.length ? Math.max(...ys) : height * 0.85
  const highest = ys.length ? Math.min(...ys) : height * 0.5
  const headroom = bandHeight(theme) * height + size + theme.actors.height * PLATE_ROOM
  const top = Math.min(Math.max(highest, headroom), lowest)
  const margin = width * SIDE_MARGIN + size / 2
  return { left: margin, right: width - margin, top, bottom: lowest }
}

/**
 * Where the monster's feet go, in the theme's room units: the theme's `monster` station when it
 * has one, otherwise the spot on the floor with the most room around it. The same theme always
 * gets the same spot; on a tie the spot found first (top left first) wins.
 *
 * @param {{ room: { width: number, height: number }, actors: { width: number, height: number },
 *   stations?: object }} theme
 * @returns {Point}
 */
export function monsterSpot(theme) {
  const named = theme.stations?.monster
  if (named && Number.isFinite(named.x) && Number.isFinite(named.y)) return { x: named.x, y: named.y }
  const slots = stationSlots(theme)
  const area = floorArea(theme, slots)
  let best = { x: theme.room.width / 2, y: area.bottom }
  let bestRoom = -Infinity
  for (let row = 0; row <= GRID_ROWS; row += 1) {
    const y = area.top + ((area.bottom - area.top) * row) / GRID_ROWS
    for (let column = 0; column <= GRID_COLUMNS; column += 1) {
      const x = area.left + ((area.right - area.left) * column) / GRID_COLUMNS
      const room = roomAround(theme, { x, y }, slots)
      if (room > bestRoom) {
        bestRoom = room
        best = { x: Math.round(x), y: Math.round(y) }
      }
    }
  }
  return best
}

/**
 * The direction from one point to another as a unit vector, or straight ahead (to the left) when
 * they meet. Used to aim a lunge or a bolt.
 *
 * @param {Point} from
 * @param {Point} to
 * @returns {Point}
 */
export function directionTo(from, to) {
  const x = to.x - from.x
  const y = to.y - from.y
  const length = Math.hypot(x, y)
  return length ? { x: x / length, y: y / length } : { x: -1, y: 0 }
}
