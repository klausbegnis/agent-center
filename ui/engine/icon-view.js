// Draws the game's pixel icons (game-icons.js). An icon is decoration next to its name, so it
// is hidden from screen readers; the name beside it says what it is.
import { el } from './dom.js'
import { iconPaths } from './game-icons.js'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/**
 * The icon with this id as an SVG element, or an empty span for an id with no icon, so a list
 * keeps its columns.
 *
 * @param {string} id
 * @param {string} [className]
 * @returns {Element}
 */
export function gameIcon(id, className = '') {
  const drawing = iconPaths(id)
  if (!drawing) return el('span', `ac-icon ac-icon-none ${className}`.trim())
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg')
  svg.setAttribute('class', `ac-icon ${className}`.trim())
  svg.setAttribute('viewBox', drawing.viewBox)
  svg.setAttribute('aria-hidden', 'true')
  for (const { color, d } of drawing.paths) {
    const path = document.createElementNS(SVG_NAMESPACE, 'path')
    path.setAttribute('fill', color)
    path.setAttribute('d', d)
    svg.append(path)
  }
  return svg
}

/**
 * An icon followed by its name, as one inline piece.
 *
 * @param {string} id
 * @param {string} text
 * @param {string} [className]
 */
export function iconLabel(id, text, className = '') {
  const node = el('span', `ac-icon-label ${className}`.trim())
  node.append(gameIcon(id), el('span', 'ac-icon-text', text))
  return node
}
