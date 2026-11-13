import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GATHER_PER_HOUR, GATHER_SKILL_BONUS, GATHER_STOPS_AFTER_HOURS } from './constants.mjs'
import { activeHours, gather, gatherRate } from './gathering.mjs'

const HOUR = 3_600_000

test('a level 0 trade with no bonus gathers the base rate', () => {
  assert.equal(gatherRate({ tradeLevel: 0 }), GATHER_PER_HOUR)
})

test('trade level, tool, seasoning and retirees all multiply the rate', () => {
  const rate = gatherRate({ tradeLevel: 10, toolFactor: 2, seasoning: 0.75, retireeBonus: 0.1 })
  const expected = GATHER_PER_HOUR * (1 + GATHER_SKILL_BONUS * 10) * 2 * 0.75 * 1.1
  assert.ok(Math.abs(rate - expected) < 1e-9)
})

test('the whole interval counts while the last tokens are recent', () => {
  assert.equal(activeHours({ from: 0, to: 2 * HOUR, lastTokenAt: 0 }), 2)
})

test('gathering stops a fixed number of hours after the last tokens', () => {
  const hours = activeHours({ from: 0, to: 24 * HOUR, lastTokenAt: HOUR })
  assert.equal(hours, 1 + GATHER_STOPS_AFTER_HOURS)
})

test('an interval that starts after gathering stopped gathers nothing', () => {
  const from = (GATHER_STOPS_AFTER_HOURS + 1) * HOUR
  assert.equal(activeHours({ from, to: from + HOUR, lastTokenAt: 0 }), 0)
})

test('a world that never received tokens never gathers', () => {
  assert.equal(activeHours({ from: 0, to: HOUR, lastTokenAt: null }), 0)
})

test('gathering hands out whole units and carries the fraction', () => {
  assert.deepEqual(gather({ ratePerHour: 10, hours: 0.25 }), { units: 2, carry: 0.5 })
})

test('many short gathers add up to one long one, so no fraction is lost', () => {
  let carry = 0
  let units = 0
  for (let minute = 0; minute < 60; minute++) {
    const result = gather({ ratePerHour: 23.7, hours: 1 / 60, carry })
    units += result.units
    carry = result.carry
  }
  assert.equal(units, 23)
  assert.ok(Math.abs(carry - 0.7) < 1e-6)
})

test('a fraction that floating point leaves a hair under one still makes a unit', () => {
  let carry = 0
  let units = 0
  for (let step = 0; step < 10; step++) {
    const result = gather({ ratePerHour: 1, hours: 0.1, carry })
    units += result.units
    carry = result.carry
  }
  assert.equal(units, 1)
})
