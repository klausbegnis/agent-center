// The calendar of the weekly events: which ISO week a moment falls in (in UTC, so every machine
// agrees), and which event of the catalogue each week has. The order is a hash of the week, so it
// needs no server and no save: every week of a cycle of the catalogue's length has a different
// event, and the first week of a cycle is never the last week's. Pure.
import { hashOf } from './hash.mjs'

const DAY_MS = 86_400_000
export const WEEK_MS = 7 * DAY_MS
/** 1970-01-01 was a Thursday: day 0 is the fourth day of its ISO week (Monday is 0). */
const EPOCH_WEEKDAY = 3
/** Rotations need three events: with fewer, the first of a cycle could not avoid the last. */
const FEWEST_TO_ROTATE = 3

/**
 * @typedef {{ key: string, year: number, week: number, index: number, startsAt: number, endsAt: number }} Week
 *   `key` is the ISO week as "2026-W47"; `index` counts weeks from the one of 1970-01-01, so the
 *   week after `index` is `index + 1` across every year's end; `startsAt` is its Monday at 00:00
 *   UTC and `endsAt` the next Monday's
 */

/**
 * The ISO week of week number `index` (weeks since the one of 1970-01-01).
 *
 * @param {number} index
 * @returns {Week}
 */
export function weekOfIndex(index) {
  const monday = index * 7 - EPOCH_WEEKDAY
  // The ISO year is the year of the week's Thursday; its week number counts Thursdays from there.
  const thursday = new Date((monday + 3) * DAY_MS)
  const year = thursday.getUTCFullYear()
  const dayOfYear = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS)
  const week = Math.floor(dayOfYear / 7) + 1
  return {
    key: `${year}-W${String(week).padStart(2, '0')}`,
    year,
    week,
    index,
    startsAt: monday * DAY_MS,
    endsAt: (monday + 7) * DAY_MS
  }
}

/**
 * The ISO week a moment falls in, in UTC.
 *
 * @param {number} at milliseconds
 * @returns {Week}
 */
export function weekOf(at) {
  const day = Math.floor(at / DAY_MS)
  return weekOfIndex(Math.floor((day + EPOCH_WEEKDAY) / 7))
}

/** A week key, "2026-W47", read back; null when it is not one a calendar has. */
export function weekOfKey(key) {
  const match = typeof key === 'string' ? /^(\d{4})-W(\d{2})$/.exec(key) : null
  if (!match) return null
  const [year, week] = [Number(match[1]), Number(match[2])]
  // The fourth of January is always in week 1.
  const first = weekOf(Date.UTC(year, 0, 4))
  const found = weekOfIndex(first.index + week - 1)
  return found.key === key ? found : null
}

/** A cycle's events in the order of their hash: the order the cycle plays them. */
function cycleOrder(ids, cycle) {
  return [...ids].sort((first, second) =>
    hashOf(`weekly|${cycle}|${first}`) - hashOf(`weekly|${cycle}|${second}`) || first.localeCompare(second))
}

/**
 * The id of the event of week number `index`. Each cycle of `ids.length` weeks plays every event
 * once; when a cycle would open with the event the one before closed on, its first two swap.
 *
 * @param {string[]} ids the catalogue's event ids, in any order
 * @param {number} index a week number (Week.index)
 * @param {string | null} [pinned] an event every week has instead (the demo's EVENT)
 * @returns {string | null} null for an empty catalogue
 */
export function eventIdOfWeek(ids, index, pinned = null) {
  if (pinned) return pinned
  if (ids.length === 0) return null
  const sorted = [...ids].sort()
  if (sorted.length < FEWEST_TO_ROTATE) return sorted[index % sorted.length]
  const cycle = Math.floor(index / sorted.length)
  const order = cycleOrder(sorted, cycle)
  const before = cycleOrder(sorted, cycle - 1)
  if (order[0] === before.at(-1)) [order[0], order[1]] = [order[1], order[0]]
  return order[index - cycle * sorted.length]
}
