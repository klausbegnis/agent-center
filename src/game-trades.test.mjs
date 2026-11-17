import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createAgentStore } from './domain/agent-store.mjs'
import { loadGameEngine } from './game-files.mjs'
import { createGameMode } from './game-mode.mjs'
import { GAME_STORAGE_KEY, createGameSave } from './game-save.mjs'
import { SAVE_VERSION, migrate } from './game/worlds.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engine = loadGameEngine(ROOT, (message) => assert.fail(message))
const MINUTE = 60_000
const BANANA = 'local:/work/rumble-banana'
const WAFFLE = 'build-box:/srv/turbo-waffle'
const THEMES = ['gothic-dungeon', 'guild-hall', 'pixel-dark']
const WORKSPACES = [
  { id: 'w-banana', path: '/work/rumble-banana', hostId: 'local', repoId: 'banana', name: 'main' },
  { id: 'w-waffle', path: '/srv/turbo-waffle', hostId: 'build-box', repoId: 'waffle', name: 'main' }
]

/** A game over a fake storage and history, with themes and preferences the test can change. */
function setup({ settings = { gameMode: true }, themeIds = THEMES, theme = 'random' } = {}) {
  let clock = 1_000 * MINUTE
  const storage = new Map()
  const store = createAgentStore({ now: () => clock })
  store.setWorkspaces(WORKSPACES)
  const history = { sessions: [] }
  const preferences = { theme, roomThemes: {} }
  const gameSave = createGameSave({
    storage: { get: async (key) => storage.get(key) ?? null, set: async (key, value) => storage.set(key, value) },
    migrate,
    saveVersion: SAVE_VERSION,
    log: () => {},
    setTimer: () => null,
    clearTimer: () => {}
  })
  const game = createGameMode({
    engine,
    gameSave,
    readSettings: async () => settings,
    writeSetting: async (key, value) => {
      settings[key] = value
    },
    access: () => ({ supported: true, granted: true }),
    readHistory: async () => ({ ok: true, sessions: history.sessions, truncated: false }),
    readWorkspaces: async () => [],
    store,
    preferences: { snapshot: () => ({ ...preferences }) },
    listThemeIds: () => themeIds,
    now: () => clock,
    log: () => {},
    onChange: () => {}
  })
  const session = (sessionId, totalTokens) =>
    ({ sessionId, title: null, workspaceId: 'w-banana', totalTokens, createdAt: 0, running: true })
  return { game, store, history, storage, preferences, session, tick: (ms) => (clock += ms) }
}

/** The banana room joins the game with one working agent, whose session is `s1`. */
async function joined(played) {
  const { game, store, history, session, tick } = played
  store.status({ workspaceId: 'w-banana', paneKey: 'pane-1', state: 'working', sessionId: 's1' })
  history.sessions = [session('s1', 0)]
  await game.round()
  tick(MINUTE)
  history.sessions = [session('s1', 200_000)]
  await game.round()
  assert.equal(game.getView().rooms[BANANA].joined, true)
}

test('a room\'s trade and a character\'s are kept with the save and shown in the view', async () => {
  const played = setup()
  await joined(played)
  const { game } = played
  assert.deepEqual(await game.setRoomTrade({ roomId: BANANA, trade: 'fishing' }), { changed: true })
  assert.deepEqual(await game.setRoomTrade({ roomId: BANANA, trade: 'fishing' }), { changed: false })
  assert.deepEqual(await game.setCharacterTrade({ roomId: BANANA, sessionId: 's1', trade: 'runecraft' }), { changed: true })
  const view = game.getView()
  assert.equal(view.rooms[BANANA].tradeChoice, 'fishing')
  assert.deepEqual([view.characters['pane-1'].trade, view.characters['pane-1'].tradeChoice], ['runecraft', 'runecraft'])
  await game.flush()
  const project = played.storage.get(GAME_STORAGE_KEY).save.worlds.main.projects[BANANA]
  assert.deepEqual([project.tradeChoice, project.characters.s1.tradeChoice], ['fishing', 'runecraft'])
})

test('trade choices naming nothing that exists are refused and change nothing', async () => {
  const played = setup()
  await joined(played)
  const { game } = played
  await assert.rejects(game.setRoomTrade({ roomId: WAFFLE, trade: 'mining' }), /unknown room/)
  await assert.rejects(game.setRoomTrade({ roomId: BANANA, trade: 'forge' }), /unknown trade/)
  await assert.rejects(game.setCharacterTrade({ roomId: BANANA, sessionId: 's9', trade: 'mining' }), /unknown character/)
  await assert.rejects(game.setCharacterTrade({ roomId: BANANA, sessionId: 's1', trade: '__proto__' }), /unknown trade/)
  assert.equal(game.getView().rooms[BANANA].tradeChoice, null)
  assert.equal(game.getView().characters['pane-1'].tradeChoice, null)
})

test('trade choices are refused while the game is off', async () => {
  const { game } = setup({ settings: {} })
  await game.round()
  await assert.rejects(game.setRoomTrade({ roomId: BANANA, trade: 'mining' }), /not running/)
  await assert.rejects(game.setCharacterTrade({ roomId: BANANA, sessionId: 's1', trade: null }), /not running/)
})
