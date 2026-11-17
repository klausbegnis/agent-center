import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { indexBestiary } from './bestiary-content.mjs'
import { bestiaryEffects } from './bestiary-effects.mjs'
import {
  DEFENCES_DRAIN_MAX,
  LEGENDARY_EFFECT_CAPS,
  MARKET_FEE,
  MARKET_FEE_FLOOR,
  STOREHOUSE_FEE_MAX
} from './constants.mjs'
import { legendaryIndexOf, partyBonuses, totalOf } from './legendary-effects.mjs'
import { indexSettlement } from './settlement-content.mjs'
import { buildingEffects, marketFeeOf, settlementEffects, stageBonuses } from './settlement-effects.mjs'
import { worldEffectsOf } from './world-effects.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const settlementData = readJson('settlement.json')
const index = indexSettlement(settlementData)
const amountOf = (effects, type) => effects.filter((effect) => effect.effect === type).reduce((sum, effect) => sum + effect.amount, 0)
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`)
/** Levels that reach a stage exactly, all in the hearth. */
const atStage = (id) => ({ campfire: index.stages.find((stage) => stage.id === id).from })

test('the Storehouse lowers the fee and the Defences the drain, ever closer to their ceiling', () => {
  assert.deepEqual(buildingEffects({}), [])
  const at = (level) => buildingEffects({ storehouse: level, defences: level })
  assert.ok(amountOf(at(1), 'marketFee') > 0 && amountOf(at(1), 'staminaDrain') > 0)
  const fee = (level) => amountOf(at(level), 'marketFee')
  assert.ok(fee(2) - fee(1) > fee(3) - fee(2))
  assert.ok(amountOf(at(1e9), 'marketFee') < STOREHOUSE_FEE_MAX)
  assert.ok(amountOf(at(1e9), 'staminaDrain') < DEFENCES_DRAIN_MAX)
})

test('the market fee falls with the Storehouse but never below its floor, which is above nothing', () => {
  assert.equal(marketFeeOf({ upgrades: {} }), MARKET_FEE)
  assert.ok(marketFeeOf({ upgrades: { storehouse: 5 } }) < MARKET_FEE)
  assert.ok(marketFeeOf({ upgrades: { storehouse: 1e12 } }) >= MARKET_FEE_FLOOR - 1e-12)
  assert.ok(MARKET_FEE_FLOOR > 0)
})

test('a stage keeps the bonus of every stage before it', () => {
  assert.deepEqual(stageBonuses(index, 0), index.stages[0].bonus)
  const last = index.stages.length - 1
  assert.equal(stageBonuses(index, last).length, index.stages.reduce((sum, stage) => sum + stage.bonus.length, 0))
  const village = settlementEffects({ upgrades: atStage('village') }, index)
  for (const stage of index.stages.slice(0, 4)) {
    for (const bonus of stage.bonus) assert.ok(village.some((effect) => effect.effect === bonus.effect))
  }
  assert.ok(!village.some((effect) => effect.effect === 'restTime'), 'the citadel\'s bonus is not the village\'s')
})

test('without a settlement in the content only the buildings give anything', () => {
  assert.deepEqual(settlementEffects({ upgrades: { campfire: 900 } }, null), [])
  assert.deepEqual(settlementEffects({ upgrades: { defences: 3 } }, null), buildingEffects({ defences: 3 }))
})

test('the world\'s effects are its bestiary\'s and its settlement\'s, and the Defences lighten every strike', () => {
  const content = { settlement: settlementData }
  const world = { upgrades: { ...atStage('hamlet'), defences: 10 } }
  const effects = worldEffectsOf(world, content)
  assert.equal(worldEffectsOf(world, content), effects, 'worked out once per state of the levels')
  close(partyBonuses(effects, []).drainFactor, 1 - totalOf(effects, 'staminaDrain'))
  assert.ok(partyBonuses(effects, []).drainFactor < partyBonuses([], []).drainFactor)
  assert.ok(partyBonuses(effects, []).poolFactor > 1, 'the hamlet makes the stamina pool larger')
})

test('a whole settlement at its top, the strongest relic, all the legendary equipment and a whole bestiary stay within every cap', () => {
  const content = { legendary: readJson('legendary.json'), bosses: readJson('bosses.json'), bestiary: readJson('bestiary.json') }
  const legendary = legendaryIndexOf(content)
  const bestiaryIndex = indexBestiary(content.bestiary, content.bosses)
  const kills = (count) => [count, 0, 0, 0, 0, 0, 20_000]
  const maxedBestiary = {
    races: Object.fromEntries(bestiaryIndex.raceIds.map((raceId) => [raceId, kills(1e9)])),
    bosses: Object.fromEntries(content.bosses.bosses.map((boss) => [boss.id, [1, 0, 20_000]]))
  }
  const top = { upgrades: { campfire: 1e9, workbench: 1e9, runeCircle: 1e9, storehouse: 1e9, defences: 1e9 } }
  const settlement = settlementEffects(top, index)
  const bestiary = bestiaryEffects(maxedBestiary, bestiaryIndex)
  // Damage, race damage and a work skill's experience depend on qualifiers the settlement never
  // gives; gathering is already at its cap from a relic and a tool (bestiary-effects.test.mjs
  // checks all three).
  const qualified = ['damage', 'raceDamage', 'gatherYield', 'skillXp']
  for (const type of Object.keys(LEGENDARY_EFFECT_CAPS).filter((each) => !qualified.includes(each))) {
    const entries = [...legendary.byId.values()].filter((entry) => entry.effect.effect === type)
    const relic = Math.max(0, ...entries.filter((entry) => entry.kind !== 'equipment').map((entry) => entry.effect.amount))
    const held = entries.filter((entry) => entry.kind === 'equipment').reduce((sum, entry) => sum + entry.effect.amount, 0)
    const sum = relic + held + amountOf(bestiary, type) + amountOf(settlement, type)
    assert.ok(sum <= LEGENDARY_EFFECT_CAPS[type] + 1e-9, `${type}: ${sum} is over ${LEGENDARY_EFFECT_CAPS[type]}`)
  }
  assert.ok(!settlement.some((effect) => qualified.includes(effect.effect)))
})
