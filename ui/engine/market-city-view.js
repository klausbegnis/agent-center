// The open city of the Market tab: its Sell list and its Stall (the Trade card is in
// market-trade-view.js). A Sell row is one slim line (material, how much is held, the price
// here and its tags); "Sell…" opens its amount slider and the button that says the deal, one
// row at a time. What was chosen is kept by the caller across redraws, and every control carries
// a data-key so a redraw puts the keyboard back where it was.
import { button, el, select, setOptions } from './dom.js'
import { section } from './game-controls.js'
import { gameIcon, iconLabel } from './icon-view.js'
import { itemSlot } from './item-slot-view.js'
import { materialLabel } from './labels.js'
import { amountControl } from './market-amount.js'
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
  ofHeld,
  priceEach,
  sellAmountLabel,
  sellButton,
  sellOpenLabel
} from './market-labels.js'
import {
  cityStance,
  clampAmount,
  gatheringTradeOf,
  heldMaterials,
  offerBlock,
  pricePoint,
  priceTrend,
  sellQuote,
  unitSellPrice
} from './market-model.js'

/** The marks after a price: the "wanted" or "plenty here" tag, and what the trend sign means. */
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

/** The open row's slider, number box, Max, and the Sell button that names the deal. */
function sellEditor({ world, city, materialId, point, held, chosen, open, actions }) {
  const key = `sell:${city.id}:${materialId}`
  const editor = el('div', 'ac-market-editor')
  editor.id = `ac-market-sell-${materialId}`
  const readout = el('p', 'ac-market-of')
  const sell = button(MARKET.sell, 'ac-button ac-primary ac-market-go', {
    onClick: () => {
      const amount = clampAmount(chosen.get(key), held)
      if (amount < 1) return
      actions.sellMaterial(world.id, city.id, materialId, amount).then((isDone) => {
        if (!isDone) return
        chosen.set(key, 0)
        open.onDone(key)
      })
    }
  })
  sell.dataset.key = `${key}:go`
  const show = (amount) => {
    chosen.set(key, amount)
    const coins = sellQuote(point, amount).coins
    sell.textContent = sellButton(amount, coins)
    sell.disabled = !(amount >= 1 && coins >= 1)
    readout.textContent = ofHeld(amount, held, materialId)
  }
  const amount = clampAmount(chosen.get(key), held)
  const control = amountControl({ key, label: sellAmountLabel(materialId), amount, most: held,
    valueText: (value) => ofHeld(value, held, materialId), onChange: show })
  show(amount)
  const actionsRow = el('div', 'ac-market-row-controls')
  actionsRow.append(readout, sell)
  editor.append(control.element, actionsRow)
  return editor
}

function sellRow({ world, city, materialId, chosen, open, actions }) {
  const point = pricePoint(world.market, city, materialId)
  const held = world.materials[materialId]
  const trend = priceTrend(point.pressure)
  const isOpen = open.rowId === materialId
  const row = el('article', `ac-market-row${isOpen ? ' ac-market-row-open' : ''}`)
  const head = el('div', 'ac-market-row-head')
  const price = el('span', `ac-market-price ac-market-trend-${trend}`, priceEach(unitSellPrice(point), trend))
  price.title = TREND_NOTE[trend]
  head.append(iconLabel(materialId, materialLabel(materialId), 'ac-market-name'))
  const trade = gatheringTradeOf(materialId)
  if (trade) head.append(tradeMark(trade))
  const heldNode = el('span', 'ac-market-held ac-game-amount', heldText(held))
  head.append(heldNode, price, priceMarks(city, materialId, trend))
  if (actions.sellMaterial) {
    const toggle = button(isOpen ? MARKET.sellClose : MARKET.sellOpen, 'ac-button ac-market-toggle', {
      onClick: () => open.toggle(materialId)
    })
    toggle.dataset.key = `sell-open:${city.id}:${materialId}`
    toggle.setAttribute('aria-expanded', String(isOpen))
    toggle.setAttribute('aria-controls', `ac-market-sell-${materialId}`)
    const name = sellOpenLabel(materialId)
    toggle.setAttribute('aria-label', isOpen ? `${MARKET.sellClose}: ${name}` : name)
    head.append(toggle)
  }
  row.append(head)
  if (isOpen && actions.sellMaterial) {
    row.append(sellEditor({ world, city, materialId, point, held, chosen, open, actions }))
  }
  return row
}

/**
 * The Sell card: a slim row per material the world holds, one of them open.
 *
 * @param {{ world: object, city: object, chosen: Map<string, number>,
 *   open: { rowId: string | null, toggle: (materialId: string) => void, onDone: (key: string) => void },
 *   actions: object }} options `chosen` holds the amount picked on each row, by its key; `onDone`
 *   redraws after a sale and gives the keyboard to the row's slider
 */
export function sellCard({ world, city, chosen, open, actions }) {
  const held = heldMaterials(world.materials)
  const rows = el('div', 'ac-game-list')
  rows.append(...held.map((materialId) => sellRow({ world, city, materialId, chosen, open, actions })))
  const lines = [el('p', 'ac-game-card-line', held.length ? MARKET.sellNote : MARKET.nothingToSell), rows]
  return section(MARKET.sell, lines, 'ac-market-sell')
}

/** A control with its visible label. */
export function labelled(label, control) {
  const field = el('label', 'ac-game-field ac-market-field')
  field.append(el('span', 'ac-game-field-label', label), control)
  return field
}

function offerRow({ world, city, offer, roomId, actions }) {
  const row = el('article', 'ac-market-row ac-market-offer')
  const head = el('div', 'ac-market-offer-head')
  const facts = el('div', 'ac-market-offer-facts')
  facts.append(el('strong', 'ac-market-offer-name', offer.name),
    el('span', 'ac-game-card-line', offerFacts(offer)))
  const label = `${offer.name}: ${offerFacts(offer)}`
  const item = { id: offer.entryId, name: offer.name, tier: offer.tier, level: 0 }
  head.append(itemSlot({ item, slot: offer.slot,
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
