// What a character's traits are and what they do. A character is born with one trait, rolled from
// its session id, and earns more slots at level milestones; the traits it carries are kept on it
// only once a person changed them, so a save from before traits has every character's first trait
// and slots worked out the same way. The effects join the character's legendary equipment's,
// after the traits' own cap (TRAIT_EFFECT_CAPS), and then every source's sum is capped by
// LEGENDARY_EFFECT_CAPS as before. Pure.
import { hashOf } from './hash.mjs'
import {
  BORN_TIER_WEIGHTS,
  MAX_TRAIT_SLOTS,
  TRAIT_EFFECT_CAPS,
  TRAIT_SLOT_LEVELS,
  TRAIT_TIERS
} from './trait-constants.mjs'
import { traitIndexOf } from './trait-content.mjs'

/** @typedef {import('./trait-content.mjs').TraitIndex} TraitIndex */
/** @typedef {import('./legendary-effects.mjs').Effect} Effect */

/** The trait types that act on the party or the world instead of on the character. */
const PARTY_TYPES = new Set(['raceDrop', 'scrollFind', 'brokerDiscount'])

/**
 * How many traits a character of this level carries at most: one from birth, one more at each
 * milestone of TRAIT_SLOT_LEVELS.
 *
 * @param {number} level
 */
export const traitSlots = (level) => 1 + TRAIT_SLOT_LEVELS.filter((milestone) => level >= milestone).length

/**
 * The level at which a character of this level earns its next slot, or null when it has them all.
 *
 * @param {number} level
 */
export const nextSlotLevel = (level) => TRAIT_SLOT_LEVELS.find((milestone) => level < milestone) ?? null

/**
 * A key of `weights` picked by hash, in the tiers' order so the same seed always gives the same.
 *
 * @param {Record<string, number>} weights
 * @param {string} seed
 * @returns {string}
 */
export function pickTier(weights, seed) {
  const tiers = TRAIT_TIERS.filter((tier) => (weights[tier] ?? 0) > 0)
  const total = tiers.reduce((sum, tier) => sum + weights[tier], 0)
  let roll = hashOf(seed) % total
  for (const tier of tiers) {
    if (roll < weights[tier]) return tier
    roll -= weights[tier]
  }
  return tiers[0]
}

/**
 * A trait of a tier picked by hash, from those `allowed` lets through; the tier below when that
 * one has none left, then above. Null when none is allowed at all.
 *
 * @param {TraitIndex} index
 * @param {string} tier
 * @param {string} seed
 * @param {(entry: object) => boolean} [allowed]
 */
export function pickTrait(index, tier, seed, allowed = () => true) {
  const at = TRAIT_TIERS.indexOf(tier)
  const order = [at, ...TRAIT_TIERS.map((_, other) => other).filter((other) => other !== at)
    .sort((a, b) => Math.abs(a - at) - Math.abs(b - at) || a - b)]
  for (const tierAt of order) {
    const pool = index.byTier[TRAIT_TIERS[tierAt]].filter(allowed)
    if (pool.length) return pool[hashOf(`${seed}|pick`) % pool.length]
  }
  return null
}

/**
 * The trait a session's character is born with: a tier by BORN_TIER_WEIGHTS, a trait of it, both by
 * hash of the session id. The same session always has the same one, before or after a reload.
 *
 * @param {string} sessionId
 * @param {TraitIndex} index
 * @returns {string | null}
 */
export function bornTrait(sessionId, index) {
  const tier = pickTier(BORN_TIER_WEIGHTS, `${sessionId}|trait-tier`)
  return pickTrait(index, tier, `${sessionId}|trait`, (entry) => entry.tier !== 'mythic')?.id ?? null
}

/**
 * The traits a character carries, in slot order: those a person set, or its born trait. Ids the
 * content no longer has are left out.
 *
 * @param {{ sessionId: string, traits?: string[] }} character
 * @param {TraitIndex | null} index
 * @returns {string[]}
 */
export function traitsOf(character, index) {
  if (!index || !character) return []
  if (Array.isArray(character.traits)) return character.traits.filter((id) => index.byId.has(id))
  const born = bornTrait(character.sessionId, index)
  return born ? [born] : []
}

/**
 * Effects with each type's positive sum brought down to `caps`, every positive amount of a type
 * shrunk by the same share; drawbacks stay as they are.
 *
 * @param {Effect[]} effects
 * @param {Record<string, number>} caps
 * @returns {Effect[]}
 */
export function cappedEffects(effects, caps) {
  const sums = new Map()
  for (const effect of effects) {
    if (effect.amount > 0) sums.set(effect.effect, (sums.get(effect.effect) ?? 0) + effect.amount)
  }
  return effects.map((effect) => {
    const sum = sums.get(effect.effect) ?? 0
    const cap = caps[effect.effect]
    return effect.amount > 0 && sum > cap ? { ...effect, amount: (effect.amount * cap) / sum } : effect
  })
}

/** Whether a character is one the room keeps: a guest, never saved, carries no trait. */
const isMember = (project, character) => Boolean(character?.sessionId && project?.characters &&
  Object.hasOwn(project.characters, character.sessionId))

/** Every effect of a list of trait ids, uncapped. */
const effectsOfTraits = (ids, index) => ids.flatMap((id) => index.byId.get(id)?.effects ?? [])

/**
 * What a character's traits do to it, under the traits' own cap: the effects that act on it as its
 * equipment's do. A guest (a character not in the room's save) carries none.
 *
 * @param {{ characters: Record<string, object> }} project
 * @param {object} character
 * @param {object} content the game content
 * @returns {Effect[]}
 */
export function traitEffectsOf(project, character, content) {
  const index = traitIndexOf(content)
  if (!index || !isMember(project, character)) return []
  const own = effectsOfTraits(traitsOf(character, index), index).filter((effect) => !PARTY_TYPES.has(effect.effect))
  return cappedEffects(own, TRAIT_EFFECT_CAPS)
}

/**
 * A character's legendary equipment's effects with its traits' added: what the fight, gathering
 * and tokens read as the effects it holds.
 *
 * @param {Effect[]} held
 * @param {object} project
 * @param {object} character
 * @param {object} content
 * @returns {Effect[]}
 */
export function withTraitEffects(held, project, character, content) {
  const traits = traitEffectsOf(project, character, content)
  return traits.length ? [...held, ...traits] : held
}

/** The capped sum of one type among effects that apply. */
function cappedTotal(effects, type, applies = () => true) {
  const sum = effects.filter((effect) => effect.effect === type && applies(effect)).reduce((total, effect) => total + effect.amount, 0)
  return Math.max(0, Math.min(TRAIT_EFFECT_CAPS[type], sum))
}

/**
 * What the traits of a fighting party's members add to the party: a better item drop against some
 * races, and a better chance of a trait scroll.
 *
 * @param {object} project
 * @param {object[]} characters the working members' characters
 * @param {object} content
 * @returns {{ raceDrop: (race: string | null) => number, scrollFind: number }}
 */
export function traitPartyBonuses(project, characters, content) {
  const index = traitIndexOf(content)
  if (!index) return { raceDrop: () => 0, scrollFind: 0 }
  const own = characters.filter((character) => isMember(project, character))
  const effects = effectsOfTraits(own.flatMap((character) => traitsOf(character, index)), index)
  return {
    raceDrop: (race) => (race ? cappedTotal(effects, 'raceDrop', (effect) => effect.races.includes(race)) : 0),
    scrollFind: cappedTotal(effects, 'scrollFind')
  }
}

/**
 * The share the world's trait brokers take off their prices, from the traits of every living
 * character of the world.
 *
 * @param {{ projects: Record<string, { characters: Record<string, object> }> }} world
 * @param {TraitIndex | null} index
 * @returns {number} from 0 to TRAIT_EFFECT_CAPS.brokerDiscount
 */
export function brokerDiscountOf(world, index) {
  if (!index || !world) return 0
  const ids = Object.values(world.projects).flatMap((project) =>
    Object.values(project.characters).flatMap((character) => traitsOf(character, index)))
  return cappedTotal(effectsOfTraits(ids, index), 'brokerDiscount')
}

export { MAX_TRAIT_SLOTS }
