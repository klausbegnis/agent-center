import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { COPIES_PER_ITEM, ITEM_MAX_TIER, TIER_LEVELS } from './constants.mjs'
import { addDrop, dropTier, droppedEntry } from './drops.mjs'
import { effectiveGearLevel } from './items.mjs'
import { referenceGearLevel } from './power.mjs'

const items = JSON.parse(readFileSync(new URL('../../game/items.json', import.meta.url), 'utf8'))
const entry = {
  id: 'test-blade',
  name: 'Test Blade',
  slot: 'weapon',
  damageType: 'physical',
  tier: 2,
  recipe: ['bars', 'ore']
}

test('a drop never has more power than the reference gear of the monster\'s level', () => {
  for (const level of [1, 10, 40, 80, 150, 400]) {
    assert.ok(TIER_LEVELS * (dropTier(level) - 1) <= referenceGearLevel(level) + 1e-9, `level ${level}`)
    assert.ok(dropTier(level) >= 1 && dropTier(level) <= ITEM_MAX_TIER)
  }
})

test('the same kill always drops the same entry, and different kills drop different ones', () => {
  const roll = { level: 60, themeId: null, seed: 'main|rumble-banana|60|3' }
  assert.equal(droppedEntry(items, roll), droppedEntry(items, roll))
  const dropAt = (kill) => droppedEntry(items, { ...roll, seed: `seed-${kill}` }).id
  const ids = new Set(Array.from({ length: 50 }, (_, kill) => dropAt(kill)))
  assert.ok(ids.size >= 3)
})

test('a drop is generic or of the room\'s theme, and never above the drop tier', () => {
  for (let kill = 0; kill < 60; kill++) {
    const dropped = droppedEntry(items, { level: 50, themeId: 'pixel-dark', seed: `kill-${kill}` })
    assert.ok(dropped.themes === undefined || dropped.themes.includes('pixel-dark'))
    assert.ok(dropped.tier <= dropTier(50))
  }
})

test('a drop is a new copy until the chest holds enough, then it upgrades the lowest copy', () => {
  let chest = []
  for (let copy = 0; copy < COPIES_PER_ITEM; copy++) chest = addDrop(chest, entry)
  assert.equal(chest.length, COPIES_PER_ITEM)
  const before = chest.reduce((sum, item) => sum + effectiveGearLevel(item), 0)
  chest = addDrop(chest, entry)
  assert.equal(chest.length, COPIES_PER_ITEM)
  assert.equal(chest.reduce((sum, item) => sum + effectiveGearLevel(item), 0), before + 1)
})
