import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CAMPFIRE_HALF,
  CAMPFIRE_MAX,
  GEAR_GROWTH,
  RUNE_CIRCLE_HALF,
  RUNE_CIRCLE_MAX,
  TIER_LEVELS,
  WORKBENCH_DISCOUNT_PER_LEVEL
} from '../../src/game/constants.mjs'
import {
  chestOrder,
  chestSlotCount,
  costsOnScreen,
  GAME_NUMBERS,
  groupEffectAt,
  itemFactors,
  itemHueTurn,
  shortMaterials,
  slotAfterKey,
  tierStep
} from './arsenal-model.js'

const item = (id, slot, tier, level, heldBy = null) => ({ id, slot, tier, level, heldBy })

test('the chest shows weapons, then outfits, then tools', () => {
  const chest = [item('kit', 'tool', 1, 0), item('coat', 'outfit', 1, 0), item('axe', 'weapon', 1, 0)]
  const order = chestOrder(chest)
  assert.deepEqual(order.map(({ id }) => id), ['axe', 'coat', 'kit'])
})

test('within a kind, held items come before free ones however strong the free ones are', () => {
  const order = chestOrder([item('free', 'weapon', 9, 9), item('held', 'weapon', 1, 0, 'session-1')])
  assert.deepEqual(order.map(({ id }) => id), ['held', 'free'])
})

test('among equally held items, the higher tier comes first, then the higher level', () => {
  const chest = [item('low', 'outfit', 2, 1), item('high', 'outfit', 3, 0), item('mid', 'outfit', 2, 4)]
  const order = chestOrder(chest)
  assert.deepEqual(order.map(({ id }) => id), ['high', 'mid', 'low'])
})

test('ordering the chest leaves the view state as it was', () => {
  const chest = [item('b', 'tool', 1, 0), item('a', 'weapon', 1, 0)]
  chestOrder(chest)
  assert.deepEqual(chest.map(({ id }) => id), ['b', 'a'])
})

test('the chest draws empty slots after its items, in whole rows', () => {
  assert.equal(chestSlotCount(0), 12)
  assert.equal(chestSlotCount(6), 12)
  assert.equal(chestSlotCount(9), 18)
  assert.ok(chestSlotCount(12) >= 16)
})

test('arrow keys move through the slots row by row and stop at the edges', () => {
  assert.equal(slotAfterKey(0, 'ArrowRight', 8, 6), 1)
  assert.equal(slotAfterKey(1, 'ArrowDown', 8, 6), 7)
  assert.equal(slotAfterKey(3, 'ArrowDown', 8, 6), 3)
  assert.equal(slotAfterKey(0, 'ArrowLeft', 8, 6), 0)
  assert.equal(slotAfterKey(7, 'ArrowUp', 8, 6), 1)
  assert.equal(slotAfterKey(4, 'End', 8, 6), 7)
  assert.equal(slotAfterKey(4, 'Tab', 8, 6), null)
})

test('an item looks the same every time, within a small turn of its kind', () => {
  assert.equal(itemHueTurn('whittled-cudgel'), itemHueTurn('whittled-cudgel'))
  const turns = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(itemHueTurn))
  assert.ok(turns.size > 1)
  for (const turn of turns) assert.ok(Math.abs(turn) <= 70)
})

test('a tier out of range is drawn as the nearest tier', () => {
  assert.equal(tierStep(0), 1)
  assert.equal(tierStep(4), 4)
  assert.equal(tierStep(14), 10)
  assert.equal(tierStep(undefined), 1)
})

test('a price short of materials marks each missing one with the most any price needs', () => {
  const short = shortMaterials([{ bars: 100, logs: 10 }, { bars: 40 }], { bars: 30, logs: 50 })
  assert.deepEqual([...short], [['bars', { prices: 2, most: 70 }]])
})

test('a price that can be paid marks nothing', () => {
  assert.equal(shortMaterials([{ bars: 10 }], { bars: 10 }).size, 0)
})

test('the strip marks the chosen item in Items, every group upgrade in Camp, nothing in Party', () => {
  const upgrades = [{ cost: { fish: 1 } }, { cost: { ore: 2 } }]
  const onScreen = { chosenItem: { upgradeCost: { bars: 5 } }, upgrades }
  assert.deepEqual(costsOnScreen('chest', onScreen), [{ bars: 5 }])
  assert.deepEqual(costsOnScreen('chest', { ...onScreen, chosenItem: null }), [])
  assert.deepEqual(costsOnScreen('camp', onScreen), [{ fish: 1 }, { ore: 2 }])
  assert.deepEqual(costsOnScreen('party', onScreen), [])
})

test('one more level multiplies an item by the gear growth', () => {
  const { now, next } = itemFactors({ tier: 2, level: 1, power: 3 })
  assert.ok(Math.abs(now - 1.331) < 1e-9)
  assert.ok(Math.abs(next - 1.4641) < 1e-9)
})

test('an item without its power is worked out from its tier and level', () => {
  assert.equal(itemFactors({ tier: 2, level: 1 }).now, itemFactors({ tier: 1, level: 3, power: 3 }).now)
})

test('group upgrades do nothing at level 0 and grow towards their ceiling', () => {
  assert.equal(groupEffectAt('campfire', 0).staminaAfterKill, 0)
  assert.ok(Math.abs(groupEffectAt('campfire', 5).staminaAfterKill - 0.3) < 1e-9)
  assert.ok(Math.abs(groupEffectAt('runeCircle', 10).monsterHealthCut - 0.1) < 1e-9)
  assert.ok(Math.abs(groupEffectAt('workbench', 2).upgradeCostFactor - 1 / 1.1) < 1e-9)
})

test("the UI's copy of the game's numbers matches the game", () => {
  assert.deepEqual(GAME_NUMBERS, {
    gearGrowth: GEAR_GROWTH,
    tierLevels: TIER_LEVELS,
    campfireMax: CAMPFIRE_MAX,
    campfireHalf: CAMPFIRE_HALF,
    runeCircleMax: RUNE_CIRCLE_MAX,
    runeCircleHalf: RUNE_CIRCLE_HALF,
    workbenchDiscountPerLevel: WORKBENCH_DISCOUNT_PER_LEVEL
  })
})
