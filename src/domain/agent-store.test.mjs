import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAgentStore, mostUrgentState } from './agent-store.mjs'

const WORKSPACES = [
  { id: 'w-base', kind: 'worktree', name: 'main', path: '/p/base', branch: 'main', hostId: 'local' },
  { id: 'w-api', kind: 'worktree', name: 'dev', path: '/p/base/api', branch: 'dev', hostId: 'local' },
  { id: 'w-feature', kind: 'worktree', name: 'feature', path: '/p/base/worktrees/feature', branch: 'feature', hostId: 'local' },
  { id: 'w-front', kind: 'worktree', name: 'main', path: '/p/front', branch: 'main', hostId: 'build-box' },
  { id: 'w-basement', kind: 'worktree', name: 'main', path: '/p/basement', branch: 'main', hostId: 'local' }
]

function setup() {
  let clock = 1_000
  const store = createAgentStore({ now: () => clock, sleepMs: 60_000 })
  store.setWorkspaces(WORKSPACES)
  return { store, tick: (ms) => (clock += ms) }
}

test('groups agents into the room of the outermost workspace', () => {
  const { store } = setup()
  store.status({ workspaceId: 'w-api', paneKey: 'p1', terminalId: 't1', state: 'working', receivedAt: 1 })
  store.status({ workspaceId: 'w-feature', paneKey: 'p2', terminalId: 't2', state: 'waiting', receivedAt: 1 })
  store.status({ workspaceId: 'w-front', paneKey: 'p3', terminalId: 't3', state: 'blocked', receivedAt: 1 })
  const { rooms, counts } = store.snapshot()
  // Occupied rooms come first; the empty one shows last.
  assert.deepEqual(rooms.map((room) => [room.name, room.agents.length]), [['base', 2], ['front', 1], ['basement', 0]])
  assert.equal(rooms[1].host, 'build-box')
  assert.deepEqual(rooms[0].agents.map((agent) => [agent.name, agent.activity]), [['api', 'think'], ['feature', 'wait']])
  assert.equal(rooms[1].agents[0].activity, 'blocked')
  assert.deepEqual(counts, { working: 1, waiting: 1, blocked: 1, done: 0, subs: 0 })
})

test('the tool in use becomes the agent activity', () => {
  const { store } = setup()
  store.toolBefore({ agent: 'claude', workspaceId: 'w-front', terminalId: 't3', tool: 'Edit', input: {}, callId: 'c1' })
  const agent = store.snapshot().rooms[0].agents[0]
  assert.equal(agent.activity, 'write')
  assert.equal(agent.kind, 'claude')
  assert.equal(agent.name, 'front')
})

test('subagents come and go with the Agent tool', () => {
  const { store } = setup()
  const ref = { agent: 'claude', workspaceId: 'w-front', terminalId: 't3' }
  store.toolBefore({ ...ref, tool: 'Agent', input: { subagent_type: 'Explore' }, callId: 'a1' })
  store.toolBefore({ ...ref, tool: 'Grep', input: {}, callId: 'g1' })
  let agents = store.snapshot().rooms[0].agents
  assert.equal(agents.length, 2)
  assert.equal(agents[0].activity, 'delegate')
  assert.deepEqual([agents[1].name, agents[1].activity, agents[1].parentId], ['Explore', 'read', 't3'])
  assert.equal(store.snapshot().counts.subs, 1)

  store.toolAfter({ ...ref, tool: 'Agent', input: {}, callId: 'a1' })
  agents = store.snapshot().rooms[0].agents
  assert.equal(agents.length, 1)
  assert.equal(agents[0].activity, 'think')
})

test('a status that arrives with only a paneKey is joined to its terminal later', () => {
  const { store } = setup()
  store.status({ workspaceId: 'w-front', paneKey: 'p3', state: 'working', receivedAt: 1 })
  store.status({ workspaceId: 'w-front', paneKey: 'p3', terminalId: 't3', state: 'waiting', receivedAt: 2 })
  const agents = store.snapshot().rooms[0].agents
  assert.equal(agents.length, 1)
  assert.equal(agents[0].id, 'p3')
})

test('a finished agent sleeps and leaves after the limit', () => {
  const { store, tick } = setup()
  store.status({ workspaceId: 'w-front', paneKey: 'p3', terminalId: 't3', state: 'done', unread: false, receivedAt: 1_000 })
  assert.equal(store.snapshot().rooms[0].agents[0].activity, 'sleep')
  tick(30_000)
  assert.equal(store.prune(), false)
  tick(40_000)
  assert.equal(store.prune(), true)
  assert.equal(store.snapshot().rooms.flatMap((room) => room.agents).length, 0)
})

test('a folder with a similar name does not join another room', () => {
  const { store } = setup()
  store.status({ workspaceId: 'w-basement', paneKey: 'p9', terminalId: 't9', state: 'working', receivedAt: 1 })
  const occupied = store.snapshot().rooms.filter((room) => room.agents.length > 0)
  assert.deepEqual(occupied.map((room) => room.name), ['basement'])
})

test('the CLI snapshot brings in what was already running and removes what closed', () => {
  const { store, tick } = setup()
  const rows = [
    {
      workspaceId: 'w-api',
      agents: [
        { paneKey: 'p1', parentPaneKey: null, state: 'working', agentType: 'claude', toolName: 'Bash', stateStartedAt: 500 },
        { paneKey: 'p1-sub', parentPaneKey: 'p1', state: 'working', displayName: 'reviewer', toolName: 'Read' },
        { paneKey: 'p2', parentPaneKey: null, state: 'done', agentType: 'codex', mainAgent: { state: 'done', stateStartedAt: 1 } },
        { paneKey: 'p-dead', parentPaneKey: null, state: 'done', hasLivePty: false }
      ]
    }
  ]
  store.sync('local', rows)
  let agents = store.snapshot().rooms[0].agents
  assert.deepEqual(
    agents.map((agent) => [agent.id, agent.kind, agent.activity, agent.parentId]),
    [['p1', 'claude', 'run', null], ['p1-sub', 'claude', 'read', 'p1'], ['p2', 'codex', 'sleep', null]]
  )

  // A later event for the same pane updates the same agent without duplicating it.
  store.status({ workspaceId: 'w-api', paneKey: 'p1', terminalId: 't1', state: 'waiting', receivedAt: 2_000 })
  store.toolBefore({ agent: 'claude', workspaceId: 'w-api', terminalId: 't1', tool: 'Edit', input: {} })
  agents = store.snapshot().rooms[0].agents
  assert.equal(agents.filter((agent) => agent.parentId === null).length, 2)

  // One snapshot without it is not enough: a busy agent can be missed once.
  const withoutP1 = [{ workspaceId: 'w-api', agents: [rows[0].agents[2]] }]
  tick(20_000)
  store.sync('local', withoutP1)
  assert.deepEqual(store.snapshot().rooms[0].agents.filter((agent) => !agent.parentId).map((agent) => agent.id), ['p1', 'p2'])
  tick(20_000)
  store.sync('local', withoutP1)
  assert.deepEqual(store.snapshot().rooms[0].agents.map((agent) => agent.id), ['p2'])
})

test('worktrees of the same repository share a room, and empty rooms show up', () => {
  const store = createAgentStore()
  store.setWorkspaces([
    { id: 'a', repoId: 'r1', path: '/p/kitchen', hostId: 'build-box' },
    { id: 'b', repoId: 'r1', path: '/elsewhere/worktrees/task', hostId: 'build-box' },
    { id: 'c', repoId: 'r2', path: '/p/other', hostId: 'build-box' }
  ])
  assert.deepEqual(store.snapshot().rooms.map((room) => [room.name, room.agents.length]), [['kitchen', 0], ['other', 0]])
})

const occupied = (store) => store.snapshot().rooms.filter((room) => room.agents.length > 0)
const agentsOf = (store) => occupied(store).flatMap((room) => room.agents)

test('an agent that keeps sending events is not removed by snapshots that miss it', () => {
  const { store, tick } = setup()
  const ref = { agent: 'claude', workspaceId: 'w-api', paneKey: 'p1', terminalId: 't1' }
  store.status({ ...ref, state: 'working', receivedAt: 1_000 })
  for (let round = 0; round < 4; round++) {
    tick(15_000)
    store.toolBefore({ ...ref, tool: 'Edit', input: {} })
    tick(1_000)
    store.sync('local', [{ workspaceId: 'w-api', agents: [] }])
  }
  assert.deepEqual(agentsOf(store).map((agent) => [agent.id, agent.activity]), [['p1', 'write']])
})

test('a tool event that only names the terminal joins the agent the snapshot knows by its pane', () => {
  const { store } = setup()
  const rows = [
    {
      workspaceId: 'w-api',
      agents: [
        { paneKey: 'p1', parentPaneKey: null, state: 'done', agentType: 'claude', stateStartedAt: 100 },
        { paneKey: 'p2', parentPaneKey: null, state: 'done', agentType: 'claude', stateStartedAt: 100 }
      ]
    }
  ]
  store.sync('local', rows)
  store.linkTerminals([{ terminalId: 't1', paneKey: 'p1' }])
  store.toolBefore({ agent: 'claude', workspaceId: 'w-api', terminalId: 't1', tool: 'Bash', input: {} })
  assert.deepEqual(
    agentsOf(store).map((agent) => [agent.id, agent.activity]),
    [['p1', 'run'], ['p2', 'sleep']]
  )
})

test('an agent first seen under its terminal is folded into its pane once the link is known', () => {
  const { store } = setup()
  const rows = [
    {
      workspaceId: 'w-api',
      agents: [
        { paneKey: 'p1', parentPaneKey: null, state: 'done', agentType: 'claude', stateStartedAt: 100 },
        { paneKey: 'p2', parentPaneKey: null, state: 'done', agentType: 'claude', stateStartedAt: 100 }
      ]
    }
  ]
  store.sync('local', rows)
  // Two agents share the workspace, so the terminal cannot be matched yet.
  store.toolBefore({ agent: 'claude', workspaceId: 'w-api', terminalId: 't1', tool: 'Edit', input: {} })
  assert.equal(agentsOf(store).length, 3)
  store.linkTerminals([{ terminalId: 't1', paneKey: 'p1' }])
  assert.deepEqual(
    agentsOf(store).map((agent) => [agent.id, agent.state, agent.activity]),
    [['p1', 'working', 'write'], ['p2', 'done', 'sleep']]
  )
})

test('with a single agent in the workspace, a terminal-only event is taken to be about it', () => {
  const { store } = setup()
  store.sync('local', [
    { workspaceId: 'w-api', agents: [{ paneKey: 'p1', parentPaneKey: null, state: 'done', agentType: 'claude', stateStartedAt: 100 }] }
  ])
  store.toolBefore({ agent: 'claude', workspaceId: 'w-api', terminalId: 't1', tool: 'Read', input: {} })
  assert.deepEqual(agentsOf(store).map((agent) => [agent.id, agent.activity]), [['p1', 'read']])
})

test('an event naming a workspace the snapshot does not know leaves the agent in its room', () => {
  const { store } = setup()
  store.sync('build-box', [
    { workspaceId: 'w-front', agents: [{ paneKey: 'p3', parentPaneKey: null, state: 'done', agentType: 'claude', stateStartedAt: 100 }] }
  ])
  store.status({ workspaceId: 'some-other-form-of-id', paneKey: 'p3', state: 'working', receivedAt: 2_000 })
  assert.deepEqual(occupied(store).map((room) => [room.name, room.agents[0].state]), [['front', 'working']])
})

test('a snapshot that is older than the last event does not undo the event', () => {
  const { store, tick } = setup()
  const agent = { paneKey: 'p1', parentPaneKey: null, state: 'working', agentType: 'claude', stateStartedAt: 500 }
  store.sync('local', [{ workspaceId: 'w-api', agents: [agent] }])
  tick(5_000)
  store.status({ workspaceId: 'w-api', paneKey: 'p1', state: 'waiting', receivedAt: 6_000 })
  // The snapshot was read before the agent started waiting.
  store.sync('local', [{ workspaceId: 'w-api', agents: [agent] }])
  assert.equal(agentsOf(store)[0].activity, 'wait')
})

test('a finished agent on no known host ages out even while snapshots cover the others', () => {
  const { store, tick } = setup()
  store.status({ workspaceId: null, paneKey: 'lost', state: 'done', receivedAt: 1_000 })
  store.status({ workspaceId: 'w-api', paneKey: 'p1', state: 'done', receivedAt: 1_000 })
  tick(120_000)
  assert.equal(store.prune({ everyHost: false }), true)
  assert.deepEqual(agentsOf(store).map((agent) => agent.id), ['p1'])
})

test('the state that needs the person most wins', () => {
  assert.equal(mostUrgentState('working', 'blocked'), 'blocked')
  assert.equal(mostUrgentState('waiting', 'working'), 'waiting')
  assert.equal(mostUrgentState('done', 'working'), 'working')
  assert.equal(mostUrgentState('done', undefined, 'interrupted'), 'done')
  assert.equal(mostUrgentState(undefined, null), undefined)
})

test('a pane blocked on an approval shows as blocked even while its main agent is working', () => {
  const { store } = setup()
  store.status({
    workspaceId: 'w-api',
    paneKey: 'p1',
    state: 'blocked',
    mainAgent: { state: 'working', stateStartedAt: 500 },
    receivedAt: 2_000
  })
  assert.equal(agentsOf(store)[0].activity, 'blocked')
  assert.equal(store.snapshot().counts.blocked, 1)
})

test('a snapshot that reports a waiting pane shows the agent waiting', () => {
  const { store } = setup()
  store.sync('local', [
    {
      workspaceId: 'w-api',
      agents: [
        { paneKey: 'p1', parentPaneKey: null, state: 'waiting', agentType: 'claude', mainAgent: { state: 'working', stateStartedAt: 100 }, stateStartedAt: 900 }
      ]
    }
  ])
  assert.equal(agentsOf(store)[0].activity, 'wait')
})

test('an agent leads to the terminal it runs in, and a subagent to its parent\'s', () => {
  const { store } = setup()
  store.status({ workspaceId: 'w-front', paneKey: 'p1', terminalId: 't1', state: 'working', receivedAt: 1 })
  store.toolBefore({ workspaceId: 'w-front', paneKey: 'p1', tool: 'Agent', input: { subagent_type: 'Explore' }, callId: 'c1' })
  const helper = store.snapshot().rooms.flatMap((room) => room.agents).find((agent) => agent.parentId === 'p1')

  assert.deepEqual(store.terminalOf('p1'), { terminalId: 't1', hostId: 'build-box' })
  assert.deepEqual(store.terminalOf(helper.id), { terminalId: 't1', hostId: 'build-box' })
})

test('an agent without a linked terminal, or an unknown one, has no terminal', () => {
  const { store } = setup()
  store.status({ workspaceId: 'w-api', paneKey: 'p1', state: 'working', receivedAt: 1 })
  assert.equal(store.terminalOf('p1'), null)
  assert.equal(store.terminalOf('nobody'), null)
})

const activityOf = (store, id) =>
  store.snapshot().rooms.flatMap((room) => room.agents).find((agent) => agent.id === id).activity
const unreadRow = (unread, state = 'done') => [
  { workspaceId: 'w-api', agents: [{ paneKey: 'p1', parentPaneKey: null, state, unread, stateStartedAt: 1 }] }
]

test('an agent that finishes stays up until the snapshot says it was seen', () => {
  const { store } = setup()
  store.status({ workspaceId: 'w-api', paneKey: 'p1', state: 'working', receivedAt: 1 })
  store.status({ workspaceId: 'w-api', paneKey: 'p1', state: 'done', receivedAt: 2 })
  assert.equal(activityOf(store, 'p1'), 'done')

  store.sync('local', unreadRow(true))
  assert.equal(activityOf(store, 'p1'), 'done')
  store.sync('local', unreadRow(false))
  assert.equal(activityOf(store, 'p1'), 'sleep')
})

test('an agent found already finished and seen is asleep, and one not seen is up', () => {
  const { store } = setup()
  store.sync('local', unreadRow(false))
  assert.equal(activityOf(store, 'p1'), 'sleep')
  store.sync('local', unreadRow(true))
  assert.equal(activityOf(store, 'p1'), 'done')
})

test('starting to work again clears the unseen finish', () => {
  const { store } = setup()
  store.status({ workspaceId: 'w-api', paneKey: 'p1', state: 'done', receivedAt: 1 })
  store.status({ workspaceId: 'w-api', paneKey: 'p1', state: 'working', receivedAt: 2 })
  store.status({ workspaceId: 'w-api', paneKey: 'p1', state: 'done', unread: false, receivedAt: 3 })
  assert.equal(activityOf(store, 'p1'), 'sleep')
})

test('a working agent on no known host leaves after long silence, and not before', () => {
  const { store, tick } = setup()
  store.status({ workspaceId: 'w-unknown', paneKey: 'p1', state: 'working', receivedAt: 1 })
  tick(20 * 60_000)
  assert.equal(store.prune({ everyHost: false }), false)
  tick(11 * 60_000)
  assert.equal(store.prune({ everyHost: false }), true)
  assert.equal(store.snapshot().rooms.flatMap((room) => room.agents).length, 0)
})

test('a silent working agent on a known host stays: its snapshot decides', () => {
  const { store, tick } = setup()
  store.status({ workspaceId: 'w-api', paneKey: 'p1', state: 'working', receivedAt: 1 })
  tick(60 * 60_000)
  assert.equal(store.prune({ everyHost: false }), false)
})

test('an event for a terminal whose agent is long gone starts a new agent', () => {
  const { store, tick } = setup()
  store.status({ workspaceId: 'w-unknown', paneKey: 'p1', terminalId: 't1', state: 'working', receivedAt: 1 })
  tick(31 * 60_000)
  store.prune()
  store.toolBefore({ workspaceId: 'w-unknown', terminalId: 't1', tool: 'Bash', input: {} })
  assert.deepEqual(store.snapshot().rooms.flatMap((room) => room.agents).map((agent) => agent.id), ['t1'])
})

test('a call id that is not text still ends its subagent, and later snapshots still work', () => {
  const { store } = setup()
  const ref = { agent: 'claude', workspaceId: 'w-api', paneKey: 'p1', terminalId: 't1' }
  store.toolBefore({ ...ref, tool: 'Agent', input: { subagent_type: 'Explore' }, callId: 42 })
  store.toolAfter({ ...ref, tool: 'Agent', input: {} })
  assert.doesNotThrow(() => store.sync('local', unreadRow(false, 'working')))
  assert.equal(store.snapshot().counts.subs, 0)
})

test('a title is cleaned and cut before it is shown', () => {
  const { store } = setup()
  store.status({ workspaceId: 'w-api', paneKey: 'p1', title: `Fix\u202E ${'x'.repeat(500)}`, receivedAt: 1 })
  const { title } = agentsOf(store)[0]
  assert.ok([...title].length <= 80)
  assert.ok(!title.includes('\u202E'))
})

test('an agent a hook created under its terminal joins its pane when a status names both', () => {
  const { store } = setup()
  store.status({ workspaceId: 'w-api', paneKey: 'p1', state: 'working', receivedAt: 1 })
  store.status({ workspaceId: 'w-api', paneKey: 'p2', state: 'working', receivedAt: 1 })
  // Two agents in the workspace, so the hook cannot tell which one it is about.
  store.toolBefore({ agent: 'claude', workspaceId: 'w-api', terminalId: 't9', tool: 'Edit', input: {} })
  assert.equal(agentsOf(store).length, 3)
  store.status({ workspaceId: 'w-api', paneKey: 'p1', terminalId: 't9', state: 'working', receivedAt: 2 })
  assert.deepEqual(agentsOf(store).map((agent) => agent.id).sort(), ['p1', 'p2'])
})

test('a snapshot read before the agent finished does not clear its bell', () => {
  const { store } = setup()
  store.status({ workspaceId: 'w-api', paneKey: 'p1', state: 'working', receivedAt: 1 })
  store.status({ workspaceId: 'w-api', paneKey: 'p1', state: 'done', receivedAt: 5 })
  store.sync('local', unreadRow(false, 'working'))
  assert.equal(activityOf(store, 'p1'), 'done')
})
