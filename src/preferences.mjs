// What the person chose and expects to find again: the default theme, the theme each room
// picked, and the rooms they hid. Kept in the plugin's own storage.

const DEFAULT_THEME = 'pixel-dark'
/**
 * The default theme's value when every room without a theme of its own should get one chosen
 * for it. The engine does the choosing and knows the same value: see RANDOM_THEME in
 * ui/engine/room-themes.js. No theme folder may use it as its name.
 */
export const RANDOM_THEME = 'random'
const KEYS = { theme: 'theme', roomThemes: 'roomThemes', hiddenRooms: 'hiddenRooms' }

/**
 * @param {{
 *   storage: { get: (key: string) => Promise<unknown>, set: (key: string, value: unknown) => Promise<unknown> },
 *   listThemeIds: () => string[],
 *   safe: <T>(label: string, run: () => T | Promise<T>, fallback?: T) => Promise<T>
 * }} dependencies
 */
export function createPreferences({ storage, listThemeIds, safe }) {
  let theme = DEFAULT_THEME
  /** @type {Record<string, string>} room id -> theme id */
  let roomThemes = {}
  /** @type {string[]} */
  let hiddenRooms = []

  const isTheme = (id) => typeof id === 'string' && listThemeIds().includes(id)
  const isDefaultChoice = (id) => id === RANDOM_THEME || isTheme(id)
  const save = (key, value) => safe(`storage.set ${key}`, () => storage.set(key, value))
  const read = (key) => safe(`storage.get ${key}`, () => storage.get(key), null)

  async function load() {
    const [savedTheme, savedRoomThemes, savedHidden] = await Promise.all([
      read(KEYS.theme),
      read(KEYS.roomThemes),
      read(KEYS.hiddenRooms)
    ])
    if (isDefaultChoice(savedTheme)) theme = savedTheme
    if (savedRoomThemes && typeof savedRoomThemes === 'object' && !Array.isArray(savedRoomThemes)) {
      roomThemes = Object.fromEntries(Object.entries(savedRoomThemes).map(([id, value]) => [id, String(value)]))
    }
    if (Array.isArray(savedHidden)) hiddenRooms = savedHidden.map(String)
  }

  /** @param {string} id a theme id, or RANDOM_THEME */
  async function setTheme(id) {
    if (!isDefaultChoice(id)) throw new Error(`unknown theme: ${id}`)
    theme = id
    await save(KEYS.theme, theme)
  }

  /** A null or unknown theme sends the room back to the default. A room cannot pick Random. */
  async function setRoomTheme(roomId, themeId) {
    const next = { ...roomThemes }
    if (isTheme(themeId)) next[String(roomId)] = themeId
    else delete next[String(roomId)]
    roomThemes = next
    await save(KEYS.roomThemes, roomThemes)
  }

  async function setRoomHidden(roomId, hidden) {
    const next = new Set(hiddenRooms)
    if (hidden) next.add(String(roomId))
    else next.delete(String(roomId))
    hiddenRooms = [...next]
    await save(KEYS.hiddenRooms, hiddenRooms)
  }

  return {
    load,
    setTheme,
    setRoomTheme,
    setRoomHidden,
    /** The part of the view state that comes from preferences. */
    snapshot: () => ({ theme, roomThemes, hidden: hiddenRooms })
  }
}
