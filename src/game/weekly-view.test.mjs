import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import { weekOfKey } from './weekly-calendar.mjs'
import { weeklyView } from './weekly-view.mjs'
import { emptySave } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('monsters.json'),
  items: readJson('items.json'),
  bestiary: readJson('bestiary.json'),
  bosses: readJson('bosses.json'),
  cities: readJson('cities.json'),
  events: readJson('events.json')
}
const WEDNESDAY = Date.parse('2026-11-18T12:00:00Z')
const world = (weekly) => ({ skills: {}, materials: {}, upgrades: {}, projects: {}, weekly })
const weekly = (event, extra = {}) => ({ week: '2026-W47', event, progress: 5, done: false, seenAt: WEDNESDAY, ...extra })
const goalOf = (eventId) => content.events.events.find((event) => event.id === eventId).goal

test('a world\'s view has its event, what it does, its goal, the time left and next week\'s event', () => {
  const view = weeklyView(world(weekly('howling-moon')), content)
  assert.equal(view.name, 'The Howling Moon')
  assert.equal(view.raceName, 'Werewolves')
  assert.deepEqual(view.goal, { ...goalOf('howling-moon'), progress: 5, done: false })
  assert.equal(view.msLeft, weekOfKey('2026-W47').endsAt - WEDNESDAY)
  assert.ok(view.effects.length > 0)
  assert.ok(Object.values(view.reward).every((amount) => amount > 0))
  assert.equal(view.next.week, '2026-W48')
  assert.notEqual(view.next.id, view.id)
})

test('a festival names its city', () => {
  assert.equal(weeklyView(world(weekly('harvest-fair')), content).cityName, 'Goldmill')
})

test('no view before the first advance, for an event the content lost, or without weekly events', () => {
  assert.equal(weeklyView(world(undefined), content), null)
  assert.equal(weeklyView(world(weekly('no-such-event')), content), null)
  const { events: _events, ...without } = content
  assert.equal(weeklyView(world(weekly('howling-moon')), without), null)
})

test('the engine\'s view carries each world\'s week', () => {
  const engine = createEngine({ content })
  let save = engine.applyTokens(emptySave(), {
    projectId: 'local:/work/rumble-banana', sessionId: 'first', tokens: 1_000_000, activity: 'write', now: WEDNESDAY
  })
  assert.equal(engine.view(save).worlds[0].weekly, null)
  save = engine.advance(save, { from: WEDNESDAY, to: WEDNESDAY + 60_000, sessions: [] })
  assert.equal(engine.view(save).worlds[0].weekly.week, '2026-W47')
})
