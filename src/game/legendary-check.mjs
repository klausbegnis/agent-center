// Checks a room's legendary loot in a save from outside the plugin (an imported file), for
// save-check.mjs: owned relics and the active one must be relics the content has, listed once, and
// legendary equipment in the chest must be content equipment, one of each, as a drop makes it.
// Answers the cleaned state or the first problem, as the path under the room and what is wrong.
import { LEGENDARY_PITY_MAX } from './constants.mjs'

const KEYS = ['relics', 'active', 'relicPity', 'bossPity']

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const isCount = (value) => Number.isInteger(value) && value >= 0 && value <= LEGENDARY_PITY_MAX
const sameList = (first, second) => first.length === second.length && first.every((item, at) => item === second[at])

/**
 * The first problem with the room's legendary state, or null.
 *
 * @param {Record<string, unknown>} value
 * @param {import('./legendary-content.mjs').LegendaryIndex | null} index
 * @returns {[string, string] | null}
 */
function stateProblem(value, index) {
  if (!isPlainObject(value)) return ['legendary', 'is not an object']
  const unknown = Object.keys(value).find((key) => !KEYS.includes(key))
  if (unknown) return [`legendary.${unknown.slice(0, 40)}`, 'is not something the game keeps']
  if (!Array.isArray(value.relics)) return ['legendary.relics', 'is not a list']
  const seen = new Set()
  for (const [at, id] of value.relics.entries()) {
    if (typeof id !== 'string' || !index?.relicIds.has(id)) return [`legendary.relics.${at}`, 'is not a relic the game has']
    if (seen.has(id)) return [`legendary.relics.${at}`, 'is owned twice']
    seen.add(id)
  }
  if (value.active !== null && !seen.has(value.active)) return ['legendary.active', 'is not a relic the room owns']
  for (const key of ['relicPity', 'bossPity']) {
    if (!isCount(value[key])) return [`legendary.${key}`, 'is out of range']
  }
  return null
}

/**
 * The first problem with the chest's legendary items, or null: each names equipment of the
 * content by its own id, once, with the entry's slot, damage type and recipe; a plain item never
 * uses a legendary id.
 */
function chestProblem(chest, index) {
  const seen = new Set()
  for (const item of chest) {
    const path = `chest.${item.id}`
    const entry = index?.byId.get(item.entryId) ?? index?.byId.get(item.id)
    if (!item.legendary) {
      if (entry) return [path, 'uses a legendary id without being legendary']
      continue
    }
    if (entry?.kind !== 'equipment' || item.id !== entry.id || item.entryId !== entry.id) {
      return [path, 'is not legendary equipment the game has']
    }
    if (seen.has(entry.id)) return [path, 'is a second copy of a legendary item']
    seen.add(entry.id)
    const sameKind = item.slot === entry.slot && item.damageType === entry.damageType && sameList(item.recipe, entry.recipe)
    if (!sameKind) return [path, 'is not made as its legendary entry is']
  }
  return null
}

/**
 * A room's legendary loot as an imported save holds it, checked against the content.
 *
 * @param {unknown} value the room's `legendary`, or undefined for a room without any
 * @param {object[]} chest the room's chest, already checked as plain items with `legendary` kept
 * @param {import('./legendary-content.mjs').LegendaryIndex | null} index
 * @returns {{ ok: true, legendary: object | null } | { ok: false, problem: [string, string] }}
 */
export function checkRoomLegendary(value, chest, index) {
  const problem = (value === undefined ? null : stateProblem(value, index)) ?? chestProblem(chest, index)
  if (problem) return { ok: false, problem }
  if (value === undefined) return { ok: true, legendary: null }
  const { relics, active, relicPity, bossPity } = value
  return { ok: true, legendary: { relics: [...relics], active, relicPity, bossPity } }
}
