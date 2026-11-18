// A world's `daily` record in the save: repaired by `migrate` (what the plugin's own storage holds)
// and checked by `cleanSave` (an imported file). A save from before the daily quests has none and
// gets one at its first change of a day. Pure.
import { MARKET_MAX_COINS } from './constants.mjs'
import { QUEST_KINDS, QUEST_SLOTS, questIndexOf } from './quest-content.mjs'
import { MATERIALS } from './skills.mjs'

/** The most days since 1970 a record may name: far past any real date. */
const DAY_MAX = 1_000_000
/** The most a count of quests or days, or a streak, may hold. */
const COUNT_MAX = 10_000_000
const QUEST_KEYS = ['kind', 'slot', 'target', 'progress', 'done', 'race', 'material', 'reward']
const KEYS = ['day', 'quests', 'bonus', 'bonusReward', 'streak', 'best', 'totals', 'sizing']
/** The most a record's sizing (quests.mjs's QUEST_SIZING) may say. */
const SIZING_MAX = 100

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isWhole = (value, max) => Number.isInteger(value) && value >= 0 && value <= max
const isAmount = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MARKET_MAX_COINS

/** Materials and their amounts, as a reward pays them. */
const isMaterials = (value) => isPlainObject(value) &&
  Object.entries(value).every(([id, amount]) => MATERIALS.includes(id) && isAmount(amount))

/** The first problem with a quest's shape, or null. */
function questProblem(quest, at) {
  const path = `daily.quests.${at}`
  if (!isPlainObject(quest)) return [path, 'is not an object']
  const extra = Object.keys(quest).find((key) => !QUEST_KEYS.includes(key))
  if (extra) return [`${path}.${extra}`, 'is not a field the engine writes']
  if (!QUEST_KINDS.includes(quest.kind)) return [`${path}.kind`, 'is not a quest kind']
  if (!QUEST_SLOTS.includes(quest.slot)) return [`${path}.slot`, 'is not a slot']
  if (!isAmount(quest.target) || quest.target < 1) return [`${path}.target`, 'is not an amount from 1']
  if (!isAmount(quest.progress) || quest.progress > quest.target) return [`${path}.progress`, 'is not an amount up to the target']
  if (quest.done !== (quest.progress >= quest.target)) return [`${path}.done`, 'does not say whether the target is reached']
  if (quest.material !== undefined && !MATERIALS.includes(quest.material)) return [`${path}.material`, 'is not a material']
  if (quest.race !== undefined && (typeof quest.race !== 'string' || !quest.race)) return [`${path}.race`, 'is not a race id']
  if (!isMaterials(quest.reward)) return [`${path}.reward`, 'is not materials']
  return null
}

/** The first problem with a daily record's shape, as [field, problem], or null; content aside. */
function shapeProblem(value) {
  if (!isPlainObject(value)) return ['daily', 'is not an object']
  const extra = Object.keys(value).find((key) => !KEYS.includes(key))
  if (extra) return [`daily.${extra}`, 'is not a field the engine writes']
  if (!isWhole(value.day, DAY_MAX)) return ['daily.day', 'is not a day']
  if (!Array.isArray(value.quests) || value.quests.length !== QUEST_SLOTS.length) return ['daily.quests', 'is not the day\'s three quests']
  for (const [at, quest] of value.quests.entries()) {
    const problem = questProblem(quest, at)
    if (problem) return problem
  }
  if (new Set(value.quests.map((quest) => quest.kind)).size !== value.quests.length) return ['daily.quests', 'has a kind twice']
  if (typeof value.bonus !== 'boolean' || (value.bonus && !value.quests.every((quest) => quest.done))) {
    return ['daily.bonus', 'is not true only once every quest is done']
  }
  if (value.bonusReward !== undefined && (!value.bonus || !isMaterials(value.bonusReward))) return ['daily.bonusReward', 'is not the paid bonus']
  if (!isWhole(value.streak, COUNT_MAX) || !isWhole(value.best, COUNT_MAX) || value.streak > value.best) {
    return ['daily.streak', 'is not a streak up to the best']
  }
  if (!Array.isArray(value.totals) || value.totals.length !== 2 || !value.totals.every((count) => isWhole(count, COUNT_MAX))) {
    return ['daily.totals', 'is not the quests and days done']
  }
  if (value.sizing !== undefined && (!Number.isInteger(value.sizing) || value.sizing < 1 || value.sizing > SIZING_MAX)) {
    return ['daily.sizing', 'is not a sizing']
  }
  return null
}

const copyOf = (value) => structuredClone(value)

/**
 * What `migrate` keeps of a world's daily record: a copy when it is well formed, otherwise none (the
 * next change rolls the day's quests again).
 *
 * @param {unknown} value
 * @returns {object | null}
 */
export const normalizeDaily = (value) => (value !== undefined && shapeProblem(value) === null ? copyOf(value) : null)

/**
 * Checks an imported world's daily record against the content: kinds it has.
 *
 * @param {unknown} value
 * @param {object | undefined} quests the parsed game/quests.json
 * @returns {{ ok: true, value: object | null } | { ok: false, problem: [string, string] }}
 */
export function checkDaily(value, quests) {
  if (value === undefined) return { ok: true, value: null }
  const index = questIndexOf({ quests })
  if (!index) return { ok: false, problem: ['daily', 'is kept by a game that has no daily quests'] }
  const problem = shapeProblem(value)
  if (problem) return { ok: false, problem }
  const unknown = value.quests.findIndex((quest) => !index.byId.has(quest.kind))
  if (unknown >= 0) return { ok: false, problem: [`daily.quests.${unknown}.kind`, 'is not a kind of game/quests.json'] }
  return { ok: true, value: copyOf(value) }
}
