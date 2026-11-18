import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { validateAchievements } from './achievement-content.mjs'
import { METRICS, metricContext } from './achievement-metrics.mjs'
import { journalGains } from './journal-gains.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = {
  traits: readJson('../../game/traits.json'),
  achievements: readJson('../../game/achievements.json'),
  bestiary: readJson('../../game/bestiary.json'),
  bosses: readJson('../../game/bosses.json'),
  settlement: readJson('../../game/settlement.json'),
  instances: readJson('../../game/instances.json')
}
const context = metricContext(content)
const measure = (metric, save) => METRICS[metric].measure(save, context)

/** A save of one world with a trait record and one room. */
const saveWith = ({ known = [], swaps, characters = {} }) => ({
  worlds: { main: { traits: { known, ...(swaps ? { swaps } : {}) }, projects: { room: { characters, chest: [] } } } }
})

test('the shipped achievements name the trait metrics correctly', () => {
  assert.deepEqual(validateAchievements(content.achievements, content), [])
  assert.ok(content.achievements.achievements.some((entry) => entry.when.metric === 'traitsCollected'))
})

test('the trait metrics read the collection, its mythic traits, a full character and the swaps', () => {
  const save = saveWith({
    known: ['stout-arm', 'starborn', 'keen-eye'],
    swaps: 2,
    characters: { a: { traits: ['stout-arm', 'keen-eye', 'whirlwind', 'starborn'] }, b: {} }
  })
  assert.equal(measure('traitsCollected', save), 3)
  assert.equal(measure('mythicTraits', save), 1)
  assert.equal(measure('traitsCarried', save), 4)
  assert.equal(measure('traitSwaps', save), 2)
  assert.equal(measure('traitSwaps', saveWith({})), 0)
})

test('a scroll a kill dropped is a highlight of the journal', () => {
  const events = [{ type: 'kill', roomId: 'room', rank: 'elite', scroll: 'whirlwind' }, { type: 'kill', roomId: 'room', rank: 'normal' }]
  const gains = journalGains({ before: null, after: { worlds: {} }, events, at: 5, tierOf: () => 1 })
  assert.deepEqual(gains.highlights, [{ at: 5, kind: 'scroll', ref: 'whirlwind' }])
})
