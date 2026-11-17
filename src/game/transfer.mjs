// Sending what a room owns to another room of the same world: a free item of its chest, or a
// relic that is not its active one. Gear is per room on purpose; sending it is free, and only
// moves where the power sits. Pure.
import { addToChest, findItem } from './chest.mjs'
import { legendaryOf, ownsLegendary, withLegendary, withRelic } from './legendary.mjs'
import { mergeChests, salvageInto, sharedWorldId } from './orphans.mjs'

/** Why a sending is refused, in words a person can act on. */
export const TRANSFER_REFUSALS = Object.freeze({
  sameRoom: 'it is already in that room',
  otherWorld: 'the two rooms do not play in the same world',
  noItem: 'that item is not in this chest',
  held: 'a character holds that item; give it something else first',
  legendaryOwned: 'that room already owns this legendary item',
  noRelic: 'this room does not own that relic',
  activeRelic: 'the active relic stays; make another one active first',
  relicOwned: 'that room already owns this relic'
})

/** The two projects of one world, or the reason they are not. */
function twoRooms(save, fromProjectId, toProjectId) {
  if (fromProjectId === toProjectId) return { problem: TRANSFER_REFUSALS.sameRoom }
  const worldId = sharedWorldId(save, fromProjectId, toProjectId)
  if (worldId === null) return { problem: TRANSFER_REFUSALS.otherWorld }
  const world = save.worlds[worldId]
  return { worldId, world, source: world.projects[fromProjectId], target: world.projects[toProjectId] }
}

/**
 * Why an item cannot be sent, or null when it can.
 *
 * @param {object} save
 * @param {{ fromProjectId: string, toProjectId: string, itemId: string }} sending
 * @returns {string | null}
 */
export function sendItemProblem(save, { fromProjectId, toProjectId, itemId }) {
  const rooms = twoRooms(save, fromProjectId, toProjectId)
  if (rooms.problem) return rooms.problem
  const item = findItem(rooms.source.chest, itemId)
  if (!item) return TRANSFER_REFUSALS.noItem
  // A free item is never pinned: a pin names a slot of a living character, which holds the item.
  if (item.heldBy !== null) return TRANSFER_REFUSALS.held
  if (item.legendary && ownsLegendary(rooms.target, item.entryId)) return TRANSFER_REFUSALS.legendaryOwned
  return null
}

/**
 * Sends a free item of a project's chest to another project of the same world. It arrives free,
 * numbered as the target's copies are, and the target's chest keeps at most COPIES_PER_ITEM copies
 * of its entry, as when a chest left behind is moved (`mergeChests`): items held there always
 * stay, the best of the rest stay, and the lowest is salvaged into the world's materials, which
 * may be the item sent. A legendary item is never salvaged: one the target already owns is refused.
 *
 * @param {object} save
 * @param {{ fromProjectId: string, toProjectId: string, itemId: string }} sending
 * @returns {{ save: object, salvaged: object[] }} the same save, and nothing salvaged, when refused
 */
export function sendItem(save, sending) {
  if (sendItemProblem(save, sending) !== null) return { save, salvaged: [] }
  const { fromProjectId, toProjectId, itemId } = sending
  const { worldId, world, source, target } = twoRooms(save, fromProjectId, toProjectId)
  const item = findItem(source.chest, itemId)
  const entryId = item.entryId ?? item.id
  const merged = item.legendary
    ? { chest: addToChest(target.chest, { ...item, id: entryId, entryId, heldBy: null }), salvaged: [] }
    : mergeChests(target.chest, [item])
  const projects = {
    ...world.projects,
    [fromProjectId]: { ...source, chest: source.chest.filter((owned) => owned.id !== itemId) },
    [toProjectId]: { ...target, chest: merged.chest }
  }
  const materials = salvageInto(world, merged.salvaged)
  const next = { ...save, worlds: { ...save.worlds, [worldId]: { ...world, materials, projects } } }
  return { save: next, salvaged: merged.salvaged }
}

/**
 * Why a relic cannot be sent, or null when it can.
 *
 * @param {object} save
 * @param {{ fromProjectId: string, toProjectId: string, relicId: string }} sending
 * @returns {string | null}
 */
export function sendRelicProblem(save, { fromProjectId, toProjectId, relicId }) {
  const rooms = twoRooms(save, fromProjectId, toProjectId)
  if (rooms.problem) return rooms.problem
  const own = legendaryOf(rooms.source)
  if (!own.relics.includes(relicId)) return TRANSFER_REFUSALS.noRelic
  if (own.active === relicId) return TRANSFER_REFUSALS.activeRelic
  if (legendaryOf(rooms.target).relics.includes(relicId)) return TRANSFER_REFUSALS.relicOwned
  return null
}

/**
 * Sends a relic a project owns, not its active one, to another project of the same world. The
 * target adds it after its own; a target that had no relic makes it active, as a first drop does.
 * Pity counters stay with their room.
 *
 * @param {object} save
 * @param {{ fromProjectId: string, toProjectId: string, relicId: string }} sending
 * @returns {object} the same save when refused
 */
export function sendRelic(save, sending) {
  if (sendRelicProblem(save, sending) !== null) return save
  const { fromProjectId, toProjectId, relicId } = sending
  const { worldId, world, source, target } = twoRooms(save, fromProjectId, toProjectId)
  const own = legendaryOf(source)
  const kept = { ...own, relics: own.relics.filter((id) => id !== relicId) }
  const projects = {
    ...world.projects,
    [fromProjectId]: withLegendary(source, kept),
    [toProjectId]: withRelic(target, relicId)
  }
  return { ...save, worlds: { ...save.worlds, [worldId]: { ...world, projects } } }
}
