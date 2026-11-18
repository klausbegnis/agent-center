// A city at its last rank sells legendary equipment now and then: one piece of the city's own list
// (game/cities.json, `ranks.legendary`) that the room it would go to lacks, ready to use like a
// boss's drop, at a steep price. It is the offer at LEGENDARY_OFFER_INDEX and is bought once a day
// like the others. Pure: whether there is one and which come from a hash of world, city and day.
import { LEGENDARY_OFFER_INDEX, LEGENDARY_RANK, STALL_LEGENDARY_CHANCE, STALL_LEGENDARY_PRICE_BASE } from './city-rank-constants.mjs'
import { cityRankOf } from './city-ranks.mjs'
import { addToChest } from './chest.mjs'
import { REWARD_GROWTH } from './constants.mjs'
import { chanceOf, hashOf } from './hash.mjs'
import { legendaryItemFor } from './legendary-drops.mjs'
import { ownsLegendary } from './legendary.mjs'
import { emptyMarket, isCityOpen, marketDay } from './market.mjs'
import { worldLevel } from './progression.mjs'
import { soldOffers } from './stall.mjs'

/** A stall's legendary piece's price in coins at a world level. */
export const stallLegendaryPrice = (level) => Math.max(1, Math.round(STALL_LEGENDARY_PRICE_BASE * REWARD_GROWTH ** level))

/** Whether a city's stall offers a legendary piece on a day, by hash. */
const hasLegendaryOnDay = ({ worldId, cityId, day }) => chanceOf(`${worldId}|${cityId}|${day}|legendary`) < STALL_LEGENDARY_CHANCE

/**
 * The legendary piece a city's stall offers a room on a day, or null: the city is not at its last
 * rank, there is none that day, or the room owns every piece the city sells.
 *
 * @param {{ legendary: import('./legendary-content.mjs').LegendaryIndex | null,
 *   cityRanks: import('./city-ranks-content.mjs').CityRankIndex | null }} indexes
 * @param {{ worldId: string, cityId: string, day: number, level: number, rank: number, project: object }} where
 * @returns {{ index: number, kind: 'legendary', entry: object, price: number } | null}
 */
export function stallLegendaryOffer({ legendary, cityRanks }, { worldId, cityId, day, level, rank, project }) {
  if (!legendary || rank < LEGENDARY_RANK || !hasLegendaryOnDay({ worldId, cityId, day })) return null
  const listed = cityRanks?.byCity.get(cityId)?.legendary ?? []
  const offered = listed.filter((id) => legendary.byId.get(id)?.kind === 'equipment' && !ownsLegendary(project, id))
  if (offered.length === 0) return null
  const entry = legendary.byId.get(offered[hashOf(`${worldId}|${cityId}|${day}|legendary-pick`) % offered.length])
  return { index: LEGENDARY_OFFER_INDEX, kind: 'legendary', entry, price: stallLegendaryPrice(level) }
}

/**
 * Buys the day's legendary piece of a city's stall for a room of the world: it goes into the
 * room's chest at the reference gear of the world, like a boss's drop. Unchanged when the city is
 * closed or below its last rank, there is no piece today, `entryId` is not the one offered to that
 * room, it was bought already today, or the coins do not cover it.
 *
 * @param {object} world
 * @param {{ worldId: string, cities: object[], legendary: object | null, cityRanks: object | null }} context
 * @param {{ cityId: string, entryId: string, projectId: string }} purchase
 * @returns {object}
 */
export function buyStallLegendary(world, { worldId, cities, legendary, cityRanks }, { cityId, entryId, projectId }) {
  const level = worldLevel(world.skills)
  const city = cities.find((entry) => entry.id === cityId)
  const project = world.projects[projectId]
  if (!city || !isCityOpen(city, level) || !project) return world
  const market = world.market ?? emptyMarket()
  const day = marketDay(market)
  const where = { worldId, cityId, day, level, rank: cityRankOf(world, cityId), project }
  const offer = stallLegendaryOffer({ legendary, cityRanks }, where)
  if (!offer || offer.entry.id !== entryId || soldOffers(market, cityId).includes(LEGENDARY_OFFER_INDEX)) return world
  if (!((world.coins ?? 0) >= offer.price)) return world
  const sold = { ...market.sold, [cityId]: { day, offers: [...soldOffers(market, cityId), LEGENDARY_OFFER_INDEX].sort() } }
  const chest = addToChest(project.chest, legendaryItemFor(offer.entry, level))
  return {
    ...world,
    coins: world.coins - offer.price,
    market: { ...market, sold },
    projects: { ...world.projects, [projectId]: { ...project, chest } }
  }
}

/**
 * The day's legendary piece of a city as the market view shows it: its price, whether it was
 * bought, and the piece each room of the world would get (null for a room that owns them all).
 * Null when the stall has none today.
 *
 * @param {object} world
 * @param {{ worldId: string, cityId: string, day: number, level: number, legendary: object | null,
 *   cityRanks: object | null }} where
 */
export function stallLegendaryView(world, { worldId, cityId, day, level, legendary, cityRanks }) {
  const rank = cityRankOf(world, cityId)
  const byRoom = Object.fromEntries(Object.keys(world.projects).sort().map((projectId) => {
    const where = { worldId, cityId, day, level, rank, project: world.projects[projectId] }
    return [projectId, stallLegendaryOffer({ legendary, cityRanks }, where)?.entry.id ?? null]
  }))
  if (!Object.values(byRoom).some(Boolean)) return null
  const price = stallLegendaryPrice(level)
  return {
    index: LEGENDARY_OFFER_INDEX,
    kind: 'legendary',
    price,
    sold: soldOffers(world.market ?? emptyMarket(), cityId).includes(LEGENDARY_OFFER_INDEX),
    affordable: (world.coins ?? 0) >= price,
    byRoom
  }
}
