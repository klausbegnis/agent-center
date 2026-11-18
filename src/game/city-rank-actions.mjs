// The market's actions with city ranks: every deal in a city adds to the world's standing there
// (noteTrade), a rank V stall's legendary piece is bought at its own index, and a charter raises a
// city's rank. Wraps the engine's market actions; each answers the same save when it cannot act.
import { LEGENDARY_OFFER_INDEX } from './city-rank-constants.mjs'
import { cityRankIndexOf } from './city-ranks-content.mjs'
import { buyCharter, charterProblem, cityRankNews, noteTrade } from './city-ranks.mjs'
import { buyStallLegendary } from './city-stall-legendary.mjs'
import { legendaryIndexOf } from './legendary-effects.mjs'

/** A save with one existing world changed; the same save when the world is missing or unchanged. */
function inWorld(save, worldId, change) {
  const world = Object.hasOwn(save.worlds, worldId) ? save.worlds[worldId] : null
  if (!world) return save
  const next = change(world)
  return next === world ? save : { ...save, worlds: { ...save.worlds, [worldId]: next } }
}

/** An action that, when it changes a world, adds what it traded to the city's standing. */
const counted = (action) => (save, deal) => {
  const next = action(save, deal)
  if (next === save || !Object.hasOwn(save.worlds, deal.worldId)) return next
  const before = save.worlds[deal.worldId]
  const after = next.worlds[deal.worldId]
  return { ...next, worlds: { ...next.worlds, [deal.worldId]: noteTrade(before, after, deal.cityId) } }
}

/**
 * The engine's market actions with city ranks.
 *
 * @param {{ sellMaterial: Function, buyMaterial: Function, tradeMaterial: Function, buyStallOffer: Function }} market
 *   the engine's own (engine.mjs)
 * @param {object} content the game content
 */
export function withCityRanks(market, content) {
  const cities = content.cities?.cities ?? []
  const cityRanks = cityRankIndexOf(content)
  const legendary = legendaryIndexOf(content)
  const buyLegendary = (save, { worldId, ...purchase }) =>
    inWorld(save, worldId, (world) => buyStallLegendary(world, { worldId, cities, legendary, cityRanks }, purchase))
  return {
    sellMaterial: counted(market.sellMaterial),
    buyMaterial: counted(market.buyMaterial),
    tradeMaterial: counted(market.tradeMaterial),
    buyStallOffer: counted((save, purchase) =>
      (purchase.offerIndex === LEGENDARY_OFFER_INDEX ? buyLegendary(save, purchase) : market.buyStallOffer(save, purchase))),
    /** Buys a city's next charter (city-ranks.mjs); the same save when it cannot. */
    buyCharter: (save, { worldId, cityId }) => inWorld(save, worldId, (world) => buyCharter(world, cities, cityRanks, cityId)),
    /** Why a city's next charter cannot be bought now, or null. */
    charterProblem: (save, { worldId, cityId }) => {
      const world = Object.hasOwn(save.worlds, worldId) ? save.worlds[worldId] : null
      return world ? charterProblem(world, cities, cityRanks, cityId) : 'there is no such world'
    },
    /** The city ranks a change raised, for the rooms and the journal to celebrate (city-ranks.mjs). */
    cityRankNews: (before, after) => cityRankNews(before, after, { cities, index: cityRanks })
  }
}
