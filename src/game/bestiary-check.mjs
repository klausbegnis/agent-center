// Checks a world's bestiary in a save from outside the plugin (an imported file), for
// save-check.mjs: counters of races and bosses the content has, each a list of whole numbers of the
// length the engine writes, with at least one kill, no more legendary wins than wins, and no
// empty part. Answers the cleaned bestiary or the first problem, as the path under the world and
// what is wrong.
import { BESTIARY_RANKS, BOSS_BEATEN, BOSS_FIRST_DAY, BOSS_LEGENDARY, RACE_FIRST_DAY, killsOf } from './bestiary.mjs'

const KEYS = ['races', 'bosses', 'others']
/** The longest list the engine writes; a longer one is refused before it is read. */
const LIST_LENGTH = BESTIARY_RANKS.length + 1

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
/** A count the engine could have written: whole, from 0, counted to the unit. */
const isCount = (value) => Number.isSafeInteger(value) && value >= 0
const isReserved = (key) => key === '__proto__' || key === 'constructor' || key === 'prototype'

/** The first problem with a list of counts of a given length, or null. */
function listProblem(value, length, path) {
  if (!Array.isArray(value) || value.length !== length || value.length > LIST_LENGTH) return [path, 'is not a list the game keeps']
  const at = value.findIndex((count) => !isCount(count))
  return at === -1 ? null : [`${path}.${at}`, 'is not a whole count']
}

function raceCounterProblem(value, path) {
  return listProblem(value, RACE_FIRST_DAY + 1, path) ?? (killsOf(value) > 0 ? null : [path, 'counts no kill'])
}

function bossCounterProblem(value, path) {
  const problem = listProblem(value, BOSS_FIRST_DAY + 1, path)
  if (problem) return problem
  if (value[BOSS_BEATEN] === 0) return [path, 'counts no win']
  return value[BOSS_LEGENDARY] > value[BOSS_BEATEN] ? [`${path}.${BOSS_LEGENDARY}`, 'is more than its wins'] : null
}

/** The first problem with a map of counters whose keys must be among `ids`, or null. */
function counterMapProblem(value, path, { ids, what, check }) {
  if (!isPlainObject(value)) return [path, 'is not an object']
  for (const [id, counter] of Object.entries(value)) {
    if (isReserved(id) || !ids.has(id)) return [`${path}.${id.slice(0, 40)}`, `is not a ${what} the game has`]
    const problem = check(counter, `${path}.${id}`)
    if (problem) return problem
  }
  return null
}

function bestiaryProblem(value, index) {
  if (!index) return ['bestiary', 'is kept, but the game has no bestiary']
  if (!isPlainObject(value)) return ['bestiary', 'is not an object']
  const unknown = Object.keys(value).find((key) => !KEYS.includes(key))
  if (unknown) return [`bestiary.${unknown.slice(0, 40)}`, 'is not something the game keeps']
  const races = { ids: new Set(index.raceIds), what: 'race', check: raceCounterProblem }
  const bosses = { ids: index.bossIds, what: 'boss', check: bossCounterProblem }
  const problem = counterMapProblem(value.races, 'bestiary.races', races) ??
    counterMapProblem(value.bosses, 'bestiary.bosses', bosses) ??
    (value.others === undefined ? null : raceCounterProblem(value.others, 'bestiary.others'))
  if (problem) return problem
  const isEmpty = Object.keys(value.races).length === 0 && Object.keys(value.bosses).length === 0 && value.others === undefined
  return isEmpty ? ['bestiary', 'counts nothing; the game leaves it out'] : null
}

/**
 * A world's bestiary from a file, checked.
 *
 * @param {unknown} value the world's `bestiary`, undefined when it has none
 * @param {import('./bestiary-content.mjs').BestiaryIndex | null} index the content's
 * @returns {{ ok: true, bestiary: object | null } | { ok: false, problem: [string, string] }}
 */
export function checkWorldBestiary(value, index) {
  if (value === undefined) return { ok: true, bestiary: null }
  const problem = bestiaryProblem(value, index)
  if (problem) return { ok: false, problem }
  const copy = (counters) => Object.fromEntries(Object.entries(counters).map(([id, counter]) => [id, [...counter]]))
  const bestiary = { races: copy(value.races), bosses: copy(value.bosses) }
  if (value.others !== undefined) bestiary.others = [...value.others]
  return { ok: true, bestiary }
}
