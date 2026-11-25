// Sending what a room owns to another room of the same world: any item of its chest, or a relic,
// the active one included (the sending room is then left with none active). An item a character holds is first taken from it, and that slot goes
// back to the automatic pick. Gear is per room on purpose; sending it is free, and only moves
// where the power sits. Pure.
import { addToChest, findItem } from './chest.mjs'
import { autoPick } from './equip.mjs'
import { legendaryOf, ownsLegendary, withLegendary, withRelic } from './legendary.mjs'
import { mergeChests, salvageInto, sharedWorldId } from './orphans.mjs'
import { withCharacter } from './worlds.mjs'

/** @typedef {import('./legendary-content.mjs').LegendaryIndex | null} LegendaryIndex */

/** The most items one sending may carry: far more than a chest shows, far less than a body holds. */
export const MAX_ITEMS_SENT = 60

/** Why a sending is refused, in words a person can act on. */
export const TRANSFER_REFUSALS = Object.freeze({
  sameRoom: 'it is already in that room',
  otherWorld: 'the two rooms do not play in the same world',
  noItem: 'that item is not in this chest',
  noItems: 'no item was chosen',
  tooMany: `at most ${MAX_ITEMS_SENT} items go at once`,
  twice: 'the same item was chosen twice',
  heldUnconfirmed: 'a character holds that item: confirm to take it from them and send it',
  holderGone: 'that item is held by nobody here',
  legendaryOwned: 'that room already owns this legendary item',
  legendaryTwice: 'two copies of one legendary item cannot go to one room',
  noRelic: 'this room does not own that relic',
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

/** The ids of a sending: `itemIds`, or the single `itemId`. */
const idsOf = ({ itemIds, itemId }) => (Array.isArray(itemIds) ? itemIds : itemId === undefined ? [] : [itemId])

/** Why one item of the source cannot go to the target, or null. */
function itemProblem(source, target, item, confirmHeld) {
  if (!item) return TRANSFER_REFUSALS.noItem
  if (item.heldBy !== null) {
    if (!Object.hasOwn(source.characters, item.heldBy)) return TRANSFER_REFUSALS.holderGone
    if (confirmHeld !== true) return TRANSFER_REFUSALS.heldUnconfirmed
  }
  if (item.legendary && ownsLegendary(target, item.entryId)) return TRANSFER_REFUSALS.legendaryOwned
  return null
}

/**
 * Why items cannot be sent, or null when they can. An item a character holds needs
 * `confirmHeld: true`, so it is never taken from a character by accident.
 *
 * @param {object} save
 * @param {{ fromProjectId: string, toProjectId: string, itemId?: string, itemIds?: string[],
 *   confirmHeld?: boolean }} sending one item (`itemId`) or several (`itemIds`)
 * @returns {string | null}
 */
export function sendItemProblem(save, sending) {
  const rooms = twoRooms(save, sending.fromProjectId, sending.toProjectId)
  if (rooms.problem) return rooms.problem
  const ids = idsOf(sending)
  if (ids.length === 0) return TRANSFER_REFUSALS.noItems
  if (ids.length > MAX_ITEMS_SENT) return TRANSFER_REFUSALS.tooMany
  if (new Set(ids).size !== ids.length) return TRANSFER_REFUSALS.twice
  const legendaryEntries = new Set()
  for (const itemId of ids) {
    const item = findItem(rooms.source.chest, itemId)
    const problem = itemProblem(rooms.source, rooms.target, item, sending.confirmHeld)
    if (problem) return problem
    if (item.legendary) {
      if (legendaryEntries.has(item.entryId)) return TRANSFER_REFUSALS.legendaryTwice
      legendaryEntries.add(item.entryId)
    }
  }
  return null
}

/**
 * The source without an item. When a character held it, that slot is handed back to the automatic
 * pick at once (unpinned), which takes the best free item the character may hold there, legendary
 * rules included, or nothing.
 *
 * @returns {{ project: object, repick: { sessionId: string, slot: string, itemId: string | null } | null }}
 */
function takeOut(project, item, index) {
  const chest = project.chest.filter((owned) => owned.id !== item.id)
  if (item.heldBy === null) return { project: { ...project, chest }, repick: null }
  const holder = project.characters[item.heldBy]
  const pinned = { ...holder.pinned }
  delete pinned[item.slot]
  const emptied = { ...holder, equipment: { ...holder.equipment, [item.slot]: null }, pinned }
  if (Object.keys(pinned).length === 0) delete emptied.pinned
  const without = { ...project, chest }
  const picked = autoPick(chest, emptied, [item.slot], { index, project: without })
  const next = withCharacter({ ...without, chest: picked.chest }, picked.character)
  const itemId = picked.character.equipment[item.slot] ?? null
  return { project: next, repick: { sessionId: holder.sessionId, slot: item.slot, itemId } }
}

/** The target's chest with one item added, what its copies cap salvaged, and whether that was it. */
function putIn(chest, item) {
  const entryId = item.entryId ?? item.id
  if (item.legendary) {
    return { chest: addToChest(chest, { ...item, id: entryId, entryId, heldBy: null }), salvaged: [], wasSalvaged: false }
  }
  const arriving = { ...item, heldBy: null }
  const merged = mergeChests(chest, [arriving])
  return { ...merged, wasSalvaged: merged.salvaged.includes(arriving) }
}

/**
 * @typedef {{ save: object, salvaged: object[], sentSalvaged: string[],
 *   repicks: { sessionId: string, slot: string, itemId: string | null }[] }} SendResult
 *   `salvaged` every item the target's copies cap salvaged, `sentSalvaged` the ids of the sent
 *   items among them, `repicks` what each character that held a sent item took instead
 */

/**
 * Sends items of a project's chest to another project of the same world, in the order given. Each
 * arrives free, numbered as the target's copies are, and the target keeps at most
 * COPIES_PER_ITEM copies of an entry, as when a chest left behind is moved (`mergeChests`): items
 * held there always stay, the best of the rest stay, and the lowest is salvaged into the world's
 * materials, which may be an item sent. A legendary item is never salvaged: one the target owns
 * already is refused. An item a character holds is taken from it first (see `takeOut`).
 *
 * @param {object} save
 * @param {{ fromProjectId: string, toProjectId: string, itemId?: string, itemIds?: string[],
 *   confirmHeld?: boolean }} sending
 * @param {LegendaryIndex} [index] the legendary content, for what a character may take instead
 * @returns {SendResult} the same save, and nothing else, when refused
 */
export function sendItem(save, sending, index = null) {
  if (sendItemProblem(save, sending) !== null) return { save, salvaged: [], sentSalvaged: [], repicks: [] }
  const { fromProjectId, toProjectId } = sending
  const { worldId, world, source, target } = twoRooms(save, fromProjectId, toProjectId)
  let from = source
  let chest = target.chest
  const salvaged = []
  const sentSalvaged = []
  const repicks = []
  for (const itemId of idsOf(sending)) {
    const item = findItem(from.chest, itemId)
    const taken = takeOut(from, item, index)
    from = taken.project
    if (taken.repick) repicks.push(taken.repick)
    const merged = putIn(chest, item)
    chest = merged.chest
    salvaged.push(...merged.salvaged)
    if (merged.wasSalvaged) sentSalvaged.push(itemId)
  }
  const projects = { ...world.projects, [fromProjectId]: from, [toProjectId]: { ...target, chest } }
  const materials = salvageInto(world, salvaged)
  const next = { ...save, worlds: { ...save.worlds, [worldId]: { ...world, materials, projects } } }
  return { save: next, salvaged, sentSalvaged, repicks }
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
  if (legendaryOf(rooms.target).relics.includes(relicId)) return TRANSFER_REFUSALS.relicOwned
  return null
}

/**
 * Sends a relic a project owns to another project of the same world. When it was the active one,
 * the sending room is left with no active relic: another is never picked for it, so the person
 * chooses. The target adds it after its own and keeps its active relic; a target that had no relic
 * makes it active, as a first drop does. Pity counters stay with their room.
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
  const relics = own.relics.filter((id) => id !== relicId)
  const kept = { ...own, relics, active: own.active === relicId ? null : own.active }
  const projects = {
    ...world.projects,
    [fromProjectId]: withLegendary(source, kept),
    [toProjectId]: withRelic(target, relicId)
  }
  return { ...save, worlds: { ...save.worlds, [worldId]: { ...world, projects } } }
}
