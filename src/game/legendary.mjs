// A room's legendary loot as the save keeps it: the relics it owns, the one active, and the pity
// counters of its drops. Legendary equipment lives in the chest, marked `legendary: true`. These
// functions read and change that state; drops are in legendary-drops.mjs. Pure.
import { addToChest, isBetter } from './chest.mjs'
import { LEGENDARY_PITY_MAX } from './constants.mjs'

/**
 * @typedef {{ relics: string[], active: string | null, relicPity: number, bossPity: number }} RoomLegendary
 *   `relics` in the order they were obtained; `relicPity` boss kills since the last pool relic and
 *   `bossPity` kills of bosses with an item since the last boss-owned item
 */

/** @returns {RoomLegendary} */
export const emptyLegendary = () => ({ relics: [], active: null, relicPity: 0, bossPity: 0 })

/**
 * The room's legendary state, or the empty one for a room that never had any.
 *
 * @param {{ legendary?: RoomLegendary }} project
 * @returns {RoomLegendary}
 */
export const legendaryOf = (project) => project?.legendary ?? emptyLegendary()

/**
 * The legendary items in a room's chest.
 *
 * @param {{ chest: object[] }} project
 * @returns {object[]}
 */
export const legendaryItems = (project) => project.chest.filter((item) => item.legendary === true)

/**
 * Whether the room owns a legendary entry: a relic it keeps, or equipment in its chest.
 *
 * @param {{ chest: object[], legendary?: RoomLegendary }} project
 * @param {string} entryId
 */
export function ownsLegendary(project, entryId) {
  return legendaryOf(project).relics.includes(entryId) ||
    legendaryItems(project).some((item) => item.entryId === entryId)
}

/**
 * The room with a relic added. The first relic a room obtains becomes active; later ones wait
 * until someone picks them.
 *
 * @param {object} project
 * @param {string} relicId
 * @returns {object}
 */
export function withRelic(project, relicId) {
  const legendary = legendaryOf(project)
  if (legendary.relics.includes(relicId)) return project
  const active = legendary.relics.length === 0 ? relicId : legendary.active
  return { ...project, legendary: { ...legendary, relics: [...legendary.relics, relicId], active } }
}

const isCount = (value) => Number.isInteger(value) && value >= 0 && value <= LEGENDARY_PITY_MAX
const isNothing = (legendary) => legendary.relics.length === 0 && legendary.relicPity === 0 && legendary.bossPity === 0

/**
 * A room's legendary state as the plugin's own storage may hold it, repaired: a list of distinct
 * relic ids, an active one among them or null, whole pity counts. Ids are not checked against the
 * content here: one the content no longer has does nothing. Null when there is nothing to keep, so
 * a room without legendary loot keeps no field and an old save loads unchanged.
 *
 * @param {unknown} value
 * @returns {RoomLegendary | null}
 */
export function normalizeLegendary(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const relics = Array.isArray(value.relics)
    ? [...new Set(value.relics.filter((id) => typeof id === 'string' && id !== ''))]
    : []
  const legendary = {
    relics,
    active: relics.includes(value.active) ? value.active : null,
    relicPity: isCount(value.relicPity) ? value.relicPity : 0,
    bossPity: isCount(value.bossPity) ? value.bossPity : 0
  }
  return isNothing(legendary) ? null : legendary
}

/**
 * The project with its legendary state set, or without the field when there is nothing to keep.
 *
 * @param {object} project
 * @param {RoomLegendary | null} legendary
 */
export function withLegendary(project, legendary) {
  const { legendary: _dropped, ...rest } = project
  return legendary && !isNothing(legendary) ? { ...rest, legendary } : rest
}

/**
 * What a room left behind brings to the room it moves into. Relics join the target's (theirs
 * first, in the order obtained); the target keeps its active relic, or takes the source's when it
 * had no relic at all, and keeps its own pity. A piece of legendary equipment the target does not
 * own arrives free; of two copies of one, the better stays and the other is salvaged, unless the
 * target's is held, which always stays.
 *
 * @param {{ chest: object[], legendary?: RoomLegendary }} target the target with its merged chest
 * @param {{ items: object[], legendary?: RoomLegendary }} source the source's legendary items and state
 * @returns {{ chest: object[], legendary: RoomLegendary | null, salvaged: object[] }}
 */
export function mergeLegendary(target, source) {
  const own = legendaryOf(target)
  const theirs = legendaryOf(source)
  const relics = [...own.relics, ...theirs.relics.filter((id) => !own.relics.includes(id))]
  const active = own.relics.length > 0 ? own.active : (theirs.active ?? relics[0] ?? null)
  let chest = target.chest
  const salvaged = []
  for (const item of source.items) {
    const arriving = { ...item, id: item.entryId, heldBy: null }
    const present = chest.find((owned) => owned.legendary && owned.entryId === item.entryId)
    if (!present) {
      chest = addToChest(chest, arriving)
    } else if (present.heldBy === null && isBetter(arriving, present)) {
      chest = chest.map((owned) => (owned === present ? arriving : owned))
      salvaged.push(present)
    } else {
      salvaged.push(arriving)
    }
  }
  return { chest, legendary: { ...own, relics, active }, salvaged }
}
