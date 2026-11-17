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

const UNKNOWN_ACTIVITY = 'unknown'

/**
 * How much of an interval's estimate each activity earned, as weights: its share of the working
 * time (the time no tool explains spread by `unknownMix`) times the tokens of a minute, plus its
 * tool calls times the tokens of a call, the calls cut down in proportion when the interval has
 * more than ESTIMATE_MAX_TOOL_CALLS_PER_MINUTE a minute. The same two parts as estimateTokens, so
 * the split follows where the estimate's tokens come from. The activity weights are left out on
 * purpose: they size the total, and the shared time is already a guess that should not be bent
 * a second time against the skills of cheaper activities.
 *
 * @param {{ attributedMs?: Record<string, number>, callsBy?: Record<string, number>,
 *   toolCalls?: number, minutes?: number }} interval
 * @param {{ unknownMix: Record<string, number>, fromTimeOnly?: boolean }} options `fromTimeOnly`
 *   for an agent whose calls are not counted (estimateTokensFromTime)
 * @returns {Record<string, number>} weights by activity, not normalized
 */
export function estimateWeights({ attributedMs = {}, callsBy = {}, toolCalls = 0, minutes = 0 }, options) {
  const { unknownMix, fromTimeOnly = false } = options
  const perMinute = fromTimeOnly ? ESTIMATE_TOKENS_PER_WORKING_MINUTE : ESTIMATE_TOKENS_PER_MINUTE_WORKED
  const unknownMs = isCount(attributedMs[UNKNOWN_ACTIVITY]) ? attributedMs[UNKNOWN_ACTIVITY] : 0
  const callLimit = isCount(minutes) ? Math.floor(ESTIMATE_MAX_TOOL_CALLS_PER_MINUTE * minutes) : 0
  const callScale = !fromTimeOnly && isCount(toolCalls) ? Math.min(1, callLimit / toolCalls) : 0
  const weights = {}
  for (const activity of Object.keys(unknownMix)) {
    const ownMs = isCount(attributedMs[activity]) ? attributedMs[activity] : 0
    const ms = ownMs + unknownMs * unknownMix[activity]
    const calls = isCount(callsBy[activity]) ? callsBy[activity] * callScale : 0
    weights[activity] = (ms / MS_PER_MINUTE) * perMinute + calls * ESTIMATE_TOKENS_PER_TOOL_CALL
  }
  return weights
}

/**
 * Whole tokens shared by weights, the remainders going to the largest fractions, so the parts
 * always add up to `tokens`. With no weight at all everything goes to `fallback`.
 *
 * @param {number} tokens whole tokens
 * @param {Record<string, number>} weights
 * @param {string} fallback
 * @returns {Record<string, number>} the parts above zero
 */
export function splitTokens(tokens, weights, fallback) {
  const total = Object.values(weights).reduce((sum, weight) => sum + (isCount(weight) ? weight : 0), 0)
  if (!isCount(tokens)) return {}
  if (total <= 0) return { [fallback]: tokens }
  const shares = Object.entries(weights).map(([key, weight]) => {
    const exact = (tokens * (isCount(weight) ? weight : 0)) / total
    return { key, whole: Math.floor(exact), rest: exact - Math.floor(exact) }
  })
  let left = tokens - shares.reduce((sum, share) => sum + share.whole, 0)
  for (const share of [...shares].sort((a, b) => b.rest - a.rest || a.key.localeCompare(b.key))) {
    if (left <= 0) break
    share.whole += 1
    left -= 1
  }
  return Object.fromEntries(shares.filter((share) => share.whole > 0).map((share) => [share.key, share.whole]))
}
