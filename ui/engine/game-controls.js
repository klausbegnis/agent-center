// Small pieces the game's panels are built from: cards, meters, switches and confirmations.
// They draw what they are given and work nothing out.
import { button, el } from './dom.js'

/**
 * A card with a heading and paragraphs.
 *
 * @param {string} title
 * @param {string[]} lines
 */
export function card(title, lines = []) {
  const node = el('section', 'ac-game-card')
  node.append(el('h2', 'ac-game-card-title', title), ...lines.map((line) => el('p', 'ac-game-card-line', line)))
  return node
}

/**
 * A bar with its value written beside it, so the value never rests on colour or length alone.
 *
 * @param {string} className
 * @param {string} name what the bar measures, for screen readers: "Health"
 */
export function meter(className, name) {
  const element = el('span', `ac-game-meter ${className}`)
  const track = el('span', 'ac-game-meter-track')
  const fill = el('span', 'ac-game-meter-fill')
  const text = el('span', 'ac-game-meter-text')
  track.setAttribute('aria-hidden', 'true')
  track.append(fill)
  element.append(track, text)
  return {
    element,
    /**
     * @param {number} share between 0 and 1
     * @param {string} label the value as written: "12%"
     */
    set(share, label) {
      fill.style.width = `${share * 100}%`
      text.textContent = label
      element.setAttribute('aria-label', `${name} ${label}`)
    }
  }
}

/**
 * A card with a heading and any content under it.
 *
 * @param {string} title
 * @param {Node[]} children
 * @param {string} [className]
 */
export function section(title, children, className = '') {
  const node = el('section', `ac-game-card ${className}`.trim())
  node.append(el('h2', 'ac-game-card-title', title), ...children)
  return node
}

/**
 * An on/off switch: a checkbox with the switch role and a visible label.
 *
 * @param {{ label: string, hint?: string, onChange: (on: boolean) => void }} options
 */
export function switchControl({ label, hint, onChange }) {
  const element = el('label', 'ac-game-switch')
  const input = el('input', 'ac-game-switch-input')
  input.type = 'checkbox'
  input.setAttribute('role', 'switch')
  input.addEventListener('change', () => onChange(input.checked))
  const text = el('span', 'ac-game-switch-text')
  text.append(el('span', 'ac-game-switch-label', label))
  if (hint) text.append(el('span', 'ac-game-switch-hint', hint))
  element.append(input, text)
  return {
    element,
    set(on) {
      input.checked = on
    }
  }
}

/**
 * A button that asks before it acts: the first press shows what will happen with a confirming
 * and a cancelling button; only the confirming one acts. Whether it is open is kept by the
 * caller, so a redraw does not close a question someone is reading.
 *
 * @param {{ label: string, ariaLabel?: string, question: string, confirm: string,
 *   className?: string, key: string, isOpen?: boolean, onOpenChange?: (isOpen: boolean) => void,
 *   onConfirm: () => void }} options `key` names the opening button for replaceKeepingFocus
 */
export function confirmButton(options) {
  const { label, ariaLabel, question, confirm, className = '', key, isOpen = false, onOpenChange, onConfirm } = options
  const element = el('div', 'ac-game-confirm')
  const open = button(label, `ac-button ${className}`.trim(), { onClick: () => show(true, true) })
  open.dataset.key = key
  if (ariaLabel) open.setAttribute('aria-label', ariaLabel)
  open.setAttribute('aria-expanded', 'false')
  const box = el('div', 'ac-game-confirm-box')
  box.setAttribute('role', 'group')
  box.setAttribute('aria-label', label)
  const yes = button(confirm, 'ac-button ac-game-danger', {
    onClick: () => {
      show(false, true)
      onConfirm()
    }
  })
  yes.dataset.key = `${key}:yes`
  const no = button('Cancel', 'ac-button', { onClick: () => show(false, true) })
  no.dataset.key = `${key}:no`
  const actions = el('div', 'ac-game-row')
  actions.append(yes, no)
  box.append(el('p', 'ac-game-card-line', question), actions)
  element.append(open, box)

  function show(opened, byPerson) {
    box.hidden = !opened
    open.hidden = opened
    open.setAttribute('aria-expanded', String(opened))
    if (!byPerson) return
    onOpenChange?.(opened)
    ;(opened ? no : open).focus()
  }
  show(isOpen, false)
  return element
}

/**
 * Replaces a container's content and puts the focus back on the control that had it, found by
 * its `data-key`, so a redraw while someone is using the keyboard does not lose their place.
 *
 * @param {HTMLElement} container
 * @param {Node[]} children
 */
export function replaceKeepingFocus(container, children) {
  const active = container.ownerDocument.activeElement
  const key = active && container.contains(active) ? active.dataset.key : null
  container.replaceChildren(...children)
  if (key) container.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus()
}
