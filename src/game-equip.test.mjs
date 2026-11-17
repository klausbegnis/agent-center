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
const WORKSPACES = [{ id: 'w-banana', path: '/work/rumble-banana', hostId: 'local', repoId: 'banana', name: 'main' }]

/** A running game on the estimate whose banana room has two characters, from two working agents. */
async function partyGame() {
  const storage = new Map()
  let clock = 1_000 * MINUTE
  const store = createAgentStore({ now: () => clock })
  store.setWorkspaces(WORKSPACES)
  const game = createGameMode({
    engine,
    gameSave: createGameSave({
      storage: { get: async (key) => storage.get(key) ?? null, set: async (key, value) => storage.set(key, value) },
      migrate,
      saveVersion: SAVE_VERSION,
      log: () => {},
      setTimer: () => null,
      clearTimer: () => {}
    }),
    readSettings: async () => ({ gameMode: true }),
    writeSetting: async () => {},
    access: () => ({ supported: false, granted: false }),
    readHistory: async () => ({ ok: true, sessions: [], truncated: false }),
    readWorkspaces: async () => [],
    store,
    preferences: { snapshot: () => ({ theme: 'pixel-dark', roomThemes: {} }) },
    now: () => clock,
    log: () => {},
    onChange: () => {}
  })
  const panes = ['pane-1', 'pane-2'].map((paneKey) => ({ workspaceId: 'w-banana', paneKey, terminalId: `term-${paneKey}` }))
  for (const pane of panes) store.status({ ...pane, state: 'working' })
  await game.round()
  let call = 0
  for (let round = 0; round < 3; round += 1) {
    for (let step = 0; step < 4; step += 1) {
      for (const pane of panes) store.toolBefore({ ...pane, tool: 'Edit', input: {}, callId: `call-${++call}` })
      clock += MINUTE / 4
    }
    await game.round()
  }
  return { game, storage }
}

const roomOf = (game) => game.getView().rooms[BANANA]
const charactersOf = (game) => Object.values(game.getView().characters).filter((member) => !member.guest)

test('a character\'s slot can be set to a free item, emptied, handed back to Auto, and is saved', async () => {
  const { game, storage } = await partyGame()
  const [member] = charactersOf(game)
  if (!member) return assert.fail('the party has no character')
  const outfit = roomOf(game).chest.find((item) => item.slot === 'outfit')
  assert.deepEqual(await game.setEquipment({ roomId: BANANA, sessionId: member.sessionId, slot: 'outfit', itemId: null }),
    { changed: true })
  let now = charactersOf(game).find((entry) => entry.sessionId === member.sessionId)
  assert.equal(now.equipment.outfit, null)
  assert.deepEqual(now.pinned, { outfit: true })
  await game.setEquipment({ roomId: BANANA, sessionId: member.sessionId, slot: 'outfit', itemId: 'auto' })
  now = charactersOf(game).find((entry) => entry.sessionId === member.sessionId)
  assert.equal(now.equipment.outfit?.id, outfit.id)
  assert.deepEqual(now.pinned, {})
  await game.setEquipment({ roomId: BANANA, sessionId: member.sessionId, slot: 'tool', itemId: null })
  await game.flush()
  const stored = storage.get(GAME_STORAGE_KEY).save.worlds.main.projects[BANANA].characters[member.sessionId]
  assert.deepEqual(stored.pinned, { tool: true })
})

test('best gear for everyone answers how many slots it changed', async () => {
  const { game } = await partyGame()
  const [member] = charactersOf(game)
  await game.setEquipment({ roomId: BANANA, sessionId: member.sessionId, slot: 'outfit', itemId: null })
  await game.setEquipment({ roomId: BANANA, sessionId: member.sessionId, slot: 'outfit', itemId: 'auto' })
  const answer = await game.bestGear({ roomId: BANANA })
  assert.equal(typeof answer.slotsChanged, 'number')
  assert.equal(answer.changed, answer.slotsChanged > 0)
})

test('equipment choices naming something that does not exist, or that the rules refuse, say why', async () => {
  const { game } = await partyGame()
  const [member] = charactersOf(game)
  const choice = { roomId: BANANA, sessionId: member.sessionId, slot: 'weapon', itemId: null }
  await assert.rejects(game.setEquipment({ ...choice, roomId: 'local:/made-up' }), /unknown room/)
  await assert.rejects(game.setEquipment({ ...choice, sessionId: 'nobody' }), /unknown character/)
  await assert.rejects(game.setEquipment({ ...choice, slot: 'ring' }), /unknown slot/)
  await assert.rejects(game.setEquipment({ ...choice, itemId: 'made-up' }), /not an item of this room's chest/)
  await assert.rejects(game.setEquipment({ ...choice, itemId: 7 }), /unknown item/)
  const outfit = roomOf(game).chest.find((item) => item.slot === 'outfit')
  await assert.rejects(game.setEquipment({ ...choice, itemId: outfit.id }), /does not go in the weapon slot/)
  await assert.rejects(game.bestGear({ roomId: 'local:/made-up' }), /unknown room/)
})
