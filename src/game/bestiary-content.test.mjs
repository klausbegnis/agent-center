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
    points: { normal: 1, veteran: 2, elite: 5, champion: 10, boss: 25, legendary: 60 },
    mastery: {
      levels: 10, firstCost: 2, growth: 1.3,
      perLevel: { effect: 'raceDamage', scope: 'world', amount: 0.005 },
      perkEvery: 5
    },
    races: [
      { id: 'goblin', name: 'Goblins', title: 'Goblin-bane', perk: { effect: 'itemDrop', scope: 'world', amount: 0.01 } },
      { id: 'slime', name: 'Slimes', title: 'Slime-scourer', scale: 1.5, perk: { effect: 'killMaterials', scope: 'world', amount: 0.01 } }
    ],
    rank: { firstCost: 20, growth: 1.25, half: 20, effect: { effect: 'killMaterials', scope: 'world', amount: 0.02 } },
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

test('the shipped bestiary gives every race a perk and a title, and the hunter a level per threshold', () => {
  const index = indexBestiary(shipped, readJson('bosses.json'))
  assert.equal(index.raceIds.length, readJson('races.json').races.length)
  assert.ok([...index.races.values()].every((race) => race.title && race.perk))
  assert.equal(index.hunter.levels.length, index.hunter.thresholds.length)
  assert.equal(index.hunter.thresholds[0], 1)
})

test('a small bestiary with every part in place has no problems', () => {
  assert.deepEqual(problemsOf(bestiary()), [])
})

test('every race of the races file needs an entry, once, with a name and a title', () => {
  const missing = bestiary((data) => ({ ...data, races: data.races.slice(0, 1) }))
  assert.match(problemsOf(missing).join(), /race "slime" of game\/races.json has no entry/)
  const twice = bestiary((data) => ({ ...data, races: [...data.races, data.races[0]] }))
  assert.match(problemsOf(twice).join(), /listed twice/)
  const untitled = bestiary((data) => ({ ...data, races: [{ ...data.races[0], title: '' }, data.races[1]] }))
  assert.match(problemsOf(untitled).join(), /"title" must be a non-empty string/)
})

test('every rank is worth whole points', () => {
  const missing = bestiary((data) => ({ ...data, points: { ...data.points, legendary: undefined } }))
  assert.match(problemsOf(missing).join(), /points: "legendary"/)
  const fraction = bestiary((data) => ({ ...data, points: { ...data.points, elite: 2.5 } }))
  assert.match(problemsOf(fraction).join(), /points: "elite"/)
})

test('a ladder has a whole first cost and a growth above 1', () => {
  const flat = bestiary((data) => ({ ...data, mastery: { ...data.mastery, growth: 1 } }))
  assert.match(problemsOf(flat).join(), /"growth" must be a number/)
  const free = bestiary((data) => ({ ...data, rank: { ...data.rank, firstCost: 0 } }))
  assert.match(problemsOf(free).join(), /rank: "firstCost"/)
})

test('a level gives damage against its race only, never one the file names, within the cap', () => {
  const other = bestiary((data) => ({ ...data, mastery: { ...data.mastery, perLevel: { effect: 'itemDrop', scope: 'world', amount: 0.01 } } }))
  assert.match(problemsOf(other).join(), /must be a raceDamage effect/)
  const tooMany = bestiary((data) => ({ ...data, mastery: { ...data.mastery, levels: 30 } }))
  assert.match(problemsOf(tooMany).join(), /30 times 0.005 is more than the cap/)
})

test('a perk is an effect the bestiary may give the world, within its cap however often it is given', () => {
  const relicOnly = bestiary((data) => ({
    ...data, races: [{ ...data.races[0], perk: { effect: 'critChance', scope: 'world', amount: 0.01 } }, data.races[1]]
  }))
  assert.match(problemsOf(relicOnly).join(), /critChance cannot act on the world/)
  const often = bestiary((data) => ({ ...data, mastery: { ...data.mastery, perkEvery: 1 } }))
  assert.deepEqual(problemsOf(often), [])
  const tooMuch = bestiary((data) => ({
    ...data, mastery: { ...data.mastery, perkEvery: 1 },
    races: [{ ...data.races[0], perk: { effect: 'itemDrop', scope: 'world', amount: 0.05 } }, data.races[1]]
  }))
  assert.match(problemsOf(tooMuch).join(), /more than the cap/)
  const past = bestiary((data) => ({ ...data, mastery: { ...data.mastery, perkEvery: 11 } }))
  assert.match(problemsOf(past).join(), /perkEvery/)
})

test('the hunter\'s thresholds count distinct bosses the roster has', () => {
  const past = bestiary((data) => ({ ...data, hunter: { ...data.hunter, thresholds: [1, 4] } }))
  assert.match(problemsOf(past).join(), /at most the roster/)
  const short = bestiary((data) => ({ ...data, hunter: { ...data.hunter, levels: data.hunter.levels.slice(0, 1) } }))
  assert.match(problemsOf(short).join(), /effects of each threshold/)
})

test('a race\'s ladder carries its scale', () => {
  const index = indexBestiary(bestiary(), bosses)
  assert.deepEqual(index.races.get('goblin').ladder, { firstCost: 2, growth: 1.3, scale: 1 })
  assert.equal(index.races.get('slime').ladder.scale, 1.5)
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
