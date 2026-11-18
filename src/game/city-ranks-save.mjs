// City ranks as the save keeps them, read back: `migrate` repairs what the plugin's own storage
// holds (normalizeCityRanks), `cleanSave` refuses a file whose ranks are not what the engine writes
// (checkCityRanks). A world keeps `cityRanks: { [cityId]: { rank, standing } }` only for cities it
// traded with or ranked; a save from before ranks has none and every city is at rank I. Pure.
import { CITY_RANK_MAX } from './city-rank-constants.mjs'
import { MAX_STANDING } from './city-ranks.mjs'
import { isReservedKey } from './save-layout.mjs'

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const isRank = (value) => Number.isInteger(value) && value >= 1 && value <= CITY_RANK_MAX
const isStanding = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_STANDING

/**
 * A world's city ranks as stored, repaired: entries that are not a rank and a standing are dropped.
 * Null when nothing is left, so a world without ranks keeps no field.
 *
 * @param {unknown} value
 * @returns {Record<string, { rank: number, standing: number }> | null}
 */
export function normalizeCityRanks(value) {
  if (!isPlainObject(value)) return null
  const kept = Object.entries(value)
    .filter(([cityId, entry]) => !isReservedKey(cityId) && isPlainObject(entry) && isRank(entry.rank) && isStanding(entry.standing))
    .map(([cityId, entry]) => [cityId, { rank: entry.rank, standing: entry.standing }])
  return kept.length ? Object.fromEntries(kept) : null
}

/**
 * A world's city ranks from a file, checked: every city must be a city of the content with ranks,
 * every rank a whole number from 1 to CITY_RANK_MAX and every standing a number from 0 to
 * MAX_STANDING. Absent is fine.
 *
 * @param {unknown} value
 * @param {string[]} rankedCityIds the cities of the content that have ranks
 * @returns {{ ok: true, value: Record<string, { rank: number, standing: number }> | null } |
 *   { ok: false, problem: [string, string] }}
 */
export function checkCityRanks(value, rankedCityIds) {
  if (value === undefined) return { ok: true, value: null }
  if (!isPlainObject(value)) return { ok: false, problem: ['cityRanks', 'is not an object'] }
  const checked = {}
  for (const [cityId, entry] of Object.entries(value)) {
    const at = `cityRanks.${cityId}`
    if (isReservedKey(cityId) || !rankedCityIds.includes(cityId)) return { ok: false, problem: [at, 'is not a city with ranks'] }
    if (!isPlainObject(entry) || Object.keys(entry).some((key) => key !== 'rank' && key !== 'standing')) {
      return { ok: false, problem: [at, 'is not a rank and a standing'] }
    }
    if (!isRank(entry.rank)) return { ok: false, problem: [`${at}.rank`, `is not a rank from 1 to ${CITY_RANK_MAX}`] }
    if (!isStanding(entry.standing)) return { ok: false, problem: [`${at}.standing`, 'is not a standing in range'] }
    checked[cityId] = { rank: entry.rank, standing: entry.standing }
  }
  return { ok: true, value: Object.keys(checked).length ? checked : null }
}
