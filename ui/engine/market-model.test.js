import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  SLIDER_POSITIONS,
  affordableUnits,
  amountAtPosition,
  clampAmount,
  pagedPosition,
  positionOfAmount,
  sliderMax,
  tradeOutcome,
  amountFrom,
  cityStance,
  gatheringTradeOf,
  heldMaterials,
  offerBlock,
  pricePoint,
  priceTrend,
  sellQuote,
  stallRoomId,
  tradeQuote,
  unitBuyPrice,
  unitSellPrice
} from './market-model.js'

const market = {
  fee: 0.1,
  depth: 1000,
  pressureRange: [-2, 10],
  baseValues: { ore: 10, crops: 13, fish: 17 },
  cityFactors: { wanted: 1, neutral: 0.8, produced: 0.6 }
}
const deepforge = { produces: ['ore'], wants: ['crops'], pressure: {} }

test('a city wants, produces or is neutral about a material', () => {
  assert.equal(cityStance(deepforge, 'crops'), 'wanted')
  assert.equal(cityStance(deepforge, 'ore'), 'produced')
  assert.equal(cityStance(deepforge, 'fish'), 'neutral')
})

test('prices at rest: the usual price less the fee to sell, the base value plus the fee to buy', () => {
  const ore = pricePoint(market, deepforge, 'ore')
  assert.equal(unitSellPrice(ore), 6 * 0.9)
  assert.equal(unitBuyPrice(ore), 10 * 1.1)
  assert.ok(Math.abs(unitSellPrice(pricePoint(market, deepforge, 'fish')) - 17 * 0.8 * 0.9) < 1e-9)
})

test('a sale quote includes the price it moves, the same numbers the worker computes', () => {
  // The worker's src/game/market-prices.test.mjs pins the same sale: ten units at base 10.
  const wanted = { ...pricePoint(market, deepforge, 'crops'), base: 10, usual: 10 }
  assert.deepEqual(sellQuote(wanted, 10), { coins: Math.floor(10 * 1000 * (1 - Math.exp(-0.01)) * 0.9), pressure: 0.01 })
  assert.ok(sellQuote(wanted, 1e30).coins <= 10 * 1000)
  assert.deepEqual(sellQuote(wanted, 0), { coins: 0, pressure: 0 })
})

test('the units a sum buys never cost more than the sum', () => {
  const ore = pricePoint(market, { ...deepforge, pressure: { ore: -0.3 } }, 'ore')
  for (const coins of [0, 11, 1100, 30_000]) {
    const units = affordableUnits(ore, coins)
    assert.ok(units >= 0)
    if (coins === 1100) assert.ok(units >= 80 && units <= 100)
  }
  assert.equal(affordableUnits(pricePoint(market, { ...deepforge, pressure: { ore: -2 } }, 'ore'), 1e9), 0)
})

test('a trade quote gives whole units of what the city produces and the coins left', () => {
  const quote = tradeQuote(market, deepforge, { fromId: 'crops', toId: 'ore', amount: 100 })
  assert.ok(quote.units > 100 && quote.units < 110)
  assert.ok(quote.change >= 0 && quote.change < 12)
  assert.deepEqual(tradeQuote(market, deepforge, { fromId: 'crops', toId: 'ore', amount: 0 }), { units: 0, change: 0 })
})

test('a price is marked up after purchases and down after sales', () => {
  assert.equal(priceTrend(-0.4), 'up')
  assert.equal(priceTrend(0.4), 'down')
  assert.equal(priceTrend(0), 'usual')
})

test('a typed amount becomes a whole number within what is held', () => {
  assert.equal(amountFrom('12', 100), 12)
  assert.equal(amountFrom('12.9', 100), 12)
  assert.equal(amountFrom('500', 100), 100)
  assert.equal(amountFrom('-5', 100), 0)
  assert.equal(amountFrom('lots', 100), 0)
  assert.equal(amountFrom('', 100), 0)
})

test('only materials held are offered, in the game\'s order', () => {
  assert.deepEqual(heldMaterials({ fish: 3, bars: 1, ore: 0, crops: 0.5 }), ['bars', 'fish'])
})

test('a stall piece goes into the room asked for when it plays in the world', () => {
  const rooms = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const gameRooms = { a: { worldId: 'side' }, b: { worldId: 'main' }, c: { worldId: 'main' } }
  assert.equal(stallRoomId(rooms, gameRooms, 'main', 'c'), 'c')
  assert.equal(stallRoomId(rooms, gameRooms, 'main', 'a'), 'b')
  assert.equal(stallRoomId(rooms, gameRooms, 'other', 'a'), null)
})

test('a stall piece says why it cannot be bought', () => {
  const offer = { sold: false, price: 100, fullIn: ['full-room'] }
  const can = { coins: 100, roomId: 'room', canBuy: true }
  assert.equal(offerBlock(offer, can), null)
  assert.equal(offerBlock(offer, { ...can, canBuy: false }), 'viewOnly')
  assert.equal(offerBlock({ ...offer, sold: true }, can), 'sold')
  assert.equal(offerBlock(offer, { ...can, roomId: null }), 'noRoom')
  assert.equal(offerBlock(offer, { ...can, roomId: 'full-room' }), 'full')
  assert.equal(offerBlock(offer, { ...can, coins: 99 }), 'coins')
})

test('a gathering material names the trade that gathers it; a work material names none', () => {
  assert.equal(gatheringTradeOf('fish'), 'fishing')
  assert.equal(gatheringTradeOf('runes'), 'runecraft')
  assert.equal(gatheringTradeOf('bars'), null)
})

test('a slider moves one unit a step on a small stock and spreads a large one over its positions', () => {
  assert.equal(sliderMax(555), 555)
  assert.equal(amountAtPosition(300, 555), 300)
  assert.equal(sliderMax(4_000_000), SLIDER_POSITIONS)
  assert.equal(amountAtPosition(SLIDER_POSITIONS, 4_000_000), 4_000_000)
  assert.equal(amountAtPosition(1, 4_000_000), 4000)
  assert.equal(positionOfAmount(4000, 4_000_000), 1)
  assert.equal(positionOfAmount(1e17, 1e17), SLIDER_POSITIONS)
  assert.equal(sliderMax(0), 0)
  assert.equal(amountAtPosition(5, 0), 0)
})

test('a slider position outside the slider, or not a number, stays within it', () => {
  assert.equal(amountAtPosition(-3, 555), 0)
  assert.equal(amountAtPosition(9999, 555), 555)
  assert.equal(amountAtPosition('x', 555), 0)
})

test('Page Up and Page Down move a tenth of the slider, stopping at either end', () => {
  assert.equal(pagedPosition(100, 555, 1), 156)
  assert.equal(pagedPosition(10, 555, -1), 0)
  assert.equal(pagedPosition(990, 5e6, 1), SLIDER_POSITIONS)
  assert.equal(pagedPosition(0, 5, 1), 1)
})

test('an amount chosen is kept within a stock that shrank', () => {
  assert.equal(clampAmount(300, 555), 300)
  assert.equal(clampAmount(300, 120), 120)
  assert.equal(clampAmount(undefined, 120), 0)
  assert.equal(clampAmount(-4, 120), 0)
})

test('a trade with nothing to give, or too little for one unit, says why; otherwise its rate', () => {
  assert.equal(tradeOutcome(market, deepforge, { fromId: 'crops', toId: 'ore', amount: 0 }).why, 'none')
  const tooLittle = tradeOutcome({ ...market, baseValues: { ...market.baseValues, crops: 1 } }, deepforge,
    { fromId: 'crops', toId: 'ore', amount: 1 })
  assert.equal(tooLittle.why, 'tooLittle')
  const outcome = tradeOutcome(market, deepforge, { fromId: 'crops', toId: 'ore', amount: 100 })
  assert.equal(outcome.why, null)
  assert.equal(outcome.rate, 100 / outcome.units)
})
