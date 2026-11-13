import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ESTIMATED_ABSENCE_MS,
  estimatedSessionId,
  estimatedSessions,
  estimatedToClose,
  isEstimatedSessionId,
  readMeterDeltas
} from './game-estimate.mjs'

const BANANA = 'local:/work/rumble-banana'
const MINUTE = 60_000

const meter = (startedAt, workedMs = {}, toolCalls = 0) => ({ startedAt, workedMs, toolCalls })

function agent(id, extra = {}) {
  return { id, roomId: BANANA, workspaceId: 'w-banana', title: null, state: 'working', activity: 'write', isLocal: true, ...extra }
}

test('an agent id becomes a game session id that is recognised as estimated', () => {
  assert.equal(estimatedSessionId('pane-1'), 'estimated:pane-1')
  assert.equal(isEstimatedSessionId('estimated:pane-1'), true)
  assert.equal(isEstimatedSessionId('a1b2c3'), false)
})

test('a meter seen for the first time earns nothing when the game just started watching', () => {
  const read = readMeterDeltas({}, { 'pane-1': meter(0, { write: 10 * MINUTE }, 40) }, { now: 20 * MINUTE, watchedUntil: null })
  assert.deepEqual(read.deltas, [])
  assert.equal(read.baselines['pane-1'].toolCalls, 40)
})

test('a meter that started after the last reading earns everything it counted', () => {
  const meters = { 'pane-1': meter(5 * MINUTE, { write: MINUTE }, 3) }
  const read = readMeterDeltas({}, meters, { now: 6 * MINUTE, watchedUntil: 4 * MINUTE })
  assert.deepEqual(read.deltas, [{ agentId: 'pane-1', workedMs: { write: MINUTE }, toolCalls: 3, minutes: 1, since: 5 * MINUTE }])
})

test('a known meter earns what it counted since its baseline', () => {
  const first = readMeterDeltas({}, { 'pane-1': meter(0, { read: MINUTE }, 2) }, { now: MINUTE, watchedUntil: null })
  const meters = { 'pane-1': meter(0, { read: MINUTE, write: 30_000 }, 5) }
  const second = readMeterDeltas(first.baselines, meters, { now: 2 * MINUTE, watchedUntil: MINUTE })
  assert.deepEqual(second.deltas, [{ agentId: 'pane-1', workedMs: { write: 30_000 }, toolCalls: 3, minutes: 1, since: MINUTE }])
})

test('an agent that did nothing since the last reading has no delta', () => {
  const first = readMeterDeltas({}, { 'pane-1': meter(0, { read: MINUTE }, 2) }, { now: MINUTE, watchedUntil: null })
  const second = readMeterDeltas(first.baselines, { 'pane-1': meter(0, { read: MINUTE }, 2) }, { now: 2 * MINUTE, watchedUntil: MINUTE })
  assert.deepEqual(second.deltas, [])
})

test('a meter that went back earns nothing and moves the baseline', () => {
  const baselines = { 'pane-1': { ...meter(0, { read: 5 * MINUTE }, 9), at: MINUTE } }
  const read = readMeterDeltas(baselines, { 'pane-1': meter(0, { read: MINUTE }, 9) }, { now: 2 * MINUTE, watchedUntil: MINUTE })
  assert.deepEqual(read.deltas, [])
  assert.equal(read.resets, 1)
  assert.equal(read.baselines['pane-1'].workedMs.read, MINUTE)
})

test('a new meter under the same agent id counts from its own start, not from the old baseline', () => {
  const baselines = { 'pane-1': { ...meter(0, { read: 50 * MINUTE }, 90), at: 60 * MINUTE } }
  const meters = { 'pane-1': meter(61 * MINUTE, { think: MINUTE }, 1) }
  const read = readMeterDeltas(baselines, meters, { now: 62 * MINUTE, watchedUntil: 60 * MINUTE })
  assert.deepEqual(read.deltas.map((delta) => [delta.workedMs, delta.toolCalls]), [[{ think: MINUTE }, 1]])
})

test('baselines are kept only for the agents read now', () => {
  const baselines = { gone: { ...meter(0), at: 0 } }
  const read = readMeterDeltas(baselines, { 'pane-1': meter(0) }, { now: MINUTE, watchedUntil: null })
  assert.deepEqual(Object.keys(read.baselines), ['pane-1'])
})

test('each local agent with a meter becomes one running session in its room', () => {
  const agents = [agent('pane-1', { title: 'Fix checkout rounding' }), agent('pane-2', { isLocal: false }), agent('pane-3')]
  const { sessions, places, agentOf, how } = estimatedSessions(agents, { 'pane-1': meter(7), 'pane-2': meter(7) })
  assert.deepEqual(sessions, [{
    sessionId: 'estimated:pane-1',
    title: 'Fix checkout rounding',
    workspaceId: 'w-banana',
    totalTokens: 0,
    createdAt: 7,
    running: true
  }])
  assert.deepEqual(places.get('estimated:pane-1'), { workspaceId: 'w-banana', roomId: BANANA })
  assert.equal(agentOf.get('estimated:pane-1'), 'pane-1')
  assert.equal(how.get('estimated:pane-1'), 'agent')
})

test('a character whose agent left the room retires once it has been missing long enough', () => {
  const characters = [{ projectId: BANANA, sessionId: 'estimated:pane-1' }]
  const first = estimatedToClose({ characters, present: new Set(), missingSince: new Map(), now: 0 })
  assert.deepEqual(first.closing, [])
  const early = estimatedToClose({ characters, present: new Set(), missingSince: first.missingSince, now: ESTIMATED_ABSENCE_MS - 1 })
  assert.deepEqual(early.closing, [])
  const late = estimatedToClose({ characters, present: new Set(), missingSince: early.missingSince, now: ESTIMATED_ABSENCE_MS })
  assert.deepEqual(late.closing, [{ projectId: BANANA, sessionId: 'estimated:pane-1', title: null }])
})

test('a character whose agent came back before the limit is not retired', () => {
  const characters = [{ projectId: BANANA, sessionId: 'estimated:pane-1' }]
  const missed = estimatedToClose({ characters, present: new Set(), missingSince: new Map(), now: 0 })
  const back = estimatedToClose({ characters, present: new Set(['estimated:pane-1']), missingSince: missed.missingSince, now: 10 })
  const later = estimatedToClose({ characters, present: new Set(), missingSince: back.missingSince, now: ESTIMATED_ABSENCE_MS })
  assert.deepEqual(later.closing, [])
})

test('a character from real session totals retires at once while the game estimates', () => {
  const characters = [{ projectId: BANANA, sessionId: 'a1b2c3' }]
  const { closing } = estimatedToClose({ characters, present: new Set(), missingSince: new Map(), now: 0 })
  assert.deepEqual(closing, [{ projectId: BANANA, sessionId: 'a1b2c3', title: null }])
})
