// Building a level of the settlement by hand: in materials alone, or partly in coins from the tier
// the settlement names (spending.mjs, `coinPrice`). autoSpend builds with materials alone and never
// comes here. Pure: each function returns a new save, or the same one when nothing can be built.
import { worldLevel } from './progression.mjs'
import { applyPurchase, coinPrice, groupLevel, groupUpgradeCost, isUpgradeOpen } from './spending.mjs'

/** @typedef {import('./settlement-content.mjs').SettlementIndex} SettlementIndex */

/**
 * The next level of a building and its two prices: in materials alone, and with coins once the
 * building takes them (null before).
 *
 * @param {object} world
 * @param {string} upgradeId
 * @param {SettlementIndex | null} settlement
 * @returns {{ level: number, cost: Record<string, number>, withCoins: { cost: Record<string, number>, coins: number } | null }}
 */
export function buildingPrices(world, upgradeId, settlement) {
  const level = groupLevel(world.upgrades, upgradeId)
  const cost = groupUpgradeCost(upgradeId, level, worldLevel(world.skills))
  return { level, cost, withCoins: coinPrice(cost, upgradeId, level, settlement) }
}

/**
 * Why a building's next level cannot be bought this way now, or null. It says nothing of what the
 * world can pay: a price it cannot pay leaves the save unchanged.
 *
 * @param {object} save
 * @param {{ worldId: string, upgradeId: string, useCoins?: boolean }} which
 * @param {SettlementIndex | null} settlement
 * @returns {string | null}
 */
export function buildingProblem(save, { worldId, upgradeId, useCoins = false }, settlement) {
  const world = Object.hasOwn(save.worlds, worldId) ? save.worlds[worldId] : null
  if (!world) return 'unknown world'
  if (!isUpgradeOpen(world, upgradeId, settlement)) return 'not open at this stage of the settlement'
  if (useCoins === true && !buildingPrices(world, upgradeId, settlement).withCoins) return 'takes no coins at this tier'
  return null
}

/**
 * Buys the next level of a group upgrade (a building of the settlement) for a world, in materials
 * alone or, with `useCoins`, partly in coins once the building has reached the tier that allows it.
 * Unchanged when it cannot pay, the building is not open yet, or coins were asked for and the
 * building takes none yet.
 *
 * @param {object} save
 * @param {{ worldId: string, upgradeId: string, useCoins?: boolean }} which `upgradeId` one of
 *   GROUP_UPGRADE_IDS
 * @param {SettlementIndex | null} settlement
 * @returns {object}
 */
export function buyGroupUpgrade(save, { worldId, upgradeId, useCoins = false }, settlement) {
  if (buildingProblem(save, { worldId, upgradeId, useCoins }, settlement)) return save
  const world = save.worlds[worldId]
  const { cost, withCoins } = buildingPrices(world, upgradeId, settlement)
  const next = applyPurchase(world, { kind: 'group', upgradeId, ...(useCoins === true ? withCoins : { cost }) })
  return next === world ? save : { ...save, worlds: { ...save.worlds, [worldId]: next } }
}
