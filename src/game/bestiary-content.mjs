// Checks game/bestiary.json (already parsed) and indexes it for the engine: the points a kill of
// each rank is worth, the ladder of each race's mastery (bestiary-ladder.mjs) and what each level
// gives (damage against that race, and the race's own small perk every few levels), the world's
// hunter rank, and the boss hunter's track. Every bonus is an effect of the closed set legendary
// loot uses (legendary-content.mjs), with the scope `world`. Pure: problems come back as text.
import { LEGENDARY_EFFECT_CAPS, MONSTER_RANKS } from './constants.mjs'
import { effectProblems } from './legendary-content.mjs'

const TOP_KEYS = ['points', 'mastery', 'races', 'rank', 'hunter']
const MASTERY_KEYS = ['levels', 'firstCost', 'growth', 'perLevel', 'perkEvery']
const RACE_KEYS = ['id', 'name', 'title', 'scale', 'perk']
const RANK_KEYS = ['firstCost', 'growth', 'half', 'effect']
const HUNTER_KEYS = ['thresholds', 'levels']
/** A race's ladder may be scaled for how often it comes up, within these bounds. */
const SCALE_MIN = 0.5
const SCALE_MAX = 4
/** A ladder's growth: each level costs this much more than the one before, within these bounds. */
const GROWTH_MIN = 1.01
const GROWTH_MAX = 3
const WORLD = 'world'

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isFilledString = (value) => typeof value === 'string' && value.trim() !== ''
const isWhole = (value, min = 1) => Number.isInteger(value) && value >= min
const isNumberIn = (value, min, max) => typeof value === 'number' && value >= min && value <= max
const unknownKeys = (object, known, label) =>
  Object.keys(object).filter((key) => !known.includes(key)).map((key) => `${label}: "${key}" is not a known key`)

/** Whole numbers above 0, each larger than the one before. */
const isRisingCounts = (value) => Array.isArray(value) && value.length > 0 &&
  value.every((count, at) => isWhole(count) && (at === 0 || count > value[at - 1]))

/** The most an effect reaches when it is given `times` times: its type's cap bounds it. */
function capProblem(name, effect, times) {
  const cap = LEGENDARY_EFFECT_CAPS[effect?.effect]
  if (cap === undefined || typeof effect.amount !== 'number') return []
  return effect.amount * times > cap + 1e-9 ? [`${name}: ${times} times ${effect.amount} is more than the cap ${cap}`] : []
}

/** A ladder's first cost (whole, from 1) and growth. */
function ladderProblems(label, ladder) {
  const problems = []
  if (!isWhole(ladder.firstCost)) problems.push(`${label}: "firstCost" must be a whole number from 1`)
  if (!isNumberIn(ladder.growth, GROWTH_MIN, GROWTH_MAX)) {
    problems.push(`${label}: "growth" must be a number from ${GROWTH_MIN} to ${GROWTH_MAX}`)
  }
  return problems
}

function checkPoints(points) {
  if (!isObject(points)) return ['"points" must give the points of a kill of each rank']
  const ranks = Object.keys(MONSTER_RANKS)
  const problems = unknownKeys(points, ranks, 'points')
  for (const rank of ranks.filter((each) => !isWhole(points[each]))) {
    problems.push(`points: "${rank}" must be a whole number from 1`)
  }
  return problems
}

function checkMastery(mastery, raceIds) {
  if (!isObject(mastery)) return ['"mastery" must be an object']
  const problems = [...unknownKeys(mastery, MASTERY_KEYS, 'mastery'), ...ladderProblems('mastery', mastery)]
  if (!isWhole(mastery.levels)) problems.push('mastery: "levels" (the powered ones) must be a whole number from 1')
  const levels = isWhole(mastery.levels) ? mastery.levels : 0
  const perLevel = mastery.perLevel
  problems.push(...effectProblems('mastery.perLevel', perLevel, WORLD, { raceIds }))
  if (isObject(perLevel) && perLevel.effect !== 'raceDamage') {
    problems.push('mastery.perLevel: must be a raceDamage effect; the race it names is the one mastered')
  }
  if (isObject(perLevel) && perLevel.races !== undefined) problems.push('mastery.perLevel: names no races; each race gets its own')
  problems.push(...capProblem('mastery.perLevel', perLevel, levels))
  if (!isWhole(mastery.perkEvery) || mastery.perkEvery > levels) {
    problems.push('mastery: "perkEvery" must be a whole number of levels, at most the powered ones')
  }
  return problems
}

function checkRace(race, index, { raceIds, seen, perkTimes }) {
  if (!isObject(race)) return [`races[${index}] must be an object`]
  const name = `race "${race.id ?? index}"`
  const problems = unknownKeys(race, RACE_KEYS, name)
  if (!raceIds.includes(race.id)) problems.push(`${name}: "id" must be a race of game/races.json`)
  else if (seen.has(race.id)) problems.push(`${name}: listed twice`)
  seen.add(race.id)
  for (const key of ['name', 'title']) {
    if (!isFilledString(race[key])) problems.push(`${name}: "${key}" must be a non-empty string`)
  }
  if (race.scale !== undefined && !isNumberIn(race.scale, SCALE_MIN, SCALE_MAX)) {
    problems.push(`${name}: "scale" must be a number from ${SCALE_MIN} to ${SCALE_MAX}`)
  }
  problems.push(...effectProblems(`${name} perk`, race.perk, WORLD, { raceIds }))
  return [...problems, ...capProblem(`${name} perk`, race.perk, perkTimes)]
}

function checkRank(rank, raceIds) {
  if (!isObject(rank)) return ['"rank" must be an object']
  const problems = [...unknownKeys(rank, RANK_KEYS, 'rank'), ...ladderProblems('rank', rank)]
  if (!isWhole(rank.half)) problems.push('rank: "half" must be a whole number of ranks from 1')
  return [...problems, ...effectProblems('rank', rank.effect, WORLD, { raceIds })]
}

function checkHunter(hunter, bossCount, raceIds) {
  if (!isObject(hunter)) return ['"hunter" must be an object']
  const problems = unknownKeys(hunter, HUNTER_KEYS, 'hunter')
  const { thresholds, levels } = hunter
  if (!isRisingCounts(thresholds) || (bossCount !== null && thresholds.at(-1) > bossCount)) {
    problems.push('hunter: "thresholds" must be rising whole numbers of distinct bosses, at most the roster')
  }
  if (!Array.isArray(levels) || levels.length !== (thresholds?.length ?? -1)) {
    return [...problems, 'hunter: "levels" must list the effects of each threshold']
  }
  levels.forEach((effects, at) => {
    const name = `hunter level ${at + 1}`
    if (!Array.isArray(effects) || effects.length === 0) problems.push(`${name}: must be a non-empty list of effects`)
    else effects.forEach((effect) => problems.push(...effectProblems(name, effect, WORLD, { raceIds })))
  })
  return problems
}

/**
 * Everything wrong with a parsed game/bestiary.json. Empty when it is valid.
 *
 * @param {unknown} data
 * @param {{ races?: { races: { id: string }[] }, bosses?: { bosses: { id: string }[] } }} others the
 *   parsed races, which the file must cover one by one, and bosses, which bound the hunter's track
 * @returns {string[]}
 */
export function validateBestiary(data, { races, bosses } = {}) {
  if (!isObject(data)) return ['must be an object with "points", "mastery", "races", "rank" and "hunter"']
  const raceIds = (races?.races ?? []).map((race) => race.id)
  const problems = unknownKeys(data, TOP_KEYS, 'the file')
  problems.push(...checkPoints(data.points), ...checkMastery(data.mastery, raceIds), ...checkRank(data.rank, raceIds))
  if (!Array.isArray(data.races)) return [...problems, '"races" must be a list']
  const { levels, perkEvery } = data.mastery ?? {}
  const perkTimes = isWhole(levels) && isWhole(perkEvery) ? Math.floor(levels / perkEvery) : 0
  const context = { raceIds, seen: new Set(), perkTimes }
  data.races.forEach((race, index) => problems.push(...checkRace(race, index, context)))
  for (const id of raceIds.filter((raceId) => !context.seen.has(raceId))) {
    problems.push(`race "${id}" of game/races.json has no entry`)
  }
  const bossCount = Array.isArray(bosses?.bosses) ? bosses.bosses.length : null
  return [...problems, ...checkHunter(data.hunter, bossCount, raceIds)]
}

/**
 * @typedef {import('./bestiary-ladder.mjs').Ladder} Ladder
 * @typedef {{ id: string, name: string, title: string, ladder: Ladder, perk: object }} RaceMastery
 * @typedef {{ races: Map<string, RaceMastery>, raceIds: string[], bossIds: Set<string>,
 *   bossIdList: string[], points: Record<string, number>, perLevel: object, levels: number,
 *   perkEvery: number, rank: { ladder: Ladder, half: number, effect: object },
 *   hunter: { thresholds: number[], levels: object[][] } }} BestiaryIndex
 */

/**
 * The bestiary indexed for the engine.
 *
 * @param {object | null | undefined} data a valid bestiary file, or none
 * @param {{ bosses: { id: string }[] } | null | undefined} bosses the roster whose kills it counts
 * @returns {BestiaryIndex | null} null without a bestiary: nothing is counted and nothing given
 */
export function indexBestiary(data, bosses) {
  if (!data) return null
  const { levels, firstCost, growth, perLevel, perkEvery } = data.mastery
  const races = new Map(data.races.map((race) => [race.id, {
    id: race.id,
    name: race.name,
    title: race.title,
    ladder: { firstCost, growth, scale: race.scale ?? 1 },
    perk: race.perk
  }]))
  const bossIdList = (bosses?.bosses ?? []).map((boss) => boss.id)
  const { rank } = data
  return {
    races,
    raceIds: data.races.map((race) => race.id),
    bossIds: new Set(bossIdList),
    bossIdList,
    points: { ...data.points },
    perLevel,
    levels,
    perkEvery,
    rank: { ladder: { firstCost: rank.firstCost, growth: rank.growth }, half: rank.half, effect: rank.effect },
    hunter: { thresholds: [...data.hunter.thresholds], levels: data.hunter.levels }
  }
}

const indexes = new WeakMap()
/** The key of content without bosses. */
const NO_BOSSES = {}

/**
 * The bestiary index of a set of content, built once per pair of bestiary and bosses files.
 *
 * @param {{ bestiary?: object, bosses?: object } | null | undefined} content
 * @returns {BestiaryIndex | null}
 */
export function bestiaryIndexOf(content) {
  const data = content?.bestiary
  if (!data) return null
  if (!indexes.has(data)) indexes.set(data, new WeakMap())
  const byBosses = indexes.get(data)
  const bossesKey = content.bosses ?? NO_BOSSES
  if (!byBosses.has(bossesKey)) byBosses.set(bossesKey, indexBestiary(data, content.bosses))
  return byBosses.get(bossesKey)
}
