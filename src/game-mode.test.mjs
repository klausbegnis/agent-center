import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createAgentStore } from './domain/agent-store.mjs'
import { loadGameEngine } from './game-files.mjs'
import { createGameMode } from './game-mode.mjs'
import { estimateTokens, estimateTokensFromTime } from './game/estimate.mjs'
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
function setup(options = {}) {
  const { storage = new Map(), settings = { gameMode: true } } = options
  const givenAccess = options.access ?? { supported: true, granted: true }
  // A copy: a test that changes the access must not change it for the tests after it.
  const access = { ...givenAccess }
  let clock = 1_000 * MINUTE
  const store = createAgentStore({ now: () => clock })
  store.setWorkspaces(WORKSPACES)
  const history = { sessions: [], truncated: false, failure: null, reads: 0 }
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
    readHistory: async () => {
      history.reads += 1
      return history.failure ?? { ok: true, sessions: history.sessions, truncated: history.truncated }
    },
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
    game, store, history, storage, settings, writtenSettings, logs, session, access,
    tick: (ms) => (clock += ms),
    now: () => clock,
    changes: () => changes
  }
}

/** The living characters of the default world's banana room. */
const partyOf = (game) => Object.keys(game.getView().rooms?.[BANANA]?.joined ? game.getView().characters : {})

test('the game is off until the person turns it on, and says so', async () => {
  const { game, history } = setup({ settings: {} })
  await game.round()
  assert.deepEqual(game.getView(), { status: 'off', tokenSource: null, autoSpend: false, travel: false, keepTitles: false })
  assert.equal(history.reads, 0)
})

test('without session totals from Orca the game runs on the estimate and never reads the history', async () => {
  for (const access of [{ supported: false, granted: true }, { supported: true, granted: false }]) {
    const { game, history } = setup({ access })
    await game.round()
    assert.equal(game.getView().status, 'running')
    assert.equal(game.getView().tokenSource, 'estimated')
    assert.equal(history.reads, 0)
  }
})

test('with session totals from Orca the game reads them', async () => {
  const { game, history } = setup()
  await game.round()
  assert.equal(game.getView().tokenSource, 'history')
  assert.equal(history.reads, 1)
})

test('a history read refused for lack of permission switches the game to the estimate', async () => {
  const { game, history } = setup()
  history.failure = { ok: false, denied: true, message: 'capability_denied' }
  await game.round()
  await game.round()
  assert.equal(game.getView().status, 'running')
  assert.equal(game.getView().tokenSource, 'estimated')
  assert.equal(history.reads, 1)
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
  // A post may carry 256 KiB. The budget was 64 KiB until the instances' content (about 6 KiB, the
  // same for every world) and each world's roadmap (under 2 KiB) took a busy save past 69 KiB, 80
  // KiB until the achievements (about 19 KiB, the same catalogue for every world) and the journal
  // (about 3 KiB), and 104 KiB until the trait catalogue (about 10 KiB) took it to 103.2 KiB. Each
  // world's weekly event, with next week's (about 1.6 KiB), takes it to 104.8 KiB, and the city
  // ranks (each open city's rank card and next charter, and four achievements: about 2 KiB) to 106.8 KiB.
  // The second region (eight instances and sixteen bosses in the content, about 12 KiB the same for
  // every world, with an instance under fog sending only its place) and the rematches take it to
  // about 121 KiB, each instance's scene path to 122.1 KiB, and the weekly calendar's five coming
  // weeks (id, name, kind and start of each, about 0.6 KiB a world) to 122.7 KiB.
  assert.ok(size < 126 * 1024, `${size} bytes`)
  assert.equal(partyOf(game).length, 6)
})

const ESTIMATED = { supported: false, granted: true }
const PANE = { workspaceId: 'w-banana', paneKey: 'pane-1', terminalId: 'term-1' }

/** The saved tokens of a character of the banana room, or undefined when it has none. */
async function savedTokens({ game, storage }, sessionId) {
  await game.flush()
  return storage.get(GAME_STORAGE_KEY)?.save.worlds.main?.projects[BANANA]?.characters[sessionId]?.tokens
}

let callCount = 0
/** One minute of writing with four tool calls, as the store sees it. */
function writeForAMinute({ store, tick }) {
  store.status({ ...PANE, state: 'working' })
  for (let call = 0; call < 4; call++) {
    store.toolBefore({ ...PANE, tool: 'Edit', input: {}, callId: `call-${++callCount}` })
    tick(MINUTE / 4)
  }
}
const MINUTE_OF_WRITING = estimateTokens({ workedMs: { write: MINUTE }, toolCalls: 4, minutes: 1 })

test('the estimate pays nothing for work done before the game watched, then counts what agents do', async () => {
  const setupResult = setup({ access: ESTIMATED })
  const { game, store, tick } = setupResult
  store.status({ ...PANE, state: 'working' })
  tick(30 * MINUTE)
  await game.round()
  assert.equal(game.getView().rooms[BANANA].joined, false)
  writeForAMinute(setupResult)
  await game.round()
  const view = game.getView()
  assert.equal(view.characters['pane-1'].sessionId, 'estimated:pane-1')
  assert.equal(view.characters['pane-1'].link, 'agent')
  assert.equal(await savedTokens(setupResult, 'estimated:pane-1'), MINUTE_OF_WRITING)
})

test('an agent that only waits earns nothing from the estimate', async () => {
  const setupResult = setup({ access: ESTIMATED })
  const { game, store, tick } = setupResult
  store.status({ ...PANE, state: 'waiting' })
  await game.round()
  tick(10 * MINUTE)
  await game.round()
  assert.equal(await savedTokens(setupResult, 'estimated:pane-1'), undefined)
})

test('an agent that opened after the last round earns from its first minute', async () => {
  const setupResult = setup({ access: ESTIMATED })
  const { game, tick } = setupResult
  await game.round()
  tick(1)
  writeForAMinute(setupResult)
  await game.round()
  assert.equal(await savedTokens(setupResult, 'estimated:pane-1'), MINUTE_OF_WRITING)
})

test('an estimated character retires once its agent has left the room', async () => {
  const setupResult = setup({ access: ESTIMATED })
  const { game, store, tick } = setupResult
  await game.round()
  tick(1)
  writeForAMinute(setupResult)
  await game.round()
  // Two snapshots without the agent: its terminal closed.
  tick(20_000)
  store.sync('local', [])
  store.sync('local', [])
  await game.round()
  assert.equal(game.getView().rooms[BANANA].retirees.length, 0)
  tick(MINUTE)
  await game.round()
  assert.equal(game.getView().rooms[BANANA].retirees.length, 1)
  assert.ok(game.getView().recent.some((event) => event.type === 'retire' && event.sessionId === 'estimated:pane-1'))
})

test('after a restart the same agent continues its character and the time the worker was down earns nothing', async () => {
  const storage = new Map()
  const first = setup({ storage, access: ESTIMATED })
  await first.game.round()
  first.tick(1)
  writeForAMinute(first)
  await first.game.round()
  assert.equal(await savedTokens(first, 'estimated:pane-1'), MINUTE_OF_WRITING)

  const second = setup({ storage, access: ESTIMATED })
  second.tick(2 * MINUTE)
  second.store.status({ ...PANE, state: 'working' })
  await second.game.round()
  writeForAMinute(second)
  await second.game.round()
  assert.equal(await savedTokens(second, 'estimated:pane-1'), 2 * MINUTE_OF_WRITING)
  assert.equal(second.game.getView().rooms[BANANA].retirees.length, 0)
})

test('when real totals arrive, estimated characters retire and nothing is counted twice', async () => {
  const setupResult = setup({ access: ESTIMATED })
  const { game, store, history, session, access, tick, now } = setupResult
  await game.round()
  tick(1)
  writeForAMinute(setupResult)
  await game.round()
  access.supported = true
  store.status({ ...PANE, state: 'working', sessionId: 's1' })
  // A session that started while the estimate was counting it: its total is already paid.
  history.sessions = [session('s1', 900_000, { createdAt: now() - 30_000 })]
  tick(MINUTE)
  await game.round()
  const view = game.getView()
  assert.equal(view.tokenSource, 'history')
  assert.equal(view.debug.tokenSource, 'history')
  assert.equal(view.rooms[BANANA].retirees.length, 1)
  assert.equal(await savedTokens(setupResult, 's1'), undefined)
  tick(MINUTE)
  history.sessions = [session('s1', 1_000_000, { createdAt: now() - 90_000 })]
  await game.round()
  assert.equal(await savedTokens(setupResult, 's1'), 100_000)
})

test('when real totals go away, the estimate starts from nothing and history characters retire', async () => {
  const setupResult = setup()
  const { game, store, history, session, access, tick } = setupResult
  store.status({ ...PANE, state: 'working', sessionId: 's1' })
  history.sessions = [session('s1', 0)]
  await game.round()
  tick(MINUTE)
  history.sessions = [session('s1', 300_000)]
  await game.round()
  access.supported = false
  writeForAMinute(setupResult)
  await game.round()
  assert.equal(game.getView().tokenSource, 'estimated')
  assert.equal(game.getView().rooms[BANANA].retirees.length, 1)
  assert.equal(await savedTokens(setupResult, 'estimated:pane-1'), undefined)
  writeForAMinute(setupResult)
  await game.round()
  assert.equal(await savedTokens(setupResult, 'estimated:pane-1'), MINUTE_OF_WRITING)
})

const WAFFLE = 'build-box:/srv/turbo-waffle'
/** What `orca worktree ps --environment build-box` gives for one agent of the waffle room. */
const waffleRow = (state, extra = {}) =>
  [{ workspaceId: 'w-waffle', agents: [{ paneKey: 'pane-9', state, hasLivePty: true, ...extra }] }]

/** The saved character of the waffle room, or undefined when it has none. */
async function savedWaffleCharacter({ game, storage }, sessionId) {
  await game.flush()
  return storage.get(GAME_STORAGE_KEY)?.save.worlds.main?.projects[WAFFLE]?.characters[sessionId]
}

test('an agent on a paired machine is a character of the estimate, paid for its working time', async () => {
  const setupResult = setup({ access: ESTIMATED })
  const { game, store, tick } = setupResult
  await game.round()
  tick(1)
  store.sync('build-box', waffleRow('working', { toolName: 'Edit' }))
  tick(MINUTE / 2)
  store.sync('build-box', waffleRow('working', { toolName: 'Edit' }))
  tick(MINUTE / 2)
  await game.round()
  const view = game.getView()
  assert.equal(view.rooms[WAFFLE].joined, true)
  assert.ok(view.rooms[WAFFLE].monster)
  assert.equal(view.characters['pane-9'].sessionId, 'estimated:build-box/pane-9')
  assert.equal(view.characters['pane-9'].guest, false)
  assert.equal(view.characters['pane-9'].state, 'working')
  assert.equal(view.debug.guests, 0)
  const character = await savedWaffleCharacter(setupResult, 'estimated:build-box/pane-9')
  assert.equal(character.tokens, estimateTokensFromTime({ workedMs: { write: MINUTE } }))
})

test('a paired machine that cannot be read earns nothing and keeps its characters meanwhile', async () => {
  const setupResult = setup({ access: ESTIMATED })
  const { game, store, tick } = setupResult
  await game.round()
  tick(1)
  store.sync('build-box', waffleRow('working'))
  tick(MINUTE)
  await game.round()
  const sessionId = 'estimated:build-box/pane-9'
  const paid = (await savedWaffleCharacter(setupResult, sessionId)).tokens
  store.setUnreachableHosts(['build-box'])
  for (let round = 0; round < 4; round++) {
    // The snapshot keeps the machine's last rows through a few failed reads.
    store.sync('build-box', waffleRow('working'))
    tick(MINUTE / 2)
    await game.round()
  }
  assert.equal((await savedWaffleCharacter(setupResult, sessionId)).tokens, paid)
  assert.equal(game.getView().rooms[WAFFLE].retirees.length, 0)
  store.setUnreachableHosts([])
  store.sync('build-box', waffleRow('working'))
  tick(MINUTE)
  await game.round()
  assert.ok((await savedWaffleCharacter(setupResult, sessionId)).tokens > paid)
})

/** A snapshot row of the banana room with one agent, as `orca worktree ps` and untracked-sessions.mjs give it. */
const bananaRow = (paneKey, state, extra = {}) =>
  [{ workspaceId: 'w-banana', agents: [{ paneKey, state, hasLivePty: true, ...extra }] }]

test('a character born this round shows its agent working in the same view', async () => {
  const setupResult = setup({ access: ESTIMATED })
  const { game, store, tick } = setupResult
  await game.round()
  tick(1)
  writeForAMinute(setupResult)
  await game.round()
  assert.equal(store.snapshot().rooms.find((room) => room.id === BANANA).agents[0].state, 'working')
  assert.equal(game.getView().characters['pane-1'].state, 'working')
  assert.equal(game.getView().rooms[BANANA].party, 'fighting')
})

test('an agent known only from the snapshot earns its estimate and shows the state the store has', async () => {
  const setupResult = setup({ access: ESTIMATED })
  const { game, store, tick } = setupResult
  await game.round()
  tick(1)
  // A session Orca lost track of: no event or hook ever names it, only its terminal.
  store.sync('local', bananaRow('pane-7', 'working', { conversationName: 'Release notes' }))
  tick(MINUTE / 2)
  store.sync('local', bananaRow('pane-7', 'working', { conversationName: 'Release notes' }))
  tick(MINUTE / 2)
  await game.round()
  const expected = estimateTokens({ workedMs: { think: MINUTE }, toolCalls: 0, minutes: 1 })
  assert.equal(await savedTokens(setupResult, 'estimated:pane-7'), expected)
  assert.equal(game.getView().characters['pane-7'].state, 'working')
})

test('a character follows its agent between rounds, and so does its party', async () => {
  const setupResult = setup({ access: ESTIMATED })
  const { game, store, tick } = setupResult
  await game.round()
  tick(1)
  writeForAMinute(setupResult)
  await game.round()
  const before = game.getView()
  store.status({ ...PANE, state: 'blocked' })
  const blocked = game.getView()
  assert.notEqual(blocked, before)
  assert.equal(blocked.characters['pane-1'].state, 'blocked')
  assert.equal(blocked.rooms[BANANA].party, 'paused')
  assert.equal(blocked.rooms[BANANA].pausedBy, 'blocked')
  store.status({ ...PANE, state: 'done' })
  assert.equal(game.getView().characters['pane-1'].state, 'idle')
  assert.equal(game.getView().rooms[BANANA].party, 'idle')
})

test('a room that joins with a working agent has its monster in the same state, and its party fights', async () => {
  const setupResult = setup({ access: ESTIMATED })
  const { game, store, tick } = setupResult
  store.status({ workspaceId: 'w-banana', paneKey: 'pane-2', terminalId: 'term-2', state: 'working' })
  await game.round()
  tick(1)
  writeForAMinute(setupResult)
  await game.round()
  const room = game.getView().rooms[BANANA]
  assert.equal(room.joined, true)
  assert.ok(room.monster)
  assert.equal(room.monster.healthShare, 1)
  assert.equal(room.party, 'fighting')
  assert.equal(room.pausedBy, null)
})
