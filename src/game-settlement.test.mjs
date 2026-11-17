import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createAgentStore } from './domain/agent-store.mjs'
import { loadGameEngine } from './game-files.mjs'
import { createGameMode } from './game-mode.mjs'
import { GAME_STORAGE_KEY, STORED_VERSION, createGameSave } from './game-save.mjs'
import { MATERIALS } from './game/skills.mjs'
import { SAVE_VERSION, emptySave, migrate } from './game/worlds.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engine = loadGameEngine(ROOT, (message) => assert.fail(message))
const settlement = JSON.parse(readFileSync(path.join(ROOT, 'game', 'settlement.json'), 'utf8'))
const stageFrom = (id) => settlement.stages.find((stage) => stage.id === id).from
const tierFrom = (tier) => settlement.buildings[0].tiers[tier - 1].from
const MINUTE = 60_000
const BANANA = 'local:/work/rumble-banana'
const WORKSPACES = [{ id: 'w-banana', path: '/work/rumble-banana', hostId: 'local', repoId: 'banana', name: 'main' }]

/** A running game whose banana room has joined, in a world rich in materials with these levels and coins. */
async function settledGame({ upgrades = {}, coins = 0 } = {}) {
  let save = migrate(emptySave())
  save = engine.applyTokens(save, { projectId: BANANA, sessionId: 's1', tokens: 1_000, activity: 'write', now: 0 })
  const world = save.worlds.main
  world.materials = Object.fromEntries(MATERIALS.map((id) => [id, 1e7]))
  world.upgrades = upgrades
  world.coins = coins
  const storage = new Map([[GAME_STORAGE_KEY, { version: STORED_VERSION, save, bridge: {} }]])
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
  store.status({ workspaceId: 'w-banana', paneKey: 'pane-1', state: 'working' })
  await game.round()
  clock += MINUTE
  return { game, storage }
}

const settlementOf = (game) => game.getView().worlds.find((world) => world.id === 'main').settlement
const buildingOf = (game, id) => settlementOf(game).buildings.find((building) => building.id === id)
const newsOf = (game) => game.getView().recent.filter((event) => event.type === 'settlement')

test('a save from before the settlement loads unchanged, with the two new buildings at 0', () => {
  const old = {
    version: SAVE_VERSION,
    worlds: { main: { skills: {}, materials: { fish: 3 }, upgrades: { campfire: 4, workbench: 2, runeCircle: 7 }, projects: {}, lastTokenAt: null } },
    projectWorld: {},
    settings: { keepTitles: false }
  }
  const save = migrate(old)
  assert.deepEqual(save.worlds.main.upgrades, { campfire: 4, workbench: 2, runeCircle: 7 })
  const shown = engine.view(save).worlds[0].settlement
  assert.deepEqual(shown.buildings.map((building) => [building.id, building.level]),
    [['hearth', 4], ['workshop', 2], ['sanctum', 7], ['storehouse', 0], ['defences', 0]])
  assert.equal(shown.total, 13)
  assert.equal(engine.cleanSave(save).ok, true)
})

test('the view gives the stage, the way to the next one and each building with its prices and effects', async () => {
  const { game } = await settledGame({ upgrades: { campfire: tierFrom(2), workbench: 1 }, coins: 10 })
  const shown = settlementOf(game)
  assert.equal(shown.stage.id, 'hamlet')
  assert.equal(shown.stage.number, 3)
  assert.equal(shown.stage.count, settlement.stages.length)
  assert.equal(shown.next.kind, 'stage')
  assert.equal(shown.next.name, 'Village')
  assert.equal(shown.next.have, shown.total - stageFrom('hamlet'))
  assert.equal(shown.next.need, stageFrom('village') - stageFrom('hamlet'))
  assert.ok(shown.bonuses.length >= 2, 'the outpost\'s bonus stays with the hamlet\'s')
  const hearth = buildingOf(game, 'hearth')
  assert.equal(hearth.tier, 2)
  assert.equal(hearth.current.name, 'Cooking hearth')
  assert.equal(hearth.nextTier.from, tierFrom(3))
  assert.ok(hearth.nextEffect.staminaAfterKill > hearth.effect.staminaAfterKill)
  assert.ok(hearth.coinPrice.coins > 0)
  assert.equal(hearth.coinPrice.affordable, false, 'ten coins pay nothing')
  assert.equal(buildingOf(game, 'workshop').coinPrice, null, 'tier I takes no coins')
  const sanctum = buildingOf(game, 'sanctum')
  assert.equal(sanctum.tier, 0)
  assert.equal(sanctum.current.tier, 1, 'an unbuilt building shows its first tier as a teaser')
  assert.equal(buildingOf(game, 'defences').open, true)
  assert.ok(buildingOf(game, 'storehouse').nextEffect.marketFee < buildingOf(game, 'storehouse').effect.marketFee)
})

test('a building the settlement has not opened is a locked teaser, and building it is refused with the reason', async () => {
  const { game } = await settledGame()
  const defences = buildingOf(game, 'defences')
  assert.equal(defences.open, false)
  assert.equal(defences.affordable, false)
  assert.deepEqual(defences.opensAt, { index: 2, id: 'hamlet', name: 'Hamlet', from: stageFrom('hamlet') })
  await assert.rejects(game.buyGroupUpgrade({ worldId: 'main', upgradeId: 'defences' }), /not open/)
  await assert.rejects(game.buyGroupUpgrade({ worldId: 'main', upgradeId: 'campfire', useCoins: true }), /takes no coins/)
})

test('building a tier and a stage by hand is news, celebrated in recent', async () => {
  const { game } = await settledGame()
  assert.deepEqual(await game.buyGroupUpgrade({ worldId: 'main', upgradeId: 'campfire' }), { changed: true })
  const news = newsOf(game)
  assert.deepEqual(news.map((event) => [event.kind, event.name]), [['tier', 'Hearth'], ['stage', 'Outpost']])
  assert.equal(news[0].worldId, 'main')
  assert.equal(news[1].stageId, 'outpost')
})

test('paying part in coins takes them from the world', async () => {
  const { game } = await settledGame({ upgrades: { campfire: tierFrom(2) }, coins: 1e9 })
  const price = buildingOf(game, 'hearth').coinPrice
  assert.deepEqual(await game.buyGroupUpgrade({ worldId: 'main', upgradeId: 'campfire', useCoins: true }), { changed: true })
  const world = game.getView().worlds.find((each) => each.id === 'main')
  assert.equal(world.coins, 1e9 - price.coins)
  assert.equal(buildingOf(game, 'hearth').level, tierFrom(2) + 1)
})

test('an exported game carries its buildings, a world reset clears them, and an import is no news', async () => {
  const levels = { campfire: 9, workbench: 8, runeCircle: 7, storehouse: 4, defences: 3 }
  const { game } = await settledGame({ upgrades: levels })
  const file = JSON.parse(JSON.stringify(await game.exportSave()))
  assert.deepEqual(file.save.worlds.main.upgrades, levels)
  const other = await settledGame()
  assert.deepEqual(await other.game.importSave(file), { changed: true })
  assert.deepEqual(newsOf(other.game), [])
  assert.equal(settlementOf(other.game).total, 31)
  await other.game.resetWorld({ worldId: 'main' })
  assert.equal(settlementOf(other.game).total, 0)
  assert.equal(settlementOf(other.game).stage.id, 'camp')
})

test('an imported save with a building its stage has not opened is refused', async () => {
  const { game } = await settledGame()
  const file = JSON.parse(JSON.stringify(await game.exportSave()))
  file.save.worlds.main.upgrades = { defences: 1 }
  await assert.rejects(game.importSave(file), /settlement has not opened/)
  file.save.worlds.main.upgrades = { moat: 1 }
  await assert.rejects(game.importSave(file), /upgrades/)
})
