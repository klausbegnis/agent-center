// What a world can buy with its materials: item upgrades and the three group upgrades, their costs
// and effects, and the autoSpend policy that buys the best affordable purchase repeatedly.
import {
  CAMPFIRE_HALF,
  CAMPFIRE_MAX,
  GROUP_COST_BASE,
  GROUP_COST_GROWTH,
  GROUP_LEVELS_PER_WORLD_LEVEL,
  GROUP_UPGRADES,
  REWARD_GROWTH,
  RUNE_CIRCLE_HALF,
  RUNE_CIRCLE_MAX,
  SPEND_MAX_PURCHASES,
  SPEND_WEIGHTS
} from './constants.mjs'
import { canAfford, payFor, upgradeCost } from './items.mjs'
import { worldLevel } from './progression.mjs'

/** The group upgrade ids, in the order they are shown and tried. */
export const GROUP_UPGRADE_IDS = Object.freeze(Object.keys(GROUP_UPGRADES))

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
function purchasesOf(world) {
  const workbenchLevel = groupLevel(world.upgrades, 'workbench')
  const level = worldLevel(world.skills)
  const purchases = []
  for (const projectId of Object.keys(world.projects).sort()) {
    for (const item of itemsInUse(world.projects[projectId])) {
      const cost = upgradeCost(item, { workbenchLevel, worldLevel: level })
      purchases.push({ kind: item.slot, projectId, itemId: item.id, cost })
    }
  }
  for (const upgradeId of GROUP_UPGRADE_IDS) {
    const cost = groupUpgradeCost(upgradeId, groupLevel(world.upgrades, upgradeId), level)
    purchases.push({ kind: 'group', upgradeId, cost })
  }
  return purchases
}

const scoreOf = (purchase) =>
  Object.values(purchase.cost).reduce((sum, amount) => sum + amount, 0) / SPEND_WEIGHTS[purchase.kind]

/**
 * The best purchase the world can afford now: the lowest cost per SPEND_WEIGHTS of its kind.
 *
 * @param {object} world
 * @returns {object | null} `{ kind, cost, projectId?, itemId?, upgradeId? }`
 */
export function bestAffordablePurchase(world) {
  let best = null
  for (const purchase of purchasesOf(world)) {
    if (!canAfford(world.materials, purchase.cost)) continue
    if (!best || scoreOf(purchase) < scoreOf(best)) best = purchase
  }
  return best
}

/**
 * Pays for a purchase and applies it to the world.
 *
 * @param {object} world
 * @param {object} purchase from `bestAffordablePurchase`, or built by the caller
 * @returns {object} the new world, or the same one when it cannot pay
 */
export function applyPurchase(world, purchase) {
  if (!canAfford(world.materials, purchase.cost)) return world
  const materials = payFor(world.materials, purchase.cost)
  if (purchase.kind === 'group') {
    const level = groupLevel(world.upgrades, purchase.upgradeId) + 1
    return { ...world, materials, upgrades: { ...world.upgrades, [purchase.upgradeId]: level } }
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
 * @returns {{ world: object, purchases: object[] }}
 */
export function spendWorld(world) {
  let current = world
  const purchases = []
  while (purchases.length < SPEND_MAX_PURCHASES) {
    const purchase = bestAffordablePurchase(current)
    if (!purchase) break
    current = applyPurchase(current, purchase)
    purchases.push(purchase)
  }
  return { world: current, purchases }
}
