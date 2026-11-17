import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import { MATERIALS } from './skills.mjs'
import { emptySave } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const base = { monsters: readJson('monsters.json'), items: readJson('items.json') }
const plain = createEngine({ content: base })
const settled = createEngine({ content: { ...base, settlement: readJson('settlement.json') } })

/** A room with a party and a world rich in every material. */
function richWorld(amount = 1e6) {
  let save = emptySave()
  for (const [sessionId, activity] of [['first', 'write'], ['second', 'read'], ['third', 'think']]) {
    save = plain.applyTokens(save, { projectId: 'rumble-banana', sessionId, tokens: 3_000_000, activity, now: 0 })
  }
  const materials = Object.fromEntries(MATERIALS.map((id) => [id, amount]))
  return { ...save, worlds: { ...save.worlds, main: { ...save.worlds.main, materials } } }
}

test('the hearth, workshop and sanctum are bought and auto-spent as the campfire, workbench and rune circle were', () => {
  const save = richWorld()
  for (const upgradeId of ['campfire', 'workbench', 'runeCircle']) {
    assert.deepEqual(settled.buyGroupUpgrade(save, { worldId: 'main', upgradeId }),
      plain.buyGroupUpgrade(save, { worldId: 'main', upgradeId }))
  }
  const withSettlement = settled.autoSpendWithPurchases(richWorld(5_000))
  const without = plain.autoSpendWithPurchases(richWorld(5_000))
  assert.ok(withSettlement.purchases.some((purchase) => purchase.kind === 'group'))
  assert.deepEqual(withSettlement.save.worlds.main.upgrades, without.save.worlds.main.upgrades)
})
