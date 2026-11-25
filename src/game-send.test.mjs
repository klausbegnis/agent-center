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
async function setup({ pancakeChest = [], banana = {}, sessionId = null } = {}) {
  let clock = 1_000 * MINUTE
  const save = migrate(emptySave())
  save.worlds.main = {
    ...emptyWorld(),
    projects: {
      [BANANA]: {
        ...emptyProject(),
        chest: [tool('brass-multitool', { level: 2 }), legendaryItemFor(index.byId.get('labyrinth-cleaver'), 10)],
        legendary: { relics: ['tidecall-conch', 'rimeheart'], active: 'tidecall-conch', relicPity: 0, bossPity: 0 },
        ...banana
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
  // A character's session must be running, or the first round retires it.
  if (sessionId) {
    store.status({ workspaceId: 'w-banana', paneKey: 'pane-1', state: 'working', sessionId })
    history.sessions = [{ sessionId, title: null, workspaceId: 'w-banana', totalTokens: 0, createdAt: 0, running: true }]
  }
  await game.round()
  return { game, storage, tick: (ms) => (clock += ms) }
}

const chestIds = (game, roomId) => game.getView().rooms[roomId].chest.map((item) => item.id).sort()

test('a free item sent to another room of the world leaves one chest for the other', async () => {
  const { game } = await setup()
  const answer = await game.sendItem({ roomId: BANANA, toRoomId: PANCAKE, itemIds: ['brass-multitool'] })
  assert.deepEqual(answer, { changed: true, sent: 1, salvaged: 0, sentSalvaged: 0, salvagedItems: [], repicks: [] })
  assert.ok(!chestIds(game, BANANA).includes('brass-multitool'))
  assert.deepEqual(chestIds(game, PANCAKE), ['brass-multitool'])
})

/** Four copies of the multitool at level 5: a target whose cap salvages a weaker one sent. */
const fullOfMultitools = () => [1, 2, 3, 4].map((copy) =>
  tool(copy === 1 ? 'brass-multitool' : `brass-multitool-${copy}`, { entryId: 'brass-multitool', level: 5 }))

test('a preview names the sent item the target would salvage and the materials, and changes nothing', async () => {
  const { game, storage } = await setup({ pancakeChest: fullOfMultitools() })
  const before = JSON.stringify(storage.get(GAME_STORAGE_KEY))
  const preview = await game.previewSendItem({ roomId: BANANA, toRoomId: PANCAKE, itemIds: ['brass-multitool'] })
  assert.equal(preview.problem, null)
  assert.deepEqual(preview.salvaged.map(({ level, isSent }) => [level, isSent]), [[2, true]])
  assert.match(preview.salvaged[0].name, /Multitool/)
  assert.ok(preview.materials > 0)
  assert.equal(JSON.stringify(storage.get(GAME_STORAGE_KEY)), before)
  assert.ok(chestIds(game, BANANA).includes('brass-multitool'))
})

test('a preview of a legendary item the target owns gives the refusal, so it is never sent to be destroyed', async () => {
  const { game } = await setup({ pancakeChest: [legendaryItemFor(index.byId.get('labyrinth-cleaver'), 3)] })
  const preview = await game.previewSendItem({ roomId: BANANA, toRoomId: PANCAKE, itemIds: ['labyrinth-cleaver'] })
  assert.match(preview.problem, /already owns this legendary item/)
})

test('after a send, the answer names each item salvaged and whether it was a sent one', async () => {
  const { game } = await setup({ pancakeChest: fullOfMultitools() })
  const answer = await game.sendItem({ roomId: BANANA, toRoomId: PANCAKE, itemIds: ['brass-multitool'] })
  assert.equal(answer.sentSalvaged, 1)
  assert.deepEqual(answer.salvagedItems.map(({ level, isSent }) => [level, isSent]), [[2, true]])
})

test('a legendary item sent into a room with a full chest shows there at once', async () => {
  const many = Array.from({ length: 14 }, (_, copy) => tool(`spare-${copy}`, { level: 30 }))
  const { game } = await setup({ pancakeChest: many })
  await game.sendItem({ roomId: BANANA, toRoomId: PANCAKE, itemIds: ['labyrinth-cleaver'] })
  assert.ok(chestIds(game, PANCAKE).includes('labyrinth-cleaver'))
})

test('what was sent is saved, and the save still passes the check an imported file must pass', async () => {
  const { game, storage } = await setup()
  await game.sendItem({ roomId: BANANA, toRoomId: PANCAKE, itemIds: ['labyrinth-cleaver'] })
  await game.sendRelic({ roomId: BANANA, toRoomId: PANCAKE, relicId: 'rimeheart' })
  await game.flush()
  const stored = storage.get(GAME_STORAGE_KEY).save
  assert.equal(stored.worlds.main.projects[PANCAKE].chest[0].id, 'labyrinth-cleaver')
  assert.equal(engine.cleanSave(stored).ok, true)
})

test('a relic that is not active can be sent, and arrives active in a room that had none', async () => {
  const { game } = await setup()
  assert.deepEqual(await game.sendRelic({ roomId: BANANA, toRoomId: PANCAKE, relicId: 'rimeheart' }), { changed: true, wasActive: false })
  const view = game.getView()
  assert.deepEqual(view.rooms[BANANA].relics, { owned: ['tidecall-conch'], active: 'tidecall-conch' })
  assert.deepEqual(view.rooms[PANCAKE].relics, { owned: ['rimeheart'], active: 'rimeheart' })
})

test('the active relic can be sent: the answer says it was active and the room keeps none', async () => {
  const { game } = await setup()
  assert.deepEqual(await game.sendRelic({ roomId: BANANA, toRoomId: PANCAKE, relicId: 'tidecall-conch' }),
    { changed: true, wasActive: true })
  const view = game.getView()
  assert.deepEqual(view.rooms[BANANA].relics, { owned: ['rimeheart'], active: null })
  assert.deepEqual(view.rooms[PANCAKE].relics, { owned: ['tidecall-conch'], active: 'tidecall-conch' })
})

test('a legendary item the target owns already is refused with its reason', async () => {
  const { game } = await setup({ pancakeChest: [legendaryItemFor(index.byId.get('labyrinth-cleaver'), 3)] })
  await assert.rejects(game.sendItem({ roomId: BANANA, toRoomId: PANCAKE, itemIds: ['labyrinth-cleaver'] }),
    /already owns this legendary item/)
  assert.ok(chestIds(game, BANANA).includes('labyrinth-cleaver'))
})

test('a room of another world, a room left behind, the same room or a made-up one is refused', async () => {
  const { game } = await setup()
  const send = (toRoomId) => game.sendItem({ roomId: BANANA, toRoomId, itemIds: ['brass-multitool'] })
  await assert.rejects(send(LLAMA), /same world/)
  await assert.rejects(send(GONE), /not a room on screen/)
  await assert.rejects(send(BANANA), /same world/)
  await assert.rejects(send('local:/made-up'), /unknown room/)
})

test('an item that is not in the chest is refused, and nothing is stored for it', async () => {
  const { game } = await setup()
  await assert.rejects(game.sendItem({ roomId: BANANA, toRoomId: PANCAKE, itemIds: ['made-up'] }), /unknown item/)
  await assert.rejects(game.sendRelic({ roomId: BANANA, toRoomId: PANCAKE, relicId: 'made-up' }), /does not own/)
  assert.deepEqual(chestIds(game, PANCAKE), [])
})

test('a held item goes only when confirmed, and the answer names what its holder took instead', async () => {
  const holder = {
    sessionId: 's1', class: 'physical', level: 3, xp: 0, attributes: {}, levelActivityXp: {}, trade: 'mining',
    tokens: 10, bornAt: 0, lastSeenAt: 0, skillXp: {}, gatherCarry: 0, title: null, state: 'idle',
    equipment: { weapon: null, outfit: null, tool: 'brass-multitool' }
  }
  const { game } = await setup({
    banana: {
      chest: [tool('brass-multitool', { level: 2, heldBy: 's1' }), tool('trusty-pocketknife')],
      characters: { s1: holder }
    },
    sessionId: 's1'
  })
  const sending = { roomId: BANANA, toRoomId: PANCAKE, itemIds: ['brass-multitool'] }
  await assert.rejects(game.sendItem(sending), /confirm to take it/)
  const answer = await game.sendItem({ ...sending, confirmHeld: true })
  assert.deepEqual(answer.repicks, [{ sessionId: 's1', slot: 'tool', itemName: 'Trusty Pocketknife' }])
  assert.deepEqual(chestIds(game, PANCAKE), ['brass-multitool'])
})
