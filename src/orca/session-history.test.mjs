import assert from 'node:assert/strict'
import { test } from 'node:test'
import { historyAccess, normalizeSessions, readListedWorkspaces, readSessionHistory } from './session-history.mjs'

const row = (extra = {}) => ({
  sessionId: 'session-1',
  agent: 'claude',
  title: 'Fix checkout rounding',
  workspaceId: 'w-1',
  hostId: 'local',
  branch: 'checkout-rounding',
  createdAt: 100,
  updatedAt: 200,
  messageCount: 12,
  totalTokens: 50_000,
  running: true,
  ...extra
})

test('a history answer keeps only the fields the game uses', () => {
  const { sessions, truncated } = normalizeSessions({ sessions: [row()], truncated: true })
  assert.deepEqual(sessions, [{
    sessionId: 'session-1', title: 'Fix checkout rounding', workspaceId: 'w-1', totalTokens: 50_000, createdAt: 100, running: true
  }])
  assert.equal(truncated, true)
})

test('rows without a session id or a token total are left out, and duplicates are read once', () => {
  const answer = { sessions: [row({ sessionId: '' }), row({ totalTokens: -5 }), row({ totalTokens: 'many' }), row(), row()] }
  assert.equal(normalizeSessions(answer).sessions.length, 1)
})

test('a title is cleaned like any label and a missing workspace is null', () => {
  const [session] = normalizeSessions({ sessions: [row({ title: 'Fix‮ checkout\n', workspaceId: null })] }).sessions
  assert.equal(session.title, 'Fix checkout')
  assert.equal(session.workspaceId, null)
})

test('an answer that is not a list gives no sessions', () => {
  assert.deepEqual(normalizeSessions(null), { sessions: [], truncated: false })
})

test('the history is offered when this Orca has the method and the person granted it', () => {
  const orca = (has, granted) => ({ host: { has: () => has }, grantedCapabilities: granted })
  assert.deepEqual(historyAccess(orca(true, ['history:read'])), { supported: true, granted: true })
  assert.deepEqual(historyAccess(orca(true, ['storage:own'])), { supported: true, granted: false })
  assert.deepEqual(historyAccess(orca(false, ['history:read'])), { supported: false, granted: true })
  assert.deepEqual(historyAccess({ host: {} }), { supported: false, granted: false })
})

test('an Orca that does not say what was granted is taken as not granting the history', () => {
  const orca = { host: { has: () => true } }
  assert.deepEqual(historyAccess(orca), { supported: true, granted: false })
  assert.deepEqual(historyAccess({ ...orca, grantedCapabilities: 'history:read' }), { supported: true, granted: false })
})

test('a refused history read says whether it was refused for lack of permission', async () => {
  const failing = (code) => ({ host: { call: async () => { throw Object.assign(new Error('no'), { code }) } } })
  assert.equal((await readSessionHistory(failing('capability_denied'))).denied, true)
  assert.equal((await readSessionHistory(failing('unavailable'))).denied, false)
})

test('the workspace list keeps id, folder and host, and is empty when it cannot be read', async () => {
  const workspaces = [{ id: 'w-1', path: '/work/rumble-banana', hostId: 'local', name: 'main' }, { id: 'w-2' }]
  const orca = { host: { call: async () => ({ workspaces }) } }
  assert.deepEqual(await readListedWorkspaces(orca), [{ id: 'w-1', path: '/work/rumble-banana', hostId: 'local' }])
  const failing = { host: { call: async () => { throw new Error('down') } } }
  assert.deepEqual(await readListedWorkspaces(failing), [])
})
