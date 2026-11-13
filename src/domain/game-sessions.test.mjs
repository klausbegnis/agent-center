import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  GUEST_TOKENS_PER_MINUTE,
  UNLISTED_CHARACTER_KEPT_MS,
  buildReadings,
  mainAgents,
  matchSessions,
  placeSessions,
  sessionsToClose,
  workActivity
} from './game-sessions.mjs'

const BANANA = 'local:/work/rumble-banana'
const WORKSPACES = [
  { id: 'identity:banana-main', path: '/work/rumble-banana', hostId: 'local', roomId: BANANA },
  { id: 'identity:banana-search', path: '/work/rumble-banana-worktrees/search-filters', hostId: 'local', roomId: BANANA },
  { id: 'build-box:waffle', path: '/srv/turbo-waffle', hostId: 'build-box', roomId: 'build-box:/srv/turbo-waffle' }
]

function historySession(sessionId, extra = {}) {
  return {
    sessionId,
    title: null,
    workspaceId: 'identity:banana-main',
    totalTokens: 0,
    createdAt: 0,
    running: true,
    ...extra
  }
}

function agent(id, extra = {}) {
  return {
    id,
    roomId: BANANA,
    workspaceId: 'identity:banana-main',
    title: null,
    state: 'working',
    activity: 'write',
    isLocal: true,
    ...extra
  }
}

const placeAll = (sessions) => placeSessions(sessions, { workspaces: WORKSPACES, listed: [] })

test('a session is placed in the room of the workspace it names', () => {
  const places = placeAll([historySession('s1')])
  assert.deepEqual(places.get('s1'), { workspaceId: 'identity:banana-main', roomId: BANANA })
})

test('a workspace named in another form of id is found through its folder', () => {
  const sessions = [historySession('s1', { workspaceId: 'list-7' })]
  const listed = [{ id: 'list-7', path: '/work/rumble-banana-worktrees/search-filters', hostId: 'local' }]
  const places = placeSessions(sessions, { workspaces: WORKSPACES, listed })
  assert.equal(places.get('s1').workspaceId, 'identity:banana-search')
})

test('a session whose workspace is unknown has no room', () => {
  const places = placeAll([historySession('s1', { workspaceId: 'nowhere' }), historySession('s2', { workspaceId: null })])
  assert.equal(places.get('s1'), null)
  assert.equal(places.get('s2'), null)
})

test('the session id an event gave an agent links them first', () => {
  const sessions = [historySession('s1', { title: 'Fix checkout rounding' }), historySession('s2')]
  const agents = [agent('pane-1', { title: 'Fix checkout rounding' })]
  const { agentOf, how } = matchSessions({ sessions, places: placeAll(sessions), agents, links: { 'pane-1': 's2' } })
  assert.equal(agentOf.get('s2'), 'pane-1')
  assert.equal(how.get('s2'), 'session')
  assert.equal(agentOf.has('s1'), false)
})

test('without a session id, the conversation title in the same workspace links them', () => {
  const sessions = [
    historySession('s1', { title: 'Search filters' }),
    historySession('s2', { title: 'Fix checkout rounding' })
  ]
  const agents = [agent('pane-1', { title: 'Fix checkout rounding' }), agent('pane-2', { title: 'Search filters' })]
  const { agentOf, how } = matchSessions({ sessions, places: placeAll(sessions), agents, links: {} })
  assert.equal(agentOf.get('s2'), 'pane-1')
  assert.equal(agentOf.get('s1'), 'pane-2')
  assert.equal(how.get('s1'), 'title')
})

test('a title shared by two sessions prefers the running one', () => {
  const sessions = [
    historySession('old', { title: 'Release notes', running: false }),
    historySession('new', { title: 'Release notes' })
  ]
  const agents = [agent('pane-1', { title: 'Release notes' })]
  const { agentOf } = matchSessions({ sessions, places: placeAll(sessions), agents, links: {} })
  assert.equal(agentOf.get('new'), 'pane-1')
})

test('a title in another workspace does not link them', () => {
  const sessions = [historySession('s1', { title: 'Release notes', workspaceId: 'identity:banana-search' })]
  const agents = [agent('pane-1', { title: 'Release notes' }), agent('pane-2', { workspaceId: 'identity:banana-search' }),
    agent('pane-3', { workspaceId: 'identity:banana-search' })]
  const { agentOf } = matchSessions({ sessions, places: placeAll(sessions), agents, links: {} })
  assert.equal(agentOf.has('s1'), false)
})

test('the only agent of a workspace takes its only running session', () => {
  const sessions = [historySession('s1', { title: 'Something else' }), historySession('closed', { running: false })]
  const agents = [agent('pane-1', { title: 'Cart drawer polish' })]
  const { agentOf, how } = matchSessions({ sessions, places: placeAll(sessions), agents, links: {} })
  assert.equal(agentOf.get('s1'), 'pane-1')
  assert.equal(how.get('s1'), 'only')
  assert.equal(agentOf.has('closed'), false)
})

test('two agents and two untitled sessions in one workspace stay unmatched', () => {
  const sessions = [historySession('s1'), historySession('s2')]
  const agents = [agent('pane-1'), agent('pane-2')]
  const { agentOf } = matchSessions({ sessions, places: placeAll(sessions), agents, links: {} })
  assert.equal(agentOf.size, 0)
})

test('an agent on another computer is never matched to this computer\'s history', () => {
  const sessions = [historySession('s1')]
  const agents = [agent('pane-1', { isLocal: false })]
  const { agentOf } = matchSessions({ sessions, places: placeAll(sessions), agents, links: { 'pane-1': 's1' } })
  assert.equal(agentOf.size, 0)
})

test('a matched session fights with its agent\'s state and counts tokens as its activity', () => {
  const sessions = [historySession('s1')]
  const { states, tokens } = buildReadings({
    sessions,
    places: placeAll(sessions),
    agentOf: new Map([['s1', 'pane-1']]),
    agents: [agent('pane-1', { activity: 'run' })],
    deltas: new Map([['s1', { tokens: 30_000, minutes: 0.5 }]]),
    themeOf: () => 'guild-hall'
  })
  assert.deepEqual(states, [{
    projectId: BANANA, sessionId: 's1', state: 'working', activity: 'run', tokensPerMinute: 60_000, themeId: 'guild-hall',
    agentId: 'pane-1'
  }])
  assert.deepEqual(tokens, [{
    projectId: BANANA, sessionId: 's1', tokens: 30_000, activity: 'run', title: null, themeId: 'guild-hall'
  }])
})

test('a finished agent\'s character is idle, and waiting is passed on as it is', () => {
  const sessions = [historySession('s1'), historySession('s2')]
  const { states } = buildReadings({
    sessions,
    places: placeAll(sessions),
    agentOf: new Map([['s1', 'pane-1'], ['s2', 'pane-2']]),
    agents: [agent('pane-1', { state: 'done', activity: 'sleep' }), agent('pane-2', { state: 'waiting', activity: 'wait' })],
    deltas: new Map(),
    themeOf: () => null
  })
  assert.deepEqual(states.map((reading) => [reading.state, reading.activity]), [['idle', 'think'], ['waiting', 'think']])
})

test('tokens of a session that matches no agent count as thinking and are counted as unmatched', () => {
  const sessions = [historySession('s1')]
  const { states, tokens, counters } = buildReadings({
    sessions,
    places: placeAll(sessions),
    agentOf: new Map(),
    agents: [],
    deltas: new Map([['s1', { tokens: 10_000, minutes: 1 }]]),
    themeOf: () => null
  })
  assert.equal(tokens[0].activity, 'think')
  assert.equal(states[0].state, 'working')
  assert.equal(counters.unmatched, 1)
})

test('tokens of a session with no room are not counted, and are counted as unplaced', () => {
  const sessions = [historySession('s1', { workspaceId: 'nowhere' })]
  const { states, tokens, counters } = buildReadings({
    sessions,
    places: placeAll(sessions),
    agentOf: new Map(),
    agents: [],
    deltas: new Map([['s1', { tokens: 10_000, minutes: 1 }]]),
    themeOf: () => null
  })
  assert.deepEqual([states, tokens, counters.unplaced], [[], [], 1])
})

test('the last tokens of a closed session still count', () => {
  const sessions = [historySession('s1', { running: false })]
  const { states, tokens } = buildReadings({
    sessions,
    places: placeAll(sessions),
    agentOf: new Map(),
    agents: [],
    deltas: new Map([['s1', { tokens: 5_000, minutes: 1 }]]),
    themeOf: () => null
  })
  assert.equal(tokens.length, 1)
  assert.equal(states.length, 0)
})

test('an agent on another computer joins its room\'s fight as a guest', () => {
  const remote = agent('pane-9', { roomId: 'build-box:/srv/turbo-waffle', isLocal: false, activity: 'read' })
  const { states, counters } = buildReadings({
    sessions: [], places: new Map(), agentOf: new Map(), agents: [remote], deltas: new Map(), themeOf: () => null
  })
  assert.deepEqual(states, [{
    projectId: 'build-box:/srv/turbo-waffle',
    sessionId: 'guest:pane-9',
    state: 'working',
    activity: 'read',
    tokensPerMinute: GUEST_TOKENS_PER_MINUTE,
    themeId: null,
    guest: true,
    agentId: 'pane-9'
  }])
  assert.equal(counters.guests, 1)
})

test('a session that stopped running and has no agent left is closed, with its title for the engine', () => {
  const sessions = [historySession('s1', { running: false, title: 'Release notes' }), historySession('s2', { running: false })]
  const characters = [{ projectId: BANANA, sessionId: 's1', lastSeenAt: 0 }, { projectId: BANANA, sessionId: 's2', lastSeenAt: 0 }]
  const closing = sessionsToClose({ characters, sessions, agentOf: new Map([['s2', 'pane-2']]), truncated: false, now: 0 })
  assert.deepEqual(closing, [{ projectId: BANANA, sessionId: 's1', title: 'Release notes' }])
})

test('a character whose session left the full history is closed', () => {
  const closing = sessionsToClose({
    characters: [{ projectId: BANANA, sessionId: 'gone', lastSeenAt: 0 }],
    sessions: [],
    agentOf: new Map(),
    truncated: false,
    now: 1
  })
  assert.equal(closing.length, 1)
})

test('a character missing from a truncated history is kept for a day', () => {
  const characters = [{ projectId: BANANA, sessionId: 'old', lastSeenAt: 0 }]
  const input = { characters, sessions: [], agentOf: new Map(), truncated: true }
  assert.equal(sessionsToClose({ ...input, now: UNLISTED_CHARACTER_KEPT_MS }).length, 0)
  assert.equal(sessionsToClose({ ...input, now: UNLISTED_CHARACTER_KEPT_MS + 1 }).length, 1)
})

test('only main agents of a known room are considered, with whether they are on this computer and which machine', () => {
  const rooms = [
    { id: BANANA, host: 'local', agents: [{ id: 'pane-1', workspaceId: 'w', title: 't', state: 'working', activity: 'write', parentId: null },
      { id: 'pane-1/sub', parentId: 'pane-1', state: 'working', activity: 'read' }] },
    { id: 'build-box:/srv/turbo-waffle', host: 'build-box', agents: [{ id: 'pane-2', state: 'done', activity: 'sleep', parentId: null }] },
    { id: 'no-project', host: null, agents: [{ id: 'pane-3', state: 'working', activity: 'think', parentId: null }] }
  ]
  const found = mainAgents(rooms).map((item) => [item.id, item.isLocal, item.hostId])
  assert.deepEqual(found, [['pane-1', true, 'local'], ['pane-2', false, 'build-box']])
})

test('activities without a work skill count as thinking', () => {
  assert.deepEqual(['write', 'wait', 'sleep', 'delegate'].map(workActivity), ['write', 'think', 'think', 'delegate'])
})

test('a session linked to its agent by id counts in the agent\'s room even when its workspace is unknown', () => {
  const sessions = [historySession('s1', { workspaceId: 'list-form-id' })]
  const places = placeAll(sessions)
  const agents = [agent('pane-1')]
  const { agentOf } = matchSessions({ sessions, places, agents, links: { 'pane-1': 's1' } })
  const { tokens, counters } = buildReadings({
    sessions, places, agentOf, agents, deltas: new Map([['s1', { tokens: 9_000, minutes: 1 }]]), themeOf: () => null
  })
  assert.equal(tokens[0].projectId, BANANA)
  assert.equal(counters.unplaced, 0)
})

test('a character of the token estimate retires as soon as real session totals are read', () => {
  const closing = sessionsToClose({
    characters: [{ projectId: BANANA, sessionId: 'estimated:pane-1', lastSeenAt: 0 }],
    sessions: [historySession('s1')],
    agentOf: new Map(),
    truncated: true,
    now: 1
  })
  assert.deepEqual(closing, [{ projectId: BANANA, sessionId: 'estimated:pane-1', title: null }])
})
