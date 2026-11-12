import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withUntrackedSessions } from './untracked-sessions.mjs'

const NOW = 1_000_000
const row = (path, agents = []) => ({ workspaceId: path, workspace: { path }, agents })
const terminal = (paneKey, title, secondsAgo, worktreePath = '/work/rumble-banana') => ({
  paneKey,
  title,
  lastOutputAt: secondsAgo === null ? null : NOW - secondsAgo * 1000,
  worktreePath
})
const added = (rows) => rows.flatMap((item) => item.agents).map((agent) => [agent.paneKey, agent.state, agent.conversationName])

test('a terminal with an agent title that Orca does not list becomes a working agent', () => {
  const rows = withUntrackedSessions([row('/work/rumble-banana')], [terminal('p1', '✳ Fix checkout rounding', 5)], NOW)
  assert.deepEqual(added(rows), [['p1', 'working', 'Fix checkout rounding']])
})

test('a spinner in the title counts as an agent title too', () => {
  const rows = withUntrackedSessions([row('/work/rumble-banana')], [terminal('p1', '⠂ Search filters', 2)], NOW)
  assert.deepEqual(added(rows), [['p1', 'working', 'Search filters']])
})

test('one that has been quiet, or printed nothing since Orca started, is done', () => {
  const terminals = [terminal('p1', '✳ Release notes', 300), terminal('p2', '✳ Cart drawer polish', null)]
  const rows = withUntrackedSessions([row('/work/rumble-banana')], terminals, NOW)
  assert.deepEqual(added(rows).map((item) => item[1]), ['done', 'done'])
})

test('a plain shell is not an agent', () => {
  const terminals = [terminal('p1', '..rumble-banana', 1), terminal('p2', 'npm test', 1), terminal('p3', null, 1)]
  assert.deepEqual(added(withUntrackedSessions([row('/work/rumble-banana')], terminals, NOW)), [])
})

test('a session Orca already lists is left to Orca', () => {
  const rows = [row('/work/rumble-banana', [{ paneKey: 'p1', state: 'waiting' }])]
  const result = withUntrackedSessions(rows, [terminal('p1', '✳ Fix checkout rounding', 1)], NOW)
  assert.equal(result, rows)
})

test('the agent goes to the row of its own workspace, and nowhere when there is none', () => {
  const rows = [row('/work/rumble-banana'), row('/work/cosmic-llama')]
  const terminals = [terminal('p1', '✳ Onboarding v2', 1, '/work/cosmic-llama'), terminal('p2', '✳ Lost', 1, '/work/gone')]
  const result = withUntrackedSessions(rows, terminals, NOW)
  assert.deepEqual(result.map((item) => item.agents.length), [0, 1])
})

test('a symbol must be followed by a space, so a title that merely starts with one is not an agent', () => {
  const terminals = [terminal('p1', '·~/work', 1), terminal('p2', '✳', 1), terminal('p3', '✳   ', 1)]
  assert.deepEqual(added(withUntrackedSessions([row('/work/rumble-banana')], terminals, NOW)), [])
})

test('a title set by any program is cleaned and cut before it becomes a name', () => {
  const title = `✳ Fix\u202E ${'x'.repeat(5000)}`
  const rows = withUntrackedSessions([row('/work/rumble-banana')], [terminal('p1', title, 1)], NOW)
  const [[, , name]] = added(rows)
  assert.ok([...name].length <= 80)
  assert.ok(!name.includes('\u202E'))
})
