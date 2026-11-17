import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { MATERIAL_BASE_VALUES, SETTLEMENT_COIN_SHARE } from './constants.mjs'
import { createEngine } from './engine.mjs'
import { MATERIALS } from './skills.mjs'
import { emptySave } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const base = { monsters: readJson('monsters.json'), items: readJson('items.json') }
const plain = createEngine({ content: base })
const settlementData = readJson('settlement.json')
const settled = createEngine({ content: { ...base, settlement: settlementData, cities: readJson('cities.json') } })

/** A room with a party and a world rich in every material. */
function richWorld(amount = 1e6) {
  let save = emptySave()
  for (const [sessionId, activity] of [['first', 'write'], ['second', 'read'], ['third', 'think']]) {
    save = plain.applyTokens(save, { projectId: 'rumble-banana', sessionId, tokens: 3_000_000, activity, now: 0 })
  }
  const materials = Object.fromEntries(MATERIALS.map((id) => [id, amount]))
  return { ...save, worlds: { ...save.worlds, main: { ...save.worlds.main, materials } } }
}

test('the hearth, workshop and sanctum are bought as the campfire, workbench and rune circle were', () => {
  const save = richWorld()
  for (const upgradeId of ['campfire', 'workbench', 'runeCircle']) {
    assert.deepEqual(settled.buyGroupUpgrade(save, { worldId: 'main', upgradeId }),
      plain.buyGroupUpgrade(save, { worldId: 'main', upgradeId }))
  }
})

const stageFrom = (id) => settlementData.stages.find((stage) => stage.id === id).from
const tierFrom = (tier) => settlementData.buildings[0].tiers[tier - 1].from
/** The world of a save with its building levels and coins set. */
const withWorld = (save, change) => ({ ...save, worlds: { ...save.worlds, main: { ...save.worlds.main, ...change } } })
const buy = (save, upgradeId, useCoins) => settled.buyGroupUpgrade(save, { worldId: 'main', upgradeId, useCoins })

test('the Storehouse opens at the Outpost and the Defences at the Hamlet', () => {
  const camp = richWorld()
  assert.equal(buy(camp, 'storehouse'), camp)
  assert.equal(buy(camp, 'defences'), camp)
  const outpost = withWorld(camp, { upgrades: { campfire: stageFrom('outpost') } })
  assert.equal(buy(outpost, 'storehouse').worlds.main.upgrades.storehouse, 1)
  assert.equal(buy(outpost, 'defences'), outpost)
  const hamlet = withWorld(camp, { upgrades: { campfire: stageFrom('hamlet') } })
  assert.equal(buy(hamlet, 'defences').worlds.main.upgrades.defences, 1)
})

test('without a settlement in the content the two new buildings are never built, by hand or by autoSpend', () => {
  const rich = withWorld(richWorld(), { upgrades: { campfire: 1000 } })
  assert.equal(plain.buyGroupUpgrade(rich, { worldId: 'main', upgradeId: 'storehouse' }), rich)
  const spent = plain.autoSpendWithPurchases(richWorld(5_000))
  assert.ok(!spent.purchases.some((purchase) => ['storehouse', 'defences'].includes(purchase.upgradeId)))
})

test('from tier II a level can be paid half in coins at the materials\' base value, and only then', () => {
  const below = withWorld(richWorld(), { upgrades: { campfire: tierFrom(2) - 1 }, coins: 1e9 })
  assert.equal(buy(below, 'campfire', true), below, 'tier I takes no coins')
  const at = withWorld(richWorld(), { upgrades: { campfire: tierFrom(2) }, coins: 1e9 })
  const inMaterials = buy(at, 'campfire')
  const inCoins = buy(at, 'campfire', true)
  assert.equal(inMaterials.worlds.main.upgrades.campfire, tierFrom(2) + 1)
  assert.equal(inCoins.worlds.main.upgrades.campfire, tierFrom(2) + 1)
  assert.equal(inMaterials.worlds.main.coins, 1e9, 'the price in materials alone stays and takes no coins')
  const paid = (save, id) => at.worlds.main.materials[id] - save.worlds.main.materials[id]
  const full = paid(inMaterials, 'fish')
  assert.equal(paid(inCoins, 'fish'), full - Math.floor(full * SETTLEMENT_COIN_SHARE))
  const coins = Math.floor(full * SETTLEMENT_COIN_SHARE) * (MATERIAL_BASE_VALUES.fish + MATERIAL_BASE_VALUES.crops)
  assert.equal(at.worlds.main.coins - inCoins.worlds.main.coins, coins)
})

test('a level is not paid in coins the world does not have', () => {
  const poor = withWorld(richWorld(), { upgrades: { campfire: tierFrom(2) }, coins: 3 })
  assert.equal(buy(poor, 'campfire', true), poor)
  assert.equal(buy(poor, 'campfire').worlds.main.upgrades.campfire, tierFrom(2) + 1, 'materials alone still pay')
})

test('autoSpend never spends coins', () => {
  const save = withWorld(richWorld(50_000), { upgrades: { campfire: tierFrom(3), workbench: tierFrom(3) }, coins: 1e12 })
  const spent = settled.autoSpendWithPurchases(save)
  assert.ok(spent.purchases.some((purchase) => purchase.kind === 'group'))
  assert.equal(spent.save.worlds.main.coins, 1e12)
})

test('autoSpend builds the new buildings once they open', () => {
  const save = withWorld(richWorld(50_000), { upgrades: { campfire: stageFrom('hamlet') } })
  const built = settled.autoSpendWithPurchases(save).save.worlds.main.upgrades
  assert.ok(built.storehouse > 0 && built.defences > 0)
})

test('a Storehouse makes the world\'s market fee lower', () => {
  const save = withWorld(richWorld(), { upgrades: { campfire: stageFrom('outpost'), storehouse: 10 } })
  const fee = settled.view(save).worlds[0].market.fee
  assert.ok(fee < settled.view(richWorld()).worlds[0].market.fee)
})
