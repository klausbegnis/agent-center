// The control that sends something to another room: one or two pickers and a Send button. Every
// control carries a data-key, so a redraw keeps the focus where it was.
import { button, el, select } from './dom.js'

/**
 * @param {{
 *   key: string,
 *   pickers: { label: string, options: [value: string, label: string][], key: string }[],
 *   prefix?: string,
 *   buttonLabel: string,
 *   ariaLabel: string,
 *   onSend: (values: string[]) => Promise<unknown>
 * }} options `prefix` is the visible word before the pickers, such as "Send to"
 * @returns {HTMLElement}
 */
export function sendControl({ key, pickers, prefix, buttonLabel, ariaLabel, onSend }) {
  const element = el('div', 'ac-game-row ac-game-send')
  if (prefix) {
    const word = el('span', 'ac-game-field-label', prefix)
    word.setAttribute('aria-hidden', 'true')
    element.append(word)
  }
  const selects = pickers.map((picker) => {
    const node = select('ac-select ac-game-send-picker', picker.label, picker.options)
    node.title = picker.label
    node.dataset.key = picker.key
    return node
  })
  let isBusy = false
  const send = button(buttonLabel, 'ac-button', {
    onClick: async () => {
      if (isBusy) return
      isBusy = true
      send.disabled = true
      try {
        await onSend(selects.map((node) => node.value))
      } finally {
        isBusy = false
        send.disabled = false
      }
    }
  })
  send.dataset.key = `${key}:send`
  send.setAttribute('aria-label', ariaLabel)
  send.title = ariaLabel
  element.append(...selects, send)
  return element
}
