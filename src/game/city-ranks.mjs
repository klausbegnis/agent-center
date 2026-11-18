// A city's rank, I to V, per world: the standing a world earns by trading there, and the charter
// it buys there to open the next rank once its standing is enough. A rank lowers the fee in that
// city, widens its stall and gives the world one small perk per rank. A world keeps `cityRanks:
// { [cityId]: { rank, standing } }` only for cities it traded with; a city missing from it is at
// rank I with no standing, so a save from before ranks loads unchanged. Pure.
import {
  CHARTER_COINS,
  CHARTER_UNITS,
  CITY_RANK_FEE_CUT,
  CITY_RANK_MAX,
  CITY_STANDING,
  EXTRA_OFFER_RANK,
  RANKED_RELIC_CHANCE,
  RELIC_RANK,
  TIER_BONUS_RANK
} from './city-rank-constants.mjs'
import { MARKET_FEE_FLOOR, MARKET_MAX_COINS, MATERIAL_BASE_VALUES, REWARD_GROWTH, STALL_RELIC_CHANCE } from './constants.mjs'
import { worldLevel } from './progression.mjs'
import { marketFeeOf } from './settlement-effects.mjs'

/** @typedef {import('./city-ranks-content.mjs').CityRankIndex} CityRankIndex */

/** The most standing a city can keep: far past rank V, so a file cannot keep an absurd number. */
export const MAX_STANDING = 1e15

/**
 * A city's rank and standing in a world.
 *
 * @param {{ cityRanks?: Record<string, { rank: number, standing: number }> } | null | undefined} world
 * @param {string} cityId
 * @returns {{ rank: number, standing: number }}
 */
export function cityStandingOf(world, cityId) {
  const entry = world?.cityRanks?.[cityId]
  return entry ? { rank: entry.rank, standing: entry.standing } : { rank: 1, standing: 0 }
}

/** A city's rank in a world, 1 to CITY_RANK_MAX. */
export const cityRankOf = (world, cityId) => cityStandingOf(world, cityId).rank

/** The world with a city's rank and standing set. */
function withStanding(world, cityId, entry) {
  return { ...world, cityRanks: { ...world.cityRanks, [cityId]: entry } }
}

/** What a sum of coins is worth in standing at a world level: standing grows alike at every level. */
const standingOf = (value, level) => value / REWARD_GROWTH ** level

/**
 * The world after a deal in a city, its standing there grown by what the deal moved: the base value
 * of every unit sold or bought, or, when no material moved (a stall purchase), the coins paid.
 * The same world when nothing changed.
 *
 * @param {object} before the world before the deal
 * @param {object} after the world after it
 * @param {string} cityId
 * @returns {object}
 */
export function noteTrade(before, after, cityId) {
  if (after === before) return after
  let value = 0
  for (const [materialId, base] of Object.entries(MATERIAL_BASE_VALUES)) {
    value += Math.abs((after.materials?.[materialId] ?? 0) - (before.materials?.[materialId] ?? 0)) * base
  }
  if (value === 0) value = Math.max(0, (before.coins ?? 0) - (after.coins ?? 0))
  if (!(value > 0)) return after
  const { rank, standing } = cityStandingOf(after, cityId)
  const grown = Math.min(MAX_STANDING, standing + standingOf(value, worldLevel(after.skills)))
  return withStanding(after, cityId, { rank, standing: grown })
}

/**
 * The market's fee in a city: the world's (MARKET_FEE less the Storehouse's cut) less
 * CITY_RANK_FEE_CUT for each rank above the first, never below what the cuts can reach together.
 *
 * @param {object} world
 * @param {string} cityId
 * @returns {number}
 */
export function cityFeeOf(world, cityId) {
  const floor = MARKET_FEE_FLOOR - CITY_RANK_FEE_CUT * (CITY_RANK_MAX - 1)
  return Math.max(floor, marketFeeOf(world) - CITY_RANK_FEE_CUT * (cityRankOf(world, cityId) - 1))
}

/**
 * What a city's stall offers more at a rank: pieces of gear beyond STALL_OFFERS, tiers above the
 * usual and the day's chance of a relic.
 *
 * @param {number} rank
 * @returns {{ extraOffers: number, tierBonus: number, relicChance: number }}
 */
export function stallExtras(rank) {
  return {
    extraOffers: rank >= EXTRA_OFFER_RANK ? 1 : 0,
    tierBonus: rank >= TIER_BONUS_RANK ? 1 : 0,
    relicChance: rank >= RELIC_RANK ? RANKED_RELIC_CHANCE : STALL_RELIC_CHANCE
  }
}

const scaled = (base, level) => Math.max(1, Math.round(base * REWARD_GROWTH ** level))

/**
 * The charter that opens a rank of a city: its price at the world's level, in coins and in units
 * of each material the city wants, and the standing it needs. Null past the last rank.
 *
 * @param {{ wants: string[] }} city
 * @param {number} rank the rank it opens, 2 to CITY_RANK_MAX
 * @param {number} level the world level
 * @returns {{ rank: number, coins: number, materials: Record<string, number>, standing: number } | null}
 */
export function charterPrice(city, rank, level) {
  if (!(rank >= 2 && rank <= CITY_RANK_MAX)) return null
  const units = scaled(CHARTER_UNITS[rank - 1], level)
  return {
    rank,
    coins: scaled(CHARTER_COINS[rank - 1], level),
    materials: Object.fromEntries(city.wants.map((materialId) => [materialId, units])),
    standing: CITY_STANDING[rank - 1]
  }
}

/** Why a city's next charter cannot be bought now, as a word the UI turns into text. */
const PROBLEMS = Object.freeze({
  unknown: 'there is no such city',
  closed: 'the city does not trade with this world yet',
  noRanks: 'the city has no ranks',
  top: 'the city is at its last rank',
  standing: 'the world has not traded enough there yet',
  coins: 'the world has not enough coins',
  materials: 'the world has not enough of the materials'
})

/** The city, its next charter and the reason it cannot be bought, or none. */
function charterState(world, city, index) {
  if (!city) return { problem: 'unknown' }
  const level = worldLevel(world.skills)
  if (level < city.opensAt) return { problem: 'closed' }
  if (!index?.byCity.has(city.id)) return { problem: 'noRanks' }
  const { rank, standing } = cityStandingOf(world, city.id)
  const price = charterPrice(city, rank + 1, level)
  if (!price) return { problem: 'top' }
  if (standing < price.standing) return { price, problem: 'standing' }
  if (!((world.coins ?? 0) >= price.coins)) return { price, problem: 'coins' }
  const short = Object.entries(price.materials).some(([id, amount]) => !((world.materials[id] ?? 0) >= amount))
  return { price, problem: short ? 'materials' : null }
}

/**
 * Why a world cannot buy a city's next charter now, or null when it can.
 *
 * @param {object} world
 * @param {object[]} cities
 * @param {CityRankIndex | null} index
 * @param {string} cityId
 * @returns {string | null}
 */
export function charterProblem(world, cities, index, cityId) {
  const { problem } = charterState(world, cities.find((entry) => entry.id === cityId), index)
  return problem ? PROBLEMS[problem] : null
}

/** The word for why the next charter cannot be bought, for the view; null when it can. */
export function charterBlock(world, city, index) {
  return charterState(world, city, index).problem
}

/**
 * Buys a city's next charter: the coins and materials are paid and the city rises one rank. Its
 * standing stays, so it counts on towards the next. Unchanged when charterProblem says why not.
 *
 * @param {object} world
 * @param {object[]} cities
 * @param {CityRankIndex | null} index
 * @param {string} cityId
 * @returns {object}
 */
export function buyCharter(world, cities, index, cityId) {
  const city = cities.find((entry) => entry.id === cityId)
  const { price, problem } = charterState(world, city, index)
  if (problem || !price) return world
  const materials = { ...world.materials }
  for (const [id, amount] of Object.entries(price.materials)) materials[id] -= amount
  const coins = world.coins - price.coins
  if (!(coins >= 0 && coins <= MARKET_MAX_COINS)) return world
  const { standing } = cityStandingOf(world, cityId)
  return withStanding({ ...world, coins, materials }, cityId, { rank: price.rank, standing })
}

/**
 * The perks of every rank a world's cities reached, as world effects summed with the bestiary's and
 * the settlement's under LEGENDARY_EFFECT_CAPS.
 *
 * @param {object} world
 * @param {CityRankIndex | null} index
 * @returns {import('./legendary-effects.mjs').Effect[]}
 */
export function cityRankEffects(world, index) {
  if (!index || !world?.cityRanks) return []
  const effects = []
  for (const [cityId, ranks] of index.byCity) {
    const rank = cityRankOf(world, cityId)
    for (const charter of ranks.charters.slice(0, rank - 1)) effects.push(charter.effect)
  }
  return effects
}

