// An amount chosen with a range slider, a number box beside it and Max, kept in step both ways.
// The slider runs from 0 to what is held (see market-model.js for how a large stock is spread
// over its positions); the box keeps every unit. It draws and reports; the caller keeps the amount.
import { button, el } from './dom.js'
import { MARKET } from './market-labels.js'
import { amountAtPosition, amountFrom, pagedPosition, positionOfAmount, sliderMax } from './market-model.js'

/**
 * @param {{ key: string, label: string, valueText: (amount: number) => string, amount: number,
 *   most: number, onChange: (amount: number) => void }} options `key` prefixes every control's
 *   data-key, so a redraw puts the keyboard back on the one that had it
 * @returns {{ element: HTMLElement, set: (amount: number) => void }}
 */
export function amountControl({ key, label, valueText, amount, most, onChange }) {
  const element = el('div', 'ac-market-amounts')
  const slider = el('input', 'ac-market-slider')
  slider.type = 'range'
  slider.min = '0'
  slider.max = String(sliderMax(most))
  slider.step = '1'
  slider.dataset.key = `${key}:slider`
  slider.setAttribute('aria-label', label)
  const box = el('input', 'ac-game-input ac-market-amount')
  box.type = 'number'
  box.min = '0'
  box.max = String(Math.floor(most))
  box.step = '1'
  box.inputMode = 'numeric'
  box.dataset.key = `${key}:amount`
  box.setAttribute('aria-label', label)
  const max = button(MARKET.max, 'ac-button ac-market-max', { onClick: () => change(Math.floor(most)) })
  max.dataset.key = `${key}:max`
  max.setAttribute('aria-label', `${MARKET.max}: ${valueText(Math.floor(most))}`)
  slider.disabled = box.disabled = max.disabled = !(most >= 1)

  /** Shows an amount on both controls; the one being typed in keeps what was typed. */
  function show(next, { keepBox = false } = {}) {
    slider.value = String(positionOfAmount(next, most))
    slider.setAttribute('aria-valuetext', valueText(next))
    if (!keepBox) box.value = next >= 1 ? String(next) : ''
  }
  function change(next, options) {
    show(next, options)
    onChange(next)
  }

  slider.addEventListener('input', () => change(amountAtPosition(slider.value, most)))
  // Page Up and Page Down take bigger steps than the browser's own, the same in every browser.
  slider.addEventListener('keydown', (event) => {
    const direction = { PageUp: 1, PageDown: -1 }[event.key]
    if (!direction) return
    event.preventDefault()
    change(amountAtPosition(pagedPosition(Number(slider.value), most, direction), most))
  })
  box.addEventListener('input', () => change(amountFrom(box.value, most), { keepBox: true }))
  // A box left with more than is held, or with something that is not a number, shows what counts.
  box.addEventListener('change', () => show(amountFrom(box.value, most)))
  show(amount)
  element.append(slider, box, max)
  return { element, set: (next) => change(next) }
}
