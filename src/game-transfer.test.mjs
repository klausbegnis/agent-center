import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createAgentStore } from './domain/agent-store.mjs'
import { loadGameEngine } from './game-files.mjs'
import { createGameMode } from './game-mode.mjs'
import { GAME_STORAGE_KEY, STORED_VERSION, createGameSave } from './game-save.mjs'
import { SAVE_FILE_FORMAT, buildSaveFile, readSaveFile } from './game-transfer.mjs'
import { SAVE_VERSION, emptySave, migrate } from './game/worlds.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engine = loadGameEngine(ROOT, (message) => assert.fail(message))
const MINUTE = 60_000
const BANANA = 'local:/work/rumble-banana'
const WORKSPACES = [{ id: 'w-banana', path: '/work/rumble-banana', hostId: 'local', repoId: 'banana', name: 'main' }]
const reading = { saveVersion: SAVE_VERSION, migrate, cleanSave: engine.cleanSave }

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

/** A game whose banana room has a working character that spent tokens, and auto-spend on. */
async function playedGame() {
  const played = setup()
  played.store.status({ workspaceId: 'w-banana', paneKey: 'pane-1', state: 'working', sessionId: 's1' })
  played.history.sessions = [played.session('s1', 0)]
  await played.game.round()
  for (let round = 1; round <= 5; round++) {
    played.tick(MINUTE)
    played.history.sessions = [played.session('s1', round * 400_000)]
    await played.game.round()
  }
  await played.game.setAutoSpend(true)
  return played
}

const storedSave = async ({ game, storage }) => {
  await game.flush()
  return storage.get(GAME_STORAGE_KEY)
}

test('an export holds the save and auto-spend, never the token baselines', async () => {
  const { game, storage } = await playedGame()
  const file = await game.exportSave()
  const stored = await storedSave({ game, storage })
  assert.equal(file.format, SAVE_FILE_FORMAT)
  assert.equal(file.version, STORED_VERSION)
  assert.equal(file.exportedAt, new Date(1_005 * MINUTE).toISOString())
  assert.equal(file.autoSpend, true)
  assert.deepEqual(file.save, stored.save)
  assert.ok(Object.keys(stored.bridge.baselines).length > 0)
  assert.deepEqual(Object.keys(file).sort(), ['autoSpend', 'exportedAt', 'format', 'save', 'version'])
})

test('an export works once the save was read, even with the game off and nothing written', async () => {
  const { game } = setup({ settings: {} })
  await assert.rejects(game.exportSave(), /not been read/)
  await game.round()
  const file = await game.exportSave()
  assert.deepEqual(file.save, emptySave())
  assert.equal(file.autoSpend, false)
})

test('an exported game imported elsewhere is the same game, with its auto-spend', async () => {
  const { game } = await playedGame()
  const file = JSON.parse(JSON.stringify(await game.exportSave()))
  const other = setup()
  await other.game.round()
  assert.deepEqual(await other.game.importSave(file), { changed: true })
  const again = await other.game.exportSave()
  assert.deepEqual(again.save, file.save)
  assert.equal(again.autoSpend, true)
  assert.equal(other.game.getView().autoSpend, true)
})

test('an import forgets the baselines, so nothing read before it counts again', async () => {
  const { game } = await playedGame()
  const file = await game.exportSave()
  const other = setup()
  other.store.status({ workspaceId: 'w-banana', paneKey: 'pane-1', state: 'working', sessionId: 's1' })
  other.history.sessions = [other.session('s1', 100_000)]
  await other.game.round()
  await other.game.importSave(file)
  const stored = await storedSave(other)
  assert.deepEqual(stored.bridge.baselines, {})
  assert.equal(stored.bridge.watchedUntil, null)
  // The session spent a lot meanwhile; the first round after the import only reads it.
  const tokensBefore = file.save.worlds.main.projects[BANANA].characters.s1.tokens
  other.tick(MINUTE)
  other.history.sessions = [other.session('s1', 9_000_000)]
  await other.game.round()
  const after = (await storedSave(other)).save.worlds.main.projects[BANANA].characters.s1.tokens
  assert.equal(after, tokensBefore)
})

test('an imported character whose session is not open here retires by the usual rules', async () => {
  const { game } = await playedGame()
  const file = await game.exportSave()
  const other = setup()
  await other.game.round()
  await other.game.importSave(file)
  other.tick(MINUTE)
  await other.game.round()
  const project = (await storedSave(other)).save.worlds.main.projects[BANANA]
  assert.deepEqual(Object.keys(project.characters), [])
  assert.equal(project.retirees[0].sessionId, 's1')
  assert.equal(project.chest.every((item) => item.heldBy === null), true)
})

test('a round that was reading when a game was imported does not write over it', async () => {
  const { game } = await playedGame()
  const file = await game.exportSave()
  const other = setup()
  await other.game.round()
  other.history.sessions = [other.session('s9', 50_000)]
  other.history.duringRead = () => other.game.importSave(file)
  other.tick(MINUTE)
  await other.game.round()
  other.history.duringRead = null
  const stored = await storedSave(other)
  assert.deepEqual(stored.save, file.save)
  assert.equal(stored.bridge.watchedUntil, null)
})

test('an import is refused while the game is off, and over a save from a newer plugin', async () => {
  const { game } = await playedGame()
  const file = await game.exportSave()
  const off = setup({ settings: {} })
  await off.game.round()
  await assert.rejects(off.game.importSave(file), /not running/)
  const storage = new Map([[GAME_STORAGE_KEY, { version: STORED_VERSION + 1, save: {}, bridge: {} }]])
  const newer = setup({ storage })
  await newer.game.round()
  await assert.rejects(newer.game.importSave(file), /not running|newer version/)
  await assert.rejects(newer.game.exportSave(), /newer version/)
  assert.equal(storage.get(GAME_STORAGE_KEY).version, STORED_VERSION + 1)
})

test('a refused import changes nothing', async () => {
  const played = await playedGame()
  const before = await storedSave(played)
  const file = await played.game.exportSave()
  const damaged = { ...file, save: { ...file.save, worlds: { main: { ...file.save.worlds.main, materials: { gold: 5 } } } } }
  await assert.rejects(played.game.importSave(damaged), /damaged: worlds\.main\.materials\.gold/)
  assert.deepEqual(await storedSave(played), before)
})

test('a value that is not a save file is refused', () => {
  for (const value of [null, 'text', [], {}, { format: 'something-else', save: emptySave() }]) {
    assert.deepEqual(readSaveFile(value, reading), { ok: false, reason: 'this is not an Agent Center save file' })
  }
  const noSave = readSaveFile({ format: SAVE_FILE_FORMAT, version: 1 }, reading)
  assert.equal(noSave.ok, false)
})

test('a save file from a newer plugin is refused, by its own version or its save\'s', () => {
  const file = buildSaveFile({ save: emptySave(), autoSpend: false, at: 0 })
  const newerFile = readSaveFile({ ...file, version: STORED_VERSION + 1 }, reading)
  const newerSave = readSaveFile({ ...file, save: { ...file.save, version: SAVE_VERSION + 1 } }, reading)
  assert.match(newerFile.reason, /newer version/)
  assert.match(newerSave.reason, /newer version/)
})

test('a save file larger than the plugin can keep is refused', () => {
  const file = buildSaveFile({ save: emptySave(), autoSpend: false, at: 0 })
  const read = readSaveFile({ ...file, padding: 'x'.repeat(2_000) }, { ...reading, maxBytes: 1_000 })
  assert.deepEqual(read, { ok: false, reason: 'the save file is larger than the plugin can keep' })
})

test('a save of a version this plugin has no way up from is refused instead of emptying the game', () => {
  const file = buildSaveFile({ save: { version: 0, worlds: { main: {} } }, autoSpend: false, at: 0 })
  assert.match(readSaveFile(file, reading).reason, /cannot read/)
})

test('made-up fields are not kept, and made-up values refuse the file', () => {
  const save = emptySave()
  save.worlds.main = { skills: {}, materials: { bars: 3 }, upgrades: {}, projects: {}, lastTokenAt: null, extra: 'x' }
  save.surprise = { nested: true }
  const read = readSaveFile(buildSaveFile({ save, autoSpend: true, at: 0 }), reading)
  assert.equal(read.ok, true)
  assert.deepEqual(read.save, {
    version: SAVE_VERSION,
    worlds: { main: { skills: {}, materials: { bars: 3 }, upgrades: {}, projects: {}, lastTokenAt: null } },
    projectWorld: {},
    settings: { keepTitles: false }
  })
  assert.equal(read.autoSpend, true)
})
