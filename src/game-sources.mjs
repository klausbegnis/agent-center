// The two places the game's tokens come from, turned into one shape: the sessions, their rooms
// and agents, and the tokens each spent since the last round. Real totals come from Orca's
// session history; without them, the estimate turns each agent's work meter into tokens.
import { estimatedSessions, readMeterDeltas } from './domain/game-estimate.mjs'
import { matchSessions, placeSessions } from './domain/game-sessions.mjs'
import { boundTokens, readTokenDeltas } from './domain/game-tokens.mjs'
import { estimateTokens } from './game/estimate.mjs'

/**
 * @typedef {import('./domain/game-sessions.mjs').HistorySession} HistorySession
 * @typedef {import('./domain/game-sessions.mjs').RoomAgent} RoomAgent
 * @typedef {{
 *   sessions: HistorySession[], truncated: boolean,
 *   places: Map<string, import('./domain/game-sessions.mjs').Place | null>,
 *   agentOf: Map<string, string>, how: Map<string, string>,
 *   deltas: Map<string, { tokens: number, minutes: number }>, resets: number, baselines: object
 * }} SourceReading maps by session id; `baselines` are the source's, to keep for the next round
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
 * One reading of the estimate: every agent on this computer is a session, and the work its meter
 * counted since the last round becomes tokens, bounded like real ones.
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
  const { sessions, places, agentOf, how } = estimatedSessions(agents, meters)
  const counted = Object.fromEntries([...agentOf.values()].map((agentId) => [agentId, meters[agentId]]))
  const read = readMeterDeltas(baselines, counted, { now: at, watchedUntil })
  const sessionOf = new Map([...agentOf].map(([sessionId, agentId]) => [agentId, sessionId]))
  const deltas = new Map()
  for (const delta of read.deltas) {
    const tokens = boundTokens(estimateTokens(delta), delta.since, at)
    if (tokens > 0) deltas.set(sessionOf.get(delta.agentId), { tokens, minutes: delta.minutes })
  }
  return { sessions, truncated: false, places, agentOf, how, deltas, resets: read.resets, baselines: read.baselines }
}
