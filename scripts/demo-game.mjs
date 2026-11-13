// Game mode for the demo: a made-up session history for the demo's agents, so the game can be
// built and looked at without Orca. Every token count comes from a hash of the session id and
// the round, so a run always plays the same way.
//
// Agents on this computer get a session each, found by their conversation title the way a real
// history is matched. Now and then an agent's session closes (its character retires) and a new
// one opens under the same title. Agents on the paired machines join as guests.
import { createGameMode } from '../src/game-mode.mjs'
import { createGameSave } from '../src/game-save.mjs'
import { hashOf } from '../src/game/hash.mjs'
import { SAVE_VERSION, migrate } from '../src/game/worlds.mjs'

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
        const swing = 0.5 + (hashOf(`${sessionId}|${round}`) % 1000) / 1000
        session.totalTokens += Math.round(TOKENS_PER_MINUTE * minutes * swing)
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
 * @param {{ engine: object, store: object, preferences: object, onChange: () => void, frozen: boolean }} options
 * @returns {Promise<ReturnType<typeof createGameMode>>}
 */
export async function createDemoGame({ engine, store, preferences, onChange, frozen }) {
  const startedAt = Date.now()
  let frozenClock = EPOCH
  const now = () => (frozen ? frozenClock : EPOCH + (Date.now() - startedAt) * SPEED)
  const values = new Map()
  const settings = { gameMode: true, gameKeepTitles: true }
  const history = createHistory(store)
  let lastStepAt = now()
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
    access: () => ({ supported: true, granted: true }),
    readHistory: async () => {
      const at = now()
      history.step(at, (at - lastStepAt) / 60_000)
      lastStepAt = at
      return history.read()
    },
    readWorkspaces: async () => [],
    store,
    preferences,
    now,
    log: console.error,
    onChange
  })

  if (frozen) {
    // A day of play, spending now and then, then the last hours without spending so the
    // materials pile up for the screenshot.
    for (let round = 0; round < FROZEN_ROUNDS; round++) {
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
