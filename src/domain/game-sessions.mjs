// Joins Orca's session history to the rooms and agents the store knows: which room a session
// belongs to, which character on screen runs it, what it is doing, and when it is over. Pure.
import { isEstimatedSessionId } from './game-estimate.mjs'

/** The activities the game turns into work skills; any other activity counts as thinking. */
const WORK_ACTIVITIES = new Set(['write', 'read', 'run', 'think', 'delegate'])
const FALLBACK_ACTIVITY = 'think'
/** What an agent's state means to its character: a finished agent waits for work, so it gathers. */
const GAME_STATE_OF_AGENT = { working: 'working', waiting: 'waiting', blocked: 'blocked', done: 'idle' }
/**
 * A guest has no token count, so it fights at a normal working pace while its agent works. The
 * engine's REFERENCE_TOKENS_PER_MINUTE; this module may not import the engine, so it is repeated.
 */
export const GUEST_TOKENS_PER_MINUTE = 20_000
/**
 * A character whose session no longer shows up in a truncated history is closed once it has
 * spent nothing for this long: the history lists the newest sessions first, so a session that
 * fell off it is an old one.
 */
export const UNLISTED_CHARACTER_KEPT_MS = 24 * 60 * 60_000
/** The room of agents whose workspace is unknown; the game leaves it out. */
const NO_PROJECT_ROOM = 'no-project'
const LOCAL_HOST = 'local'

const isLocalHost = (hostId) => hostId === null || hostId === undefined || hostId === LOCAL_HOST

/**
 * @typedef {{ sessionId: string, title: string | null, workspaceId: string | null,
 *   totalTokens: number, createdAt: number | null, running: boolean }} HistorySession
 * @typedef {{ id: string, roomId: string, workspaceId: string | null, title: string | null,
 *   state: string, activity: string, isLocal: boolean }} RoomAgent
 * @typedef {{ workspaceId: string, roomId: string }} Place
 */

/**
 * What an agent's state means to its character: `working`, `waiting` and `blocked` as they are, a
 * finished agent (`done`) is `idle` and gathers.
 *
 * @param {string} agentState the store's state
 * @returns {'working' | 'waiting' | 'blocked' | 'idle'}
 */
export function gameStateOf(agentState) {
  return GAME_STATE_OF_AGENT[agentState] ?? 'idle'
}

/**
 * @param {string} activity an activity from the store, such as 'write' or 'wait'
 * @returns {string} the activity the tokens are counted as
 */
export function workActivity(activity) {
  return WORK_ACTIVITIES.has(activity) ? activity : FALLBACK_ACTIVITY
}

/**
 * The main agents of every room (subagents have no session of their own), with their room.
 *
 * @param {{ id: string, host: string | null, agents: object[] }[]} rooms the store's snapshot rooms
 * @returns {RoomAgent[]}
 */
export function mainAgents(rooms) {
  const agents = []
  for (const room of rooms) {
    if (room.id === NO_PROJECT_ROOM) continue
    for (const agent of room.agents) {
      if (agent.parentId) continue
      agents.push({
        id: agent.id,
        roomId: room.id,
        workspaceId: agent.workspaceId ?? null,
        title: agent.title ?? null,
        state: agent.state,
        activity: agent.activity,
        isLocal: isLocalHost(room.host)
      })
    }
  }
  return agents
}

/**
 * The workspace and room of each session. The history names a workspace by Orca's id for it,
 * which may not be the form the store knows; then the folder Orca lists for that id finds it.
 *
 * @param {HistorySession[]} sessions
 * @param {{ workspaces: { id: string, path: string, hostId: string | null, roomId: string }[],
 *   listed: { id: string, path: string, hostId: string | null }[] }} known `workspaces` from the
 *   store, `listed` from Orca's workspace list
 * @returns {Map<string, Place | null>} by session id; null when the session has no room
 */
export function placeSessions(sessions, { workspaces, listed }) {
  const byId = new Map(workspaces.map((workspace) => [workspace.id, workspace]))
  const byPath = new Map(workspaces.filter((workspace) => isLocalHost(workspace.hostId))
    .map((workspace) => [workspace.path, workspace]))
  const listedById = new Map(listed.map((workspace) => [workspace.id, workspace]))
  const places = new Map()
  for (const session of sessions) {
    let workspace = session.workspaceId ? byId.get(session.workspaceId) : undefined
    const row = session.workspaceId ? listedById.get(session.workspaceId) : undefined
    if (!workspace && row && isLocalHost(row.hostId)) workspace = byPath.get(row.path)
    const isPlaced = workspace && workspace.roomId !== NO_PROJECT_ROOM
    places.set(session.sessionId, isPlaced ? { workspaceId: workspace.id, roomId: workspace.roomId } : null)
  }
  return places
}

/** The one item of a list, or null when there are none or several. */
const onlyOne = (list) => (list.length === 1 ? list[0] : null)

/**
 * Which agent on screen runs each session, tried in this order:
 *
 * 1. the session id an event or the snapshot gave the agent;
 * 2. the conversation title, within the same workspace, when exactly one session has it (a
 *    running one first);
 * 3. the only agent of the workspace, when exactly one running session there is left.
 *
 * Only agents on this computer are matched: the history covers this computer alone.
 *
 * @param {{ sessions: HistorySession[], places: Map<string, Place | null>, agents: RoomAgent[],
 *   links: Record<string, string> }} input `links` is the session id by agent id from the store
 * @returns {{ agentOf: Map<string, string>, how: Map<string, 'session' | 'title' | 'only'> }}
 *   by session id
 */
export function matchSessions({ sessions, places, agents, links }) {
  const agentOf = new Map()
  const how = new Map()
  const matchedAgents = new Set()
  const link = (sessionId, agentId, way) => {
    agentOf.set(sessionId, agentId)
    how.set(sessionId, way)
    matchedAgents.add(agentId)
  }
  const listed = new Set(sessions.map((session) => session.sessionId))
  for (const agent of agents) {
    const sessionId = links[agent.id]
    if (agent.isLocal && sessionId && listed.has(sessionId) && !agentOf.has(sessionId)) link(sessionId, agent.id, 'session')
  }
  const free = (workspaceId) => sessions.filter((session) =>
    !agentOf.has(session.sessionId) && places.get(session.sessionId)?.workspaceId === workspaceId)
  const waiting = () => agents.filter((agent) => agent.isLocal && !matchedAgents.has(agent.id) && agent.workspaceId)
  for (const agent of waiting()) {
    if (!agent.title) continue
    const titled = free(agent.workspaceId).filter((session) => session.title === agent.title)
    const running = titled.filter((session) => session.running)
    const chosen = onlyOne(running.length ? running : titled)
    if (chosen) link(chosen.sessionId, agent.id, 'title')
  }
  for (const agent of waiting()) {
    const alone = waiting().filter((other) => other.workspaceId === agent.workspaceId).length === 1
    const chosen = alone ? onlyOne(free(agent.workspaceId).filter((session) => session.running)) : null
    if (chosen) link(chosen.sessionId, agent.id, 'only')
  }
  return { agentOf, how }
}

/**
 * What one reading of the history means for the engine: the sessions' states for the time that
 * just passed, the tokens to count, and the guests.
 *
 * - A session matched to an agent takes the agent's state and activity.
 * - A running session with no agent counts its tokens as thinking, works while it spends and is
 *   idle otherwise; `unmatched` counts those that spent tokens.
 * - A session with no room cannot be counted; `unplaced` counts those that spent tokens. One
 *   linked to an agent is in the agent's room.
 * - An agent on another computer has no history: it joins its room's fight as a guest.
 *
 * @param {object} input
 * @param {HistorySession[]} input.sessions
 * @param {Map<string, Place | null>} input.places
 * @param {Map<string, string>} input.agentOf agent id by session id
 * @param {RoomAgent[]} input.agents
 * @param {Map<string, { tokens: number, minutes: number }>} input.deltas by session id
 * @param {(roomId: string) => string | null} input.themeOf the room's theme, for the monsters
 * @returns {{
 *   states: { projectId: string, sessionId: string, state: string, activity: string,
 *     tokensPerMinute: number, themeId: string | null, guest?: boolean, agentId?: string }[],
 *   `agentId` is set for every session an agent on screen runs, guests included
 *   tokens: { projectId: string, sessionId: string, tokens: number, activity: string,
 *     title: string | null, themeId: string | null }[],
 *   counters: { unmatched: number, unplaced: number, guests: number }
 * }}
 */
export function buildReadings({ sessions, places, agentOf, agents, deltas, themeOf }) {
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]))
  const states = []
  const tokens = []
  const counters = { unmatched: 0, unplaced: 0, guests: 0 }
  for (const session of sessions) {
    const delta = deltas.get(session.sessionId) ?? null
    const agent = agentsById.get(agentOf.get(session.sessionId)) ?? null
    // A session linked to its agent by id belongs in the agent's room, even when the history
    // names its workspace in a form that could not be placed.
    const place = places.get(session.sessionId) ?? (agent ? { roomId: agent.roomId } : null)
    if (!place) {
      if (delta) counters.unplaced += 1
      continue
    }
    if (delta && !agent) counters.unmatched += 1
    const themeId = themeOf(place.roomId)
    const activity = agent ? workActivity(agent.activity) : FALLBACK_ACTIVITY
    const projectId = place.roomId
    const { sessionId } = session
    if (delta) tokens.push({ projectId, sessionId, tokens: delta.tokens, activity, title: session.title, themeId })
    if (!agent && !session.running) continue
    const state = agent ? gameStateOf(agent.state) : (delta ? 'working' : 'idle')
    const tokensPerMinute = delta && delta.minutes > 0 ? delta.tokens / delta.minutes : 0
    const reading = { projectId, sessionId, state, activity, tokensPerMinute, themeId }
    states.push(agent ? { ...reading, agentId: agent.id } : reading)
  }
  const matched = new Set(agentOf.values())
  for (const agent of agents) {
    if (agent.isLocal || matched.has(agent.id)) continue
    const state = gameStateOf(agent.state)
    const tokensPerMinute = state === 'working' ? GUEST_TOKENS_PER_MINUTE : 0
    states.push({
      projectId: agent.roomId,
      sessionId: guestSessionId(agent.id),
      state,
      activity: workActivity(agent.activity),
      tokensPerMinute,
      themeId: themeOf(agent.roomId),
      guest: true,
      agentId: agent.id
    })
    counters.guests += 1
  }
  return { states, tokens, counters }
}

/**
 * The session id a guest fights under. Never saved: the engine keeps nothing of a guest.
 *
 * @param {string} agentId
 * @returns {string}
 */
export function guestSessionId(agentId) {
  return `guest:${agentId}`
}

/**
 * The characters whose session is over: no longer running with no agent left in the room, or
 * gone from the history (see UNLISTED_CHARACTER_KEPT_MS). A character of the token estimate has
 * no session in the history; once real totals are read it retires at once.
 *
 * @param {object} input
 * @param {{ projectId: string, sessionId: string, lastSeenAt: number | null }[]} input.characters
 *   the living characters of the save
 * @param {HistorySession[]} input.sessions
 * @param {Map<string, string>} input.agentOf
 * @param {boolean} input.truncated whether the history left older sessions out
 * @param {number} input.now
 * @returns {{ projectId: string, sessionId: string, title: string | null }[]}
 */
export function sessionsToClose({ characters, sessions, agentOf, truncated, now }) {
  const byId = new Map(sessions.map((session) => [session.sessionId, session]))
  const closing = []
  for (const { projectId, sessionId, lastSeenAt } of characters) {
    const session = byId.get(sessionId)
    const isListedOver = session
      ? !session.running && !agentOf.has(sessionId)
      : !truncated || now - (lastSeenAt ?? 0) > UNLISTED_CHARACTER_KEPT_MS
    const isOver = isEstimatedSessionId(sessionId) || isListedOver
    if (isOver) closing.push({ projectId, sessionId, title: session?.title ?? null })
  }
  return closing
}
