// What a room's legendary loot does: the active relic's effect on the whole party, and each piece
// of legendary equipment's effect on the living character holding it (or, for a party quantity,
// on its party while it fights). Turns the effects into the numbers the fight, gathering, tokens
// and prices use. Effects of different sources add; each type's sum is capped by
// LEGENDARY_EFFECT_CAPS. Pure.
import { findItem } from './chest.mjs'
import { LEGENDARY_EFFECT_CAPS, REST_SECONDS, TICK_SECONDS } from './constants.mjs'
import { indexLegendary } from './legendary-content.mjs'

/** @typedef {import('./legendary-content.mjs').LegendaryIndex} LegendaryIndex */
/** @typedef {{ effect: string, scope: string, amount: number, damageType?: string, ranks?: string[],
 *   materials?: string[], skill?: string }} Effect */

const indexes = new WeakMap()

/**
 * The legendary index of a set of content, built once per content file.
 *
 * @param {{ legendary?: { legendary: object[] } } | null | undefined} content
 * @returns {LegendaryIndex | null} null when the content has no legendary loot
 */
export function legendaryIndexOf(content) {
  const data = content?.legendary
  if (!data) return null
  if (!indexes.has(data)) indexes.set(data, indexLegendary(data))
  return indexes.get(data)
}

/**
 * The room's active relic, or null: none chosen, or one the content no longer has.
 *
 * @param {{ legendary?: { active?: string | null } }} project
 * @param {LegendaryIndex | null} index
 * @returns {object | null} the content entry
 */
export function activeRelicOf(project, index) {
  const active = project?.legendary?.active
  if (!index || typeof active !== 'string' || !index.relicIds.has(active)) return null
  return index.byId.get(active)
}

/**
 * @param {object} project
 * @param {LegendaryIndex | null} index
 * @returns {Effect[]} the active relic's effect, or none
 */
export function relicEffects(project, index) {
  const relic = activeRelicOf(project, index)
  return relic ? [relic.effect] : []
}

/**
 * The effects of the legendary equipment a character holds now.
 *
 * @param {{ chest: object[] }} project
 * @param {{ equipment?: Record<string, string | null> } | null} character
 * @param {LegendaryIndex | null} index
 * @returns {Effect[]}
 */
export function heldEffects(project, character, index) {
  if (!index || !character?.equipment) return []
  const effects = []
  for (const itemId of Object.values(character.equipment)) {
    const item = itemId ? findItem(project.chest, itemId) : null
    const entry = item?.legendary ? index.byId.get(item.entryId) : null
    if (entry?.kind === 'equipment') effects.push(entry.effect)
  }
  return effects
}

/**
 * The capped sum of the amounts of one effect type among effects that apply.
 *
 * @param {Effect[]} effects
 * @param {string} type
 * @param {(effect: Effect) => boolean} [applies]
 * @returns {number}
 */
export function totalOf(effects, type, applies = () => true) {
  const sum = effects.filter((effect) => effect.effect === type && applies(effect))
    .reduce((total, effect) => total + effect.amount, 0)
  return Math.min(LEGENDARY_EFFECT_CAPS[type], sum)
}

/** Whether an effect that may name materials covers this one: no list means every material. */
const coversMaterial = (material) => (effect) => !effect.materials || effect.materials.includes(material)

/** A damage effect counts for a hit of this type, against a monster of one of `ranks` or of any. */
const damageApplies = (damageType, rank) => (effect) =>
  (!effect.damageType || effect.damageType === damageType) && (!effect.ranks || effect.ranks.includes(rank))

/**
 * What a fighting member's own legendary effects and the relic's do to its hit.
 *
 * @param {Effect[]} relic the relic's effects
 * @param {Effect[]} held the member's equipment's effects
 * @returns {{ critChance: number, critDamage: number, auraFactor: number, healingFactor: number,
 *   outfitFactor: number, hitFactor: (damageType: string, rank: string | null) => number }}
 */
export function memberBonuses(relic, held) {
  const both = [...relic, ...held]
  const speed = 1 + totalOf(both, 'attackSpeed')
  return {
    critChance: totalOf(held, 'critChance'),
    critDamage: totalOf(relic, 'critDamage'),
    auraFactor: 1 + totalOf(held, 'supportAura'),
    healingFactor: 1 + totalOf(held, 'healing'),
    outfitFactor: 1 + totalOf(held, 'outfitStamina'),
    hitFactor: (damageType, rank) => speed * (1 + totalOf(both, 'damage', damageApplies(damageType, rank)))
  }
}

/**
 * The ranks some relic damage effect is limited to, which a party's hits must be worked out for
 * separately. Empty for most relics.
 *
 * @param {Effect[]} relic
 * @returns {string[]}
 */
export function rankedDamageRanks(relic) {
  return [...new Set(relic.filter((effect) => effect.effect === 'damage' && effect.ranks).flatMap((effect) => effect.ranks))]
}

/**
 * @typedef {{ drainFactor: number, poolFactor: number, restTicks: number, staminaPerKill: number,
 *   affixWeakening: number, thorns: number, itemDrop: number, killMaterials: Effect[] }} PartyBonuses
 */

/**
 * What the relic and the equipment of the working members do to the party as a whole: how much
 * stamina monsters drain, the pool, the rest, stamina after a kill, affixes, thorns, item drops and
 * kill materials.
 *
 * @param {Effect[]} relic
 * @param {Effect[][]} heldByMember the effects each working member's equipment has
 * @returns {PartyBonuses}
 */
export function partyBonuses(relic, heldByMember) {
  const drainers = [...relic, ...heldByMember.flat().filter((effect) => effect.effect === 'staminaDrain')]
  const restSeconds = Math.max(TICK_SECONDS, REST_SECONDS - totalOf(relic, 'restTime'))
  return {
    drainFactor: 1 - totalOf(drainers, 'staminaDrain'),
    poolFactor: 1 + totalOf(relic, 'staminaPool'),
    restTicks: Math.ceil(restSeconds / TICK_SECONDS),
    staminaPerKill: totalOf(relic, 'staminaPerKill'),
    affixWeakening: totalOf(relic, 'affixWeakening'),
    thorns: totalOf(relic, 'thorns'),
    itemDrop: totalOf(relic, 'itemDrop'),
    killMaterials: relic.filter((effect) => effect.effect === 'killMaterials')
  }
}

/**
 * A kill's materials with the relic's extra share of the materials it names, rounded.
 *
 * @param {Record<string, number>} materials
 * @param {Effect[]} effects killMaterials effects
 * @returns {Record<string, number>}
 */
export function withKillMaterials(materials, effects) {
  if (effects.length === 0) return materials
  return Object.fromEntries(Object.entries(materials).map(([material, amount]) =>
    [material, Math.round(amount * (1 + totalOf(effects, 'killMaterials', coversMaterial(material))))]))
}

/**
 * What a gathering character gets from the relic and its own equipment: extra hours after the
 * last tokens, a factor on the units of its material and one on the trade's experience.
 *
 * @param {Effect[]} relic
 * @param {Effect[]} held
 * @param {string} material what the character's trade gathers
 * @returns {{ extraHours: number, yieldFactor: number, xpFactor: number }}
 */
export function gatherBonuses(relic, held, material) {
  return {
    extraHours: totalOf(relic, 'gatherHours'),
    yieldFactor: 1 + totalOf([...relic, ...held], 'gatherYield', coversMaterial(material)),
    xpFactor: 1 + totalOf(relic, 'gatherXp')
  }
}

/**
 * What a character's tokens are worth more: its own experience (the relic) and the experience of
 * the work skill they train (its equipment).
 *
 * @param {Effect[]} relic
 * @param {Effect[]} held
 * @param {string | null} skillId the work skill the tokens train
 * @returns {{ characterFactor: number, skillFactor: number }}
 */
export function tokenBonuses(relic, held, skillId) {
  return {
    characterFactor: 1 + totalOf(relic, 'characterXp'),
    skillFactor: 1 + totalOf(held, 'skillXp', (effect) => effect.skill === skillId)
  }
}

/**
 * The share item upgrades in the room cost less, from its relic.
 *
 * @param {object} project
 * @param {LegendaryIndex | null} index
 * @returns {number} from 0
 */
export const upgradeDiscountOf = (project, index) => totalOf(relicEffects(project, index), 'upgradeCost')

/**
 * The factor on the rune circle's health cut, from the room's relic.
 *
 * @param {object} project
 * @param {LegendaryIndex | null} index
 * @returns {number} from 1
 */
export const runeCircleFactorOf = (project, index) => 1 + totalOf(relicEffects(project, index), 'runeCircle')
