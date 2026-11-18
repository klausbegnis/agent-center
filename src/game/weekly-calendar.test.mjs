import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { eventIdOfWeek, weekOf, weekOfIndex, weekOfKey, WEEK_MS } from './weekly-calendar.mjs'

const events = JSON.parse(readFileSync(new URL('../../game/events.json', import.meta.url), 'utf8'))
const ids = events.events.map((event) => event.id)
const at = (text) => Date.parse(`${text}T12:00:00Z`)

test('a moment falls in its ISO week, counted in UTC from Monday', () => {
  assert.equal(weekOf(at('2026-11-18')).key, '2026-W47')
  assert.equal(weekOf(Date.parse('2026-11-16T00:00:00Z')).key, '2026-W47')
  assert.equal(weekOf(Date.parse('2026-11-15T23:59:59Z')).key, '2026-W46')
  const week = weekOf(at('2026-11-18'))
  assert.equal(week.startsAt, Date.parse('2026-11-16T00:00:00Z'))
  assert.equal(week.endsAt - week.startsAt, WEEK_MS)
})

test('the year\'s end follows ISO weeks: 2026 has a week 53 and 2027 begins on the 4th of January', () => {
  assert.equal(weekOf(at('2026-12-31')).key, '2026-W53')
  assert.equal(weekOf(at('2027-01-01')).key, '2026-W53')
  assert.equal(weekOf(at('2027-01-03')).key, '2026-W53')
  assert.equal(weekOf(at('2027-01-04')).key, '2027-W01')
  assert.equal(weekOf(at('2025-12-29')).key, '2026-W01')
  assert.equal(weekOf(at('2027-01-04')).index, weekOf(at('2026-12-31')).index + 1)
})

test('a week key reads back to its week, and a week a year does not have is refused', () => {
  for (const key of ['2026-W01', '2026-W47', '2026-W53', '2027-W01', '2020-W53']) assert.equal(weekOfKey(key)?.key, key)
  assert.equal(weekOfKey('2027-W53'), null)
  assert.equal(weekOfKey('2026-W00'), null)
  assert.equal(weekOfKey('week 47'), null)
  assert.equal(weekOfIndex(weekOfKey('2026-W47').index).key, '2026-W47')
})

test('the event of a week is the same on every call: it comes from the calendar alone', () => {
  const index = weekOf(at('2026-11-18')).index
  assert.equal(eventIdOfWeek(ids, index), eventIdOfWeek([...ids].reverse(), index))
  assert.ok(ids.includes(eventIdOfWeek(ids, index)))
})

test('the same event never comes two weeks in a row, across cycles and the turn of the year', () => {
  const start = weekOf(at('2020-01-01')).index
  for (let index = start; index < start + 52 * 12; index++) {
    assert.notEqual(eventIdOfWeek(ids, index), eventIdOfWeek(ids, index + 1), weekOfIndex(index).key)
  }
  const last = weekOfKey('2026-W53').index
  assert.notEqual(eventIdOfWeek(ids, last), eventIdOfWeek(ids, last + 1))
})

test('each run of as many weeks as there are events plays every event once', () => {
  const cycle = 40
  const seen = new Set()
  for (let index = cycle * ids.length; index < (cycle + 1) * ids.length; index++) seen.add(eventIdOfWeek(ids, index))
  assert.equal(seen.size, ids.length)
})

test('a pinned event is every week\'s, and an empty catalogue has none', () => {
  assert.equal(eventIdOfWeek(ids, 3000, 'clear-skies'), 'clear-skies')
  assert.equal(eventIdOfWeek([], 3000), null)
})
