import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { bestiaryIndexOf, indexBestiary, validateBestiary } from './bestiary-content.mjs'

const readJson = (name) => JSON.parse(fs.readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const shipped = readJson('bestiary.json')
const races = { races: [{ id: 'goblin' }, { id: 'slime' }] }
const bosses = { bosses: [{ id: 'skrix' }, { id: 'gorrath' }, { id: 'morvash' }] }

/** A small valid bestiary over the two races and three bosses above, with changes. */
function bestiary(change = (data) => data) {
  return change({
    mastery: {
      thresholds: [10, 40, 150],
      perLevel: { effect: 'raceDamage', scope: 'world', amount: 0.02 },
      perkLevels: [2]
    },
    races: [
      { id: 'goblin', name: 'Goblins', perk: { effect: 'itemDrop', scope: 'world', amount: 0.02 } },
      { id: 'slime', name: 'Slimes', scale: 1.5, perk: { effect: 'killMaterials', scope: 'world', amount: 0.01 } }
    ],
    hunter: {
      thresholds: [1, 3],
      levels: [
        [{ effect: 'damage', scope: 'world', amount: 0.01, ranks: ['boss', 'legendary'] }],
        [{ effect: 'legendaryPity', scope: 'world', amount: 0.25 }]
      ]
    }
  })
}
const problemsOf = (data) => validateBestiary(data, { races, bosses })

test('the shipped bestiary is valid against the shipped races and bosses', () => {
  assert.deepEqual(validateBestiary(shipped, { races: readJson('races.json'), bosses: readJson('bosses.json') }), [])
})

test('the shipped bestiary gives every race a perk and the hunter a level per threshold', () => {
  const index = indexBestiary(shipped, readJson('bosses.json'))
  assert.equal(index.raceIds.length, readJson('races.json').races.length)
  assert.equal(index.hunter.levels.length, index.hunter.thresholds.length)
  assert.equal(index.bossIds.size, readJson('bosses.json').bosses.length)
})

test('a small bestiary with every part in place has no problems', () => {
  assert.deepEqual(problemsOf(bestiary()), [])
})

test('every race of the races file needs an entry, once', () => {
  const missing = bestiary((data) => ({ ...data, races: data.races.slice(0, 1) }))
  assert.match(problemsOf(missing).join(), /race "slime" of game\/races.json has no entry/)
  const twice = bestiary((data) => ({ ...data, races: [...data.races, data.races[0]] }))
  assert.match(problemsOf(twice).join(), /listed twice/)
  const unknown = bestiary((data) => ({ ...data, races: [...data.races, { ...data.races[0], id: 'kraken' }] }))
  assert.match(problemsOf(unknown).join(), /a race of game\/races.json/)
})

test('thresholds rise and perks come at mastery levels that exist', () => {
  const falling = bestiary((data) => ({ ...data, mastery: { ...data.mastery, thresholds: [10, 5] } }))
  assert.match(problemsOf(falling).join(), /rising whole numbers/)
  const past = bestiary((data) => ({ ...data, mastery: { ...data.mastery, perkLevels: [4] } }))
  assert.match(problemsOf(past).join(), /perkLevels/)
})

test('a level gives damage against its race only, never one the file names', () => {
  const other = bestiary((data) => ({ ...data, mastery: { ...data.mastery, perLevel: { effect: 'itemDrop', scope: 'world', amount: 0.01 } } }))
  assert.match(problemsOf(other).join(), /must be a raceDamage effect/)
  const named = bestiary((data) => ({
    ...data, mastery: { ...data.mastery, perLevel: { ...data.mastery.perLevel, races: ['goblin'] } }
  }))
  assert.match(problemsOf(named).join(), /names no races/)
})

test('a perk is an effect the bestiary may give the world, within its cap however often it is given', () => {
  const relicOnly = bestiary((data) => ({
    ...data, races: [{ ...data.races[0], perk: { effect: 'critChance', scope: 'world', amount: 0.01 } }, data.races[1]]
  }))
  assert.match(problemsOf(relicOnly).join(), /critChance cannot act on the world/)
  const partyScope = bestiary((data) => ({
    ...data, races: [{ ...data.races[0], perk: { effect: 'itemDrop', scope: 'party', amount: 0.01 } }, data.races[1]]
  }))
  assert.match(problemsOf(partyScope).join(), /scope "world"/)
  const tooMuch = bestiary((data) => ({
    ...data,
    mastery: { ...data.mastery, perkLevels: [1, 2, 3] },
    races: [{ ...data.races[0], perk: { effect: 'itemDrop', scope: 'world', amount: 0.1 } }, data.races[1]]
  }))
  assert.match(problemsOf(tooMuch).join(), /more than the cap/)
})

test('the hunter\'s thresholds count distinct bosses the roster has', () => {
  const past = bestiary((data) => ({ ...data, hunter: { ...data.hunter, thresholds: [1, 4] } }))
  assert.match(problemsOf(past).join(), /at most the roster/)
  const short = bestiary((data) => ({ ...data, hunter: { ...data.hunter, levels: data.hunter.levels.slice(0, 1) } }))
  assert.match(problemsOf(short).join(), /effects of each threshold/)
})

test('a race\'s thresholds are scaled by its scale and still rise', () => {
  const index = indexBestiary(bestiary(), bosses)
  assert.deepEqual(index.races.get('goblin').thresholds, [10, 40, 150])
  assert.deepEqual(index.races.get('slime').thresholds, [15, 60, 225])
})

test('content without a bestiary has no index, and the index is built once per file', () => {
  assert.equal(bestiaryIndexOf({}), null)
  const content = { bestiary: bestiary(), bosses }
  assert.equal(bestiaryIndexOf(content), bestiaryIndexOf({ ...content }))
  assert.notEqual(bestiaryIndexOf(content), bestiaryIndexOf({ bestiary: content.bestiary }))
})

test('unknown keys are refused at every level', () => {
  assert.match(problemsOf({ ...bestiary(), extra: 1 }).join(), /"extra" is not a known key/)
  const race = bestiary((data) => ({ ...data, races: [{ ...data.races[0], lore: 'x' }, data.races[1]] }))
  assert.match(problemsOf(race).join(), /"lore" is not a known key/)
})
