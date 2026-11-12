// The one set of operations every surface uses. The Orca panel reaches it through panel
// requests and the external view through HTTP, but both end up here, so they cannot drift apart.

/**
 * @typedef {object} Controller
 * @property {() => object} getState the full view state: rooms, counts, themes and preferences
 * @property {() => Promise<object>} refresh re-reads the running agents, then returns the state
 * @property {(themeId: string) => Promise<void>} setTheme sets the default theme: a theme id
 *   or RANDOM_THEME from preferences.mjs
 * @property {(roomId: string, themeId: string | null) => Promise<void>} setRoomTheme
 * @property {(roomId: string, hidden: boolean) => Promise<void>} setRoomHidden
 * @property {(workspaceId: string, agentId?: string | null) => Promise<void>} openWorkspace opens
 *   the workspace and, when the agent is named and its terminal is known, shows that terminal
 */

/**
 * @param {{
 *   store: { snapshot: () => object },
 *   preferences: ReturnType<typeof import('./preferences.mjs').createPreferences>,
 *   snapshotSync: { sync: (options?: { remote?: boolean }) => Promise<void> },
 *   listThemes: () => { id: string, name: string }[],
 *   externalView: () => { url: string, lan: boolean } | null,
 *   openWorkspace: (workspaceId: string, agentId: string | null) => Promise<unknown>,
 *   onChange: () => void
 * }} dependencies
 * @returns {Controller}
 */
export function createController({
  store,
  preferences,
  snapshotSync,
  listThemes,
  externalView,
  openWorkspace,
  onChange
}) {
  function getState() {
    const view = externalView()
    return {
      ...store.snapshot(),
      ...preferences.snapshot(),
      themes: listThemes(),
      webUrl: view?.url ?? null,
      lan: view?.lan ?? false
    }
  }

  /**
   * A setting can only be added for a room that exists, so stored preferences cannot be grown
   * with made-up ids. Clearing a setting is always allowed: the room may be gone by then.
   */
  function requireRoom(roomId) {
    const exists = store.snapshot().rooms.some((room) => room.id === roomId)
    if (!exists) throw new Error(`unknown room: ${String(roomId).slice(0, 80)}`)
  }

  return {
    getState,
    async refresh() {
      await snapshotSync.sync()
      onChange()
      return getState()
    },
    async setTheme(themeId) {
      await preferences.setTheme(themeId)
      onChange()
    },
    async setRoomTheme(roomId, themeId) {
      if (themeId) requireRoom(roomId)
      await preferences.setRoomTheme(roomId, themeId)
      onChange()
    },
    async setRoomHidden(roomId, hidden) {
      if (hidden) requireRoom(roomId)
      await preferences.setRoomHidden(roomId, hidden)
      onChange()
    },
    async openWorkspace(workspaceId, agentId = null) {
      await openWorkspace(workspaceId, agentId)
    }
  }
}
