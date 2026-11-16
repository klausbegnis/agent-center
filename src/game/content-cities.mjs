// Checks game/cities.json, the market's cities: what each produces and wants, the world level it
// opens at and its banner. Pure: problems come back as text, nothing is thrown.
import { MATERIALS } from './skills.mjs'

const CITY_KEYS = ['id', 'name', 'tagline', 'opensAt', 'produces', 'wants', 'banner', 'bannerAlt']
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/
/** Banners are served with the UI, so the panel, the tab and the external view all reach them. */
const BANNER_PATH = /^ui\/cities\/[a-z0-9]+(-[a-z0-9]+)*\.png$/
/** A name and a tagline sit on a card in a 380 px sidebar. */
const TEXT_LIMIT = 60
/** A world level a city could ever open at; past it a city is a mistake, not a goal. */
const MAX_OPENS_AT = 1000

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isShortText = (value, limit = TEXT_LIMIT) =>
  typeof value === 'string' && value.trim() !== '' && value.length <= limit

/** Problems with a list of materials: non-empty, known, each once. */
function checkMaterials(name, key, list) {
  const isValid = Array.isArray(list) && list.length > 0 && list.every((id) => MATERIALS.includes(id)) &&
    new Set(list).size === list.length
  return isValid ? [] : [`${name}: "${key}" must list known materials, each once`]
}

function checkCity(entry, index, seenIds) {
  if (!isObject(entry)) return [`city[${index}] must be an object`]
  const name = `city "${entry.id ?? index}"`
  const problems = Object.keys(entry).filter((key) => !CITY_KEYS.includes(key))
    .map((key) => `${name}: "${key}" is not a known key`)
  if (typeof entry.id !== 'string' || !KEBAB_CASE.test(entry.id)) problems.push(`${name}: "id" must be in kebab-case`)
  else if (seenIds.has(entry.id)) problems.push(`${name}: another city has the same id`)
  seenIds.add(entry.id)
  if (!isShortText(entry.name)) problems.push(`${name}: "name" must be text of at most ${TEXT_LIMIT} characters`)
  if (!isShortText(entry.tagline)) problems.push(`${name}: "tagline" must be text of at most ${TEXT_LIMIT} characters`)
  if (!Number.isInteger(entry.opensAt) || entry.opensAt < 1 || entry.opensAt > MAX_OPENS_AT) {
    problems.push(`${name}: "opensAt" must be a world level from 1 to ${MAX_OPENS_AT}`)
  }
  problems.push(...checkMaterials(name, 'produces', entry.produces), ...checkMaterials(name, 'wants', entry.wants))
  if (Array.isArray(entry.produces) && Array.isArray(entry.wants) && entry.wants.some((id) => entry.produces.includes(id))) {
    problems.push(`${name}: a city cannot want what it produces`)
  }
  if (typeof entry.banner !== 'string' || !BANNER_PATH.test(entry.banner)) {
    problems.push(`${name}: "banner" must be a PNG under ui/cities/`)
  }
  if (!isShortText(entry.bannerAlt, 200)) problems.push(`${name}: "bannerAlt" must describe the banner`)
  return problems
}

/**
 * Everything wrong with a parsed game/cities.json. Empty when it is valid.
 *
 * @param {unknown} data
 * @returns {string[]}
 */
export function validateCities(data) {
  if (!isObject(data) || !Array.isArray(data.cities)) return ['must be an object with a "cities" list']
  const problems = Object.keys(data).filter((key) => key !== 'cities').map((key) => `"${key}" is not a known key`)
  const seenIds = new Set()
  data.cities.forEach((entry, index) => problems.push(...checkCity(entry, index, seenIds)))
  if (!data.cities.some((entry) => isObject(entry) && entry.opensAt === 1)) {
    problems.push('needs a city that opens at world level 1, so every world has a market')
  }
  return problems
}
