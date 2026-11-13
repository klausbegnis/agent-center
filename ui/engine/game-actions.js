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
  'setTravel',
  'setKeepTitles',
  'exportSave',
  'importSave',
  'moveOrphanItems'
]

/** Actions that should change something; an answer of `{ changed: false }` is worth saying. */
const EXPECTS_CHANGE = new Set(['prestigeSkill', 'upgradeItem', 'buyGroupUpgrade', 'resetWorld', 'moveOrphanItems'])
/** Actions that answer with something to show instead of `{ changed }`. */
const GIVES_ANSWER = new Set(['exportSave'])
/** Actions the worker refuses for reasons a person can act on, such as a damaged file: say why. */
const SAYS_WHY = new Set(['exportSave', 'importSave', 'moveOrphanItems'])

/** The longest refusal reason shown; the worker's are a line. */
const REASON_LIMIT = 200

/**
 * The worker's reason for refusing, from the error a transport gives: its message without the
 * "Error:" prefixes a request across processes adds. '' when there is none.
 *
 * @param {unknown} error
 */
export function refusalReason(error) {
  const message = typeof error === 'string' ? error : String(error?.message ?? '')
  return message.replace(/^(?:\s*(?:Uncaught\s+)?Error:\s*)+/i, '').trim().slice(0, REASON_LIMIT)
}

/**
 * @param {Record<string, unknown>} transport
 * @param {(message: string, action: string) => void} onMessage shows a short message to the person;
 *   `action` names the action it is about, so the control that started it can show it too
 * @returns {Record<string, (...args: unknown[]) => Promise<unknown>>} the actions the surface
 *   offers; each resolves to whether it went through (or, for an export, its answer or null), and
 *   never rejects
 */
export function createGameActions(transport, onMessage) {
  const actions = {}
  for (const name of GAME_ACTION_METHODS) {
    if (typeof transport[name] !== 'function') continue
    actions[name] = async (...args) => {
      try {
        const answer = await transport[name](...args)
        if (GIVES_ANSWER.has(name)) return answer ?? null
        if (EXPECTS_CHANGE.has(name) && answer?.changed === false) {
          onMessage(gameActionUnchanged(name), name)
          return false
        }
        return true
      } catch (error) {
        console.error(`game: ${name} failed`, error)
        onMessage(gameActionFailed(name, SAYS_WHY.has(name) ? refusalReason(error) : ''), name)
        return GIVES_ANSWER.has(name) ? null : false
      }
    }
  }
  return actions
}
