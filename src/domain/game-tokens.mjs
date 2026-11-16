// Turns the token totals Orca's session history reports into the tokens each session spent
// since the last reading. Pure: the caller keeps the baselines and passes the clock.

/**
 * No agent spends tokens faster than this. A total that jumps further in the time since the last
 * reading is counted up to this rate; the rest is passed over, so one strange reading cannot pay
 * out a fortune.
 */
export const MAX_TOKENS_PER_MINUTE = 2_000_000
/**
 * Tokens spent while the worker was not running (Orca closed, the computer asleep) are counted
 * for at most this long a gap, like the engine's fight time: a session already known keeps what
 * it spent meanwhile, within a bound.
 */
export const MAX_CATCH_UP_MS = 8 * 60 * 60_000
/** Baselines kept for sessions that no longer show up in the history, newest first. */
export const BASELINES_KEPT = 1000

const MS_PER_MINUTE = 60_000

/**
 * @typedef {{ total: number, at: number }} Baseline the total last read and when
 * @typedef {{ sessionId: string, totalTokens: number, createdAt: number | null }} SessionTotal
 * @typedef {{ sessionId: string, tokens: number, minutes: number }} Delta tokens spent over
 *   `minutes` of real time
 */

/** The most a session may be paid for the time since `since`. */
function allowance(since, now) {
  const elapsed = Math.min(MAX_CATCH_UP_MS, Math.max(0, now - since))
  return Math.floor((MAX_TOKENS_PER_MINUTE * elapsed) / MS_PER_MINUTE)
}

/**
 * Tokens read over the time since `since`, held to what any agent could spend in it: at most
 * MAX_TOKENS_PER_MINUTE, over at most MAX_CATCH_UP_MS. Estimated tokens are bounded the same way
 * as real ones.
 *
 * @param {number} tokens
 * @param {number} since when the interval started
 * @param {number} now
 * @returns {number}
 */
export function boundTokens(tokens, since, now) {
  return Math.max(0, Math.min(tokens, allowance(since, now)))
}

/**
 * Where counting starts for a session read for the first time. One started after the last
 * reading (`watchedUntil`) is new: everything it spent counts, from its start. Any other was
 * already under way before the game watched it: its total so far is history and counts nothing.
 */
function firstBaseline(session, { now, watchedUntil }) {
  const isNew = watchedUntil !== null && session.createdAt !== null && session.createdAt > watchedUntil
  return isNew ? { total: 0, at: Math.min(session.createdAt, now) } : { total: session.totalTokens, at: now }
}

/** Keeps the baselines of the sessions just read and the newest others, up to BASELINES_KEPT. */
function trimBaselines(baselines, readIds) {
  const entries = Object.entries(baselines)
  if (entries.length <= BASELINES_KEPT) return baselines
  const others = entries.filter(([sessionId]) => !readIds.has(sessionId)).sort((a, b) => b[1].at - a[1].at)
  const kept = entries.filter(([sessionId]) => readIds.has(sessionId))
  return Object.fromEntries([...kept, ...others].slice(0, Math.max(BASELINES_KEPT, kept.length)))
}

/**
 * Reads the history once: the tokens each session spent since its baseline, and the new
 * baselines.
 *
 * - A session seen for the first time sets its baseline and earns nothing, unless it started
 *   after `watchedUntil` (see firstBaseline).
 * - A total that went down (a session compacted or cleared) moves the baseline and earns nothing.
 * - Otherwise the difference is earned, up to MAX_TOKENS_PER_MINUTE over the time since the
 *   baseline, itself counted for at most MAX_CATCH_UP_MS.
 *
 * @param {Record<string, Baseline>} baselines by session id
 * @param {SessionTotal[]} sessions
 * @param {{ now: number, watchedUntil: number | null }} clock `watchedUntil` is when the history
 *   was last read, kept across restarts; null when the game has not read it before
 * @returns {{ baselines: Record<string, Baseline>, deltas: Delta[], resets: number }}
 */
export function readTokenDeltas(baselines, sessions, { now, watchedUntil }) {
  const next = { ...baselines }
  const deltas = []
  let resets = 0
  const readIds = new Set()
  for (const session of sessions) {
    readIds.add(session.sessionId)
    const known = Object.hasOwn(next, session.sessionId)
    const baseline = known ? next[session.sessionId] : firstBaseline(session, { now, watchedUntil })
    next[session.sessionId] = { total: session.totalTokens, at: now }
    if (session.totalTokens < baseline.total) {
      resets += 1
      continue
    }
    const tokens = boundTokens(session.totalTokens - baseline.total, baseline.at, now)
    if (tokens > 0) {
      const minutes = Math.max(0, now - baseline.at) / MS_PER_MINUTE
      deltas.push({ sessionId: session.sessionId, tokens, minutes })
    }
  }
  return { baselines: trimBaselines(next, readIds), deltas, resets }
}

/**
 * Baselines from whatever was stored, keeping only well-formed entries.
 *
 * @param {unknown} value
 * @returns {Record<string, Baseline>}
 */
export function normalizeBaselines(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const isCount = (number) => typeof number === 'number' && Number.isFinite(number) && number >= 0
  return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry && isCount(entry.total) && isCount(entry.at))
    .map(([sessionId, entry]) => [sessionId, { total: entry.total, at: entry.at }]))
}
