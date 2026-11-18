// Each open city's trait broker: a few scrolls of the city's own traits a day for coins, which it
// also buys back at a loss, and the swap of a trait a character carries for a scroll in its room's
// chest, the old trait coming back as a scroll for a fee. Which scrolls are on offer is a hash of
// world, city and game day; prices follow the tier and the world level. Pure.
import { MARKET_MAX_COINS, REWARD_GROWTH } from './constants.mjs'
import { emptyMarket, isCityOpen, marketDay } from './market.mjs'
import { worldLevel } from './progression.mjs'
import {
  BROKER_OFFERS,
  BROKER_PRICES,
  BROKER_SELL_SHARE,
  BROKER_TIER_WEIGHTS,
  SWAP_FEE_SHARE
} from './trait-constants.mjs'
import { brokerDiscountOf, pickTier, pickTrait, traitsOf } from './trait-effects.mjs'
import {
  TRAIT_REFUSALS,
  addScrolls,
  hasRoomFor,
  scrollsOf,
  takeScroll,
  traitRecordOf,
  withTraitRecord
} from './traits.mjs'
import { worldIdOf } from './worlds.mjs'

/** @typedef {import('./trait-content.mjs').TraitIndex} TraitIndex */

/** Why a broker deal is refused, beyond the trait refusals. */
export const BROKER_REFUSALS = Object.freeze({
  noCity: 'that city does not trade with this world yet',
  noOffer: 'that scroll is not on offer today',
  sold: 'that scroll was bought already today',
  coins: 'the world does not have the coins'
})

/**
 * A scroll's full price in coins in a world of this level: its tier's BROKER_PRICES grown like
 * kill rewards, less the world's broker discount, rounded, at least 1.
 *
 * @param {string} tier
 * @param {number} level the world level
 * @param {number} [discount] from the traits of the world's characters
 */
export const scrollPrice = (tier, level, discount = 0) =>
  Math.max(1, Math.round(BROKER_PRICES[tier] * REWARD_GROWTH ** level * (1 - discount)))

/** What the broker pays for a scroll: BROKER_SELL_SHARE of its price before any discount. */
export const scrollSalePrice = (tier, level) => Math.max(1, Math.floor(scrollPrice(tier, level) * BROKER_SELL_SHARE))

/** What swapping a trait out costs: SWAP_FEE_SHARE of its price, with the discount. */
export const swapFee = (tier, level, discount = 0) => Math.max(1, Math.round(scrollPrice(tier, level, discount) * SWAP_FEE_SHARE))

/**
 * The day's offers of a city's broker: BROKER_OFFERS different traits of the city, each a tier by
 * BROKER_TIER_WEIGHTS. Each offer is `{ index, traitId, tier, price }`.
 *
 * @param {TraitIndex} index
 * @param {{ worldId: string, cityId: string, day: number, level: number, discount?: number }} where
 * @returns {{ index: number, traitId: string, tier: string, price: number }[]}
 */
export function brokerOffers(index, { worldId, cityId, day, level, discount = 0 }) {
  const seed = `${worldId}|${cityId}|${day}|broker`
  const offers = []
  for (let at = 0; at < BROKER_OFFERS; at += 1) {
    const tier = pickTier(BROKER_TIER_WEIGHTS, `${seed}|${at}|tier`)
    const taken = new Set(offers.map((offer) => offer.traitId))
    const sells = (entry) => entry.city === cityId && Object.hasOwn(BROKER_TIER_WEIGHTS, entry.tier) && !taken.has(entry.id)
    const entry = pickTrait(index, tier, `${seed}|${at}|trait`, sells)
    if (!entry) break
    offers.push({ index: offers.length, traitId: entry.id, tier: entry.tier, price: scrollPrice(entry.tier, level, discount) })
  }
  return offers
}

/**
 * The offers a city's broker sold today in a world.
 *
 * @param {object} world
 * @param {string} cityId
 * @returns {number[]}
 */
export function brokerSold(world, cityId) {
  const sold = traitRecordOf(world).sold[cityId]
  return sold && sold.day === marketDay(world.market ?? emptyMarket()) ? sold.offers : []
}

/** The open city of the content, or null. */
function openCity(world, cities, cityId) {
  const city = cities.find((entry) => entry.id === cityId)
  return city && isCityOpen(city, worldLevel(world.skills)) ? city : null
}

/** The day's offers of a city for a world, with the world's discount. */
export function offersFor(world, { worldId, cityId, index }) {
  const day = marketDay(world.market ?? emptyMarket())
  return brokerOffers(index, { worldId, cityId, day, level: worldLevel(world.skills), discount: brokerDiscountOf(world, index) })
}

/**
 * Why an offer cannot be bought, or null when it can.
 *
 * @param {object} world
 * @param {{ worldId: string, cities: object[], index: TraitIndex | null }} context
 * @param {{ cityId: string, offerIndex: number, traitId: string, projectId: string }} purchase
 * @returns {string | null}
 */
export function buyScrollProblem(world, { worldId, cities, index }, { cityId, offerIndex, traitId, projectId }) {
  if (!index) return TRAIT_REFUSALS.noTraits
  if (!openCity(world, cities, cityId)) return BROKER_REFUSALS.noCity
  const project = Object.hasOwn(world.projects, projectId) ? world.projects[projectId] : null
  if (!project) return TRAIT_REFUSALS.noRoom
  const offer = offersFor(world, { worldId, cityId, index }).find((entry) => entry.index === offerIndex)
  if (!offer || offer.traitId !== traitId) return BROKER_REFUSALS.noOffer
  if (brokerSold(world, cityId).includes(offerIndex)) return BROKER_REFUSALS.sold
  if (!((world.coins ?? 0) >= offer.price)) return BROKER_REFUSALS.coins
  if (!hasRoomFor(project, traitId)) return TRAIT_REFUSALS.chestFull
  return null
}

/**
 * Buys an offer of a city's broker into a room's chest with the world's coins. The same world when
 * refused (`buyScrollProblem` says why). `traitId` names what the buyer saw, so a day that turned
 * is not bought from by mistake.
 *
 * @param {object} world
 * @param {{ worldId: string, cities: object[], index: TraitIndex | null }} context
 * @param {{ cityId: string, offerIndex: number, traitId: string, projectId: string }} purchase
 * @returns {object}
 */
export function buyScroll(world, context, purchase) {
  if (buyScrollProblem(world, context, purchase) !== null) return world
  const { cityId, offerIndex, traitId, projectId } = purchase
  const offer = offersFor(world, { worldId: context.worldId, cityId, index: context.index })[offerIndex]
  const record = traitRecordOf(world)
  const day = marketDay(world.market ?? emptyMarket())
  const sold = { ...record.sold, [cityId]: { day, offers: [...brokerSold(world, cityId), offerIndex].sort() } }
  const project = addScrolls(world.projects[projectId], [traitId]).project
  const known = record.known.includes(traitId) ? record.known : [...record.known, traitId]
  return withTraitRecord({
    ...world,
    coins: world.coins - offer.price,
    projects: { ...world.projects, [projectId]: project }
  }, { known, sold })
}

/**
 * Why a scroll cannot be sold, or null when it can.
 *
 * @param {object} world
 * @param {{ cities: object[], index: TraitIndex | null }} context
 * @param {{ cityId: string, projectId: string, traitId: string }} sale
 * @returns {string | null}
 */
export function sellScrollProblem(world, { cities, index }, { cityId, projectId, traitId }) {
  if (!index) return TRAIT_REFUSALS.noTraits
  if (!openCity(world, cities, cityId)) return BROKER_REFUSALS.noCity
  const project = Object.hasOwn(world.projects, projectId) ? world.projects[projectId] : null
  if (!project) return TRAIT_REFUSALS.noRoom
  if (!index.byId.has(traitId) || !(scrollsOf(project)[traitId] > 0)) return TRAIT_REFUSALS.noScroll
  return null
}

/**
 * Sells one scroll of a room's chest to an open city's broker for coins. The same world when refused.
 *
 * @param {object} world
 * @param {{ cities: object[], index: TraitIndex | null }} context
 * @param {{ cityId: string, projectId: string, traitId: string }} sale
 * @returns {object}
 */
export function sellScroll(world, context, sale) {
  if (sellScrollProblem(world, context, sale) !== null) return world
  const tier = context.index.byId.get(sale.traitId).tier
  const coins = Math.min(MARKET_MAX_COINS, (world.coins ?? 0) + scrollSalePrice(tier, worldLevel(world.skills)))
  const project = takeScroll(world.projects[sale.projectId], sale.traitId)
  return { ...world, coins, projects: { ...world.projects, [sale.projectId]: project } }
}

/** The world, project and character of a swap, or the reason there are none. */
function swapPlace(save, { projectId, sessionId }) {
  const worldId = worldIdOf(save, projectId)
  const world = worldId === null ? null : save.worlds[worldId]
  const project = world && Object.hasOwn(world.projects, projectId) ? world.projects[projectId] : null
  if (!project) return { problem: TRAIT_REFUSALS.noRoom }
  if (!Object.hasOwn(project.characters, sessionId)) return { problem: TRAIT_REFUSALS.noCharacter }
  return { worldId, world, project, character: project.characters[sessionId] }
}

/**
 * The coins swapping a trait out of a character of a world costs.
 *
 * @param {object} world
 * @param {string} traitId the trait taken out
 * @param {TraitIndex} index
 */
export const swapFeeIn = (world, traitId, index) =>
  swapFee(index.byId.get(traitId).tier, worldLevel(world.skills), brokerDiscountOf(world, index))

/**
 * Why a character cannot swap a trait it carries for a scroll of its room's chest, or null.
 *
 * @param {object} save
 * @param {{ projectId: string, sessionId: string, oldTraitId: string, traitId: string }} swap
 * @param {TraitIndex | null} index
 * @returns {string | null}
 */
export function swapProblem(save, swap, index) {
  if (!index) return TRAIT_REFUSALS.noTraits
  const place = swapPlace(save, swap)
  if (place.problem) return place.problem
  const carried = traitsOf(place.character, index)
  if (!carried.includes(swap.oldTraitId)) return TRAIT_REFUSALS.notCarried
  if (!index.byId.has(swap.traitId) || !(scrollsOf(place.project)[swap.traitId] > 0)) return TRAIT_REFUSALS.noScroll
  if (carried.includes(swap.traitId)) return TRAIT_REFUSALS.carries
  if (!hasRoomFor(place.project, swap.oldTraitId)) return TRAIT_REFUSALS.chestFull
  if (!((place.world.coins ?? 0) >= swapFeeIn(place.world, swap.oldTraitId, index))) return BROKER_REFUSALS.coins
  return null
}

/**
 * Swaps a trait a character carries for a scroll of its room's chest, in the same slot. The old
 * trait goes back to the chest as a scroll, for a fee in the world's coins. The same save when
 * refused (`swapProblem` says why).
 *
 * @param {object} save
 * @param {{ projectId: string, sessionId: string, oldTraitId: string, traitId: string }} swap
 * @param {TraitIndex | null} index
 * @returns {object}
 */
export function swapTrait(save, swap, index) {
  if (swapProblem(save, swap, index) !== null) return save
  const { worldId, world, project, character } = swapPlace(save, swap)
  const fee = swapFeeIn(world, swap.oldTraitId, index)
  const traits = traitsOf(character, index).map((id) => (id === swap.oldTraitId ? swap.traitId : id))
  const taught = { ...character, traits }
  const used = takeScroll({ ...project, characters: { ...project.characters, [character.sessionId]: taught } }, swap.traitId)
  const next = addScrolls(used, [swap.oldTraitId]).project
  const paid = { ...world, coins: world.coins - fee, projects: { ...world.projects, [swap.projectId]: next } }
  const record = traitRecordOf(world)
  const nextWorld = withTraitRecord(paid, { ...record, swaps: record.swaps + 1 })
  return { ...save, worlds: { ...save.worlds, [worldId]: nextWorld } }
}
