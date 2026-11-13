import assert from 'node:assert/strict'
import { test } from 'node:test'
import { countToolCall, createWorkMeter, mergeWorkMeters, readWorkMeter, settleWorkMeter } from './work-meter.mjs'

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
  assert.deepEqual(readWorkMeter(into), { startedAt: 1_000, workedMs: { write: 3_000 }, toolCalls: 1 })
})

test('a reading is a copy that later counting does not change', () => {
  const meter = createWorkMeter(0)
  const reading = readWorkMeter(meter)
  settleWorkMeter(meter, { state: 'working', activity: 'think' }, 1_000)
  assert.deepEqual(reading.workedMs, {})
})
