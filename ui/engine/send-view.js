// The control that sends something to another room: a word, one or two pickers and a Send button,
// always shown. When it cannot be used it is disabled and says why under it; when sending takes an
// item from a character it asks once first. Every control carries a data-key, so a redraw keeps
// the focus where it was.
import { button, el, select } from './dom.js'
import { confirmButton } from './game-controls.js'
import { SEND } from './send-labels.js'

/**
 * @typedef {object} Picker
 * @property {string} label its accessible name
 * @property {string} key
 * @property {{ value: string, label: string, disabled?: boolean }[]} options
 * @property {string | null} [value] the option picked before a redraw, kept when still usable
 * @property {string} [emptyLabel] what the picker reads when it offers nothing
 */

/** A picker whose options can be disabled one by one; the one picked before, or the first usable. */
function picker({ label, key, options, value = null, emptyLabel = '' }) {
  const node = select('ac-select ac-game-send-picker', label)
  node.title = label
  node.dataset.key = key
  // An empty list would read as a blank box: it names what is missing instead.
  if (options.length === 0) node.append(el('option', '', emptyLabel))
  for (const { value: optionValue, label: text, disabled } of options) {
    const option = el('option', '', text)
    option.value = optionValue
    option.disabled = Boolean(disabled)
    node.append(option)
  }
  const usable = options.find((option) => !option.disabled && option.value === value) ??
    options.find((option) => !option.disabled)
  node.value = usable ? usable.value : ''
  return node
}

/**
 * @param {{
 *   key: string,
 *   prefix: string,
 *   pickers: Picker[],
 *   buttonLabel: string,
 *   ariaLabel: string,
 *   reason?: string | null,
 *   ask?: { question: (values: string[]) => string, isOpen: boolean,
 *     onOpenChange: (isOpen: boolean) => void },
 *   onSend: (values: string[]) => Promise<unknown>,
 *   onPick?: (values: string[]) => void
 * }} options `onPick` hears every change of a picker, so the caller can keep it across redraws;
 *   `reason` disables the control and is said under it; `ask` asks the question before
 *   sending (the caller keeps whether it is open, so a redraw does not close it)
 * @returns {HTMLElement}
 */
export function sendControl({ key, prefix, pickers, buttonLabel, ariaLabel, reason = null, ask, onSend, onPick }) {
  const element = el('div', 'ac-game-send')
  const row = el('div', 'ac-game-row')
  const word = el('span', 'ac-game-field-label', prefix)
  word.setAttribute('aria-hidden', 'true')
  const selects = pickers.map(picker)
  const values = () => selects.map((node) => node.value)
  for (const node of selects) node.addEventListener('change', () => onPick?.(values()))
  row.append(word, ...selects)
  element.append(row)
  const isDisabled = Boolean(reason) || selects.some((node) => !node.value)
  for (const node of selects) node.disabled = isDisabled
  let isBusy = false
  const run = async () => {
    if (isBusy) return
    isBusy = true
    try {
      await onSend(values())
    } finally {
      isBusy = false
    }
  }
  if (ask && !isDisabled) {
    const confirm = confirmButton({
      label: SEND.sendHeld,
      ariaLabel,
      question: ask.question(values()),
      confirm: SEND.confirm,
      confirmClassName: 'ac-primary',
      key: `${key}:send`,
      isOpen: ask.isOpen,
      onOpenChange: ask.onOpenChange,
      onConfirm: run
    })
    const question = confirm.querySelector('.ac-game-confirm-box p')
    for (const node of selects) {
      node.addEventListener('change', () => {
        question.textContent = ask.question(values())
      })
    }
    element.append(confirm)
  } else {
    const send = button(buttonLabel, 'ac-button', { onClick: run })
    send.dataset.key = `${key}:send`
    send.setAttribute('aria-label', ariaLabel)
    send.title = ariaLabel
    send.disabled = isDisabled
    row.append(send)
  }
  if (reason) element.append(el('p', 'ac-game-card-line ac-muted ac-game-send-reason', reason))
  return element
}
