// The bestiary's counters, kept per world: how many monsters of each race the world has killed, by
// rank, how many times it beat each named boss of the roster (and how many of those as
// legendary), the hand-made monsters under "others", and the day of each first kill. A kill is
// worth points by its rank; a race's mastery level, the world's hunter rank and the boss hunter's
// level follow from them and from the ladders of game/bestiary.json. Pure; the save keeps the
// counters as short lists of numbers.
import { ladderLevel } from './bestiary-ladder.mjs'
import { MARKET_DAY_MS } from './constants.mjs'
import { rankOf } from './monsters.mjs'

/** The ranks a race's counter keeps apart, in the order its list keeps them; then the first day. */
export const BESTIARY_RANKS = Object.freeze(['normal', 'veteran', 'elite', 'champion', 'boss', 'legendary'])
/** Where a race's (or the others') list keeps the game day of its first kill. */
export const RACE_FIRST_DAY = BESTIARY_RANKS.length
/** A boss's list: times beaten, of those as legendary, and the game day of the first. */
export const BOSS_BEATEN = 0
export const BOSS_LEGENDARY = 1
export const BOSS_FIRST_DAY = 2
/** The ranks that are a boss wave's boss: only those count as beating a boss of the roster. */
const BOSS_RANKS = new Set(['boss', 'legendary'])
/** Elite and above: the part of a race's kills its details single out. */
const ELITE_RANKS = new Set(['elite', 'champion', 'boss', 'legendary'])

/**
 * @typedef {{ races: Record<string, number[]>, bosses: Record<string, number[]>,
 *   others?: number[], filled?: number }} Bestiary a world's counters, as the save keeps them;
 *   `filled` the kills given to it once from the rooms' counts (bestiary-backfill.mjs)
 * @typedef {{ kind: 'race' | 'boss' | 'hunter' | 'rank', id?: string, discovered?: true,
 *   level?: number }} News what a kill made new: a first kill of a race or a boss, a mastery level,
 *   a boss hunter level, a hunter rank
 */

/**
 * The game day of a moment: the one the market's stall changes with, midnight UTC.
 *
 * @param {number} ms
 */
export const gameDayOf = (ms) => Math.floor(ms / MARKET_DAY_MS)

const emptyCounter = () => [...BESTIARY_RANKS.map(() => 0), 0]

/** @returns {Bestiary} */
export const emptyBestiary = () => ({ races: {}, bosses: {} })

/**
 * Every kill a race's (or the others') list counts.
 *
 * @param {number[] | undefined} counter
 */
export const killsOf = (counter) => (counter ? counter.slice(0, RACE_FIRST_DAY).reduce((sum, count) => sum + count, 0) : 0)

/**
 * The kills of elite rank or above in a race's list.
 *
 * @param {number[] | undefined} counter
 */
export const eliteKillsOf = (counter) =>
  (counter ? BESTIARY_RANKS.reduce((sum, rank, at) => sum + (ELITE_RANKS.has(rank) ? counter[at] : 0), 0) : 0)

/**
 * The level reached with a count: how many thresholds it has passed.
 *
 * @param {number} count
 * @param {number[]} thresholds rising
 * @returns {number} from 0
 */
export const levelFor = (count, thresholds) => thresholds.filter((threshold) => count >= threshold).length

/**
 * The points a race's (or the others') list is worth: each kill its rank's points.
 *
 * @param {number[] | undefined} counter
 * @param {import('./bestiary-content.mjs').BestiaryIndex} index
 */
export const pointsOf = (counter, index) =>
  (counter ? BESTIARY_RANKS.reduce((sum, rank, at) => sum + counter[at] * index.points[rank], 0) : 0)

/**
 * A race's mastery level in a world: past the last powered level it goes on as prestige.
 *
 * @param {Bestiary | undefined} bestiary
 * @param {string} raceId
 * @param {import('./bestiary-content.mjs').BestiaryIndex} index
 */
export function masteryOf(bestiary, raceId, index) {
  const race = index.races.get(raceId)
  return race ? ladderLevel(race.ladder, pointsOf(bestiary?.races[raceId], index)) : 0
}

/**
 * Every point of a world's bestiary: its races' and its others'.
 *
 * @param {Bestiary | undefined} bestiary
 * @param {import('./bestiary-content.mjs').BestiaryIndex} index
 */
export const totalPointsOf = (bestiary, index) =>
  Object.entries(bestiary?.races ?? {}).filter(([raceId]) => index.races.has(raceId))
    .reduce((sum, [, counter]) => sum + pointsOf(counter, index), 0) + pointsOf(bestiary?.others, index)

/**
 * The world's hunter rank: the level its bestiary's points reach on the rank ladder. No end.
 *
 * @param {Bestiary | undefined} bestiary
 * @param {import('./bestiary-content.mjs').BestiaryIndex} index
 */
export const hunterRankOf = (bestiary, index) => ladderLevel(index.rank.ladder, totalPointsOf(bestiary, index))

/**
 * How many bosses of the roster the world has beaten at least once: the boss hunter's count.
 *
 * @param {Bestiary | undefined} bestiary
 * @param {import('./bestiary-content.mjs').BestiaryIndex} index
 */
export const distinctBossesOf = (bestiary, index) =>
  Object.keys(bestiary?.bosses ?? {}).filter((bossId) => index.bossIds.has(bossId)).length

/**
 * The boss hunter's level in a world.
 *
 * @param {Bestiary | undefined} bestiary
 * @param {import('./bestiary-content.mjs').BestiaryIndex} index
 */
export const hunterLevelOf = (bestiary, index) => levelFor(distinctBossesOf(bestiary, index), index.hunter.thresholds)

/** A counter with one more kill of a rank, and its first day set when it is the first. */
function counted(counter, rank, day) {
  const next = counter ? [...counter] : emptyCounter()
  if (!counter) next[RACE_FIRST_DAY] = day
  next[BESTIARY_RANKS.indexOf(rank)] += 1
  return next
}

/** A race's kill: its counter, and the news of a first kill or a new mastery level. */
function noteRace(bestiary, raceId, { rank, day, index }) {
  const before = masteryOf(bestiary, raceId, index)
  const races = { ...bestiary.races, [raceId]: counted(bestiary.races[raceId], rank, day) }
  const next = { ...bestiary, races }
  const news = []
  if (!bestiary.races[raceId]) news.push({ kind: 'race', id: raceId, discovered: true })
  const after = masteryOf(next, raceId, index)
  if (after > before) news.push({ kind: 'race', id: raceId, level: after })
  return { bestiary: next, news }
}

/** A boss of the roster beaten: its counter, and the news of a first time and a new hunter level. */
function noteBoss(bestiary, bossId, { rank, day, index }) {
  const before = hunterLevelOf(bestiary, index)
  const known = bestiary.bosses[bossId]
  const counter = known ? [...known] : [0, 0, day]
  counter[BOSS_BEATEN] += 1
  if (rank === 'legendary') counter[BOSS_LEGENDARY] += 1
  const next = { ...bestiary, bosses: { ...bestiary.bosses, [bossId]: counter } }
  const news = known ? [] : [{ kind: 'boss', id: bossId, discovered: true }]
  const after = hunterLevelOf(next, index)
  if (after > before) news.push({ kind: 'hunter', level: after })
  return { bestiary: next, news }
}

/**
 * Counts a kill in a world's bestiary. A monster of a race the bestiary knows counts for its race
 * (a boss of the roster too, under its rank); any other (a hand-made one) for the others. A boss
 * wave's boss of the roster also counts as beaten.
 *
 * @param {Bestiary | null | undefined} bestiary the world's, or none yet
 * @param {object} monster the monster killed, as the fight kept it
 * @param {{ day: number, index: import('./bestiary-content.mjs').BestiaryIndex | null }} kill
 *   `day` the game day of the kill
 * @returns {{ bestiary: Bestiary | null, news: News[] }} the same bestiary and no news without
 *   an index: content without a bestiary counts nothing
 */
export function noteKill(bestiary, monster, { day, index }) {
  if (!index) return { bestiary: bestiary ?? null, news: [] }
  const rank = rankOf(monster)
  let next = bestiary ?? emptyBestiary()
  const rankBefore = hunterRankOf(next, index)
  const news = []
  if (typeof monster.race === 'string' && index.races.has(monster.race)) {
    const noted = noteRace(next, monster.race, { rank, day, index })
    next = noted.bestiary
    news.push(...noted.news)
  } else {
    next = { ...next, others: counted(next.others, rank, day) }
  }
  if (BOSS_RANKS.has(rank) && index.bossIds.has(monster.id)) {
    const noted = noteBoss(next, monster.id, { rank, day, index })
    next = noted.bestiary
    news.push(...noted.news)
  }
  const rankAfter = hunterRankOf(next, index)
  if (rankAfter > rankBefore) news.push({ kind: 'rank', level: rankAfter })
  return { bestiary: next, news }
}

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const isCount = (value) => Number.isInteger(value) && value >= 0
const isList = (value, length) => Array.isArray(value) && value.length === length && value.every(isCount)
const isRaceCounter = (value) => isList(value, RACE_FIRST_DAY + 1) && killsOf(value) > 0
const isBossCounter = (value) =>
  isList(value, BOSS_FIRST_DAY + 1) && value[BOSS_BEATEN] > 0 && value[BOSS_LEGENDARY] <= value[BOSS_BEATEN]

/** The entries of an object whose value passes the test, copied. */
const kept = (value, isValid) => Object.fromEntries(Object.entries(isPlainObject(value) ? value : {})
  .filter(([, entry]) => isValid(entry)).map(([id, entry]) => [id, [...entry]]))

/**
 * A world's bestiary as stored, for `migrate`: counters that are not what the engine writes are
 * dropped. A save from before the bestiary has none, and so has a world that never killed.
 *
 * @param {unknown} value
 * @returns {Bestiary | null}
 */
export function normalizeBestiary(value) {
  if (!isPlainObject(value)) return null
  const bestiary = { races: kept(value.races, isRaceCounter), bosses: kept(value.bosses, isBossCounter) }
  if (isRaceCounter(value.others)) bestiary.others = [...value.others]
  // The mark of the one back-fill: kept even on an empty bestiary, so it never runs again.
  if (Number.isSafeInteger(value.filled) && value.filled >= 0) bestiary.filled = value.filled
  const isEmpty = Object.keys(bestiary.races).length === 0 && Object.keys(bestiary.bosses).length === 0 &&
    !bestiary.others && bestiary.filled === undefined
  return isEmpty ? null : bestiary
}
