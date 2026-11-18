// A city's stall sells a relic now and then: one of that city's relics (relicsCityCanOffer) that
// the room it would go to does not own, at a steep price in coins. It is the offer after the
// gear (index STALL_OFFERS) and is bought once a day like the others. Boss relics are never sold.
// Pure: which relic and whether there is one come from a hash of world, city and day.
import { cityRankOf, stallExtras } from './city-ranks.mjs'
import { REWARD_GROWTH, STALL_OFFERS, STALL_RELIC_PRICE_BASE } from './constants.mjs'
import { chanceOf, hashOf } from './hash.mjs'
import { relicsCityCanOffer } from './legendary-content.mjs'
import { legendaryOf, withRelic } from './legendary.mjs'
import { emptyMarket, isCityOpen, marketDay } from './market.mjs'
import { worldLevel } from './progression.mjs'
import { soldOffers } from './stall.mjs'

/** The relic's place among a stall's offers: after the gear. */
export const RELIC_OFFER_INDEX = STALL_OFFERS

/**
 * A stall relic's price in coins at a world level.
 *
 * @param {number} level
 */
export const stallRelicPrice = (level) => Math.max(1, Math.round(STALL_RELIC_PRICE_BASE * REWARD_GROWTH ** level))

/**
 * Whether a city's stall has a relic on a day: STALL_RELIC_CHANCE, by hash, or more often in a city
 * of a high rank (city-ranks.mjs).
 */
export const hasRelicOnDay = ({ worldId, cityId, day, rank = 1 }) =>
  chanceOf(`${worldId}|${cityId}|${day}|relic`) < stallExtras(rank).relicChance

/**
 * The relic a city's stall offers a room on a day, or null: none that day, or the room owns every
 * relic of the city. The pick among the ones the room lacks is a hash, so each room sees one
 * relic all day.
 *
 * @param {import('./legendary-content.mjs').LegendaryIndex | null} index
 * @param {{ worldId: string, cityId: string, day: number, level: number, ownedIds: string[] }} where
 * @returns {{ index: number, kind: 'relic', entry: object, price: number } | null}
 */
export function stallRelicOffer(index, { worldId, cityId, day, level, ownedIds, rank = 1 }) {
  if (!index || !hasRelicOnDay({ worldId, cityId, day, rank })) return null
  const offered = relicsCityCanOffer(index, { cityId, ownedIds })
  if (offered.length === 0) return null
  const entry = offered[hashOf(`${worldId}|${cityId}|${day}|relic-pick`) % offered.length]
  return { index: RELIC_OFFER_INDEX, kind: 'relic', entry, price: stallRelicPrice(level) }
}

/**
 * Buys the day's relic of an open city's stall with the world's coins, for a project of the world:
 * the relic joins its relics, and the room's first relic becomes active. Unchanged when the city
 * is closed, there is no relic today, `entryId` is not the one offered to that room, it was
 * bought already today, or the coins do not cover it.
 *
 * @param {object} world
 * @param {{ worldId: string, cities: object[], index: import('./legendary-content.mjs').LegendaryIndex | null }} context
 * @param {{ cityId: string, entryId: string, projectId: string }} purchase
 * @returns {object}
 */
export function buyStallRelic(world, { worldId, cities, index }, { cityId, entryId, projectId }) {
  const level = worldLevel(world.skills)
  const city = cities.find((entry) => entry.id === cityId)
  const project = world.projects[projectId]
  if (!city || !isCityOpen(city, level) || !project) return world
  const market = world.market ?? emptyMarket()
  const day = marketDay(market)
  const ownedIds = legendaryOf(project).relics
  const offer = stallRelicOffer(index, { worldId, cityId, day, level, ownedIds, rank: cityRankOf(world, cityId) })
  if (!offer || offer.entry.id !== entryId || soldOffers(market, cityId).includes(RELIC_OFFER_INDEX)) return world
  if (!((world.coins ?? 0) >= offer.price)) return world
  const sold = { ...market.sold, [cityId]: { day, offers: [...soldOffers(market, cityId), RELIC_OFFER_INDEX].sort() } }
  return {
    ...world,
    coins: world.coins - offer.price,
    market: { ...market, sold },
    projects: { ...world.projects, [projectId]: withRelic(project, entryId) }
  }
}

/**
 * The day's relic of a city as the market view shows it: whether there is one, its price, whether
 * it was bought, and the relic each room of the world would get (null for a room that owns the
 * city's relics). Null when the stall has no relic today.
 *
 * @param {object} world
 * @param {{ worldId: string, cityId: string, day: number, level: number,
 *   index: import('./legendary-content.mjs').LegendaryIndex | null }} where
 */
export function stallRelicView(world, { worldId, cityId, day, level, index }) {
  const rank = cityRankOf(world, cityId)
  if (!index || !hasRelicOnDay({ worldId, cityId, day, rank })) return null
  const market = world.market ?? emptyMarket()
  const byRoom = Object.fromEntries(Object.keys(world.projects).sort().map((projectId) => {
    const ownedIds = legendaryOf(world.projects[projectId]).relics
    return [projectId, stallRelicOffer(index, { worldId, cityId, day, level, ownedIds, rank })?.entry.id ?? null]
  }))
  const price = stallRelicPrice(level)
  return {
    index: RELIC_OFFER_INDEX,
    kind: 'relic',
    price,
    sold: soldOffers(market, cityId).includes(RELIC_OFFER_INDEX),
    affordable: (world.coins ?? 0) >= price,
    byRoom
  }
}
