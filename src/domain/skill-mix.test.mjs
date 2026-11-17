import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_WORK_MIX,
  MIX_FLOOR,
  MIN_OBSERVED_CALLS,
  OBSERVED_CALLS_KEPT,
  THINK_SHARE,
  WORK_ACTIVITIES,
  blendRecentMix,
  foldObservedCalls,
  foldWorkTime,
  splitSourceOf,
  timeMixOfTools,
  worldWorkMix
} from './skill-mix.mjs'

const sumOf = (mix) => Object.values(mix).reduce((sum, value) => sum + value, 0)
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`)

test('the default mix covers the five activities and adds up to one', () => {
  assert.deepEqual(Object.keys(DEFAULT_WORK_MIX).sort(), [...WORK_ACTIVITIES].sort())
  near(sumOf(DEFAULT_WORK_MIX), 1)
})

test('with nothing observed yet the world follows the default mix', () => {
  assert.deepEqual(worldWorkMix(undefined), { mix: { ...DEFAULT_WORK_MIX }, source: 'default' })
  assert.equal(worldWorkMix({ read: MIN_OBSERVED_CALLS - 1 }).source, 'default')
})

test('an observed mix gives thinking its share and every activity at least the floor', () => {
  const { mix, source } = worldWorkMix({ read: 60, run: 30, write: 10 })
  assert.equal(source, 'observed')
  near(sumOf(mix), 1)
  for (const activity of WORK_ACTIVITIES) assert.ok(mix[activity] >= MIX_FLOOR * 0.9, activity)
  assert.ok(mix.read > mix.run && mix.run > mix.write)
  assert.ok(mix.think >= THINK_SHARE * 0.9)
})

test('the time between tool calls goes a quarter to thinking and the rest by the tools', () => {
  const mix = timeMixOfTools({ write: 1 })
  near(mix.think, THINK_SHARE)
  near(mix.write, 1 - THINK_SHARE)
})

test('the recent mix leans towards the latest calls', () => {
  let recent = blendRecentMix(null, 'read')
  assert.equal(recent.read, 1)
  for (let call = 0; call < 6; call += 1) recent = blendRecentMix(recent, 'write')
  assert.ok(recent.write > 0.8 && recent.read < 0.2)
  near(sumOf(recent), 1)
})

test('a tool of no work activity counts as thinking in the recent mix', () => {
  assert.equal(blendRecentMix(null, 'wait').think, 1)
})

test('observed calls are kept to the latest few hundred, in proportion', () => {
  const folded = foldObservedCalls({ read: OBSERVED_CALLS_KEPT }, { write: OBSERVED_CALLS_KEPT })
  near(sumOf(folded), OBSERVED_CALLS_KEPT)
  near(folded.read, folded.write)
})

test('the split is said to come from tools only when they explain nearly all the time', () => {
  assert.equal(splitSourceOf(undefined), 'none')
  assert.equal(splitSourceOf({ trackedMs: 100, unknownMs: 1 }), 'tools')
  assert.equal(splitSourceOf({ trackedMs: 50, unknownMs: 50 }), 'mixed')
  assert.equal(splitSourceOf({ trackedMs: 0, unknownMs: 50 }), 'mix')
})

test('older rounds fade from the work time a world remembers', () => {
  const once = foldWorkTime(undefined, { trackedMs: 100, unknownMs: 0 })
  const later = foldWorkTime(once, { trackedMs: 0, unknownMs: 100 })
  assert.ok(later.trackedMs < 100 && later.unknownMs === 100)
})
