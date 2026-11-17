// The market's prices as pure numbers: what a city pays for a material and what it asks, how a
// sale or a purchase moves that price, and how much a sum buys. A price is the city's usual
// price times e ** -pressure; every sale is paid at most the base value less the fee and every
// purchase costs at least the base value plus the fee, so no trade can make money.
import {
  MARKET_CITY_FACTORS,
  MARKET_DEPTH_BASE,
  MARKET_FEE,
  MARKET_PRESSURE_MAX,
  MARKET_PRESSURE_MIN,
  REWARD_GROWTH
} from './constants.mjs'

/**
 * @typedef {{ base: number, usual: number, pressure: number, depth: number }} PricePoint a
 *   material in a city: its base value, the city's usual price, the pressure on it now and the
 *   world's depth (units that move the price by a factor of e)
 */

/**
 * What a city thinks of a material: one it wants, one it produces, or neither.
 *
 * @param {{ produces: string[], wants: string[] }} city
 * @param {string} materialId
 * @returns {'wanted' | 'produced' | 'neutral'}
 */
export function cityStance(city, materialId) {
  if (city.wants.includes(materialId)) return 'wanted'
  if (city.produces.includes(materialId)) return 'produced'
  return 'neutral'
}

/**
 * @param {number} base the material's base value
 * @param {'wanted' | 'produced' | 'neutral'} stance
 * @returns {number} the city's price with no pressure on it
 */
export const usualPrice = (base, stance) => base * MARKET_CITY_FACTORS[stance]

/**
 * @param {number} worldLevel
 * @returns {number} the units of one material that move a city's price by a factor of e
 */
export const marketDepth = (worldLevel) => MARKET_DEPTH_BASE * REWARD_GROWTH ** worldLevel

/** The pressure at which the price reaches the base value: below it the price is above base. */
const pivotOf = ({ base, usual }) => Math.log(usual / base)

/** ∫ min(usual e^-y, base) dy over [from, to], from <= to: what a sale walks through. */
function cappedArea(point, from, to) {
  const pivot = pivotOf(point)
  let area = 0
  if (from < pivot) area += point.base * (Math.min(to, pivot) - from)
  const start = Math.max(from, pivot)
  if (to > start) area += point.usual * Math.exp(-start) * -Math.expm1(-(to - start))
  return area
}

/** ∫ max(usual e^-y, base) dy over [from, to], from <= to: what a purchase walks through. */
function flooredArea(point, from, to) {
  const pivot = pivotOf(point)
  let area = 0
  const end = Math.min(to, pivot)
  if (from < end) area += point.usual * Math.exp(-from) * -Math.expm1(-(end - from))
  const start = Math.max(from, pivot)
  if (to > start) area += point.base * (to - start)
  return area
}

/**
 * What the city pays for one more unit now: its price, never above the base value, less the fee.
 *
 * @param {PricePoint} point
 */
export function unitSellPrice(point) {
  return Math.min(point.usual * Math.exp(-point.pressure), point.base) * (1 - MARKET_FEE)
}

/**
 * What the city asks for one more unit now: its price, never below the base value, plus the fee.
 *
 * @param {PricePoint} point
 */
export function unitBuyPrice(point) {
  return Math.max(point.usual * Math.exp(-point.pressure), point.base) * (1 + MARKET_FEE)
}

/**
 * Selling `amount` units: the coins paid, rounded down, and the pressure after. Each unit is paid
 * at the price it meets, which falls as the sale goes on, so a sale of any size is bounded.
 *
 * @param {PricePoint} point
 * @param {number} amount whole, at least 1
 * @returns {{ coins: number, pressure: number }}
 */
export function sellQuote(point, amount) {
  const to = point.pressure + amount / point.depth
  const coins = Math.floor(cappedArea(point, point.pressure, to) * point.depth * (1 - MARKET_FEE))
  return { coins, pressure: Math.min(to, MARKET_PRESSURE_MAX) }
}

/**
 * The most units the city has left to sell before its price reaches its ceiling.
 *
 * @param {PricePoint} point
 */
export function buyableUnits(point) {
  return Math.max(0, Math.floor((point.pressure - MARKET_PRESSURE_MIN) * point.depth))
}

/**
 * Buying `amount` units: the coins it costs, rounded up, and the pressure after; null when the
 * city has not that many left to sell.
 *
 * @param {PricePoint} point
 * @param {number} amount whole, at least 1
 * @returns {{ coins: number, pressure: number } | null}
 */
export function buyQuote(point, amount) {
  if (amount > buyableUnits(point)) return null
  const to = point.pressure - amount / point.depth
  const coins = Math.ceil(flooredArea(point, to, point.pressure) * point.depth * (1 + MARKET_FEE))
  return { coins, pressure: Math.max(to, MARKET_PRESSURE_MIN) }
}

/** How far the pressure falls when `area` (in price x pressure) is spent from `pressure` down. */
function pressureSpan(point, area) {
  const pivot = pivotOf(point)
  const flat = Math.max(0, point.pressure - pivot)
  if (area <= point.base * flat) return area / point.base
  const top = Math.min(point.pressure, pivot)
  const rest = area - point.base * flat
  return flat + Math.log1p(rest / (point.usual * Math.exp(-top)))
}

/**
 * The most whole units `coins` buy in the city now, or 0.
 *
 * @param {PricePoint} point
 * @param {number} coins
 */
export function affordableUnits(point, coins) {
  if (!(coins > 0)) return 0
  const span = pressureSpan(point, coins / (point.depth * (1 + MARKET_FEE)))
  let units = Math.min(buyableUnits(point), Math.floor(span * point.depth))
  // Rounding can leave the last unit a coin short: step back until the quote fits.
  while (units > 0 && buyQuote(point, units).coins > coins) units -= Math.max(1, Math.ceil(units * 1e-12))
  return Math.max(0, units)
}
