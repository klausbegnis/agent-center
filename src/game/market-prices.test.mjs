import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MARKET_DEPTH_BASE, MARKET_FEE, MARKET_PRESSURE_MAX, MARKET_PRESSURE_MIN, REWARD_GROWTH } from './constants.mjs'
import {
  affordableUnits,
  buyQuote,
  buyableUnits,
  cityStance,
  marketDepth,
  sellQuote,
  unitBuyPrice,
  unitSellPrice,
  usualPrice
} from './market-prices.mjs'

/** A material of base value 10 in a city that produces it: usual price 6, depth 1000. */
const produced = (pressure = 0) => ({ base: 10, usual: 6, pressure, depth: 1000 })
const wanted = (pressure = 0) => ({ base: 10, usual: 10, pressure, depth: 1000 })

test('a city wants, produces or is neutral about a material', () => {
  const city = { produces: ['crops'], wants: ['ore'] }
  assert.equal(cityStance(city, 'ore'), 'wanted')
  assert.equal(cityStance(city, 'crops'), 'produced')
  assert.equal(cityStance(city, 'runes'), 'neutral')
})

test('a city pays the base value for what it wants and less for the rest, fees aside', () => {
  assert.equal(usualPrice(10, 'wanted'), 10)
  assert.equal(usualPrice(10, 'neutral'), 8)
  assert.equal(usualPrice(10, 'produced'), 6)
})

test('the depth grows with the world like kill rewards', () => {
  assert.equal(marketDepth(0), MARKET_DEPTH_BASE)
  assert.ok(Math.abs(marketDepth(50) - MARKET_DEPTH_BASE * REWARD_GROWTH ** 50) < 1e-6)
})

test('at rest a sale pays the usual price less the fee and a purchase costs the base value plus the fee', () => {
  assert.equal(unitSellPrice(wanted()), 10 * (1 - MARKET_FEE))
  assert.equal(unitSellPrice(produced()), 6 * (1 - MARKET_FEE))
  assert.equal(unitBuyPrice(produced()), 10 * (1 + MARKET_FEE))
})

test('no price state pays more than the base value or asks less than it', () => {
  for (let pressure = MARKET_PRESSURE_MIN; pressure <= MARKET_PRESSURE_MAX; pressure += 0.25) {
    for (const point of [produced(pressure), wanted(pressure), { ...wanted(pressure), usual: 8 }]) {
      assert.ok(unitSellPrice(point) <= point.base * (1 - MARKET_FEE))
      assert.ok(unitBuyPrice(point) >= point.base * (1 + MARKET_FEE))
    }
  }
})

test('a sale moves the price down in proportion to the amount, and pays for each unit what it met', () => {
  const small = sellQuote(wanted(), 10)
  assert.equal(small.pressure, 0.01)
  // Ten units at a price falling from 10 to 10 e^-0.01: a little under 100, less the fee.
  assert.equal(small.coins, Math.floor(10 * 1000 * (1 - Math.exp(-0.01)) * (1 - MARKET_FEE)))
  const twice = sellQuote(wanted(0.01), 10)
  assert.ok(twice.coins <= small.coins)
})

test('selling in two steps pays the same as selling at once, give or take the rounding', () => {
  const once = sellQuote(produced(0.2), 500)
  const first = sellQuote(produced(0.2), 200)
  const second = sellQuote(produced(first.pressure), 300)
  assert.ok(Math.abs(first.coins + second.coins - once.coins) <= 1)
})

test('a sale of any size is bounded by the base value times the depth', () => {
  for (const amount of [1e6, 1e12, 1e30, 1e100]) {
    const quote = sellQuote(wanted(), amount)
    assert.ok(Number.isFinite(quote.coins))
    assert.ok(quote.coins <= 10 * 1000)
    assert.equal(quote.pressure, MARKET_PRESSURE_MAX)
  }
})

test('a purchase raises the price once the city\'s usual price has risen to the base value', () => {
  // A producing city sells at the base value while its price is below it: 510 units, then dearer.
  const flat = buyQuote(produced(), 100)
  assert.equal(flat.coins, Math.ceil(100 * 10 * (1 + MARKET_FEE)))
  assert.equal(flat.pressure, -0.1)
  const steep = buyQuote(produced(), 1500)
  assert.ok(steep.coins > 1500 * 10 * (1 + MARKET_FEE))
})

test('a city sells no more than its price ceiling allows', () => {
  assert.equal(buyableUnits(produced()), 2000)
  assert.equal(buyQuote(produced(), 2001), null)
  assert.equal(buyableUnits(produced(MARKET_PRESSURE_MIN)), 0)
})

test('the units a sum buys are the most whose price the sum covers', () => {
  for (const coins of [0, 10, 11, 12, 1100, 5000, 30_000, 1e9]) {
    const units = affordableUnits(produced(-0.3), coins)
    if (units > 0) assert.ok(buyQuote(produced(-0.3), units).coins <= coins)
    const next = buyQuote(produced(-0.3), units + 1)
    assert.ok(next === null || next.coins > coins, `${coins} coins`)
  }
})

test('prices stay finite at the depth of a world far past any played', () => {
  const huge = { base: 18, usual: 18, pressure: 0, depth: marketDepth(5000) }
  const sale = sellQuote(huge, 1e100)
  assert.ok(Number.isFinite(sale.coins) && sale.coins > 0)
  const purchase = buyQuote({ ...huge, usual: 10.8 }, Math.floor(huge.depth))
  assert.ok(Number.isFinite(purchase.coins))
})
