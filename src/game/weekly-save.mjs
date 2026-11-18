// A world's `weekly` in the save: repaired by `migrate` (what the plugin's own storage holds) and
// checked by `cleanSave` (an imported file). A save from before the weekly events has none, and
// gets one at its first advance. Pure.
import { weekOfKey } from './weekly-calendar.mjs'
import { eventIndexOf } from './weekly-content.mjs'

/** The most a goal's progress may hold, whatever the content: bounds what an imported save may say. */
export const WEEKLY_PROGRESS_MAX = 5000

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isWhole = (value) => Number.isInteger(value) && value >= 0 && value <= WEEKLY_PROGRESS_MAX

/** The fields of a weekly record, in the order the engine writes them. */
const KEYS = ['week', 'event', 'progress', 'done', 'seenAt', 'goals']
/** The most weeks' goals a world's count may hold: centuries of weeks. */
const GOALS_MAX = 100_000

/** The first problem with a weekly record's shape, as [field, problem], or null; content aside. */
function shapeProblem(value) {
  if (!isPlainObject(value)) return ['weekly', 'is not an object']
  const extra = Object.keys(value).find((key) => !KEYS.includes(key))
  if (extra) return [`weekly.${extra}`, 'is not a field the engine writes']
  const week = weekOfKey(value.week)
  if (!week) return ['weekly.week', 'is not an ISO week such as 2026-W47']
  if (typeof value.event !== 'string' || value.event === '') return ['weekly.event', 'is not an event id']
  if (!isWhole(value.progress)) return ['weekly.progress', `is not a whole number from 0 to ${WEEKLY_PROGRESS_MAX}`]
  if (typeof value.done !== 'boolean') return ['weekly.done', 'is not true or false']
  if (typeof value.seenAt !== 'number' || value.seenAt < week.startsAt || value.seenAt >= week.endsAt) {
    return ['weekly.seenAt', 'is not a time in its week']
  }
  const goals = value.goals ?? 0
  if (!Number.isInteger(goals) || goals < (value.done ? 1 : 0) || goals > GOALS_MAX) {
    return ['weekly.goals', 'is not a whole count of goals reached, one at least once this week\'s is']
  }
  return null
}

const copyOf = (value) => ({
  week: value.week, event: value.event, progress: value.progress, done: value.done, seenAt: value.seenAt,
  ...(value.goals ? { goals: value.goals } : {})
})

/**
 * What `migrate` keeps of a world's weekly record: a copy when it is well formed, otherwise none
 * (the next advance starts the week again).
 *
 * @param {unknown} value
 * @returns {object | null}
 */
export const normalizeWeekly = (value) => (value !== undefined && shapeProblem(value) === null ? copyOf(value) : null)

/**
 * Checks an imported world's weekly record against the content: a known event, a progress no larger
 * than its goal, and `done` exactly when the goal is reached.
 *
 * @param {unknown} value
 * @param {object | null} events the parsed game/events.json, or null when the content has none
 * @returns {{ ok: true, value: object | null } | { ok: false, problem: [string, string] }}
 */
export function checkWeekly(value, events) {
  if (value === undefined) return { ok: true, value: null }
  const index = eventIndexOf({ events })
  if (!index) return { ok: false, problem: ['weekly', 'is kept by a game that has no weekly events'] }
  const problem = shapeProblem(value)
  if (problem) return { ok: false, problem }
  const event = index.byId.get(value.event)
  if (!event) return { ok: false, problem: ['weekly.event', 'is not an event of game/events.json'] }
  if (value.progress > event.goal.count) return { ok: false, problem: ['weekly.progress', 'is past its goal'] }
  if (value.done !== (value.progress === event.goal.count)) {
    return { ok: false, problem: ['weekly.done', 'does not say whether the goal is reached'] }
  }
  return { ok: true, value: copyOf(value) }
}
