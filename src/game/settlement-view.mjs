// A world's settlement as a UI draws it: the stage with its art, bonus and the way to the next one,
// and each building with its level, tier, art, what it does now and at the next level, and its next
// price in materials and, from the tier that takes them, in coins. Pure.
import { buildingPrices } from './buildings.mjs'
import { WORKBENCH_DISCOUNT_PER_LEVEL } from './constants.mjs'
import { canAfford } from './items.mjs'
import { totalOf } from './legendary-effects.mjs'
import { settlementIndexOf } from './settlement-content.mjs'
import { buildingEffects, marketFeeOf, stageBonuses } from './settlement-effects.mjs'
import { settlementOf } from './settlement.mjs'
import { campfireShare, isUpgradeOpen, runeCircleShare } from './spending.mjs'

/**
 * What a building does at a level, as one number a UI can format: the same shapes the group
 * upgrades always had, and the fee and the drain cut for the two new ones.
 *
 * @param {string} upgradeId
 * @param {number} level
 * @returns {Record<string, number>}
 */
export function groupEffect(upgradeId, level) {
  if (upgradeId === 'campfire') return { staminaAfterKill: campfireShare(level) }
  if (upgradeId === 'runeCircle') return { monsterHealthCut: runeCircleShare(level) }
  if (upgradeId === 'storehouse') return { marketFee: marketFeeOf({ upgrades: { storehouse: level } }) }
  if (upgradeId === 'defences') return { staminaDrainCut: totalOf(buildingEffects({ defences: level }), 'staminaDrain') }
  return { upgradeCostFactor: 1 / (1 + WORKBENCH_DISCOUNT_PER_LEVEL * level) }
}

/** A stage as the view gives it. */
const stageView = (stage, at, count) => ({
  index: at, number: at + 1, count, id: stage.id, name: stage.name, from: stage.from, art: stage.art, alt: stage.alt,
  bonus: stage.bonus.map((effect) => ({ ...effect }))
})

/** A tier as the view gives it, or null. */
const tierView = (building, tier) => (tier >= 1 && tier <= building.tiers.length
  ? { tier, name: building.tiers[tier - 1].name, from: building.tiers[tier - 1].from, art: building.tiers[tier - 1].art }
  : null)

function buildingView(world, entry, index) {
  const { building, level, tier } = entry
  const open = isUpgradeOpen(world, building.upgradeId, index)
  const { cost, withCoins } = buildingPrices(world, building.upgradeId, index)
  const coins = world.coins ?? 0
  const opensAt = index.stages[building.opensAt]
  return {
    id: building.id,
    upgradeId: building.upgradeId,
    name: building.name,
    level,
    tier,
    tierCount: building.tiers.length,
    // What it looks like now; before it is built, the first tier's picture, shown as a teaser.
    current: tierView(building, Math.max(1, tier)),
    nextTier: tierView(building, tier + 1),
    open,
    opensAt: open ? null : { index: building.opensAt, id: opensAt.id, name: opensAt.name, from: opensAt.from },
    cost,
    affordable: open && canAfford(world.materials, cost),
    coinPrice: withCoins && {
      cost: withCoins.cost,
      coins: withCoins.coins,
      affordable: open && canAfford(world.materials, withCoins.cost) && coins >= withCoins.coins
    },
    coinsFromTier: index.coinsFromTier,
    effect: groupEffect(building.upgradeId, level),
    nextEffect: groupEffect(building.upgradeId, level + 1)
  }
}

/** The way to the next stage: the building levels it needs past this one's threshold. */
const nextStageView = (next, reached, { stage, count }) =>
  ({ kind: 'stage', ...stageView(next, reached.stage + 1, count), have: reached.total - stage.from, need: next.from - stage.from })

/** Past the last stage, the way to the next renovation star. */
const nextStarView = (reached, { last, index }) => ({
  kind: 'star',
  stars: reached.stars + 1,
  from: last.from + (reached.stars + 1) * index.renovationEvery,
  have: (reached.total - last.from) % index.renovationEvery,
  need: index.renovationEvery
})

/**
 * The view of a world's settlement, or null when the content has none.
 *
 * @param {object} world
 * @param {object} content the game content
 * @returns {object | null}
 */
export function settlementView(world, content) {
  const index = settlementIndexOf(content)
  if (!index) return null
  const reached = settlementOf(world, index)
  const count = index.stages.length
  const stage = index.stages[reached.stage]
  const next = index.stages[reached.stage + 1] ?? null
  const last = index.stages.at(-1)
  return {
    total: reached.total,
    stage: stageView(stage, reached.stage, count),
    // The way to the next stage, or past the last to the next renovation star.
    next: next ? nextStageView(next, reached, { stage, count }) : nextStarView(reached, { last, index }),
    stars: reached.stars,
    renovationEvery: index.renovationEvery,
    bonuses: stageBonuses(index, reached.stage).map((effect) => ({ ...effect })),
    stages: index.stages.map((entry, at) =>
      ({ id: entry.id, name: entry.name, from: entry.from, art: entry.art, reached: at <= reached.stage })),
    buildings: reached.buildings.map((entry) => buildingView(world, entry, index))
  }
}
