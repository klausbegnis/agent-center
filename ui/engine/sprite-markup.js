// What a theme's sprite sheet may contain. The sheet is the one piece of markup the engine parses,
// so only plain drawing is let through: shapes, gradients, symbols and references inside the
// sheet. The page strips everything else, and `npm run check` refuses a theme that has any of it.

/** Elements a sprite sheet may use. Compared in lower case, so `radialGradient` matches. */
export const ALLOWED_ELEMENTS = new Set([
  'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc',
  'rect', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'text', 'tspan',
  'lineargradient', 'radialgradient', 'stop', 'pattern', 'clippath', 'mask'
])

/** Attributes a sprite sheet may use: geometry, paint and references. No `style`, no handlers. */
export const ALLOWED_ATTRIBUTES = new Set([
  'id', 'xmlns', 'xmlns:xlink', 'viewbox', 'preserveaspectratio', 'overflow', 'transform',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'width', 'height',
  'd', 'points', 'pathlength',
  'fill', 'fill-opacity', 'fill-rule', 'opacity', 'stroke', 'stroke-width', 'stroke-opacity',
  'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit',
  'shape-rendering', 'vector-effect', 'paint-order', 'visibility', 'display', 'color',
  'clip-path', 'clip-rule', 'mask',
  'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'spreadmethod',
  'patternunits', 'patterncontentunits', 'patterntransform', 'clippathunits', 'maskunits',
  'maskcontentunits',
  'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline',
  'letter-spacing', 'dx', 'dy',
  'href', 'xlink:href'
])

/** `url(…)` that points anywhere but at an id inside the same sheet. */
const OUTSIDE_URL = /url\(\s*(?!['"]?#)/i

/** @param {string} name an element's tag name */
export function isAllowedElement(name) {
  return ALLOWED_ELEMENTS.has(name.toLowerCase())
}

/**
 * Whether an attribute is plain drawing. A link may only point inside the sheet (`#id`), and a
 * paint value may only reference an id in it, so nothing outside the sheet is ever loaded.
 *
 * @param {string} name
 * @param {string} value
 */
export function isAllowedAttribute(name, value) {
  const lowerName = name.toLowerCase()
  if (!ALLOWED_ATTRIBUTES.has(lowerName)) return false
  if (lowerName === 'href' || lowerName === 'xlink:href') return value.trim().startsWith('#')
  return !OUTSIDE_URL.test(value)
}

const COMMENT = /<!--[\s\S]*?-->/g
const TAG = /<([a-zA-Z][\w:.-]*)([^>]*)>/g
const ATTRIBUTE = /([^\s=/]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g

/**
 * Everything in a sprite sheet that the page would strip, for `npm run check`. Reads the source
 * text, so it also catches what a browser would drop silently.
 *
 * @param {string} svgText
 * @returns {string[]} one line per problem, empty when the sheet is plain drawing
 */
export function findMarkupProblems(svgText) {
  const problems = []
  const markup = svgText.replace(COMMENT, '')
  if (/<!\[CDATA\[|<!ENTITY/i.test(markup)) problems.push('uses CDATA or an entity declaration')
  for (const [, name, attributes] of markup.matchAll(TAG)) {
    if (!isAllowedElement(name)) problems.push(`uses the element <${name}>`)
    for (const [, attribute, quoted] of attributes.matchAll(ATTRIBUTE)) {
      const value = quoted.replace(/^["']|["']$/g, '')
      if (!isAllowedAttribute(attribute, value)) problems.push(`<${name}> has ${attribute}="${value}"`)
    }
  }
  return problems
}
