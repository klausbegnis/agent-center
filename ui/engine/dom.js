// Small DOM helpers. Everything the engine draws goes through textContent, never innerHTML,
// except a theme's own sprite sheet (see theme-library.js).

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 */
export function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/**
 * @param {string} label
 * @param {string} className
 * @param {{ title?: string, onClick: (event: Event) => void }} options
 */
export function button(label, className, { title, onClick }) {
  const node = el('button', className, label)
  node.type = 'button'
  if (title) node.title = title
  node.addEventListener('click', onClick)
  return node
}

/**
 * @param {string} className
 * @param {string} ariaLabel
 * @param {[value: string, label: string][]} options
 */
export function select(className, ariaLabel, options = []) {
  const node = el('select', className)
  node.setAttribute('aria-label', ariaLabel)
  setOptions(node, options)
  return node
}

/**
 * A square icon made of one path, drawn in the current text colour.
 *
 * @param {string} className
 * @param {number} size the side of the grid the path is drawn on
 * @param {string} pathData
 */
export function svgIcon(className, size, pathData) {
  const icon = document.createElementNS(SVG_NAMESPACE, 'svg')
  icon.setAttribute('class', className)
  icon.setAttribute('viewBox', `0 0 ${size} ${size}`)
  icon.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(SVG_NAMESPACE, 'path')
  path.setAttribute('d', pathData)
  icon.append(path)
  return icon
}

/**
 * One symbol of a theme's sprite sheet, drawn on a grid of its own.
 *
 * @param {string} className
 * @param {string} symbolId the id of a `<symbol>` in a loaded sprite sheet
 * @param {string} viewBox the grid the symbol is drawn on, as in "0 0 30 40"
 */
export function svgUse(className, symbolId, viewBox) {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg')
  svg.setAttribute('class', className)
  svg.setAttribute('viewBox', viewBox)
  svg.setAttribute('aria-hidden', 'true')
  const use = document.createElementNS(SVG_NAMESPACE, 'use')
  use.setAttribute('href', `#${symbolId}`)
  svg.append(use)
  return svg
}

/** Replaces a select's options only when they changed, so an open menu is not reset. */
export function setOptions(node, options) {
  const signature = JSON.stringify(options)
  if (node.dataset.options === signature) return
  node.dataset.options = signature
  node.replaceChildren(
    ...options.map(([value, label]) => {
      const option = el('option', '', label)
      option.value = value
      return option
    })
  )
}
