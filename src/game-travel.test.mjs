import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createAgentStore } from './domain/agent-store.mjs'
import { loadGameEngine } from './game-files.mjs'
import { createGameMode } from './game-mode.mjs'
import { GAME_STORAGE_KEY, createGameSave } from './game-save.mjs'
import { sceneThemeOf } from './game/scenes.mjs'
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

/** The banana room joins with a working agent and plays until it killed `kills` monsters. */
async function playUntil(played, kills) {
  const { game, store, history, session, tick } = played
  store.status({ workspaceId: 'w-banana', paneKey: 'pane-1', state: 'working', sessionId: 's1' })
  history.sessions = [session('s1', 0)]
  await game.round()
  let total = 0
  for (let round = 0; round < 400 && (game.getView().rooms[BANANA].kills ?? 0) < kills; round++) {
    tick(MINUTE / 2)
    total += 12_000
    history.sessions = [session('s1', total)]
    await game.round()
  }
  return game.getView().rooms[BANANA]
}

test('"new scene after each monster" is off at first, kept with the save, and in the view', async () => {
  const played = setup()
  await played.game.round()
  assert.equal(played.game.getView().travel, false)
  assert.deepEqual(await played.game.setTravel(true), { changed: true })
  assert.deepEqual(await played.game.setTravel(true), { changed: false })
  await played.game.flush()
  assert.equal(played.storage.get(GAME_STORAGE_KEY).bridge.travel, true)
  assert.equal(played.game.getView().travel, true)
})

test('the scene setting is refused while the game is off', async () => {
  const { game } = setup({ settings: {} })
  await game.round()
  await assert.rejects(game.setTravel(true), /not running/)
})

test('a travelling room changes scene with every kill, and its monster comes from that scene', async () => {
  const played = setup()
  await played.game.round()
  await played.game.setTravel(true)
  const room = await playUntil(played, 3)
  assert.ok(room.kills >= 3)
  assert.equal(room.sceneTheme, sceneThemeOf(BANANA, THEMES, room.kills))
  assert.notEqual(room.sceneTheme, sceneThemeOf(BANANA, THEMES, room.kills - 1))
  await played.game.flush()
  const project = played.storage.get(GAME_STORAGE_KEY).save.worlds.main.projects[BANANA]
  assert.equal(project.themeId, room.sceneTheme)
})

test('a room with the setting off, or with a theme of its own, has no scene of its own', async () => {
  const played = setup()
  await played.game.round()
  const room = await playUntil(played, 1)
  assert.equal(room.sceneTheme, undefined)
  assert.ok(room.kills >= 1)
  await played.game.setTravel(true)
  assert.ok(played.game.getView().rooms[BANANA].sceneTheme)
  played.preferences.roomThemes = { [BANANA]: 'guild-hall' }
  assert.equal(played.game.getView().rooms[BANANA].sceneTheme, undefined)
})

test('with only one theme the setting moves no room', async () => {
  const played = setup({ themeIds: ['pixel-dark'] })
  await played.game.round()
  await played.game.setTravel(true)
  const room = await playUntil(played, 1)
  assert.equal(room.sceneTheme, undefined)
})

test('a room that has not joined the game has no scene, whatever the setting', async () => {
  const played = setup()
  await played.game.round()
  await played.game.setTravel(true)
  // An agent on a paired machine with a session history to read is a guest: its room never joins.
  played.store.status({ workspaceId: 'w-waffle', paneKey: 'pane-9', state: 'working' })
  await playUntil(played, 1)
  const waffle = played.game.getView().rooms[WAFFLE]
  assert.deepEqual(waffle, { worldId: 'main', joined: false })
})

test('a fixed default theme travels too: the setting does not need Random', async () => {
  const played = setup({ theme: 'pixel-dark' })
  await played.game.round()
  await played.game.setTravel(true)
  const room = await playUntil(played, 2)
  assert.equal(room.sceneTheme, sceneThemeOf(BANANA, THEMES, room.kills))
})
