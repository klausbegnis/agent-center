// Game mode for the demo: a made-up session history for the demo's agents, so the game can be
// built and looked at without Orca. Every token count comes from a hash of the session id and
// the round, so a run always plays the same way.
//
// With the history, agents on this computer get a session each, found by their conversation
// title the way a real history is matched. Now and then an agent's session closes (its
// character retires) and a new one opens under the same title; agents on the paired machines
// join as guests. With the estimate, there is no history: each agent gets a made-up work meter
// (working time in game time, and tool calls on this computer only, as no hook reaches the
// plugin from a paired machine), as an Orca without session totals would, and agents on the
// paired machines are characters like the others.
import { createGameMode } from '../src/game-mode.mjs'
import { createGameSave } from '../src/game-save.mjs'
import { hashOf } from '../src/game/hash.mjs'
import { SAVE_VERSION, emptyProject, emptySave, emptyWorld, migrate } from '../src/game/worlds.mjs'

/** Game time runs this many times faster than real time, so fights move on screen. */
const SPEED = 10
/** Real time between two rounds while the demo plays. */
const ROUND_MS = 3_000
/** A session closes after about this many rounds, and a new one opens for the same agent. */
const SESSION_ROUNDS = 120
/** Tokens a working agent spends per minute of game time, give or take half. */
const TOKENS_PER_MINUTE = 25_000
/** The frozen demo is this many rounds of play, about a working day of game time. */
const FROZEN_ROUNDS = 1_200
/** A fixed start, so the frozen demo is the same on every machine. */
const EPOCH = Date.UTC(2026, 0, 5, 9)
const LOCAL = 'local'
/** Sessions listed per reading, like the worker asks Orca for. */
const HISTORY_LIMIT = 200
/** Tool calls a working agent starts per minute of game time, give or take half. */
const TOOL_CALLS_PER_MINUTE = 3.75
const MINUTE_MS = 60_000

/**
 * A room no longer on screen that left its chest and retirees in the main world, so the Chest tab's
 * "Chests left behind" card has something to show. The demo's fuzzy-anvil room is on build-box;
 * this one is an older checkout of it on this computer.
 */
const LEFT_BEHIND = 'local:/work/fuzzy-anvil'
/** Coins the demo's world starts with: enough for one piece of a stall, not for all of them. */
const MARKET_COINS = 70_000

/**
 * The stored game the demo starts from: empty but for the room left behind, with "new scene after
 * each monster" on when asked, so even the first monsters fit their rooms' scenes.
 */
function startingSave(travel) {
  const item = (id, slot, tier, recipe, level, extra = {}) =>
    ({ id, entryId: id, slot, ...extra, tier, recipe, level, heldBy: null })
  const save = emptySave()
  save.worlds.main = {
    ...emptyWorld(),
    // Coins from earlier sales, and prices still moved by them, so the Market tab has something
    // to show: Deepforge was sold ore, Goldmill was bought out of fish.
    coins: MARKET_COINS,
    market: { clock: null, pressure: { deepforge: { ore: 1.2 }, goldmill: { fish: -1.4 } }, sold: {} },
    projects: {
      [LEFT_BEHIND]: {
        ...emptyProject({ wave: 4 }),
        chest: [
          item('tempered-shortsword', 'weapon', 3, ['bars', 'hides'], 2, { damageType: 'physical' }),
          item('inscribed-codex', 'weapon', 3, ['pages', 'runes'], 1, { damageType: 'magical' }),
          item('padded-jerkin', 'outfit', 1, ['hides', 'crops'], 4),
          item('trusty-pocketknife', 'tool', 1, ['ore', 'logs'], 3)
        ],
        retiredCount: 7
      }
    }
  }
  return { version: 1, save, bridge: { travel } }
}

/** A swing between 0.5 and 1.5, from a hash. */
const swingOf = (key) => 0.5 + (hashOf(key) % 1000) / 1000

/** Made-up work meters for every agent, the estimate's stand-in for the store's. */
function createMeters(store) {
  const meters = new Map()
  let round = 0

  /** Moves the meters one round forward with the agents' states as the store has them. */
  function step(now, minutes) {
    round += 1
    for (const room of store.snapshot().rooms) {
      const isPaired = (room.host ?? LOCAL) !== LOCAL
      for (const agent of room.agents) {
        if (agent.parentId) continue
        if (!meters.has(agent.id)) meters.set(agent.id, { startedAt: now, workedMs: {}, toolCalls: 0, calls: 0 })
        const meter = meters.get(agent.id)
        if (agent.state !== 'working') continue
        meter.workedMs[agent.activity] = (meter.workedMs[agent.activity] ?? 0) + minutes * MINUTE_MS
        if (isPaired) continue
        // Fractions of a call carry over, so a slow agent still makes one now and then.
        meter.calls += TOOL_CALLS_PER_MINUTE * minutes * swingOf(`${agent.id}|${round}`)
        meter.toolCalls = Math.floor(meter.calls)
      }
    }
  }

  return {
    step,
    read: () => Object.fromEntries([...meters].map(([agentId, { startedAt, workedMs, toolCalls }]) =>
      [agentId, { startedAt, workedMs: { ...workedMs }, toolCalls }]))
  }
}

/** One made-up session per local agent, numbered by how many the agent had before. */
function createHistory(store) {
  const sessions = new Map()
  const generations = new Map()
  let round = 0

  const sessionIdOf = (agentId) => `demo-${agentId}-${generations.get(agentId) ?? 0}`

  /** Moves the history one round forward with the agents' states as the store has them. */
  function step(now, minutes) {
    round += 1
    for (const room of store.snapshot().rooms) {
      if ((room.host ?? LOCAL) !== LOCAL) continue
      for (const agent of room.agents) {
        if (agent.parentId) continue
        let sessionId = sessionIdOf(agent.id)
        let session = sessions.get(sessionId)
        const isOld = session && (round + (hashOf(agent.id) % SESSION_ROUNDS)) % SESSION_ROUNDS === 0
        if (isOld) {
          session.running = false
          generations.set(agent.id, (generations.get(agent.id) ?? 0) + 1)
          sessionId = sessionIdOf(agent.id)
          session = undefined
        }
        if (!session) {
          session = { sessionId, title: agent.title, workspaceId: agent.workspaceId, totalTokens: 0, createdAt: now, running: true }
          sessions.set(sessionId, session)
        }
        if (agent.state !== 'working') continue
        session.totalTokens += Math.round(TOKENS_PER_MINUTE * minutes * swingOf(`${sessionId}|${round}`))
      }
    }
  }

  return {
    step,
    /** The newest sessions first, as Orca lists them. */
    read: () => {
      const newest = [...sessions.values()].reverse()
      const listed = newest.slice(0, HISTORY_LIMIT).map((session) => ({ ...session }))
      return { ok: true, sessions: listed, truncated: newest.length > HISTORY_LIMIT }
    }
  }
}

/**
 * The demo's game: a game mode over an in-memory storage and the made-up history.
 *
 * @param {{ engine: object, store: object, preferences: object, onChange: () => void, frozen: boolean,
 *   estimated?: boolean, travel?: boolean, listThemeIds?: () => string[] }} options `estimated`
 *   plays without a session history, on the estimate; `travel` turns on "new scene after each
 *   monster" over the themes `listThemeIds` lists
 * @returns {Promise<ReturnType<typeof createGameMode>>}
 */
export async function createDemoGame(options) {
  const { engine, preferences, onChange, frozen, estimated = false, travel = false, listThemeIds } = options
  let { store } = options
  const startedAt = Date.now()
  let frozenClock = EPOCH
  const now = () => (frozen ? frozenClock : EPOCH + (Date.now() - startedAt) * SPEED)
  const values = new Map([['game', startingSave(travel)]])
  const settings = { gameMode: true, gameKeepTitles: true }
  // The frozen scene never changes, so an agent that waits or is blocked in it would have kept
  // its room's party on hold for the whole made-up day. Until the last rounds those agents
  // count as working: the day before they got stuck.
  let isDayBefore = false
  const STUCK = new Set(['waiting', 'blocked'])
  const unstuck = (agent) => (STUCK.has(agent.state) ? { ...agent, state: 'working' } : agent)
  const liveStore = store
  store = Object.assign(Object.create(liveStore), {
    snapshot: () => {
      const snapshot = liveStore.snapshot()
      if (!isDayBefore) return snapshot
      return { ...snapshot, rooms: snapshot.rooms.map((room) => ({ ...room, agents: room.agents.map(unstuck) })) }
    }
  })
  const history = createHistory(store)
  const meters = createMeters(store)
  let lastStepAt = now()
  /** Moves the made-up history or meters to now. */
  const step = (source) => {
    const at = now()
    source.step(at, (at - lastStepAt) / 60_000)
    lastStepAt = at
    return source.read()
  }
  const game = createGameMode({
    engine,
    gameSave: createGameSave({
      storage: { get: async (key) => values.get(key) ?? null, set: async (key, value) => values.set(key, value) },
      migrate,
      saveVersion: SAVE_VERSION,
      log: console.error
    }),
    readSettings: async () => settings,
    writeSetting: async (key, value) => {
      settings[key] = value
    },
    access: () => ({ supported: !estimated, granted: !estimated }),
    readHistory: async () => step(history),
    readWorkspaces: async () => [],
    readWorkMeters: () => step(meters),
    store,
    preferences,
    listThemeIds,
    now,
    log: console.error,
    onChange
  })

  if (frozen) {
    // A day of play, spending now and then, then the last hours without spending so the
    // materials pile up for the screenshot.
    for (let round = 0; round < FROZEN_ROUNDS; round++) {
      isDayBefore = round < FROZEN_ROUNDS - 2
      if (round === 1) await game.setAutoSpend(true)
      if (round === FROZEN_ROUNDS - 240) await game.setAutoSpend(false)
      frozenClock += ROUND_MS * SPEED
      await game.round()
    }
    return game
  }
  await game.round()
  setInterval(() => game.round(), ROUND_MS)
  return game
}
