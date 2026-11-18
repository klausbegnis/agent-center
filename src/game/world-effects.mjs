// The effects a world gives every party in it, from three sources: its bestiary (bestiary-effects.mjs),
// its settlement (settlement-effects.mjs) and the week's event (weekly.mjs). They join each room's relic wherever that is read,
// and every type's sum is capped by LEGENDARY_EFFECT_CAPS. Worked out once per state of the
// bestiary's counters and of the building levels, since the fight asks for them every tick. Pure.
import { worldEffectsOf as bestiaryWorldEffects } from './bestiary-effects.mjs'
import { settlementIndexOf } from './settlement-content.mjs'
import { settlementEffects } from './settlement-effects.mjs'
import { weeklyEffectsOf } from './weekly.mjs'

/** @typedef {import('./legendary-effects.mjs').Effect} Effect */

/** By the world's levels object (a new one after every purchase): its effects and what they came from. */
const worked = new WeakMap()
/** The key of a world that has bought nothing yet. */
const NO_UPGRADES = {}

/**
 * Every effect a world gives the parties in it: its bestiary's, its settlement's and its week's event's.
 *
 * @param {{ bestiary?: object, upgrades?: Record<string, number> } | null | undefined} world
 * @param {object} [content] the game content
 * @returns {Effect[]}
 */
export function worldEffectsOf(world, content) {
  const standing = standingEffectsOf(world, content)
  const weekly = weeklyEffectsOf(world, content)
  // A new list each call: a cache keyed on the standing list played a world with another's week.
  return weekly.length ? [...standing, ...weekly] : standing
}

/** The bestiary's and the settlement's effects, which last from week to week. */
function standingEffectsOf(world, content) {
  if (!world) return []
  const bestiary = bestiaryWorldEffects(world, content)
  const index = settlementIndexOf(content)
  const key = world.upgrades ?? NO_UPGRADES
  const known = worked.get(key)
  const sameBestiary = known && (known.bestiary === bestiary || (known.bestiary.length === 0 && bestiary.length === 0))
  if (sameBestiary && known.index === index) return known.effects
  const settlement = settlementEffects(world, index)
  const effects = settlement.length ? [...bestiary, ...settlement] : bestiary
  worked.set(key, { bestiary, index, effects })
  return effects
}
