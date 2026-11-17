// The bridge between the plugin and the game engine. Each round it reads what sessions spent
// (Orca's session token totals, or the estimate from working time and tool calls when Orca has
// none), turns it into readings for the rooms on screen, moves the engine forward, keeps the
// save, and builds the game part of the view state. Every Orca call comes in as a function, so
// the demo and the tests run it without Orca.
import { estimatedToClose } from './domain/game-estimate.mjs'
import { buildReadings, mainAgents, sessionsToClose } from './domain/game-sessions.mjs'
import { buildGameView, gameStatus, keepRecent, tokenSourceOf } from './domain/game-view.mjs'
import { createGameActions } from './game-actions.mjs'
import { emptyBridge } from './game-save.mjs'
import { readFromEstimate, readFromHistory } from './game-sources.mjs'
import { sceneThemeOf } from './game/scenes.mjs'
import { DEFAULT_WORLD } from './game/worlds.mjs'
import { RANDOM_THEME } from './preferences.mjs'

/**
 * The longest stretch of time one round moves the engine. A round that comes late (the computer
 * slept) does not fight through time nobody saw with the states read now.
 */
export const MAX_ROUND_GAP_MS = 5 * 60_000

/**
 * @typedef {import('./domain/game-view.mjs').GameStatus} GameStatus
 * @typedef {import('./domain/game-view.mjs').TokenSource} TokenSource
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
 *   readWorkMeters?: () => Record<string, import('./domain/work-meter.mjs').MeterReading>,
 *   store: { snapshot: () => { rooms: object[] }, sessionLinks: () => Record<string, string>,
 *     describeWorkspaces: () => object[], workMeters: () => Record<string, object> },
 *   preferences: { snapshot: () => { theme: string, roomThemes: Record<string, string> } },
 *   listThemeIds?: () => string[],
 *   now?: () => number,
 *   log: (message: string) => void,
 *   onChange: () => void
 * }} dependencies `readWorkMeters` is what the estimate reads, the store's meters unless given;
 *   `listThemeIds` the themes the surfaces can draw, which travelling rooms move through
 */
export function createGameMode(dependencies) {
  const { engine, gameSave, readSettings, writeSetting, access, readHistory, readWorkspaces } = dependencies
  const { store, preferences, now = Date.now, log, onChange } = dependencies
  const readWorkMeters = dependencies.readWorkMeters ?? (() => store.workMeters())
  const listThemeIds = dependencies.listThemeIds ?? (() => [])
  let status = /** @type {GameStatus} */ ('off')
  let tokenSource = /** @type {TokenSource} */ ('estimated')
  /** The work meters as last read. Kept in memory only: the meters start again with the worker. */
  let meterBaselines = {}
  /** When each estimated character's agent was first missed from the room. */
  let missingSince = new Map()
  let keepTitles = false
  let isDenied = false
  let lastRoundAt = null
  let links = new Map()
  /** By room, the last round's states of the sessions no agent on screen runs. */
  let agentlessStates = {}
  let recent = []
  let debug = {}
  let eventId = 0
  let cachedView = null
  /** The agents' states the cached view was built with: it is rebuilt when one changes. */
  let cachedStates = null
  let isRoundRunning = false
  let failedReads = 0
  /** Counts imported games: a round that read before an import must not write over it. */
  let generation = 0

  const data = () => gameSave.get()
  /** Replaces the save and the bridge, keeps them, and tells the surfaces. */
  function commit(next) {
    gameSave.set(next)
    cachedView = null
    onChange()
  }
  const stamp = (events, at) => events.map((event) => ({ id: ++eventId, at, ...event }))

  /**
   * The themes a room moves through with "new scene after each monster", or null when it stays
   * put: the setting is off, there is only one theme, or the room picked a theme of its own.
   *
   * @param {string} roomId
   * @param {string[]} themeIds the themes there are, read once by the caller
   */
  function travelThemes(roomId, themeIds) {
    if (!data().bridge.travel || themeIds.length < 2) return null
    const own = preferences.snapshot().roomThemes?.[roomId]
    return own && themeIds.includes(own) ? null : themeIds
  }

  /** The room's theme for its monsters, for rooms that do not travel. */
  function themeOfWith(themeIds) {
    return (roomId) => {
      // A travelling room's theme follows its kills, which the engine counts as it fights.
      if (travelThemes(roomId, themeIds)) return null
      const { theme, roomThemes } = preferences.snapshot()
      // Under Random the UI picks a room's theme; the worker does not know which, so the monsters
      // come from the generic set.
      return roomThemes?.[roomId] ?? (theme === RANDOM_THEME ? null : theme)
    }
  }

  /** The readings with the themes each travelling room moves through, for the engine. */
  function withScenes(states, themeIds) {
    return states.map((state) => {
      const scenes = travelThemes(state.projectId, themeIds)
      return scenes ? { ...state, scenes } : state
    })
  }

  async function updateStatus() {
    const settings = (await readSettings()) ?? {}
    keepTitles = settings.gameKeepTitles === true
    await gameSave.load()
    const { supported, granted } = access()
    const next = gameStatus({
      enabled: settings.gameMode === true,
      newerSave: gameSave.isFromNewerVersion(),
      loaded: gameSave.isLoaded()
    })
    const nextSource = tokenSourceOf({ supported, granted: granted && !isDenied })
    if (next !== status || nextSource !== tokenSource) cachedView = null
    status = next
    tokenSource = nextSource
  }

  /** Forgets what the estimate read, so nothing it saw before counts again. */
  function forgetMeters() {
    meterBaselines = {}
    missingSince = new Map()
  }

  /** Stops watching: when the game runs again, history from now on is counted, not the gap. */
  function stopWatching() {
    lastRoundAt = null
    links = new Map()
    agentlessStates = {}
    forgetMeters()
    const { save, bridge } = data()
    if (bridge.watchedUntil === null || gameSave.isFromNewerVersion()) return
    commit({ save, bridge: { ...emptyBridge(), autoSpend: bridge.autoSpend, travel: bridge.travel } })
  }

  /**
   * Puts an imported game in place of the one played. Everything read before it is forgotten, as
   * when the game stops watching, so the next round counts from now and fights nothing; its
   * characters whose sessions are not open retire by the usual closing rules.
   */
  function replaceGame(next) {
    generation += 1
    lastRoundAt = null
    links = new Map()
    agentlessStates = {}
    recent = []
    forgetMeters()
    commit(next)
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

  /**
   * The bridge for this round's source. When the source changed, the other source's baselines
   * and `watchedUntil` mean nothing here: they are forgotten, so the first reading of the new
   * source earns nothing and no token is counted by both.
   */
  function bridgeFor(source) {
    const { bridge } = data()
    if (bridge.tokenSource === source) return bridge
    forgetMeters()
    return { ...bridge, baselines: {}, watchedUntil: null, tokenSource: source }
  }

  /** Reads what sessions spent from this round's source, or null when the history failed. */
  async function readSource(source, bridge, agents) {
    if (source === 'estimated') {
      const meters = readWorkMeters()
      const at = now()
      const reading = readFromEstimate({ meters, agents, baselines: meterBaselines, watchedUntil: bridge.watchedUntil, at })
      return { at, reading }
    }
    const history = await readHistory()
    if (!history.ok) {
      if (history.denied) isDenied = true
      // A history that cannot be read is reported once, not every round.
      failedReads += 1
      if (failedReads === 1) log(`game: session history: ${history.message}`)
      return null
    }
    failedReads = 0
    const at = now()
    const listed = await readWorkspaces()
    const workspaces = store.describeWorkspaces()
    const reading = readFromHistory({ history, listed, workspaces, links: store.sessionLinks(), agents, bridge, at })
    return { at, reading }
  }

  /** The characters whose session is over, by the rules of the source. */
  function charactersToClose(source, save, reading, at) {
    const characters = livingCharacters(save)
    if (source === 'history') {
      const { sessions, agentOf, truncated } = reading
      return sessionsToClose({ characters, sessions, agentOf, truncated, now: at })
    }
    const present = new Set(reading.sessions.map((session) => session.sessionId))
    const closed = estimatedToClose({ characters, present, missingSince, now: at })
    missingSince = closed.missingSince
    return closed.closing
  }

  /** One round of a running game: read, match, advance, count, ready the fights, close, spend, keep. */
  async function playRound() {
    const source = tokenSource
    const startedIn = generation
    const bridge = bridgeFor(source)
    const agents = mainAgents(store.snapshot().rooms)
    const read = await readSource(source, bridge, agents)
    // A game imported while the source was read: what was read belongs to the game before it.
    if (!read || generation !== startedIn) return
    const { at, reading } = read
    const { sessions, places, agentOf, how, deltas } = reading
    const themeIds = listThemeIds()
    const readings = buildReadings({ sessions, places, agentOf, agents, deltas, themeOf: themeOfWith(themeIds) })
    const states = withScenes(readings.states, themeIds)

    let save = syncKeepTitles(data().save)
    const advanced = advance(save, states, at)
    const counted = countTokens(advanced.save, readings.tokens, agentOf, at)
    // A room that just joined, or a party that just started working, meets its monster now, so
    // the state published with it already shows the fight.
    const ready = engine.prepareFights(counted.save, { sessions: states })
    const closed = closeSessions(ready, charactersToClose(source, ready, reading, at), at)
    const spent = spendIfAsked(closed.save, bridge.autoSpend)
    save = spent.save

    links = new Map()
    const roomOfAgent = new Map(agents.map((agent) => [agent.id, agent.roomId]))
    for (const [sessionId, agentId] of agentOf) {
      links.set(agentId, { sessionId, roomId: roomOfAgent.get(agentId), how: how.get(sessionId) })
    }
    agentlessStates = {}
    for (const state of readings.states) {
      if (state.guest) links.set(state.agentId, { sessionId: null, roomId: state.projectId, how: 'guest' })
      if (!state.agentId) (agentlessStates[state.projectId] ??= []).push({ state: state.state })
    }
    const events = [...advanced.events, ...counted.events, ...closed.events, ...spent.events]
    recent = keepRecent(recent, stamp(events, at))
    const { truncated, resets } = reading
    debug = { tokenSource: source, readAt: at, sessionsRead: sessions.length, truncated, resets, ...readings.counters }
    lastRoundAt = at
    // The estimate's baselines are the meters, which start again with the worker: never saved.
    if (source === 'estimated') meterBaselines = reading.baselines
    const baselines = source === 'history' ? reading.baselines : {}
    commit({ save, bridge: { ...bridge, baselines, watchedUntil: at } })
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

  /**
   * The game part of the view state, rebuilt only after a round, an action, a change in the
   * state of an agent that has a character, or a change of theme that moves a travelling room.
   * A character's state and its party's are the store's now, not the last round's, so they
   * always match the room drawn next to them.
   */
  function getView() {
    const { rooms } = store.snapshot()
    const agentStates = new Map(mainAgents(rooms).map((agent) => [agent.id, agent.state]))
    const agentKey = [...links.keys()].map((agentId) => `${agentId}=${agentStates.get(agentId) ?? ''}`).join('|')
    const themeIds = data().bridge.travel ? listThemeIds() : []
    const themeKey = themeIds.length ? JSON.stringify([themeIds, preferences.snapshot().roomThemes]) : ''
    const states = `${agentKey}#${themeKey}`
    if (cachedView && states === cachedStates) return cachedView
    const running = status === 'running'
    const { save, bridge } = data()
    cachedStates = states
    cachedView = buildGameView({
      status,
      tokenSource: running ? tokenSource : null,
      autoSpend: bridge.autoSpend,
      travel: bridge.travel,
      keepTitles,
      engineView: running ? engine.view(save) : null,
      defaultWorldId: DEFAULT_WORLD,
      roomIds: rooms.map((room) => room.id).filter((id) => id !== 'no-project'),
      links,
      agentStates,
      agentlessStates,
      recent,
      debug,
      sceneThemeOf: (roomId, kills) => {
        const scenes = travelThemes(roomId, themeIds)
        return scenes ? sceneThemeOf(roomId, scenes, kills) : null
      }
    })
    return cachedView
  }

  const actions = createGameActions({
    engine,
    data,
    commit,
    isRunning: () => status === 'running',
    isLoaded: () => gameSave.isLoaded(),
    canWriteSave: () => !gameSave.isFromNewerVersion(),
    load: () => gameSave.load(),
    roomIds: () => store.snapshot().rooms.map((room) => room.id).filter((id) => id !== 'no-project'),
    setKeepTitlesSetting: async (value) => {
      await writeSetting('gameKeepTitles', value)
      keepTitles = value
    },
    replaceGame,
    now
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
  const view = { status, tokenSource: null, autoSpend: false, travel: false, keepTitles: false }
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
    setTravel: refuse,
    setCharacterTrade: refuse,
    setRoomTrade: refuse,
    setEquipment: refuse,
    bestGear: refuse,
    setKeepTitles: refuse,
    exportSave: refuse,
    importSave: refuse,
    moveOrphanItems: refuse,
    sellMaterial: refuse,
    tradeMaterial: refuse,
    buyStallOffer: refuse
  }
}
