// What a world's bestiary gives: for each race, damage against it per mastery level and its own
// small perk every few levels, up to its last powered level (prestige past it gives nothing more);
// for the world's hunter rank, a small bonus that grows ever slower; for the boss hunter, the
// effects of each level reached. All of them are effects of the closed set legendary loot uses (scope `world`),
// which act on every party of the world beside the room's active relic and are summed with it
// and with legendary equipment under LEGENDARY_EFFECT_CAPS (legendary-effects.mjs). Pure.
import { bestiaryIndexOf } from './bestiary-content.mjs'
import { hunterLevelOf, hunterRankOf, masteryOf } from './bestiary.mjs'

/** @typedef {import('./legendary-effects.mjs').Effect} Effect */

/** An effect given `times` times: one effect with the amount multiplied. */
const times = (effect, count) => ({ ...effect, amount: effect.amount * count })

/**
 * What a race's mastery level gives: damage against that race for every powered level, and its
 * perk once every `perkEvery` levels. None at level 0; past the powered levels, no more.
 *
 * @param {import('./bestiary-content.mjs').BestiaryIndex} index
 * @param {string} raceId
 * @param {number} level
 * @returns {Effect[]}
 */
export function raceMasteryEffects(index, raceId, level) {
  const race = index.races.get(raceId)
  if (!race || level <= 0) return []
  const powered = Math.min(level, index.levels)
  const effects = [{ ...times(index.perLevel, powered), races: [raceId] }]
  const perks = Math.floor(powered / index.perkEvery)
  if (perks > 0) effects.push(times(race.perk, perks))
  return effects
}

/**
 * What the boss hunter's level gives: the effects of every level up to it.
 *
 * @param {import('./bestiary-content.mjs').BestiaryIndex} index
 * @param {number} level
 * @returns {Effect[]}
 */
export const hunterEffects = (index, level) => index.hunter.levels.slice(0, level).flat().map((effect) => ({ ...effect }))

/**
 * What the world's hunter rank gives: its effect's amount × r / (r + half), so it never passes
 * the amount however far the rank goes. None at rank 0.
 *
 * @param {import('./bestiary-content.mjs').BestiaryIndex} index
 * @param {number} rank
 * @returns {Effect[]}
 */
export function rankEffects(index, rank) {
  if (rank <= 0) return []
  return [times(index.rank.effect, rank / (rank + index.rank.half))]
}

/**
 * Every effect a world's bestiary gives now, uncapped (the caps apply where they are summed).
 *
 * @param {object | null | undefined} bestiary the world's counters
 * @param {import('./bestiary-content.mjs').BestiaryIndex | null} index
 * @returns {Effect[]}
 */
export function bestiaryEffects(bestiary, index) {
  if (!index || !bestiary) return []
  const races = index.raceIds.flatMap((raceId) => raceMasteryEffects(index, raceId, masteryOf(bestiary, raceId, index)))
  return [...races, ...rankEffects(index, hunterRankOf(bestiary, index)), ...hunterEffects(index, hunterLevelOf(bestiary, index))]
}

/** The effects worked out for a bestiary, by its counters (a new object after every kill) and index. */
const worked = new WeakMap()

/**
 * The effects a world's bestiary gives every party of the world, worked out once per state of its
 * counters. None without a bestiary in the content or before the world's first kill.
 *
 * @param {{ bestiary?: object } | null | undefined} world
 * @param {object} [content] the game content
 * @returns {Effect[]}
 */
export function worldEffectsOf(world, content) {
  const index = bestiaryIndexOf(content)
  const bestiary = world?.bestiary
  if (!index || !bestiary) return []
  const known = worked.get(bestiary)
  if (known?.index === index) return known.effects
  const effects = bestiaryEffects(bestiary, index)
  worked.set(bestiary, { index, effects })
  return effects
}
