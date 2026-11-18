import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import { JOURNAL_COUNTERS } from './journal.mjs'
import { emptyProject, emptySave, emptyWorld, migrate } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const engine = createEngine({ content: {
  monsters: readJson('monsters.json'),
  items: readJson('items.json'),
  bosses: readJson('bosses.json'),
  races: readJson('races.json'),
  bestiary: readJson('bestiary.json'),
  achievements: readJson('achievements.json')
} })
const ROOM = 'local:/work/rumble-banana'
const AT = 1_800_000_000_000
const row = (fill = 0) => JOURNAL_COUNTERS.map(() => fill)

function saveWith(extra = {}) {
  const save = emptySave()
  save.worlds.main = { ...emptyWorld(), projects: { [ROOM]: { ...emptyProject(), kills: 10_000 } } }
  save.projectWorld[ROOM] = 'main'
  return { ...save, ...extra }
}

const achievements = { earned: { 'monsters-1': AT, 'monsters-4': AT }, titles: { [ROOM]: 'monsters-4' }, filled: 2 }
const journal = { days: [[20_000, ...row(1)]], totals: row(3), since: row(1), seenAt: AT, activeDays: 4,
  highlights: [{ at: AT, kind: 'achievement', ref: 'monsters-4' }] }

test('a save from before achievements loads with neither, and keeps everything it had', () => {
  const old = saveWith()
  const migrated = migrate(JSON.parse(JSON.stringify(old)))
  assert.equal(migrated.achievements, undefined)
  assert.equal(migrated.journal, undefined)
  assert.equal(migrated.worlds.main.projects[ROOM].kills, 10_000)
  assert.equal(engine.cleanSave(old).ok, true)
})

test('migrate keeps sound achievements and journal and drops what is not', () => {
  const migrated = migrate(saveWith({
    achievements: { ...achievements, earned: { ...achievements.earned, 'Bad Id': 1 } },
    journal: { ...journal, days: [[20_000, 1]], highlights: [...journal.highlights, { at: AT, kind: 'gossip', ref: 'x' }] }
  }))
  assert.deepEqual(Object.keys(migrated.achievements.earned).sort(), ['monsters-1', 'monsters-4'])
  assert.equal(migrated.achievements.titles[ROOM], 'monsters-4')
  assert.deepEqual(migrated.journal.days, [])
  assert.equal(migrated.journal.highlights.length, 1)
})

test('an imported save with achievements and a journal passes and keeps them', () => {
  const checked = engine.cleanSave(saveWith({ achievements, journal }))
  assert.equal(checked.ok, true)
  assert.deepEqual(checked.save.achievements, achievements)
  assert.deepEqual(checked.save.journal, journal)
})

test('an imported save naming an achievement the game does not have is refused', () => {
  const checked = engine.cleanSave(saveWith({ achievements: { ...achievements, earned: { 'made-up': AT } } }))
  assert.equal(checked.ok, false)
  assert.match(checked.problem, /not an achievement the game has/)
})

test('an imported title not earned, or for a room that does not play, is refused', () => {
  const notEarned = { ...achievements, earned: { 'monsters-1': AT }, filled: 0 }
  assert.match(engine.cleanSave(saveWith({ achievements: notEarned })).problem, /title not earned/)
  const elsewhere = { ...achievements, titles: { 'local:/work/cosmic-llama': 'monsters-4' } }
  assert.match(engine.cleanSave(saveWith({ achievements: elsewhere })).problem, /room that does not play/)
})

test('an imported journal longer than fourteen days, or with days out of order, is refused', () => {
  const days = Array.from({ length: 15 }, (_, at) => [20_000 + at, ...row()])
  assert.match(engine.cleanSave(saveWith({ journal: { ...journal, days } })).problem, /journal.days/)
  const backwards = [[20_001, ...row()], [20_000, ...row()]]
  assert.match(engine.cleanSave(saveWith({ journal: { ...journal, days: backwards } })).problem, /journal.days.1/)
})

test('an imported journal with a count that is not whole is refused', () => {
  const totals = row()
  totals[2] = 1.5
  assert.match(engine.cleanSave(saveWith({ journal: { ...journal, totals } })).problem, /journal.totals/)
})
