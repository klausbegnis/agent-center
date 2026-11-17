import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ladderLevel, ladderPlace, pointsForLevel } from './bestiary-ladder.mjs'

const ladder = { firstCost: 2, growth: 1.31 }

test('the first level is cheap and each one costs more than the one before', () => {
  assert.equal(pointsForLevel(ladder, 0), 0)
  assert.equal(pointsForLevel(ladder, 1), 2)
  let step = 0
  for (let n = 1; n <= 40; n++) {
    const cost = pointsForLevel(ladder, n) - pointsForLevel(ladder, n - 1)
    assert.ok(cost >= step, `level ${n}`)
    step = cost
  }
})

test('a ladder never ends: levels go on past any count', () => {
  assert.ok(ladderLevel(ladder, 1e9) > 50)
})

test('the place on a ladder gives the points the level began at and the next one needs', () => {
  assert.deepEqual(ladderPlace(ladder, 0), { level: 0, from: 0, to: 2 })
  assert.deepEqual(ladderPlace(ladder, 2), { level: 1, from: 2, to: 5 })
  assert.deepEqual(ladderPlace(ladder, 7), { level: 2, from: 5, to: 8 })
})

test('a scaled ladder needs more points at every level', () => {
  const scaled = { ...ladder, scale: 1.5 }
  for (const n of [1, 5, 25]) assert.ok(pointsForLevel(scaled, n) > pointsForLevel(ladder, n))
})
