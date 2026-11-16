import { test } from 'node:test'
import assert from 'node:assert/strict'
import { retireeName } from './game-names.js'

test('the same number always gives the same name', () => {
  assert.equal(retireeName(92209212), retireeName(92209212))
})

test('a name is two capitalised words', () => {
  assert.match(retireeName(1773045427), /^[A-Z][a-z]+ [A-Z][a-z]+$/)
})

test('neighbouring numbers give different names', () => {
  const names = new Set(Array.from({ length: 64 }, (_, index) => retireeName(1000 + index)))
  assert.equal(names.size, 64)
})

test('a missing or odd number still gives a name', () => {
  assert.equal(retireeName(undefined), retireeName(0))
  assert.equal(retireeName(-7), retireeName(7))
  assert.match(retireeName(2.9), /^[A-Z]/)
})
