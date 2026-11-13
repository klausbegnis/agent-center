import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BASELINES_KEPT,
  MAX_CATCH_UP_MS,
  MAX_TOKENS_PER_MINUTE,
  normalizeBaselines,
  readTokenDeltas
} from './game-tokens.mjs'

const MINUTE = 60_000
const session = (sessionId, totalTokens, createdAt = 0) => ({ sessionId, totalTokens, createdAt })

test('a session seen for the first time sets its baseline and earns nothing', () => {
  const read = readTokenDeltas({}, [session('rumble-1', 5_000_000)], { now: 10 * MINUTE, watchedUntil: null })
  assert.deepEqual(read.deltas, [])
  assert.deepEqual(read.baselines, { 'rumble-1': { total: 5_000_000, at: 10 * MINUTE } })
})

test('a session already under way when the game last looked earns nothing on its first reading', () => {
  const clock = { now: 10 * MINUTE, watchedUntil: 9 * MINUTE }
  const read = readTokenDeltas({}, [session('rumble-1', 5_000_000, 2 * MINUTE)], clock)
  assert.deepEqual(read.deltas, [])
})

test('a session that started after the last reading earns everything it spent', () => {
  const clock = { now: 10 * MINUTE, watchedUntil: 9 * MINUTE }
  const read = readTokenDeltas({}, [session('rumble-2', 40_000, 9.5 * MINUTE)], clock)
  assert.deepEqual(read.deltas, [{ sessionId: 'rumble-2', tokens: 40_000, minutes: 0.5 }])
})

test('a known session earns the tokens spent since its baseline', () => {
  const baselines = { 'rumble-1': { total: 100_000, at: 0 } }
  const read = readTokenDeltas(baselines, [session('rumble-1', 130_000)], { now: MINUTE, watchedUntil: 0 })
  assert.deepEqual(read.deltas, [{ sessionId: 'rumble-1', tokens: 30_000, minutes: 1 }])
  assert.deepEqual(read.baselines['rumble-1'], { total: 130_000, at: MINUTE })
})

test('the same total read twice earns nothing the second time', () => {
  const first = readTokenDeltas({ 'rumble-1': { total: 0, at: 0 } }, [session('rumble-1', 50_000)],
    { now: MINUTE, watchedUntil: 0 })
  const second = readTokenDeltas(first.baselines, [session('rumble-1', 50_000)],
    { now: 2 * MINUTE, watchedUntil: MINUTE })
  assert.deepEqual(second.deltas, [])
})

test('a total that goes down resets the baseline without earning anything', () => {
  const baselines = { 'rumble-1': { total: 900_000, at: 0 } }
  const read = readTokenDeltas(baselines, [session('rumble-1', 20_000)], { now: MINUTE, watchedUntil: 0 })
  assert.deepEqual(read.deltas, [])
  assert.equal(read.resets, 1)
  assert.equal(read.baselines['rumble-1'].total, 20_000)
  const after = readTokenDeltas(read.baselines, [session('rumble-1', 25_000)], { now: 2 * MINUTE, watchedUntil: MINUTE })
  assert.equal(after.deltas[0].tokens, 5_000)
})

test('tokens spent while the worker was down are earned after a restart, within a bound', () => {
  const baselines = { 'rumble-1': { total: 0, at: 0 } }
  const twoHours = 120 * MINUTE
  const read = readTokenDeltas(baselines, [session('rumble-1', 3_000_000)], { now: twoHours, watchedUntil: 0 })
  assert.equal(read.deltas[0].tokens, 3_000_000)
  const week = 7 * 24 * 60 * MINUTE
  const huge = readTokenDeltas(baselines, [session('rumble-1', Number.MAX_SAFE_INTEGER)], { now: week, watchedUntil: 0 })
  assert.equal(huge.deltas[0].tokens, (MAX_TOKENS_PER_MINUTE * MAX_CATCH_UP_MS) / MINUTE)
})

test('a jump faster than any agent works is counted only up to the highest rate', () => {
  const baselines = { 'rumble-1': { total: 0, at: 0 } }
  const read = readTokenDeltas(baselines, [session('rumble-1', 50_000_000)], { now: MINUTE, watchedUntil: 0 })
  assert.equal(read.deltas[0].tokens, MAX_TOKENS_PER_MINUTE)
})

test('baselines of sessions no longer read are trimmed to the newest ones', () => {
  const baselines = {}
  for (let index = 0; index < BASELINES_KEPT + 5; index++) baselines[`old-${index}`] = { total: 1, at: index }
  const read = readTokenDeltas(baselines, [session('rumble-1', 10)], { now: 1e9, watchedUntil: 1 })
  assert.equal(Object.keys(read.baselines).length, BASELINES_KEPT)
  assert.ok(read.baselines['rumble-1'])
  assert.equal(read.baselines['old-0'], undefined)
  assert.ok(read.baselines[`old-${BASELINES_KEPT + 4}`])
})

test('stored baselines keep only well-formed entries', () => {
  const stored = { good: { total: 5, at: 1 }, negative: { total: -1, at: 1 }, text: 'nope', missing: {} }
  assert.deepEqual(normalizeBaselines(stored), { good: { total: 5, at: 1 } })
  assert.deepEqual(normalizeBaselines(null), {})
  assert.deepEqual(normalizeBaselines([1, 2]), {})
})
