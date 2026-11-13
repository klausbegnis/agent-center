import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chanceOf, hashOf } from './hash.mjs'

test('the same text always gives the same number, and different text another', () => {
  assert.equal(hashOf('wave-12'), hashOf('wave-12'))
  assert.notEqual(hashOf('wave-12'), hashOf('wave-13'))
})

test('a chance is between zero and one', () => {
  for (const text of ['a', 'b', 'rumble-banana|7', '']) {
    const chance = chanceOf(text)
    assert.ok(chance >= 0 && chance < 1)
  }
})
