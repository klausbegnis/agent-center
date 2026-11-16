import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addToChest, bestFreeItem, equipFromChest, findItem, releaseItems } from './chest.mjs'

function item(id, slot, { tier = 1, level = 0, damageType, heldBy = null } = {}) {
  const owned = { id, entryId: id, slot, tier, recipe: ['bars', 'ore'], level, heldBy }
  if (slot === 'weapon') owned.damageType = damageType ?? 'physical'
  return owned
}

test('the best free item is the most powerful one, whatever its tier', () => {
  const chest = [
    item('low-tier-high-level', 'tool', { tier: 1, level: 9 }),
    item('high-tier-low-level', 'tool', { tier: 4, level: 0 }),
    item('high-tier-high-level', 'tool', { tier: 4, level: 2 })
  ]
  assert.equal(bestFreeItem(chest, { slot: 'tool' }).id, 'low-tier-high-level')
})

test('between two equally powerful items the higher tier is picked', () => {
  const chest = [
    item('upgraded-plain', 'tool', { tier: 1, level: 6 }),
    item('fresh-fancy', 'tool', { tier: 4, level: 0 })
  ]
  assert.equal(bestFreeItem(chest, { slot: 'tool' }).id, 'fresh-fancy')
})

test('two equal items are told apart by id, whatever their order in the chest', () => {
  const first = item('beta-hammer', 'weapon', { tier: 3 })
  const second = item('alpha-hammer', 'weapon', { tier: 3 })
  assert.equal(bestFreeItem([first, second], { slot: 'weapon' }).id, 'alpha-hammer')
  assert.equal(bestFreeItem([second, first], { slot: 'weapon' }).id, 'alpha-hammer')
})

test('a weapon of the other damage type is never picked, however good', () => {
  const chest = [
    item('grand-staff', 'weapon', { tier: 9, damageType: 'magical' }),
    item('plain-club', 'weapon', { tier: 1, damageType: 'physical' })
  ]
  assert.equal(bestFreeItem(chest, { slot: 'weapon', damageType: 'physical' }).id, 'plain-club')
  assert.equal(bestFreeItem(chest, { slot: 'weapon', damageType: 'magical' }).id, 'grand-staff')
})

test('the damage type is ignored for outfits and tools', () => {
  const chest = [item('wool-coat', 'outfit')]
  assert.equal(bestFreeItem(chest, { slot: 'outfit', damageType: 'magical' }).id, 'wool-coat')
})

test('a new character never takes an item another character holds', () => {
  const chest = [
    item('held-sword', 'weapon', { tier: 9, heldBy: 'session-1' }),
    item('spare-sword', 'weapon', { tier: 2 })
  ]
  const { chest: after, equipment } = equipFromChest(chest, { sessionId: 'session-2', class: 'physical' })
  assert.equal(equipment.weapon, 'spare-sword')
  assert.equal(findItem(after, 'held-sword').heldBy, 'session-1')
  assert.equal(findItem(after, 'spare-sword').heldBy, 'session-2')
})

test('a magical character takes a magical weapon and the others a physical one', () => {
  const chest = [item('ember-wand', 'weapon', { damageType: 'magical' }), item('iron-axe', 'weapon')]
  const { equipment: magical } = equipFromChest(chest, { sessionId: 'session-1', class: 'magical' })
  assert.equal(magical.weapon, 'ember-wand')
  for (const characterClass of ['physical', 'defense', 'support']) {
    const { equipment } = equipFromChest(chest, { sessionId: 'session-1', class: characterClass })
    assert.equal(equipment.weapon, 'iron-axe', characterClass)
  }
})

test('a slot with nothing free is left empty and the chest is not changed in place', () => {
  const chest = [item('wool-coat', 'outfit')]
  const { chest: after, equipment } = equipFromChest(chest, { sessionId: 'session-1', class: 'support' })
  assert.deepEqual(equipment, { weapon: null, outfit: 'wool-coat', tool: null })
  assert.equal(chest[0].heldBy, null)
  assert.equal(after[0].heldBy, 'session-1')
})

test('releasing frees only the items of that session', () => {
  const chest = [
    item('mine', 'tool', { heldBy: 'session-1' }),
    item('theirs', 'outfit', { heldBy: 'session-2' })
  ]
  const after = releaseItems(chest, 'session-1')
  assert.equal(findItem(after, 'mine').heldBy, null)
  assert.equal(findItem(after, 'theirs').heldBy, 'session-2')
  assert.equal(chest[0].heldBy, 'session-1')
})

test('a second copy of the same item gets its own id and remembers its entry', () => {
  let chest = addToChest([], item('iron-axe', 'weapon'))
  chest = addToChest(chest, item('iron-axe', 'weapon'))
  chest = addToChest(chest, item('iron-axe', 'weapon'))
  assert.deepEqual(chest.map((owned) => owned.id), ['iron-axe', 'iron-axe-2', 'iron-axe-3'])
  assert.equal(findItem(chest, 'iron-axe-3').entryId, 'iron-axe')
})

test('looking for an item that is not in the chest finds nothing', () => {
  assert.equal(findItem([item('iron-axe', 'weapon')], 'gold-axe'), null)
})
