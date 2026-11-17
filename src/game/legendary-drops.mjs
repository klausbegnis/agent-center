// Legendary drops: what a boss kill leaves beyond its loot. A boss wave's boss can drop a pool
// relic (one a city sells), and a named boss its own relic or legendary equipment. Every roll is a
// hash of the kill's seed, so the same room, wave and kill always drop the same thing. Pure.
import { addToChest } from './chest.mjs'
import {
  BOSS_ITEM_CHANCE,
  BOSS_ITEM_PITY_STEP,
  LEGENDARY_PITY_MAX,
  RELIC_CHANCE,
  RELIC_PITY_STEP,
  TIER_LEVELS
} from './constants.mjs'
import { dropTier } from './drops.mjs'
import { chanceOf, hashOf } from './hash.mjs'
import { referenceGearLevel } from './items.mjs'
import { legendaryItems, legendaryOf, ownsLegendary, withLegendary, withRelic } from './legendary.mjs'
import { rankOf } from './monsters.mjs'

/** @typedef {{ id: string, kind: string }} LegendaryDrop */

const bumpPity = (count) => Math.min(LEGENDARY_PITY_MAX, count + 1)

/**
 * A piece of legendary equipment as it drops: the tier a drop of the boss's level has, with the
 * upgrade levels that tier lacks to reach the reference gear, so it is ready to use at once.
 *
 * @param {object} entry the equipment's content entry
 * @param {number} level the boss's level
 * @returns {object} a chest item marked `legendary`
 */
export function legendaryItemFor(entry, level) {
  const tier = dropTier(level)
  const upgrades = Math.max(0, Math.round(referenceGearLevel(level)) - TIER_LEVELS * (tier - 1))
  const item = { id: entry.id, entryId: entry.id, slot: entry.slot }
  if (entry.slot === 'weapon') item.damageType = entry.damageType
  return { ...item, tier, recipe: [...entry.recipe], level: upgrades, heldBy: null, legendary: true }
}

/** Whether a room owns any relic or boss-owned item: until it does, its first one is certain. */
const ownsBossItem = (project, index) =>
  legendaryOf(project).relics.some((id) => index.byId.get(id)?.kind === 'boss-relic') || legendaryItems(project).length > 0

/** The pool relic roll: a relic the room lacks, or a step of pity. */
export function rollPoolRelic(project, { rank, seed, index, pityFactor }) {
  const legendary = legendaryOf(project)
  const missing = index.poolRelicIds.filter((id) => !ownsLegendary(project, id))
  if (missing.length === 0) return { project, drop: null }
  const chance = legendary.relics.length === 0 ? 1 : RELIC_CHANCE[rank] + RELIC_PITY_STEP * pityFactor * legendary.relicPity
  if (chanceOf(`${seed}|relic`) >= chance) {
    return { project: withLegendary(project, { ...legendary, relicPity: bumpPity(legendary.relicPity) }), drop: null }
  }
  const relicId = missing[hashOf(`${seed}|relic-pick`) % missing.length]
  const gained = withRelic(project, relicId)
  return { project: withLegendary(gained, { ...legendaryOf(gained), relicPity: 0 }), drop: { id: relicId, kind: 'relic' } }
}

/**
 * The named boss's own item roll: its relic or equipment when the room lacks it, or pity.
 * `chance` replaces the rank's (an instance's boss gives its item more often, instance-rewards.mjs).
 *
 * @returns {{ project: object, drop: LegendaryDrop | null }}
 */
export function rollBossItem(project, { rank, seed, index, bossId, level, pityFactor = 1, chance: own }) {
  const entry = index.byBoss.get(bossId)
  if (!entry || ownsLegendary(project, entry.id)) return { project, drop: null }
  const legendary = legendaryOf(project)
  const base = own ?? BOSS_ITEM_CHANCE[rank]
  const chance = ownsBossItem(project, index) ? base + BOSS_ITEM_PITY_STEP * pityFactor * legendary.bossPity : 1
  if (chanceOf(`${seed}|boss-item`) >= chance) {
    return { project: withLegendary(project, { ...legendary, bossPity: bumpPity(legendary.bossPity) }), drop: null }
  }
  const gained = entry.kind === 'equipment'
    ? { ...project, chest: addToChest(project.chest, legendaryItemFor(entry, level)) }
    : withRelic(project, entry.id)
  return { project: withLegendary(gained, { ...legendaryOf(gained), bossPity: 0 }), drop: { id: entry.id, kind: entry.kind } }
}

/**
 * What a kill leaves of legendary loot. Only a boss wave's boss (rank `boss` or `legendary`) rolls:
 * first for a pool relic (RELIC_CHANCE by rank plus pity; certain while the room owns no relic),
 * then, for a boss of the roster with an item the room lacks, for that item (BOSS_ITEM_CHANCE by
 * rank plus pity; certain while the room owns no boss-owned item). A relic gained first is active.
 *
 * @param {object} project the project after the kill's loot
 * @param {{ monster: object, seed: string, index: import('./legendary-content.mjs').LegendaryIndex | null,
 *   pityFactor?: number }} kill `seed` is the kill's, the one its item drop uses; `pityFactor` what
 *   each step of pity is worth, from 1 (the bestiary's boss hunter makes it more)
 * @returns {{ project: object, drops: LegendaryDrop[] }} the same project when nothing changed
 */
export function rollLegendaryDrops(project, { monster, seed, index, pityFactor = 1 }) {
  const rank = rankOf(monster)
  if (!index || monster.kind !== 'boss' || !Object.hasOwn(RELIC_CHANCE, rank)) return { project, drops: [] }
  const relic = rollPoolRelic(project, { rank, seed, index, pityFactor })
  const bossItem = rollBossItem(relic.project, { rank, seed, index, bossId: monster.id, level: monster.level, pityFactor })
  return { project: bossItem.project, drops: [relic.drop, bossItem.drop].filter(Boolean) }
}
