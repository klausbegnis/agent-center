import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { instanceEventsOf } from './domain/game-instance-view.mjs'
import { createAgentStore } from './domain/agent-store.mjs'
import { loadGameEngine } from './game-files.mjs'
import { createGameMode } from './game-mode.mjs'
import { GAME_STORAGE_KEY, STORED_VERSION, createGameSave } from './game-save.mjs'
import { SAVE_VERSION, emptyProject, emptySave, migrate } from './game/worlds.mjs'
import { createNetworkView } from './server/network-view.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engine = loadGameEngine(ROOT, (message) => assert.fail(message))
const MINUTE = 60_000
const BANANA = 'local:/work/rumble-banana'
const WORKSPACES = [{ id: 'w-banana', path: '/work/rumble-banana', hostId: 'local', repoId: 'banana', name: 'main' }]
const SKILL = { level: 12, xp: 0, banked: 0, stars: 0 }

/** A game whose world is at level 12 with the banana room playing, after two rounds. */
async function setup({ settings = { gameMode: true, gameAutoSpend: false } } = {}) {
  let clock = 1_000 * MINUTE
  const save = migrate(emptySave())
  const skills = Object.fromEntries(['forge', 'lore', 'engineering', 'arcana', 'command'].map((id) => [id, { ...SKILL }]))
  save.worlds.main = { skills, materials: {}, upgrades: {}, lastTokenAt: null, projects: { [BANANA]: { ...emptyProject({ wave: 12 }) } } }
  const storage = new Map([[GAME_STORAGE_KEY, { version: STORED_VERSION, save, bridge: {} }]])
  const store = createAgentStore({ now: () => clock })
  store.setWorkspaces(WORKSPACES)
  const history = { sessions: [] }
  const game = createGameMode({
    engine,
    gameSave: createGameSave({
      storage: { get: async (key) => storage.get(key) ?? null, set: async (key, value) => storage.set(key, value) },
      migrate, saveVersion: SAVE_VERSION, log: () => {}, setTimer: () => null, clearTimer: () => {}
    }),
    readSettings: async () => settings,
    writeSetting: async () => {},
    access: () => ({ supported: true, granted: true }),
    readHistory: async () => ({ ok: true, sessions: history.sessions, truncated: false }),
    readWorkspaces: async () => [],
    store,
    preferences: { snapshot: () => ({ theme: 'pixel-dark', roomThemes: {} }) },
    now: () => clock,
    log: () => {},
    onChange: () => {}
  })
  store.status({ workspaceId: 'w-banana', paneKey: 'pane-1', state: 'working', sessionId: 's1' })
  history.sessions = [{ sessionId: 's1', title: null, workspaceId: 'w-banana', totalTokens: 0, createdAt: 0, running: true }]
  await game.round()
  let total = 0
  const rounds = async (count) => {
    for (let round = 0; round < count; round++) {
      clock += MINUTE
      total += 400_000
      history.sessions = [{ ...history.sessions[0], totalTokens: total }]
      await game.round()
    }
  }
  await rounds(1)
  return { game, storage, rounds }
}

test('the view state shows the roadmap: the content once, and each world\'s progress', async () => {
  const { game } = await setup()
  const view = game.getView()
  assert.equal(view.instances.instances.length, 6)
  assert.equal(view.instances.region.title, 'Roadwarden')
  const road = view.worlds[0].instances
  assert.deepEqual(road.list.map((entry) => entry.state), ['open', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden'])
  assert.equal(road.map.art, 'ui/instances/roadmap-1.png')
  assert.equal(road.list[0].entry[BANANA], null)
  assert.equal(view.rooms[BANANA].run, null)
})

test('entering an instance through the bridge shows the run, tells it in recent, and is saved', async () => {
  const { game, storage } = await setup()
  assert.deepEqual(await game.enterInstance({ roomId: BANANA, instanceId: 'sunken-crypt', tier: 1 }), { changed: true })
  const view = game.getView()
  assert.equal(view.rooms[BANANA].run.name, 'The Sunken Crypt')
  assert.equal(view.rooms[BANANA].run.room, 0)
  assert.equal(view.worlds[0].instances.list[0].state, 'inside')
  assert.equal(view.worlds[0].instances.list[0].roomInside, BANANA)
  assert.deepEqual(view.recent.at(-1), { ...view.recent.at(-1), type: 'instance', kind: 'enter', roomId: BANANA, worldId: 'main' })
  await game.flush()
  assert.equal(storage.get(GAME_STORAGE_KEY).save.worlds.main.projects[BANANA].run.instance, 'sunken-crypt')
})

test('entering is refused with the rules\' reason, and nothing is stored', async () => {
  const { game } = await setup()
  await assert.rejects(game.enterInstance({ roomId: BANANA, instanceId: 'emberdeep-foundry', tier: 1 }), /not cleared yet/)
  await assert.rejects(game.enterInstance({ roomId: BANANA, instanceId: 'sunken-crypt', tier: 3 }), /tier is not open/)
  await assert.rejects(game.enterInstance({ roomId: BANANA, instanceId: 'atlantis', tier: 1 }), /unknown instance/)
  await assert.rejects(game.enterInstance({ roomId: 'local:/made-up', instanceId: 'sunken-crypt', tier: 1 }), /unknown room/)
  assert.equal(game.getView().rooms[BANANA].run, null)
  const stopped = await setup({ settings: { gameMode: false } })
  await assert.rejects(stopped.game.enterInstance({ roomId: BANANA, instanceId: 'sunken-crypt', tier: 1 }), /not running/)
})

test('rounds of working time move the run on, and its rooms are news in recent', async () => {
  const { game, rounds } = await setup()
  await game.enterInstance({ roomId: BANANA, instanceId: 'sunken-crypt', tier: 1 })
  await rounds(12)
  const view = game.getView()
  const run = view.rooms[BANANA].run
  assert.ok(run === null || run.workedMs > 0)
  assert.ok(view.recent.some((event) => event.type === 'kill' && event.instance === 'sunken-crypt'))
})

test('a boon is refused away from the vault; recalling the party ends the run with a cooldown', async () => {
  const { game } = await setup()
  await game.enterInstance({ roomId: BANANA, instanceId: 'sunken-crypt', tier: 1 })
  await assert.rejects(game.chooseBoon({ roomId: BANANA, boonId: 'second-wind' }), /not at the vault/)
  assert.deepEqual(await game.recallParty({ roomId: BANANA }), { changed: true })
  const view = game.getView()
  assert.equal(view.rooms[BANANA].run, null)
  assert.ok(view.rooms[BANANA].instanceCooldowns['sunken-crypt'] > 0)
  assert.equal(view.recent.at(-1).kind, 'recalled')
  assert.match(view.worlds[0].instances.list[0].entry[BANANA], /recovering/)
  await assert.rejects(game.recallParty({ roomId: BANANA }), /not inside an instance/)
})

test('a page on another machine sees the roadmap and the run, view only', async () => {
  const { game } = await setup()
  await game.enterInstance({ roomId: BANANA, instanceId: 'sunken-crypt', tier: 1 })
  const shown = createNetworkView()({ rooms: [], game: game.getView() }).game
  assert.equal(shown.viewOnly, true)
  assert.equal(shown.rooms[BANANA].run.instance, 'sunken-crypt')
  assert.equal(shown.worlds[0].instances.list[0].state, 'inside')
})

test('an exported game with a run in progress comes back the same', async () => {
  const { game } = await setup()
  await game.enterInstance({ roomId: BANANA, instanceId: 'sunken-crypt', tier: 1 })
  const file = await game.exportSave()
  const other = await setup()
  assert.deepEqual(await other.game.importSave(JSON.parse(JSON.stringify(file))), { changed: true })
  assert.equal(other.game.getView().rooms[BANANA].run.instance, 'sunken-crypt')
})

test('a run\'s events become recent news, with what it found celebrated as legendary drops', () => {
  const event = { type: 'instance', kind: 'cleared', projectId: BANANA, worldId: 'main', instance: 'sunken-crypt', tier: 1, room: 5,
    drops: [{ id: 'tidewake-bell', kind: 'instance-relic' }] }
  const told = instanceEventsOf(event)
  assert.deepEqual(told.map((each) => each.type), ['instance', 'legendary'])
  assert.equal(told[1].item, 'tidewake-bell')
  assert.deepEqual(instanceEventsOf({ ...event, kind: 'retry' }), [])
})
