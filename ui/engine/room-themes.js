// Which theme each room is drawn with: the one it picked, the default, or, when the default is
// Random, one chosen for it. The choice is derived from room ids, never stored and never left to
// chance, so a room keeps its theme across reloads and across surfaces.
import { hash } from './hash.js'

/**
 * The value the default theme has when every room without a theme of its own should get one
 * chosen for it. The worker stores and reports the same value: see RANDOM_THEME in
 * src/preferences.mjs. No theme folder may use it as its name.
 */
export const RANDOM_THEME = 'random'

/**
 * The themes rooms without a theme of their own can end up with.
 *
 * @param {{ theme: string, themes: { id: string }[] }} state the view state
 * @returns {string[]}
 */
export function defaultThemeIds(state) {
  return state.theme === RANDOM_THEME ? state.themes.map((theme) => theme.id) : [state.theme]
}

/**
 * Every theme that has to be loaded before the rooms can be drawn.
 *
 * @param {{ theme: string, themes: { id: string }[], roomThemes?: Record<string, string> }} state
 * @returns {string[]} only ids the plugin lists, each once
 */
export function themeIdsToLoad(state) {
  const known = new Set(state.themes.map((theme) => theme.id))
  const wanted = new Set([...defaultThemeIds(state), ...Object.values(state.roomThemes ?? {})])
  return [...wanted].filter((id) => known.has(id))
}

/**
 * The least used theme, starting the search at the one the room's id points to. Rooms therefore
 * get different themes while there are enough, and repeats stay as even as possible after that.
 */
function leastUsedTheme(roomId, themeIds, uses) {
  const start = hash(roomId) % themeIds.length
  let best = themeIds[start]
  for (let step = 1; step < themeIds.length; step++) {
    const candidate = themeIds[(start + step) % themeIds.length]
    if (uses.get(candidate) < uses.get(best)) best = candidate
  }
  return best
}

/**
 * The theme of every room. A room that picked a usable theme keeps it. The others get the
 * default or, when the default is Random, a theme each: rooms are walked in a fixed order and
 * each takes the least used theme so far, counting the ones rooms picked themselves. Pass every
 * room, hidden ones too, so hiding a room does not change the others.
 *
 * @param {{ id: string }[]} rooms
 * @param {{
 *   defaultTheme: string,
 *   roomThemes?: Record<string, string>,
 *   usableThemeIds: string[]
 * }} choices `defaultTheme` is a theme id or RANDOM_THEME; `usableThemeIds` are the themes
 *   that loaded
 * @returns {Map<string, string>} room id -> theme id; under Random a room is left out when no
 *   theme is usable
 */
export function assignThemes(rooms, { defaultTheme, roomThemes = {}, usableThemeIds }) {
  const themeIds = [...usableThemeIds].sort()
  const assigned = new Map()
  const uses = new Map(themeIds.map((id) => [id, 0]))
  const use = (room, themeId) => {
    assigned.set(room.id, themeId)
    if (uses.has(themeId)) uses.set(themeId, uses.get(themeId) + 1)
  }

  const undecided = []
  for (const room of [...rooms].sort((a, b) => a.id.localeCompare(b.id))) {
    const own = roomThemes[room.id]
    if (own && uses.has(own)) use(room, own)
    else if (defaultTheme !== RANDOM_THEME) use(room, defaultTheme)
    else undecided.push(room)
  }
  if (themeIds.length === 0) return assigned
  for (const room of undecided) use(room, leastUsedTheme(room.id, themeIds, uses))
  return assigned
}
