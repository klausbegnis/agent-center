// Subagents as familiars: who belongs to whom, how large a familiar is, where each one stands
// round its parent and which small mark says what it is doing. Pure: no DOM, no randomness.
import { hash } from './hash.js'
import { BUBBLE } from './labels.js'

/** More familiars than this round one parent turn into clutter; the rest become a "+N" marker. */
export const FAMILIAR_CAP = 6

/** A theme without a familiar draws a subagent as a character this much smaller than an agent. */
const DEFAULT_SUBAGENT_SCALE = 0.7

/**
 * Where familiars stand, nearest first. One position is used on each side of the parent before
 * the next. `across` is how far the familiar's centre is beyond the parent's edge, in familiar
 * widths; `depth` is how far in front (positive) or behind (negative) the parent's feet, in
 * parent heights. Every position is a little behind the parent, so the parent's name, which
 * hangs under its feet, stays readable; the values keep neighbours off each other.
 */
const RING = [
  { across: 0.6, depth: -0.02 },
  { across: 1.75, depth: -0.16 },
  { across: 0.75, depth: -0.62 }
]

/**
 * The "+N" marker stands at the parent's feet, this many familiar widths beyond its edge: just
 * outside the outermost familiar, where no activity mark is in the way.
 */
const MARKER_ACROSS = 2.7

/** The grid the activity icons are drawn on. */
export const ACTIVITY_ICON_SIZE = 12

/** Outline icons for the activities that have no bubble text, as SVG path data. */
const ACTIVITY_ICON_PATH = {
  write: 'M2 10 L2.8 7.2 L8.3 1.7 L10.3 3.7 L4.8 9.2 Z M7 3 L9 5',
  read: 'M6 3.2 Q4 1.8 1.5 2.6 V9.4 Q4 8.6 6 10 Q8 8.6 10.5 9.4 V2.6 Q8 1.8 6 3.2 Z M6 3.2 V10',
  run: 'M2 3 L5.5 6 L2 9 M6.5 9.5 H10.5',
  think: 'M2.5 6 h0.01 M6 6 h0.01 M9.5 6 h0.01'
}
const FALLBACK_ICON = 'think'

/**
 * Splits a room's agents into the ones that stand at a station and the familiars of each. A
 * subagent whose parent is not in the room has nobody to stand next to, so it takes a station.
 *
 * @param {{ id: string, parentId: string | null }[]} agents
 * @returns {{ mains: object[], familiars: Map<string, object[]> }}
 */
export function household(agents) {
  const ids = new Set(agents.filter((agent) => agent.parentId === null).map((agent) => agent.id))
  const mains = []
  const familiars = new Map()
  for (const agent of agents) {
    if (agent.parentId === null || !ids.has(agent.parentId)) {
      mains.push(agent)
      continue
    }
    if (!familiars.has(agent.parentId)) familiars.set(agent.parentId, [])
    familiars.get(agent.parentId).push(agent)
  }
  return { mains, familiars }
}

/** How much smaller than an agent a subagent is when it is drawn as a character. */
export function subagentScale(theme) {
  return theme.actors.subScale ?? DEFAULT_SUBAGENT_SCALE
}

/**
 * The size of one familiar in room units, and how far above the floor it floats. A theme
 * without a familiar gets the size of its small character.
 *
 * @returns {{ width: number, height: number, lift: number }}
 */
export function familiarSize(theme) {
  const { width, height, familiar } = theme.actors
  const scale = subagentScale(theme)
  if (!familiar) return { width: width * scale, height: height * scale, lift: 0 }
  const ownWidth = familiar.width ?? width * scale
  return {
    width: ownWidth,
    height: familiar.height ?? (ownWidth * height) / width,
    lift: familiar.lift ?? 0
  }
}

const clamp = (value, low, high) => Math.min(Math.max(value, low), high)

/**
 * Where the familiars of one parent stand: alternately on either side of it, nearest first.
 * Which side comes first depends on the parent's id, so it stays put across reloads. Points
 * are feet positions in room units, kept inside the room.
 *
 * @param {object} theme
 * @param {{ id: string, point: { x: number, y: number } }} parent
 * @param {number} count how many subagents the parent has
 * @returns {{ points: { x: number, y: number }[], hidden: number, marker: { x: number, y: number } | null }}
 *   one point per familiar shown, how many are left out, and where the "+N" marker goes
 */
export function familiarPoints(theme, parent, count) {
  const size = familiarSize(theme)
  const { width: roomWidth, height: roomHeight } = theme.room
  const firstSide = hash(parent.id) % 2 === 0 ? 1 : -1
  const shown = Math.min(count, FAMILIAR_CAP)
  const sideOf = (index) => (index % 2 === 0 ? firstSide : -firstSide)
  const inRoom = (x, y) => ({
    x: clamp(x, size.width / 2, roomWidth - size.width / 2),
    y: clamp(y, Math.min(size.height, roomHeight), roomHeight)
  })

  const points = []
  for (let index = 0; index < shown; index++) {
    const place = RING[Math.floor(index / 2) % RING.length]
    const reach = theme.actors.width / 2 + place.across * size.width
    const depth = place.depth * theme.actors.height
    points.push(inRoom(parent.point.x + sideOf(index) * reach, parent.point.y + depth))
  }

  const hidden = count - shown
  if (hidden === 0) return { points, hidden, marker: null }
  const reach = theme.actors.width / 2 + MARKER_ACROSS * size.width
  return { points, hidden, marker: inRoom(parent.point.x + sideOf(shown - 1) * reach, parent.point.y) }
}

/**
 * The small mark over a familiar that says what its subagent is doing: the bubble text for the
 * states that have one ("?", "!", "zz"), otherwise an icon.
 *
 * @returns {{ text: string } | { path: string }}
 */
export function activityMark(activity) {
  if (BUBBLE[activity]) return { text: BUBBLE[activity] }
  return { path: ACTIVITY_ICON_PATH[activity] ?? ACTIVITY_ICON_PATH[FALLBACK_ICON] }
}
