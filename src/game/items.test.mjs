import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  canAfford, createItem, itemFactor, payFor, tierFactor, upgradeCost, upgradeItem
} from './items.mjs'

const MATERIALS = [
  'bars', 'pages', 'gears', 'crystals', 'seals', 'ore', 'fish', 'crops', 'logs', 'hides', 'runes'
]
const SHIPPED_THEMES = ['pixel-dark', 'guild-hall', 'gothic-dungeon']

function readItems() {
  return JSON.parse(readFileSync(new URL('../../game/items.json', import.meta.url), 'utf8')).items
}

function blade(level = 0) {
  return { ...createItem({ id: 'test-blade', slot: 'weapon', damageType: 'physical', tier: 1,
    recipe: ['bars', 'ore'] }), level }
}

test('tier 1 is worth exactly 1 and every tier is worth more than the one below', () => {
  assert.equal(tierFactor(1), 1)
  for (let tier = 2; tier <= 10; tier++) assert.ok(tierFactor(tier) > tierFactor(tier - 1))
})

test('no item multiplies by 1, and upgrade levels add to the tier factor', () => {
  assert.equal(itemFactor(null), 1)
  assert.equal(itemFactor(blade(0)), 1)
  assert.ok(Math.abs(itemFactor({ tier: 3, level: 4 }) - 1.2 * tierFactor(3)) < 1e-9)
})

test('a new item starts at level 0, free, and carries its recipe', () => {
  const item = createItem({ id: 'test-cloak', slot: 'outfit', tier: 2, recipe: ['hides', 'crops'] })
  assert.equal(item.level, 0)
  assert.equal(item.heldBy, null)
  assert.deepEqual(item.recipe, ['hides', 'crops'])
  assert.equal('damageType' in item, false)
})

test('an upgrade costs the base amount of each recipe material at level 0 and grows with level', () => {
  assert.deepEqual(upgradeCost(blade(0)), { bars: 50, ore: 50 })
  assert.deepEqual(upgradeCost(blade(1)), { bars: 68, ore: 68 })
  assert.ok(upgradeCost(blade(10)).bars > upgradeCost(blade(9)).bars)
})

test('each workbench level takes 5% off an upgrade, never below half price', () => {
  assert.deepEqual(upgradeCost(blade(0), { workbenchLevel: 2 }), { bars: 45, ore: 45 })
  assert.deepEqual(upgradeCost(blade(0), { workbenchLevel: 10 }), { bars: 25, ore: 25 })
  assert.deepEqual(upgradeCost(blade(0), { workbenchLevel: 40 }), { bars: 25, ore: 25 })
})

test('paying exactly what is in stock is allowed and leaves zero', () => {
  const materials = { bars: 50, ore: 50, logs: 3 }
  assert.equal(canAfford(materials, { bars: 50, ore: 50 }), true)
  assert.deepEqual(payFor(materials, { bars: 50, ore: 50 }), { bars: 0, ore: 0, logs: 3 })
  assert.deepEqual(materials, { bars: 50, ore: 50, logs: 3 })
})

test('a cost one unit short, or of a material never gathered, cannot be paid', () => {
  assert.equal(canAfford({ bars: 50, ore: 49 }, { bars: 50, ore: 50 }), false)
  assert.equal(canAfford({ bars: 50 }, { bars: 50, ore: 1 }), false)
  assert.throws(() => payFor({ bars: 50, ore: 49 }, { bars: 50, ore: 50 }))
})

test('upgrading gives a new item one level higher and leaves the old one as it was', () => {
  const item = blade(2)
  const upgraded = upgradeItem(item)
  assert.equal(upgraded.level, 3)
  assert.equal(item.level, 2)
})

test('every default item entry has a valid shape and no balance number', () => {
  const items = readItems()
  const ids = new Set()
  for (const entry of items) {
    assert.match(entry.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, entry.id)
    assert.ok(!ids.has(entry.id), `duplicate ${entry.id}`)
    ids.add(entry.id)
    assert.ok(['weapon', 'outfit', 'tool'].includes(entry.slot), entry.id)
    if (entry.slot === 'weapon') assert.ok(['physical', 'magical'].includes(entry.damageType), entry.id)
    else assert.equal('damageType' in entry, false, entry.id)
    assert.ok(Number.isInteger(entry.tier) && entry.tier >= 1 && entry.tier <= 10, entry.id)
    assert.equal(entry.recipe.length, 2, entry.id)
    assert.notEqual(entry.recipe[0], entry.recipe[1], entry.id)
    for (const materialId of entry.recipe) assert.ok(MATERIALS.includes(materialId), entry.id)
    const allowed = ['id', 'name', 'slot', 'damageType', 'tier', 'recipe', 'themes']
    for (const key of Object.keys(entry)) assert.ok(allowed.includes(key), `${entry.id} has ${key}`)
  }
})

test('the generic items climb the agreed tier ladder in every slot', () => {
  const generic = readItems().filter((entry) => !entry.themes)
  const tiersOf = (slot, damageType) => generic
    .filter((entry) => entry.slot === slot && (!damageType || entry.damageType === damageType))
    .map((entry) => entry.tier).sort((a, b) => a - b)
  assert.deepEqual(tiersOf('weapon', 'physical'), [1, 3, 5, 7, 9])
  assert.deepEqual(tiersOf('weapon', 'magical'), [1, 3, 5, 7, 9])
  assert.deepEqual(tiersOf('outfit'), [1, 4, 7, 10])
  assert.deepEqual(tiersOf('tool'), [1, 4, 7, 10])
})

test('each shipped theme has a physical weapon, a magical weapon, an outfit and a tool', () => {
  const items = readItems()
  for (const theme of SHIPPED_THEMES) {
    const own = items.filter((entry) => entry.themes?.includes(theme))
    const kinds = own.map((entry) => entry.damageType ?? entry.slot).sort()
    assert.deepEqual(kinds, ['magical', 'outfit', 'physical', 'tool'], theme)
  }
})
