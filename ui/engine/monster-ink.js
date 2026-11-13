// The inks a generated monster is drawn with and the colours they take from its palette. A part
// is drawn once in inks; the palette a monster carries turns the same drawing into many looks.
// Never touches the DOM.

/** The colours a monster's look carries, by role. */
export const PALETTE_ROLES = ['skin', 'cloth', 'metal', 'leather', 'accent', 'bone', 'hair', 'eye']

/**
 * What each ink of a finished drawing is painted with: a palette role and a tone. `fixed` inks
 * are the same on every monster: the outline, so it reads on every scenery, the dark of mouths
 * and holes, flame (`f F`) and moss (`v V`).
 */
export const INKS = {
  o: { fixed: '#0b0e13' },
  p: { fixed: '#25161a' },
  f: { fixed: '#ffd75e' },
  F: { fixed: '#ea6a2a' },
  v: { fixed: '#6f9a3c' },
  V: { fixed: '#46682a' },
  s: { role: 'skin', tone: 'base' },
  S: { role: 'skin', tone: 'shade' },
  h: { role: 'skin', tone: 'light' },
  c: { role: 'cloth', tone: 'base' },
  C: { role: 'cloth', tone: 'shade' },
  m: { role: 'metal', tone: 'base' },
  M: { role: 'metal', tone: 'shade' },
  l: { role: 'metal', tone: 'light' },
  w: { role: 'leather', tone: 'base' },
  W: { role: 'leather', tone: 'shade' },
  a: { role: 'accent', tone: 'base' },
  A: { role: 'accent', tone: 'shade' },
  b: { role: 'bone', tone: 'base' },
  B: { role: 'bone', tone: 'shade' },
  r: { role: 'hair', tone: 'base' },
  R: { role: 'hair', tone: 'shade' },
  e: { role: 'eye', tone: 'base' },
  g: { role: 'eye', tone: 'light' }
}

/**
 * Inks only the humanoid torso and legs use, for the parts of the body an outfit may cover. The
 * outfit pass turns each into a finished ink; skin left showing becomes the skin ink beside it.
 */
export const ZONE_INKS = {
  t: 's', // chest
  T: 'S', // chest in shade
  u: 'h', // chest in light
  x: 's', // arm
  X: 'S', // arm in shade
  n: 's', // hand
  y: 's', // leg
  Y: 'S', // leg in shade
  z: 'S' // foot
}

/** Every ink a part may use: the finished ones, the zones and `.` for nothing. */
export const PART_INKS = new Set([...Object.keys(INKS), ...Object.keys(ZONE_INKS), '.'])

/** How far a shade goes towards black and a light towards white. */
const SHADE_MIX = 0.38
const LIGHT_MIX = 0.42
const DEFAULT_COLOUR = '#8a8f99'
const HEX_COLOUR = /^#[0-9a-f]{6}$/i

const channelsOf = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
const hexOf = (channels) =>
  `#${channels.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`

/** A colour moved `share` of the way towards another. */
export function mixColour(hex, towards, share) {
  const from = channelsOf(hex)
  const to = channelsOf(towards)
  return hexOf(from.map((value, index) => value + (to[index] - value) * share))
}

/** A palette colour when it is a plain six-digit hex colour, so nothing else reaches the page. */
export const safeColour = (value) =>
  (typeof value === 'string' && HEX_COLOUR.test(value) ? value : DEFAULT_COLOUR)

/**
 * The colour of every ink for a palette.
 *
 * @param {Record<string, string>} colours a look's colours by role
 * @returns {Record<string, string>} ink → hex colour
 */
export function inkColours(colours) {
  const fills = {}
  for (const [ink, { fixed, role, tone }] of Object.entries(INKS)) {
    if (fixed) {
      fills[ink] = fixed
      continue
    }
    const base = safeColour(colours?.[role])
    if (tone === 'base') fills[ink] = base
    else if (tone === 'shade') fills[ink] = mixColour(base, '#000000', SHADE_MIX)
    else fills[ink] = mixColour(base, '#ffffff', LIGHT_MIX)
  }
  return fills
}
