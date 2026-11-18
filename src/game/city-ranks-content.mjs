// Checks and indexes the ranks of game/cities.json: the five banners each city shows through its
// ranks, the charter that opens each rank above the first with the small perk it gives, the
// legendary equipment its stall sells at the last rank, and the titles of the ranks. A city with
// no `ranks` stays at rank I (older content and tests). Pure: problems come back as text.
import { CITY_RANK_MAX } from './city-rank-constants.mjs'
import { LEGENDARY_EFFECT_CAPS } from './constants.mjs'
import { effectProblems } from './legendary-content.mjs'

const RANK_KEYS = ['banners', 'charters', 'legendary']
const BANNER_KEYS = ['banner', 'alt']
const CHARTER_KEYS = ['name', 'perk', 'effect']
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const BANNER_PATH = /^ui\/cities\/[a-z0-9]+(-[a-z0-9]+)*\.png$/
/** A charter's and a perk's name sit on a line of a 380 px sidebar. */
const NAME_LIMIT = 40

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isText = (value, limit) => typeof value === 'string' && value.trim() !== '' && value.length <= limit
const unknownKeys = (name, entry, keys) =>
  Object.keys(entry).filter((key) => !keys.includes(key)).map((key) => `${name}: "${key}" is not a known key`)

function bannerProblems(name, banners) {
  if (!Array.isArray(banners) || banners.length !== CITY_RANK_MAX) {
    return [`${name}: "banners" must list ${CITY_RANK_MAX} banners, one per rank`]
  }
  return banners.flatMap((entry, at) => {
    const label = `${name} banner ${at + 1}`
    if (!isObject(entry)) return [`${label} must be an object`]
    const problems = unknownKeys(label, entry, BANNER_KEYS)
    if (typeof entry.banner !== 'string' || !BANNER_PATH.test(entry.banner)) problems.push(`${label}: "banner" must be a PNG under ui/cities/`)
    if (!isText(entry.alt, 200)) problems.push(`${label}: "alt" must describe the banner`)
    return problems
  })
}

function charterProblems(name, charters) {
  if (!Array.isArray(charters) || charters.length !== CITY_RANK_MAX - 1) {
    return [`${name}: "charters" must list ${CITY_RANK_MAX - 1} charters, one per rank above the first`]
  }
  return charters.flatMap((entry, at) => {
    const label = `${name} charter ${at + 2}`
    if (!isObject(entry)) return [`${label} must be an object`]
    const problems = unknownKeys(label, entry, CHARTER_KEYS)
    if (!isText(entry.name, NAME_LIMIT)) problems.push(`${label}: "name" must be text of at most ${NAME_LIMIT} characters`)
    if (!isText(entry.perk, NAME_LIMIT)) problems.push(`${label}: "perk" must be text of at most ${NAME_LIMIT} characters`)
    return [...problems, ...effectProblems(label, entry.effect, 'world')]
  })
}

/**
 * Everything wrong with a city's `ranks`. Empty when it is valid or absent.
 *
 * @param {string} name how the problems name the city
 * @param {unknown} ranks
 * @returns {string[]}
 */
export function cityRankProblems(name, ranks) {
  if (ranks === undefined) return []
  if (!isObject(ranks)) return [`${name}: "ranks" must be an object`]
  const problems = unknownKeys(`${name} ranks`, ranks, RANK_KEYS)
  problems.push(...bannerProblems(name, ranks.banners), ...charterProblems(name, ranks.charters))
  const legendary = ranks.legendary ?? []
  if (!Array.isArray(legendary) || !legendary.every((id) => typeof id === 'string' && KEBAB_CASE.test(id)) ||
    new Set(legendary).size !== legendary.length) {
    problems.push(`${name}: "legendary" must list legendary equipment ids, each once`)
  }
  return problems
}

/**
 * Problems of the whole file's ranks: the titles, and every perk of every city together under each
 * cap, since a world can raise every city to its last rank.
 *
 * @param {{ cities: object[], rankTitles?: unknown }} data
 * @returns {string[]}
 */
export function rankTotalProblems(data) {
  const problems = []
  const ranked = data.cities.filter((city) => isObject(city) && city.ranks !== undefined)
  if (data.rankTitles === undefined) {
    return ranked.length ? ['"rankTitles" must name the ranks when a city has ranks'] : []
  }
  if (!Array.isArray(data.rankTitles) || data.rankTitles.length !== CITY_RANK_MAX ||
    !data.rankTitles.every((title) => isText(title, NAME_LIMIT))) {
    problems.push(`"rankTitles" must list ${CITY_RANK_MAX} short titles`)
  }
  const totals = {}
  for (const city of ranked) {
    for (const charter of Array.isArray(city.ranks?.charters) ? city.ranks.charters : []) {
      const effect = charter?.effect
      if (isObject(effect) && typeof effect.amount === 'number') totals[effect.effect] = (totals[effect.effect] ?? 0) + effect.amount
    }
  }
  for (const [type, total] of Object.entries(totals)) {
    if (Object.hasOwn(LEGENDARY_EFFECT_CAPS, type) && total > LEGENDARY_EFFECT_CAPS[type] + 1e-9) {
      problems.push(`the charters' ${type} perks add up to ${total}, more than the cap ${LEGENDARY_EFFECT_CAPS[type]}`)
    }
  }
  return problems
}

/**
 * @typedef {{ banners: { banner: string, alt: string }[], charters: { name: string, perk: string,
 *   effect: object }[], legendary: string[] }} CityRanks
 * @typedef {{ titles: string[], byCity: Map<string, CityRanks> }} CityRankIndex
 */

const indexes = new WeakMap()

/**
 * The ranks of a set of content, indexed once per cities file. Null when no city has ranks.
 *
 * @param {{ cities?: { cities: object[], rankTitles?: string[] } } | null | undefined} content
 * @returns {CityRankIndex | null}
 */
export function cityRankIndexOf(content) {
  const data = content?.cities
  if (!data || !Array.isArray(data.cities)) return null
  if (!indexes.has(data)) {
    const byCity = new Map(data.cities.filter((city) => city.ranks)
      .map((city) => [city.id, { ...city.ranks, legendary: city.ranks.legendary ?? [] }]))
    indexes.set(data, byCity.size ? { titles: data.rankTitles ?? [], byCity } : null)
  }
  return indexes.get(data)
}
