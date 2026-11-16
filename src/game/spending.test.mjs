import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  GROUP_COST_BASE,
  GROUP_COST_GROWTH,
  GROUP_UPGRADES,
  REWARD_GROWTH,
  UPGRADE_COST_BASE
} from './constants.mjs'
import { upgradeCost } from './items.mjs'
import {
  GROUP_UPGRADE_IDS,
  applyPurchase,
  bestAffordablePurchase,
  campfireShare,
  groupUpgradeCost,
  itemsInUse,
  runeCircleShare,
  spendWorld
} from './spending.mjs'

const owned = (id, slot, { level = 0, heldBy = null, damageType = 'physical' } = {}) => ({
  id,
  entryId: id,
  slot,
  tier: 1,
  level,
  heldBy,
  recipe: ['bars', 'ore'],
  ...(slot === 'weapon' ? { damageType } : {})
})

function worldWith(chest, materials) {
  return {
    skills: {},
    materials,
    upgrades: {},
    lastTokenAt: 0,
    projects: { 'rumble-banana': { chest, characters: { first: {} } } }
  }
}

test('there are three group upgrades, each costing two materials that grow by level', () => {
  assert.deepEqual(GROUP_UPGRADE_IDS, ['campfire', 'workbench', 'runeCircle'])
  for (const upgradeId of GROUP_UPGRADE_IDS) {
    const [first, second] = GROUP_UPGRADES[upgradeId].recipe
    assert.deepEqual(groupUpgradeCost(upgradeId, 0), { [first]: GROUP_COST_BASE, [second]: GROUP_COST_BASE })
    assert.equal(groupUpgradeCost(upgradeId, 3)[first], Math.round(GROUP_COST_BASE * GROUP_COST_GROWTH ** 3))
  }
})

test('campfire and rune circle grow with diminishing returns and never reach everything', () => {
  for (const share of [campfireShare, runeCircleShare]) {
    assert.equal(share(0), 0)
    assert.ok(share(2) - share(1) < share(1) - share(0))
    assert.ok(share(1_000) <= 1)
  }
})

test('the items in use are the ones living characters hold', () => {
  const chest = [
    owned('held-sword', 'weapon', { heldBy: 'first' }),
    owned('spare-sword', 'weapon', { level: 3 }),
    owned('held-coat', 'outfit', { heldBy: 'first' })
  ]
  const ids = itemsInUse({ chest, characters: { first: {} } }).map((item) => item.id)
  assert.deepEqual(ids, ['held-sword', 'held-coat'])
})

test('upgrades and group upgrades cost more the further they are above the world\'s reference', () => {
  const sword = owned('held-sword', 'weapon', { heldBy: 'first' })
  const atReference = upgradeCost(sword, { worldLevel: 0 }).bars
  assert.equal(atReference, UPGRADE_COST_BASE)
  assert.ok(upgradeCost({ ...sword, level: 3 }, { worldLevel: 0 }).bars > atReference)
  assert.ok(upgradeCost(sword, { worldLevel: 80 }).bars < UPGRADE_COST_BASE * REWARD_GROWTH ** 80)
  const [material] = GROUP_UPGRADES.campfire.recipe
  assert.ok(groupUpgradeCost('campfire', 2, 50)[material] < groupUpgradeCost('campfire', 8, 50)[material])
})

test('the best affordable purchase is the cheapest for its weight, and paying never goes negative', () => {
  const chest = [
    owned('held-sword', 'weapon', { heldBy: 'first' }),
    owned('worn-coat', 'outfit', { heldBy: 'first', level: 2 })
  ]
  const world = worldWith(chest, { bars: UPGRADE_COST_BASE + 10, ore: UPGRADE_COST_BASE + 10 })
  const purchase = bestAffordablePurchase(world)
  assert.equal(purchase.itemId, 'held-sword')
  const after = applyPurchase(world, purchase)
  assert.equal(after.projects['rumble-banana'].chest[0].level, 1)
  assert.ok(Object.values(after.materials).every((amount) => amount >= 0))
})

test('a purchase the world cannot pay leaves it as it was', () => {
  const world = worldWith([owned('held-sword', 'weapon', { heldBy: 'first' })], {})
  assert.equal(applyPurchase(world, { kind: 'group', upgradeId: 'campfire', cost: { logs: 1 } }), world)
  assert.deepEqual(spendWorld(world).purchases, [])
})
