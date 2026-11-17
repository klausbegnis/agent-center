// What a world can buy with its materials: item upgrades and the group upgrades (the settlement's
// buildings, settlement.mjs), their costs and effects, and the autoSpend policy that buys the best
// affordable purchase repeatedly.
import {
  CAMPFIRE_HALF,
  CAMPFIRE_MAX,
  GROUP_COST_BASE,
  GROUP_COST_GROWTH,
  GROUP_LEVELS_PER_WORLD_LEVEL,
  GROUP_UPGRADES,
  MATERIAL_BASE_VALUES,
  REWARD_GROWTH,
  RUNE_CIRCLE_HALF,
  RUNE_CIRCLE_MAX,
  SETTLEMENT_COIN_SHARE,
  SPEND_MAX_PURCHASES,
  SPEND_WEIGHTS
} from './constants.mjs'
import { canAfford, payFor, upgradeCost } from './items.mjs'
import { upgradeDiscountOf } from './legendary-effects.mjs'
import { worldLevel } from './progression.mjs'
import { isBuildingOpen, tierOf } from './settlement.mjs'

/** The group upgrade ids, in the order they are shown and tried. */
export const GROUP_UPGRADE_IDS = Object.freeze(Object.keys(GROUP_UPGRADES))
/** The group upgrades every world can build, with or without a settlement in the content. */
export const ALWAYS_OPEN_UPGRADE_IDS = Object.freeze(GROUP_UPGRADE_IDS.filter((id) => !GROUP_UPGRADES[id].settlementOnly))

/**
 * Whether a world may build a group upgrade now: it is open at the settlement's stage.
 *
 * @param {object} world
 * @param {string} upgradeId
 * @param {import('./settlement-content.mjs').SettlementIndex | null} [settlement]
 * @returns {boolean}
 */
export const isUpgradeOpen = (world, upgradeId, settlement = null) =>
  GROUP_UPGRADE_IDS.includes(upgradeId) && isBuildingOpen(world, upgradeId, settlement, ALWAYS_OPEN_UPGRADE_IDS)

/**
 * @param {Record<string, number>} upgrades a world's group upgrade levels
 * @param {string} upgradeId
 * @returns {number}
 */
export const groupLevel = (upgrades, upgradeId) => upgrades?.[upgradeId] ?? 0

/**
 * The materials the next level of a group upgrade costs, priced against the world like items:
 * GROUP_COST_BASE * REWARD_GROWTH ** worldLevel * GROUP_COST_GROWTH ** (level -
 * GROUP_LEVELS_PER_WORLD_LEVEL * worldLevel) of each of its two recipe materials, rounded, at
 * least 1.
 *
 * @param {string} upgradeId one of GROUP_UPGRADE_IDS
 * @param {number} level the level it has now
 * @param {number} [worldLevelNow] the world's level
 * @returns {Record<string, number>}
 */
export function groupUpgradeCost(upgradeId, level, worldLevelNow = 0) {
  const ahead = level - GROUP_LEVELS_PER_WORLD_LEVEL * worldLevelNow
  const full = GROUP_COST_BASE * REWARD_GROWTH ** worldLevelNow * GROUP_COST_GROWTH ** ahead
  const amount = Math.max(1, Math.round(full))
  return Object.fromEntries(GROUP_UPGRADES[upgradeId].recipe.map((materialId) => [materialId, amount]))
}

/**
 * A building level's price with part of it in coins, once the building has reached the tier the
 * settlement names (`coinsFromTier`): SETTLEMENT_COIN_SHARE of each material, rounded down, is
 * paid instead at its base value in coins. Buying those materials at a market always costs more
 * than their base value, so this is the cheaper way to turn coins into a building. The price in
 * materials alone stays on offer.
 *
 * @param {Record<string, number>} cost the price in materials alone
 * @param {string} upgradeId
 * @param {number} level the level the building has now
 * @param {import('./settlement-content.mjs').SettlementIndex | null} settlement
 * @returns {{ cost: Record<string, number>, coins: number } | null} null before that tier, or
 *   without a settlement
 */
export function coinPrice(cost, upgradeId, level, settlement) {
  const building = settlement?.byUpgrade.get(upgradeId)
  if (!building || tierOf(building, level) < settlement.coinsFromTier) return null
  const materials = {}
  let coins = 0
  for (const [materialId, amount] of Object.entries(cost)) {
    const replaced = Math.floor(amount * SETTLEMENT_COIN_SHARE)
    materials[materialId] = amount - replaced
    coins += replaced * MATERIAL_BASE_VALUES[materialId]
  }
  return coins > 0 ? { cost: materials, coins } : null
}

/**
 * The share of its missing stamina a party gets back after each kill.
 *
 * @param {number} level the campfire's level
 * @returns {number}
 */
export const campfireShare = (level) => (CAMPFIRE_MAX * level) / (level + CAMPFIRE_HALF)

/**
 * The share of its health every new monster starts without.
 *
 * @param {number} level the rune circle's level
 * @returns {number}
 */
export const runeCircleShare = (level) => (RUNE_CIRCLE_MAX * level) / (level + RUNE_CIRCLE_HALF)

/**
 * The items of a project worth upgrading: those a living character holds.
 *
 * @param {object} project
 * @returns {object[]}
 */
export function itemsInUse(project) {
  return project.chest.filter((item) => item.heldBy !== null)
}

/** Every purchase a world could make now, affordable or not, in a stable order. */
function purchasesOf(world, index, worldEffects, settlement) {
  const workbenchLevel = groupLevel(world.upgrades, 'workbench')
  const level = worldLevel(world.skills)
  const purchases = []
  for (const projectId of Object.keys(world.projects).sort()) {
    const relicDiscount = upgradeDiscountOf(world.projects[projectId], index, worldEffects)
    for (const item of itemsInUse(world.projects[projectId])) {
      const cost = upgradeCost(item, { workbenchLevel, worldLevel: level, relicDiscount })
      purchases.push({ kind: item.slot, projectId, itemId: item.id, cost })
    }
  }
  for (const upgradeId of GROUP_UPGRADE_IDS.filter((id) => isUpgradeOpen(world, id, settlement))) {
    const cost = groupUpgradeCost(upgradeId, groupLevel(world.upgrades, upgradeId), level)
    purchases.push({ kind: 'group', upgradeId, cost })
  }
  return purchases
}

/** What autoSpend weighs a purchase by: its kind's, or a group upgrade's own when it has one. */
const weightOf = (purchase) =>
  (purchase.kind === 'group' ? GROUP_UPGRADES[purchase.upgradeId].spendWeight : undefined) ?? SPEND_WEIGHTS[purchase.kind]

const scoreOf = (purchase) => Object.values(purchase.cost).reduce((sum, amount) => sum + amount, 0) / weightOf(purchase)

/**
 * The best purchase the world can afford now: the lowest cost per SPEND_WEIGHTS of its kind.
 *
 * @param {object} world
 * @param {import('./legendary-content.mjs').LegendaryIndex | null} [index] for relics that make
 *   a room's upgrades cheaper
 * @param {import('./legendary-effects.mjs').Effect[]} [worldEffects] the world's bestiary's, which
 *   can make them cheaper too
 * @param {import('./settlement-content.mjs').SettlementIndex | null} [settlement] which buildings
 *   are open
 * @returns {object | null} `{ kind, cost, projectId?, itemId?, upgradeId? }`
 */
export function bestAffordablePurchase(world, index = null, worldEffects = [], settlement = null) {
  let best = null
  for (const purchase of purchasesOf(world, index, worldEffects, settlement)) {
    if (!canAfford(world.materials, purchase.cost)) continue
    if (!best || scoreOf(purchase) < scoreOf(best)) best = purchase
  }
  return best
}

/**
 * Pays for a purchase and applies it to the world.
 *
 * @param {object} world
 * @param {object} purchase from `bestAffordablePurchase`, or built by the caller; `coins`, when
 *   given, are paid from the world's coins as well
 * @returns {object} the new world, or the same one when it cannot pay
 */
export function applyPurchase(world, purchase) {
  const coins = purchase.coins ?? 0
  if (!canAfford(world.materials, purchase.cost) || !((world.coins ?? 0) >= coins)) return world
  const materials = payFor(world.materials, purchase.cost)
  if (purchase.kind === 'group') {
    const level = groupLevel(world.upgrades, purchase.upgradeId) + 1
    const paid = coins > 0 ? { coins: world.coins - coins } : {}
    return { ...world, materials, ...paid, upgrades: { ...world.upgrades, [purchase.upgradeId]: level } }
  }
  const project = world.projects[purchase.projectId]
  const upgrade = (item) => (item.id === purchase.itemId ? { ...item, level: item.level + 1 } : item)
  const chest = project.chest.map(upgrade)
  return { ...world, materials, projects: { ...world.projects, [purchase.projectId]: { ...project, chest } } }
}

/**
 * Buys the best affordable purchase again and again, up to SPEND_MAX_PURCHASES.
 *
 * @param {object} world
 * @param {import('./legendary-content.mjs').LegendaryIndex | null} [index]
 * @param {import('./legendary-effects.mjs').Effect[]} [worldEffects] the world's bestiary's
 * @param {import('./settlement-content.mjs').SettlementIndex | null} [settlement]
 * @returns {{ world: object, purchases: object[] }}
 */
export function spendWorld(world, index = null, worldEffects = [], settlement = null) {
  let current = world
  const purchases = []
  while (purchases.length < SPEND_MAX_PURCHASES) {
    const purchase = bestAffordablePurchase(current, index, worldEffects, settlement)
    if (!purchase) break
    current = applyPurchase(current, purchase)
    purchases.push(purchase)
  }
  return { world: current, purchases }
}
