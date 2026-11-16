// What a world may be called and how many there may be: one rule for the actions that create a
// world and for the check of an imported save. Pure.

/** A world's id: lower-case words joined by dashes, short enough for a label. */
const WORLD_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/
const WORLD_ID_LIMIT = 32
/** Worlds split progress on purpose; a handful is plenty, and it bounds the save. */
export const MAX_WORLDS = 8

/**
 * Whether a value is a well-formed world id.
 *
 * @param {unknown} value
 */
export function isWorldId(value) {
  return typeof value === 'string' && value.length <= WORLD_ID_LIMIT && WORLD_ID.test(value)
}
