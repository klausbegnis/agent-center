import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import { instanceIndexOf } from './instance-content.mjs'
import { instanceMonster, runLevel } from './instance-monsters.mjs'
import {
  REMATCH_REFUSALS,
  REMATCH_TIERS,
  progressAfterClear,
  rematchBonuses,
  rematchItemChance,
  rematchOpensAt,
  rematchProblem,
  rematchReward,
  rematchTier,
  romanOf
} from './instance-rematch.mjs'
import { runContext } from './instance-run.mjs'
import { worldInstancesView } from './instance-view.mjs'
import { worldLevel } from './progression.mjs'
import { emptySave, migrate } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('monsters.json'),
  items: readJson('items.json'),
  races: readJson('races.json'),
  bosses: readJson('bosses.json'),
  legendary: readJson('legendary.json'),
  bestiary: readJson('bestiary.json'),
  instances: readJson('instances.json')
}
const engine = createEngine({ content })
const index = instanceIndexOf(content)
const crypt = index.byId.get('sunken-crypt')
const START = 400 * 24 * 3_600_000
const MINUTE = 60_000
const ROOM = 'local:/work/rumble-banana'
const SESSIONS = ['first', 'second', 'third', 'fourth', 'fifth']
const ACTIVITIES = ['write', 'read', 'run', 'think', 'delegate']

/** A party of five whose world has beaten the crypt's boss `clears` times, with its best rematch. */
function beaten({ clears = 1, rematch, tokens = 6_000_000 } = {}) {
  let save = emptySave()
  for (const [at, sessionId] of SESSIONS.entries()) {
    save = engine.applyTokens(save, { projectId: ROOM, sessionId, tokens, activity: ACTIVITIES[at], now: START })
  }
  const progress = { runs: clears, clears, bestTier: clears ? 1 : 0, ...(rematch ? { rematch } : {}) }
  save.worlds.main.instances = { 'sunken-crypt': progress }
  return save
}
const levelOf = (save) => worldLevel(save.worlds.main.skills)

test('the rematch ladder runs from I to X, each two tiers above the last', () => {
  assert.equal(REMATCH_TIERS, 10)
  assert.deepEqual([1, 2, 10].map(rematchTier), [3, 5, 21])
  assert.deepEqual([1, 4, 10].map(romanOf), ['I', 'IV', 'X'])
})

test('each rematch opens at a higher world level, scaled to the instance', () => {
  const levels = Array.from({ length: REMATCH_TIERS }, (_, at) => rematchOpensAt(crypt, at + 1))
  assert.ok(levels.every((level, at) => at === 0 || level > levels[at - 1]))
  assert.ok(levels[0] > crypt.opensAt)
  const spire = index.byId.get('wyrmrest-spire')
  assert.ok(rematchOpensAt(spire, 10) > rematchOpensAt(crypt, 10) * 5)
})

test('a rematch needs the boss beaten, the rematch below cleared and the world\'s level', () => {
  const progress = { runs: 1, clears: 1, bestTier: 1 }
  const high = 1000
  assert.equal(rematchProblem({ runs: 0, clears: 0, bestTier: 0 }, crypt, 1, high), REMATCH_REFUSALS.notBeaten)
  assert.equal(rematchProblem(progress, crypt, 1, high), null)
  assert.equal(rematchProblem(progress, crypt, 2, high), REMATCH_REFUSALS.order)
  assert.equal(rematchProblem({ ...progress, rematch: 1 }, crypt, 2, high), null)
  assert.equal(rematchProblem(progress, crypt, 1, rematchOpensAt(crypt, 1) - 1), REMATCH_REFUSALS.level)
  assert.equal(rematchProblem(progress, crypt, 11, high), REMATCH_REFUSALS.rematch)
  assert.equal(rematchProblem(progress, crypt, 0, high), REMATCH_REFUSALS.rematch)
})

test('the boss is tougher each rematch, and its odds at its own item better, within a cap', () => {
  assert.equal(rematchBonuses({}).bossHp, 1)
  assert.ok(rematchBonuses({ rematch: 5 }).bossHp > rematchBonuses({ rematch: 4 }).bossHp)
  assert.equal(rematchItemChance(0.004, 0), 0.004)
  assert.ok(rematchItemChance(0.006, 3) > rematchItemChance(0.006, 2))
  assert.ok(rematchItemChance(0.006, 1) > 0.006, 'better than the same tier outside a rematch')
  assert.ok(Math.abs(rematchItemChance(0.012, 10) - 0.03) < 1e-12, 'Rematch X at its tier rolls 3%')
  assert.ok(rematchItemChance(1, 10) <= 0.03, 'never more than the most')
  const monster = (rematch) => instanceMonster({
    instance: crypt, roomKind: 'boss', seed: 'same', level: 20, partySize: 4, content,
    bonuses: runContext({ instance: 'sunken-crypt', tier: 3, room: 5, boon: null, ...(rematch ? { rematch } : {}) }, index).bonuses,
    referencePartyHit: () => ({ total: 10 })
  })
  assert.ok(monster(3).maxHp > monster(0).maxHp)
})

test('a rematch pays its tier-clear reward only the first time, and more for a higher one', () => {
  const first = rematchReward({ rematch: 2 }, { clears: 3, rematch: 1 }, 20)
  assert.ok(first.kills > 0 && first.coins > 0 && first.champions > 0)
  assert.ok(rematchReward({ rematch: 3 }, { clears: 3, rematch: 2 }, 20).coins > first.coins)
  assert.deepEqual(rematchReward({ rematch: 2 }, { clears: 3, rematch: 2 }, 20), { kills: 0, coins: 0, champions: 0 })
  assert.deepEqual(rematchReward({ tier: 4 }, { clears: 3 }, 20), { kills: 0, coins: 0, champions: 0 })
})

test('a rematch clear records the best rematch and leaves the best tier alone', () => {
  const progress = { runs: 4, clears: 3, bestTier: 2 }
  assert.deepEqual(progressAfterClear(progress, { tier: 7, rematch: 3 }), { runs: 4, clears: 4, bestTier: 2, rematch: 3 })
  assert.deepEqual(progressAfterClear({ ...progress, rematch: 3 }, { tier: 3, rematch: 1 }).rematch, 3)
  assert.deepEqual(progressAfterClear(progress, { tier: 3 }), { runs: 4, clears: 4, bestTier: 3 })
})

test('entering a rematch plays the instance at its tier; it is refused before the boss is beaten', () => {
  const save = beaten()
  assert.ok(levelOf(save) >= rematchOpensAt(crypt, 1), 'the test world is high enough for Rematch I')
  const entry = { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1, rematch: 1 }
  assert.equal(engine.enterProblem(beaten({ clears: 0 }), entry), REMATCH_REFUSALS.notBeaten)
  assert.equal(engine.enterProblem(save, { ...entry, rematch: 2 }), REMATCH_REFUSALS.order)
  const inside = engine.enterInstance(save, entry)
  const run = inside.worlds.main.projects[ROOM].run
  assert.equal(run.rematch, 1)
  assert.equal(run.tier, rematchTier(1))
  assert.equal(runLevel(levelOf(save), run.tier), levelOf(save) + 3 + 2 * (rematchTier(1) - 1))
})

test('a rematch run and the best rematch survive a reload and pass the save check', () => {
  const save = engine.enterInstance(beaten({ clears: 2, rematch: 1 }), { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1, rematch: 2 })
  const sessions = SESSIONS.map((sessionId) => ({ projectId: ROOM, sessionId, state: 'working', tokensPerMinute: 20_000 }))
  const played = engine.advance(save, { from: START, to: START + 5 * MINUTE, sessions })
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(played))), played)
  const checked = engine.cleanSave(played)
  assert.equal(checked.ok, true, checked.problem)
  assert.deepEqual(checked.save, played)
})

test('the save check refuses a rematch the engine would not write', () => {
  const refused = (change) => {
    const copy = structuredClone(engine.enterInstance(beaten({ clears: 2, rematch: 1 }),
      { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1, rematch: 2 }))
    change(copy)
    return engine.cleanSave(copy)
  }
  const progress = (copy) => copy.worlds.main.instances['sunken-crypt']
  assert.match(refused((copy) => { progress(copy).rematch = 11 }).problem, /progress/)
  assert.match(refused((copy) => { progress(copy).rematch = 0 }).problem, /progress/)
  assert.match(refused((copy) => { progress(copy).rematch = 5 }).problem, /progress/, 'more rematches than clears')
  assert.match(refused((copy) => { copy.worlds.main.projects[ROOM].run.tier = 9 }).problem, /run/)
  assert.match(refused((copy) => { copy.worlds.main.projects[ROOM].run.rematch = 'x' }).problem, /run/)
})

test('an old save without rematches loads unchanged', () => {
  const save = beaten({ clears: 2 })
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(save))), save)
  assert.equal(engine.cleanSave(save).ok, true)
})

test('the roadmap shows the best rematch and the next one with why each room cannot go', () => {
  const view = worldInstancesView('main', beaten({ clears: 2, rematch: 1 }).worlds.main, content)
  const entry = view.list.find((each) => each.id === 'sunken-crypt')
  assert.equal(entry.rematch, 1)
  assert.equal(entry.nextRematch.rematch, 2)
  assert.equal(entry.nextRematch.tier, rematchTier(2))
  assert.equal(entry.nextRematch.entry[ROOM], null)
  const foundry = view.list.find((each) => each.id === 'emberdeep-foundry')
  assert.equal(foundry.rematch, 0)
  assert.equal(foundry.nextRematch, null, 'no rematch before its boss is beaten')
})
