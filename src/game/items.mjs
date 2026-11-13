// Owned items: what a tier and an upgrade level are worth, what an upgrade costs and paying for
// it. Stats are computed here; the item entries in game/items.json carry no numbers.
import {
  GEAR_GROWTH,
  REFERENCE_GEAR_PER_LEVEL,
  REWARD_GROWTH,
  TIER_LEVELS,
  UPGRADE_COST_BASE,
  UPGRADE_COST_GROWTH,
  WORKBENCH_DISCOUNT_PER_LEVEL
} from './constants.mjs'

/**
 * The upgrade levels the reference party's gear is worth at a level. Fractional: the reference
 * keeps up smoothly instead of in steps.
 *
 * @param {number} level a monster's or a world's level
 * @returns {number}
 */
export function referenceGearLevel(level) {
  return REFERENCE_GEAR_PER_LEVEL * level
}

/**
 * An item's power in upgrade levels: its own level plus TIER_LEVELS for each tier above the
 * first. Effect and upgrade cost both follow it, so a tier is a head start, never a trap.
 *
 * @param {{ tier: number, level: number }} item
 * @returns {number}
 */
export function effectiveGearLevel(item) {
  return item.level + TIER_LEVELS * (item.tier - 1)
}

/**
 * What an item's tier multiplies its effect by: `GEAR_GROWTH ** (TIER_LEVELS * (tier - 1))`, so
 * tier 1 gives 1.
 *
 * @param {number} tier 1 to 10
 * @returns {number}
 */
export function tierFactor(tier) {
  return GEAR_GROWTH ** (TIER_LEVELS * (tier - 1))
}

/**
 * What an owned item multiplies its effect by: `GEAR_GROWTH ** effectiveGearLevel`. No item at
 * all gives 1, the same as a tier 1 item at level 0.
 *
 * @param {{ tier: number, level: number } | null} item
 * @returns {number}
 */
export function itemFactor(item) {
  if (!item) return 1
  return GEAR_GROWTH ** effectiveGearLevel(item)
}

/**
 * An owned item at level 0, free in the chest, made from a content entry.
 *
 * @param {{ id: string, slot: string, damageType?: string, tier: number, recipe: string[] }} entry
 * @returns {{ id: string, entryId: string, slot: string, damageType?: string, tier: number,
 *   recipe: string[], level: number, heldBy: null }}
 */
export function createItem(entry) {
  const item = { id: entry.id, entryId: entry.id, slot: entry.slot }
  if (entry.slot === 'weapon') item.damageType = entry.damageType
  return { ...item, tier: entry.tier, recipe: [...entry.recipe], level: 0, heldBy: null }
}

/**
 * The materials one upgrade of the item costs: the same amount of each of its two recipe
 * materials, `UPGRADE_COST_BASE * REWARD_GROWTH ** worldLevel * UPGRADE_COST_GROWTH **
 * (effectiveGearLevel - referenceGearLevel(worldLevel))`, divided by `1 +
 * WORKBENCH_DISCOUNT_PER_LEVEL * workbenchLevel`, rounded, at least 1.
 *
 * @param {{ tier: number, level: number, recipe: string[] }} item
 * @param {{ workbenchLevel?: number, worldLevel?: number }} [options]
 * @returns {Record<string, number>}
 */
export function upgradeCost(item, { workbenchLevel = 0, worldLevel = 0 } = {}) {
  const discount = 1 / (1 + WORKBENCH_DISCOUNT_PER_LEVEL * workbenchLevel)
  const ahead = effectiveGearLevel(item) - referenceGearLevel(worldLevel)
  const full = UPGRADE_COST_BASE * REWARD_GROWTH ** worldLevel * UPGRADE_COST_GROWTH ** ahead
  const amount = Math.max(1, Math.round(full * discount))
  return Object.fromEntries(item.recipe.map((materialId) => [materialId, amount]))
}

/**
 * @param {Record<string, number>} materials what is in stock
 * @param {Record<string, number>} cost
 * @returns {boolean}
 */
export function canAfford(materials, cost) {
  return Object.entries(cost).every(([materialId, amount]) => (materials[materialId] ?? 0) >= amount)
}

/**
 * The materials left once the cost is paid. Throws when the stock does not cover it.
 *
 * @param {Record<string, number>} materials
 * @param {Record<string, number>} cost
 * @returns {Record<string, number>}
 */
export function payFor(materials, cost) {
  if (!canAfford(materials, cost)) throw new Error('not enough materials for this cost')
  const left = { ...materials }
  for (const [materialId, amount] of Object.entries(cost)) left[materialId] = (left[materialId] ?? 0) - amount
  return left
}

/**
 * The item one upgrade level higher. Paying for it is the caller's job (`upgradeCost`, `payFor`).
 *
 * @template {{ level: number }} Item
 * @param {Item} item
 * @returns {Item}
 */
export function upgradeItem(item) {
  return { ...item, level: item.level + 1 }
}
