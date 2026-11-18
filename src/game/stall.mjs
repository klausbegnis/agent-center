// A city's stall: a few pieces of gear for coins, one tier above what the world's monsters drop,
// new every game day. Which pieces is a hash of world, city and day; the price follows the
// piece's tier and the world's level. A bought piece goes into a room's chest like a drop would,
// never past the copies a chest keeps. Pure.
import { addToChest } from './chest.mjs'
import { EXTRA_OFFER_INDEX } from './city-rank-constants.mjs'
import { cityRankOf, stallExtras } from './city-ranks.mjs'
import { COPIES_PER_ITEM, ITEM_MAX_TIER, MATERIAL_BASE_VALUES, STALL_MARKUP, STALL_OFFERS } from './constants.mjs'
import { dropTier } from './drops.mjs'
import { hashOf } from './hash.mjs'
import { createItem, effectiveGearLevel, upgradeCost } from './items.mjs'
import { emptyMarket, isCityOpen, marketDay } from './market.mjs'
import { worldLevel } from './progression.mjs'

/**
 * The kinds of gear a stall can offer, one offer each at most: a weapon of each damage type, an
 * outfit and a tool. A later kind of offer (not gear) gets a `kind` of its own.
 */
const GEAR_KINDS = Object.freeze([
  { slot: 'weapon', damageType: 'physical' },
  { slot: 'weapon', damageType: 'magical' },
  { slot: 'outfit' },
  { slot: 'tool' }
])

/**
 * The tier a stall sells in a world of this level: one above what its monsters drop.
 *
 * @param {number} level the world level
 */
export const stallTier = (level) => Math.min(ITEM_MAX_TIER, dropTier(level) + 1)

/**
 * A piece's price in coins: the base value of the materials that would upgrade a fresh copy of
 * it at tier 1 up to its gear level in this world (at least one upgrade's worth), times
 * STALL_MARKUP, rounded, at least 1.
 *
 * @param {{ tier: number, recipe: string[] }} entry
 * @param {number} level the world level
 */
export function stallPrice(entry, level) {
  let units = 0
  const steps = effectiveGearLevel({ tier: entry.tier, level: 0 })
  for (let step = 0; step < steps; step += 1) {
    units += Object.values(upgradeCost({ tier: 1, level: step, recipe: [entry.recipe[0]] }, { worldLevel: level }))[0]
  }
  units = Math.max(units, Object.values(upgradeCost({ tier: 1, level: 0, recipe: ['ore'] }, { worldLevel: level }))[0])
  const value = entry.recipe.reduce((sum, materialId) => sum + MATERIAL_BASE_VALUES[materialId], 0)
  return Math.max(1, Math.round(units * value * STALL_MARKUP))
}

/** The kinds in an order of the day's own, by hash. */
function kindsOfTheDay(seed) {
  return [...GEAR_KINDS]
    .map((kind, index) => ({ kind, roll: hashOf(`${seed}|${index}`) }))
    .sort((a, b) => a.roll - b.roll)
    .map(({ kind }) => kind)
}

/**
 * The day's offers of a city's stall: up to STALL_OFFERS pieces of generic gear at the stall's
 * tier, each a different kind. Each offer is `{ index, kind: 'item', entry, price }`.
 * A city of a higher rank (city-ranks.mjs) offers one more piece, at EXTRA_OFFER_INDEX, and later
 * one tier higher.
 *
 * @param {{ items: object[] }} itemContent a valid items file
 * @param {{ worldId: string, cityId: string, day: number, level: number, rank?: number }} where
 * @returns {{ index: number, kind: 'item', entry: object, price: number }[]}
 */
export function stallOffers(itemContent, { worldId, cityId, day, level, rank = 1 }) {
  const { extraOffers, tierBonus } = stallExtras(rank)
  const tier = Math.min(ITEM_MAX_TIER, stallTier(level) + tierBonus)
  const seed = `${worldId}|${cityId}|${day}`
  const offers = []
  for (const kind of kindsOfTheDay(seed)) {
    if (offers.length >= STALL_OFFERS + extraOffers) break
    const fitting = itemContent.items.filter((entry) => entry.themes === undefined && entry.tier === tier &&
      entry.slot === kind.slot && entry.damageType === kind.damageType)
    if (fitting.length === 0) continue
    const entry = fitting[hashOf(`${seed}|${kind.slot}|${kind.damageType ?? ''}`) % fitting.length]
    const index = offers.length < STALL_OFFERS ? offers.length : EXTRA_OFFER_INDEX
    offers.push({ index, kind: 'item', entry, price: stallPrice(entry, level) })
  }
  return offers
}

/**
 * The offers of the day already bought in a city.
 *
 * @param {import('./market.mjs').Market | undefined} market
 * @param {string} cityId
 * @returns {number[]}
 */
export function soldOffers(market, cityId) {
  const sold = market?.sold?.[cityId]
  return sold && sold.day === marketDay(market) ? sold.offers : []
}

/** Whether a chest already keeps as many copies of an entry as it may. */
export const isChestFullOf = (chest, entryId) =>
  chest.filter((item) => (item.entryId ?? item.id) === entryId).length >= COPIES_PER_ITEM

/**
 * Buys an offer of an open city's stall with the world's coins, into a project of the world.
 * Unchanged when the city is closed, the offer is not today's (`entryId` names what the buyer
 * saw), it was bought already, the coins do not cover it, or the chest already keeps
 * COPIES_PER_ITEM copies of it.
 *
 * @param {object} world
 * @param {{ worldId: string, cities: import('./market.mjs').City[], items: { items: object[] } }} context
 * @param {{ cityId: string, offerIndex: number, entryId: string, projectId: string }} purchase
 * @returns {object}
 */
export function buyStallOffer(world, { worldId, cities, items }, { cityId, offerIndex, entryId, projectId }) {
  const level = worldLevel(world.skills)
  const city = cities.find((entry) => entry.id === cityId)
  const project = world.projects[projectId]
  if (!city || !isCityOpen(city, level) || !project) return world
  const market = world.market ?? emptyMarket()
  const day = marketDay(market)
  const rank = cityRankOf(world, cityId)
  const offer = stallOffers(items, { worldId, cityId, day, level, rank }).find((entry) => entry.index === offerIndex)
  if (!offer || offer.entry.id !== entryId || soldOffers(market, cityId).includes(offerIndex)) return world
  if (!((world.coins ?? 0) >= offer.price) || isChestFullOf(project.chest, entryId)) return world
  const chest = addToChest(project.chest, createItem(offer.entry))
  const sold = { ...market.sold, [cityId]: { day, offers: [...soldOffers(market, cityId), offerIndex].sort() } }
  return {
    ...world,
    coins: world.coins - offer.price,
    market: { ...market, sold },
    projects: { ...world.projects, [projectId]: { ...project, chest } }
  }
}
