// The game's actions as the controls call them. Each exists only when the surface offers it, and
// a refused or failed action becomes a short message instead of an unhandled rejection.
import { gameActionFailed, gameActionUnchanged } from './labels.js'

/** The optional transport methods of the game, named after what they do. */
export const GAME_ACTION_METHODS = [
  'prestigeSkill',
  'upgradeItem',
  'buyGroupUpgrade',
  'moveRoomToWorld',
  'resetWorld',
  'setAutoSpend',
  'setKeepTitles'
]

/** Actions that should change something; an answer of `{ changed: false }` is worth saying. */
const EXPECTS_CHANGE = new Set(['prestigeSkill', 'upgradeItem', 'buyGroupUpgrade', 'resetWorld'])

/**
 * @param {Record<string, unknown>} transport
 * @param {(message: string) => void} onMessage shows a short message to the person
 * @returns {Record<string, (...args: unknown[]) => Promise<boolean>>} the actions the surface
 *   offers; each resolves to whether it went through, and never rejects
 */
export function createGameActions(transport, onMessage) {
  const actions = {}
  for (const name of GAME_ACTION_METHODS) {
    if (typeof transport[name] !== 'function') continue
    actions[name] = async (...args) => {
      try {
        const answer = await transport[name](...args)
        if (EXPECTS_CHANGE.has(name) && answer?.changed === false) {
          onMessage(gameActionUnchanged(name))
          return false
        }
        return true
      } catch (error) {
        console.error(`game: ${name} failed`, error)
        onMessage(gameActionFailed(name))
        return false
      }
    }
  }
  return actions
}
