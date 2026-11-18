// Checks the traits' parts of a save from outside the plugin (save-check.mjs calls these): the
// traits a character carries, a room's scrolls and a world's collection and broker sales. Each
// answers `{ ok: true, value }`, with no value when the part is absent (a save from before
// traits), or `{ ok: false, problem: [where, what] }`. Pure.
import { BROKER_OFFERS, SCROLL_COPIES } from './trait-constants.mjs'
import { traitSlots } from './trait-effects.mjs'

/** @typedef {import('./trait-content.mjs').TraitIndex} TraitIndex */

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const isWhole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
/** Keys an object must never be given, whatever the content. */
const RESERVED = new Set(['__proto__', 'constructor', 'prototype'])

const refuse = (where, what) => ({ ok: false, problem: [where, what] })

/** A list of distinct trait ids of the content, or the problem. */
function traitList(value, where, index) {
  if (!Array.isArray(value)) return refuse(where, 'is not a list')
  if (new Set(value).size !== value.length) return refuse(where, 'names a trait twice')
  const unknown = value.find((id) => typeof id !== 'string' || !index.byId.has(id))
  if (unknown !== undefined) return refuse(where, `names a trait the game does not have: ${String(unknown).slice(0, 40)}`)
  return { ok: true, value: [...value] }
}

/**
 * The traits a character carries: a list of distinct traits of the content, no longer than its
 * level's slots. Absent on a character nobody taught.
 *
 * @param {unknown} value
 * @param {{ level: number, index: TraitIndex | null }} character
 */
export function checkCharacterTraits(value, { level, index }) {
  if (value === undefined) return { ok: true }
  if (!index) return refuse('traits', 'are kept but this game has none')
  const listed = traitList(value, 'traits', index)
  if (!listed.ok) return listed
  if (listed.value.length > traitSlots(level)) return refuse('traits', 'are more than its level has slots for')
  return listed
}

/**
 * A room's scrolls: by trait of the content, whole counts from 1 to SCROLL_COPIES.
 *
 * @param {unknown} value
 * @param {TraitIndex | null} index
 */
export function checkRoomScrolls(value, index) {
  if (value === undefined) return { ok: true }
  if (!index) return refuse('scrolls', 'are kept but this game has no traits')
  if (!isPlainObject(value)) return refuse('scrolls', 'is not an object')
  for (const [id, count] of Object.entries(value)) {
    if (RESERVED.has(id) || !index.byId.has(id)) return refuse(`scrolls.${id.slice(0, 40)}`, 'is not a trait the game has')
    if (!isWhole(count, 1, SCROLL_COPIES)) return refuse(`scrolls.${id}`, `is not a count from 1 to ${SCROLL_COPIES}`)
  }
  return { ok: true, value: { ...value } }
}

/** A broker's sales of a day: the day and each offer once, by index. */
function soldDay(value, where) {
  if (!isPlainObject(value) || !isWhole(value.day, 0, Number.MAX_SAFE_INTEGER)) return refuse(where, 'has no day')
  const offers = value.offers
  if (!Array.isArray(offers) || !offers.every((offer) => isWhole(offer, 0, BROKER_OFFERS - 1))) {
    return refuse(`${where}.offers`, 'names an offer the broker does not have')
  }
  if (new Set(offers).size !== offers.length) return refuse(`${where}.offers`, 'names an offer twice')
  return { ok: true, value: { day: value.day, offers: [...offers] } }
}

/**
 * A world's trait record: the traits it ever had, and its brokers' sales by city of the content.
 *
 * @param {unknown} value
 * @param {{ index: TraitIndex | null, cityIds: string[] }} known
 */
export function checkWorldTraits(value, { index, cityIds }) {
  if (value === undefined) return { ok: true }
  if (!index) return refuse('traits', 'are kept but this game has none')
  if (!isPlainObject(value)) return refuse('traits', 'is not an object')
  const extra = Object.keys(value).find((key) => !['known', 'sold', 'swaps'].includes(key))
  if (extra !== undefined) return refuse(`traits.${extra.slice(0, 40)}`, 'is not a field the game writes')
  const known = traitList(value.known ?? [], 'traits.known', index)
  if (!known.ok) return known
  const sold = {}
  if (value.sold !== undefined) {
    if (!isPlainObject(value.sold)) return refuse('traits.sold', 'is not an object')
    for (const [cityId, day] of Object.entries(value.sold)) {
      if (RESERVED.has(cityId) || !cityIds.includes(cityId)) return refuse(`traits.sold.${cityId.slice(0, 40)}`, 'is not a city the game has')
      const checked = soldDay(day, `traits.sold.${cityId}`)
      if (!checked.ok) return checked
      sold[cityId] = checked.value
    }
  }
  const swaps = value.swaps ?? 0
  if (!isWhole(swaps, 1, Number.MAX_SAFE_INTEGER) && value.swaps !== undefined) return refuse('traits.swaps', 'is not a whole count')
  if (known.value.length === 0 && Object.keys(sold).length === 0 && swaps === 0) return refuse('traits', 'is kept empty')
  return { ok: true, value: { known: known.value, ...(Object.keys(sold).length ? { sold } : {}), ...(swaps ? { swaps } : {}) } }
}

/**
 * A world's trait record as the plugin's own storage holds it, repaired: known ids that are text,
 * sales that have a day and whole offers. Null when nothing is left. `migrate` keeps what this gives.
 *
 * @param {unknown} value
 * @returns {{ known: string[], sold?: object } | null}
 */
export function normalizeTraitRecord(value) {
  if (!isPlainObject(value)) return null
  const known = Array.isArray(value.known) ? value.known.filter((id) => typeof id === 'string') : []
  const sold = Object.fromEntries(Object.entries(isPlainObject(value.sold) ? value.sold : {})
    .filter(([cityId, day]) => !RESERVED.has(cityId) && soldDay(day, cityId).ok))
  const swaps = isWhole(value.swaps, 1, Number.MAX_SAFE_INTEGER) ? value.swaps : 0
  if (known.length === 0 && Object.keys(sold).length === 0 && swaps === 0) return null
  return { known, ...(Object.keys(sold).length ? { sold } : {}), ...(swaps ? { swaps } : {}) }
}
