// "Auto: what is scarcest": the idle characters that follow it gather the materials their world has
// least of, measured against what its buildings' next levels cost, spread over the scarcest few.
// A room decides for all its followers at once, then keeps that for an hour of game time, so the
// picks do not flap with every unit gathered. Pure: the time is given.
import { GROUP_UPGRADES } from './constants.mjs'
import { worldLevel } from './progression.mjs'
import { GATHERING_SKILLS, SCARCEST, materialOfSkill } from './skills.mjs'
import { groupLevel, groupUpgradeCost } from './spending.mjs'
import { tradeChoiceOf } from './trades.mjs'

/** How long a room keeps its picks: long enough not to flap, short enough to follow the stock. */
export const SCARCEST_REVIEW_MS = 3_600_000
/** The most materials a room's followers spread over: with more, each would gather too little. */
export const SCARCEST_SPREAD = 3

/**
 * What the world's buildings ask of each gathered material at their next level: the measure a
 * stock is held against. Every building counts, open or not, so the measure needs no content.
 *
 * @param {{ upgrades?: Record<string, number>, skills: object }} world
 * @returns {Record<string, number>} by material, 0 for one no building asks for
 */
export function gatheredNeed(world) {
  const level = worldLevel(world.skills)
  const need = Object.fromEntries(GATHERING_SKILLS.map((skillId) => [materialOfSkill(skillId), 0]))
  for (const upgradeId of Object.keys(GROUP_UPGRADES)) {
    const cost = groupUpgradeCost(upgradeId, groupLevel(world.upgrades, upgradeId), level)
    for (const [materialId, amount] of Object.entries(cost)) {
      if (Object.hasOwn(need, materialId)) need[materialId] += amount
    }
  }
  return need
}

/**
 * The gathering skills, scarcest material first: by stock over (need + the mean need), so a
 * material wanted soon counts as scarcer, and one nobody asks for is still gathered once its stock
 * is low enough. Ties keep the game's order of skills. A material no trade yields, such as bars,
 * never appears.
 *
 * @param {Record<string, number>} materials the world's stock
 * @param {Record<string, number>} need from gatheredNeed
 * @returns {string[]} gathering skill ids
 */
export function scarcityOrder(materials, need) {
  const needs = GATHERING_SKILLS.map((skillId) => need[materialOfSkill(skillId)] ?? 0)
  const meanNeed = needs.reduce((sum, amount) => sum + amount, 0) / needs.length
  // The 1 keeps a world that needs nothing at all comparing stocks alone.
  const ratio = (skillId, index) => (materials[materialOfSkill(skillId)] ?? 0) / (needs[index] + meanNeed + 1)
  return GATHERING_SKILLS
    .map((skillId, index) => ({ skillId, index, ratio: ratio(skillId, index) }))
    .sort((first, second) => first.ratio - second.ratio || first.index - second.index)
    .map((entry) => entry.skillId)
}

/**
 * What each follower gathers: the followers in session order take the scarcest few in turn, so
 * one character takes the scarcest, two the two scarcest, and more go round the SCARCEST_SPREAD
 * scarcest, the scarcest first.
 *
 * @param {{ order: string[], sessionIds: string[] }} input `order` from scarcityOrder
 * @returns {Record<string, string>} by session id
 */
export function scarcestPicks({ order, sessionIds }) {
  const sorted = [...sessionIds].sort((a, b) => a.localeCompare(b, 'en'))
  const spread = Math.min(SCARCEST_SPREAD, sorted.length, order.length)
  return Object.fromEntries(sorted.map((sessionId, index) => [sessionId, order[index % spread]]))
}

/**
 * Whether a character gathers by "what is scarcest": its own choice, or its room's when it has
 * none of its own.
 *
 * @param {{ tradeChoice?: string | null }} character
 * @param {{ tradeChoice?: string | null }} project
 */
export function followsScarcest(character, project) {
  return (tradeChoiceOf(character.tradeChoice) ?? tradeChoiceOf(project.tradeChoice)) === SCARCEST
}

/** Whether the room's picks are due: never made, an hour old, or missing a follower. */
function isDue(scarcest, sessionIds, now) {
  if (!scarcest) return true
  if (now - scarcest.at >= SCARCEST_REVIEW_MS || now < scarcest.at) return true
  return sessionIds.some((sessionId) => !Object.hasOwn(scarcest.picks, sessionId))
}

/**
 * The project with its scarcest picks brought up to date at `now`: made again when due, and gone
 * when no character follows the choice (an old save, or one that never used it, is unchanged).
 *
 * @param {object} project
 * @param {{ materials: Record<string, number>, upgrades?: object, skills: object }} world
 * @param {number} now
 * @returns {object} the same project when nothing changes
 */
export function withScarcestPicks(project, world, now) {
  const sessionIds = Object.keys(project.characters).filter((sessionId) => followsScarcest(project.characters[sessionId], project))
  if (sessionIds.length === 0) {
    if (!project.scarcest) return project
    const { scarcest: _dropped, ...rest } = project
    return rest
  }
  if (!isDue(project.scarcest, sessionIds, now)) return project
  const order = scarcityOrder(world.materials, gatheredNeed(world))
  return { ...project, scarcest: { at: now, picks: scarcestPicks({ order, sessionIds }) } }
}
