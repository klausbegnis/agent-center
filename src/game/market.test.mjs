import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  MARKET_FEE,
  MARKET_FEE_FLOOR,
  MARKET_PRESSURE_MAX,
  MARKET_PRESSURE_MIN,
  MARKET_RECOVERY_HALF_LIFE_MS,
  MATERIAL_BASE_VALUES
} from './constants.mjs'
import { hashOf } from './hash.mjs'
import { unitBuyPrice, unitSellPrice } from './market-prices.mjs'
import {
  buyMaterial,
  emptyMarket,
  marketDay,
  pricePoint,
  recoverMarket,
  sellMaterial,
  tradeMaterial,
  tradeUnits
} from './market.mjs'
import { MATERIALS, WORK_SKILLS } from './skills.mjs'
import { emptyWorld, migrate } from './worlds.mjs'

const { cities } = JSON.parse(readFileSync(new URL('../../game/cities.json', import.meta.url), 'utf8'))
const HOUR = 60 * 60 * 1000

/** A world at a level (up to 99), with materials, coins and building levels. */
function worldAt(level, { materials = {}, coins = 0, market = emptyMarket(), upgrades = {} } = {}) {
  const skills = Object.fromEntries(WORK_SKILLS.map((id) => [id, { level, xp: 0, banked: 0, stars: 0 }]))
  return { ...emptyWorld(), skills, materials, coins, market, upgrades }
}
/** A Storehouse so far up that the fee sits at its floor (to well under a millionth). */
const AT_FLOOR = { storehouse: 1e12 }

const city = (id) => cities.find((entry) => entry.id === id)
const pressureOf = (world, cityId, materialId) => world.market.pressure[cityId]?.[materialId] ?? 0

/** Coins plus every material at its base value: what trading must never make grow. */
const wealthOf = (world) => world.coins +
  MATERIALS.reduce((sum, id) => sum + (world.materials[id] ?? 0) * MATERIAL_BASE_VALUES[id], 0)

test('selling to an open city pays coins, takes the materials and lowers its price there', () => {
  const world = worldAt(30, { materials: { ore: 500 } })
  const next = sellMaterial(world, cities, { cityId: 'goldmill', materialId: 'ore', amount: 100 })
  assert.equal(next.materials.ore, 400)
  assert.ok(next.coins > 0 && next.coins < 100 * MATERIAL_BASE_VALUES.ore)
  assert.ok(pressureOf(next, 'goldmill', 'ore') > 0)
  assert.equal(pressureOf(next, 'deepforge', 'ore'), 0)
})

test('a city that wants a material pays more for it than one that produces it', () => {
  const world = worldAt(30, { materials: { ore: 500 } })
  const wantedSale = sellMaterial(world, cities, { cityId: 'goldmill', materialId: 'ore', amount: 100 })
  const producedSale = sellMaterial(world, cities, { cityId: 'deepforge', materialId: 'ore', amount: 100 })
  const neutralSale = sellMaterial(world, cities, { cityId: 'brinehaven', materialId: 'ore', amount: 100 })
  assert.ok(wantedSale.coins > neutralSale.coins && neutralSale.coins > producedSale.coins)
})

test('a sale is refused when the city is closed, the stock short or the amount not a whole number', () => {
  const world = worldAt(3, { materials: { ore: 50 } })
  const refused = [
    { cityId: 'deepforge', materialId: 'ore', amount: 10 },
    { cityId: 'atlantis', materialId: 'ore', amount: 10 },
    { cityId: 'goldmill', materialId: 'ore', amount: 51 },
    { cityId: 'goldmill', materialId: 'ore', amount: 0 },
    { cityId: 'goldmill', materialId: 'ore', amount: -5 },
    { cityId: 'goldmill', materialId: 'ore', amount: 2.5 },
    { cityId: 'goldmill', materialId: 'ore', amount: Infinity },
    { cityId: 'goldmill', materialId: 'gold', amount: 1 },
    { cityId: 'goldmill', materialId: '__proto__', amount: 1 }
  ]
  for (const sale of refused) assert.equal(sellMaterial(world, cities, sale), world, JSON.stringify(sale))
})

test('a city sells only what it produces, for coins the world holds', () => {
  const world = worldAt(30, { coins: 10_000 })
  const bought = buyMaterial(world, cities, { cityId: 'goldmill', materialId: 'crops', amount: 100 })
  assert.equal(bought.materials.crops, 100)
  assert.equal(bought.coins, 10_000 - Math.ceil(100 * MATERIAL_BASE_VALUES.crops * (1 + MARKET_FEE)))
  assert.equal(buyMaterial(world, cities, { cityId: 'goldmill', materialId: 'ore', amount: 1 }), world)
  assert.equal(buyMaterial(world, cities, { cityId: 'goldmill', materialId: 'crops', amount: 1000 }), world)
})

test('a trade turns one material into another the city produces, in one step', () => {
  const world = worldAt(30, { materials: { crops: 1000 } })
  const units = tradeUnits(world, city('deepforge'), { fromId: 'crops', toId: 'ore', amount: 1000 })
  const next = tradeMaterial(world, cities, { cityId: 'deepforge', fromId: 'crops', toId: 'ore', amount: 1000 })
  assert.equal(next.materials.crops, 0)
  assert.equal(next.materials.ore, units)
  assert.ok(units > 1000, 'crops are worth more than ore')
  assert.ok(next.coins >= 0 && next.coins < unitBuyPrice(pricePoint(next, city('deepforge'), 'ore')))
  assert.ok(wealthOf(next) < wealthOf(world))
})

test('a trade is refused for a material the city does not produce, the same material or too little to buy one', () => {
  const world = worldAt(30, { materials: { crops: 1000, ore: 1 } })
  const refused = [
    { cityId: 'deepforge', fromId: 'crops', toId: 'fish', amount: 10 },
    { cityId: 'deepforge', fromId: 'ore', toId: 'ore', amount: 1 },
    { cityId: 'deepforge', fromId: 'crops', toId: 'ore', amount: 1001 },
    { cityId: 'runespire', fromId: 'ore', toId: 'seals', amount: 1 }
  ]
  for (const trade of refused) assert.equal(tradeMaterial(world, cities, trade), world, JSON.stringify(trade))
})

test('prices recover by half every half-life of game time, and the clock moves on', () => {
  const market = { ...emptyMarket(), pressure: { goldmill: { ore: 2, crops: -1 } } }
  const later = recoverMarket(market, 0, MARKET_RECOVERY_HALF_LIFE_MS)
  assert.equal(later.pressure.goldmill.ore, 1)
  assert.equal(later.pressure.goldmill.crops, -0.5)
  assert.equal(later.clock, MARKET_RECOVERY_HALF_LIFE_MS)
  // Time before the clock is not counted twice.
  assert.deepEqual(recoverMarket(later, 0, MARKET_RECOVERY_HALF_LIFE_MS), later)
})

test('recovery in many short steps is the same as in one long one, and a recovered price is forgotten', () => {
  let stepped = { ...emptyMarket(), pressure: { tallwood: { logs: 3 } } }
  for (let at = 0; at < 4 * HOUR; at += 10 * 60 * 1000) stepped = recoverMarket(stepped, at, at + 10 * 60 * 1000)
  const once = recoverMarket({ ...emptyMarket(), pressure: { tallwood: { logs: 3 } } }, 0, 4 * HOUR)
  assert.ok(Math.abs(stepped.pressure.tallwood.logs - once.pressure.tallwood.logs) < 1e-9)
  assert.deepEqual(recoverMarket(once, 4 * HOUR, 400 * HOUR).pressure, {})
})

test('the game day follows the world\'s clock', () => {
  assert.equal(marketDay(emptyMarket()), 0)
  assert.equal(marketDay({ ...emptyMarket(), clock: 3 * 24 * HOUR + 5 }), 3)
})

test('a save from before the market starts with no coins and a market at rest', () => {
  const save = migrate({ version: 1, worlds: { main: { skills: {}, materials: { ore: 4 }, upgrades: {}, projects: {} } } })
  assert.equal(save.worlds.main.coins, 0)
  assert.deepEqual(save.worlds.main.market, emptyMarket())
})

test('a stored market keeps only what is in range', () => {
  const save = migrate({
    version: 1,
    worlds: {
      main: {
        skills: {}, materials: {}, upgrades: {}, projects: {}, coins: -4,
        market: { clock: 'soon', pressure: { goldmill: { ore: 1, crops: 99, fish: 'x' } }, sold: { goldmill: { day: 2, offers: [0] }, x: 3 } }
      }
    }
  })
  assert.equal(save.worlds.main.coins, 0)
  assert.deepEqual(save.worlds.main.market, { clock: null, pressure: { goldmill: { ore: 1 } }, sold: { goldmill: { day: 2, offers: [0] } } })
})

// No arbitrage. Every sale pays at most the base value less the fee and every purchase costs at
// least the base value plus the fee, so coins plus materials at base value can only fall by
// trading, whatever the prices, amounts, cities, order or timing.

/** A deterministic stream of numbers from 0 to 1, from a seed. */
function randomStream(seed) {
  let counter = 0
  return () => hashOf(`${seed}|${counter++}`) / 4294967296
}

const pick = (random, list) => list[Math.floor(random() * list.length)]
/** An amount from 1 to about 10 ** digits, spread over its orders of magnitude. */
const amountFrom = (random, digits) => Math.max(1, Math.floor(10 ** (random() * digits)))

function randomWorld(random, upgrades = {}) {
  const level = 25 + Math.floor(random() * 75)
  const pressure = {}
  for (const entry of cities) {
    pressure[entry.id] = {}
    for (const id of MATERIALS) {
      pressure[entry.id][id] = MARKET_PRESSURE_MIN + random() * (MARKET_PRESSURE_MAX - MARKET_PRESSURE_MIN)
    }
  }
  const materials = Object.fromEntries(MATERIALS.map((id) => [id, amountFrom(random, 7)]))
  return worldAt(level, { materials, coins: amountFrom(random, 8), market: { clock: 0, pressure, sold: {} }, upgrades })
}

function randomStep(world, random) {
  const roll = random()
  const cityId = pick(random, cities).id
  if (roll < 0.3) {
    const materialId = pick(random, MATERIALS)
    const held = world.materials[materialId] ?? 0
    const roll = random()
    const amount = roll < 0.2 ? held : roll < 0.6 ? Math.floor(held * random()) : amountFrom(random, 6)
    return sellMaterial(world, cities, { cityId, materialId, amount })
  }
  if (roll < 0.6) {
    const materialId = pick(random, city(cityId).produces)
    return buyMaterial(world, cities, { cityId, materialId, amount: amountFrom(random, 5) })
  }
  if (roll < 0.9) {
    const fromId = pick(random, MATERIALS)
    const toId = pick(random, city(cityId).produces)
    const share = Math.floor((world.materials[fromId] ?? 0) * random())
    const amount = random() < 0.5 && share >= 1 ? share : amountFrom(random, 6)
    return tradeMaterial(world, cities, { cityId, fromId, toId, amount })
  }
  const clock = world.market.clock
  return { ...world, market: recoverMarket(world.market, clock, clock + Math.floor(random() * 12 * HOUR)) }
}

function assertSound(world) {
  assert.ok(Number.isInteger(world.coins) && world.coins >= 0)
  for (const id of MATERIALS) assert.ok(Number.isInteger(world.materials[id] ?? 0) && (world.materials[id] ?? 0) >= 0)
  for (const materials of Object.values(world.market.pressure)) {
    for (const pressure of Object.values(materials)) {
      assert.ok(pressure >= MARKET_PRESSURE_MIN && pressure <= MARKET_PRESSURE_MAX)
    }
  }
}

/** Trades at random from random price states, and checks that no step makes the world richer. */
function checkNoArbitrage(seed, upgrades) {
  let madeTrades = 0
  for (let run = 0; run < 150; run += 1) {
    const random = randomStream(`${seed}|${run}`)
    let world = randomWorld(random, upgrades)
    for (let step = 0; step < 60; step += 1) {
      const before = wealthOf(world)
      const next = randomStep(world, random)
      if (next.coins !== world.coins) madeTrades += 1
      world = next
      assertSound(world)
      assert.ok(wealthOf(world) <= before * (1 + 1e-12), `run ${run}, step ${step}`)
    }
  }
  // A good share of the steps must really trade (some are refused: stock, coins, ceiling), or the
  // property says little.
  assert.ok(madeTrades > 150 * 60 * 0.25, `${madeTrades} trades made`)
}

test('no sequence of trades, from any price state, makes coins and materials worth more at base value', () => {
  checkNoArbitrage('no-arbitrage', {})
})

test('with the Storehouse\'s fee at its floor, still no sequence of trades makes anything', () => {
  assert.ok(Math.abs(pricePoint(worldAt(40, { upgrades: AT_FLOOR }), city('goldmill'), 'ore').fee - MARKET_FEE_FLOOR) < 1e-9)
  checkNoArbitrage('no-arbitrage-floor', AT_FLOOR)
})

test('the best price any city pays is below the best price any city asks, in every state, at any fee', () => {
  for (let run = 0; run < 80; run += 1) {
    const world = randomWorld(randomStream(`spread|${run}`), run % 2 ? AT_FLOOR : {})
    for (const id of MATERIALS) {
      const bestSale = Math.max(...cities.map((entry) => unitSellPrice(pricePoint(world, entry, id))))
      const sellers = cities.filter((entry) => entry.produces.includes(id))
      const bestPurchase = Math.min(...sellers.map((entry) => unitBuyPrice(pricePoint(world, entry, id))))
      assert.ok(bestSale < bestPurchase, `${id} in run ${run}`)
    }
  }
})

test('buying where a material is produced and selling it where it is wanted loses coins, for any amount and fee', () => {
  for (const [amount, upgrades] of [1, 7, 100, 999, 5000, 40_000].flatMap((each) => [[each, {}], [each, AT_FLOOR]])) {
    for (const seller of cities) {
      for (const materialId of seller.produces) {
        for (const buyer of cities) {
          const world = worldAt(40, { coins: 1e9, upgrades })
          const bought = buyMaterial(world, cities, { cityId: seller.id, materialId, amount })
          if (bought === world) continue
          const sold = sellMaterial(bought, cities, { cityId: buyer.id, materialId, amount })
          assert.ok(sold.coins < world.coins, `${amount} ${materialId} from ${seller.id} to ${buyer.id}`)
        }
      }
    }
  }
})

test('waiting for prices to recover between a purchase and a sale still loses coins', () => {
  const world = worldAt(40, { coins: 1e9 })
  const bought = buyMaterial(world, cities, { cityId: 'goldmill', materialId: 'fish', amount: 3000 })
  const rested = { ...bought, market: recoverMarket(bought.market, 0, 1000 * HOUR) }
  const sold = sellMaterial(rested, cities, { cityId: 'runespire', materialId: 'fish', amount: 3000 })
  assert.ok(sold.coins < world.coins)
})

test('a huge stock sells for a bounded sum and leaves the numbers finite', () => {
  const world = worldAt(99, { materials: { seals: 1e17 } })
  const sold = sellMaterial(world, cities, { cityId: 'brinehaven', materialId: 'seals', amount: 1e17 })
  const bound = MATERIAL_BASE_VALUES.seals * pricePoint(world, city('brinehaven'), 'seals').depth
  assert.ok(sold.coins > 0 && sold.coins <= bound)
  assert.equal(sold.materials.seals, 0)
  assert.equal(pressureOf(sold, 'brinehaven', 'seals'), MARKET_PRESSURE_MAX)
})
