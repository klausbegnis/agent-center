// The wording of a city's rank on the Market tab. Puts numbers already worked out into sentences.
import { formatAmount, formatShare } from './game-format.js'

export const NUMERALS = Object.freeze(['I', 'II', 'III', 'IV', 'V'])

/** "II", or the number itself past the numerals. */
export const numeral = (rank) => NUMERALS[rank - 1] ?? String(rank)

export const CITY_RANK = {
  rank: (rank, title) => `Rank ${numeral(rank)} · ${title}`,
  badge: (rank) => `Rank ${numeral(rank)}`,
  note: 'Every trade here, and every piece bought at the stall, earns standing with the city. With ' +
    'enough standing, buy its charter to raise its rank: a lower fee, a richer stall and a perk for ' +
    'every party of the world.',
  standing: 'Standing',
  standingText: (standing, needed, rank) =>
    `${formatAmount(standing)} of ${formatAmount(needed)} to rank ${numeral(rank)}`,
  standingReady: (needed, rank) => `${formatAmount(needed)} reached: ready for rank ${numeral(rank)}`,
  standingTop: (standing) => `${formatAmount(standing)}: the city's last rank`,
  fee: (fee) => `Fee here: ${formatShare(fee)}`,
  perks: 'Charters held',
  perk: (name, text) => `${name}: ${text}`,
  next: (rank, title) => `Next: rank ${numeral(rank)} · ${title}`,
  feeCut: (cut) => `The fee here falls by ${formatShare(cut).replace('%', '')} points`,
  extraOffer: 'The stall offers one more piece of gear a day',
  tierBonus: 'The stall sells gear one tier higher',
  relicMoreOften: 'The stall offers its relics more often',
  legendary: (names) => `Now and then the stall sells legendary equipment: ${names}`,
  charter: 'Charter',
  buy: (name) => `Buy the ${name}`,
  buyAria: (name, city, rank) => `Buy the ${name}: ${city} rises to rank ${numeral(rank)}`,
  top: 'This city has reached its last rank.',
  coins: 'coins',
  blocks: {
    standing: (short) => `Trade ${formatAmount(short)} more standing here first`,
    coins: (short) => `${formatAmount(short)} coins short`,
    materials: 'Not enough of the materials',
    viewOnly: ''
  }
}

/** A legendary piece on a city's stall, drawn as a relic on offer is (stall-relic-view.js). */
export const STALL_LEGENDARY = {
  kicker: 'Legendary',
  ownsAll: 'A legendary piece of this city is on offer, but the room it would go to owns them all.',
  soldToday: 'Today\'s legendary piece is sold. Another comes now and then.',
  buyLabel: (name, price) => `Buy the legendary ${name} for ${price}`
}
