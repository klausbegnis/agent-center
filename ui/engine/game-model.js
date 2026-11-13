// What the game part of the view state means for the screen: whether the game shows, which tab
// is open, and the facts each part draws, picked out of the state. Never touches the DOM.

/** The game's tabs, in the order they are shown. */
export const GAME_TABS = /** @type {const} */ (['rooms', 'arsenal', 'skills'])
const DEFAULT_TAB = 'rooms'

/**
 * How the game shows: not at all (`off`), in full (`running`), or as tabs that explain why it
 * cannot run (`unavailable`, for any other status, including ones this UI does not know).
 *
 * @param {{ status?: string } | undefined} game the view state's `game`, absent from older workers
 * @returns {'off' | 'running' | 'unavailable'}
 */
export function gameModeOf(game) {
  const status = game?.status ?? 'off'
  if (status === 'off') return 'off'
  if (status === 'running' && game.worlds && game.rooms) return 'running'
  return 'unavailable'
}

/** A saved or asked-for tab when it is one of GAME_TABS, otherwise the rooms. */
export function tabOrDefault(value) {
  return GAME_TABS.includes(value) ? value : DEFAULT_TAB
}

/** The tab a key press moves to in the tab list, or null for a key the tabs ignore. */
export function tabAfterKey(current, key) {
  const index = GAME_TABS.indexOf(current)
  if (key === 'ArrowRight') return GAME_TABS[(index + 1) % GAME_TABS.length]
  if (key === 'ArrowLeft') return GAME_TABS[(index - 1 + GAME_TABS.length) % GAME_TABS.length]
  if (key === 'Home') return GAME_TABS[0]
  if (key === 'End') return GAME_TABS[GAME_TABS.length - 1]
  return null
}

/** Whether progress is estimated from working time rather than measured in tokens. */
export function isEstimated(game) {
  return game?.tokenSource === 'estimated'
}
