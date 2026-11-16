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
 * @property {(worldId: string, skillId: string) => Promise<GameResult>} gamePrestige
 * @property {(roomId: string, itemId: string) => Promise<GameResult>} gameUpgradeItem
 * @property {(worldId: string, upgradeId: string) => Promise<GameResult>} gameBuyUpgrade
 * @property {(roomId: string, worldId: string | null) => Promise<GameResult>} gameAssignRoom puts a
 *   room in a world, or out of the game with null
 * @property {(worldId: string) => Promise<GameResult>} gameResetWorld
 * @property {(autoSpend: boolean) => Promise<GameResult>} gameSetAutoSpend
 * @property {(travel: boolean) => Promise<GameResult>} gameSetTravel turns "new scene after each
 *   monster" on or off
 * @property {(roomId: string, sessionId: string, trade: string | null) => Promise<GameResult>}
 *   gameSetCharacterTrade what a character gathers while idle; null follows its room
 * @property {(roomId: string, trade: string | null) => Promise<GameResult>} gameSetRoomTrade what a
 *   room's characters without a choice of their own gather; null is the engine's own pick
 * @property {(keepTitles: boolean) => Promise<GameResult>} gameSetKeepTitles
 * @property {() => Promise<object>} gameExportSave the saved game as a file's content
 * @property {(file: object) => Promise<GameResult>} gameImportSave replaces the whole game
 * @property {(fromRoomId: string, toRoomId: string) => Promise<GameResult>} gameMoveOrphanItems
 *   moves a room left behind's chest and retirees into a room on screen
 * @property {(worldId: string, cityId: string, materialId: string, amount: number) =>
 *   Promise<GameResult>} gameSellMaterial sells materials to a city for coins
 * @property {(worldId: string, cityId: string, fromId: string, toId: string, amount: number) =>
 *   Promise<GameResult>} gameTradeMaterial turns one material into another in a city
 * @property {(worldId: string, cityId: string, offerIndex: number, entryId: string, roomId: string) =>
 *   Promise<GameResult>} gameBuyStallOffer buys a piece of a city's stall into a room's chest
 */

/** @typedef {{ changed: boolean }} GameResult whether the action changed the game */

/** Text from a surface, or an error: ids are compared with what exists, never stored as given. */
function requireText(value, what) {
  if (typeof value !== 'string' || value === '' || value.length > 512) throw new Error(`invalid ${what}`)
  return value
}

function requireObject(value, what) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`invalid ${what}`)
  return value
}

/** A whole number: an amount or an index. The game checks its range against what exists. */
function requireWhole(value, what) {
  if (!Number.isInteger(value)) throw new Error(`invalid ${what}`)
  return value
}

function requireBoolean(value, what) {
  if (typeof value !== 'boolean') throw new Error(`invalid ${what}`)
  return value
}

/**
 * @param {{
 *   store: { snapshot: () => object },
 *   preferences: ReturnType<typeof import('./preferences.mjs').createPreferences>,
 *   snapshotSync: { sync: (options?: { remote?: boolean }) => Promise<void> },
 *   listThemes: () => { id: string, name: string }[],
 *   externalView: () => { url: string, lan: boolean } | null,
 *   openWorkspace: (workspaceId: string, agentId: string | null) => Promise<unknown>,
 *   game: ReturnType<typeof import('./game-mode.mjs').createGameMode>,
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
  game,
  onChange
}) {
  function getState() {
    const view = externalView()
    return {
      ...store.snapshot(),
      ...preferences.snapshot(),
      themes: listThemes(),
      webUrl: view?.url ?? null,
      lan: view?.lan ?? false,
      game: game.getView()
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

  /** Runs a game action and tells the surfaces when it changed something. */
  async function playAction(run) {
    const result = await run()
    if (result.changed) onChange()
    return result
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
    },
    gamePrestige: (worldId, skillId) => playAction(() =>
      game.prestigeSkill({ worldId: requireText(worldId, 'world'), skillId: requireText(skillId, 'skill') })),
    gameUpgradeItem: (roomId, itemId) => playAction(() =>
      game.upgradeItem({ roomId: requireText(roomId, 'room'), itemId: requireText(itemId, 'item') })),
    gameBuyUpgrade: (worldId, upgradeId) => playAction(() =>
      game.buyGroupUpgrade({ worldId: requireText(worldId, 'world'), upgradeId: requireText(upgradeId, 'upgrade') })),
    gameAssignRoom: (roomId, worldId) => playAction(() => game.assignRoom({
      roomId: requireText(roomId, 'room'),
      worldId: worldId === null ? null : requireText(worldId, 'world')
    })),
    gameResetWorld: (worldId) => playAction(() => game.resetWorld({ worldId: requireText(worldId, 'world') })),
    gameSetAutoSpend: (autoSpend) => playAction(() => game.setAutoSpend(requireBoolean(autoSpend, 'auto-spend'))),
    gameSetTravel: (travel) => playAction(() => game.setTravel(requireBoolean(travel, 'travel'))),
    gameSetCharacterTrade: (roomId, sessionId, trade) => playAction(() => game.setCharacterTrade({
      roomId: requireText(roomId, 'room'),
      sessionId: requireText(sessionId, 'session'),
      trade: trade === null ? null : requireText(trade, 'trade')
    })),
    gameSetRoomTrade: (roomId, trade) => playAction(() => game.setRoomTrade({
      roomId: requireText(roomId, 'room'),
      trade: trade === null ? null : requireText(trade, 'trade')
    })),
    gameSetKeepTitles: (keepTitles) => playAction(() => game.setKeepTitles(requireBoolean(keepTitles, 'keep-titles'))),
    gameExportSave: () => game.exportSave(),
    gameImportSave: (file) => playAction(() => game.importSave(requireObject(file, 'save file'))),
    gameMoveOrphanItems: (fromRoomId, toRoomId) => playAction(() => game.moveOrphanItems({
      fromRoomId: requireText(fromRoomId, 'room'),
      toRoomId: requireText(toRoomId, 'room')
    })),
    gameSellMaterial: (worldId, cityId, materialId, amount) => playAction(() => game.sellMaterial({
      worldId: requireText(worldId, 'world'),
      cityId: requireText(cityId, 'city'),
      materialId: requireText(materialId, 'material'),
      amount: requireWhole(amount, 'amount')
    })),
    gameTradeMaterial: (worldId, cityId, fromId, toId, amount) => playAction(() => game.tradeMaterial({
      worldId: requireText(worldId, 'world'),
      cityId: requireText(cityId, 'city'),
      fromId: requireText(fromId, 'material'),
      toId: requireText(toId, 'material'),
      amount: requireWhole(amount, 'amount')
    })),
    gameBuyStallOffer: (worldId, cityId, offerIndex, entryId, roomId) => playAction(() => game.buyStallOffer({
      worldId: requireText(worldId, 'world'),
      cityId: requireText(cityId, 'city'),
      offerIndex: requireWhole(offerIndex, 'offer'),
      entryId: requireText(entryId, 'offer'),
      roomId: requireText(roomId, 'room')
    }))
  }
}
