// What the Market tab shows, worked out from the view state without touching the DOM: each
// material's price in a city, what selling or trading an amount gives (the same formulas as the
// worker's src/game/market-prices.mjs, from the numbers the view state carries), the marks and
// tags of a price, and the amounts a person may type.

/** Materials in the order the game lists them, work materials first. */
export const MARKET_MATERIALS = Object.freeze(['bars', 'pages', 'gears', 'crystals', 'seals', 'ore', 'fish', 'crops',
  'logs', 'hides', 'runes'])

/** The trade whose idle characters gather each gathering material; work materials have none. */
const TRADE_OF_MATERIAL = Object.freeze({
  ore: 'mining',
  fish: 'fishing',
  crops: 'farming',
  logs: 'woodcutting',
  hides: 'hunting',
  runes: 'runecraft'
})

/**
 * The trade that gathers a material, or null for one only kills give.
 *
 * @param {string} materialId
 * @returns {string | null}
 */
export const gatheringTradeOf = (materialId) => TRADE_OF_MATERIAL[materialId] ?? null

/**
 * What a city thinks of a material.
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
 * A material's price in a city as the formulas take it.
 *
 * @param {object} market a world's `market` in the view state
 * @param {object} city an open city of it
 * @param {string} materialId
 * @returns {{ base: number, usual: number, pressure: number, depth: number, fee: number, min: number, max: number }}
 */
export function pricePoint(market, city, materialId) {
  const base = market.baseValues[materialId]
  return {
    base,
    usual: base * market.cityFactors[cityStance(city, materialId)],
    pressure: city.pressure?.[materialId] ?? 0,
    depth: market.depth,
    fee: market.fee,
    min: market.pressureRange[0],
    max: market.pressureRange[1]
  }
}

const pivotOf = (point) => Math.log(point.usual / point.base)

function cappedArea(point, from, to) {
  const pivot = pivotOf(point)
  let area = 0
  if (from < pivot) area += point.base * (Math.min(to, pivot) - from)
  const start = Math.max(from, pivot)
  if (to > start) area += point.usual * Math.exp(-start) * -Math.expm1(-(to - start))
  return area
}

function flooredArea(point, from, to) {
  const pivot = pivotOf(point)
  let area = 0
  const end = Math.min(to, pivot)
  if (from < end) area += point.usual * Math.exp(-from) * -Math.expm1(-(end - from))
  const start = Math.max(from, pivot)
  if (to > start) area += point.base * (to - start)
  return area
}

/** What the city pays for one more unit now. */
export const unitSellPrice = (point) => Math.min(point.usual * Math.exp(-point.pressure), point.base) * (1 - point.fee)

/** What the city asks for one more unit now. */
export const unitBuyPrice = (point) => Math.max(point.usual * Math.exp(-point.pressure), point.base) * (1 + point.fee)

/**
 * The coins a sale of `amount` units pays, price impact included, and the pressure after.
 *
 * @param {ReturnType<typeof pricePoint>} point
 * @param {number} amount
 */
export function sellQuote(point, amount) {
  if (!(amount >= 1)) return { coins: 0, pressure: point.pressure }
  const to = point.pressure + amount / point.depth
  const coins = Math.floor(cappedArea(point, point.pressure, to) * point.depth * (1 - point.fee))
  return { coins, pressure: Math.min(to, point.max) }
}

function buyCost(point, amount) {
  const to = point.pressure - amount / point.depth
  return Math.ceil(flooredArea(point, to, point.pressure) * point.depth * (1 + point.fee))
}

/** The most whole units `coins` buy now, within what the city has left to sell. */
export function affordableUnits(point, coins) {
  if (!(coins > 0)) return 0
  const pivot = pivotOf(point)
  const area = coins / (point.depth * (1 + point.fee))
  const flat = Math.max(0, point.pressure - pivot)
  const span = area <= point.base * flat
    ? area / point.base
    : flat + Math.log1p((area - point.base * flat) / (point.usual * Math.exp(-Math.min(point.pressure, pivot))))
  const left = Math.max(0, Math.floor((point.pressure - point.min) * point.depth))
  let units = Math.min(left, Math.floor(span * point.depth))
  while (units > 0 && buyCost(point, units) > coins) units -= Math.max(1, Math.ceil(units * 1e-12))
  return Math.max(0, units)
}

/**
 * What trading `amount` units of one material for another in a city gives: the units received
 * and the coins left over, both 0 when the trade gives nothing.
 *
 * @param {object} market
 * @param {object} city
 * @param {{ fromId: string, toId: string, amount: number }} trade
 * @returns {{ units: number, change: number }}
 */
export function tradeQuote(market, city, { fromId, toId, amount }) {
  const sale = sellQuote(pricePoint(market, city, fromId), amount)
  if (sale.coins < 1) return { units: 0, change: 0 }
  // The sale moves only the price of what is sold, and a trade is between two materials.
  const target = pricePoint(market, city, toId)
  const units = affordableUnits(target, sale.coins)
  return units >= 1 ? { units, change: sale.coins - buyCost(target, units) } : { units: 0, change: 0 }
}

/**
 * Whether a city's price for a material is above or below its usual price there, by its
 * pressure: a sale has pushed it down, a purchase up, and it is on its way back.
 *
 * @param {number} pressure
 * @returns {'up' | 'down' | 'usual'}
 */
export function priceTrend(pressure) {
  if (pressure < -0.005) return 'up'
  if (pressure > 0.005) return 'down'
  return 'usual'
}

/**
 * A typed amount as a whole number from 0 to `most`: what is left of "1,2a0" or "-5" is not
 * guessed at, it becomes 0.
 *
 * @param {unknown} text
 * @param {number} most
 */
export function amountFrom(text, most) {
  const value = Number(String(text ?? '').trim())
  if (!Number.isFinite(value) || value < 1) return 0
  return Math.min(Math.floor(value), Math.max(0, Math.floor(most)))
}

/**
 * The materials the world holds, in the game's order: what a Sell list or a trade's "from" offers.
 *
 * @param {Record<string, number>} materials
 */
export const heldMaterials = (materials) => MARKET_MATERIALS.filter((id) => (materials?.[id] ?? 0) >= 1)

/**
 * The room a stall's piece goes into: the one asked for when it plays in the world, otherwise
 * the first that does, or null.
 *
 * @param {{ id: string }[]} rooms the joined rooms, in the order they are listed
 * @param {Record<string, { worldId: string }>} gameRooms the view state's `game.rooms`
 * @param {string} worldId
 * @param {string | null} wanted
 */
export function stallRoomId(rooms, gameRooms, worldId, wanted) {
  const inWorld = rooms.filter((room) => gameRooms?.[room.id]?.worldId === worldId)
  return (inWorld.find((room) => room.id === wanted) ?? inWorld[0])?.id ?? null
}

/**
 * Why a stall's piece cannot be bought now, or null when it can.
 *
 * @param {{ sold: boolean, price: number, fullIn: string[] }} offer
 * @param {{ coins: number, roomId: string | null, canBuy: boolean }} context
 * @returns {'viewOnly' | 'sold' | 'noRoom' | 'full' | 'coins' | null}
 */
export function offerBlock(offer, { coins, roomId, canBuy }) {
  if (!canBuy) return 'viewOnly'
  if (offer.sold) return 'sold'
  if (!roomId) return 'noRoom'
  if (offer.fullIn.includes(roomId)) return 'full'
  if (coins < offer.price) return 'coins'
  return null
}
