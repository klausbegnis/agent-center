// The game's identifiers: skills, materials, classes and attributes, and how activities and
// classes map onto them. Every other game module names things through this one.

/** Work skills, in the order of the activities write, read, run, think, delegate. */
export const WORK_SKILLS = Object.freeze(['forge', 'lore', 'engineering', 'arcana', 'command'])
export const GATHERING_SKILLS = Object.freeze([
  'mining',
  'fishing',
  'farming',
  'woodcutting',
  'hunting',
  'runecraft'
])
export const CLASSES = Object.freeze(['physical', 'magical', 'defense', 'support'])
export const ATTRIBUTES = Object.freeze([
  'strength',
  'arcane',
  'agility',
  'precision',
  'resilience',
  'medicine',
  'luck'
])

const SKILL_OF_ACTIVITY = Object.freeze({
  write: 'forge',
  read: 'lore',
  run: 'engineering',
  think: 'arcana',
  delegate: 'command'
})

const MATERIAL_OF_SKILL = Object.freeze({
  forge: 'bars',
  lore: 'pages',
  engineering: 'gears',
  arcana: 'crystals',
  command: 'seals',
  mining: 'ore',
  fishing: 'fish',
  farming: 'crops',
  woodcutting: 'logs',
  hunting: 'hides',
  runecraft: 'runes'
})

const SKILL_OF_CLASS = Object.freeze({
  physical: 'forge',
  magical: 'arcana',
  defense: 'lore',
  support: 'command'
})

const ATTRIBUTE_OF_CLASS = Object.freeze({
  physical: 'strength',
  magical: 'arcane',
  defense: 'resilience',
  support: 'medicine'
})

const ATTRIBUTE_OF_ACTIVITY = Object.freeze({
  write: 'strength',
  run: 'agility',
  read: 'resilience',
  think: 'arcane',
  delegate: 'medicine'
})

/** Any activity without an attribute of its own (waiting, blocked, unknown) trains this one. */
const FALLBACK_ATTRIBUTE = 'precision'

/** Every material, work materials first, in the order of their skills. */
export const MATERIALS = Object.freeze(
  [...WORK_SKILLS, ...GATHERING_SKILLS].map((skillId) => MATERIAL_OF_SKILL[skillId])
)

/**
 * @param {string} activity an agent activity such as 'write' or 'wait'
 * @returns {string | null} the work skill it trains, or null when it trains none
 */
export function skillForActivity(activity) {
  return Object.hasOwn(SKILL_OF_ACTIVITY, activity) ? SKILL_OF_ACTIVITY[activity] : null
}

/**
 * @param {string} skillId a work or gathering skill
 * @returns {string | null} the material it yields, or null for an unknown skill
 */
export function materialOfSkill(skillId) {
  return Object.hasOwn(MATERIAL_OF_SKILL, skillId) ? MATERIAL_OF_SKILL[skillId] : null
}

/**
 * @param {string} className one of CLASSES
 * @returns {string | null} the work skill that powers the class
 */
export function skillOfClass(className) {
  return Object.hasOwn(SKILL_OF_CLASS, className) ? SKILL_OF_CLASS[className] : null
}

/**
 * @param {string} className one of CLASSES
 * @returns {string | null} the attribute the class hits with
 */
export function attributeOfClass(className) {
  return Object.hasOwn(ATTRIBUTE_OF_CLASS, className) ? ATTRIBUTE_OF_CLASS[className] : null
}

/**
 * @param {string} activity an agent activity
 * @returns {string} the attribute a level spent mostly on that activity trains
 */
export function attributeForActivity(activity) {
  return Object.hasOwn(ATTRIBUTE_OF_ACTIVITY, activity) ? ATTRIBUTE_OF_ACTIVITY[activity] : FALLBACK_ATTRIBUTE
}
