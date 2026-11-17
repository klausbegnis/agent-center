import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ESTIMATE_ACTIVITY_WEIGHTS,
  ESTIMATE_TOKENS_PER_WORKING_MINUTE,
  ESTIMATE_TOOL_CALLS_PER_MINUTE
} from './constants.mjs'
import { estimateTokens, estimateTokensFromTime, estimateWeights, splitTokens } from './estimate.mjs'

const MINUTE = 60_000

test('a minute of thinking at the reference pace of tool calls is the simulator working minute', () => {
  const minutes = 4
  const tokens = estimateTokens({
    workedMs: { think: minutes * MINUTE },
    toolCalls: ESTIMATE_TOOL_CALLS_PER_MINUTE * minutes,
    minutes
  })
  assert.equal(tokens, ESTIMATE_TOKENS_PER_WORKING_MINUTE * minutes)
})

test('writing spends more per minute than reading, and running a command less', () => {
  const minuteOf = (activity) => estimateTokens({ workedMs: { [activity]: MINUTE }, toolCalls: 0, minutes: 1 })
  assert.ok(minuteOf('write') > minuteOf('think'))
  assert.ok(minuteOf('think') > minuteOf('read'))
  assert.ok(minuteOf('read') > minuteOf('run'))
})

test('an activity the estimate does not know counts as thinking', () => {
  const think = estimateTokens({ workedMs: { think: MINUTE }, toolCalls: 0, minutes: 1 })
  assert.equal(estimateTokens({ workedMs: { juggle: MINUTE }, toolCalls: 0, minutes: 1 }), think)
})

test('an agent that only waited earns nothing', () => {
  assert.equal(estimateTokens({ workedMs: {}, toolCalls: 0, minutes: 10 }), 0)
})

test('a flood of tool calls is counted only up to the limit per minute', () => {
  const burst = estimateTokens({ workedMs: {}, toolCalls: 15, minutes: 0.5 })
  const flood = estimateTokens({ workedMs: {}, toolCalls: 5_000, minutes: 0.5 })
  assert.equal(flood, burst)
  assert.ok(burst > 0)
})

test('malformed numbers earn nothing instead of breaking the estimate', () => {
  assert.equal(estimateTokens({ workedMs: { think: -5, write: Number.NaN }, toolCalls: Infinity, minutes: -1 }), 0)
})

test('the activity weights keep the simulator mixes close to the reference working minute', () => {
  const mixes = [
    { write: 0.45, read: 0.2, run: 0.2, think: 0.1, delegate: 0.05 },
    { read: 0.4, think: 0.3, write: 0.1, run: 0.15, delegate: 0.05 },
    { delegate: 0.3, think: 0.2, read: 0.2, write: 0.2, run: 0.1 }
  ]
  for (const mix of mixes) {
    const average = Object.entries(mix).reduce((sum, [activity, share]) => sum + share * ESTIMATE_ACTIVITY_WEIGHTS[activity], 0)
    assert.ok(average > 0.9 && average < 1.05, `${average}`)
  }
})

test('an agent whose calls cannot be counted is paid a whole working minute per minute of work', () => {
  assert.equal(estimateTokensFromTime({ workedMs: { think: 2 * MINUTE } }), 2 * ESTIMATE_TOKENS_PER_WORKING_MINUTE)
  const writing = estimateTokensFromTime({ workedMs: { write: MINUTE } })
  assert.equal(writing, Math.round(ESTIMATE_ACTIVITY_WEIGHTS.write * ESTIMATE_TOKENS_PER_WORKING_MINUTE))
  assert.equal(estimateTokensFromTime({ workedMs: {} }), 0)
})

const EVEN = { write: 0.2, read: 0.2, run: 0.2, think: 0.2, delegate: 0.2 }

test('a split always adds up to the tokens it shares', () => {
  for (const tokens of [1, 7, 25_000, 123_457]) {
    const parts = splitTokens(tokens, { write: 1, read: 1, run: 1 }, 'think')
    assert.equal(Object.values(parts).reduce((sum, part) => sum + part, 0), tokens)
  }
})

test('a split with no weight goes to the fallback', () => {
  assert.deepEqual(splitTokens(500, { write: 0 }, 'think'), { think: 500 })
  assert.deepEqual(splitTokens(0, { write: 1 }, 'think'), {})
})

test('the weights put each tool call on its own activity and the time on the shared time', () => {
  const weights = estimateWeights(
    { attributedMs: { read: MINUTE }, callsBy: { write: 2 }, toolCalls: 2, minutes: 1 }, { unknownMix: EVEN })
  assert.ok(weights.write > 0 && weights.read > 0)
  assert.equal(weights.run, 0)
})

test('time no tool explains is spread by the mix it is given', () => {
  const weights = estimateWeights({ attributedMs: { unknown: MINUTE }, minutes: 1 }, { unknownMix: { read: 1, write: 0 } })
  assert.equal(weights.write, 0)
  assert.ok(weights.read > 0)
})

test('an agent whose calls are not counted is split by its time alone', () => {
  const weights = estimateWeights(
    { attributedMs: { run: MINUTE }, callsBy: { write: 5 }, toolCalls: 5, minutes: 1 },
    { unknownMix: EVEN, fromTimeOnly: true })
  assert.equal(weights.write, 0)
  assert.equal(weights.run, ESTIMATE_TOKENS_PER_WORKING_MINUTE)
})
