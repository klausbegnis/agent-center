// What an idle character gathers. The engine picks a trade for every character (Auto); a person
// may choose one for a room, and one for a character, which wins over the room's. Either choice
// may also be "what is scarcest" (scarcest.mjs), which the room resolves for its followers. Pure.
import { GATHERING_SKILLS, SCARCEST, TRADE_CHOICES } from './skills.mjs'
import { withCharacter, withProjectIn, worldIdOf } from './worlds.mjs'

export { SCARCEST, TRADE_CHOICES }

/**
 * A chosen trade as the engine keeps it: a gathering skill, SCARCEST, or null for none (Auto).
 * Anything else, such as a value from a damaged save, counts as no choice.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export const tradeChoiceOf = (value) => (TRADE_CHOICES.includes(value) ? value : null)

/**
 * The trade a character gathers: its own choice, else its room's, else the engine's own pick.
 * "What is scarcest" is the room's pick for it (`project.scarcest`), or its own Auto trade until
 * the room has made one.
 *
 * @param {{ sessionId?: string, trade?: string | null, tradeChoice?: string | null }} character
 * @param {{ tradeChoice?: string | null, scarcest?: { picks: Record<string, string> } }} project
 * @returns {string | null} null for a character from an old record that never had a trade
 */
export function effectiveTrade(character, project) {
  const choice = tradeChoiceOf(character.tradeChoice) ?? tradeChoiceOf(project.tradeChoice)
  if (choice !== SCARCEST) return choice ?? character.trade ?? null
  const picks = project.scarcest?.picks ?? {}
  const pick = Object.hasOwn(picks, character.sessionId) ? picks[character.sessionId] : null
  return GATHERING_SKILLS.includes(pick) ? pick : character.trade ?? null
}

/**
 * Why a character gathers what it does, for the Party tab: 'own' (its choice), 'room' (its room's),
 * 'scarcest' (the room's pick of what is scarcest) or 'auto' (the trade the game gave it).
 *
 * @param {{ tradeChoice?: string | null }} character
 * @param {{ tradeChoice?: string | null }} project
 * @returns {'own' | 'room' | 'scarcest' | 'auto'}
 */
export function tradeReason(character, project) {
  const own = tradeChoiceOf(character.tradeChoice)
  const choice = own ?? tradeChoiceOf(project.tradeChoice)
  if (choice === SCARCEST) return 'scarcest'
  if (own) return 'own'
  return choice ? 'room' : 'auto'
}

/** The project's world, or null when the project is not in the save or out of the game. */
function worldOfProject(save, projectId) {
  const worldId = worldIdOf(save, projectId)
  return worldId !== null && save.worlds[worldId]?.projects[projectId] ? worldId : null
}

/**
 * Sets the trade a living character gathers (a gathering skill or SCARCEST), or back to null
 * (its room's, else Auto). Unchanged when there is no such character, the trade is not a choice,
 * or nothing would change.
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
 * Sets the trade a room's characters gather when they have no choice of their own (a gathering
 * skill or SCARCEST), or back to null (Auto). Unchanged when the project is not in the save, the
 * trade is not a choice, or nothing would change.
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
