// What a UI receives about traits, added to the engine's view (view.mjs calls `withTraitsView`):
// the catalogue once, each world's collection and its brokers' day, each room's scrolls and each
// character's traits and slots. Pure.
import { MARKET_MAX_COINS } from './constants.mjs'
import { isCityOpen } from './market.mjs'
import { worldLevel } from './progression.mjs'
import { brokerSold, offersFor, scrollSalePrice, swapFee } from './trait-broker.mjs'
import { TRAIT_SLOT_LEVELS, TRAIT_TIERS } from './trait-constants.mjs'
import { traitIndexOf } from './trait-content.mjs'
import { bornTrait, brokerDiscountOf, nextSlotLevel, traitSlots, traitsOf } from './trait-effects.mjs'
import { collectedTraits, scrollsOf } from './traits.mjs'

/** @typedef {import('./trait-content.mjs').TraitIndex} TraitIndex */

/** The catalogue as the UI shows it: tiers with their colours, and every trait. */
function catalogueView(index) {
  return {
    tiers: index.tiers.map(({ id, name, colour }) => ({ id, name, colour })),
    entries: index.ids.map((id) => {
      const { name, tier, family, city, flavour, effect, drawback } = index.byId.get(id)
      return { id, name, tier, family, city: city ?? null, flavour, effect: { ...effect }, ...(drawback ? { drawback: { ...drawback } } : {}) }
    }),
    total: index.ids.length,
    slotLevels: [...TRAIT_SLOT_LEVELS]
  }
}

/** A character's traits: those it carries, its slots, the level of its next one, and its born trait. */
function characterTraits(character, index) {
  return {
    carried: traitsOf(character, index),
    slots: traitSlots(character.level),
    nextSlotAt: nextSlotLevel(character.level),
    born: bornTrait(character.sessionId, index)
  }
}

/** A world's collection, its brokers' offers of the day, and what selling and swapping cost there. */
function worldTraits(worldId, world, cities, index) {
  const level = worldLevel(world.skills)
  const discount = brokerDiscountOf(world, index)
  const coins = Math.min(MARKET_MAX_COINS, world.coins ?? 0)
  const brokers = Object.fromEntries(cities.filter((city) => isCityOpen(city, level)).map((city) => {
    const sold = brokerSold(world, city.id)
    const offers = offersFor(world, { worldId, cityId: city.id, index }).map((offer) =>
      ({ ...offer, sold: sold.includes(offer.index), affordable: coins >= offer.price }))
    return [city.id, { offers }]
  }))
  return {
    known: collectedTraits(world, index),
    discount,
    brokers,
    salePrices: Object.fromEntries(TRAIT_TIERS.map((tier) => [tier, scrollSalePrice(tier, level)])),
    swapFees: Object.fromEntries(TRAIT_TIERS.map((tier) => [tier, swapFee(tier, level, discount)]))
  }
}

/**
 * The engine's view with the traits' parts added. The same view when the content has no traits.
 *
 * @param {{ worlds: object[] }} view what viewOf built
 * @param {object} save
 * @param {object} content
 * @returns {object}
 */
export function withTraitsView(view, save, content) {
  const index = traitIndexOf(content)
  if (!index) return view
  const cities = content.cities?.cities ?? []
  const worlds = view.worlds.map((worldView) => {
    const world = save.worlds[worldView.id]
    const projects = worldView.projects.map((projectView) => {
      const project = world.projects[projectView.id]
      const party = projectView.party.map((member) =>
        ({ ...member, traits: characterTraits(project.characters[member.sessionId], index) }))
      const scrolls = Object.entries(scrollsOf(project)).filter(([id]) => index.byId.has(id))
        .map(([traitId, count]) => ({ traitId, count }))
      return { ...projectView, party, scrolls }
    })
    return { ...worldView, projects, traits: worldTraits(worldView.id, world, cities, index) }
  })
  return { ...view, worlds, traits: catalogueView(index) }
}
