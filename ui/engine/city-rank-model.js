// What a city's rank card shows, worked out from the view state without touching the DOM: the
// heading, the standing towards the next rank, the perks held, what the next rank gives and why
// its charter cannot be bought yet.
import { CITY_RANK } from './city-rank-labels.js'
import { effectText } from './legendary-labels.js'

/** What the next rank adds, in words, its charter's perk first. */
function nextGains(next, legendary) {
  const gains = [CITY_RANK.perk(next.charter.perk, effectText(next.charter.effect)), CITY_RANK.feeCut(next.feeCut)]
  if (next.extraOffer) gains.push(CITY_RANK.extraOffer)
  if (next.tierBonus) gains.push(CITY_RANK.tierBonus)
  if (next.relicMoreOften) gains.push(CITY_RANK.relicMoreOften)
  if (next.legendary && legendary.length) gains.push(CITY_RANK.legendary(legendary.map((entry) => entry.name).join(', ')))
  return gains
}

/** Why the charter cannot be bought now, in words, or ''. */
function blockText(next, world) {
  if (next.block === 'standing') return CITY_RANK.blocks.standing(Math.ceil(next.standing - next.rankStanding))
  if (next.block === 'coins') return CITY_RANK.blocks.coins(next.coins - (world.coins ?? 0))
  if (next.block === 'materials') return CITY_RANK.blocks.materials
  return ''
}

/**
 * @param {object} city an open city of the view state's market, with its `rank`
 * @param {{ coins?: number }} world
 * @returns {object | null} null when the city has no ranks
 */
export function cityRankModel(city, world) {
  const rank = city.rank
  if (!rank) return null
  const model = {
    rank: rank.rank,
    heading: CITY_RANK.rank(rank.rank, rank.title),
    feeText: CITY_RANK.fee(rank.fee),
    perks: rank.perks.map((perk) => ({ name: perk.name, text: CITY_RANK.perk(perk.perk, effectText(perk.effect)) })),
    progress: null,
    next: null
  }
  if (!rank.next) {
    const names = rank.legendary.map((entry) => entry.name).join(', ')
    return {
      ...model,
      progress: { share: 1, text: CITY_RANK.standingTop(rank.standing) },
      topText: names ? CITY_RANK.legendary(names) : ''
    }
  }
  const next = { ...rank.next, rankStanding: rank.standing }
  return {
    ...model,
    progress: {
      share: next.standing > 0 ? Math.min(1, rank.standing / next.standing) : 1,
      text: rank.standing >= next.standing
        ? CITY_RANK.standingReady(next.standing, next.rank)
        : CITY_RANK.standingText(rank.standing, next.standing, next.rank)
    },
    next: {
      rank: next.rank,
      heading: CITY_RANK.next(next.rank, next.title),
      gains: nextGains(next, rank.legendary),
      charter: next.charter.name,
      coins: next.coins,
      materials: next.materials,
      block: next.block,
      blockText: blockText(next, world)
    }
  }
}
