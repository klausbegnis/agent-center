// The trade pickers of the Arsenal's Party section as data: their choices, the value shown and
// whether they are offered at all. Never touches the DOM.
import { skillLabel } from './labels.js'
import { TRADES_TEXT } from './trade-labels.js'

/** The gathering skills in the game's order; the worker refuses any other. */
export const TRADES = ['mining', 'fishing', 'farming', 'woodcutting', 'hunting', 'runecraft']

/** The value of the "no choice" entry of a picker: a trade id is never empty. */
export const NO_CHOICE = ''

const tradeChoices = () => TRADES.map((trade) => [trade, skillLabel(trade)])
const isTrade = (value) => TRADES.includes(value)

/**
 * The choices of a room's picker: Auto, then the six trades.
 *
 * @returns {[value: string, label: string][]}
 */
export function roomTradeOptions() {
  return [[NO_CHOICE, TRADES_TEXT.roomAuto], ...tradeChoices()]
}

/**
 * The choices of a character's picker. Its "no choice" entry says what it falls back to: the
 * room's trade when the room has one, otherwise the trade the game gave it.
 *
 * @param {{ autoTrade?: string | null }} character an entry of the view state's `game.characters`
 * @param {string | null | undefined} roomChoice the room's `tradeChoice`
 * @returns {[value: string, label: string][]}
 */
export function characterTradeOptions(character, roomChoice) {
  const fallback = isTrade(roomChoice)
    ? TRADES_TEXT.followRoom(roomChoice)
    : TRADES_TEXT.auto(isTrade(character.autoTrade) ? character.autoTrade : null)
  return [[NO_CHOICE, fallback], ...tradeChoices()]
}

/** A picker's value for a choice from the view state: the trade, or NO_CHOICE. */
export const pickerValue = (choice) => (isTrade(choice) ? choice : NO_CHOICE)

/** The choice to send for a picker's value: the trade, or null for none. */
export const choiceOf = (value) => (isTrade(value) ? value : null)

/**
 * Whether the trade pickers are offered: not on a page that only watches, and only when the
 * surface can send both choices.
 *
 * @param {{ viewOnly?: boolean } | null | undefined} game
 * @param {Record<string, unknown>} actions
 */
export function canChooseTrades(game, actions) {
  return game?.viewOnly !== true && typeof actions.setCharacterTrade === 'function' &&
    typeof actions.setRoomTrade === 'function'
}
