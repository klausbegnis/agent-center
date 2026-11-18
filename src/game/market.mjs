// A world's market: its coins and, per city and material, the pressure that sales and purchases
// put on the price, which recovers as game time passes. Selling, buying and trading one
// material for another in a city. Pure: every function returns a new world, or the same one
// when the trade cannot be made.
import {
  MARKET_DAY_MS,
  MARKET_MAX_AMOUNT,
  MARKET_MAX_COINS,
  MARKET_PRESSURE_FORGOTTEN,
  MARKET_RECOVERY_HALF_LIFE_MS,
  MATERIAL_BASE_VALUES
} from './constants.mjs'
import { affordableUnits, buyQuote, cityStance, marketDepth, sellQuote, usualPrice } from './market-prices.mjs'
import { worldLevel } from './progression.mjs'
import { cityFeeOf } from './city-ranks.mjs'

/**
 * @typedef {{ id: string, name: string, tagline: string, opensAt: number, produces: string[],
 *   wants: string[], banner: string, bannerAlt: string }} City an entry of game/cities.json
 * @typedef {{ clock: number | null, pressure: Record<string, Record<string, number>>,
 *   sold: Record<string, { day: number, offers: number[] }> }} Market `clock` is the time the
 *   world was last advanced to, `sold` the stall offers bought on that day
 */

/** @returns {Market} */
export function emptyMarket() {
  return { clock: null, pressure: {}, sold: {} }
}

/** @param {{ market?: Market }} world */
const marketOf = (world) => world.market ?? emptyMarket()

/**
 * The game day the world's clock is in: the stall's offers change with it.
 *
 * @param {Market} market
 */
export function marketDay(market) {
  return market?.clock == null ? 0 : Math.floor(market.clock / MARKET_DAY_MS)
}

/** Whether a city trades with a world of this level. */
export const isCityOpen = (city, level) => level >= city.opensAt

/**
 * A material's price in a city of a world, as the price functions take it.
 *
 * @param {object} world
 * @param {City} city
 * @param {string} materialId
 * @returns {import('./market-prices.mjs').PricePoint}
 */
export function pricePoint(world, city, materialId) {
  const base = MATERIAL_BASE_VALUES[materialId]
  return {
    base,
    usual: usualPrice(base, cityStance(city, materialId)),
    pressure: marketOf(world).pressure[city.id]?.[materialId] ?? 0,
    depth: marketDepth(worldLevel(world.skills)),
    // The world's fee, lower in a city of a higher rank or holding its festival (city-ranks.mjs).
    fee: cityFeeOf(world, city.id, city.festival === true)
  }
}

/** The market with one pressure set; a pressure near zero is forgotten. */
function withPressure(market, cityId, materialId, pressure) {
  const city = { ...market.pressure[cityId] }
  if (Math.abs(pressure) < MARKET_PRESSURE_FORGOTTEN) delete city[materialId]
  else city[materialId] = pressure
  const all = { ...market.pressure, [cityId]: city }
  if (Object.keys(city).length === 0) delete all[cityId]
  return { ...market, pressure: all }
}

/**
 * The market after game time passed from `from` to `to`: every pressure shrinks by half each
 * MARKET_RECOVERY_HALF_LIFE_MS, and the clock moves to `to`. Time before the clock is not
 * counted twice.
 *
 * @param {Market | undefined} value
 * @param {number} from
 * @param {number} to
 * @returns {Market}
 */
export function recoverMarket(value, from, to) {
  const market = value ?? emptyMarket()
  const start = market.clock === null ? from : Math.max(from, market.clock)
  const elapsed = Math.max(0, to - start)
  const clock = market.clock === null ? to : Math.max(market.clock, to)
  if (elapsed === 0 || Object.keys(market.pressure).length === 0) return { ...market, clock }
  const keep = 0.5 ** (elapsed / MARKET_RECOVERY_HALF_LIFE_MS)
  let next = { ...market, clock }
  for (const [cityId, materials] of Object.entries(market.pressure)) {
    for (const [materialId, pressure] of Object.entries(materials)) {
      next = withPressure(next, cityId, materialId, pressure * keep)
    }
  }
  return next
}

const isAmount = (amount) => Number.isInteger(amount) && amount >= 1 && amount <= MARKET_MAX_AMOUNT

/** The open city of that id, or null. */
function openCity(world, cities, cityId) {
  const city = cities.find((entry) => entry.id === cityId)
  return city && isCityOpen(city, worldLevel(world.skills)) ? city : null
}

const isMaterial = (materialId) => Object.hasOwn(MATERIAL_BASE_VALUES, materialId)

/** The world after a sale that is known to be possible. */
function applySale(world, city, materialId, amount) {
  const quote = sellQuote(pricePoint(world, city, materialId), amount)
  const coins = (world.coins ?? 0) + quote.coins
  if (!(coins <= MARKET_MAX_COINS)) return null
  const materials = { ...world.materials, [materialId]: world.materials[materialId] - amount }
  const market = withPressure(marketOf(world), city.id, materialId, quote.pressure)
  return { ...world, materials, coins, market, earned: quote.coins }
}

/**
 * Sells `amount` units of a material the world holds to an open city, for coins.
 *
 * @param {object} world
 * @param {City[]} cities
 * @param {{ cityId: string, materialId: string, amount: number }} sale
 * @returns {object} the new world, or the same one when the sale cannot be made
 */
export function sellMaterial(world, cities, { cityId, materialId, amount }) {
  const city = openCity(world, cities, cityId)
  if (!city || !isMaterial(materialId) || !isAmount(amount)) return world
  if (!((world.materials[materialId] ?? 0) >= amount)) return world
  const sold = applySale(world, city, materialId, amount)
  if (!sold || sold.earned < 1) return world
  const { earned, ...next } = sold
  return next
}

/** The world after a purchase paid from its coins, or null when it cannot be made. */
function applyPurchase(world, city, materialId, amount) {
  if (!city.produces.includes(materialId)) return null
  const quote = buyQuote(pricePoint(world, city, materialId), amount)
  if (!quote || !((world.coins ?? 0) >= quote.coins)) return null
  const materials = { ...world.materials, [materialId]: (world.materials[materialId] ?? 0) + amount }
  const market = withPressure(marketOf(world), city.id, materialId, quote.pressure)
  return { ...world, materials, coins: world.coins - quote.coins, market }
}

/**
 * Buys `amount` units of a material an open city produces, with the world's coins. A city sells
 * only what it produces.
 *
 * @param {object} world
 * @param {City[]} cities
 * @param {{ cityId: string, materialId: string, amount: number }} purchase
 * @returns {object}
 */
export function buyMaterial(world, cities, { cityId, materialId, amount }) {
  const city = openCity(world, cities, cityId)
  if (!city || !isMaterial(materialId) || !isAmount(amount)) return world
  return applyPurchase(world, city, materialId, amount) ?? world
}

/**
 * What trading `amount` of one material for another in a city gives: the units received and the
 * coins left over, or null when it gives nothing. It is a sale, then a purchase of as many whole
 * units as the sale paid for, both with the city's fee.
 *
 * @param {object} world
 * @param {City} city
 * @param {{ fromId: string, toId: string, amount: number }} trade
 * @returns {{ sold: object, units: number } | null}
 */
function tradeOutcome(world, city, { fromId, toId, amount }) {
  const sold = applySale({ ...world, coins: 0 }, city, fromId, amount)
  if (!sold || sold.earned < 1) return null
  const units = affordableUnits(pricePoint(sold, city, toId), sold.earned)
  return units >= 1 ? { sold, units } : null
}

/**
 * Turns `amount` units of one material into another the city produces, in one step. Coins the
 * purchase leaves over go to the world's coins.
 *
 * @param {object} world
 * @param {City[]} cities
 * @param {{ cityId: string, fromId: string, toId: string, amount: number }} trade
 * @returns {object}
 */
export function tradeMaterial(world, cities, { cityId, fromId, toId, amount }) {
  const city = openCity(world, cities, cityId)
  if (!city || !isMaterial(fromId) || !isMaterial(toId) || fromId === toId || !isAmount(amount)) return world
  if (!city.produces.includes(toId) || !((world.materials[fromId] ?? 0) >= amount)) return world
  const outcome = tradeOutcome(world, city, { fromId, toId, amount })
  if (!outcome) return world
  const { earned, ...sold } = outcome.sold
  const bought = applyPurchase(sold, city, toId, outcome.units)
  if (!bought) return world
  const coins = (world.coins ?? 0) + bought.coins
  return coins <= MARKET_MAX_COINS ? { ...bought, coins } : world
}

/**
 * How many units of `toId` a trade would give, for a UI or a policy to show before trading.
 *
 * @param {object} world
 * @param {City} city
 * @param {{ fromId: string, toId: string, amount: number }} trade
 * @returns {number}
 */
export function tradeUnits(world, city, trade) {
  return tradeOutcome(world, city, trade)?.units ?? 0
}
