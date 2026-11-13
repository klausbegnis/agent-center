// Characters: one per agent session. Their class, trade, attributes and levels, all worked out
// from ids and experience so the same save always gives the same character.
import {
  ATTRIBUTE_POINTS_PER_LEVEL,
  NEWCOMER_SHARE,
  SEASONED_LEVEL,
  VETERAN_BONUS_PER_LEVEL
} from './constants.mjs'
import { hashOf } from './hash.mjs'
import { effectiveLevel, emptySkill, xpToNext } from './progression.mjs'
import {
  ATTRIBUTES,
  CLASSES,
  GATHERING_SKILLS,
  attributeForActivity,
  attributeOfClass,
  skillOfClass
} from './skills.mjs'

/** Of the points a level gives, this many go to the class attribute; the rest to the activity's. */
const CLASS_POINTS_PER_LEVEL = 2
const ACTIVITY_POINTS_PER_LEVEL = ATTRIBUTE_POINTS_PER_LEVEL - CLASS_POINTS_PER_LEVEL
/**
 * Salt for the class tie-break, so it is not the same number as the trade's `hash mod 6`.
 * Without it, class and trade would share the hash's parity and half the pairs could never occur.
 */
const CLASS_HASH_SALT = '|class'

/**
 * @typedef {import('./progression.mjs').Skill} Skill
 * @typedef {{ weapon: object | null, outfit: object | null, tool: object | null }} Equipment
 * @typedef {{
 *   sessionId: string, class: string, level: number, xp: number,
 *   attributes: { [attribute: string]: number }, levelActivityXp: { [activity: string]: number },
 *   equipment: Equipment, trade: string, tokens: number, bornAt: number, lastSeenAt: number
 * }} Character
 */

/**
 * The class a new character takes: one of those least present among the living characters,
 * picked among them by a hash of the session id.
 *
 * @param {string[]} livingClasses the class of every living character in the project
 * @param {string} sessionId
 * @returns {string}
 */
export function pickClass(livingClasses, sessionId) {
  const counts = new Map(CLASSES.map((className) => [className, 0]))
  for (const className of livingClasses) {
    if (counts.has(className)) counts.set(className, counts.get(className) + 1)
  }
  const fewest = Math.min(...counts.values())
  const candidates = CLASSES.filter((className) => counts.get(className) === fewest)
  return candidates[hashOf(sessionId + CLASS_HASH_SALT) % candidates.length]
}

/**
 * @param {string} sessionId
 * @returns {string} the gathering skill the character practises while idle
 */
export function tradeFor(sessionId) {
  return GATHERING_SKILLS[hashOf(sessionId) % GATHERING_SKILLS.length]
}

/**
 * One point in every attribute, plus half the class skill's effective level in the class
 * attribute: a world that trained the skill trains its newcomers too.
 *
 * @param {string} className
 * @param {{ [skillId: string]: Skill }} skills the world's skills
 * @returns {{ [attribute: string]: number }}
 */
export function startingAttributes(className, skills) {
  const attributes = Object.fromEntries(ATTRIBUTES.map((attribute) => [attribute, 1]))
  const classSkill = skills[skillOfClass(className)] ?? emptySkill()
  attributes[attributeOfClass(className)] += Math.floor(effectiveLevel(classSkill) / 2)
  return attributes
}

/**
 * @param {{ sessionId: string, livingClasses: string[], skills: { [skillId: string]: Skill },
 *   now: number }} options
 * @returns {Character}
 */
export function createCharacter({ sessionId, livingClasses, skills, now }) {
  const className = pickClass(livingClasses, sessionId)
  return {
    sessionId,
    class: className,
    level: 1,
    xp: 0,
    attributes: startingAttributes(className, skills),
    levelActivityXp: {},
    equipment: { weapon: null, outfit: null, tool: null },
    trade: tradeFor(sessionId),
    tokens: 0,
    bornAt: now,
    lastSeenAt: now
  }
}

/** The activity that earned most experience; ties go to the first name in alphabetical order. */
function dominantActivity(levelActivityXp) {
  let chosen = null
  for (const activity of Object.keys(levelActivityXp).sort()) {
    if (chosen === null || levelActivityXp[activity] > levelActivityXp[chosen]) chosen = activity
  }
  return chosen
}

function addLevelPoints(attributes, className, activity) {
  const next = { ...attributes }
  const classAttribute = attributeOfClass(className)
  const activityAttribute = attributeForActivity(activity)
  next[classAttribute] = (next[classAttribute] ?? 0) + CLASS_POINTS_PER_LEVEL
  next[activityAttribute] = (next[activityAttribute] ?? 0) + ACTIVITY_POINTS_PER_LEVEL
  return next
}

/**
 * Adds experience earned on an activity, levelling up as far as it allows. Each level gives its
 * attribute points by the activity that earned most during that level. Experience left over
 * after a level up was all earned by this grant, so it opens the next level's tally.
 *
 * @param {Character} character
 * @param {number} xp
 * @param {string} activity
 * @returns {Character}
 */
export function grantCharacterXp(character, xp, activity) {
  if (!(xp > 0)) return { ...character }
  let { level, attributes } = character
  let pool = character.xp + xp
  const earlierOnActivity = character.levelActivityXp[activity] ?? 0
  let levelActivityXp = { ...character.levelActivityXp, [activity]: earlierOnActivity + xp }
  while (pool >= xpToNext(level)) {
    pool -= xpToNext(level)
    level += 1
    attributes = addLevelPoints(attributes, character.class, dominantActivity(levelActivityXp))
    levelActivityXp = pool > 0 ? { [activity]: pool } : {}
  }
  return { ...character, level, xp: pool, attributes, levelActivityXp }
}

/**
 * How much of a seasoned character's work one of this level does: a newcomer share at level 1,
 * rising to 1 at SEASONED_LEVEL, then a small veteran bonus per level.
 *
 * @param {number} level
 * @returns {number}
 */
export function seasoning(level) {
  if (level >= SEASONED_LEVEL) return 1 + VETERAN_BONUS_PER_LEVEL * (level - SEASONED_LEVEL)
  return NEWCOMER_SHARE + ((1 - NEWCOMER_SHARE) * (level - 1)) / (SEASONED_LEVEL - 1)
}
