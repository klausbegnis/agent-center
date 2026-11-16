// A project left behind: one whose room is no longer on screen while its chest and retirees stay
// in the save. Its items and retirees can be moved into another project of the same world. Pure.
import { addToChest, isBetter } from './chest.mjs'
import { COPIES_PER_ITEM } from './constants.mjs'
import { upgradeCost } from './items.mjs'
import { worldLevel } from './progression.mjs'
import { retire } from './retirement.mjs'
import { mainSkillOf } from './sessions.mjs'
import { addMaterials } from './worlds.mjs'

const entryOf = (item) => item.entryId ?? item.id
const bestFirst = (first, second) => (isBetter(first, second) ? -1 : isBetter(second, first) ? 1 : 0)

/** The world that holds both projects, or null. */
function sharedWorldId(save, fromProjectId, toProjectId) {
  return Object.keys(save.worlds).sort().find((worldId) => {
    const { projects } = save.worlds[worldId]
    return Object.hasOwn(projects, fromProjectId) && Object.hasOwn(projects, toProjectId)
  }) ?? null
}

/** The project with every character retired, so none of its items is held. */
function retireEveryone(project, now) {
  let next = project
  for (const sessionId of Object.keys(project.characters).sort()) {
    const character = project.characters[sessionId]
    const at = now ?? character.lastSeenAt ?? 0
    next = retire(next, sessionId, { now: at, mainSkill: mainSkillOf(character) })
  }
  return { ...next, chest: next.chest.map((item) => (item.heldBy === null ? item : { ...item, heldBy: null })) }
}

/**
 * The target's chest with the incoming items added, at most COPIES_PER_ITEM copies of an entry:
 * the items held in the target always stay, the best of the rest fill the copies left, and the
 * lowest past that are salvaged. Entries that receive nothing are left as they are.
 */
function mergeChests(target, incoming) {
  const byEntry = new Map()
  for (const item of incoming) byEntry.set(entryOf(item), [...(byEntry.get(entryOf(item)) ?? []), item])
  const salvaged = []
  let chest = target
  for (const [entryId, arriving] of byEntry) {
    const own = chest.filter((item) => entryOf(item) === entryId)
    const heldCount = own.filter((item) => item.heldBy !== null).length
    const pool = [
      ...own.filter((item) => item.heldBy === null).map((item) => ({ item, isNew: false })),
      ...arriving.map((item) => ({ item, isNew: true }))
    ].sort((first, second) => bestFirst(first.item, second.item))
    const room = Math.max(0, COPIES_PER_ITEM - heldCount)
    const dropped = pool.slice(room)
    const droppedOwnIds = new Set(dropped.filter((entry) => !entry.isNew).map((entry) => entry.item.id))
    chest = chest.filter((item) => !droppedOwnIds.has(item.id))
    for (const { item, isNew } of pool.slice(0, room)) {
      // A new id from the entry, so the copies are numbered as drops number them.
      if (isNew) chest = addToChest(chest, { ...item, id: entryId, entryId, heldBy: null })
    }
    salvaged.push(...dropped.map((entry) => entry.item))
  }
  return { chest, salvaged }
}

/**
 * Moves a project's items and retirees into another project of the same world, then removes the
 * first one from the world and from `projectWorld`. Its characters retire first, so no item is
 * held. Every item goes into the target's chest, free, but an entry never ends above
 * COPIES_PER_ITEM copies there: the lowest copies past that are salvaged into the world's
 * materials as a drop would be (what one upgrade of a fresh copy costs). Its retirees, kept and
 * folded alike, are added to the target's `retiredCount`, which the retiree bonus counts.
 *
 * @param {object} save
 * @param {{ fromProjectId: string, toProjectId: string, now?: number }} move `now` dates the
 *   retirement of characters still in the source; their last time seen when left out
 * @returns {object} the same save when the two are not projects of one world
 */
export function moveProjectItems(save, { fromProjectId, toProjectId, now }) {
  if (fromProjectId === toProjectId) return save
  const worldId = sharedWorldId(save, fromProjectId, toProjectId)
  if (worldId === null) return save
  const world = save.worlds[worldId]
  const source = retireEveryone(world.projects[fromProjectId], now)
  const target = world.projects[toProjectId]
  const incoming = [...source.chest].sort(bestFirst)
  const { chest, salvaged } = mergeChests(target.chest, incoming)
  const level = worldLevel(world.skills)
  let materials = world.materials
  for (const item of salvaged) materials = addMaterials(materials, upgradeCost({ ...item, level: 0 }, { worldLevel: level }))
  const retiredCount = target.retiredCount + source.retirees.length + source.retiredCount
  const projects = { ...world.projects, [toProjectId]: { ...target, chest, retiredCount } }
  delete projects[fromProjectId]
  const projectWorld = { ...save.projectWorld }
  delete projectWorld[fromProjectId]
  return { ...save, projectWorld, worlds: { ...save.worlds, [worldId]: { ...world, materials, projects } } }
}
