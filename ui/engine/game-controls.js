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
