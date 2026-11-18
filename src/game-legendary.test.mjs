import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createAgentStore } from './domain/agent-store.mjs'
import { loadGameEngine } from './game-files.mjs'
import { createGameMode } from './game-mode.mjs'
import { GAME_STORAGE_KEY, STORED_VERSION, createGameSave } from './game-save.mjs'
import { legendaryItemFor } from './game/legendary-drops.mjs'
import { legendaryIndexOf } from './game/legendary-effects.mjs'
import { SAVE_VERSION, emptyProject, emptySave, migrate } from './game/worlds.mjs'
import { createNetworkView } from './server/network-view.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engine = loadGameEngine(ROOT, (message) => assert.fail(message))
const index = legendaryIndexOf({ legendary: JSON.parse(fs.readFileSync(path.join(ROOT, 'game', 'legendary.json'), 'utf8')) })
const MINUTE = 60_000
const BANANA = 'local:/work/rumble-banana'
const WORKSPACES = [{ id: 'w-banana', path: '/work/rumble-banana', hostId: 'local', repoId: 'banana', name: 'main' }]

/** A game whose stored save gives the banana room two relics and a legendary weapon, after a round. */
async function setup({ settings = { gameMode: true } } = {}) {
  let clock = 1_000 * MINUTE
  const save = migrate(emptySave())
  save.worlds.main = {
    skills: {}, materials: {}, upgrades: {}, lastTokenAt: null,
    projects: {
      [BANANA]: {
        ...emptyProject(),
        chest: [legendaryItemFor(index.byId.get('labyrinth-cleaver'), 10)],
        legendary: { relics: ['tidecall-conch', 'rimeheart'], active: 'tidecall-conch', relicPity: 0, bossPity: 0 }
      }
    }
  }
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
  clock += MINUTE
  history.sessions = [{ ...history.sessions[0], totalTokens: 400_000 }]
  await game.round()
  return { game, storage }
}

test('the view state shows a room\'s relics, the active one, and the entries it needs', async () => {
  const { game } = await setup()
  const view = game.getView()
  assert.deepEqual(view.rooms[BANANA].relics, { owned: ['tidecall-conch', 'rimeheart'], active: 'tidecall-conch' })
  assert.equal(view.legendary.relicCount, 41)
  // The roadmap names the relic of every instance not under fog too, found or not: here the first.
  assert.deepEqual(Object.keys(view.legendary.entries).sort(), ['labyrinth-cleaver', 'rimeheart', 'tidecall-conch', 'tidewake-bell'])
  assert.deepEqual(view.legendary.entries.rimeheart.effect, { effect: 'staminaDrain', scope: 'party', amount: 0.05 })
  assert.equal(view.legendary.entries['labyrinth-cleaver'].boss.name, 'Gorrath')
  const item = view.rooms[BANANA].chest.find((entry) => entry.legendary)
  assert.deepEqual([item.entryId, item.name], ['labyrinth-cleaver', 'Labyrinth Cleaver'])
})

test('choosing the active relic changes it and is saved; the same choice changes nothing', async () => {
  const { game, storage } = await setup()
  assert.deepEqual(await game.setActiveRelic({ roomId: BANANA, relicId: 'rimeheart' }), { changed: true })
  assert.equal(game.getView().rooms[BANANA].relics.active, 'rimeheart')
  await game.flush()
  assert.equal(storage.get(GAME_STORAGE_KEY).save.worlds.main.projects[BANANA].legendary.active, 'rimeheart')
  assert.deepEqual(await game.setActiveRelic({ roomId: BANANA, relicId: 'rimeheart' }), { changed: false })
  assert.deepEqual(await game.setActiveRelic({ roomId: BANANA, relicId: null }), { changed: true })
  assert.equal(game.getView().rooms[BANANA].relics.active, null)
})

test('a relic the room does not own, a made-up room and a game that is off are refused', async () => {
  const { game } = await setup()
  await assert.rejects(game.setActiveRelic({ roomId: BANANA, relicId: 'jawbone-lyre' }), /not a relic the room owns/)
  await assert.rejects(game.setActiveRelic({ roomId: BANANA, relicId: 'labyrinth-cleaver' }), /not a relic the room owns/)
  await assert.rejects(game.setActiveRelic({ roomId: 'local:/made-up', relicId: 'rimeheart' }), /unknown room/)
  const stopped = await setup({ settings: { gameMode: false } })
  await assert.rejects(stopped.game.setActiveRelic({ roomId: BANANA, relicId: 'rimeheart' }), /not running/)
})

test('a page on another machine sees the relics but no session id through a legendary item', async () => {
  const { game } = await setup()
  const shown = createNetworkView()({ rooms: [], game: game.getView() }).game
  assert.equal(shown.viewOnly, true)
  assert.deepEqual(shown.rooms[BANANA].relics.owned, ['tidecall-conch', 'rimeheart'])
  const held = shown.rooms[BANANA].chest.filter((item) => item.heldBy)
  for (const item of held) assert.match(item.heldBy, /^session-/)
})
