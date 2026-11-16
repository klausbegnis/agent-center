// The wording of the Market tab, apart from labels.js, which is past the size a module should
// have. Computes nothing beyond putting numbers already worked out into sentences.
import { formatAmount } from './game-format.js'
import { materialLabel, slotText } from './labels.js'

export const MARKET = {
  world: 'World',
  coins: 'Coins',
  coinsNote: 'Coins come from selling materials in a city, and buy gear at its stall.',
  cities: 'Cities',
  citiesNote: 'Each city sells what it produces cheap and pays well for what it wants. Every trade ' +
    'costs a fee, and a big sale lowers the price there until it recovers.',
  visit: (name) => `Visit ${name}`,
  back: 'All cities',
  locked: (level) => `Opens at World Lv ${level}`,
  sellsCheap: 'Sells cheap:',
  paysWell: 'Pays well for:',
  noWorld: 'No room plays in a world yet: the market opens with the first room that joins.',
  sell: 'Sell',
  sellNote: 'The price falls as you sell: the total already counts it.',
  nothingToSell: 'Nothing to sell yet: materials come from kills and gathering.',
  trade: 'Trade',
  tradeNote: (city) => `Turn one material into another that ${city} produces, in one step: a sale and a ` +
    'purchase, each with the fee.',
  from: 'Give',
  to: 'For',
  amount: 'Amount',
  max: 'Max',
  less: 'One less',
  more: 'One more',
  stall: 'Stall',
  stallNote: 'Gear one tier above what monsters drop now. New pieces every day.',
  goesTo: 'Goes to',
  buy: 'Buy',
  wanted: 'wanted',
  plenty: 'plenty here',
  viewOnly: 'Watching only: trades are made on the computer that runs Orca.'
}

/** A material's name with "×1,204 held". */
export const heldText = (amount) => `${formatAmount(amount)} held`

/** "5.4 each", and the mark of a price above or below the city's usual. */
export function priceEach(price, trend) {
  const mark = { up: ' ▲', down: ' ▼', usual: '' }[trend]
  return `${formatPrice(price)} each${mark}`
}

/** What a price mark means, for screen readers and on hover. */
export const TREND_NOTE = {
  up: 'above its usual price here, after purchases',
  down: 'below its usual price here, after sales',
  usual: 'at its usual price here'
}

/** A unit price: two decimals below 10 coins, whole above, and "under 0.01" for a dumped one. */
export function formatPrice(price) {
  if (price < 0.01) return 'under 0.01'
  return price < 10 ? price.toFixed(2).replace(/\.?0+$/, '') : formatAmount(price)
}

/** A world's coins to the coin while they fit a line, "12 M" past ten million. */
export function formatCoins(coins) {
  return coins < 1e7 ? Math.floor(coins).toLocaleString('en-US') : formatAmount(coins)
}

/** "1,234 coins". */
export const coinsText = (coins) => `${formatAmount(coins)} coin${coins === 1 ? '' : 's'}`

/** The Sell button: "Sell for 1,234 coins", or just "Sell" while there is nothing to get. */
export const sellButton = (coins) => (coins >= 1 ? `Sell for ${coinsText(coins)}` : MARKET.sell)

/** A Sell row's control, named for screen readers: "Amount of Ore to sell". */
export const sellAmountLabel = (materialId) => `Amount of ${materialLabel(materialId)} to sell`

/** What a trade gives: "→ 151 Ore, 3 coins back", or why it gives nothing. */
export function tradeResult({ units, change }, toId) {
  if (units < 1) return 'Too little to get one unit.'
  const back = change >= 1 ? `, ${coinsText(change)} back` : ''
  return `→ ${formatAmount(units)} ${materialLabel(toId)}${back}`
}

/** A comma list of material names: "Crops, Fish". */
export const materialList = (ids) => ids.map(materialLabel).join(', ')

/** "Tier 3 · Weapon, magical · gear level 4". */
export const offerFacts = (offer) => `Tier ${offer.tier} · ${slotText(offer)} · gear level ${offer.power}`

/** Why Buy is off for a stall piece. */
export function offerBlockText(block, { price, coins }) {
  if (block === 'sold') return 'Sold today.'
  if (block === 'noRoom') return 'No room of this world to take it.'
  if (block === 'full') return 'That room\'s chest already keeps four of these.'
  if (block === 'coins') return `Needs ${coinsText(price - coins)} more.`
  return ''
}

/** The Buy button's name for screen readers: "Buy Runed Grimoire for 9,120 coins". */
export const buyLabel = (offer) => `Buy ${offer.name} for ${coinsText(offer.price)}`
