// The scenes a travelling room walks through: when "new scene after each monster" is on, a room
// moves on to another theme with every kill. Each room has its own order of the themes, shuffled
// from a hash of its id, and steps through it with its kill count, so the scene is the same on
// every surface and after a restart, and every theme comes once before any comes again.
import { hashOf } from './hash.mjs'

/**
 * A room's order of the themes: the theme ids sorted, then shuffled by a hash of the room's id.
 *
 * @param {string} roomId
 * @param {string[]} themeIds the themes there are, in any order
 * @returns {string[]} each theme once
 */
export function sceneOrder(roomId, themeIds) {
  const order = [...new Set(themeIds)].sort()
  for (let index = order.length - 1; index > 0; index--) {
    const other = hashOf(`${roomId}|scene|${index}`) % (index + 1)
    ;[order[index], order[other]] = [order[other], order[index]]
  }
  return order
}

/**
 * The theme a room is in after a number of kills. Two kills in a row never share a scene while
 * there are two themes or more: the order is a cycle with no theme twice in it.
 *
 * @param {string} roomId
 * @param {string[]} themeIds the themes there are
 * @param {number} kills the room's kills so far
 * @returns {string | null} null when there is no theme
 */
export function sceneThemeOf(roomId, themeIds, kills) {
  const order = sceneOrder(roomId, themeIds)
  if (order.length === 0) return null
  const step = Number.isInteger(kills) && kills > 0 ? kills : 0
  return order[step % order.length]
}

/**
 * The themes a project travels through, from its readings: the first reading that carries them.
 *
 * @param {{ scenes?: string[] | null }[]} readings
 * @returns {string[] | null} null when the project does not travel
 */
export function scenesOf(readings) {
  const travelling = readings.find((reading) => Array.isArray(reading.scenes) && reading.scenes.length > 0)
  return travelling?.scenes ?? null
}

/**
 * A travelling project put in the scene of its kill count, so its next monster fits the scene.
 *
 * @param {{ kills?: number, themeId: string | null }} project
 * @param {string} projectId
 * @param {string[] | null} scenes the themes it travels through, or null when it does not travel
 */
export function inScene(project, projectId, scenes) {
  if (!scenes) return project
  const themeId = sceneThemeOf(projectId, scenes, project.kills ?? 0)
  return themeId === project.themeId ? project : { ...project, themeId }
}
