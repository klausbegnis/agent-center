// A world's market as a UI draws it: the cities with whether they are open, their prices'
// pressure and the day's stall, and the numbers a UI needs to quote any amount the way the
// engine will (docs/GAME.md, "Market"). Pure.
import { MARKET_CITY_FACTORS, MARKET_FEE, MARKET_PRESSURE_MAX, MARKET_PRESSURE_MIN, MATERIAL_BASE_VALUES } from './constants.mjs'
import { effectiveGearLevel } from './items.mjs'
import { legendaryIndexOf } from './legendary-effects.mjs'
import { marketDepth } from './market-prices.mjs'
import { emptyMarket, isCityOpen, marketDay } from './market.mjs'
import { worldLevel } from './progression.mjs'
import { isChestFullOf, soldOffers, stallOffers } from './stall.mjs'
import { stallRelicView } from './stall-relic.mjs'

function offerView(offer, { sold, coins, projects }) {
  const { entry } = offer
  return {
    index: offer.index,
    kind: offer.kind,
    entryId: entry.id,
    name: entry.name,
    slot: entry.slot,
    damageType: entry.damageType ?? null,
    tier: entry.tier,
    power: effectiveGearLevel({ tier: entry.tier, level: 0 }),
    price: offer.price,
    sold: sold.includes(offer.index),
    affordable: coins >= offer.price,
    // The rooms whose chest already keeps as many copies as it may: a purchase there is refused.
    fullIn: Object.keys(projects).sort().filter((projectId) => isChestFullOf(projects[projectId].chest, entry.id))
  }
}

function cityView(city, { worldId, world, level, day, items, index }) {
  const open = isCityOpen(city, level)
  const view = {
    id: city.id,
    name: city.name,
    tagline: city.tagline,
    banner: city.banner,
    bannerAlt: city.bannerAlt,
    opensAt: city.opensAt,
    open,
    produces: [...city.produces],
    wants: [...city.wants]
  }
  if (!open) return view
  const market = world.market ?? emptyMarket()
  const offers = stallOffers(items, { worldId, cityId: city.id, day, level })
  const context = { sold: soldOffers(market, city.id), coins: world.coins ?? 0, projects: world.projects }
  return {
    ...view,
    pressure: { ...market.pressure[city.id] },
    stall: offers.map((offer) => offerView(offer, context)),
    // Now and then one of the city's relics, the one each room would get (stall-relic.mjs).
    relic: stallRelicView(world, { worldId, cityId: city.id, day, level, index })
  }
}

/**
 * The market of a world.
 *
 * @param {string} worldId
 * @param {object} world
 * @param {{ cities: object[], items: { items: object[] }, legendary?: object }} content `legendary`,
 *   the parsed game/legendary.json, lets a stall offer relics
 * @returns {{ day: number, fee: number, depth: number, pressureRange: [number, number],
 *   baseValues: Record<string, number>, cityFactors: Record<string, number>, cities: object[] }}
 */
export function marketView(worldId, world, { cities, items, legendary }) {
  const level = worldLevel(world.skills)
  const day = marketDay(world.market)
  const index = legendaryIndexOf({ legendary })
  return {
    day,
    fee: MARKET_FEE,
    depth: marketDepth(level),
    pressureRange: [MARKET_PRESSURE_MIN, MARKET_PRESSURE_MAX],
    baseValues: { ...MATERIAL_BASE_VALUES },
    cityFactors: { ...MARKET_CITY_FACTORS },
    cities: cities.map((city) => cityView(city, { worldId, world, level, day, items, index }))
  }
}
