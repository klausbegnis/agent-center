import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampShare, formatAmount, formatFactor, formatShare } from './game-format.js'

test('small amounts are written in full, with a comma from a thousand', () => {
  assert.equal(formatAmount(86), '86')
  assert.equal(formatAmount(1204), '1,204')
  assert.equal(formatAmount(9999), '9,999')
})

test('large amounts are shortened, keeping one decimal only below ten', () => {
  assert.equal(formatAmount(12_345), '12 k')
  assert.equal(formatAmount(2_500_000), '2.5 M')
  assert.equal(formatAmount(29_000_000), '29 M')
  assert.equal(formatAmount(3_000_000_000), '3 B')
})

test('a shortened amount is rounded down, never shown as more than there is', () => {
  assert.equal(formatAmount(1_999_999), '1.9 M')
})

test('an amount that is not a number, or negative, shows as nothing', () => {
  assert.equal(formatAmount(undefined), '0')
  assert.equal(formatAmount(-5), '0')
})

test('shares are percentages, a small one keeping a decimal', () => {
  assert.equal(formatShare(0.12013), '12%')
  assert.equal(formatShare(0.045), '4.5%')
  assert.equal(formatShare(1), '100%')
  assert.equal(formatShare(0), '0%')
})

test('a share is kept between 0 and 1', () => {
  assert.equal(clampShare(1.4), 1)
  assert.equal(clampShare(-0.1), 0)
  assert.equal(clampShare(Number.NaN), 0)
})

test('a factor is written with two decimals', () => {
  assert.equal(formatFactor(1.1146653), '×1.11')
})
