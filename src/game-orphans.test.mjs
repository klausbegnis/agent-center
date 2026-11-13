import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createAgentStore } from './domain/agent-store.mjs'
import { loadGameEngine } from './game-files.mjs'
import { createGameMode } from './game-mode.mjs'
import { GAME_STORAGE_KEY, STORED_VERSION, createGameSave } from './game-save.mjs'
import { COPIES_PER_ITEM } from './game/constants.mjs'
import { SAVE_VERSION, emptySave, migrate } from './game/worlds.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engine = loadGameEngine(ROOT, (message) => assert.fail(message))
const MINUTE = 60_000
const BANANA = 'local:/work/rumble-banana'
const WORKSPACES = [
  { id: 'w-banana', path: '/work/rumble-banana', hostId: 'local', repoId: 'banana', name: 'main' },
  { id: 'w-waffle', path: '/srv/turbo-waffle', hostId: 'build-box', repoId: 'waffle', name: 'main' }
]
const ANVIL = 'local:/work/fuzzy-anvil'
const WAFFLE = 'build-box:/srv/turbo-waffle'

/** A game over a fake storage and history, with a clock the test moves. */
function setup({ storage = new Map(), settings = { gameMode: true } } = {}) {
  let clock = 1_000 * MINUTE
  const store = createAgentStore({ now: () => clock })
  store.setWorkspaces(WORKSPACES)
  const history = { sessions: [], duringRead: null }
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
    readHistory: async () => {
      await history.duringRead?.()
      return { ok: true, sessions: history.sessions, truncated: false }
    },
    readWorkspaces: async () => [],
    store,
    preferences: { snapshot: () => ({ theme: 'pixel-dark', roomThemes: {} }) },
    now: () => clock,
    log: () => {},
    onChange: () => {}
  })
  const session = (sessionId, totalTokens, extra = {}) =>
    ({ sessionId, title: null, workspaceId: 'w-banana', totalTokens, createdAt: 0, running: true, ...extra })
  return { game, store, history, storage, settings, session, tick: (ms) => (clock += ms) }
}

/**
 * A game whose stored save has a project left behind (fuzzy-anvil, not on screen) with a
 * character, its starter chest and folded retirees, and whose banana room has joined.
 */
async function gameWithOrphan({ anvilWorld = 'main' } = {}) {
  let save = migrate({ ...emptySave(), projectWorld: { [ANVIL]: anvilWorld } })
  save = engine.applyTokens(save, { projectId: ANVIL, sessionId: 'old', tokens: 1_000_000, activity: 'write', now: 0 })
  save.worlds[anvilWorld].projects[ANVIL].retiredCount = 3
  const storage = new Map([[GAME_STORAGE_KEY, { version: STORED_VERSION, save, bridge: {} }]])
  const played = setup({ storage })
  played.store.status({ workspaceId: 'w-banana', paneKey: 'pane-1', state: 'working', sessionId: 's1' })
  played.history.sessions = [played.session('s1', 0)]
  await played.game.round()
  played.tick(MINUTE)
  played.history.sessions = [played.session('s1', 400_000)]
  await played.game.round()
  return played
}

test('a project left behind shows in its world, and its items and retirees move into a room on screen', async () => {
  const { game } = await gameWithOrphan()
  const world = game.getView().worlds[0]
  assert.deepEqual(world.orphans, [{ roomId: ANVIL, name: 'fuzzy-anvil', chestSize: 6, retiredCount: 4 }])
  const before = game.getView().rooms[BANANA]
  assert.deepEqual(await game.moveOrphanItems({ fromRoomId: ANVIL, toRoomId: BANANA }), { changed: true })
  const after = game.getView()
  assert.deepEqual(after.worlds[0].orphans, [])
  // Its session is not in the history, so its character retired like any other: 3 folded + 1.
  assert.equal(after.rooms[BANANA].retiredCount, before.retiredCount + 4)
  assert.ok(after.rooms[BANANA].chestSize > before.chestSize)
  assert.ok(after.rooms[BANANA].chestSize <= before.chestSize + 6)
  const counts = new Map()
  for (const item of after.rooms[BANANA].chest) counts.set(item.name, (counts.get(item.name) ?? 0) + 1)
  assert.ok([...counts.values()].every((count) => count <= COPIES_PER_ITEM))
})

test('a move is refused unless it is from a room left behind to a room on screen in its world', async () => {
  const { game } = await gameWithOrphan()
  await assert.rejects(game.moveOrphanItems({ fromRoomId: BANANA, toRoomId: BANANA }), /not a room left behind/)
  await assert.rejects(game.moveOrphanItems({ fromRoomId: 'local:/made-up', toRoomId: BANANA }), /not a room left behind/)
  await assert.rejects(game.moveOrphanItems({ fromRoomId: ANVIL, toRoomId: 'local:/made-up' }), /same world/)
  // On screen, but it has not joined the game yet.
  await assert.rejects(game.moveOrphanItems({ fromRoomId: ANVIL, toRoomId: WAFFLE }), /same world/)
  await game.assignRoom({ roomId: BANANA, worldId: 'side-projects' })
  await assert.rejects(game.moveOrphanItems({ fromRoomId: ANVIL, toRoomId: BANANA }), /same world/)
  assert.equal(game.getView().worlds.find((world) => world.id === 'main').orphans.length, 1)
})

test('a project left behind in a world no room on screen plays in still shows, and cannot be moved', async () => {
  const { game } = await gameWithOrphan({ anvilWorld: 'archive' })
  const archive = game.getView().worlds.find((world) => world.id === 'archive')
  assert.equal(archive.orphans.length, 1)
  assert.deepEqual(archive.roomIds, [])
  await assert.rejects(game.moveOrphanItems({ fromRoomId: ANVIL, toRoomId: BANANA }), /same world/)
})

test('a move is refused while the game is off', async () => {
  const off = setup({ settings: {} })
  await off.game.round()
  await assert.rejects(off.game.moveOrphanItems({ fromRoomId: ANVIL, toRoomId: BANANA }), /not running/)
})
