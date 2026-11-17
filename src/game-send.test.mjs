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
import { SAVE_VERSION, emptyProject, emptySave, emptyWorld, migrate } from './game/worlds.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engine = loadGameEngine(ROOT, (message) => assert.fail(message))
const index = legendaryIndexOf({ legendary: JSON.parse(fs.readFileSync(path.join(ROOT, 'game', 'legendary.json'), 'utf8')) })
const MINUTE = 60_000
const BANANA = 'local:/work/rumble-banana'
const PANCAKE = 'local:/work/sneaky-pancake'
const LLAMA = 'local:/work/cosmic-llama'
const GONE = 'local:/work/fuzzy-anvil'
const WORKSPACES = [
  { id: 'w-banana', path: '/work/rumble-banana', hostId: 'local', repoId: 'banana', name: 'main' },
  { id: 'w-pancake', path: '/work/sneaky-pancake', hostId: 'local', repoId: 'pancake', name: 'main' },
  { id: 'w-llama', path: '/work/cosmic-llama', hostId: 'local', repoId: 'llama', name: 'main' }
]

const tool = (id, extra = {}) => ({
  id, entryId: id, slot: 'tool', tier: 1, recipe: ['ore', 'logs'], level: 0, heldBy: null, ...extra
})

/**
 * A game with banana and pancake in the main world, llama in another world, and a room left behind
 * (fuzzy-anvil) in the main world. Banana has a spare tool, a legendary weapon and two relics.
 */
async function setup({ pancakeChest = [] } = {}) {
  let clock = 1_000 * MINUTE
  const save = migrate(emptySave())
  save.worlds.main = {
    ...emptyWorld(),
    projects: {
      [BANANA]: {
        ...emptyProject(),
        chest: [tool('brass-multitool', { level: 2 }), legendaryItemFor(index.byId.get('labyrinth-cleaver'), 10)],
        legendary: { relics: ['tidecall-conch', 'rimeheart'], active: 'tidecall-conch', relicPity: 0, bossPity: 0 }
      },
      [PANCAKE]: { ...emptyProject(), chest: pancakeChest },
      [GONE]: { ...emptyProject(), chest: [] }
    }
  }
  save.worlds.side = { ...emptyWorld(), projects: { [LLAMA]: emptyProject() } }
  save.projectWorld = { [BANANA]: 'main', [PANCAKE]: 'main', [GONE]: 'main', [LLAMA]: 'side' }
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
    readSettings: async () => ({ gameMode: true }),
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
  await game.round()
  return { game, storage, tick: (ms) => (clock += ms) }
}

const chestIds = (game, roomId) => game.getView().rooms[roomId].chest.map((item) => item.id).sort()

test('a free item sent to another room of the world leaves one chest for the other', async () => {
  const { game } = await setup()
  const answer = await game.sendItem({ roomId: BANANA, toRoomId: PANCAKE, itemId: 'brass-multitool' })
  assert.deepEqual(answer, { changed: true, salvaged: 0, sentSalvaged: false })
  assert.ok(!chestIds(game, BANANA).includes('brass-multitool'))
  assert.deepEqual(chestIds(game, PANCAKE), ['brass-multitool'])
})

test('what was sent is saved, and the save still passes the check an imported file must pass', async () => {
  const { game, storage } = await setup()
  await game.sendItem({ roomId: BANANA, toRoomId: PANCAKE, itemId: 'labyrinth-cleaver' })
  await game.sendRelic({ roomId: BANANA, toRoomId: PANCAKE, relicId: 'rimeheart' })
  await game.flush()
  const stored = storage.get(GAME_STORAGE_KEY).save
  assert.equal(stored.worlds.main.projects[PANCAKE].chest[0].id, 'labyrinth-cleaver')
  assert.equal(engine.cleanSave(stored).ok, true)
})

test('a relic that is not active can be sent, and arrives active in a room that had none', async () => {
  const { game } = await setup()
  assert.deepEqual(await game.sendRelic({ roomId: BANANA, toRoomId: PANCAKE, relicId: 'rimeheart' }), { changed: true })
  const view = game.getView()
  assert.deepEqual(view.rooms[BANANA].relics, { owned: ['tidecall-conch'], active: 'tidecall-conch' })
  assert.deepEqual(view.rooms[PANCAKE].relics, { owned: ['rimeheart'], active: 'rimeheart' })
})

test('the active relic is refused with its reason', async () => {
  const { game } = await setup()
  await assert.rejects(game.sendRelic({ roomId: BANANA, toRoomId: PANCAKE, relicId: 'tidecall-conch' }), /active relic stays/)
})

test('a legendary item the target owns already is refused with its reason', async () => {
  const { game } = await setup({ pancakeChest: [legendaryItemFor(index.byId.get('labyrinth-cleaver'), 3)] })
  await assert.rejects(game.sendItem({ roomId: BANANA, toRoomId: PANCAKE, itemId: 'labyrinth-cleaver' }),
    /already owns this legendary item/)
  assert.ok(chestIds(game, BANANA).includes('labyrinth-cleaver'))
})

test('a room of another world, a room left behind, the same room or a made-up one is refused', async () => {
  const { game } = await setup()
  const send = (toRoomId) => game.sendItem({ roomId: BANANA, toRoomId, itemId: 'brass-multitool' })
  await assert.rejects(send(LLAMA), /same world/)
  await assert.rejects(send(GONE), /not a room on screen/)
  await assert.rejects(send(BANANA), /same world/)
  await assert.rejects(send('local:/made-up'), /unknown room/)
})

test('an item that is not in the chest is refused, and nothing is stored for it', async () => {
  const { game } = await setup()
  await assert.rejects(game.sendItem({ roomId: BANANA, toRoomId: PANCAKE, itemId: 'made-up' }), /unknown item/)
  await assert.rejects(game.sendRelic({ roomId: BANANA, toRoomId: PANCAKE, relicId: 'made-up' }), /does not own/)
  assert.deepEqual(chestIds(game, PANCAKE), [])
})
