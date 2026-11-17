// What a world's settlement gives: the Storehouse's lower market fee and the Defences' lighter
// monster strikes, which grow with their levels towards a ceiling, and the small bonus of every
// stage the settlement has reached. All of them are effects of the closed set legendary loot uses
// (scope `world`), summed with the relic, the equipment and the bestiary under
// LEGENDARY_EFFECT_CAPS (legendary-effects.mjs). Pure.
import {
  DEFENCES_DRAIN_HALF,
  DEFENCES_DRAIN_MAX,
  MARKET_FEE,
  STOREHOUSE_FEE_HALF,
  STOREHOUSE_FEE_MAX
} from './constants.mjs'
import { totalOf } from './legendary-effects.mjs'
import { stageIndexOf, totalLevels } from './settlement.mjs'

/** @typedef {import('./legendary-effects.mjs').Effect} Effect */

/** MAX * L / (L + HALF): ever closer to MAX, never past it; 0 before the first level. */
const approaching = (max, half, level) => (level > 0 ? (max * level) / (level + half) : 0)

/**
 * What the Storehouse and the Defences give at their levels, uncapped.
 *
 * @param {Record<string, number> | undefined} upgrades a world's group upgrade levels
 * @returns {Effect[]}
 */
export function buildingEffects(upgrades) {
  const effects = []
  const storehouse = upgrades?.storehouse ?? 0
  const defences = upgrades?.defences ?? 0
  if (storehouse > 0) {
    const amount = approaching(STOREHOUSE_FEE_MAX, STOREHOUSE_FEE_HALF, storehouse)
    effects.push({ effect: 'marketFee', scope: 'world', amount })
  }
  if (defences > 0) {
    const amount = approaching(DEFENCES_DRAIN_MAX, DEFENCES_DRAIN_HALF, defences)
    effects.push({ effect: 'staminaDrain', scope: 'world', amount })
  }
  return effects
}

/**
 * The bonuses of every stage up to `stage`: a stage's bonus stays once it is reached.
 *
 * @param {import('./settlement-content.mjs').SettlementIndex} index
 * @param {number} stage a stage index
 * @returns {Effect[]}
 */
export const stageBonuses = (index, stage) => index.stages.slice(0, stage + 1).flatMap((entry) => entry.bonus)

/**
 * Every effect a world's settlement gives now: its buildings' and its stages'.
 *
 * @param {{ upgrades?: Record<string, number> }} world
 * @param {import('./settlement-content.mjs').SettlementIndex | null} index without a settlement in
 *   the content there are no stages, and the two buildings that need one are never built
 * @returns {Effect[]}
 */
export function settlementEffects(world, index) {
  const buildings = buildingEffects(world.upgrades)
  if (!index) return buildings
  return [...buildings, ...stageBonuses(index, stageIndexOf(index, totalLevels(world.upgrades)))]
}

/**
 * The market's fee for a world: MARKET_FEE less what its Storehouse takes off, capped.
 *
 * @param {{ upgrades?: Record<string, number> }} world
 * @returns {number}
 */
export const marketFeeOf = (world) => MARKET_FEE - totalOf(buildingEffects(world?.upgrades), 'marketFee')
