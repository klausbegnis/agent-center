// Which theme each room is drawn with: the one it picked, the default, or, when the default is
// Random, one chosen for it; in game mode with "new scene after each monster", a room that
// travels is in the scene the worker published for it. The choice is derived from room ids (and
// kills), never stored and never left to chance, so a room keeps its theme across reloads and
// across surfaces.
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
 * The scene each travelling room is in, from the game part of the view state. Empty unless the
 * game runs with "new scene after each monster" on.
 *
 * @param {{ game?: { status?: string, travel?: boolean,
 *   rooms?: Record<string, { sceneTheme?: string }> } }} state
 * @returns {Record<string, string>} room id -> theme id
 */
export function sceneThemesOf(state) {
  const game = state.game
  if (game?.status !== 'running' || game.travel !== true) return {}
  const scenes = {}
  for (const [roomId, room] of Object.entries(game.rooms ?? {})) {
    if (typeof room?.sceneTheme === 'string') scenes[roomId] = room.sceneTheme
  }
  return scenes
}

/**
 * Every theme that has to be loaded before the rooms can be drawn. While rooms travel that is
 * every theme, so the next scene is ready before the monster that leads to it dies.
 *
 * @param {{ theme: string, themes: { id: string }[], roomThemes?: Record<string, string>,
 *   game?: object }} state
 * @returns {string[]} only ids the plugin lists, each once
 */
export function themeIdsToLoad(state) {
  const known = state.themes.map((theme) => theme.id)
  const scenes = Object.values(sceneThemesOf(state))
  const travelling = scenes.length > 0 ? known : []
  const own = Object.values(state.roomThemes ?? {})
  const wanted = new Set([...defaultThemeIds(state), ...own, ...scenes, ...travelling])
  return [...wanted].filter((id) => known.includes(id))
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
 * A travelling room's scene (`sceneThemes`) wins over all of that once it is usable. It is laid
 * over the choice afterwards, so a room that travels never moves the themes of the rooms that do
 * not.
 *
 * @param {{ id: string }[]} rooms
 * @param {{
 *   defaultTheme: string,
 *   roomThemes?: Record<string, string>,
 *   sceneThemes?: Record<string, string>,
 *   usableThemeIds: string[]
 * }} choices `defaultTheme` is a theme id or RANDOM_THEME; `usableThemeIds` are the themes
 *   that loaded; `sceneThemes` comes from sceneThemesOf
 * @returns {Map<string, string>} room id -> theme id; under Random a room is left out when no
 *   theme is usable
 */
export function assignThemes(rooms, { defaultTheme, roomThemes = {}, sceneThemes = {}, usableThemeIds }) {
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
  for (const room of rooms) {
    const scene = sceneThemes[room.id]
    if (scene && uses.has(scene)) assigned.set(room.id, scene)
  }
  return assigned
}
