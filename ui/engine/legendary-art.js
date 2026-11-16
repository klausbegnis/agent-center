// Legendary loot's pixel art as the surfaces draw it: an item's picture, with or without its glow,
// alone or in one of the two frames (a slot, the active relic). Drawn pixelated at whole multiples
// by the CSS in ui/legendary.css.
import { el } from './dom.js'
import { legendaryArtUrl } from './legendary-model.js'

/** The pictures are drawn at this size, and the frames at FRAME_SIZE around them. */
const ART_SIZE = 32
const FRAME_SIZE = 40

/**
 * An item's picture. Without `alt` it is decoration: what it shows is said next to it.
 *
 * @param {string} base the transport's base
 * @param {string} id the entry id
 * @param {{ glow?: boolean, alt?: string, className?: string }} [options]
 * @returns {HTMLImageElement}
 */
export function legendaryPicture(base, id, { glow = false, alt = '', className = '' } = {}) {
  const image = el('img', `ac-legendary-art ${className}`.trim())
  image.src = legendaryArtUrl(base, id, { glow })
  image.alt = alt
  image.width = ART_SIZE
  image.height = ART_SIZE
  image.decoding = 'async'
  image.draggable = false
  if (!alt) image.setAttribute('aria-hidden', 'true')
  return image
}

/**
 * An item's picture with its glow in a frame: `slot` for a relic slot or legendary equipment,
 * `active-relic` for the active relic.
 *
 * @param {string} base
 * @param {string} id
 * @param {{ frame: 'slot' | 'active-relic', alt?: string, className?: string }} options
 * @returns {HTMLElement}
 */
export function framedPicture(base, id, { frame, alt = '', className = '' }) {
  const node = el('span', `ac-legendary-framed ac-legendary-framed-${frame} ${className}`.trim())
  const backing = el('img', 'ac-legendary-frame')
  backing.src = legendaryArtUrl(base, `frame-${frame}`)
  backing.alt = ''
  backing.width = FRAME_SIZE
  backing.height = FRAME_SIZE
  backing.setAttribute('aria-hidden', 'true')
  node.append(backing, legendaryPicture(base, id, { glow: true, alt }))
  if (alt) node.setAttribute('role', 'img')
  if (alt) node.setAttribute('aria-label', alt)
  return node
}
