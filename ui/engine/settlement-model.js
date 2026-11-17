// What the Camp tab's settlement shows, worked out from the view state: the hero picture and the
// way to the next stage, each building card's pictures, words and state, and the badge above the
// tabs. Never touches the DOM.
import { formatShare } from './game-format.js'
import { SETTLEMENT, buildingEffectText } from './settlement-labels.js'

/** The next tier's picture is shown, faded, as a teaser this many levels before it is reached. */
export const TEASER_LEVELS = 2

/**
 * The address of a picture the view state names (`ui/settlement/...`), from the transport's base.
 *
 * @param {string} base
 * @param {string} path
 */
export const settlementArtUrl = (base, path) => `${base}${path}`

/**
 * The hero: the stage's picture with its name and number, the bar to the next stage (or, past the
 * last, to the next renovation star) and the bonuses reached.
 *
 * @param {object} settlement a world's `settlement` in the view state
 */
export function heroModel(settlement) {
  const { stage, next, total } = settlement
  const isStar = next.kind === 'star'
  return {
    stageId: stage.id,
    art: stage.art,
    alt: SETTLEMENT.heroAlt(stage.alt, stage.name, stage.number, stage.count),
    name: stage.name,
    stageText: SETTLEMENT.stageOf(stage.number, stage.count),
    stars: settlement.stars,
    share: next.need > 0 ? Math.min(1, Math.max(0, next.have / next.need)) : 1,
    progressText: isStar ? SETTLEMENT.toStar(next.have, next.need) : SETTLEMENT.toStage(total, next.from, next.name)
  }
}

/**
 * A building card: its pictures, words, and whether and how it can be built.
 *
 * @param {object} building one of a world's `settlement.buildings`
 */
export function buildingModel(building) {
  const next = building.nextTier
  const isBuilt = building.level > 0
  const levelsToNext = next ? next.from - building.level : null
  return {
    key: building.upgradeId,
    name: building.name,
    tierName: isBuilt ? building.current.name : SETTLEMENT.notBuilt,
    tierText: isBuilt ? SETTLEMENT.tierOf(building.tier, building.tierCount) : null,
    levelText: SETTLEMENT.level(building.level),
    sprite: building.current.art,
    isBuilt,
    // An unbuilt building is its first tier, faded; a built one shows the next tier when it is near.
    teaser: isBuilt && next && levelsToNext <= TEASER_LEVELS ? { art: next.art, name: next.name } : null,
    nextTierText: isBuilt && next ? SETTLEMENT.nextTier(next.name, levelsToNext) : null,
    isOpen: building.open,
    lockedText: building.open ? null : SETTLEMENT.opensAt(building.opensAt.name, building.opensAt.from),
    nowText: isBuilt ? buildingEffectText(building.upgradeId, building.effect, formatShare) : SETTLEMENT.notBuilt,
    nextText: buildingEffectText(building.upgradeId, building.nextEffect, formatShare)
  }
}

/**
 * The badge above the tabs: the stage's name and picture, or null without a settlement.
 *
 * @param {object | null | undefined} world
 */
export function badgeModel(world) {
  const settlement = world?.settlement
  if (!settlement) return null
  return {
    art: settlement.stage.art,
    name: settlement.stage.name,
    stars: settlement.stars,
    label: SETTLEMENT.badgeOpen(settlement.stage.name)
  }
}

/** The prices the Camp tab shows: every open building's, for the strip to mark what they lack. */
export const campCosts = (world) => (world?.settlement
  ? world.settlement.buildings.filter((building) => building.open).map((building) => building.cost)
  : (world?.upgrades ?? []).map((upgrade) => upgrade.cost))
