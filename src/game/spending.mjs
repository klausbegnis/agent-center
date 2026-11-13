// What a world can buy with its materials: item upgrades and the three group upgrades, their costs
// and effects, and the autoSpend policy that buys the best affordable purchase repeatedly.
import { bestFreeItem } from './chest.mjs'
import {
  CAMPFIRE_STEP,
  GROUP_COST_BASE,
  GROUP_COST_GROWTH,
  GROUP_UPGRADES,
  RUNE_CIRCLE_STEP,
  SPEND_MAX_PURCHASES,
  SPEND_WEIGHTS
} from './constants.mjs'
import { canAfford, payFor, upgradeCost } from './items.mjs'

/** The group upgrade ids, in the order they are shown and tried. */
export const GROUP_UPGRADE_IDS = Object.freeze(Object.keys(GROUP_UPGRADES))

/**
 * @param {Record<string, number>} upgrades a world's group upgrade levels
 * @param {string} upgradeId
 * @returns {number}
 */
export const groupLevel = (upgrades, upgradeId) => upgrades?.[upgradeId] ?? 0

/**
 * The materials the next level of a group upgrade costs: GROUP_COST_BASE * GROUP_COST_GROWTH **
 * level of each of its two recipe materials, rounded.
 *
 * @param {string} upgradeId one of GROUP_UPGRADE_IDS
 * @param {number} level the level it has now
 * @returns {Record<string, number>}
 */
export function groupUpgradeCost(upgradeId, level) {
  const amount = Math.round(GROUP_COST_BASE * GROUP_COST_GROWTH ** level)
  return Object.fromEntries(GROUP_UPGRADES[upgradeId].recipe.map((materialId) => [materialId, amount]))
}

/**
 * The share of its missing stamina a party gets back after each kill.
 *
 * @param {number} level the campfire's level
 * @returns {number}
 */
export const campfireShare = (level) => 1 - (1 - CAMPFIRE_STEP) ** level

/**
 * The share of its health every new monster starts without.
 *
 * @param {number} level the rune circle's level
 * @returns {number}
 */
export const runeCircleShare = (level) => 1 - (1 - RUNE_CIRCLE_STEP) ** level

/**
 * The items of a project worth upgrading: those a living character holds, and the best free item
 * of each slot and weapon damage type, which the next character will take.
 *
 * @param {object} project
 * @returns {object[]}
 */
export function itemsInUse(project) {
  const wanted = [
    { slot: 'weapon', damageType: 'physical' },
    { slot: 'weapon', damageType: 'magical' },
    { slot: 'outfit' },
    { slot: 'tool' }
  ]
  const nextIds = new Set(wanted.map((which) => bestFreeItem(project.chest, which)?.id).filter(Boolean))
  return project.chest.filter((item) => item.heldBy !== null || nextIds.has(item.id))
}

/** Every purchase a world could make now, affordable or not, in a stable order. */
function purchasesOf(world) {
  const workbenchLevel = groupLevel(world.upgrades, 'workbench')
  const purchases = []
  for (const projectId of Object.keys(world.projects).sort()) {
    for (const item of itemsInUse(world.projects[projectId])) {
      const cost = upgradeCost(item, { workbenchLevel })
      purchases.push({ kind: item.slot, projectId, itemId: item.id, cost })
    }
  }
  for (const upgradeId of GROUP_UPGRADE_IDS) {
    const cost = groupUpgradeCost(upgradeId, groupLevel(world.upgrades, upgradeId))
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
