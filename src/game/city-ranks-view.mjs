// A city's rank as the Market tab draws it: the rank and its title and banner, the standing towards
// the next, the next charter's price and why it cannot be bought yet, what the next rank gives and
// the perks reached so far. Pure.
import { CITY_RANK_FEE_CUT, CITY_RANK_MAX, EXTRA_OFFER_RANK, LEGENDARY_RANK, RELIC_RANK, TIER_BONUS_RANK } from './city-rank-constants.mjs'
import { charterBlock, charterPrice, cityFeeOf, cityStandingOf } from './city-ranks.mjs'

/** What reaching a rank adds to the city's stall, besides its perk. */
function stallGains(rank) {
  return {
    extraOffer: rank === EXTRA_OFFER_RANK,
    tierBonus: rank === TIER_BONUS_RANK,
    relicMoreOften: rank === RELIC_RANK,
    legendary: rank === LEGENDARY_RANK
  }
}

/** A charter as the view gives it. */
const charterView = (charter) => ({ name: charter.name, perk: charter.perk, effect: { ...charter.effect } })

/**
 * @param {object} world
 * @param {object} city an entry of game/cities.json, open to the world
 * @param {{ level: number, index: import('./city-ranks-content.mjs').CityRankIndex | null,
 *   legendaryNames: (id: string) => string }} context
 * @returns {object | null} null when the city has no ranks
 */
export function cityRankView(world, city, { level, index, legendaryNames }) {
  const ranks = index?.byCity.get(city.id)
  if (!ranks) return null
  const { rank, standing } = cityStandingOf(world, city.id)
  const price = charterPrice(city, rank + 1, level)
  const banner = ranks.banners[rank - 1]
  return {
    rank,
    max: CITY_RANK_MAX,
    title: index.titles[rank - 1] ?? '',
    banner: banner.banner,
    bannerAlt: banner.alt,
    standing,
    fee: cityFeeOf(world, city.id, city.festival === true),
    // The city holds its festival this week: a lower fee (city-festival.mjs).
    festival: city.festival === true,
    perks: ranks.charters.slice(0, rank - 1).map(charterView),
    // What the last rank's stall may sell, by name.
    legendary: ranks.legendary.map((id) => ({ id, name: legendaryNames(id) })),
    next: price
      ? {
          rank: price.rank,
          title: index.titles[price.rank - 1] ?? '',
          standing: price.standing,
          coins: price.coins,
          materials: price.materials,
          charter: charterView(ranks.charters[price.rank - 2]),
          feeCut: CITY_RANK_FEE_CUT,
          ...stallGains(price.rank),
          block: charterBlock(world, city, index)
        }
      : null
  }
}
