// The Market tab quotes a sale and a trade from the view state before the worker makes it. Here
// the two programs' maths are held to the same answer: the tab's quote against what the engine
// does to a world, over many amounts and price states. A test may read both; the code may not.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { hashOf } from '../../src/game/hash.mjs'
import { marketView } from '../../src/game/market-view.mjs'
import { sellMaterial, tradeMaterial } from '../../src/game/market.mjs'
import { emptyWorld } from '../../src/game/worlds.mjs'
import { MARKET_MATERIALS, sellQuote, pricePoint, tradeQuote } from './market-model.js'

const readGame = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const { cities } = readGame('cities.json')
const items = readGame('items.json')
const WORK = ['forge', 'lore', 'engineering', 'arcana', 'command']

/** A world at a level with random pressures in every city, from a seed. */
function worldFrom(seed) {
  const roll = (text) => hashOf(`${seed}|${text}`) / 4294967296
  const level = 1 + Math.floor(roll('level') * 99)
  const skills = Object.fromEntries(WORK.map((id) => [id, { level, xp: 0, banked: 0, stars: 0 }]))
  const pressure = {}
  for (const city of cities) {
    pressure[city.id] = {}
    for (const id of MARKET_MATERIALS) {
      if (roll(`${city.id}|${id}|moved`) < 0.5) pressure[city.id][id] = -2 + roll(`${city.id}|${id}`) * 12
    }
  }
  const materials = Object.fromEntries(MARKET_MATERIALS.map((id) => [id, 1e7]))
  return { ...emptyWorld(), skills, materials, market: { clock: 0, pressure, sold: {} } }
}

const AMOUNTS = [1, 2, 7, 55, 300, 999, 4_321, 60_000, 1_000_000]

test('the tab\'s sale quote is the coins the engine pays, for every amount, city and price state', () => {
  for (let seed = 0; seed < 25; seed += 1) {
    const world = worldFrom(seed)
    const shown = marketView('main', world, { cities, items })
    for (const city of shown.cities.filter((entry) => entry.open)) {
      for (const materialId of MARKET_MATERIALS) {
        for (const amount of AMOUNTS) {
          const sold = sellMaterial(world, cities, { cityId: city.id, materialId, amount })
          const engineCoins = sold === world ? 0 : sold.coins - world.coins
          const quote = sellQuote(pricePoint(shown, city, materialId), amount).coins
          // The engine refuses a sale that would pay nothing; the tab quotes 0 then.
          assert.equal(engineCoins, quote >= 1 ? quote : 0, `${seed} ${city.id} ${materialId} ${amount}`)
        }
      }
    }
  }
})

test('the tab\'s trade quote is the units and coins back the engine gives', () => {
  for (let seed = 100; seed < 120; seed += 1) {
    const world = worldFrom(seed)
    const shown = marketView('main', world, { cities, items })
    for (const city of shown.cities.filter((entry) => entry.open)) {
      for (const toId of city.produces) {
        for (const fromId of MARKET_MATERIALS.filter((id) => id !== toId)) {
          for (const amount of AMOUNTS) {
            const traded = tradeMaterial(world, cities, { cityId: city.id, fromId, toId, amount })
            const quote = tradeQuote(shown, city, { fromId, toId, amount })
            const got = traded === world ? { units: 0, change: 0 }
              : { units: traded.materials[toId] - world.materials[toId], change: traded.coins - world.coins }
            assert.deepEqual(got, quote, `${seed} ${city.id} ${fromId}→${toId} ${amount}`)
          }
        }
      }
    }
  }
})
