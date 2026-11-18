// game/traits.json: the trait catalogue. Checks the file (`validateTraits`) and indexes it once per
// content (`traitIndexOf`). A trait is a small named perk with one effect and, for a few, a small
// drawback; its effect uses the same types as relics and equipment, plus three of its own. Pure.
import { MONSTER_RANKS } from './constants.mjs'
import { MATERIALS, WORK_SKILLS } from './skills.mjs'
import { BROKER_OFFERS, BROKER_TIER_WEIGHTS, TRAIT_EFFECT_CAPS, TRAIT_TIERS } from './trait-constants.mjs'

/** The fewest traits the catalogue holds: a collection, not a handful. */
export const MIN_TRAITS = 40

/**
 * The effect types a trait may have, with their qualifiers. All but the last three act on the
 * character carrying the trait as legendary equipment acts on its holder; `raceDrop` (item drops
 * against some races) and `scrollFind` (trait scrolls dropping) act on the party while the
 * character fights, `brokerDiscount` on the world's trait broker while the character lives.
 */
export const TRAIT_EFFECT_TYPES = Object.freeze({
  damage: ['damageType', 'ranks'],
  attackSpeed: [],
  critChance: [],
  staminaDrain: [],
  outfitStamina: [],
  healing: [],
  supportAura: [],
  gatherYield: ['materials'],
  skillXp: ['skill'],
  characterXp: [],
  raceDamage: ['races'],
  raceDrop: ['races'],
  scrollFind: [],
  brokerDiscount: []
})
/** What a drawback may take away: a little of something every character has, never more than half a cap. */
export const DRAWBACK_TYPES = Object.freeze(['damage', 'attackSpeed', 'critChance', 'staminaDrain', 'gatherYield', 'characterXp'])

/** The families a trait's icon is drawn for. */
export const TRAIT_FAMILIES = Object.freeze(['might', 'haste', 'edge', 'guard', 'mend', 'harvest', 'study', 'hunter',
  'fortune', 'trade'])

const TRAIT_KEYS = ['id', 'name', 'tier', 'family', 'city', 'effect', 'drawback', 'flavour']
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/
const DAMAGE_TYPES = ['physical', 'magical']

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isFilledString = (value) => typeof value === 'string' && value.trim() !== ''
const isDistinctList = (value, allowed) => Array.isArray(value) && value.length > 0 &&
  value.every((item) => allowed.includes(item)) && new Set(value).size === value.length

/** Problems of an effect's qualifiers: only its type's, each well formed. */
function qualifierProblems(name, effect, raceIds) {
  const known = ['effect', 'amount', ...TRAIT_EFFECT_TYPES[effect.effect]]
  const problems = Object.keys(effect).filter((key) => !known.includes(key))
    .map((key) => `${name}: "${key}" is not a qualifier of ${effect.effect}`)
  if (effect.damageType !== undefined && !DAMAGE_TYPES.includes(effect.damageType)) {
    problems.push(`${name}: "damageType" must be physical or magical`)
  }
  if (effect.ranks !== undefined && !isDistinctList(effect.ranks, Object.keys(MONSTER_RANKS))) {
    problems.push(`${name}: "ranks" must list distinct ranks`)
  }
  if (effect.materials !== undefined && !isDistinctList(effect.materials, MATERIALS)) {
    problems.push(`${name}: "materials" must list distinct materials`)
  }
  if (effect.effect === 'skillXp' && !WORK_SKILLS.includes(effect.skill)) {
    problems.push(`${name}: "skill" must be a work skill`)
  }
  const needsRaces = TRAIT_EFFECT_TYPES[effect.effect].includes('races')
  if (needsRaces && !isDistinctList(effect.races, raceIds ?? effect.races ?? [])) {
    problems.push(`${name}: "races" must list distinct races of game/races.json`)
  }
  return problems
}

/** Problems of a trait's effect: a known type, an amount above 0 and within the traits' cap. */
function effectProblems(name, effect, raceIds) {
  if (!isObject(effect) || !Object.hasOwn(TRAIT_EFFECT_TYPES, effect.effect ?? '')) {
    return [`${name}: "effect.effect" must be one of: ${Object.keys(TRAIT_EFFECT_TYPES).join(', ')}`]
  }
  const cap = TRAIT_EFFECT_CAPS[effect.effect]
  const amountOk = typeof effect.amount === 'number' && effect.amount > 0 && effect.amount <= cap
  return [...(amountOk ? [] : [`${name}: its amount must be above 0 and at most ${cap}`]),
    ...qualifierProblems(`${name} effect`, effect, raceIds)]
}

/** Problems of a drawback: a type every character has, an amount below 0 and at most half its cap. */
function drawbackProblems(name, drawback) {
  if (drawback === undefined) return []
  if (!isObject(drawback) || !DRAWBACK_TYPES.includes(drawback.effect)) {
    return [`${name}: "drawback.effect" must be one of: ${DRAWBACK_TYPES.join(', ')}`]
  }
  const problems = Object.keys(drawback).filter((key) => key !== 'effect' && key !== 'amount')
    .map((key) => `${name}: a drawback has no "${key}"`)
  const limit = TRAIT_EFFECT_CAPS[drawback.effect] / 2
  if (!(typeof drawback.amount === 'number' && drawback.amount < 0 && -drawback.amount <= limit)) {
    problems.push(`${name}: a drawback's amount must be below 0 and take at most ${limit}`)
  }
  return problems
}

function traitProblems(trait, { cityIds, raceIds, seen }) {
  if (!isObject(trait)) return ['every trait must be an object']
  const name = isFilledString(trait.id) ? `trait "${trait.id}"` : 'a trait'
  const problems = Object.keys(trait).filter((key) => !TRAIT_KEYS.includes(key))
    .map((key) => `${name}: "${key}" is not a field of a trait`)
  if (!isFilledString(trait.id) || !KEBAB_CASE.test(trait.id)) problems.push(`${name}: "id" must be kebab-case`)
  else if (seen.has(trait.id)) problems.push(`${name}: the id is used twice`)
  seen.add(trait.id)
  if (!isFilledString(trait.name)) problems.push(`${name}: "name" must be a name`)
  if (!isFilledString(trait.flavour)) problems.push(`${name}: "flavour" must be a line`)
  if (!TRAIT_TIERS.includes(trait.tier)) problems.push(`${name}: "tier" must be one of: ${TRAIT_TIERS.join(', ')}`)
  if (!TRAIT_FAMILIES.includes(trait.family)) problems.push(`${name}: "family" must be one of: ${TRAIT_FAMILIES.join(', ')}`)
  // Mythic traits are never sold, so they have no city; every other trait has the city that sells it.
  if (trait.tier === 'mythic' && trait.city !== undefined) problems.push(`${name}: a mythic trait has no city`)
  if (trait.tier !== 'mythic' && !(cityIds ?? [trait.city]).includes(trait.city)) {
    problems.push(`${name}: "city" must be a city of game/cities.json`)
  }
  return [...problems, ...effectProblems(name, trait.effect, raceIds), ...drawbackProblems(name, trait.drawback)]
}

function tierProblems(tiers) {
  if (!Array.isArray(tiers) || tiers.length !== TRAIT_TIERS.length) return [`"tiers" must list ${TRAIT_TIERS.join(', ')}`]
  return tiers.flatMap((tier, at) => {
    const problems = []
    if (!isObject(tier) || tier.id !== TRAIT_TIERS[at]) return [`"tiers" must list ${TRAIT_TIERS.join(', ')} in that order`]
    if (!isFilledString(tier.name)) problems.push(`tier "${tier.id}": "name" must be a name`)
    if (!HEX_COLOUR.test(tier.colour ?? '')) problems.push(`tier "${tier.id}": "colour" must be #rrggbb`)
    return problems
  })
}

/** A broker fills its day only with enough traits of its city in the tiers it sells. */
function brokerProblems(traits, cityIds) {
  if (!cityIds) return []
  return cityIds.flatMap((cityId) => {
    const sold = traits.filter((trait) => trait.city === cityId && Object.hasOwn(BROKER_TIER_WEIGHTS, trait.tier))
    return sold.length >= BROKER_OFFERS ? [] : [`the city "${cityId}" needs at least ${BROKER_OFFERS} traits to sell`]
  })
}

/**
 * Every problem of a traits file.
 *
 * @param {unknown} data the parsed game/traits.json
 * @param {{ cities?: { cities: { id: string }[] } | null, races?: { races: { id: string }[] } | null }} [others]
 *   the cities and races a trait may name; without them any name passes
 * @returns {string[]}
 */
export function validateTraits(data, { cities = null, races = null } = {}) {
  if (!isObject(data)) return ['must be an object with "tiers" and "traits"']
  if (!Array.isArray(data.traits)) return ['"traits" must be a list']
  const cityIds = cities?.cities?.map((city) => city.id) ?? null
  const raceIds = races?.races?.map((race) => race.id) ?? null
  const seen = new Set()
  const problems = [...tierProblems(data.tiers), ...data.traits.flatMap((trait) => traitProblems(trait, { cityIds, raceIds, seen }))]
  if (data.traits.length < MIN_TRAITS) problems.push(`"traits" must hold at least ${MIN_TRAITS} traits`)
  return [...problems, ...brokerProblems(data.traits, cityIds)]
}

/**
 * @typedef {{ id: string, name: string, tier: string, family: string, city?: string, flavour: string,
 *   effect: object, drawback?: object, effects: object[] }} TraitEntry `effects` the effect and the
 *   drawback as the effect functions take them
 * @typedef {{ byId: Map<string, TraitEntry>, ids: string[], byTier: Record<string, TraitEntry[]>,
 *   tiers: object[] }} TraitIndex
 */

/**
 * @param {{ tiers: object[], traits: object[] }} data a valid traits file
 * @returns {TraitIndex}
 */
export function indexTraits(data) {
  const entries = data.traits.map((trait) => ({
    ...trait,
    effects: [trait.effect, ...(trait.drawback ? [trait.drawback] : [])].map((effect) => ({ ...effect, scope: 'trait' }))
  }))
  const byTier = Object.fromEntries(TRAIT_TIERS.map((tier) => [tier, entries.filter((entry) => entry.tier === tier)]))
  return { byId: new Map(entries.map((entry) => [entry.id, entry])), ids: entries.map((entry) => entry.id), byTier, tiers: data.tiers }
}

const indexes = new WeakMap()

/**
 * The trait index of a set of content, built once per content file.
 *
 * @param {{ traits?: { traits: object[] } } | null | undefined} content
 * @returns {TraitIndex | null} null when the content has no traits
 */
export function traitIndexOf(content) {
  const data = content?.traits
  if (!data) return null
  if (!indexes.has(data)) indexes.set(data, indexTraits(data))
  return indexes.get(data)
}
