// Counts how long an agent worked at each activity and how many tool calls it started, so the
// game can estimate its tokens when Orca gives no token totals. Beside that it shares the same
// working time between the work activities by what the tools show (skill-mix.mjs), which only
// decides which skills the tokens train. Pure: the caller passes the time.
import {
  DELEGATE_SHARE,
  TOOL_SIGNAL_FRESH_MS,
  WORK_ACTIVITIES,
  blendRecentMix,
  timeMixOfTools,
  workActivityOf
} from './skill-mix.mjs'

/** The share of working time no tool signal explains; the world's mix spreads it later. */
export const UNKNOWN_ACTIVITY = 'unknown'

/**
 * @typedef {{ startedAt: number, countedAt: number, workedMs: Record<string, number>,
 *   toolCalls: number, attributedMs: Record<string, number>, callsBy: Record<string, number>,
 *   recentMix: Record<string, number> | null, signalAt: number | null }} WorkMeter
 *   `countedAt` is when working time was last added up. `workedMs` is the working time by the
 *   activity the agent showed, which the token total is computed from; `attributedMs` is the same
 *   time shared by the tools around it, with UNKNOWN_ACTIVITY for the time no tool explains, which
 *   decides the skills. `callsBy` counts tool calls by activity, `recentMix` is the agent's recent
 *   tool mix and `signalAt` when a tool was last seen.
 * @typedef {{ startedAt: number, workedMs: Record<string, number>, toolCalls: number,
 *   attributedMs: Record<string, number>, callsBy: Record<string, number> }} MeterReading
 */

/**
 * A meter that starts counting now.
 *
 * @param {number} at
 * @returns {WorkMeter}
 */
export function createWorkMeter(at) {
  return {
    startedAt: at,
    countedAt: at,
    workedMs: {},
    toolCalls: 0,
    attributedMs: {},
    callsBy: {},
    recentMix: null,
    signalAt: null
  }
}

const add = (record, key, amount) => {
  if (amount > 0) record[key] = (record[key] ?? 0) + amount
}

/**
 * Shares working time from `from` to `to` between the activities. While subagents work,
 * DELEGATE_SHARE goes to delegating. The rest follows the agent's recent tools for as long as its
 * last tool signal is fresh (TOOL_SIGNAL_FRESH_MS), and is unknown after that or without one.
 */
function attributeTime(meter, from, to, hasSubagents) {
  const freshUntil = meter.signalAt === null ? from : Math.min(to, Math.max(from, meter.signalAt + TOOL_SIGNAL_FRESH_MS))
  const delegated = hasSubagents ? DELEGATE_SHARE : 0
  add(meter.attributedMs, 'delegate', (to - from) * delegated)
  const trackedMs = (freshUntil - from) * (1 - delegated)
  if (trackedMs > 0) {
    const mix = timeMixOfTools(meter.recentMix)
    for (const activity of WORK_ACTIVITIES) add(meter.attributedMs, activity, trackedMs * mix[activity])
  }
  add(meter.attributedMs, UNKNOWN_ACTIVITY, (to - freshUntil) * (1 - delegated))
}

/**
 * Adds the time since the meter was last settled to the activity the agent had during it, when
 * it was working, and shares the same time by its tools. Call it before the agent's state,
 * activity or subagents change, and before reading.
 *
 * @param {WorkMeter} meter changed in place: the store owns it
 * @param {{ state: string, activity: string, hasSubagents?: boolean }} agent what the agent had
 *   until `at`
 * @param {number} at
 */
export function settleWorkMeter(meter, { state, activity, hasSubagents = false }, at) {
  const elapsed = Math.max(0, at - meter.countedAt)
  if (state === 'working' && elapsed > 0) {
    meter.workedMs[activity] = (meter.workedMs[activity] ?? 0) + elapsed
    attributeTime(meter, meter.countedAt, meter.countedAt + elapsed, hasSubagents)
  }
  meter.countedAt = Math.max(meter.countedAt, at)
}

/**
 * Notes that the agent was seen using a tool of this activity, without counting a call: a
 * snapshot that names the running tool.
 *
 * @param {WorkMeter} meter changed in place
 * @param {string} activity
 * @param {number} at
 */
export function noteToolSignal(meter, activity, at) {
  meter.recentMix = blendRecentMix(meter.recentMix, activity)
  meter.signalAt = Math.max(meter.signalAt ?? at, at)
}

/**
 * Counts one tool call started, by its activity.
 *
 * @param {WorkMeter} meter changed in place
 * @param {string} [activity] the tool's activity; any other than a work activity counts as think
 * @param {number} [at] when it started; without it the call is counted but not a signal
 */
export function countToolCall(meter, activity = 'think', at) {
  meter.toolCalls += 1
  add(meter.callsBy, workActivityOf(activity), 1)
  if (Number.isFinite(at)) noteToolSignal(meter, activity, at)
}

/**
 * Adds what one meter counted to another, for two entries found to be the same agent.
 *
 * @param {WorkMeter} into changed in place
 * @param {WorkMeter} from
 */
export function mergeWorkMeters(into, from) {
  for (const [activity, ms] of Object.entries(from.workedMs)) add(into.workedMs, activity, ms)
  for (const [activity, ms] of Object.entries(from.attributedMs)) add(into.attributedMs, activity, ms)
  for (const [activity, calls] of Object.entries(from.callsBy)) add(into.callsBy, activity, calls)
  into.toolCalls += from.toolCalls
  into.startedAt = Math.min(into.startedAt, from.startedAt)
  if (from.signalAt !== null && (into.signalAt === null || from.signalAt > into.signalAt)) {
    into.signalAt = from.signalAt
    into.recentMix = from.recentMix
  }
}

/**
 * A copy of what the meter counted, safe to hand out.
 *
 * @param {WorkMeter} meter
 * @returns {MeterReading}
 */
export function readWorkMeter(meter) {
  return {
    startedAt: meter.startedAt,
    workedMs: { ...meter.workedMs },
    toolCalls: meter.toolCalls,
    attributedMs: { ...meter.attributedMs },
    callsBy: { ...meter.callsBy }
  }
}
