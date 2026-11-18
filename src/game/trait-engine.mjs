// The traits' part of the engine (engine.mjs spreads it in): teaching, swapping, the broker and
// sending scrolls, each with the function that says why it is refused, and the wrappers that keep
// taught traits when a character retires or a room left behind is moved. Pure.
import { MARKET_MAX_COINS } from './constants.mjs'
import { sharedWorldId } from './orphans.mjs'
import { worldLevel } from './progression.mjs'
import {
  buyScroll,
  buyScrollProblem,
  scrollSalePrice,
  sellScroll,
  sellScrollProblem,
  swapProblem,
  swapTrait
} from './trait-broker.mjs'
import { traitIndexOf } from './trait-content.mjs'
import {
  addScrolls,
  scrollsOf,
  sendScroll,
  sendScrollProblem,
  taughtTraits,
  teachProblem,
  teachTrait,
  withKnownTraits
} from './traits.mjs'
import { worldIdOf } from './worlds.mjs'

/** @typedef {import('./trait-content.mjs').TraitIndex} TraitIndex */

/** The world with scrolls that found no room sold to the broker, for coins. */
function sellOverflow(world, overflow, index) {
  if (overflow.length === 0) return world
  const level = worldLevel(world.skills)
  const coins = overflow.reduce((sum, id) => sum + scrollSalePrice(index.byId.get(id).tier, level), world.coins ?? 0)
  return { ...world, coins: Math.min(MARKET_MAX_COINS, coins) }
}

/** The save with scrolls added to a room, those past the copies kept sold. */
function giveScrolls(save, worldId, projectId, traitIds, index) {
  const world = save.worlds[worldId]
  const added = addScrolls(world.projects[projectId], traitIds)
  const next = sellOverflow({ ...world, projects: { ...world.projects, [projectId]: added.project } }, added.overflow, index)
  return { ...save, worlds: { ...save.worlds, [worldId]: next } }
}

/**
 * Retires a session's character as `closeSession` does, and puts the traits a person taught it back
 * in the room's chest as scrolls, as its items go back. Its born trait stays its own: a session
 * that comes back is born with it again.
 *
 * @param {(save: object, closing: object) => object} closeSession
 * @param {TraitIndex | null} index
 */
export function closeSessionKeepingTraits(closeSession, index) {
  return (save, closing) => {
    const worldId = worldIdOf(save, closing.projectId)
    const character = worldId === null ? null : save.worlds[worldId]?.projects[closing.projectId]?.characters[closing.sessionId]
    const closed = closeSession(save, closing)
    const taught = index && character ? taughtTraits(character, index) : []
    if (closed === save || taught.length === 0) return closed
    return giveScrolls(closed, worldId, closing.projectId, taught, index)
  }
}

/**
 * Moves a room left behind into another as `moveProjectItems` does, and its scrolls and the traits
 * taught to its characters (who retire on the way) go to the target's chest too.
 *
 * @param {(save: object, move: object) => object} moveProjectItems
 * @param {TraitIndex | null} index
 */
export function moveKeepingTraits(moveProjectItems, index) {
  return (save, move) => {
    const worldId = sharedWorldId(save, move.fromProjectId, move.toProjectId)
    const moved = moveProjectItems(save, move)
    if (!index || worldId === null || moved === save) return moved
    const source = save.worlds[worldId].projects[move.fromProjectId]
    const scrolls = Object.entries(scrollsOf(source)).flatMap(([id, count]) => Array(count).fill(id))
    const taught = Object.values(source.characters).flatMap((character) => taughtTraits(character, index))
    const carried = [...scrolls, ...taught].filter((id) => index.byId.has(id))
    if (carried.length === 0) return moved
    return giveScrolls(moved, worldId, move.toProjectId, carried, index)
  }
}

/**
 * A world's change applied to an existing world: the same save when it is missing or unchanged.
 */
function inWorld(save, worldId, change) {
  const world = Object.hasOwn(save.worlds, worldId) ? save.worlds[worldId] : null
  if (!world) return save
  const next = change(world)
  return next === world ? save : { ...save, worlds: { ...save.worlds, [worldId]: next } }
}

/**
 * The engine's trait functions over a set of content.
 *
 * @param {object} content the game content; without `traits` every action is refused
 */
export function traitActions(content) {
  const index = traitIndexOf(content)
  const cities = content.cities?.cities ?? []
  const known = (save) => withKnownTraits(save, index)
  /** A change that went through, with the collection brought up to date; a refused one untouched. */
  const noting = (save, next) => (next === save ? save : known(next))
  const context = (worldId) => ({ worldId, cities, index })
  return {
    /** Teaches a character a scroll's trait into a free slot (traits.mjs). */
    teachTrait: (save, choice) => noting(save, teachTrait(save, choice, index)),
    teachProblem: (save, choice) => teachProblem(save, choice, index),
    /** Swaps a carried trait for a scroll; the old one comes back as a scroll for a fee (trait-broker.mjs). */
    swapTrait: (save, swap) => noting(save, swapTrait(save, swap, index)),
    swapProblem: (save, swap) => swapProblem(save, swap, index),
    buyTraitScroll: (save, { worldId, ...purchase }) => inWorld(save, worldId, (world) => buyScroll(world, context(worldId), purchase)),
    buyScrollProblem: (save, { worldId, ...purchase }) => (Object.hasOwn(save.worlds, worldId)
      ? buyScrollProblem(save.worlds[worldId], context(worldId), purchase) : 'unknown world'),
    sellTraitScroll: (save, { worldId, ...sale }) => inWorld(save, worldId, (world) => sellScroll(world, context(worldId), sale)),
    sellScrollProblem: (save, { worldId, ...sale }) => (Object.hasOwn(save.worlds, worldId)
      ? sellScrollProblem(save.worlds[worldId], context(worldId), sale) : 'unknown world'),
    sendScroll,
    sendScrollProblem,
    /** The world's collections brought up to date: run after an advance, which may drop scrolls. */
    noteKnownTraits: known,
    /** A trait's name as the view gives it; the id when unknown. */
    traitName: (traitId) => index?.byId.get(traitId)?.name ?? traitId
  }
}
