// The wording of the Market tab, apart from labels.js, which is past the size a module should
// have. Computes nothing beyond putting numbers already worked out into sentences.
import { formatAmount } from './game-format.js'
import { materialLabel, skillLabel, slotText } from './labels.js'

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
  youGive: 'You give',
  youGet: 'You get',
  giveMaterial: 'Material to give',
  getMaterial: 'Material to get',
  max: 'Max',
  sellOpen: 'Sell…',
  sellClose: 'Close',
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

/** "61,379 coins": to the coin, so a price and the coins held compare at a glance. */
export const coinsText = (coins) => `${formatCoins(coins)} coin${coins === 1 ? '' : 's'}`

/** An amount to the unit while it fits a line: what a button promises must be exact. */
const exact = (amount) => formatCoins(amount)

/** "1,204 Ore". */
export const unitsText = (amount, materialId) => `${exact(amount)} ${materialLabel(materialId)}`

/** The Sell button: "Sell 300 for 708 coins", or "Sell" while no amount is chosen. */
export const sellButton = (amount, coins) =>
  (amount >= 1 && coins >= 1 ? `Sell ${exact(amount)} for ${coinsText(coins)}` : MARKET.sell)

/** What the button that opens a Sell row's amount says to a screen reader. */
export const sellOpenLabel = (materialId) => `Choose how much ${materialLabel(materialId)} to sell`

/** A Sell row's amount controls, named for screen readers: "Amount of Ore to sell". */
export const sellAmountLabel = (materialId) => `Amount of ${materialLabel(materialId)} to sell`

/** The trade's amount controls: "Amount of Bars to give". */
export const giveAmountLabel = (materialId) => `Amount of ${materialLabel(materialId)} to give`

/** "555 of 1,204 Bars": how much of a stock is chosen. */
export const ofHeld = (amount, held, materialId) => `${exact(amount)} of ${unitsText(held, materialId)}`

/** A choice of a material to give: "Bars, 1,204 held". */
export const materialChoice = (materialId, held) => `${materialLabel(materialId)}, ${exact(held)} held`

/** "+4 coins back", what the purchase leaves of the sale. */
export const coinsBack = (coins) => `+${coinsText(coins)} back`

/** "1 Crops per 2.13 Bars": what a trade costs per unit received, fee and price moves included. */
export function rateText(rate, toId, fromId) {
  const number = (value) => (value < 100 ? value.toFixed(2).replace(/\.?0+$/, '') : formatAmount(value))
  // Said the way round that puts a 1 in front: "1.42 Ore per 1 Crops" rather than "per 0.7".
  if (rate < 1) return `${number(1 / rate)} ${materialLabel(toId)} per 1 ${materialLabel(fromId)}`
  return `1 ${materialLabel(toId)} per ${number(rate)} ${materialLabel(fromId)}`
}

/** Why a trade gives nothing yet. */
export function tradeWhy(why, { amount, fromId, toId }) {
  if (why === 'tooLittle') return `${unitsText(amount, fromId)} is not enough for one ${materialLabel(toId)}.`
  return `Choose how many ${materialLabel(fromId)} to give.`
}

/** The Trade button: "Trade 555 Bars for 260 Crops", or "Trade" while there is no deal. */
export const tradeButton = ({ amount, fromId, units, toId }) =>
  (amount >= 1 && units >= 1
    ? `Trade ${unitsText(amount, fromId)} for ${unitsText(units, toId)}`
    : MARKET.trade)

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

/** What a Sell row's trade icon means: "Gathered by Fishing". */
export const gatheredBy = (trade) => `Gathered by ${skillLabel(trade)}`
