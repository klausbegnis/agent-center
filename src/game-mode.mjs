// The bridge between the plugin and the game engine. Each round it reads the session history,
// turns token totals into readings for the rooms on screen, moves the engine forward, keeps the
// save, and builds the game part of the view state. Every Orca call comes in as a function, so
// the demo and the tests run it without Orca.
import { readTokenDeltas } from './domain/game-tokens.mjs'
import { buildReadings, mainAgents, matchSessions, placeSessions, sessionsToClose } from './domain/game-sessions.mjs'
import { buildGameView, gameStatus, keepRecent } from './domain/game-view.mjs'
import { createGameActions } from './game-actions.mjs'
import { emptyBridge } from './game-save.mjs'
import { DEFAULT_WORLD } from './game/worlds.mjs'
import { RANDOM_THEME } from './preferences.mjs'

/**
 * The longest stretch of time one round moves the engine. A round that comes late (the computer
 * slept) does not fight through time nobody saw with the states read now.
 */
export const MAX_ROUND_GAP_MS = 5 * 60_000

/**
 * @typedef {import('./domain/game-view.mjs').GameStatus} GameStatus
 * @typedef {{ ok: true, sessions: object[], truncated: boolean } | { ok: false, denied: boolean,
 *   message: string }} HistoryReading
 */

/** Every living character of the save, with where it lives. */
function livingCharacters(save) {
  const characters = []
  for (const world of Object.values(save.worlds)) {
    for (const [projectId, project] of Object.entries(world.projects)) {
      for (const character of Object.values(project.characters)) {
        characters.push({ projectId, sessionId: character.sessionId, lastSeenAt: character.lastSeenAt ?? null })
      }
    }
  }
  return characters
}

/** Each living character's level, to see who levelled up. */
function levelsOf(save) {
  const levels = new Map()
  for (const world of Object.values(save.worlds)) {
    for (const [projectId, project] of Object.entries(world.projects)) {
      for (const character of Object.values(project.characters)) {
        levels.set(`${projectId}|${character.sessionId}`, character.level)
      }
    }
  }
  return levels
}

/**
 * @param {{
 *   engine: ReturnType<typeof import('./game/engine.mjs').createEngine>,
 *   gameSave: ReturnType<typeof import('./game-save.mjs').createGameSave>,
 *   readSettings: () => Promise<Record<string, unknown>>,
 *   writeSetting: (key: string, value: unknown) => Promise<unknown>,
 *   access: () => { supported: boolean, granted: boolean },
 *   readHistory: () => Promise<HistoryReading>,
 *   readWorkspaces: () => Promise<{ id: string, path: string, hostId: string | null }[]>,
 *   store: { snapshot: () => { rooms: object[] }, sessionLinks: () => Record<string, string>,
 *     describeWorkspaces: () => object[] },
 *   preferences: { snapshot: () => { theme: string, roomThemes: Record<string, string> } },
 *   now?: () => number,
 *   log: (message: string) => void,
 *   onChange: () => void
 * }} dependencies
 */
export function createGameMode(dependencies) {
  const { engine, gameSave, readSettings, writeSetting, access, readHistory, readWorkspaces } = dependencies
  const { store, preferences, now = Date.now, log, onChange } = dependencies
  let status = /** @type {GameStatus} */ ('off')
  let keepTitles = false
  let isDenied = false
  let lastRoundAt = null
  let links = new Map()
  let statesByRoom = {}
  let recent = []
  let debug = {}
  let eventId = 0
  let cachedView = null
  let isRoundRunning = false
  let failedReads = 0

  const data = () => gameSave.get()
  /** Replaces the save and the bridge, keeps them, and tells the surfaces. */
  function commit(next) {
    gameSave.set(next)
    cachedView = null
    onChange()
  }
  const stamp = (events, at) => events.map((event) => ({ id: ++eventId, at, ...event }))

  function themeOf(roomId) {
    const { theme, roomThemes } = preferences.snapshot()
    // Under Random the UI picks a room's theme; the worker does not know which, so the monsters
    // come from the generic set.
    return roomThemes?.[roomId] ?? (theme === RANDOM_THEME ? null : theme)
  }

  async function updateStatus() {
    const settings = (await readSettings()) ?? {}
    keepTitles = settings.gameKeepTitles === true
    await gameSave.load()
    const { supported, granted } = access()
    const enabled = settings.gameMode === true
    const next = gameStatus({ enabled, supported, granted: granted && !isDenied, newerSave: gameSave.isFromNewerVersion() })
    if (next !== status) cachedView = null
    status = next
  }

  /** Stops watching: when the game runs again, history from now on is counted, not the gap. */
  function stopWatching() {
    lastRoundAt = null
    links = new Map()
    statesByRoom = {}
    const { save, bridge } = data()
    if (bridge.watchedUntil === null || gameSave.isFromNewerVersion()) return
    commit({ save, bridge: { ...emptyBridge(), autoSpend: bridge.autoSpend } })
  }

  function syncKeepTitles(save) {
    return save.settings.keepTitles === keepTitles ? save : engine.setKeepTitles(save, keepTitles)
  }

  /** Moves the fights forward over the time since the last round, with the states seen now. */
  function advance(save, states, at) {
    if (lastRoundAt === null || at <= lastRoundAt) return { save, events: [] }
    const from = Math.max(lastRoundAt, at - MAX_ROUND_GAP_MS)
    const moved = engine.advanceWithEvents(save, { from, to: at, sessions: states })
    const events = []
    for (const kill of moved.events) {
      const { type, projectId, worldId, ...details } = kill
      events.push({ type: 'kill', roomId: projectId, worldId, ...details })
      if (kill.item) events.push({ type: 'drop', roomId: projectId, worldId, item: kill.item })
    }
    return { save: moved.save, events }
  }

  /** Counts the tokens read, and reports the characters that reached a new level. */
  function countTokens(save, readings, agentOfSession, at) {
    const before = levelsOf(save)
    let next = save
    for (const reading of readings) next = engine.applyTokens(next, { ...reading, now: at })
    const events = []
    for (const [key, level] of levelsOf(next)) {
      if (level <= (before.get(key) ?? 1)) continue
      const [roomId, sessionId] = [key.slice(0, key.lastIndexOf('|')), key.slice(key.lastIndexOf('|') + 1)]
      events.push({ type: 'level', roomId, sessionId, agentId: agentOfSession.get(sessionId) ?? null, level })
    }
    return { save: next, events }
  }

  function closeSessions(save, closing, at) {
    let next = save
    const events = []
    for (const { projectId, sessionId, title } of closing) {
      next = engine.closeSession(next, { projectId, sessionId, now: at, title })
      const retiree = Object.values(next.worlds).map((world) => world.projects[projectId]).find(Boolean)
        ?.retirees.find((record) => record.sessionId === sessionId)
      if (retiree) events.push({ type: 'retire', roomId: projectId, sessionId, nameId: retiree.nameId, level: retiree.level })
    }
    return { save: next, events }
  }

  function spendIfAsked(save, autoSpend) {
    if (!autoSpend) return { save, events: [] }
    const spent = engine.autoSpendWithPurchases(save)
    const events = spent.purchases.map((purchase) => ({ type: 'purchase', ...purchase }))
    return { save: spent.save, events }
  }

  /** One round of a running game: read, match, advance, count, close, spend, keep. */
  async function playRound() {
    const history = await readHistory()
    if (!history.ok) {
      if (history.denied) isDenied = true
      // A history that cannot be read is reported once, not every round.
      failedReads += 1
      if (failedReads === 1) log(`game: session history: ${history.message}`)
      return
    }
    failedReads = 0
    const at = now()
    const listed = await readWorkspaces()
    const { rooms } = store.snapshot()
    const agents = mainAgents(rooms)
    const { sessions, truncated } = history
    const { bridge } = data()
    const read = readTokenDeltas(bridge.baselines, sessions, { now: at, watchedUntil: bridge.watchedUntil })
    const places = placeSessions(sessions, { workspaces: store.describeWorkspaces(), listed })
    const { agentOf, how } = matchSessions({ sessions, places, agents, links: store.sessionLinks() })
    const deltas = new Map(read.deltas.map((delta) => [delta.sessionId, delta]))
    const readings = buildReadings({ sessions, places, agentOf, agents, deltas, themeOf })

    let save = syncKeepTitles(data().save)
    const advanced = advance(save, readings.states, at)
    const counted = countTokens(advanced.save, readings.tokens, agentOf, at)
    const closing = sessionsToClose({ characters: livingCharacters(counted.save), sessions, agentOf, truncated, now: at })
    const closed = closeSessions(counted.save, closing, at)
    const spent = spendIfAsked(closed.save, bridge.autoSpend)
    save = spent.save

    links = new Map()
    const roomOfAgent = new Map(agents.map((agent) => [agent.id, agent.roomId]))
    for (const [sessionId, agentId] of agentOf) {
      links.set(agentId, { sessionId, roomId: roomOfAgent.get(agentId), how: how.get(sessionId) })
    }
    statesByRoom = {}
    for (const reading of readings.states) {
      if (reading.guest) links.set(reading.agentId, { sessionId: null, roomId: reading.projectId, how: 'guest' })
      ;(statesByRoom[reading.projectId] ??= []).push({ state: reading.state })
    }
    const events = [...advanced.events, ...counted.events, ...closed.events, ...spent.events]
    recent = keepRecent(recent, stamp(events, at))
    debug = { readAt: at, sessionsRead: sessions.length, truncated, resets: read.resets, ...readings.counters }
    lastRoundAt = at
    commit({ save, bridge: { ...bridge, baselines: read.baselines, watchedUntil: at } })
  }

  /** Reads the settings and, while the game runs, plays one round. Never throws. */
  async function round() {
    if (isRoundRunning) return
    isRoundRunning = true
    try {
      const wasRunning = status === 'running'
      await updateStatus()
      if (status === 'running') await playRound()
      else if (wasRunning || data().bridge.watchedUntil !== null) stopWatching()
      if (wasRunning !== (status === 'running')) onChange()
    } catch (error) {
      log(`game: ${error?.message ?? error}`)
    } finally {
      isRoundRunning = false
    }
  }

  /** The game part of the view state, rebuilt only after something changed. */
  function getView() {
    if (cachedView) return cachedView
    const running = status === 'running'
    const { save, bridge } = data()
    cachedView = buildGameView({
      status,
      autoSpend: bridge.autoSpend,
      keepTitles,
      engineView: running ? engine.view(save) : null,
      defaultWorldId: DEFAULT_WORLD,
      roomIds: store.snapshot().rooms.map((room) => room.id).filter((id) => id !== 'no-project'),
      links,
      statesByRoom,
      recent,
      debug
    })
    return cachedView
  }

  const actions = createGameActions({
    engine,
    data,
    commit,
    isRunning: () => status === 'running',
    canWriteSave: () => !gameSave.isFromNewerVersion(),
    load: () => gameSave.load(),
    roomIds: () => store.snapshot().rooms.map((room) => room.id).filter((id) => id !== 'no-project'),
    setKeepTitlesSetting: async (value) => {
      await writeSetting('gameKeepTitles', value)
      keepTitles = value
    }
  })

  return {
    round,
    getView,
    /** Writes what is pending; called when the plugin stops. */
    flush: () => gameSave.flush(),
    ...actions
  }
}

/**
 * A stand-in for a game that cannot run here at all (the content files did not load, or the
 * demo runs without it): it reports the status and refuses every action.
 *
 * @param {GameStatus} status
 */
export function createUnavailableGame(status) {
  const view = { status, autoSpend: false, keepTitles: false }
  const refuse = async () => {
    throw new Error('the game is not available')
  }
  return {
    round: async () => {},
    getView: () => view,
    flush: async () => {},
    prestigeSkill: refuse,
    upgradeItem: refuse,
    buyGroupUpgrade: refuse,
    assignRoom: refuse,
    resetWorld: refuse,
    setAutoSpend: refuse,
    setKeepTitles: refuse
  }
}
