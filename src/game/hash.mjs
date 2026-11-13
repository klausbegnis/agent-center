// The game's only source of "chance": a number worked out from text, so the same ids always
// give the same result and a save can be replayed.

/**
 * @param {string} text
 * @returns {number} an unsigned 32-bit integer
 */
export function hashOf(text) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** A number from 0 (included) to 1 (excluded) for the text. */
export const chanceOf = (text) => hashOf(text) / 4294967296
