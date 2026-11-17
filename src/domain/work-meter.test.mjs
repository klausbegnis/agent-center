import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  countToolCall,
  createWorkMeter,
  mergeWorkMeters,
  noteToolSignal,
  readWorkMeter,
  settleWorkMeter
} from './work-meter.mjs'

test('working time is added to the activity the agent had while it passed', () => {
  const meter = createWorkMeter(0)
  settleWorkMeter(meter, { state: 'working', activity: 'read' }, 30_000)
  settleWorkMeter(meter, { state: 'working', activity: 'write' }, 45_000)
  assert.deepEqual(readWorkMeter(meter).workedMs, { read: 30_000, write: 15_000 })
})

test('time spent waiting, blocked or done is not working time', () => {
  const meter = createWorkMeter(0)
  settleWorkMeter(meter, { state: 'waiting', activity: 'think' }, 10_000)
  settleWorkMeter(meter, { state: 'blocked', activity: 'think' }, 20_000)
  settleWorkMeter(meter, { state: 'done', activity: 'think' }, 30_000)
  settleWorkMeter(meter, { state: 'working', activity: 'think' }, 35_000)
  assert.deepEqual(readWorkMeter(meter).workedMs, { think: 5_000 })
})

test('a clock that goes back adds no time', () => {
  const meter = createWorkMeter(10_000)
  settleWorkMeter(meter, { state: 'working', activity: 'run' }, 5_000)
  settleWorkMeter(meter, { state: 'working', activity: 'run' }, 12_000)
  assert.deepEqual(readWorkMeter(meter).workedMs, { run: 2_000 })
})

test('tool calls are counted one by one', () => {
  const meter = createWorkMeter(0)
  countToolCall(meter)
  countToolCall(meter)
  assert.equal(readWorkMeter(meter).toolCalls, 2)
})

test('two meters of the same agent add up and keep the earlier start', () => {
  const into = createWorkMeter(5_000)
  settleWorkMeter(into, { state: 'working', activity: 'write' }, 6_000)
  const from = createWorkMeter(1_000)
  settleWorkMeter(from, { state: 'working', activity: 'write' }, 3_000)
  countToolCall(from)
  mergeWorkMeters(into, from)
  const { startedAt, workedMs, toolCalls } = readWorkMeter(into)
  assert.deepEqual({ startedAt, workedMs, toolCalls }, { startedAt: 1_000, workedMs: { write: 3_000 }, toolCalls: 1 })
})

test('a reading is a copy that later counting does not change', () => {
  const meter = createWorkMeter(0)
  const reading = readWorkMeter(meter)
  settleWorkMeter(meter, { state: 'working', activity: 'think' }, 1_000)
  assert.deepEqual(reading.workedMs, {})
})

const MINUTE = 60_000
const sumOf = (record) => Object.values(record).reduce((sum, value) => sum + value, 0)

test('working time with no tool signal is unknown, not thinking', () => {
  const meter = createWorkMeter(0)
  settleWorkMeter(meter, { state: 'working', activity: 'think' }, 5 * MINUTE)
  assert.deepEqual(readWorkMeter(meter).attributedMs, { unknown: 5 * MINUTE })
  assert.deepEqual(readWorkMeter(meter).workedMs, { think: 5 * MINUTE })
})

test('time after tool calls follows them, with a quarter for thinking', () => {
  const meter = createWorkMeter(0)
  countToolCall(meter, 'write', 0)
  settleWorkMeter(meter, { state: 'working', activity: 'write' }, 4 * MINUTE)
  const { attributedMs, callsBy } = readWorkMeter(meter)
  assert.deepEqual(attributedMs, { write: 3 * MINUTE, think: MINUTE })
  assert.deepEqual(callsBy, { write: 1 })
})

test('a long gap after the last tool becomes unknown once the signal is stale', () => {
  const meter = createWorkMeter(0)
  countToolCall(meter, 'run', 0)
  settleWorkMeter(meter, { state: 'working', activity: 'run' }, 25 * MINUTE)
  const { attributedMs } = readWorkMeter(meter)
  assert.equal(attributedMs.unknown, 15 * MINUTE)
  assert.equal(attributedMs.run + attributedMs.think, 10 * MINUTE)
})

test('while subagents work, half of the time counts as delegating', () => {
  const meter = createWorkMeter(0)
  settleWorkMeter(meter, { state: 'working', activity: 'delegate', hasSubagents: true }, 10 * MINUTE)
  assert.deepEqual(readWorkMeter(meter).attributedMs, { delegate: 5 * MINUTE, unknown: 5 * MINUTE })
})

test('a snapshot that names a tool is a signal but not a call', () => {
  const meter = createWorkMeter(0)
  noteToolSignal(meter, 'read', 0)
  settleWorkMeter(meter, { state: 'working', activity: 'think' }, 4 * MINUTE)
  const reading = readWorkMeter(meter)
  assert.equal(reading.toolCalls, 0)
  assert.deepEqual(reading.attributedMs, { read: 3 * MINUTE, think: MINUTE })
})

test('the shared time always adds up to the working time', () => {
  const meter = createWorkMeter(0)
  countToolCall(meter, 'read', 0)
  settleWorkMeter(meter, { state: 'working', activity: 'read' }, 3 * MINUTE)
  countToolCall(meter, 'delegate', 3 * MINUTE)
  settleWorkMeter(meter, { state: 'working', activity: 'delegate', hasSubagents: true }, 30 * MINUTE)
  settleWorkMeter(meter, { state: 'waiting', activity: 'think' }, 40 * MINUTE)
  const reading = readWorkMeter(meter)
  assert.ok(Math.abs(sumOf(reading.attributedMs) - sumOf(reading.workedMs)) < 1e-6)
})
