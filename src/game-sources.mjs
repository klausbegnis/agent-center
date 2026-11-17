// The two places the game's tokens come from, turned into one shape: the sessions, their rooms
// and agents, and the tokens each spent since the last round. Real totals come from Orca's
// session history; without them, the estimate turns each agent's work meter into tokens.
import { estimatedSessions, readMeterDeltas } from './domain/game-estimate.mjs'
import { matchSessions, placeSessions } from './domain/game-sessions.mjs'
import { boundTokens, readTokenDeltas } from './domain/game-tokens.mjs'
import { WORK_ACTIVITIES, foldObservedCalls, worldWorkMix } from './domain/skill-mix.mjs'
import { estimateTokens, estimateTokensFromTime, estimateWeights, splitTokens } from './game/estimate.mjs'

/**
 * @typedef {import('./domain/game-sessions.mjs').HistorySession} HistorySession
 * @typedef {import('./domain/game-sessions.mjs').RoomAgent} RoomAgent
 * @typedef {{
 *   sessions: HistorySession[], truncated: boolean,
 *   places: Map<string, import('./domain/game-sessions.mjs').Place | null>,
 *   agentOf: Map<string, string>, how: Map<string, string>,
 *   deltas: Map<string, SessionDelta>, resets: number, baselines: object
 * }} SourceReading maps by session id; `baselines` are the source's, to keep for the next round
 * @typedef {{ tokens: number, minutes: number, work?: EstimatedWork,
 *   split?: Record<string, number> }} SessionDelta `split` shares `tokens` between the work
 *   activities; without it they all count as the agent's activity at the time of the round
 * @typedef {{ attributedMs: Record<string, number>, callsBy: Record<string, number>, toolCalls: number,
 *   minutes: number, fromTimeOnly: boolean }} EstimatedWork what an estimate was made of
 */

/**
 * One reading of the session history.
 *
 * @param {object} input
 * @param {{ sessions: HistorySession[], truncated: boolean }} input.history
 * @param {{ id: string, path: string, hostId: string | null }[]} input.listed Orca's workspaces
 * @param {object[]} input.workspaces the store's workspaces (describeWorkspaces)
 * @param {Record<string, string>} input.links session id by agent id, from the store
 * @param {RoomAgent[]} input.agents
 * @param {import('./game-save.mjs').Bridge} input.bridge
 * @param {number} input.at
 * @returns {SourceReading}
 */
export function readFromHistory({ history, listed, workspaces, links, agents, bridge, at }) {
  const { sessions, truncated } = history
  const read = readTokenDeltas(bridge.baselines, sessions, { now: at, watchedUntil: bridge.watchedUntil })
  const places = placeSessions(sessions, { workspaces, listed })
  const { agentOf, how } = matchSessions({ sessions, places, agents, links })
  const deltas = new Map(read.deltas.map((delta) => [delta.sessionId, delta]))
  return { sessions, truncated, places, agentOf, how, deltas, resets: read.resets, baselines: read.baselines }
}

/**
 * One reading of the estimate: every agent is a session, and the work its meter counted since the
 * last round becomes tokens, bounded like real ones. An agent on a paired machine is paid for its
 * working time alone (estimateTokensFromTime): no hook reaches the plugin from there, so its tool
 * calls are not counted.
 *
 * @param {object} input
 * @param {Record<string, import('./domain/work-meter.mjs').MeterReading>} input.meters by agent id
 * @param {RoomAgent[]} input.agents
 * @param {Record<string, object>} input.baselines the meters as last read, by agent id
 * @param {number | null} input.watchedUntil
 * @param {number} input.at
 * @returns {SourceReading}
 */
export function readFromEstimate({ meters, agents, baselines, watchedUntil, at }) {
  const { sessions, places, agentOf, how, paired } = estimatedSessions(agents, meters)
  const counted = Object.fromEntries([...agentOf.values()].map((agentId) => [agentId, meters[agentId]]))
  const read = readMeterDeltas(baselines, counted, { now: at, watchedUntil })
  const sessionOf = new Map([...agentOf].map(([sessionId, agentId]) => [agentId, sessionId]))
  const deltas = new Map()
  for (const delta of read.deltas) {
    const sessionId = sessionOf.get(delta.agentId)
    const estimate = paired.has(sessionId) ? estimateTokensFromTime(delta) : estimateTokens(delta)
    const tokens = boundTokens(estimate, delta.since, at)
    if (tokens <= 0) continue
    const { attributedMs, callsBy, toolCalls, minutes } = delta
    const work = { attributedMs, callsBy, toolCalls, minutes, fromTimeOnly: paired.has(sessionId) }
    deltas.set(sessionId, { tokens, minutes, work })
  }
  return { sessions, truncated: false, places, agentOf, how, deltas, resets: read.resets, baselines: read.baselines }
}

/** Adds `ms` to the tracked or unknown time of a world's record. */
function addTime(record, worldId, { attributedMs }) {
  const unknownMs = attributedMs.unknown ?? 0
  const allMs = Object.values(attributedMs).reduce((sum, ms) => sum + ms, 0)
  const entry = record[worldId] ?? { trackedMs: 0, unknownMs: 0 }
  record[worldId] = { trackedMs: entry.trackedMs + allMs - unknownMs, unknownMs: entry.unknownMs + unknownMs }
}

/**
 * Shares each estimated session's tokens between the work activities (estimateWeights), the time
 * no tool explains following its world's mix (worldWorkMix), after this round's tool calls have
 * been added to that world's observed calls. The tokens of a session stay the same in total.
 *
 * @param {object} input
 * @param {Map<string, SessionDelta>} input.deltas by session id, from readFromEstimate
 * @param {Map<string, { roomId: string }>} input.places by session id
 * @param {(roomId: string) => string | null} input.worldOf a room's world, null when out of the game
 * @param {Record<string, Record<string, number>>} input.observed the observed calls by world
 * @returns {{ deltas: Map<string, SessionDelta>, observed: Record<string, Record<string, number>>,
 *   time: Record<string, { trackedMs: number, unknownMs: number }> }} `time` is this round's working
 *   time by world, explained by tools or not
 */
export function attributeEstimate({ deltas, places, worldOf, observed }) {
  const worldOfSession = (sessionId) => {
    const place = places.get(sessionId)
    return place ? worldOf(place.roomId) : null
  }
  const calls = {}
  for (const [sessionId, { work }] of deltas) {
    const worldId = worldOfSession(sessionId)
    if (worldId === null || !work) continue
    const counts = (calls[worldId] ??= {})
    for (const activity of WORK_ACTIVITIES) counts[activity] = (counts[activity] ?? 0) + (work.callsBy[activity] ?? 0)
  }
  const nextObserved = { ...observed }
  for (const [worldId, counts] of Object.entries(calls)) nextObserved[worldId] = foldObservedCalls(observed[worldId], counts)
  const shared = new Map()
  const time = {}
  for (const [sessionId, delta] of deltas) {
    const worldId = worldOfSession(sessionId)
    if (worldId === null || !delta.work) {
      shared.set(sessionId, delta)
      continue
    }
    const unknownMix = worldWorkMix(nextObserved[worldId]).mix
    const weights = estimateWeights(delta.work, { unknownMix, fromTimeOnly: delta.work.fromTimeOnly })
    shared.set(sessionId, { ...delta, split: splitTokens(delta.tokens, weights, 'think') })
    addTime(time, worldId, delta.work)
  }
  return { deltas: shared, observed: nextObserved, time }
}
