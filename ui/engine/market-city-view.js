// The open city of the Market tab: its Sell list (a row per material held, with an amount and the
// total it brings), its Trade form and its Stall. Built from the view state and the amounts the
// person typed, which the caller keeps across redraws; every control carries a data-key so a
// redraw puts the keyboard back where it was.
import { button, el, select, setOptions } from './dom.js'
import { section } from './game-controls.js'
import { formatAmount } from './game-format.js'
import { gameIcon, iconLabel } from './icon-view.js'
import { itemSlot } from './item-slot-view.js'
import { materialLabel } from './labels.js'
import {
  MARKET,
  TREND_NOTE,
  buyLabel,
  coinsText,
  gatheredBy,
  heldText,
  materialList,
  offerBlockText,
  offerFacts,
  priceEach,
  sellAmountLabel,
  sellButton,
  tradeResult
} from './market-labels.js'
import {
  amountFrom,
  cityStance,
  gatheringTradeOf,
  heldMaterials,
  offerBlock,
  pricePoint,
  priceTrend,
  sellQuote,
  tradeQuote,
  unitSellPrice
} from './market-model.js'

/**
 * An amount box with one less, one more and Max, which tells `onChange` the whole amount typed.
 *
 * @param {{ key: string, label: string, text: string, most: number, onChange: (text: string) => void }} options
 */
function amountStepper({ key, label, text, most, onChange }) {
  const node = el('div', 'ac-market-stepper')
  const input = el('input', 'ac-game-input ac-market-amount')
  input.type = 'number'
  input.min = '1'
  input.step = '1'
  input.inputMode = 'numeric'
  input.value = text
  input.dataset.key = `${key}:amount`
  input.setAttribute('aria-label', label)
  const set = (value) => {
    input.value = String(value)
    onChange(input.value)
  }
  input.addEventListener('input', () => onChange(input.value))
  const step = (by) => set(Math.min(most, Math.max(1, amountFrom(input.value, most) + by)))
  const less = button('−', 'ac-button ac-market-step', { onClick: () => step(-1) })
  less.setAttribute('aria-label', MARKET.less)
  less.dataset.key = `${key}:less`
  const more = button('+', 'ac-button ac-market-step', { onClick: () => step(1) })
  more.setAttribute('aria-label', MARKET.more)
  more.dataset.key = `${key}:more`
  const max = button(MARKET.max, 'ac-button', { onClick: () => set(Math.floor(most)) })
  max.dataset.key = `${key}:max`
  node.append(less, input, more, max)
  return node
}

/** The marks after a price: the trend sign and the "wanted" or "plenty here" tag. */
function priceMarks(city, materialId, trend) {
  const node = el('span', 'ac-market-marks')
  const stance = cityStance(city, materialId)
  if (stance === 'wanted') node.append(el('span', 'ac-market-tag ac-market-tag-wanted', MARKET.wanted))
  if (stance === 'produced') node.append(el('span', 'ac-market-tag', MARKET.plenty))
  if (trend !== 'usual') node.append(el('span', 'ac-visually-hidden', TREND_NOTE[trend]))
  return node
}

/** The icon of the trade that gathers a material, named for screen readers and on hover. */
function tradeMark(trade) {
  const node = el('span', 'ac-market-trade-mark')
  node.title = gatheredBy(trade)
  node.append(gameIcon(trade, 'ac-market-trade-icon'), el('span', 'ac-visually-hidden', gatheredBy(trade)))
  return node
}

function sellRow({ world, city, materialId, typed, actions }) {
  const market = world.market
  const point = pricePoint(market, city, materialId)
  const held = world.materials[materialId]
  const trend = priceTrend(point.pressure)
  const row = el('article', 'ac-market-row')
  const head = el('div', 'ac-market-row-head')
  const price = el('span', `ac-market-price ac-market-trend-${trend}`, priceEach(unitSellPrice(point), trend))
  price.title = TREND_NOTE[trend]
  head.append(iconLabel(materialId, materialLabel(materialId), 'ac-market-name'))
  const trade = gatheringTradeOf(materialId)
  if (trade) head.append(tradeMark(trade))
  head.append(el('span', 'ac-market-held ac-game-amount', heldText(held)), price, priceMarks(city, materialId, trend))
  row.append(head)
  if (!actions.sellMaterial) return row
  const key = `sell:${city.id}:${materialId}`
  const sell = button('', 'ac-button ac-primary ac-market-go', {
    onClick: () => {
      const amount = amountFrom(typed.get(key), held)
      if (amount >= 1) actions.sellMaterial(world.id, city.id, materialId, amount)
    }
  })
  sell.dataset.key = `${key}:go`
  const showTotal = (text) => {
    typed.set(key, text)
    const coins = sellQuote(point, amountFrom(text, held)).coins
    sell.textContent = sellButton(coins)
    sell.disabled = coins < 1
  }
  const controls = el('div', 'ac-market-row-controls')
  controls.append(amountStepper({ key, label: sellAmountLabel(materialId), text: typed.get(key) ?? '', most: held,
    onChange: showTotal }), sell)
  showTotal(typed.get(key) ?? '')
  row.append(controls)
  return row
}

/** The Sell card: a row per material the world holds. */
export function sellCard({ world, city, typed, actions }) {
  const held = heldMaterials(world.materials)
  const rows = el('div', 'ac-game-list')
  rows.append(...held.map((materialId) => sellRow({ world, city, materialId, typed, actions })))
  const lines = [el('p', 'ac-game-card-line', held.length ? MARKET.sellNote : MARKET.nothingToSell), rows]
  return section(MARKET.sell, lines, 'ac-market-sell')
}

function labelled(label, control) {
  const field = el('label', 'ac-game-field ac-market-field')
  field.append(el('span', 'ac-game-field-label', label), control)
  return field
}

/** The Trade card: give one material held, for one the city produces. */
export function tradeCard({ world, city, form, actions }) {
  const held = heldMaterials(world.materials)
  const children = [el('p', 'ac-game-card-line', MARKET.tradeNote(city.name))]
  if (!actions.tradeMaterial || held.length === 0) {
    if (held.length === 0) children.push(el('p', 'ac-game-card-line', MARKET.nothingToSell))
    return section(MARKET.trade, children, 'ac-market-trade')
  }
  const fromId = held.includes(form.fromId) ? form.fromId : held[0]
  const choices = city.produces.filter((id) => id !== fromId)
  const toId = choices.includes(form.toId) ? form.toId : choices[0]
  const from = select('ac-select', MARKET.from)
  from.removeAttribute('aria-label')
  setOptions(from, held.map((id) => [id, `${materialLabel(id)} (${formatAmount(world.materials[id])})`]))
  from.value = fromId
  from.dataset.key = 'trade:from'
  const to = select('ac-select', MARKET.to)
  to.removeAttribute('aria-label')
  setOptions(to, choices.map((id) => [id, materialLabel(id)]))
  to.value = toId
  to.dataset.key = 'trade:to'
  const result = el('p', 'ac-market-result')
  result.setAttribute('aria-live', 'polite')
  const go = button(MARKET.trade, 'ac-button ac-primary ac-market-go', {
    onClick: () => {
      const amount = amountFrom(form.amount, world.materials[fromId])
      if (amount >= 1) actions.tradeMaterial(world.id, city.id, fromId, toId, amount)
    }
  })
  go.dataset.key = 'trade:go'
  const showResult = (text) => {
    form.amount = text
    const quote = tradeQuote(world.market, city, { fromId, toId, amount: amountFrom(text, world.materials[fromId]) })
    result.textContent = amountFrom(text, world.materials[fromId]) >= 1 ? tradeResult(quote, toId) : ''
    go.disabled = quote.units < 1
  }
  from.addEventListener('change', () => form.onChoose({ fromId: from.value, toId }))
  to.addEventListener('change', () => form.onChoose({ fromId, toId: to.value }))
  const stepper = amountStepper({ key: 'trade', label: MARKET.amount, text: form.amount ?? '', most: world.materials[fromId],
    onChange: showResult })
  showResult(form.amount ?? '')
  const pair = el('div', 'ac-market-pair')
  pair.append(labelled(MARKET.from, from), labelled(MARKET.to, to))
  const controls = el('div', 'ac-market-row-controls')
  controls.append(stepper, go)
  children.push(pair, controls, result)
  return section(MARKET.trade, children, 'ac-market-trade')
}

function offerRow({ world, city, offer, roomId, actions }) {
  const row = el('article', 'ac-market-row ac-market-offer')
  const head = el('div', 'ac-market-offer-head')
  const facts = el('div', 'ac-market-offer-facts')
  facts.append(el('strong', 'ac-market-offer-name', offer.name), el('span', 'ac-game-card-line', offerFacts(offer)))
  const label = `${offer.name}: ${offerFacts(offer)}`
  head.append(itemSlot({ item: { id: offer.entryId, name: offer.name, tier: offer.tier, level: 0 }, slot: offer.slot,
    damageType: offer.damageType, label, isSmall: true }), facts)
  const price = el('span', 'ac-market-offer-price')
  price.append(gameIcon('coin', 'ac-market-coin'), el('span', 'ac-game-amount', coinsText(offer.price)))
  row.append(head)
  const block = offerBlock(offer, { coins: world.coins, roomId, canBuy: Boolean(actions.buyStallOffer) })
  const controls = el('div', 'ac-market-row-controls')
  controls.append(price)
  if (block !== 'viewOnly') {
    const buy = button(MARKET.buy, 'ac-button ac-primary ac-market-go', {
      onClick: () => actions.buyStallOffer(world.id, city.id, offer.index, offer.entryId, roomId)
    })
    buy.dataset.key = `buy:${city.id}:${offer.index}`
    buy.setAttribute('aria-label', buyLabel(offer))
    buy.disabled = block !== null
    controls.append(buy)
    const why = offerBlockText(block, { price: offer.price, coins: world.coins })
    if (why) {
      const note = el('span', 'ac-game-missing', why)
      note.id = `ac-market-why-${city.id}-${offer.index}`
      buy.setAttribute('aria-describedby', note.id)
      controls.append(note)
    }
  }
  row.append(controls)
  return row
}

/**
 * The Stall card: the day's pieces, and the room a bought one goes to.
 *
 * @param {{ world: object, city: object, rooms: [string, string][], roomId: string | null,
 *   onRoom: (roomId: string) => void, actions: object }} options `rooms` are the choices of room
 */
export function stallCard({ world, city, rooms, roomId, onRoom, actions }) {
  const children = [el('p', 'ac-game-card-line', MARKET.stallNote)]
  if (actions.buyStallOffer && rooms.length > 1) {
    const picker = select('ac-select', MARKET.goesTo)
    picker.removeAttribute('aria-label')
    setOptions(picker, rooms)
    picker.value = roomId ?? ''
    picker.dataset.key = 'stall:room'
    picker.addEventListener('change', () => onRoom(picker.value))
    children.push(labelled(MARKET.goesTo, picker))
  } else if (actions.buyStallOffer && rooms.length === 1) {
    children.push(el('p', 'ac-game-card-line', `${MARKET.goesTo}: ${rooms[0][1]}`))
  }
  const list = el('div', 'ac-game-list')
  list.append(...(city.stall ?? []).map((offer) => offerRow({ world, city, offer, roomId, actions })))
  children.push(list)
  return section(MARKET.stall, children, 'ac-market-stall')
}

/** "Sells cheap: Crops, Fish" and "Pays well for: Ore, Bars", as two lines. */
export function cityTrades(city) {
  const node = el('div', 'ac-market-trades')
  const line = (label, ids) => {
    const text = el('p', 'ac-game-card-line')
    text.append(el('span', 'ac-market-trades-label', label), ` ${materialList(ids)}`)
    return text
  }
  node.append(line(MARKET.sellsCheap, city.produces), line(MARKET.paysWell, city.wants))
  return node
}
