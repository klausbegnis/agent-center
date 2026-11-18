// Trait scrolls and teaching: a room keeps scrolls in its chest (`scrolls`, by trait, a few copies
// each), a scroll teaches its trait to a character with a free slot, scrolls go to another room of
// the world, and a kill of an elite, a champion or a boss now and then drops one. A world keeps the
// traits it has ever had (`traits.known`): the collection. Pure.
import { rankOf } from './monsters.mjs'
import { chanceOf } from './hash.mjs'
import { sharedWorldId } from './orphans.mjs'
import { SCROLL_COPIES, SCROLL_DROP_CHANCE, SCROLL_TIER_WEIGHTS } from './trait-constants.mjs'
import { bornTrait, pickTier, pickTrait, traitSlots, traitsOf } from './trait-effects.mjs'
import { worldIdOf } from './worlds.mjs'

/** @typedef {import('./trait-content.mjs').TraitIndex} TraitIndex */

/** Why a trait choice is refused, in words a person can act on. */
export const TRAIT_REFUSALS = Object.freeze({
  noTraits: 'this game has no traits',
  noRoom: 'that room does not play',
  noCharacter: 'that character is not in the room',
  noScroll: 'the chest holds no scroll of that trait',
  noSlot: 'that character has no free trait slot; swap one instead',
  carries: 'that character already carries this trait',
  notCarried: 'that character does not carry that trait',
  chestFull: `the chest already keeps ${SCROLL_COPIES} scrolls of that trait`,
  sameRoom: 'it is already in that room',
  otherWorld: 'the two rooms do not play in the same world'
})

/**
 * The scrolls a room keeps, by trait id.
 *
 * @param {{ scrolls?: Record<string, number> }} project
 * @returns {Record<string, number>}
 */
export const scrollsOf = (project) => {
  const scrolls = project?.scrolls
  return typeof scrolls === 'object' && scrolls !== null && !Array.isArray(scrolls) ? scrolls : {}
}

/** The project with these scrolls: the field is left out when it holds none. */
export function withScrolls(project, scrolls) {
  const kept = Object.fromEntries(Object.entries(scrolls).filter(([, count]) => count > 0).sort(([a], [b]) => a.localeCompare(b)))
  const { scrolls: _old, ...rest } = project
  return Object.keys(kept).length ? { ...rest, scrolls: kept } : rest
}

/** Whether a room can take one more scroll of a trait. */
export const hasRoomFor = (project, traitId) => (scrollsOf(project)[traitId] ?? 0) < SCROLL_COPIES

/**
 * Adds scrolls to a room, up to SCROLL_COPIES of each trait. The ids that did not fit come back.
 *
 * @param {object} project
 * @param {string[]} traitIds
 * @returns {{ project: object, overflow: string[] }}
 */
export function addScrolls(project, traitIds) {
  const scrolls = { ...scrollsOf(project) }
  const overflow = []
  for (const traitId of traitIds) {
    if ((scrolls[traitId] ?? 0) >= SCROLL_COPIES) overflow.push(traitId)
    else scrolls[traitId] = (scrolls[traitId] ?? 0) + 1
  }
  return { project: withScrolls(project, scrolls), overflow }
}

/** The room without one scroll of a trait it keeps. */
export function takeScroll(project, traitId) {
  const scrolls = scrollsOf(project)
  return withScrolls(project, { ...scrolls, [traitId]: (scrolls[traitId] ?? 0) - 1 })
}

/**
 * The traits a person taught a character, as opposed to the one it was born with: what goes back
 * to the chest as scrolls when it retires.
 *
 * @param {object} character
 * @param {TraitIndex} index
 * @returns {string[]}
 */
export function taughtTraits(character, index) {
  if (!Array.isArray(character?.traits)) return []
  const born = bornTrait(character.sessionId, index)
  return traitsOf(character, index).filter((id) => id !== born)
}

/** The project and character a choice names, or the reason there are none. */
function placeOf(save, { projectId, sessionId }) {
  const worldId = worldIdOf(save, projectId)
  const project = worldId === null ? null : save.worlds[worldId]?.projects[projectId]
  if (!project) return { problem: TRAIT_REFUSALS.noRoom }
  const character = Object.hasOwn(project.characters, sessionId) ? project.characters[sessionId] : null
  if (!character) return { problem: TRAIT_REFUSALS.noCharacter }
  return { worldId, project, character }
}

/** The save with one project of a world replaced. */
function withProject(save, worldId, projectId, project) {
  const world = save.worlds[worldId]
  return { ...save, worlds: { ...save.worlds, [worldId]: { ...world, projects: { ...world.projects, [projectId]: project } } } }
}

/**
 * Why a scroll cannot teach its trait to a character, or null when it can.
 *
 * @param {object} save
 * @param {{ projectId: string, sessionId: string, traitId: string }} choice
 * @param {TraitIndex | null} index
 * @returns {string | null}
 */
export function teachProblem(save, choice, index) {
  if (!index) return TRAIT_REFUSALS.noTraits
  const place = placeOf(save, choice)
  if (place.problem) return place.problem
  if (!index.byId.has(choice.traitId) || !(scrollsOf(place.project)[choice.traitId] > 0)) return TRAIT_REFUSALS.noScroll
  const carried = traitsOf(place.character, index)
  if (carried.includes(choice.traitId)) return TRAIT_REFUSALS.carries
  if (carried.length >= traitSlots(place.character.level)) return TRAIT_REFUSALS.noSlot
  return null
}

/**
 * Teaches a character the trait of a scroll in its room's chest, into a free slot. The scroll is
 * used up. The same save when refused (`teachProblem` says why).
 *
 * @param {object} save
 * @param {{ projectId: string, sessionId: string, traitId: string }} choice
 * @param {TraitIndex | null} index
 * @returns {object}
 */
export function teachTrait(save, choice, index) {
  if (teachProblem(save, choice, index) !== null) return save
  const { worldId, project, character } = placeOf(save, choice)
  const taught = { ...character, traits: [...traitsOf(character, index), choice.traitId] }
  const next = takeScroll({ ...project, characters: { ...project.characters, [character.sessionId]: taught } }, choice.traitId)
  return withProject(save, worldId, choice.projectId, next)
}

/**
 * Why scrolls cannot go to another room, or null when they can.
 *
 * @param {object} save
 * @param {{ fromProjectId: string, toProjectId: string, traitId: string }} sending
 * @returns {string | null}
 */
export function sendScrollProblem(save, { fromProjectId, toProjectId, traitId }) {
  if (fromProjectId === toProjectId) return TRAIT_REFUSALS.sameRoom
  const worldId = sharedWorldId(save, fromProjectId, toProjectId)
  if (worldId === null) return TRAIT_REFUSALS.otherWorld
  const { projects } = save.worlds[worldId]
  if (!(scrollsOf(projects[fromProjectId])[traitId] > 0)) return TRAIT_REFUSALS.noScroll
  if (!hasRoomFor(projects[toProjectId], traitId)) return TRAIT_REFUSALS.chestFull
  return null
}

/**
 * Sends one scroll to another room of the same world, as an item is sent. The same save when refused.
 *
 * @param {object} save
 * @param {{ fromProjectId: string, toProjectId: string, traitId: string }} sending
 * @returns {object}
 */
export function sendScroll(save, sending) {
  if (sendScrollProblem(save, sending) !== null) return save
  const { fromProjectId, toProjectId, traitId } = sending
  const worldId = sharedWorldId(save, fromProjectId, toProjectId)
  const world = save.worlds[worldId]
  const from = takeScroll(world.projects[fromProjectId], traitId)
  const to = addScrolls(world.projects[toProjectId], [traitId]).project
  const projects = { ...world.projects, [fromProjectId]: from, [toProjectId]: to }
  return { ...save, worlds: { ...save.worlds, [worldId]: { ...world, projects } } }
}

/**
 * The trait scroll a kill drops, or null: only elites, champions and bosses drop one, with
 * SCROLL_DROP_CHANCE by rank times (1 + scrollFind), a tier by SCROLL_TIER_WEIGHTS and a trait of
 * it by hash of the kill's seed. A trait the room keeps SCROLL_COPIES of already is passed over.
 *
 * @param {{ monster: object, seed: string, scrollFind?: number, project: object }} kill
 * @param {TraitIndex | null} index
 * @returns {string | null}
 */
export function rollScrollDrop({ monster, seed, scrollFind = 0, project }, index) {
  const rank = rankOf(monster)
  if (!index || !Object.hasOwn(SCROLL_DROP_CHANCE, rank)) return null
  if (chanceOf(`${seed}|scroll`) >= SCROLL_DROP_CHANCE[rank] * (1 + scrollFind)) return null
  const tier = pickTier(SCROLL_TIER_WEIGHTS[rank], `${seed}|scroll-tier`)
  return pickTrait(index, tier, `${seed}|scroll-trait`, (entry) => hasRoomFor(project, entry.id))?.id ?? null
}

/**
 * Puts the scroll a kill drops, if any, in the fight's working copy of the room (see
 * `rollScrollDrop`), and answers its trait id or null.
 *
 * @param {object} state the fight's copy of the project, changed in place
 * @param {{ monster: object, seed: string, scrollFind?: number }} kill
 * @param {TraitIndex | null} index
 * @returns {string | null}
 */
export function settleScrollDrop(state, { monster, seed, scrollFind = 0 }, index) {
  const traitId = rollScrollDrop({ monster, seed, scrollFind, project: state }, index)
  if (traitId) state.scrolls = addScrolls(state, [traitId]).project.scrolls
  return traitId
}

/**
 * Every trait a world has now: carried by its characters, born to its retirees, kept as scrolls.
 *
 * @param {object} world
 * @param {TraitIndex} index
 * @returns {Set<string>}
 */
function traitsInWorld(world, index) {
  const found = new Set()
  for (const project of Object.values(world.projects)) {
    for (const character of Object.values(project.characters)) for (const id of traitsOf(character, index)) found.add(id)
    for (const retiree of project.retirees ?? []) {
      const born = typeof retiree.sessionId === 'string' ? bornTrait(retiree.sessionId, index) : null
      if (born) found.add(born)
    }
    for (const id of Object.keys(scrollsOf(project))) if (index.byId.has(id)) found.add(id)
  }
  return found
}

/**
 * The traits a world has collected: those it ever had, and any it has now that the record does not
 * hold yet (the next advance writes them down).
 *
 * @param {object} world
 * @param {TraitIndex} index
 * @returns {string[]} sorted
 */
export function collectedTraits(world, index) {
  const found = traitsInWorld(world, index)
  for (const id of traitRecordOf(world).known) if (index.byId.has(id)) found.add(id)
  return [...found].sort()
}

/**
 * The world's trait record: the traits it ever had (`known`) and its brokers' sales of the day.
 *
 * @param {{ traits?: { known?: string[], sold?: object } }} world
 */
export const traitRecordOf = (world) => ({ known: world?.traits?.known ?? [], sold: world?.traits?.sold ?? {} })

/** The world with this trait record; the field is left out while it holds nothing. */
export function withTraitRecord(world, record) {
  const { traits: _old, ...rest } = world
  const known = [...record.known].sort()
  const sold = record.sold ?? {}
  if (known.length === 0 && Object.keys(sold).length === 0) return rest
  return { ...rest, traits: { known, ...(Object.keys(sold).length ? { sold } : {}) } }
}

/**
 * The save with every world's collection brought up to what it has now: a new character's born
 * trait, a scroll found or bought. A save from before traits starts its collection from its living
 * characters, its kept retirees and its scrolls. The same save when nothing is new.
 *
 * @param {object} save
 * @param {TraitIndex | null} index
 * @returns {object}
 */
export function withKnownTraits(save, index) {
  if (!index) return save
  let worlds = null
  for (const [worldId, world] of Object.entries(save.worlds)) {
    const record = traitRecordOf(world)
    const known = new Set(record.known)
    const fresh = [...traitsInWorld(world, index)].filter((id) => !known.has(id))
    if (fresh.length === 0) continue
    worlds ??= { ...save.worlds }
    worlds[worldId] = withTraitRecord(world, { ...record, known: [...known, ...fresh] })
  }
  return worlds ? { ...save, worlds } : save
}
