// Experience, levels and prestige for skills and characters. Every function returns a new
// object; nothing here mutates what it is given.
import {
  LEVEL_BASE,
  LEVEL_EXPONENT,
  POST_CAP_GROWTH,
  SKILL_CAP,
  STAR_EFFECT_BONUS,
  STAR_XP_BONUS,
  TOKENS_PER_XP
} from './constants.mjs'
import { WORK_SKILLS } from './skills.mjs'

/**
 * @typedef {{ level: number, xp: number, banked: number, stars: number }} Skill
 * `xp` is the experience inside the current level; `banked` is what was earned at the cap.
 */

/**
 * @param {number} tokens tokens spent by a session
 * @returns {number} experience, possibly fractional; 0 for anything that is not a positive number
 */
export function xpFromTokens(tokens) {
  return Number.isFinite(tokens) && tokens > 0 ? tokens / TOKENS_PER_XP : 0
}

/**
 * Experience needed to go from `level` to `level + 1`. Skills never pass SKILL_CAP; characters
 * do, and past it every level costs POST_CAP_GROWTH times the one before.
 *
 * @param {number} level
 * @returns {number}
 */
export function xpToNext(level) {
  if (level <= SKILL_CAP) return Math.round(LEVEL_BASE * level ** LEVEL_EXPONENT)
  return Math.round(xpToNext(SKILL_CAP) * POST_CAP_GROWTH ** (level - SKILL_CAP))
}

/** @returns {Skill} */
export function emptySkill() {
  return { level: 1, xp: 0, banked: 0, stars: 0 }
}

/** Experience gained in a skill is worth this much more for each of its stars. */
function starXpMultiplier(stars) {
  return 1 + STAR_XP_BONUS * stars
}

/** Adds experience that already carries the star multiplier: levels up, then banks at the cap. */
function pourXp(skill, xp) {
  let { level } = skill
  let pool = skill.xp + xp
  while (level < SKILL_CAP && pool >= xpToNext(level)) {
    pool -= xpToNext(level)
    level += 1
  }
  if (level < SKILL_CAP) return { ...skill, level, xp: pool }
  return { ...skill, level, xp: 0, banked: skill.banked + pool }
}

/**
 * @param {Skill} skill
 * @param {number} xp raw experience, before the star multiplier
 * @returns {Skill}
 */
export function grantSkillXp(skill, xp) {
  if (!(xp > 0)) return { ...skill }
  return pourXp(skill, xp * starXpMultiplier(skill.stars))
}

/**
 * @param {Skill} skill
 * @returns {boolean}
 */
export function canPrestige(skill) {
  return skill.level >= SKILL_CAP
}

/**
 * Back to level 1 with one more star. The banked experience already carries the old multiplier,
 * so it goes back in as it is.
 *
 * @param {Skill} skill
 * @returns {Skill} the same skill, copied, when it cannot be prestiged
 */
export function prestige(skill) {
  if (!canPrestige(skill)) return { ...skill }
  return pourXp({ level: 1, xp: 0, banked: 0, stars: skill.stars + 1 }, skill.banked)
}

/**
 * @param {Skill} skill
 * @returns {number} the level power is computed from; it never goes down with a prestige
 */
export function effectiveLevel(skill) {
  return skill.stars * SKILL_CAP + skill.level
}

/**
 * @param {Skill} skill
 * @returns {number}
 */
export function effectMultiplier(skill) {
  return 1 + STAR_EFFECT_BONUS * skill.stars
}

/**
 * @param {{ [skillId: string]: Skill }} skills a world's skills; a missing work skill counts as level 1
 * @returns {number}
 */
export function worldLevel(skills) {
  const total = WORK_SKILLS.reduce((sum, skillId) => sum + effectiveLevel(skills[skillId] ?? emptySkill()), 0)
  return Math.max(1, Math.floor(total / WORK_SKILLS.length))
}
