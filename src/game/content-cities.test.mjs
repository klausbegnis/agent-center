import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { validateCities } from './content-cities.mjs'
import { MATERIALS } from './skills.mjs'

const shipped = JSON.parse(readFileSync(new URL('../../game/cities.json', import.meta.url), 'utf8'))

const city = (extra = {}) => ({
  id: 'goldmill',
  name: 'Goldmill',
  tagline: 'Wheat fields and windmills',
  opensAt: 1,
  produces: ['crops'],
  wants: ['ore'],
  banner: 'ui/cities/goldmill.png',
  bannerAlt: 'Wheat fields',
  ...extra
})
const problemsOf = (extra) => validateCities({ cities: [city(extra)] })

test('the shipped cities have no problems', () => {
  assert.deepEqual(validateCities(shipped), [])
})

test('the five shipped cities open at the agreed levels and trade the agreed materials', () => {
  const summary = shipped.cities.map((entry) => [entry.id, entry.opensAt, entry.produces.join('+'), entry.wants.join('+')])
  assert.deepEqual(summary, [
    ['goldmill', 1, 'crops+fish', 'ore+bars'],
    ['deepforge', 5, 'ore+bars+gears', 'crops+logs'],
    ['brinehaven', 10, 'fish+hides', 'runes+seals'],
    ['tallwood', 15, 'logs+hides', 'gears+pages'],
    ['runespire', 25, 'runes+crystals+pages+seals', 'ore+fish']
  ])
})

test('every material is produced by some shipped city, so each can be bought', () => {
  const produced = new Set(shipped.cities.flatMap((entry) => entry.produces))
  assert.deepEqual(MATERIALS.filter((id) => !produced.has(id)), [])
})

test('a city with a well-formed entry has no problems', () => {
  assert.deepEqual(problemsOf({}), [])
})

test('unknown materials, a material listed twice and a city wanting what it produces are refused', () => {
  assert.equal(problemsOf({ produces: ['gold'] }).length, 1)
  assert.equal(problemsOf({ wants: ['ore', 'ore'] }).length, 1)
  assert.equal(problemsOf({ produces: [] }).length, 1)
  assert.equal(problemsOf({ wants: ['crops'] }).length, 1)
})

test('a banner outside ui/cities, a missing alt text and a level out of range are refused', () => {
  assert.equal(problemsOf({ banner: '../secret.png' }).length, 1)
  assert.equal(problemsOf({ banner: 'ui/cities/goldmill.svg' }).length, 1)
  assert.equal(problemsOf({ bannerAlt: '' }).length, 1)
  const levelProblem = 'city "goldmill": "opensAt" must be a world level from 1 to 1000'
  assert.ok(problemsOf({ opensAt: 0 }).includes(levelProblem))
  assert.ok(problemsOf({ opensAt: 2.5 }).includes(levelProblem))
})

test('an unknown key, a long name, a duplicate id and no city open at level 1 are reported', () => {
  assert.equal(problemsOf({ coins: 3 }).length, 1)
  assert.equal(problemsOf({ name: 'G'.repeat(61) }).length, 1)
  assert.equal(validateCities({ cities: [city(), city()] }).length, 1)
  assert.deepEqual(validateCities({ cities: [city({ opensAt: 5 })] }),
    ['needs a city that opens at world level 1, so every world has a market'])
  assert.deepEqual(validateCities([]), ['must be an object with a "cities" list'])
})
