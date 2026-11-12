// Small, stable differences between rooms and between agents, so they are easy to tell apart.
// Everything is derived from ids: the same room or agent always looks the same.
import { hash } from './hash.js'

/** Hue steps used when a theme does not list its own. */
const HUE_STEP = 15
const HUE_STEPS = 360 / HUE_STEP
/** Two rooms closer than this on the colour wheel are too alike. */
const MIN_HUE_DISTANCE = 40

/** How far apart each step of an agent's tint is, when the theme does not say. */
const DEFAULT_AGENT_HUE_SHIFT = 14
/** An agent's tint is one of five steps centred on no shift. */
const AGENT_TINT_STEPS = 5

/**
 * A room's own look: a hue shift, a mirrored scenery or not and, when the theme ships more
 * than one, a different scenery.
 */
export function variantFor(theme, room) {
  const config = theme.room.variants ?? {}
  const backgrounds = theme.room.backgrounds ?? [theme.room.background]
  const seed = hash(room.id)
  return {
    hue: config.hues ? config.hues[seed % config.hues.length] : (seed % HUE_STEPS) * HUE_STEP,
    flip: config.flip !== false && (seed >>> 8) % 2 === 1,
    background: backgrounds[(seed >>> 4) % backgrounds.length]
  }
}

function hueDistance(a, b) {
  const difference = Math.abs(a - b) % 360
  return Math.min(difference, 360 - difference)
}

/**
 * The hue to use for a room that would like `wanted`: `wanted` itself when it is clear of the
 * hues already taken, otherwise the next step round the wheel that is. When the wheel is too
 * crowded for that, the step furthest from every taken hue.
 */
function clearestHue(wanted, taken) {
  let best = wanted
  let bestDistance = -1
  for (let step = 0; step < HUE_STEPS; step++) {
    const candidate = (wanted + step * HUE_STEP) % 360
    const distance = Math.min(...taken.map((other) => hueDistance(candidate, other)), 360)
    if (distance >= MIN_HUE_DISTANCE) return candidate
    if (distance > bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

/**
 * Variants for a set of rooms, with clashing hues moved apart. Two ids can hash to the same
 * hue; walking the rooms in a fixed order keeps the result stable while the set is.
 *
 * @param {{ id: string }[]} rooms
 * @param {(room: { id: string }) => object | undefined} themeOf
 * @returns {Map<string, { hue: number, flip: boolean, background: string }>}
 */
export function assignVariants(rooms, themeOf) {
  const variants = new Map()
  const taken = []
  for (const room of [...rooms].sort((a, b) => a.id.localeCompare(b.id))) {
    const theme = themeOf(room)
    if (!theme) continue
    const variant = variantFor(theme, room)
    const ownHues = theme.room.variants?.hues
    if (ownHues) {
      // A theme's own list: take the next unused entry while there is one.
      let index = ownHues.indexOf(variant.hue)
      for (let tries = 0; tries < ownHues.length && taken.includes(variant.hue); tries++) {
        index = (index + 1) % ownHues.length
        variant.hue = ownHues[index]
      }
    } else {
      variant.hue = clearestHue(variant.hue, taken)
    }
    taken.push(variant.hue)
    variants.set(room.id, variant)
  }
  return variants
}

/**
 * An agent's own look: an outfit from the theme, an outfit colour and a slight tint within its
 * species.
 *
 * @returns {{ outfit: string[], outfitColor: string | null, hue: number }}
 */
export function lookFor(theme, agentId) {
  const seed = hash(agentId)
  const outfits = theme.actors.outfits ?? [[]]
  const palette = theme.actors.outfitColors ?? []
  const shift = theme.actors.hueShift ?? DEFAULT_AGENT_HUE_SHIFT
  return {
    outfit: outfits[seed % outfits.length] ?? [],
    outfitColor: palette.length ? palette[(seed >>> 6) % palette.length] : null,
    hue: (((seed >>> 12) % AGENT_TINT_STEPS) - Math.floor(AGENT_TINT_STEPS / 2)) * shift
  }
}
