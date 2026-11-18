// The trading player's charters: on each visit to the market it buys every city's next charter it
// can, oldest city first, after the stall's relics and before building levels paid in coins, so the
// simulator measures how long a city takes to reach each rank. Uses only what the Market tab offers.
import { charterPrice, cityStandingOf } from '../src/game/city-ranks.mjs'
import { isCityOpen } from '../src/game/market.mjs'
import { worldLevel } from '../src/game/progression.mjs'

/** Charters bought at most in one visit, so one rich day cannot buy every rank of every city. */
const CHARTERS_PER_VISIT = 3

/**
 * Buys the charters the world can pay for now.
 *
 * @param {ReturnType<typeof import('../src/game/engine.mjs').createEngine>} engine
 * @param {object} save
 * @param {object[]} cities
 * @param {{ charters?: number }} counts added to
 * @returns {object}
 */
export function buyCharters(engine, save, cities, counts) {
  let next = save
  let bought = 0
  for (const city of cities) {
    if (bought >= CHARTERS_PER_VISIT || !isCityOpen(city, worldLevel(next.worlds.main.skills))) continue
    const which = { worldId: 'main', cityId: city.id }
    if (engine.charterProblem(next, which) !== null) continue
    next = engine.buyCharter(next, which)
    bought += 1
    counts.charters = (counts.charters ?? 0) + 1
  }
  return next
}

/**
 * The coins the next charter within reach costs: the cheapest of the open cities whose standing is
 * enough for their next rank, or 0. The player keeps them aside from building levels paid in coins.
 *
 * @param {object} world
 * @param {object[]} cities
 * @returns {number}
 */
export function charterReserve(world, cities) {
  const level = worldLevel(world.skills)
  const prices = cities.filter((city) => isCityOpen(city, level)).map((city) => {
    const { rank, standing } = cityStandingOf(world, city.id)
    const price = charterPrice(city, rank + 1, level)
    return price && standing >= price.standing ? price.coins : Infinity
  })
  const cheapest = Math.min(Infinity, ...prices)
  return Number.isFinite(cheapest) ? cheapest : 0
}
