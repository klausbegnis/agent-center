// The Trade card of an open city, laid out as the sentence it is: "You give" (a material held,
// and how much of it on a slider) → "You get" (a material the city produces, and what that
// amount brings, worked out here as the worker will). The button says the whole deal.
import { button, el, select, setOptions } from './dom.js'
import { section } from './game-controls.js'
import { gameIcon } from './icon-view.js'
import { materialLabel } from './labels.js'
import { amountControl } from './market-amount.js'
import {
  MARKET,
  coinsBack,
  giveAmountLabel,
  materialChoice,
  ofHeld,
  rateText,
  tradeButton,
  tradeWhy,
  unitsText
} from './market-labels.js'
import { clampAmount, heldMaterials, tradeOutcome } from './market-model.js'

/** A material picker: the chosen material's icon beside a select. */
function materialPicker({ key, label, options, value, onPick }) {
  const node = el('div', 'ac-market-picker')
  const picker = select('ac-select', label, options)
  picker.value = value
  picker.dataset.key = key
  picker.addEventListener('change', () => onPick(picker.value))
  node.append(gameIcon(value, 'ac-market-picker-icon'), picker)
  return node
}

/** One side of the deal, under its heading. */
function side(className, title, children) {
  const node = el('div', `ac-market-side ${className}`)
  node.append(el('h3', 'ac-market-side-title', title), ...children)
  return node
}

/**
 * @param {{ world: object, city: object, form: { fromId: string | null, toId: string | null,
 *   amount: number, onChoose: (choice: { fromId: string, toId: string }) => void,
 *   onDone: (key: string) => void },
 *   actions: object }} options `form` is kept by the caller across redraws
 */
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
  form.fromId = fromId
  form.toId = toId
  const most = world.materials[fromId]

  const from = materialPicker({ key: 'trade:from', label: MARKET.giveMaterial, value: fromId,
    options: held.map((id) => [id, materialChoice(id, world.materials[id])]),
    onPick: (next) => form.onChoose({ fromId: next, toId }) })
  const ofText = el('p', 'ac-market-of')
  const gets = el('p', 'ac-market-gets')
  gets.setAttribute('aria-live', 'polite')
  const details = el('p', 'ac-market-details')
  const to = materialPicker({ key: 'trade:to', label: MARKET.getMaterial, value: toId,
    options: choices.map((id) => [id, materialLabel(id)]),
    onPick: (next) => form.onChoose({ fromId, toId: next }) })
  const go = button(MARKET.trade, 'ac-button ac-primary ac-market-deal-button', {
    onClick: () => {
      const amount = clampAmount(form.amount, most)
      if (amount < 1) return
      // A deal made starts the slider from nothing again, so a second click cannot repeat it.
      actions.tradeMaterial(world.id, city.id, fromId, toId, amount)
        .then((isDone) => isDone && form.onDone('trade'))
    }
  })
  go.dataset.key = 'trade:go'

  const show = (amount) => {
    form.amount = amount
    const outcome = tradeOutcome(world.market, city, { fromId, toId, amount })
    ofText.textContent = ofHeld(amount, most, fromId)
    gets.textContent = unitsText(outcome.units, toId)
    gets.classList.toggle('ac-market-gets-none', outcome.why !== null)
    const extras = outcome.why ? [tradeWhy(outcome.why, { amount, fromId, toId })]
      : [outcome.change >= 1 ? coinsBack(outcome.change) : '', rateText(outcome.rate, toId, fromId)]
    details.textContent = extras.filter(Boolean).join(' · ')
    go.textContent = tradeButton({ amount, fromId, units: outcome.units, toId })
    go.disabled = outcome.why !== null
  }
  const amount = clampAmount(form.amount, most)
  const control = amountControl({ key: 'trade', label: giveAmountLabel(fromId), amount, most,
    valueText: (value) => ofHeld(value, most, fromId), onChange: show })
  show(amount)

  const deal = el('div', 'ac-market-deal')
  const arrow = el('span', 'ac-market-arrow', '↓')
  arrow.setAttribute('aria-hidden', 'true')
  deal.append(
    side('ac-market-give', MARKET.youGive, [from, control.element, ofText]),
    arrow,
    side('ac-market-get', MARKET.youGet, [to, gets, details])
  )
  children.push(deal, go)
  return section(MARKET.trade, children, 'ac-market-trade')
}
