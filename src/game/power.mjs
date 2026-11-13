// How hard characters hit: one character's hit per tick, a party's hits after its auras, and
// the reference party that monster health is measured against.
import {
  ATTRIBUTE_HIT_BONUS,
  BASE_HIT,
  CLASS_HIT,
  CRIT_BASE,
  CRIT_DAMAGE,
  CRIT_MAX,
  CRIT_PER_PRECISION,
  FULL_PARTY_BONUS,
  FULL_PARTY_CLASSES,
  GEAR_LEVEL_BONUS,
  HASTE_PER_AGILITY,
  PACE_MAX,
  PACE_MIN,
  POWER_GROWTH,
  REFERENCE_TOKENS_PER_MINUTE,
  SEASONED_LEVEL,
  SKILL_CAP,
  SUPPORT_AURA
} from './constants.mjs'
import { seasoning, startingAttributes } from './characters.mjs'
import { effectiveLevel, emptySkill } from './progression.mjs'
import { CLASSES, attributeOfClass, skillOfClass } from './skills.mjs'

/** The reference party's weapon gains one upgrade level every this many monster levels. */
const REFERENCE_LEVELS_PER_WEAPON_LEVEL = 5

/**
 * @typedef {import('./characters.mjs').Character} Character
 * @typedef {import('./progression.mjs').Skill} Skill
 * @typedef {{ amount: number, type: 'physical' | 'magical' }} Hit
 * @typedef {{ physical: number, magical: number, total: number }} PartyHits
 */

/**
 * @param {number} tokensPerMinute
 * @returns {number} how fast the agent works compared with a normal pace, within the limits
 */
export function pace(tokensPerMinute) {
  if (!Number.isFinite(tokensPerMinute)) return PACE_MIN
  return Math.min(PACE_MAX, Math.max(PACE_MIN, tokensPerMinute / REFERENCE_TOKENS_PER_MINUTE))
}

/**
 * @param {number} precision
 * @returns {number}
 */
export function critChance(precision) {
  return Math.min(CRIT_MAX, CRIT_BASE + CRIT_PER_PRECISION * precision)
}

/**
 * @param {{ character: Character, skills: { [skillId: string]: Skill }, weaponFactor?: number,
 *   tokensPerMinute: number }} options `weaponFactor` is the weapon's upgrade and tier factor
 * @returns {Hit}
 */
export function characterHit({ character, skills, weaponFactor = 1, tokensPerMinute }) {
  const className = character.class
  const { attributes } = character
  const classSkill = skills[skillOfClass(className)] ?? emptySkill()
  const amount =
    BASE_HIT *
    POWER_GROWTH ** effectiveLevel(classSkill) *
    (1 + ATTRIBUTE_HIT_BONUS * (attributes[attributeOfClass(className)] ?? 0)) *
    weaponFactor *
    seasoning(character.level) *
    CLASS_HIT[className] *
    pace(tokensPerMinute) *
    (1 + critChance(attributes.precision ?? 0) * (CRIT_DAMAGE - 1)) *
    (1 + HASTE_PER_AGILITY * (attributes.agility ?? 0))
  return { amount, type: className === 'magical' ? 'magical' : 'physical' }
}

/**
 * Sums a party's hits. A member gets the support aura when another member is a support (one
 * aura at most), and everyone gets the full party bonus when enough distinct classes fight.
 *
 * @param {{ class: string, amount: number, type: 'physical' | 'magical' }[]} members
 * @returns {PartyHits}
 */
export function partyHits(members) {
  const supports = members.filter((member) => member.class === 'support').length
  const isFullParty = new Set(members.map((member) => member.class)).size >= FULL_PARTY_CLASSES
  const totals = { physical: 0, magical: 0 }
  for (const member of members) {
    const othersSupport = supports - (member.class === 'support' ? 1 : 0) > 0
    const bonus = 1 + (othersSupport ? SUPPORT_AURA : 0) + (isFullParty ? FULL_PARTY_BONUS : 0)
    totals[member.type] += member.amount * bonus
  }
  return { ...totals, total: totals.physical + totals.magical }
}

/** A skill whose effective level is `level`, with as few stars as that allows. */
function skillAtEffectiveLevel(level) {
  const stars = Math.max(0, Math.floor((level - 1) / SKILL_CAP))
  return { ...emptySkill(), level: level - stars * SKILL_CAP, stars }
}

/**
 * The party monster health is measured against: one seasoned character of each class, with
 * starting attributes, effective level `level` in every class skill and a weapon that keeps up.
 *
 * @param {number} level the monster's level
 * @returns {PartyHits}
 */
export function referencePartyHit(level) {
  const skill = skillAtEffectiveLevel(level)
  const skills = Object.fromEntries(CLASSES.map((className) => [skillOfClass(className), skill]))
  const weaponFactor = 1 + GEAR_LEVEL_BONUS * Math.floor(level / REFERENCE_LEVELS_PER_WEAPON_LEVEL)
  const members = CLASSES.map((className) => {
    const attributes = startingAttributes(className, skills)
    const character = { class: className, level: SEASONED_LEVEL, attributes }
    const tokensPerMinute = REFERENCE_TOKENS_PER_MINUTE
    const hit = characterHit({ character, skills, weaponFactor, tokensPerMinute })
    return { class: className, ...hit }
  })
  return partyHits(members)
}
