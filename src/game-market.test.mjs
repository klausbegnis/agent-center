import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createAgentStore } from './domain/agent-store.mjs'
import { loadGameEngine } from './game-files.mjs'
import { createGameMode } from './game-mode.mjs'
import { GAME_STORAGE_KEY, STORED_VERSION, createGameSave } from './game-save.mjs'
import { SAVE_VERSION, emptySave, migrate } from './game/worlds.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engine = loadGameEngine(ROOT, (message) => assert.fail(message))
const MINUTE = 60_000
const BANANA = 'local:/work/rumble-banana'
const ANVIL = 'local:/work/fuzzy-anvil'
const WORKSPACES = [{ id: 'w-banana', path: '/work/rumble-banana', hostId: 'local', repoId: 'banana', name: 'main' }]

/**
 * A running game whose banana room has joined, in a world at level 30 that holds materials and
 * coins: Goldmill to Tallwood are open, Runespire is not.
 */
async function marketGame() {
  let save = migrate(emptySave())
  save = engine.applyTokens(save, { projectId: BANANA, sessionId: 's1', tokens: 1_000, activity: 'write', now: 0 })
  save = engine.applyTokens(save, { projectId: ANVIL, sessionId: 'old', tokens: 1_000, activity: 'write', now: 0 })
  const world = save.worlds.main
  for (const skillId of ['forge', 'lore', 'engineering', 'arcana', 'command']) {
    world.skills[skillId] = { level: 20, xp: 0, banked: 0, stars: 0 }
  }
  world.materials = { ore: 5_000, crops: 5_000, fish: 10 }
  world.coins = 1e9
  const storage = new Map([[GAME_STORAGE_KEY, { version: STORED_VERSION, save, bridge: {} }]])
  let clock = 1_000 * MINUTE
  const store = createAgentStore({ now: () => clock })
  store.setWorkspaces(WORKSPACES)
  const settings = { gameMode: true }
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
    readSettings: async () => settings,
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
  store.status({ workspaceId: 'w-banana', paneKey: 'pane-1', state: 'working' })
  await game.round()
  clock += MINUTE
  await game.round()
  return { game, storage }
}

const mainOf = (game) => game.getView().worlds.find((world) => world.id === 'main')
const cityOf = (game, cityId) => mainOf(game).market.cities.find((city) => city.id === cityId)

test('the view shows the world\'s coins and its cities, the open ones with prices and a stall', async () => {
  const { game } = await marketGame()
  const world = mainOf(game)
  assert.equal(world.coins, 1e9)
  assert.deepEqual(world.market.cities.map((city) => [city.id, city.open]),
    [['goldmill', true], ['deepforge', true], ['brinehaven', true], ['tallwood', true], ['runespire', false]])
  assert.equal(cityOf(game, 'goldmill').stall.length, 3)
  assert.equal(cityOf(game, 'runespire').stall, undefined)
})

test('selling, trading and buying from a stall change the game, and are kept in the save', async () => {
  const { game, storage } = await marketGame()
  assert.deepEqual(await game.sellMaterial({ worldId: 'main', cityId: 'goldmill', materialId: 'ore', amount: 1000 }), { changed: true })
  assert.equal(mainOf(game).materials.ore, 4000)
  assert.ok(cityOf(game, 'goldmill').pressure.ore > 0)
  const trade = { worldId: 'main', cityId: 'deepforge', fromId: 'crops', toId: 'ore', amount: 500 }
  assert.deepEqual(await game.tradeMaterial(trade), { changed: true })
  assert.equal(mainOf(game).materials.crops, 4500)
  assert.ok(mainOf(game).materials.ore > 4000)
  const [offer] = cityOf(game, 'goldmill').stall
  const chestBefore = game.getView().rooms[BANANA].chestSize
  const purchase = { worldId: 'main', cityId: 'goldmill', offerIndex: offer.index, entryId: offer.entryId, roomId: BANANA }
  assert.deepEqual(await game.buyStallOffer(purchase), { changed: true })
  assert.equal(game.getView().rooms[BANANA].chestSize, chestBefore + 1)
  assert.equal(cityOf(game, 'goldmill').stall[0].sold, true)
  assert.deepEqual(await game.buyStallOffer(purchase), { changed: false })
  await game.flush()
  assert.equal(storage.get(GAME_STORAGE_KEY).save.worlds.main.market.sold.goldmill.offers[0], offer.index)
})

test('a trade that cannot be made changes nothing', async () => {
  const { game } = await marketGame()
  assert.deepEqual(await game.sellMaterial({ worldId: 'main', cityId: 'runespire', materialId: 'ore', amount: 10 }), { changed: false })
  assert.deepEqual(await game.sellMaterial({ worldId: 'main', cityId: 'goldmill', materialId: 'fish', amount: 11 }), { changed: false })
  assert.deepEqual(await game.tradeMaterial({ worldId: 'main', cityId: 'goldmill', fromId: 'ore', toId: 'logs', amount: 10 }),
    { changed: false })
})

test('market actions naming something that does not exist are refused', async () => {
  const { game } = await marketGame()
  const sale = { worldId: 'main', cityId: 'goldmill', materialId: 'ore', amount: 10 }
  await assert.rejects(game.sellMaterial({ ...sale, worldId: 'nowhere' }), /unknown world/)
  await assert.rejects(game.sellMaterial({ ...sale, cityId: 'atlantis' }), /unknown city/)
  await assert.rejects(game.sellMaterial({ ...sale, materialId: 'gold' }), /unknown material/)
  await assert.rejects(game.sellMaterial({ ...sale, amount: 0 }), /not an amount/)
  await assert.rejects(game.sellMaterial({ ...sale, amount: 1e101 }), /not an amount/)
  await assert.rejects(game.tradeMaterial({ worldId: 'main', cityId: 'goldmill', fromId: 'ore', toId: '__proto__', amount: 1 }),
    /unknown material/)
  const [offer] = cityOf(game, 'goldmill').stall
  const purchase = { worldId: 'main', cityId: 'goldmill', offerIndex: offer.index, entryId: offer.entryId, roomId: BANANA }
  await assert.rejects(game.buyStallOffer({ ...purchase, offerIndex: 3 }), /unknown offer/)
  await assert.rejects(game.buyStallOffer({ ...purchase, roomId: 'local:/made-up' }), /unknown room/)
  await game.assignRoom({ roomId: BANANA, worldId: 'side-projects' })
  await assert.rejects(game.buyStallOffer(purchase), /not a room that plays in this world/)
})

test('an exported game carries its coins and market, and comes back the same', async () => {
  const { game } = await marketGame()
  await game.sellMaterial({ worldId: 'main', cityId: 'goldmill', materialId: 'ore', amount: 1000 })
  const file = JSON.parse(JSON.stringify(await game.exportSave()))
  const exported = file.save.worlds.main
  const other = await marketGame()
  assert.deepEqual(await other.game.importSave(file), { changed: true })
  const exportedAgain = JSON.parse(JSON.stringify(await other.game.exportSave()))
  assert.equal(exportedAgain.save.worlds.main.coins, exported.coins)
  assert.deepEqual(exportedAgain.save.worlds.main.market, exported.market)
})

test('market actions are refused while the game is off', async () => {
  const off = createGameMode({
    engine,
    gameSave: createGameSave({
      storage: { get: async () => null, set: async () => {} },
      migrate,
      saveVersion: SAVE_VERSION,
      log: () => {},
      setTimer: () => null,
      clearTimer: () => {}
    }),
    readSettings: async () => ({}),
    writeSetting: async () => {},
    access: () => ({ supported: false, granted: false }),
    readHistory: async () => ({ ok: true, sessions: [], truncated: false }),
    readWorkspaces: async () => [],
    store: createAgentStore({ now: () => 0 }),
    preferences: { snapshot: () => ({ theme: 'pixel-dark', roomThemes: {} }) },
    now: () => 0,
    log: () => {},
    onChange: () => {}
  })
  await off.round()
  await assert.rejects(off.sellMaterial({ worldId: 'main', cityId: 'goldmill', materialId: 'ore', amount: 1 }), /not running/)
})
