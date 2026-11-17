// What a person can change in a character's equipment: take an item of the room's chest (a free
// one, or one another character holds, by swapping), empty a slot, or hand a slot back to the
// automatic pick. A slot chosen by hand is pinned, and the automatic pick leaves it alone. The
// automatic pick itself stays in chest.mjs (`equipFromChest`); this module only calls it. Pure.
import { equipFromChest, findItem } from './chest.mjs'
import { withCharacter, withProjectIn, worldIdOf } from './worlds.mjs'

/** The equipment slots, in the order they are shown. */
export const EQUIPMENT_SLOTS = Object.freeze(['weapon', 'outfit', 'tool'])
/** The choice that hands a slot back to the automatic pick. */
export const AUTO = 'auto'

/** The weapon damage type a class can use; the same rule `equipFromChest` follows. */
export const weaponTypeOf = (characterClass) => (characterClass === 'magical' ? 'magical' : 'physical')

/** Whether a character can use an item in its slot: any outfit or tool, a weapon of its type. */
export function canUse(character, item) {
  return item.slot !== 'weapon' || item.damageType === weaponTypeOf(character.class)
}

/** The slots a character's person chose by hand. */
export const pinnedSlots = (character) => EQUIPMENT_SLOTS.filter((slot) => character.pinned?.[slot] === true)

/** The character with a slot pinned or not; no pins at all leaves the field out. */
function withPin(character, slot, isPinned) {
  const pinned = { ...character.pinned }
  if (isPinned) pinned[slot] = true
  else delete pinned[slot]
  const next = { ...character, pinned }
  if (Object.keys(pinned).length === 0) delete next.pinned
  return next
}

/** The chest with one item's holder set, and the character's slot pointing at it. */
function hold(chest, character, slot, itemId) {
  const current = character.equipment?.[slot] ?? null
  const nextChest = chest.map((item) => {
    if (item.id === current && current !== itemId) return { ...item, heldBy: null }
    if (item.id === itemId) return { ...item, heldBy: character.sessionId }
    return item
  })
  const equipment = { ...character.equipment, [slot]: itemId }
  return { chest: nextChest, character: { ...character, equipment } }
}

/**
 * The automatic pick for some of a character's slots: its items in those slots go back to the
 * chest, then `equipFromChest` chooses among the free items of those slots only.
 *
 * @param {object[]} chest
 * @param {object} character
 * @param {string[]} slots
 * @returns {{ chest: object[], character: object }}
 */
export function autoPick(chest, character, slots) {
  if (slots.length === 0) return { chest, character }
  const own = new Set(slots.map((slot) => character.equipment?.[slot]).filter(Boolean))
  const released = chest.map((item) => (own.has(item.id) ? { ...item, heldBy: null } : item))
  const picked = equipFromChest(released.filter((item) => slots.includes(item.slot)), character)
  const taken = new Map(slots.map((slot) => [picked.equipment[slot], slot]).filter(([id]) => id))
  const nextChest = released.map((item) =>
    (taken.has(item.id) ? { ...item, heldBy: character.sessionId } : item))
  const equipment = { ...character.equipment }
  for (const slot of slots) equipment[slot] = picked.equipment[slot]
  return { chest: nextChest, character: { ...character, equipment } }
}

/**
 * Why a choice cannot be made, or null when it can. `itemId` is an item of the chest, null to
 * empty the slot, or AUTO.
 *
 * @param {object} project
 * @param {{ sessionId: string, slot: string, itemId: string | null }} choice
 * @returns {string | null}
 */
export function equipProblem(project, { sessionId, slot, itemId }) {
  const character = Object.hasOwn(project.characters, sessionId) ? project.characters[sessionId] : null
  if (!character) return 'not a character of this room'
  if (!EQUIPMENT_SLOTS.includes(slot)) return 'not an equipment slot'
  if (itemId === null || itemId === AUTO) return null
  const item = findItem(project.chest, itemId)
  if (!item) return 'not an item of this room\'s chest'
  if (item.slot !== slot) return `that item does not go in the ${slot} slot`
  if (!canUse(character, item)) return 'that character cannot use that weapon'
  const holder = item.heldBy && item.heldBy !== sessionId ? project.characters[item.heldBy] : null
  if (item.heldBy && item.heldBy !== sessionId && !holder) return 'that item is held by nobody here'
  const given = character.equipment?.[slot] ? findItem(project.chest, character.equipment[slot]) : null
  if (holder && given && !canUse(holder, given)) {
    return 'the one holding it cannot use what it would get in exchange'
  }
  return null
}

/**
 * Applies a choice to a project known to allow it (see `equipProblem`).
 *
 * @param {object} project
 * @param {{ sessionId: string, slot: string, itemId: string | null }} choice
 * @returns {object}
 */
export function equipInProject(project, { sessionId, slot, itemId }) {
  const character = project.characters[sessionId]
  if (itemId === AUTO) {
    const picked = autoPick(project.chest, withPin(character, slot, false), [slot])
    return withCharacter({ ...project, chest: picked.chest }, picked.character)
  }
  const item = itemId === null ? null : findItem(project.chest, itemId)
  const holder = item?.heldBy && item.heldBy !== sessionId ? project.characters[item.heldBy] : null
  if (holder) {
    // A swap: the holder takes what the character had in that slot, or nothing.
    const given = character.equipment?.[slot] ?? null
    const chest = project.chest.map((entry) => {
      if (entry.id === itemId) return { ...entry, heldBy: sessionId }
      if (given && entry.id === given) return { ...entry, heldBy: holder.sessionId }
      return entry
    })
    const nextHolder = { ...holder, equipment: { ...holder.equipment, [slot]: given } }
    const equipment = { ...character.equipment, [slot]: itemId }
    const nextCharacter = withPin({ ...character, equipment }, slot, true)
    return withCharacter(withCharacter({ ...project, chest }, nextHolder), nextCharacter)
  }
  const held = hold(project.chest, character, slot, itemId)
  return withCharacter({ ...project, chest: held.chest }, withPin(held.character, slot, true))
}

/** Changes one project of a save; the same save when the project is not in it or out of the game. */
function inProject(save, projectId, change) {
  const worldId = worldIdOf(save, projectId)
  const world = worldId === null ? null : save.worlds[worldId]
  const project = world?.projects[projectId]
  if (!project) return save
  const next = change(project)
  if (next === project) return save
  return { ...save, worlds: { ...save.worlds, [worldId]: withProjectIn(world, projectId, next) } }
}

/**
 * Sets what a character holds in a slot: an item of the room's chest (taken free, or swapped with
 * the character holding it), null for nothing, or AUTO to unpin the slot and take the best free
 * item. Unchanged when the choice cannot be made (see `equipProblem`) or changes nothing.
 *
 * @param {object} save
 * @param {{ projectId: string, sessionId: string, slot: string, itemId: string | null }} choice
 * @returns {object}
 */
export function equipItem(save, { projectId, ...choice }) {
  return inProject(save, projectId, (project) => {
    if (equipProblem(project, choice)) return project
    const next = equipInProject(project, choice)
    return JSON.stringify(next) === JSON.stringify(project) ? project : next
  })
}

/**
 * Re-runs the automatic pick for every slot nobody pinned in a room: all those items go back to
 * the chest, then each character takes the best free item of its unpinned slots, in order of
 * session id, as characters do when they arrive.
 *
 * @param {object} save
 * @param {{ projectId: string }} where
 * @returns {object}
 */
export function bestGearForRoom(save, { projectId }) {
  return inProject(save, projectId, (project) => {
    const order = Object.keys(project.characters).sort()
    const free = new Set(order.flatMap((sessionId) => {
      const character = project.characters[sessionId]
      const pinned = pinnedSlots(character)
      return EQUIPMENT_SLOTS.filter((slot) => !pinned.includes(slot))
        .map((slot) => character.equipment?.[slot])
    }).filter(Boolean))
    const chest = project.chest.map((item) => (free.has(item.id) ? { ...item, heldBy: null } : item))
    let next = { ...project, chest }
    for (const sessionId of order) {
      const character = next.characters[sessionId]
      const slots = EQUIPMENT_SLOTS.filter((slot) => !pinnedSlots(character).includes(slot))
      const emptied = { ...character, equipment: { ...character.equipment } }
      for (const slot of slots) emptied.equipment[slot] = null
      const picked = autoPick(next.chest, emptied, slots)
      next = withCharacter({ ...next, chest: picked.chest }, picked.character)
    }
    return JSON.stringify(next) === JSON.stringify(project) ? project : next
  })
}

/**
 * The slots of a room whose item changed between two saves, as `{ sessionId, slot }`, for saying
 * what "Best gear for everyone" did.
 *
 * @param {object} before the project before
 * @param {object} after the project after
 */
export function changedSlots(before, after) {
  const changes = []
  for (const sessionId of Object.keys(after.characters).sort()) {
    for (const slot of EQUIPMENT_SLOTS) {
      const was = before.characters[sessionId]?.equipment?.[slot] ?? null
      const now = after.characters[sessionId].equipment?.[slot] ?? null
      if (was !== now) changes.push({ sessionId, slot })
    }
  }
  return changes
}
