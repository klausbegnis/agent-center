// The checks of an imported save that look at it as a whole: which keys may name things, the
// worlds' ids and number, and which world holds each project. The engine never writes a save that
// fails one, so a file that does was made by hand or damaged. Pure.
import { MAX_WORLDS, isWorldId } from './world-ids.mjs'
import { DEFAULT_WORLD } from './worlds.mjs'

/** Keys that reach an object's prototype when written to. No id the engine makes is one. */
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** @param {string} key */
export const isReservedKey = (key) => RESERVED_KEYS.has(key)

/**
 * The first problem with how the save's projects are spread over its worlds, as the path to it
 * and what is wrong, or null. A world is named by `worlds` or by `projectWorld`: a room put in a
 * new world names it before its first tokens create it. A project lives in one world, the one
 * `projectWorld` gives it (`main` when it gives none), or in any one world while it is out of the
 * game (null), where its data waits in case it comes back.
 *
 * @param {Record<string, { projects: Record<string, object> }>} worlds
 * @param {Record<string, string | null>} projectWorld
 * @returns {[string, string] | null}
 */
export function worldLayoutProblem(worlds, projectWorld) {
  const named = new Set([...Object.keys(worlds), ...Object.values(projectWorld).filter((worldId) => worldId !== null)])
  for (const worldId of named) {
    if (!isWorldId(worldId)) return [`the world ${worldId.slice(0, 40)}`, 'is not a world name']
  }
  if (named.size > MAX_WORLDS) return ['worlds', `are more than the ${MAX_WORLDS} there can be`]
  const seen = new Set()
  for (const [worldId, world] of Object.entries(worlds)) {
    for (const projectId of Object.keys(world.projects)) {
      const path = `worlds.${worldId}.projects.${projectId}`
      if (seen.has(projectId)) return [path, 'is in two worlds']
      seen.add(projectId)
      const ownWorldId = Object.hasOwn(projectWorld, projectId) ? projectWorld[projectId] : DEFAULT_WORLD
      if (ownWorldId !== null && ownWorldId !== worldId) return [path, `is not in its own world, ${ownWorldId}`]
    }
  }
  return null
}
