// Checks game/quests.json (already parsed) and indexes it for the engine: the kinds of daily quest,
// each with a name and the slots (easy, medium, hard) it may fill with the share of a day's pace it
// asks, and the rewards' sizes. What each kind counts and when it can be offered is the engine's
// (quests.mjs). Pure: problems come back as text.

/** The day's three quests, one of each. */
export const QUEST_SLOTS = Object.freeze(['easy', 'medium', 'hard'])
/** The kinds the engine knows how to offer and count. */
export const QUEST_KINDS = Object.freeze([
  'kills', 'race', 'elites', 'boss', 'collect', 'coins', 'trade', 'instance', 'rematch', 'weekly', 'levels', 'skills'
])
/** A quest is a nudge: the most of a day's income one quest, and the daily bonus, may pay. */
const MOST_REWARD_SHARE = 0.05
const MOST_STREAK = 30
const NAME_LIMIT = 30
const TOP_KEYS = ['rewards', 'defaults', 'kinds']
const REWARD_KEYS = ['quest', 'bonus', 'streakStep', 'streakCap', 'scrollChance']
const DEFAULT_KEYS = ['kills', 'levels', 'skillLevels']

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isNumberIn = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const unknownKeys = (object, known, label) =>
  Object.keys(object).filter((key) => !known.includes(key)).map((key) => `${label}: "${key}" is not a known key`)

function checkRewards(rewards) {
  if (!isObject(rewards)) return ['"rewards" must give the rewards\' sizes']
  const problems = unknownKeys(rewards, REWARD_KEYS, 'rewards')
  if (!isNumberIn(rewards.quest, 0, MOST_REWARD_SHARE)) problems.push(`rewards: "quest" must be from 0 to ${MOST_REWARD_SHARE}`)
  if (!isNumberIn(rewards.bonus, 0, MOST_REWARD_SHARE)) problems.push(`rewards: "bonus" must be from 0 to ${MOST_REWARD_SHARE}`)
  if (!isNumberIn(rewards.streakStep, 0, 0.25)) problems.push('rewards: "streakStep" must be from 0 to 0.25')
  if (!Number.isInteger(rewards.streakCap) || rewards.streakCap < 1 || rewards.streakCap > MOST_STREAK) {
    problems.push(`rewards: "streakCap" must be a whole number from 1 to ${MOST_STREAK}`)
  }
  if (!isNumberIn(rewards.scrollChance, 0, 1)) problems.push('rewards: "scrollChance" must be from 0 to 1')
  return problems
}

function checkDefaults(defaults) {
  if (!isObject(defaults)) return ['"defaults" must give a day\'s pace for a world with no journal yet']
  const problems = unknownKeys(defaults, DEFAULT_KEYS, 'defaults')
  for (const key of DEFAULT_KEYS) {
    if (!isNumberIn(defaults[key], 1, 10_000)) problems.push(`defaults: "${key}" must be a number from 1 to 10000`)
  }
  return problems
}

function checkKind(kind) {
  if (!isObject(kind)) return ['every kind must be an object']
  const name = `kind "${kind.id}"`
  const problems = unknownKeys(kind, ['id', 'name', 'slots'], name)
  if (!QUEST_KINDS.includes(kind.id)) problems.push(`${name}: "id" must be one of: ${QUEST_KINDS.join(', ')}`)
  if (typeof kind.name !== 'string' || !kind.name.trim() || kind.name.length > NAME_LIMIT) {
    problems.push(`${name}: "name" must be text of at most ${NAME_LIMIT} characters`)
  }
  if (!isObject(kind.slots) || Object.keys(kind.slots).length === 0) return [...problems, `${name}: "slots" must name a slot`]
  for (const [slot, share] of Object.entries(kind.slots)) {
    if (!QUEST_SLOTS.includes(slot)) problems.push(`${name}: "${slot}" is not a slot`)
    if (!isNumberIn(share, 0.05, 1)) problems.push(`${name}: the share of a day's pace "${slot}" asks must be from 0.05 to 1`)
  }
  return problems
}

/**
 * Everything wrong with a parsed game/quests.json; empty when it is valid. Some kind must name
 * every slot; a slot no kind can fill on a given day falls back to defeating monsters (quests.mjs).
 *
 * @param {unknown} data
 * @returns {string[]}
 */
export function validateQuests(data) {
  if (!isObject(data)) return ['game/quests.json must be an object']
  const problems = [...unknownKeys(data, TOP_KEYS, 'game/quests.json'), ...checkRewards(data.rewards), ...checkDefaults(data.defaults)]
  if (!Array.isArray(data.kinds) || data.kinds.length === 0) return [...problems, '"kinds" must list the quest kinds']
  const ids = new Set()
  for (const kind of data.kinds) {
    problems.push(...checkKind(kind))
    if (ids.has(kind?.id)) problems.push(`kind "${kind.id}" is listed twice`)
    ids.add(kind?.id)
  }
  for (const slot of QUEST_SLOTS) {
    if (!data.kinds.some((kind) => isObject(kind?.slots) && Object.hasOwn(kind.slots, slot))) {
      problems.push(`no kind fills the ${slot} slot`)
    }
  }
  return problems
}

/** @typedef {{ byId: Map<string, object>, kinds: object[], rewards: object, defaults: object }} QuestIndex */

const indexes = new WeakMap()

/**
 * The index of the content's daily quests, built once per content file.
 *
 * @param {{ quests?: object } | null | undefined} content
 * @returns {QuestIndex | null} null when the content has no daily quests
 */
export function questIndexOf(content) {
  const data = content?.quests
  if (!isObject(data) || !Array.isArray(data.kinds)) return null
  if (!indexes.has(data)) {
    indexes.set(data, { byId: new Map(data.kinds.map((kind) => [kind.id, kind])), kinds: data.kinds, rewards: data.rewards, defaults: data.defaults })
  }
  return indexes.get(data)
}
