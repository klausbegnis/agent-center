// Checks game/bestiary.json (already parsed) and indexes it for the engine: the kill thresholds of
// each race's mastery levels, what each level gives (damage against that race and the race's own
// small perk), and the boss hunter's track. Every bonus is an effect of the closed set legendary
// loot uses (legendary-content.mjs), with the scope `world`. Pure: problems come back as text.
import { LEGENDARY_EFFECT_CAPS } from './constants.mjs'
import { effectProblems } from './legendary-content.mjs'

const TOP_KEYS = ['mastery', 'races', 'hunter']
const MASTERY_KEYS = ['thresholds', 'perLevel', 'perkLevels']
const RACE_KEYS = ['id', 'name', 'scale', 'perk']
const HUNTER_KEYS = ['thresholds', 'levels']
/** A race's thresholds may be scaled for how often it comes up, within these bounds. */
const SCALE_MIN = 0.25
const SCALE_MAX = 4
const WORLD = 'world'

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isFilledString = (value) => typeof value === 'string' && value.trim() !== ''
const unknownKeys = (object, known, label) =>
  Object.keys(object).filter((key) => !known.includes(key)).map((key) => `${label}: "${key}" is not a known key`)

/** Whole numbers above 0, each larger than the one before. */
const isRisingCounts = (value) => Array.isArray(value) && value.length > 0 &&
  value.every((count, at) => Number.isInteger(count) && count > 0 && (at === 0 || count > value[at - 1]))

/** The most an effect reaches when it is given `times` times: its type's cap bounds it. */
function capProblem(name, effect, times) {
  const cap = LEGENDARY_EFFECT_CAPS[effect?.effect]
  if (cap === undefined || typeof effect.amount !== 'number') return []
  return effect.amount * times > cap + 1e-9 ? [`${name}: ${times} times ${effect.amount} is more than the cap ${cap}`] : []
}

function checkMastery(mastery, raceIds) {
  if (!isObject(mastery)) return ['"mastery" must be an object']
  const problems = unknownKeys(mastery, MASTERY_KEYS, 'mastery')
  if (!isRisingCounts(mastery.thresholds)) problems.push('mastery: "thresholds" must be rising whole numbers above 0')
  const levels = Array.isArray(mastery.thresholds) ? mastery.thresholds.length : 0
  const perLevel = mastery.perLevel
  problems.push(...effectProblems('mastery.perLevel', perLevel, WORLD, { raceIds }))
  if (isObject(perLevel) && perLevel.effect !== 'raceDamage') {
    problems.push('mastery.perLevel: must be a raceDamage effect; the race it names is the one mastered')
  }
  if (isObject(perLevel) && perLevel.races !== undefined) problems.push('mastery.perLevel: names no races; each race gets its own')
  problems.push(...capProblem('mastery.perLevel', perLevel, levels))
  const perks = mastery.perkLevels
  const isPerkLevels = isRisingCounts(perks) && perks.at(-1) <= levels
  if (!isPerkLevels) problems.push('mastery: "perkLevels" must be rising mastery levels from 1 to the last')
  return problems
}

function checkRace(race, index, { raceIds, seen, perkTimes }) {
  if (!isObject(race)) return [`races[${index}] must be an object`]
  const name = `race "${race.id ?? index}"`
  const problems = unknownKeys(race, RACE_KEYS, name)
  if (!raceIds.includes(race.id)) problems.push(`${name}: "id" must be a race of game/races.json`)
  else if (seen.has(race.id)) problems.push(`${name}: listed twice`)
  seen.add(race.id)
  if (!isFilledString(race.name)) problems.push(`${name}: "name" must be a non-empty string`)
  const scale = race.scale
  if (scale !== undefined && !(typeof scale === 'number' && scale >= SCALE_MIN && scale <= SCALE_MAX)) {
    problems.push(`${name}: "scale" must be a number from ${SCALE_MIN} to ${SCALE_MAX}`)
  }
  problems.push(...effectProblems(`${name} perk`, race.perk, WORLD, { raceIds }))
  return [...problems, ...capProblem(`${name} perk`, race.perk, perkTimes)]
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
  if (!isObject(data)) return ['must be an object with "mastery", "races" and "hunter"']
  const raceIds = (races?.races ?? []).map((race) => race.id)
  const problems = unknownKeys(data, TOP_KEYS, 'the file')
  problems.push(...checkMastery(data.mastery, raceIds))
  if (!Array.isArray(data.races)) return [...problems, '"races" must be a list']
  const perkTimes = Array.isArray(data.mastery?.perkLevels) ? data.mastery.perkLevels.length : 0
  const context = { raceIds, seen: new Set(), perkTimes }
  data.races.forEach((race, index) => problems.push(...checkRace(race, index, context)))
  for (const id of raceIds.filter((raceId) => !context.seen.has(raceId))) {
    problems.push(`race "${id}" of game/races.json has no entry`)
  }
  const bossCount = Array.isArray(bosses?.bosses) ? bosses.bosses.length : null
  return [...problems, ...checkHunter(data.hunter, bossCount, raceIds)]
}

/**
 * @typedef {{ id: string, name: string, thresholds: number[], perk: object }} RaceMastery
 * @typedef {{ races: Map<string, RaceMastery>, raceIds: string[], bossIds: Set<string>,
 *   bossIdList: string[], perLevel: object, perkLevels: number[], levels: number,
 *   hunter: { thresholds: number[], levels: object[][] } }} BestiaryIndex
 */

/** A race's thresholds: the shared ones times its scale, whole and still rising. */
function scaledThresholds(thresholds, scale = 1) {
  const scaled = []
  for (const threshold of thresholds) {
    const value = Math.max(1, Math.round(threshold * scale))
    scaled.push(scaled.length && value <= scaled.at(-1) ? scaled.at(-1) + 1 : value)
  }
  return scaled
}

/**
 * The bestiary indexed for the engine.
 *
 * @param {object | null | undefined} data a valid bestiary file, or none
 * @param {{ bosses: { id: string }[] } | null | undefined} bosses the roster whose kills it counts
 * @returns {BestiaryIndex | null} null without a bestiary: nothing is counted and nothing given
 */
export function indexBestiary(data, bosses) {
  if (!data) return null
  const { thresholds, perLevel, perkLevels } = data.mastery
  const races = new Map(data.races.map((race) => [race.id, {
    id: race.id,
    name: race.name,
    thresholds: scaledThresholds(thresholds, race.scale),
    perk: race.perk
  }]))
  const bossIdList = (bosses?.bosses ?? []).map((boss) => boss.id)
  return {
    races,
    raceIds: data.races.map((race) => race.id),
    bossIds: new Set(bossIdList),
    bossIdList,
    perLevel,
    perkLevels: [...perkLevels],
    levels: thresholds.length,
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
