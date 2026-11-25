// The trade pickers of the Arsenal's Party section as data: their choices, the value shown and
// whether they are offered at all. Never touches the DOM.
import { materialLabel, skillLabel, tradeMaterial } from './labels.js'
import { TRADES_TEXT } from './trade-labels.js'

/** The gathering skills in the game's order; the worker refuses any other. */
export const TRADES = ['mining', 'fishing', 'farming', 'woodcutting', 'hunting', 'runecraft']

/** The choice that follows the world's scarcest materials; the worker knows it by this id. */
export const SCARCEST = 'scarcest'

/** The value of the "no choice" entry of a picker: a trade id is never empty. */
export const NO_CHOICE = ''

const tradeChoices = () => [[SCARCEST, TRADES_TEXT.scarcest], ...TRADES.map((trade) => [trade, skillLabel(trade)])]
const isTrade = (value) => TRADES.includes(value)
const isChoice = (value) => isTrade(value) || value === SCARCEST

/**
 * The choices of a room's picker: Auto, "what is scarcest", then the six trades.
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
  let fallback = TRADES_TEXT.auto(isTrade(character.autoTrade) ? character.autoTrade : null)
  if (isTrade(roomChoice)) fallback = TRADES_TEXT.followRoom(roomChoice)
  if (roomChoice === SCARCEST) fallback = TRADES_TEXT.followScarcest
  return [[NO_CHOICE, fallback], ...tradeChoices()]
}

/** A picker's value for a choice from the view state: the trade or SCARCEST, or NO_CHOICE. */
export const pickerValue = (choice) => (isChoice(choice) ? choice : NO_CHOICE)

/** The choice to send for a picker's value: the trade or SCARCEST, or null for none. */
export const choiceOf = (value) => (isChoice(value) ? value : null)

/** The icon a picker shows for a choice: the trade's own, none for "what is scarcest" or none. */
export const choiceIcon = (choice) => (isTrade(choice) ? choice : null)

/**
 * The line under a character that follows "what is scarcest": what it gathers now and why, or
 * that it picks at the next round; '' for any other character.
 *
 * @param {{ trade?: string | null, tradeReason?: string }} character an entry of `game.characters`
 */
export function scarcestLine(character) {
  if (character.tradeReason !== SCARCEST) return ''
  const material = isTrade(character.trade) ? tradeMaterial(character.trade) : null
  return material ? TRADES_TEXT.scarcestNow(materialLabel(material)) : TRADES_TEXT.scarcestSoon
}

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
