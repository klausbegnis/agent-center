import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { indexSettlement } from './settlement-content.mjs'
import { isBuildingOpen, renovationStars, settlementOf, stageIndexOf, tierOf, totalLevels } from './settlement.mjs'

const data = JSON.parse(readFileSync(new URL('../../game/settlement.json', import.meta.url), 'utf8'))
const index = indexSettlement(data)
const hearth = index.byUpgrade.get('campfire')
const stageFrom = (id) => index.stages.find((stage) => stage.id === id).from

test('the campfire, the workbench and the rune circle are the hearth, the workshop and the sanctum', () => {
  assert.equal(index.byUpgrade.get('campfire').id, 'hearth')
  assert.equal(index.byUpgrade.get('workbench').id, 'workshop')
  assert.equal(index.byUpgrade.get('runeCircle').id, 'sanctum')
})

test('a building has no tier before it is built, then rises a tier at each threshold', () => {
  assert.equal(tierOf(hearth, 0), 0)
  assert.equal(tierOf(hearth, 1), 1)
  assert.equal(tierOf(hearth, hearth.tiers[1].from - 1), 1)
  assert.equal(tierOf(hearth, hearth.tiers[1].from), 2)
  assert.equal(tierOf(hearth, hearth.tiers[2].from), 3)
  assert.equal(tierOf(hearth, 10_000), hearth.tiers.length)
})

test('the stage follows the total of all building levels, from the first stage at none', () => {
  assert.equal(totalLevels({ campfire: 2, workbench: 3, runeCircle: 4 }), 9)
  assert.equal(totalLevels(undefined), 0)
  assert.equal(stageIndexOf(index, 0), 0)
  assert.equal(stageIndexOf(index, stageFrom('outpost')), 1)
  assert.equal(stageIndexOf(index, stageFrom('hamlet') - 1), 1)
  assert.equal(stageIndexOf(index, stageFrom('citadel') * 10), index.stages.length - 1)
})

test('levels past the last stage earn a renovation star every few levels, and none before', () => {
  const last = stageFrom('citadel')
  assert.equal(renovationStars(index, last - 1), 0)
  assert.equal(renovationStars(index, last), 0)
  assert.equal(renovationStars(index, last + index.renovationEvery - 1), 0)
  assert.equal(renovationStars(index, last + index.renovationEvery), 1)
  assert.equal(renovationStars(index, last + 7 * index.renovationEvery), 7)
})

test('a settlement is worked out from the levels alone', () => {
  const world = { upgrades: { campfire: hearth.tiers[1].from, workbench: 1 } }
  const settlement = settlementOf(world, index)
  assert.equal(settlement.total, hearth.tiers[1].from + 1)
  assert.deepEqual(settlement.buildings.map(({ building, level, tier }) => [building.id, level, tier]).slice(0, 3),
    [['hearth', hearth.tiers[1].from, 2], ['workshop', 1, 1], ['sanctum', 0, 0]])
})

test('a building opens at its stage; without a settlement only the upgrades every world had are open', () => {
  const alwaysOpen = ['campfire', 'workbench', 'runeCircle']
  assert.equal(isBuildingOpen({ upgrades: {} }, 'campfire', index, alwaysOpen), true)
  assert.equal(isBuildingOpen({ upgrades: {} }, 'campfire', null, alwaysOpen), true)
  assert.equal(isBuildingOpen({ upgrades: {} }, 'moat', null, alwaysOpen), false)
  const gated = { ...index, byUpgrade: new Map([['campfire', { ...hearth, opensAt: 2 }]]) }
  assert.equal(isBuildingOpen({ upgrades: {} }, 'campfire', gated, alwaysOpen), false)
  assert.equal(isBuildingOpen({ upgrades: { workbench: stageFrom('hamlet') } }, 'campfire', gated, alwaysOpen), true)
})
