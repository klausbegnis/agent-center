// The tokens an agent probably spent, from how long it worked at each activity and how many tool
// calls it started, for an Orca whose session history gives no token totals. Pure.
import {
  ESTIMATE_ACTIVITY_WEIGHTS,
  ESTIMATE_MAX_TOOL_CALLS_PER_MINUTE,
  ESTIMATE_TOKENS_PER_MINUTE_WORKED,
  ESTIMATE_TOKENS_PER_TOOL_CALL,
  ESTIMATE_TOKENS_PER_WORKING_MINUTE
} from './constants.mjs'

const MS_PER_MINUTE = 60_000
const FALLBACK_WEIGHT = ESTIMATE_ACTIVITY_WEIGHTS.think

const isCount = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0

/** Each working minute times its activity's weight times `tokensPerMinute`. */
function fromTime(workedMs, tokensPerMinute) {
  let tokens = 0
  for (const [activity, ms] of Object.entries(workedMs ?? {})) {
    if (!isCount(ms)) continue
    const weight = ESTIMATE_ACTIVITY_WEIGHTS[activity] ?? FALLBACK_WEIGHT
    tokens += (ms / MS_PER_MINUTE) * weight * tokensPerMinute
  }
  return tokens
}

/**
 * The estimated tokens of one interval: each working minute times its activity's weight times
 * ESTIMATE_TOKENS_PER_MINUTE_WORKED, plus ESTIMATE_TOKENS_PER_TOOL_CALL per tool call started,
 * at most ESTIMATE_MAX_TOOL_CALLS_PER_MINUTE of them per minute of the interval. Time spent
 * waiting, blocked or done is not in `workedMs` and earns nothing.
 *
 * @param {{ workedMs: Record<string, number>, toolCalls: number, minutes: number }} interval
 *   `workedMs` is the working time by activity, `minutes` the length of the interval
 * @returns {number} whole tokens, never negative
 */
export function estimateTokens({ workedMs, toolCalls, minutes }) {
  let tokens = fromTime(workedMs, ESTIMATE_TOKENS_PER_MINUTE_WORKED)
  const callLimit = isCount(minutes) ? Math.floor(ESTIMATE_MAX_TOOL_CALLS_PER_MINUTE * minutes) : 0
  const calls = isCount(toolCalls) ? Math.min(Math.floor(toolCalls), callLimit) : 0
  tokens += calls * ESTIMATE_TOKENS_PER_TOOL_CALL
  return Math.round(tokens)
}

/**
 * The estimated tokens of an agent whose tool calls cannot be counted: one on a paired machine,
 * which no hook reaches. Each working minute times its activity's weight times
 * ESTIMATE_TOKENS_PER_WORKING_MINUTE, the whole of a working minute at the assumed pace of tool
 * calls; the calls it really made are not known, so neither more nor fewer are paid.
 *
 * @param {{ workedMs: Record<string, number> }} interval the working time by activity
 * @returns {number} whole tokens, never negative
 */
export function estimateTokensFromTime({ workedMs }) {
  return Math.round(fromTime(workedMs, ESTIMATE_TOKENS_PER_WORKING_MINUTE))
}
