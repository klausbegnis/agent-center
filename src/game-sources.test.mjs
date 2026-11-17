import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAgentStore } from './domain/agent-store.mjs'
import { mainAgents } from './domain/game-sessions.mjs'
import { DEFAULT_WORK_MIX } from './domain/skill-mix.mjs'
import { attributeEstimate, readFromEstimate } from './game-sources.mjs'

const MINUTE = 60_000
const WORKSPACES = [
  { id: 'w-banana', kind: 'worktree', name: 'main', path: '/work/rumble-banana', branch: 'main', hostId: 'local' },
  { id: 'w-waffle', kind: 'worktree', name: 'main', path: '/srv/turbo-waffle', branch: 'main', hostId: 'build-box' }
]
const working = (paneKey, extra = {}) => ({ paneKey, state: 'working', hasLivePty: true, ...extra })

function setup() {
  let clock = 1_000
  const store = createAgentStore({ now: () => clock })
  store.setWorkspaces(WORKSPACES)
  return { store, tick: (ms) => (clock += ms), now: () => clock }
}

/** One estimate round over everything the store counted, with the split by activity. */
function readRound({ store, now }, observed = {}) {
  const agents = mainAgents(store.snapshot().rooms)
  const read = readFromEstimate({ meters: store.workMeters(), agents, baselines: {}, watchedUntil: 0, at: now() })
  const shared = attributeEstimate({ deltas: read.deltas, places: read.places, worldOf: () => 'main', observed })
  const [delta] = shared.deltas.values()
  return { delta, observed: shared.observed, time: shared.time.main, before: agents[0].activity }
}

const sumOf = (record) => Object.values(record).reduce((sum, value) => sum + value, 0)
const shareOf = (delta, activity) => (delta.split[activity] ?? 0) / delta.tokens

test('an untracked session with nothing observed follows the default mix, not thinking', () => {
  const game = setup()
  game.store.sync('local', [{ workspaceId: 'w-banana', agents: [working('pane-1')] }])
  game.tick(10 * MINUTE)
  const { delta, before } = readRound(game)
  assert.equal(before, 'think')
  assert.equal(sumOf(delta.split), delta.tokens)
  for (const [activity, share] of Object.entries(DEFAULT_WORK_MIX)) assert.ok(Math.abs(shareOf(delta, activity) - share) < 0.06, activity)
})

test('an agent on a paired machine is split by the mix and paid for its time alone', () => {
  const game = setup()
  game.store.sync('build-box', [{ workspaceId: 'w-waffle', agents: [working('pane-2')] }])
  game.tick(10 * MINUTE)
  const { delta } = readRound(game)
  assert.equal(delta.work.fromTimeOnly, true)
  assert.equal(sumOf(delta.split), delta.tokens)
  assert.ok(shareOf(delta, 'delegate') > 0.05 && shareOf(delta, 'think') < 0.4)
})

test('an untracked session follows the tools other agents were seen using once there are enough', () => {
  const game = setup()
  game.store.sync('local', [{ workspaceId: 'w-banana', agents: [working('pane-1')] }])
  game.tick(10 * MINUTE)
  const { delta } = readRound(game, { main: { run: 200, read: 20, write: 20 } })
  assert.ok(shareOf(delta, 'run') > 0.4)
})

test('with hooks, time between calls follows the calls and a long gap is spread by the mix', () => {
  const game = setup()
  const ref = { agent: 'claude', workspaceId: 'w-banana', terminalId: 'term-1' }
  game.store.toolBefore({ ...ref, tool: 'Read', callId: 'c1' })
  game.tick(2 * MINUTE)
  game.store.toolBefore({ ...ref, tool: 'Edit', callId: 'c2' })
  game.tick(MINUTE)
  game.store.toolBefore({ ...ref, tool: 'Bash', callId: 'c3' })
  game.tick(20 * MINUTE)
  const { delta, time, before } = readRound(game)
  assert.equal(before, 'run')
  assert.equal(sumOf(delta.split), delta.tokens)
  assert.ok(Math.abs(time.unknownMs - 10 * MINUTE) < 1)
  for (const activity of ['write', 'read', 'run', 'think', 'delegate']) assert.ok(delta.split[activity] > 0, activity)
})

test('a parent with subagents earns Command for half its time and its subagents\' tools for the rest', () => {
  const game = setup()
  const ref = { agent: 'claude', workspaceId: 'w-banana', terminalId: 'term-1' }
  game.store.toolBefore({ ...ref, tool: 'Agent', input: { description: 'survey the code' }, callId: 'a1' })
  for (const tool of ['Grep', 'Read', 'Read', 'Edit']) {
    game.tick(2 * MINUTE)
    game.store.toolBefore({ ...ref, tool, callId: tool })
  }
  game.tick(2 * MINUTE)
  game.store.toolAfter({ ...ref, tool: 'Agent', callId: 'a1' })
  const { delta, before } = readRound(game)
  assert.equal(before, 'think')
  assert.equal(sumOf(delta.split), delta.tokens)
  assert.ok(shareOf(delta, 'delegate') > 0.35, String(shareOf(delta, 'delegate')))
  assert.ok(delta.split.read > delta.split.write)
})

test('the split never changes the tokens a round estimates', () => {
  const game = setup()
  const ref = { agent: 'claude', workspaceId: 'w-banana', terminalId: 'term-1' }
  game.store.toolBefore({ ...ref, tool: 'Read', callId: 'c1' })
  game.tick(3 * MINUTE)
  const agents = mainAgents(game.store.snapshot().rooms)
  const read = readFromEstimate({ meters: game.store.workMeters(), agents, baselines: {}, watchedUntil: 0, at: game.now() })
  const shared = attributeEstimate({ deltas: read.deltas, places: read.places, worldOf: () => 'main', observed: {} })
  for (const [sessionId, delta] of read.deltas) {
    assert.equal(shared.deltas.get(sessionId).tokens, delta.tokens)
    assert.equal(sumOf(shared.deltas.get(sessionId).split), delta.tokens)
  }
})

test('a round adds its tool calls to the world\'s observed mix', () => {
  const game = setup()
  const ref = { agent: 'claude', workspaceId: 'w-banana', terminalId: 'term-1' }
  game.store.toolBefore({ ...ref, tool: 'Bash', callId: 'c1' })
  game.tick(MINUTE)
  const { observed } = readRound(game, { main: { read: 4 } })
  assert.equal(observed.main.read, 4)
  assert.equal(observed.main.run, 1)
})

test('a meter that shared none of its time is spread by the world\'s mix, not given to thinking', () => {
  const deltas = new Map([['estimated:pane-1', { tokens: 1_000, minutes: 1,
    work: { attributedMs: {}, callsBy: {}, toolCalls: 0, minutes: 1, fromTimeOnly: false } }]])
  const places = new Map([['estimated:pane-1', { roomId: 'local:/work/rumble-banana' }]])
  const { deltas: shared } = attributeEstimate({ deltas, places, worldOf: () => 'main', observed: {} })
  const split = shared.get('estimated:pane-1').split
  assert.equal(split.think, 250)
  assert.equal(split.delegate, 100)
})
