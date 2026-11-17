// A world's settlement: its group upgrades seen as buildings (game/settlement.json). A building's
// tier follows its level, the settlement's stage follows the total of all building levels, and
// past the last stage every few levels earn a renovation star, which changes nothing but the
// picture. Nothing here is stored: it is all worked out from the levels the world keeps. Pure.
import { GROUP_UPGRADES } from './constants.mjs'

/** @typedef {import('./settlement-content.mjs').SettlementIndex} SettlementIndex */
/** @typedef {import('./settlement-content.mjs').Building} Building */

/**
 * The total of all building levels: what the stage follows.
 *
 * @param {Record<string, number> | undefined} upgrades a world's group upgrade levels
 * @returns {number}
 */
export const totalLevels = (upgrades) =>
  Object.keys(GROUP_UPGRADES).reduce((sum, upgradeId) => sum + (upgrades?.[upgradeId] ?? 0), 0)

/**
 * The tier a building's level reaches: 0 before it is built, then 1 up to the number of tiers.
 *
 * @param {Building} building
 * @param {number} level
 * @returns {number}
 */
export function tierOf(building, level) {
  let tier = 0
  for (const [at, entry] of building.tiers.entries()) if (level >= entry.from) tier = at + 1
  return tier
}

/**
 * The stage a total of building levels reaches, as an index into the stages: the first is reached
 * from 0, so every world is at least at the first.
 *
 * @param {SettlementIndex} index
 * @param {number} total
 * @returns {number}
 */
export function stageIndexOf(index, total) {
  let stage = 0
  for (const [at, entry] of index.stages.entries()) if (total >= entry.from) stage = at
  return stage
}

/**
 * Renovation stars: one for every `renovationEvery` building levels past the last stage's
 * threshold. A picture's banner, nothing more.
 *
 * @param {SettlementIndex} index
 * @param {number} total
 * @returns {number}
 */
export function renovationStars(index, total) {
  const past = total - index.stages.at(-1).from
  return past > 0 ? Math.floor(past / index.renovationEvery) : 0
}

/**
 * Whether a world may build a group upgrade now. Every building opens at a stage; without a
 * settlement in the content only the upgrades every world always had are open.
 *
 * @param {{ upgrades?: Record<string, number> }} world
 * @param {string} upgradeId
 * @param {SettlementIndex | null} index
 * @param {readonly string[]} alwaysOpen the upgrades that need no settlement
 * @returns {boolean}
 */
export function isBuildingOpen(world, upgradeId, index, alwaysOpen) {
  const building = index?.byUpgrade.get(upgradeId)
  if (!building) return alwaysOpen.includes(upgradeId)
  return stageIndexOf(index, totalLevels(world.upgrades)) >= building.opensAt
}

/**
 * A world's settlement as plain numbers: the total of building levels, the stage reached, the
 * renovation stars and each building's level and tier.
 *
 * @param {{ upgrades?: Record<string, number> }} world
 * @param {SettlementIndex} index
 * @returns {{ total: number, stage: number, stars: number,
 *   buildings: { building: Building, level: number, tier: number }[] }}
 */
export function settlementOf(world, index) {
  const total = totalLevels(world.upgrades)
  return {
    total,
    stage: stageIndexOf(index, total),
    stars: renovationStars(index, total),
    buildings: index.buildings.map((building) => {
      const level = world.upgrades?.[building.upgradeId] ?? 0
      return { building, level, tier: tierOf(building, level) }
    })
  }
}

/**
 * What a change to the save reached in each world's settlement, for the bridge to celebrate: a
 * building's new tier (the highest, when one change lifts it several), a new stage, and new
 * renovation stars. Levels only fall when a world starts over, which is no news.
 *
 * @param {{ worlds: Record<string, object> }} before
 * @param {{ worlds: Record<string, object> }} after
 * @param {SettlementIndex | null} index
 * @returns {object[]} `{ type: 'settlement', worldId, kind: 'tier' | 'stage' | 'stars', ... }`
 */
export function settlementNews(before, after, index) {
  if (!index || before === after) return []
  const news = []
  for (const worldId of Object.keys(after.worlds).sort()) {
    const world = after.worlds[worldId]
    const earlier = Object.hasOwn(before.worlds, worldId) ? before.worlds[worldId] : null
    if (earlier?.upgrades === world.upgrades) continue
    const was = settlementOf(earlier ?? { upgrades: {} }, index)
    const now = settlementOf(world, index)
    now.buildings.forEach(({ building, tier }, at) => {
      if (tier <= was.buildings[at].tier) return
      news.push({ type: 'settlement', worldId, kind: 'tier', buildingId: building.id, upgradeId: building.upgradeId,
        tier, name: building.tiers[tier - 1].name, building: building.name })
    })
    if (now.stage > was.stage) {
      const stage = index.stages[now.stage]
      news.push({ type: 'settlement', worldId, kind: 'stage', stage: now.stage, stageId: stage.id, name: stage.name })
    }
    if (now.stars > was.stars) news.push({ type: 'settlement', worldId, kind: 'stars', stars: now.stars })
  }
  return news
}
