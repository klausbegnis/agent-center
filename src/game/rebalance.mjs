// Rebalancing a world's work skills: the experience in them is shared again by a mix of the five
// work activities, so a world that grew lopsided under an older attribution gets back to a sensible
// spread without changing its world level. Asked for once by the person, never done on its own.
import { SKILL_CAP } from './constants.mjs'
import { emptySkill, grantSkillXp, xpToNext } from './progression.mjs'
import { WORK_SKILLS } from './skills.mjs'

/** The activity whose share of the mix a work skill takes, in the order of WORK_SKILLS. */
const ACTIVITY_OF_SKILL = Object.freeze({
  forge: 'write',
  lore: 'read',
  engineering: 'run',
  arcana: 'think',
  command: 'delegate'
})

/** Halvings of the search for the total experience: far below one experience point. */
const SEARCH_STEPS = 80

/** The experience a skill holds in its levels: every level below its own and the progress in it. */
function levelExperience(skill) {
  let total = skill.xp
  for (let level = 1; level < skill.level; level += 1) total += xpToNext(level)
  return total
}

/** A skill holding `xp` from level 1, keeping its stars and banked experience. */
function skillHolding(skill, xp) {
  const poured = grantSkillXp(emptySkill(), xp)
  return { ...poured, stars: skill.stars, banked: poured.banked + skill.banked }
}

/** The five work skills sharing `total` experience by `shares`. */
function shareOut(skills, shares, total) {
  return Object.fromEntries(WORK_SKILLS.map((skillId) => [skillId, skillHolding(skills[skillId], total * shares[skillId])]))
}

const levelSum = (skills) => WORK_SKILLS.reduce((sum, skillId) => sum + skills[skillId].level, 0)

/** Each work skill's share of the mix, adding up to 1; null when the mix gives nothing. */
function sharesOf(mix) {
  const raw = WORK_SKILLS.map((skillId) => Math.max(0, Number(mix?.[ACTIVITY_OF_SKILL[skillId]]) || 0))
  const total = raw.reduce((sum, value) => sum + value, 0)
  if (!(total > 0)) return null
  return Object.fromEntries(WORK_SKILLS.map((skillId, index) => [skillId, raw[index] / total]))
}

/**
 * The world's work skills shared again by `mix`. The rule: the experience is shared by the mix, and
 * its total is the largest for which the five levels add up to no more than before, which, as
 * levels rise one at a time, is the same sum: the world level does not change. Levels and the
 * progress inside them are recomputed from level 1; stars and experience banked at the cap stay
 * with their skill. Experience beyond what the same world level holds is not kept, so a lopsided
 * world ends with less experience than it had: a rebalance is never a way to grow. Gathering
 * skills are left as they are.
 *
 * @param {Record<string, import('./progression.mjs').Skill>} skills a world's skills
 * @param {Record<string, number>} mix shares by activity (write, read, run, think, delegate)
 * @returns {Record<string, import('./progression.mjs').Skill>} every skill, the work skills shared again
 */
export function rebalanceWorkSkills(skills, mix) {
  const shares = sharesOf(mix)
  const work = Object.fromEntries(WORK_SKILLS.map((skillId) => [skillId, skills[skillId] ?? emptySkill()]))
  const target = levelSum(work)
  if (!shares || target >= WORK_SKILLS.length * SKILL_CAP) return { ...skills }
  let low = 0
  let high = Math.max(1, WORK_SKILLS.reduce((sum, skillId) => sum + levelExperience(work[skillId]), 0))
  while (levelSum(shareOut(work, shares, high)) <= target) high *= 2
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const middle = (low + high) / 2
    if (levelSum(shareOut(work, shares, middle)) <= target) low = middle
    else high = middle
  }
  return { ...skills, ...shareOut(work, shares, low) }
}

/**
 * What a rebalance would do to each work skill, for the question that asks for it.
 *
 * @param {Record<string, import('./progression.mjs').Skill>} skills
 * @param {Record<string, number>} mix
 * @returns {{ skillId: string, from: number, to: number }[]} levels before and after, in skill order
 */
export function rebalancePreview(skills, mix) {
  const after = rebalanceWorkSkills(skills, mix)
  return WORK_SKILLS.map((skillId) => ({
    skillId,
    from: (skills[skillId] ?? emptySkill()).level,
    to: after[skillId].level
  }))
}
