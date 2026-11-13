// The game's characters and readings when Orca gives no session token totals: each agent, on this
// computer or a paired one, is a character for as long as it is in the room, and what its work
// meter counted stands in for the tokens. Pure: the caller keeps the baselines and passes the clock.

const ESTIMATED_PREFIX = 'estimated:'
/**
 * An estimated character whose agent is no longer in the room retires once it has been missing
 * this long. Two game rounds: the room itself already waits two snapshots before an agent
 * leaves, and after a restart the first round can come before the first snapshot.
 */
export const ESTIMATED_ABSENCE_MS = 60_000
const MS_PER_MINUTE = 60_000

/**
 * @typedef {import('./work-meter.mjs').MeterReading} MeterReading
 * @typedef {MeterReading & { at: number }} MeterBaseline what a meter showed when last read
 * @typedef {{ agentId: string, workedMs: Record<string, number>, toolCalls: number, minutes: number,
 *   since: number }} MeterDelta what an agent did over `minutes`, since the time `since`
 * @typedef {import('./game-sessions.mjs').RoomAgent} RoomAgent
 */

const LOCAL_HOST = 'local'

/**
 * The game session id of an agent's character when there are no real session ids. It is stable
 * for as long as the agent keeps its id, its terminal pane, so a restart finds it again. An agent
 * on a paired machine has its machine's name in it too, so two machines never share one.
 *
 * @param {string} agentId
 * @param {string} [hostId] 'local' (the default) for this computer, or the paired machine's name
 * @returns {string}
 */
export function estimatedSessionId(agentId, hostId = LOCAL_HOST) {
  return hostId === LOCAL_HOST ? `${ESTIMATED_PREFIX}${agentId}` : `${ESTIMATED_PREFIX}${hostId}/${agentId}`
}

/**
 * Whether a game session id was made by estimatedSessionId.
 *
 * @param {string} sessionId
 * @returns {boolean}
 */
export function isEstimatedSessionId(sessionId) {
  return typeof sessionId === 'string' && sessionId.startsWith(ESTIMATED_PREFIX)
}

/** Each activity's time in `after` beyond `before`, or null when any went down. */
function workedSince(before, after) {
  const worked = {}
  for (const activity of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const ms = (after[activity] ?? 0) - (before[activity] ?? 0)
    if (ms < 0) return null
    if (ms > 0) worked[activity] = ms
  }
  return worked
}

/**
 * Where counting starts for a meter read for the first time. One that started after the last
 * reading (`watchedUntil`) is new: everything it counted is new work. Any other counted before
 * the game watched it, and that earns nothing.
 */
function firstMeterBaseline(meter, { now, watchedUntil }) {
  const isNew = watchedUntil !== null && meter.startedAt > watchedUntil
  return isNew ? { startedAt: meter.startedAt, workedMs: {}, toolCalls: 0, at: Math.min(meter.startedAt, now) } : null
}

/**
 * What each agent did since its meter was last read, and the new baselines. Like token totals:
 * a meter seen for the first time earns nothing unless it started after `watchedUntil`, and a
 * meter that went back (a new one under the same agent id) moves the baseline and earns nothing.
 * Baselines are kept only for the meters read now.
 *
 * @param {Record<string, MeterBaseline>} baselines by agent id
 * @param {Record<string, MeterReading>} meters by agent id
 * @param {{ now: number, watchedUntil: number | null }} clock
 * @returns {{ baselines: Record<string, MeterBaseline>, deltas: MeterDelta[], resets: number }}
 */
export function readMeterDeltas(baselines, meters, { now, watchedUntil }) {
  const next = {}
  const deltas = []
  let resets = 0
  for (const [agentId, meter] of Object.entries(meters)) {
    const known = baselines[agentId]
    const baseline = known && known.startedAt === meter.startedAt ? known : firstMeterBaseline(meter, { now, watchedUntil })
    next[agentId] = { startedAt: meter.startedAt, workedMs: { ...meter.workedMs }, toolCalls: meter.toolCalls, at: now }
    if (!baseline) continue
    const workedMs = workedSince(baseline.workedMs, meter.workedMs)
    const toolCalls = meter.toolCalls - baseline.toolCalls
    if (workedMs === null || toolCalls < 0) {
      resets += 1
      continue
    }
    if (toolCalls === 0 && Object.keys(workedMs).length === 0) continue
    const minutes = Math.max(0, now - baseline.at) / MS_PER_MINUTE
    deltas.push({ agentId, workedMs, toolCalls, minutes, since: baseline.at })
  }
  return { baselines: next, deltas, resets }
}

/**
 * The agents as game sessions, one each, in the form the session history gives, with their room
 * and their agent. Agents on paired machines are sessions too: the store knows their state from
 * the snapshot. An agent with no meter is left out.
 *
 * @param {RoomAgent[]} agents
 * @param {Record<string, MeterReading>} meters by agent id
 * @returns {{ sessions: import('./game-sessions.mjs').HistorySession[],
 *   places: Map<string, import('./game-sessions.mjs').Place>, agentOf: Map<string, string>,
 *   how: Map<string, 'agent'>, paired: Set<string> }} maps by session id; `paired` holds the
 *   sessions of agents on paired machines
 */
export function estimatedSessions(agents, meters) {
  const sessions = []
  const places = new Map()
  const agentOf = new Map()
  const how = new Map()
  const paired = new Set()
  for (const agent of agents) {
    const meter = meters[agent.id]
    if (!meter) continue
    const sessionId = estimatedSessionId(agent.id, agent.isLocal ? LOCAL_HOST : agent.hostId)
    if (!agent.isLocal) paired.add(sessionId)
    sessions.push({
      sessionId,
      title: agent.title,
      workspaceId: agent.workspaceId,
      totalTokens: 0,
      createdAt: meter.startedAt,
      running: true
    })
    places.set(sessionId, { workspaceId: agent.workspaceId, roomId: agent.roomId })
    agentOf.set(sessionId, agent.id)
    how.set(sessionId, 'agent')
  }
  return { sessions, places, agentOf, how, paired }
}

/**
 * The characters to retire while the game estimates. One whose agent left the room retires once
 * it has been missing for ESTIMATED_ABSENCE_MS; one from real session totals cannot be counted
 * any more and retires at once (it comes back with its level when its session is read again).
 *
 * @param {object} input
 * @param {{ projectId: string, sessionId: string }[]} input.characters the living characters
 * @param {Set<string>} input.present the session ids of the agents in the room now
 * @param {Map<string, number>} input.missingSince when each missing character was first missed
 * @param {number} input.now
 * @returns {{ closing: { projectId: string, sessionId: string, title: null }[],
 *   missingSince: Map<string, number> }}
 */
export function estimatedToClose({ characters, present, missingSince, now }) {
  const closing = []
  const missing = new Map()
  for (const { projectId, sessionId } of characters) {
    if (present.has(sessionId)) continue
    const since = missingSince.get(sessionId) ?? now
    const isGone = !isEstimatedSessionId(sessionId) || now - since >= ESTIMATED_ABSENCE_MS
    if (isGone) closing.push({ projectId, sessionId, title: null })
    else missing.set(sessionId, since)
  }
  return { closing, missingSince: missing }
}
