import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
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

/** An orc with almost no health left, so the first fight kills it: the world's first orc. */
const dyingOrc = () => ({
  id: 'orc', name: 'Grey Orc Raider', kind: 'common', rank: 'normal', affix: null, level: 1, maxHp: 1, hp: 0.001,
  physical: 1, magical: 1, attack: 1, reward: 1, dropFactor: 1, loot: { ore: 1 }, race: 'orc',
  sprite: { body: 'blob', accent: '#7a9a3a' }
})

/** A game whose stored world knows goblins and one boss, with an orc about to fall in the banana room. */
async function setup() {
  let clock = 1_000 * MINUTE
  const save = migrate(emptySave())
  save.worlds.main = {
    skills: {}, materials: {}, upgrades: {}, lastTokenAt: null,
    bestiary: { races: { goblin: [12, 0, 1, 0, 0, 0, 0] }, bosses: { skrix: [1, 1, 0] } },
    projects: { [BANANA]: { ...emptyProject(), monster: dyingOrc() } }
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
  store.status({ workspaceId: 'w-banana', paneKey: 'pane-1', state: 'working', sessionId: 's1' })
  history.sessions = [{ sessionId: 's1', title: null, workspaceId: 'w-banana', totalTokens: 0, createdAt: 0, running: true }]
  await game.round()
  clock += MINUTE
  history.sessions = [{ ...history.sessions[0], totalTokens: 400_000 }]
  await game.round()
  const fight = async () => {
    clock += MINUTE
    history.sessions = [{ ...history.sessions[0], totalTokens: history.sessions[0].totalTokens + 400_000 }]
    await game.round()
  }
  return { game, fight }
}

test('the view state carries the bestiary\'s races and bosses once, and each world\'s counts', async () => {
  const { game } = await setup()
  const view = game.getView()
  assert.equal(view.bestiary.races.length, 20)
  assert.equal(view.bestiary.bosses.length, 71)
  assert.ok(view.bestiary.races.every((race) => race.look.rig && race.name))
  const bestiary = view.worlds[0].bestiary
  assert.deepEqual([bestiary.discovered, bestiary.raceCount, bestiary.beaten, bestiary.bossCount], [1, 20, 1, 71])
  const goblin = bestiary.races.find((race) => race.id === 'goblin')
  assert.deepEqual([goblin.kills, goblin.level, goblin.from, goblin.to], [13, 4, 13, 20])
  assert.equal(bestiary.bosses.find((boss) => boss.id === 'skrix').legendary, 1)
})

test('the first orc the world kills is a discovery in the recent events, named', async () => {
  const { game, fight } = await setup()
  await fight()
  const view = game.getView()
  const news = view.recent.filter((event) => event.type === 'bestiary')
  assert.deepEqual(news.filter((event) => event.discovered)
    .map(({ kind, creatureId, discovered, name, roomId }) => ({ kind, creatureId, discovered, name, roomId })),
  [{ kind: 'race', creatureId: 'orc', discovered: true, name: 'Orcs', roomId: BANANA }])
  // Every event keeps its own increasing number, which is how a page tells what is new.
  assert.ok(view.recent.every((event, at) => Number.isInteger(event.id) && (at === 0 || event.id > view.recent[at - 1].id)))
  assert.equal(view.recent.find((event) => event.type === 'kill').bestiary, undefined)
  assert.equal(view.worlds[0].bestiary.discovered, 2)
})

test('a page on another machine sees the bestiary as it is', async () => {
  const { game } = await setup()
  const shown = createNetworkView()({ rooms: [], game: game.getView() }).game
  assert.deepEqual(shown.worlds[0].bestiary, game.getView().worlds[0].bestiary)
  assert.equal(shown.bestiary.bosses.length, 71)
})
