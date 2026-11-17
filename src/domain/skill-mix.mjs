// How an agent's working time is shared between the five work activities when the game estimates
// tokens: by the tool calls around it when hooks show them, by the mix the person's agents were
// seen using when they do not, and by a default mix for coding work before anything was seen.
// Pure: the caller passes every count and the clock.

/** The activities that train a work skill, in the order of the work skills. */
export const WORK_ACTIVITIES = Object.freeze(['write', 'read', 'run', 'think', 'delegate'])

/**
 * The share of each activity in a coding agent's working time, used before any tool call was
 * observed. It sits between two references: a typical coding session's tool calls (reads and
 * searches the most, then commands, then edits, a few subagents) with THINK_SHARE of its time for
 * thinking, and the mix the simulator's balance was tuned on (scripts/simulate-game.mjs, about
 * write 0.25, read 0.27, run 0.15, think 0.2, delegate 0.13). Delegation keeps a tenth: it is
 * the one activity no snapshot shows, and a skill left at level 1 cripples its class.
 */
export const DEFAULT_WORK_MIX = Object.freeze({ write: 0.2, read: 0.25, run: 0.2, think: 0.25, delegate: 0.1 })

/** No activity of an observed mix falls below this share, so no class is left behind for good. */
export const MIX_FLOOR = 0.05

/**
 * The share of the time between tool calls that counts as thinking. A model reasons between calls
 * and sometimes for long without any, but most of that time goes into the calls themselves: the
 * text of an edit or a command is written before the call starts.
 */
export const THINK_SHARE = 0.25

/** While an agent has subagents working, this share of its working time counts as delegating. */
export const DELEGATE_SHARE = 0.5

/** How much each new tool call moves an agent's recent mix: about the last eight calls count. */
export const RECENT_CALL_WEIGHT = 0.25

/**
 * A tool signal this old no longer says what the agent is doing: past it, its working time counts
 * as unknown and is spread by the world's mix.
 */
export const TOOL_SIGNAL_FRESH_MS = 10 * 60_000

/** The observed mix remembers about this many of the latest tool calls; older ones fade. */
export const OBSERVED_CALLS_KEPT = 500

/** Fewer observed calls than this are not yet a mix: the default is used meanwhile. */
export const MIN_OBSERVED_CALLS = 30

const isWorkActivity = (activity) => WORK_ACTIVITIES.includes(activity)
const positive = (value) => (Number.isFinite(value) && value > 0 ? value : 0)

/**
 * The activity a tool signal trains: any activity that is not a work activity counts as thinking.
 *
 * @param {string} activity
 * @returns {string}
 */
export function workActivityOf(activity) {
  return isWorkActivity(activity) ? activity : 'think'
}

/**
 * Shares that add up to 1, from any non-negative weights by activity.
 *
 * @param {Record<string, number> | null | undefined} weights
 * @returns {Record<string, number> | null} null when the weights add up to nothing
 */
export function normalizeMix(weights) {
  const total = WORK_ACTIVITIES.reduce((sum, activity) => sum + positive(weights?.[activity]), 0)
  if (total <= 0) return null
  return Object.fromEntries(WORK_ACTIVITIES.map((activity) => [activity, positive(weights[activity]) / total]))
}

/**
 * An agent's recent tool mix after one more signal: an exponentially weighted mix of its calls.
 *
 * @param {Record<string, number> | null} recent
 * @param {string} activity the activity of the tool just seen
 * @returns {Record<string, number>}
 */
export function blendRecentMix(recent, activity) {
  const seen = workActivityOf(activity)
  if (!recent) return Object.fromEntries(WORK_ACTIVITIES.map((item) => [item, item === seen ? 1 : 0]))
  return Object.fromEntries(WORK_ACTIVITIES.map((item) => {
    const before = (1 - RECENT_CALL_WEIGHT) * positive(recent[item])
    return [item, before + (item === seen ? RECENT_CALL_WEIGHT : 0)]
  }))
}

/**
 * How time between tool calls is shared: THINK_SHARE to thinking, the rest by the tools.
 *
 * @param {Record<string, number>} toolMix shares of the tool calls by activity
 * @returns {Record<string, number>}
 */
export function timeMixOfTools(toolMix) {
  const tools = normalizeMix(toolMix) ?? normalizeMix({ think: 1 })
  return Object.fromEntries(WORK_ACTIVITIES.map((activity) => {
    const own = activity === 'think' ? THINK_SHARE : 0
    return [activity, own + (1 - THINK_SHARE) * tools[activity]]
  }))
}

/**
 * Every activity at MIX_FLOOR at least, then shares that add up to 1 again.
 *
 * @param {Record<string, number>} mix
 * @returns {Record<string, number>}
 */
export function withFloor(mix) {
  const raised = Object.fromEntries(WORK_ACTIVITIES.map((activity) => [activity, Math.max(MIX_FLOOR, positive(mix[activity]))]))
  return normalizeMix(raised)
}

/**
 * Adds the tool calls of one round to the world's observed counts, then scales them down to
 * OBSERVED_CALLS_KEPT, so the mix follows what the agents do lately.
 *
 * @param {Record<string, number> | null | undefined} observed counts by activity
 * @param {Record<string, number> | null | undefined} calls this round's calls by activity
 * @returns {Record<string, number>}
 */
export function foldObservedCalls(observed, calls) {
  const sum = Object.fromEntries(WORK_ACTIVITIES.map((activity) =>
    [activity, positive(observed?.[activity]) + positive(calls?.[activity])]))
  const total = WORK_ACTIVITIES.reduce((all, activity) => all + sum[activity], 0)
  if (total <= OBSERVED_CALLS_KEPT) return sum
  const scale = OBSERVED_CALLS_KEPT / total
  return Object.fromEntries(WORK_ACTIVITIES.map((activity) => [activity, sum[activity] * scale]))
}

/**
 * The mix a world's unknown working time, and a rebalance, follow: the time mix of the tool calls
 * its agents were observed making, floored, once there are MIN_OBSERVED_CALLS of them, and
 * DEFAULT_WORK_MIX before.
 *
 * @param {Record<string, number> | null | undefined} observed counts by activity
 * @returns {{ mix: Record<string, number>, source: 'observed' | 'default' }}
 */
export function worldWorkMix(observed) {
  const total = WORK_ACTIVITIES.reduce((sum, activity) => sum + positive(observed?.[activity]), 0)
  if (total < MIN_OBSERVED_CALLS) return { mix: { ...DEFAULT_WORK_MIX }, source: 'default' }
  return { mix: withFloor(timeMixOfTools(observed)), source: 'observed' }
}

/** How much of the working time remembered for a world fades each round: about the last 20. */
const WORK_TIME_FADE = 0.95

/**
 * A world's working time over the latest rounds, explained by tools or not, for the Skills tab
 * to say where the split comes from. Older rounds fade.
 *
 * @param {{ trackedMs: number, unknownMs: number } | undefined} before
 * @param {{ trackedMs: number, unknownMs: number }} round
 * @returns {{ trackedMs: number, unknownMs: number }}
 */
export function foldWorkTime(before, round) {
  return {
    trackedMs: positive(before?.trackedMs) * WORK_TIME_FADE + positive(round.trackedMs),
    unknownMs: positive(before?.unknownMs) * WORK_TIME_FADE + positive(round.unknownMs)
  }
}

/** Below this share of unknown time, the split is said to come from the agents' tools. */
const UNKNOWN_SHARE_SHOWN = 0.1

/**
 * Where a world's split between work skills comes from now, for the line under its work skills:
 * `tools` when the agents' tools explain nearly all its working time, `mixed` when some of it
 * follows the world's mix, `mix` when none of it is explained, `none` before any work was seen.
 *
 * @param {{ trackedMs: number, unknownMs: number } | undefined} time
 * @returns {'tools' | 'mixed' | 'mix' | 'none'}
 */
export function splitSourceOf(time) {
  const tracked = positive(time?.trackedMs)
  const unknown = positive(time?.unknownMs)
  if (tracked + unknown <= 0) return 'none'
  const share = unknown / (tracked + unknown)
  if (share < UNKNOWN_SHARE_SHOWN) return 'tools'
  return tracked <= 0 ? 'mix' : 'mixed'
}
