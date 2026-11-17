import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SETTLEMENT, buildingEffectText } from './settlement-labels.js'
import { TEASER_LEVELS, badgeModel, buildingModel, campCosts, heroModel, settlementArtUrl } from './settlement-model.js'

const stage = (index, id, name, from) =>
  ({ index, number: index + 1, count: 7, id, name, from, art: `ui/settlement/stage-${index + 1}-${id}.png`, alt: `The ${id}`, bonus: [] })

function settlement(extra = {}) {
  return {
    total: 31,
    stage: stage(3, 'village', 'Village', 30),
    next: { kind: 'stage', ...stage(4, 'town', 'Town', 60), have: 1, need: 30 },
    stars: 0,
    bonuses: [],
    buildings: [],
    ...extra
  }
}

const tier = (number, name, from) => ({ tier: number, name, from, art: `ui/settlement/building-hearth-${number}.png` })
function building(extra = {}) {
  return {
    id: 'hearth', upgradeId: 'campfire', name: 'Hearth', level: 4, tier: 1, tierCount: 3,
    current: tier(1, 'Hearth', 1), nextTier: tier(2, 'Cooking hearth', 5),
    open: true, opensAt: null, cost: { fish: 10, crops: 10 }, affordable: true, coinPrice: null,
    effect: { staminaAfterKill: 0.27 }, nextEffect: { staminaAfterKill: 0.3 },
    ...extra
  }
}

test('the hero names the stage, its number and the building levels to the next one', () => {
  const hero = heroModel(settlement())
  assert.equal(hero.name, 'Village')
  assert.equal(hero.stageText, 'Stage 4 of 7')
  assert.equal(hero.progressText, '31 of 60 building levels to become a Town')
  assert.ok(Math.abs(hero.share - 1 / 30) < 1e-9)
  assert.match(hero.alt, /^The village\. The settlement is a Village, stage 4 of 7\.$/)
})

test('past the last stage the hero counts towards the next renovation star', () => {
  const hero = heroModel(settlement({ stars: 2, next: { kind: 'star', stars: 3, have: 10, need: 50 } }))
  assert.equal(hero.progressText, SETTLEMENT.toStar(10, 50))
  assert.equal(hero.share, 0.2)
  assert.equal(hero.stars, 2)
})

test('an Outpost takes "an"', () => {
  assert.equal(SETTLEMENT.toStage(0, 1, 'Outpost'), '0 of 1 building levels to become an Outpost')
})

test('a building card says its tier, level and what the next level does', () => {
  const card = buildingModel(building())
  assert.equal(card.tierName, 'Hearth')
  assert.equal(card.tierText, 'Tier 1 of 3')
  assert.equal(card.levelText, 'Lv 4')
  assert.equal(card.nowText, 'Restores 27% of missing stamina after each kill')
  assert.equal(card.nextText, 'Restores 30% of missing stamina after each kill')
  assert.equal(card.nextTierText, 'Cooking hearth in 1 level')
})

test('the next tier shows as a teaser only when it is near', () => {
  assert.equal(buildingModel(building()).teaser.name, 'Cooking hearth')
  assert.equal(buildingModel(building({ level: 5 - TEASER_LEVELS - 1 })).teaser, null)
  assert.equal(buildingModel(building({ level: 20, tier: 3, current: tier(3, 'Hearth hall', 15), nextTier: null })).teaser, null)
})

test('an unbuilt building is its first tier, faded, and a locked one says when it opens', () => {
  const unbuilt = buildingModel(building({ level: 0, tier: 0 }))
  assert.equal(unbuilt.isBuilt, false)
  assert.equal(unbuilt.tierName, SETTLEMENT.notBuilt)
  assert.equal(unbuilt.nowText, SETTLEMENT.notBuilt)
  assert.equal(unbuilt.teaser, null)
  const locked = buildingModel(building({ level: 0, tier: 0, open: false, opensAt: { name: 'Hamlet', from: 5 } }))
  assert.equal(locked.lockedText, 'Opens at Hamlet (5 building levels in all)')
})

test('every building says what it does', () => {
  const percent = (share) => `${Math.round(share * 1000) / 10}%`
  assert.equal(buildingEffectText('storehouse', { marketFee: 0.091 }, percent), 'The market\'s fee is 9.1%')
  assert.equal(buildingEffectText('defences', { staminaDrainCut: 0.012 }, percent), 'Monsters drain 1.2% less stamina')
  assert.equal(buildingEffectText('workbench', { upgradeCostFactor: 0.8 }, percent), 'Item upgrades cost 80% of their price')
  assert.equal(buildingEffectText('runeCircle', { monsterHealthCut: 0.1 }, percent), 'Monsters arrive with 10% less health')
})

test('the badge names the stage, and the Camp tab marks the prices of open buildings only', () => {
  const world = { settlement: settlement({ buildings: [building(), building({ open: false, cost: { bars: 9 } })] }) }
  assert.deepEqual(badgeModel(world), { art: world.settlement.stage.art, name: 'Village', stars: 0, label: SETTLEMENT.badgeOpen('Village') })
  assert.equal(badgeModel({}), null)
  assert.deepEqual(campCosts(world), [{ fish: 10, crops: 10 }])
  assert.deepEqual(campCosts({ upgrades: [{ cost: { ore: 1 } }] }), [{ ore: 1 }])
  assert.equal(settlementArtUrl('../', 'ui/settlement/stage-1-camp.png'), '../ui/settlement/stage-1-camp.png')
})
