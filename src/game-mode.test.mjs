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
const WORKSPACES = [
  { id: 'w-banana', path: '/work/rumble-banana', hostId: 'local', repoId: 'banana', name: 'main' },
  { id: 'w-waffle', path: '/srv/turbo-waffle', hostId: 'build-box', repoId: 'waffle', name: 'main' }
]

/** A game with a fake Orca around it: storage, settings, history and a clock the test moves. */
function setup({ storage = new Map(), settings = { gameMode: true }, access = { supported: true, granted: true } } = {}) {
  let clock = 1_000 * MINUTE
  const store = createAgentStore({ now: () => clock })
  store.setWorkspaces(WORKSPACES)
  const history = { sessions: [], truncated: false, failure: null }
  const writtenSettings = []
  const logs = []
  let changes = 0
  const gameSave = createGameSave({
    storage: { get: async (key) => storage.get(key) ?? null, set: async (key, value) => storage.set(key, value) },
    migrate,
    saveVersion: SAVE_VERSION,
    log: (message) => logs.push(message),
    setTimer: () => null,
    clearTimer: () => {}
  })
  const game = createGameMode({
    engine,
    gameSave,
    readSettings: async () => settings,
    writeSetting: async (key, value) => {
      writtenSettings.push([key, value])
      settings[key] = value
    },
    access: () => access,
    readHistory: async () => (history.failure ?? { ok: true, sessions: history.sessions, truncated: history.truncated }),
    readWorkspaces: async () => [],
    store,
    preferences: { snapshot: () => ({ theme: 'pixel-dark', roomThemes: {} }) },
    now: () => clock,
    log: (message) => logs.push(message),
    onChange: () => (changes += 1)
  })
  const session = (sessionId, totalTokens, extra = {}) =>
    ({ sessionId, title: null, workspaceId: 'w-banana', totalTokens, createdAt: 0, running: true, ...extra })
  return {
    game, store, history, storage, settings, writtenSettings, logs, session,
    tick: (ms) => (clock += ms),
    now: () => clock,
    changes: () => changes
  }
}

/** The living characters of the default world's banana room. */
const partyOf = (game) => Object.keys(game.getView().rooms?.[BANANA]?.joined ? game.getView().characters : {})

test('the game is off until the person turns it on, and says so', async () => {
  const { game, history } = setup({ settings: {} })
  history.failure = { ok: false, denied: false, message: 'should not be read' }
  await game.round()
  assert.deepEqual(game.getView(), { status: 'off', autoSpend: false, keepTitles: false })
})

test('the game says when this Orca has no session history or the person did not grant it', async () => {
  const unsupported = setup({ access: { supported: false, granted: true } })
  await unsupported.game.round()
  assert.equal(unsupported.game.getView().status, 'unsupported')
  const refused = setup({ access: { supported: true, granted: false } })
  await refused.game.round()
  assert.equal(refused.game.getView().status, 'needs-permission')
})

test('a history read refused for lack of permission switches the game to needs-permission', async () => {
  const { game, history } = setup()
  history.failure = { ok: false, denied: true, message: 'capability_denied' }
  await game.round()
  await game.round()
  assert.equal(game.getView().status, 'needs-permission')
})

test('turning the game on pays nothing for history, then counts what sessions spend', async () => {
  const { game, store, history, session, tick } = setup()
  store.status({ workspaceId: 'w-banana', paneKey: 'pane-1', state: 'working', sessionId: 's1' })
  history.sessions = [session('s1', 9_000_000)]
  await game.round()
  assert.deepEqual(game.getView().rooms[BANANA], { worldId: 'main', joined: false })
  tick(MINUTE)
  history.sessions = [session('s1', 9_500_000)]
  await game.round()
  const view = game.getView()
  assert.equal(view.rooms[BANANA].joined, true)
  assert.equal(view.characters['pane-1'].sessionId, 's1')
  assert.equal(view.characters['pane-1'].link, 'session')
  assert.ok(view.characters['pane-1'].level > 1)
})

test('a restart counts the tokens spent while the worker was down, once', async () => {
  const storage = new Map()
  const first = setup({ storage })
  first.store.status({ workspaceId: 'w-banana', paneKey: 'pane-1', state: 'working', sessionId: 's1' })
  first.history.sessions = [first.session('s1', 1_000_000)]
  await first.game.round()
  first.tick(MINUTE)
  first.history.sessions = [first.session('s1', 1_100_000)]
  await first.game.round()
  await first.game.flush()
  const tokensBefore = storage.get(GAME_STORAGE_KEY).save.worlds.main.projects[BANANA].characters.s1.tokens

  const second = setup({ storage })
  second.tick(30 * MINUTE)
  second.store.status({ workspaceId: 'w-banana', paneKey: 'pane-1', state: 'working', sessionId: 's1' })
  second.history.sessions = [second.session('s1', 1_400_000)]
  await second.game.round()
  await second.game.round()
  await second.game.flush()
  const tokensAfter = storage.get(GAME_STORAGE_KEY).save.worlds.main.projects[BANANA].characters.s1.tokens
  assert.equal(tokensBefore, 100_000)
  assert.equal(tokensAfter, 400_000)
})

test('a session that started after the last round earns its first tokens', async () => {
  const { game, history, session, tick, now } = setup()
  await game.round()
  tick(MINUTE)
  history.sessions = [session('s2', 200_000, { createdAt: now() - 30_000 })]
  await game.round()
  assert.equal(game.getView().rooms[BANANA].joined, true)
  assert.equal(game.getView().debug.unmatched, 1)
})

test('a session that stops running after its agent left the room retires', async () => {
  const { game, history, session, tick } = setup()
  history.sessions = [session('s1', 0)]
  await game.round()
  tick(MINUTE)
  history.sessions = [session('s1', 300_000)]
  await game.round()
  tick(MINUTE)
  history.sessions = [session('s1', 300_000, { running: false })]
  await game.round()
  const room = game.getView().rooms[BANANA]
  assert.equal(room.retirees.length, 1)
  assert.ok(game.getView().recent.some((event) => event.type === 'retire'))
})

test('turning the game off and on again pays nothing for the time it was off', async () => {
  const { game, history, session, settings, tick, storage } = setup()
  history.sessions = [session('s1', 0)]
  await game.round()
  settings.gameMode = false
  await game.round()
  tick(60 * MINUTE)
  history.sessions = [session('s1', 5_000_000)]
  settings.gameMode = true
  await game.round()
  await game.round()
  await game.flush()
  assert.equal(storage.get(GAME_STORAGE_KEY).save.worlds.main?.projects[BANANA], undefined)
})

test('an agent on another computer shows as a guest', async () => {
  const { game, store } = setup()
  store.status({ workspaceId: 'w-waffle', paneKey: 'pane-9', state: 'working' })
  await game.round()
  assert.deepEqual(game.getView().characters['pane-9'], { sessionId: null, link: 'guest', guest: true, level: 1 })
  assert.equal(game.getView().debug.guests, 1)
})

test('actions are refused while the game is off and for ids that do not exist', async () => {
  const off = setup({ settings: {} })
  await off.game.round()
  await assert.rejects(off.game.setAutoSpend(true), /not running/)
  const { game } = setup()
  await game.round()
  await assert.rejects(game.prestigeSkill({ worldId: 'main', skillId: 'forge' }), /unknown world/)
  await assert.rejects(game.assignRoom({ roomId: 'made-up', worldId: 'main' }), /unknown room/)
  await assert.rejects(game.assignRoom({ roomId: BANANA, worldId: 'Not A Name' }), /not a world name/)
  await assert.rejects(game.upgradeItem({ roomId: BANANA, itemId: 'x' }), /unknown room/)
  await assert.rejects(game.buyGroupUpgrade({ worldId: 'nowhere', upgradeId: 'campfire' }), /unknown world/)
})

test('a room can be put in another world or out of the game', async () => {
  const { game } = setup()
  await game.round()
  assert.deepEqual(await game.assignRoom({ roomId: BANANA, worldId: 'side-projects' }), { changed: true })
  assert.equal(game.getView().rooms[BANANA].worldId, 'side-projects')
  await game.assignRoom({ roomId: BANANA, worldId: null })
  assert.equal(game.getView().rooms[BANANA].worldId, null)
})

test('auto-spend is kept with the save', async () => {
  const storage = new Map()
  const { game } = setup({ storage })
  await game.round()
  await game.setAutoSpend(true)
  await game.flush()
  assert.equal(storage.get(GAME_STORAGE_KEY).bridge.autoSpend, true)
  assert.equal(game.getView().autoSpend, true)
})

test('turning keep-titles off writes the setting and forgets the titles kept', async () => {
  const { game, history, session, tick, writtenSettings, settings } = setup({ settings: { gameMode: true, gameKeepTitles: true } })
  history.sessions = [session('s1', 0, { title: 'Fix checkout rounding' })]
  await game.round()
  tick(MINUTE)
  history.sessions = [session('s1', 200_000, { title: 'Fix checkout rounding' })]
  await game.round()
  tick(MINUTE)
  history.sessions = [session('s1', 200_000, { title: 'Fix checkout rounding', running: false })]
  await game.round()
  assert.equal(game.getView().rooms[BANANA].retirees[0].title, 'Fix checkout rounding')
  await game.setKeepTitles(false)
  assert.deepEqual(writtenSettings, [['gameKeepTitles', false]])
  assert.equal(settings.gameKeepTitles, false)
  assert.equal(game.getView().rooms[BANANA].retirees[0].title, null)
})

test('a working party fights between rounds and the kills show up as recent events', async () => {
  const { game, store, history, session, tick } = setup()
  store.status({ workspaceId: 'w-banana', paneKey: 'pane-1', state: 'working', sessionId: 's1' })
  history.sessions = [session('s1', 0)]
  await game.round()
  let total = 0
  for (let round = 0; round < 40; round++) {
    tick(MINUTE / 2)
    total += 12_000
    history.sessions = [session('s1', total)]
    await game.round()
  }
  const view = game.getView()
  assert.equal(view.rooms[BANANA].party, 'fighting')
  assert.ok(view.rooms[BANANA].monster)
  assert.ok(view.recent.some((event) => event.type === 'kill'))
})

test('the view is rebuilt only after a change', async () => {
  const { game } = setup()
  await game.round()
  assert.equal(game.getView(), game.getView())
})

test('the view state of a busy save stays far below the panel post limit', async () => {
  const { game, store, history, session, tick } = setup()
  const sessions = Array.from({ length: 6 }, (_, index) => `s${index}`)
  sessions.forEach((sessionId, index) =>
    store.status({ workspaceId: 'w-banana', paneKey: `pane-${index}`, state: 'working', sessionId }))
  history.sessions = sessions.map((sessionId) => session(sessionId, 0))
  await game.round()
  for (let round = 1; round <= 200; round++) {
    tick(MINUTE)
    history.sessions = sessions.map((sessionId) => session(sessionId, round * 30_000))
    await game.round()
  }
  const size = Buffer.byteLength(JSON.stringify(game.getView()))
  assert.ok(size < 64 * 1024, `${size} bytes`)
  assert.equal(partyOf(game).length, 6)
})
