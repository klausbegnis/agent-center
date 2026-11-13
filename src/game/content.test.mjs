import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { MONSTER_KINDS } from './constants.mjs'
import { monstersFor, validateItems, validateMonsters } from './content.mjs'

const SHIPPED_THEMES = ['pixel-dark', 'guild-hall', 'gothic-dungeon']
const KINDS = Object.keys(MONSTER_KINDS)

const monster = (id, kind, extra = {}) => ({
  id,
  name: 'Rumble Banana',
  kind,
  loot: { ore: 2, runes: 1 },
  sprite: { body: 'blob', accent: '#A0522D' },
  ...extra
})
const genericSet = () => KINDS.map((kind) => monster(`plain-${kind}`, kind))
const problemsFor = (entry) => validateMonsters({ monsters: [...genericSet(), entry] })

const item = (id, slot, extra = {}) => ({
  id,
  name: 'Rumble Hammer',
  slot,
  tier: 1,
  recipe: ['ore', 'logs'],
  ...extra
})
const genericItems = () => [
  item('plain-sword', 'weapon', { damageType: 'physical' }),
  item('plain-wand', 'weapon', { damageType: 'magical' }),
  item('plain-coat', 'outfit'),
  item('plain-pick', 'tool')
]
const itemProblemsFor = (entry) => validateItems({ items: [...genericItems(), entry] })
const idsFor = (data, which) => monstersFor(data, which).map((entry) => entry.id)

test('a key beside the monsters list is reported', () => {
  assert.deepEqual(validateMonsters({ monsters: genericSet(), version: 1 }), ['"version" is not a known key'])
})

test('a monster set with a generic entry of every kind has no problems', () => {
  assert.deepEqual(validateMonsters({ monsters: genericSet() }), [])
})

test('a monster file that is not an object with a monsters list is refused', () => {
  assert.equal(validateMonsters([]).includes('must be an object with a "monsters" list'), true)
  assert.equal(validateMonsters({ monster: [] }).includes('must be an object with a "monsters" list'), true)
})

test('two monsters with the same id are reported', () => {
  const problems = validateMonsters({ monsters: [...genericSet(), monster('plain-common', 'common')] })
  assert.equal(problems.some((problem) => problem.includes('same id')), true)
})

test('a monster id that is not kebab-case is reported', () => {
  assert.equal(problemsFor(monster('Rumble_Banana', 'common')).length, 1)
})

test('an unknown monster kind is reported', () => {
  assert.equal(problemsFor(monster('rumble-banana', 'dragon')).length, 1)
})

test('a monster loot table must be non-empty, with known materials and positive weights', () => {
  assert.equal(problemsFor(monster('rumble-banana', 'common', { loot: {} })).length, 1)
  assert.equal(problemsFor(monster('rumble-banana', 'common', { loot: { gold: 1 } })).length, 1)
  assert.equal(problemsFor(monster('rumble-banana', 'common', { loot: { ore: 0 } })).length, 1)
})

test('a monster sprite needs a known body and a #RRGGBB accent', () => {
  const withSprite = (sprite) => monster('rumble-banana', 'common', { sprite })
  assert.equal(problemsFor(withSprite({ body: 'cube', accent: '#A0522D' })).length, 1)
  assert.equal(problemsFor(withSprite({ body: 'blob', accent: 'red' })).length, 1)
})

test('monster themes, when given, must be a non-empty list of strings', () => {
  assert.equal(problemsFor(monster('rumble-banana', 'common', { themes: [] })).length, 1)
  assert.equal(problemsFor(monster('rumble-banana', 'common', { themes: [3] })).length, 1)
  assert.deepEqual(problemsFor(monster('rumble-banana', 'common', { themes: ['world-1'] })), [])
})

test('an unknown key on a monster is reported', () => {
  assert.equal(problemsFor(monster('rumble-banana', 'common', { hp: 100 })).length, 1)
})

test('a monster set lacking a generic entry of some kind is reported', () => {
  const themedBoss = monster('plain-boss', 'boss', { themes: ['world-1'] })
  const monsters = [...genericSet().filter((entry) => entry.kind !== 'boss'), themedBoss]
  const expected = ['needs at least one generic (theme-less) monster of kind "boss"']
  assert.deepEqual(validateMonsters({ monsters }), expected)
})

test('the shipped monster file is valid', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../../game/monsters.json', import.meta.url), 'utf8'))
  assert.deepEqual(validateMonsters(data), [])
})

test('every shipped theme has a monster of every kind of its own', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../../game/monsters.json', import.meta.url), 'utf8'))
  for (const themeId of SHIPPED_THEMES) {
    for (const kind of KINDS) {
      const entries = monstersFor(data, { kind, themeId })
      assert.equal(entries.length > 0 && entries.every((entry) => entry.themes?.includes(themeId)), true,
        `${themeId} has no ${kind}`)
    }
  }
})

test('an item set with every generic slot and damage type has no problems', () => {
  assert.deepEqual(validateItems({ items: genericItems() }), [])
})

test('a weapon needs a damage type and nothing else may have one', () => {
  assert.equal(itemProblemsFor(item('rumble-sword', 'weapon')).length, 1)
  assert.equal(itemProblemsFor(item('rumble-coat', 'outfit', { damageType: 'magical' })).length, 1)
})

test('an item tier must be a whole number from 1 to 10', () => {
  assert.equal(itemProblemsFor(item('rumble-pick', 'tool', { tier: 0 })).length, 1)
  assert.equal(itemProblemsFor(item('rumble-pick', 'tool', { tier: 11 })).length, 1)
  assert.equal(itemProblemsFor(item('rumble-pick', 'tool', { tier: 2.5 })).length, 1)
})

test('an item recipe must be two different known materials', () => {
  assert.equal(itemProblemsFor(item('rumble-pick', 'tool', { recipe: ['ore', 'ore'] })).length, 1)
  assert.equal(itemProblemsFor(item('rumble-pick', 'tool', { recipe: ['ore', 'gold'] })).length, 1)
  assert.equal(itemProblemsFor(item('rumble-pick', 'tool', { recipe: ['ore'] })).length, 1)
})

test('an unknown slot, an unknown key and a duplicate item id are each reported', () => {
  assert.equal(itemProblemsFor(item('rumble-ring', 'ring')).length, 1)
  assert.equal(itemProblemsFor(item('rumble-pick', 'tool', { power: 3 })).length, 1)
  assert.equal(itemProblemsFor(item('plain-pick', 'tool')).length, 1)
})

test('an item set lacking a generic magical weapon is reported', () => {
  const items = genericItems().filter((entry) => entry.id !== 'plain-wand')
  assert.deepEqual(validateItems({ items }), ['needs at least one generic (theme-less) magical weapon'])
})

test('a theme with monsters of a kind gets only its own', () => {
  const data = { monsters: [...genericSet(), monster('world-common', 'common', { themes: ['world-1'] })] }
  assert.deepEqual(idsFor(data, { kind: 'common', themeId: 'world-1' }), ['world-common'])
})

test('a theme without monsters of a kind falls back to the generic ones', () => {
  const data = { monsters: [...genericSet(), monster('world-common', 'common', { themes: ['world-1'] })] }
  assert.deepEqual(idsFor(data, { kind: 'boss', themeId: 'world-1' }), ['plain-boss'])
  assert.deepEqual(idsFor(data, { kind: 'common', themeId: 'world-2' }), ['plain-common'])
})
