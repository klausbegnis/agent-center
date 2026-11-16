import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { equipFromChest } from './chest.mjs'
import { LEGENDARY_PICK_MARGIN } from './constants.mjs'
import { legendaryIndexOf } from './legendary-effects.mjs'
import { equipLegendary, fitsCharacter } from './legendary-equip.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const index = legendaryIndexOf({ legendary: readJson('../../game/legendary.json') })

const plain = (id, slot, level, extra = {}) =>
  ({ id, entryId: id, slot, tier: 1, recipe: ['ore', 'logs'], level, heldBy: null, ...extra })
const legendary = (id, level = 0) => {
  const entry = index.byId.get(id)
  const damageType = entry.damageType ? { damageType: entry.damageType } : {}
  return { ...plain(id, entry.slot, level, damageType), legendary: true }
}
const pick = (chest, character) => equipLegendary(equipFromChest(chest, character), character, index)

test('a weapon or outfit fits its class and a tool fits its trade', () => {
  assert.equal(fitsCharacter(index.byId.get('oathbreaker'), { class: 'physical' }), true)
  assert.equal(fitsCharacter(index.byId.get('oathbreaker'), { class: 'defense' }), false)
  assert.equal(fitsCharacter(index.byId.get('gravewake-mattock'), { class: 'magical', trade: 'mining' }), true)
  assert.equal(fitsCharacter(index.byId.get('gravewake-mattock'), { class: 'magical', trade: 'fishing' }), false)
  assert.equal(fitsCharacter(index.byId.get('rimeheart'), { class: 'physical' }), false)
})

test('a new fighter takes the legendary weapon made for it over a plain one a little ahead', () => {
  const chest = [plain('sword', 'weapon', LEGENDARY_PICK_MARGIN, { damageType: 'physical' }), legendary('oathbreaker')]
  const { chest: after, equipment } = pick(chest, { sessionId: 'a', class: 'physical', trade: 'mining' })
  assert.equal(equipment.weapon, 'oathbreaker')
  assert.equal(after.find((item) => item.id === 'oathbreaker').heldBy, 'a')
  assert.equal(after.find((item) => item.id === 'sword').heldBy, null)
})

test('a plain item far ahead is kept over the legendary one', () => {
  const chest = [plain('sword', 'weapon', LEGENDARY_PICK_MARGIN + 1, { damageType: 'physical' }), legendary('oathbreaker')]
  assert.equal(pick(chest, { sessionId: 'a', class: 'physical' }).equipment.weapon, 'sword')
})

test('a character of another class leaves the legendary weapon in the chest', () => {
  const chest = [legendary('oathbreaker')]
  const { equipment, chest: after } = pick(chest, { sessionId: 'a', class: 'defense', trade: 'mining' })
  assert.equal(after[0].heldBy, null)
  assert.equal(equipment.weapon, null)
})

test('a miner takes the mattock whatever its class', () => {
  const chest = [plain('pick', 'tool', 0), legendary('gravewake-mattock')]
  assert.equal(pick(chest, { sessionId: 'a', class: 'magical', trade: 'mining' }).equipment.tool, 'gravewake-mattock')
})

test('a legendary item another character holds is not taken twice', () => {
  const chest = [{ ...legendary('oathbreaker'), heldBy: 'other' }]
  assert.equal(pick(chest, { sessionId: 'a', class: 'physical' }).equipment.weapon, null)
})

test('without legendary content the pick is equipFromChest\'s', () => {
  const picked = equipFromChest([legendary('oathbreaker')], { sessionId: 'a', class: 'physical' })
  assert.equal(equipLegendary(picked, { sessionId: 'a', class: 'physical' }, null), picked)
})
