// What an idle character gathers. The engine picks a trade for every character (Auto); a person
// may choose one for a room, and one for a character, which wins over the room's. Pure.
import { GATHERING_SKILLS } from './skills.mjs'
import { withCharacter, withProjectIn, worldIdOf } from './worlds.mjs'

/**
 * A chosen trade as the engine keeps it: a gathering skill, or null for none (Auto). Anything
 * else, such as a value from a damaged save, counts as no choice.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export const tradeChoiceOf = (value) => (GATHERING_SKILLS.includes(value) ? value : null)

/**
 * The trade a character gathers: its own choice, else its room's, else the engine's own pick.
 *
 * @param {{ trade?: string | null, tradeChoice?: string | null }} character
 * @param {{ tradeChoice?: string | null }} project
 * @returns {string | null} null for a character from an old record that never had a trade
 */
export function effectiveTrade(character, project) {
  return tradeChoiceOf(character.tradeChoice) ?? tradeChoiceOf(project.tradeChoice) ?? character.trade ?? null
}

/** The project's world, or null when the project is not in the save or out of the game. */
function worldOfProject(save, projectId) {
  const worldId = worldIdOf(save, projectId)
  return worldId !== null && save.worlds[worldId]?.projects[projectId] ? worldId : null
}

/**
 * Sets the trade a living character gathers, or back to null (its room's, else Auto).
 * Unchanged when there is no such character, the trade is not a gathering skill, or nothing
 * would change.
 *
 * @param {object} save
 * @param {{ projectId: string, sessionId: string, trade: string | null }} choice
 * @returns {object}
 */
export function setCharacterTrade(save, { projectId, sessionId, trade }) {
  const worldId = worldOfProject(save, projectId)
  if (worldId === null || (trade !== null && tradeChoiceOf(trade) === null)) return save
  const world = save.worlds[worldId]
  const project = world.projects[projectId]
  const character = Object.hasOwn(project.characters, sessionId) ? project.characters[sessionId] : null
  if (!character || tradeChoiceOf(character.tradeChoice) === trade) return save
  const next = withProjectIn(world, projectId, withCharacter(project, { ...character, tradeChoice: trade }))
  return { ...save, worlds: { ...save.worlds, [worldId]: next } }
}

/**
 * Sets the trade a room's characters gather when they have no choice of their own, or back to
 * null (Auto). Unchanged when the project is not in the save, the trade is not a gathering
 * skill, or nothing would change.
 *
 * @param {object} save
 * @param {{ projectId: string, trade: string | null }} choice
 * @returns {object}
 */
export function setRoomTrade(save, { projectId, trade }) {
  const worldId = worldOfProject(save, projectId)
  if (worldId === null || (trade !== null && tradeChoiceOf(trade) === null)) return save
  const world = save.worlds[worldId]
  const project = world.projects[projectId]
  if (tradeChoiceOf(project.tradeChoice) === trade) return save
  const next = withProjectIn(world, projectId, { ...project, tradeChoice: trade })
  return { ...save, worlds: { ...save.worlds, [worldId]: next } }
}
