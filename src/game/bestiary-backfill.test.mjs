import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { backfillSave, backfillWorld, spreadKills } from './bestiary-backfill.mjs'
import { indexBestiary } from './bestiary-content.mjs'
import { killsOf } from './bestiary.mjs'
import { createEngine } from './engine.mjs'
import { emptyProject, emptySave } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('monsters.json'),
  items: readJson('items.json'),
  races: readJson('races.json'),
  bosses: readJson('bosses.json'),
  legendary: readJson('legendary.json'),
  bestiary: readJson('bestiary.json')
}
const index = indexBestiary(content.bestiary, content.bosses)
const DAY = 20_400

/** A world whose two rooms killed `kills` monsters between them, with a bestiary or none. */
const world = (kills, bestiary) => ({
  skills: {}, materials: {}, upgrades: {},
  projects: { a: { ...emptyProject(), kills: Math.ceil(kills / 2) }, b: { ...emptyProject(), kills: Math.floor(kills / 2) } },
  ...(bestiary ? { bestiary } : {})
})
const counted = (bestiary) => Object.values(bestiary.races).reduce((sum, counter) => sum + killsOf(counter), 0) +
  killsOf(bestiary.others)

test('the kills a world\'s rooms counted before its bestiary are given to its races as plain kills', () => {
  const filled = backfillWorld(world(191), 'main', { index, day: DAY }).bestiary
  assert.equal(filled.filled, 191)
  assert.equal(counted(filled), 191)
  for (const counter of Object.values(filled.races)) {
    assert.deepEqual(counter.slice(1, 6), [0, 0, 0, 0, 0])
    assert.equal(counter[6], DAY)
  }
  assert.deepEqual(filled.bosses, {})
})

test('only the kills the bestiary misses are given, beside what it counted', () => {
  const start = { races: { goblin: [6, 0, 1, 0, 0, 0, DAY - 1] }, bosses: { skrix: [1, 0, DAY - 1] }, others: [2, 0, 0, 0, 0, 0, DAY - 1] }
  const filled = backfillWorld(world(260, start), 'main', { index, day: DAY }).bestiary
  assert.equal(filled.filled, 260 - 9)
  assert.equal(counted(filled), 260)
  assert.equal(filled.races.goblin[6], DAY - 1)
  assert.deepEqual(filled.bosses, start.bosses)
  assert.deepEqual(filled.others, start.others)
})

test('the back-fill runs once: its mark stops it, whatever the rooms count later', () => {
  const once = backfillWorld(world(50), 'main', { index, day: DAY })
  const later = { ...once, projects: { ...once.projects, a: { ...once.projects.a, kills: 900 } } }
  assert.equal(backfillWorld(later, 'main', { index, day: DAY + 3 }), later)
})

test('a world with nothing missing is only marked, and a game without a bestiary is left alone', () => {
  assert.deepEqual(backfillWorld(world(0), 'main', { index, day: DAY }).bestiary, { races: {}, bosses: {}, filled: 0 })
  const save = { ...emptySave(), worlds: { main: world(40) } }
  assert.equal(backfillSave(save, { index: null, day: DAY }), save)
})

test('the spread is a hash of the world and each race: the same every time, every kill given', () => {
  const first = spreadKills(1000, index.raceIds, 'main')
  assert.deepEqual(first, spreadKills(1000, index.raceIds, 'main'))
  assert.notDeepEqual(first, spreadKills(1000, index.raceIds, 'side-quests'))
  assert.equal([...first.values()].reduce((sum, kills) => sum + kills, 0), 1000)
  assert.ok([...first.values()].every((kills) => kills >= 25 && kills <= 100))
  assert.equal([...spreadKills(7, index.raceIds, 'main').values()].reduce((sum, kills) => sum + kills, 0), 7)
})

test('an old save is back-filled by its first advance, quietly, and passes the save check', () => {
  const engine = createEngine({ content })
  let save = engine.applyTokens(emptySave(), { projectId: 'a', sessionId: 's', tokens: 1_000_000, activity: 'write', now: 0 })
  save = { ...save, worlds: { main: { ...save.worlds.main, projects: { a: { ...save.worlds.main.projects.a, kills: 191 } } } } }
  const moved = engine.advanceWithEvents(save, { from: 0, to: 60_000, sessions: [] })
  assert.equal(moved.save.worlds.main.bestiary.filled, 191)
  assert.equal(counted(moved.save.worlds.main.bestiary), 191)
  assert.deepEqual(moved.events, [])
  assert.equal(engine.cleanSave(moved.save).ok, true)
  const again = engine.advanceWithEvents(moved.save, { from: 60_000, to: 120_000, sessions: [] })
  assert.deepEqual(again.save.worlds.main.bestiary, moved.save.worlds.main.bestiary)
})

test('the save check refuses a back-fill mark that is not a whole count', () => {
  const engine = createEngine({ content })
  const save = { ...emptySave(), worlds: { main: { ...world(10), coins: 0, lastTokenAt: null, bestiary: { races: {}, bosses: {}, filled: 1.5 } } } }
  assert.match(engine.cleanSave(save).problem, /bestiary.filled is not a whole count/)
})
