// Characters: one per agent session. Their class, trade, attributes and levels, all worked out
// from ids and experience so the same save always gives the same character.
import {
  ACTIVITY_POINTS_PER_LEVEL,
  CLASS_POINTS_PER_LEVEL,
  FORTUNE_POINTS_PER_LEVEL,
  NEWCOMER_SHARE,
  SEASONED_LEVEL,
  STARTING_LUCK_SPREAD,
  VETERAN_BONUS_PER_LEVEL
} from './constants.mjs'
import { hashOf } from './hash.mjs'
import { characterXpToNext, worldLevel } from './progression.mjs'
import {
  ATTRIBUTES,
  CLASSES,
  GATHERING_SKILLS,
  attributeForActivity,
  attributeOfClass
} from './skills.mjs'

/**
 * Salt for the class tie-break, so it is not the same number as the trade's `hash mod 6`.
 * Without it, class and trade would share the hash's parity and half the pairs could never occur.
 */
const CLASS_HASH_SALT = '|class'
const LUCK_HASH_SALT = '|luck'

/**
 * @typedef {import('./progression.mjs').Skill} Skill
 * @typedef {{ weapon: object | null, outfit: object | null, tool: object | null }} Equipment
 * @typedef {{
 *   sessionId: string, class: string, level: number, xp: number,
 *   attributes: { [attribute: string]: number }, levelActivityXp: { [activity: string]: number },
 *   equipment: Equipment, trade: string, tradeChoice: string | null, tokens: number,
 *   bornAt: number, lastSeenAt: number
 * }} Character `trade` is the engine's own pick (Auto), `tradeChoice` the person's, null for none
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
 * One point in every attribute, plus half the world level in the class attribute: a world that
 * trained its skills trains its newcomers too.
 *
 * @param {string} className
 * @param {{ [skillId: string]: Skill }} skills the world's skills
 * @returns {{ [attribute: string]: number }}
 */
export function startingAttributes(className, skills) {
  const attributes = Object.fromEntries(ATTRIBUTES.map((attribute) => [attribute, 1]))
  attributes[attributeOfClass(className)] += Math.floor(worldLevel(skills) / 2)
  return attributes
}

/**
 * The luck a character is born with: 1 to STARTING_LUCK_SPREAD, by a hash of its session id.
 *
 * @param {string} sessionId
 * @returns {number}
 */
export function startingLuck(sessionId) {
  return 1 + (hashOf(sessionId + LUCK_HASH_SALT) % STARTING_LUCK_SPREAD)
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
    attributes: { ...startingAttributes(className, skills), luck: startingLuck(sessionId) },
    levelActivityXp: {},
    equipment: { weapon: null, outfit: null, tool: null },
    trade: tradeFor(sessionId),
    tradeChoice: null,
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

/**
 * The attribute that a level's fortune point goes to: precision on even levels, luck on odd ones.
 *
 * @param {number} level the level just reached
 * @returns {'precision' | 'luck'}
 */
export function fortuneAttribute(level) {
  return level % 2 === 0 ? 'precision' : 'luck'
}

function addLevelPoints(attributes, { className, activity, level }) {
  const next = { ...attributes }
  const add = (attribute, points) => {
    next[attribute] = (next[attribute] ?? 0) + points
  }
  add(attributeOfClass(className), CLASS_POINTS_PER_LEVEL)
  add(attributeForActivity(activity), ACTIVITY_POINTS_PER_LEVEL)
  add(fortuneAttribute(level), FORTUNE_POINTS_PER_LEVEL)
  return next
}

/**
 * Adds experience earned on an activity, levelling up on the character curve as far as it
 * allows. Each level gives its attribute points: the class attribute, the attribute of the
 * activity that earned most during that level, and the fortune point. Experience left over
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
  while (pool >= characterXpToNext(level)) {
    pool -= characterXpToNext(level)
    level += 1
    const dominant = dominantActivity(levelActivityXp)
    attributes = addLevelPoints(attributes, { className: character.class, activity: dominant, level })
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
