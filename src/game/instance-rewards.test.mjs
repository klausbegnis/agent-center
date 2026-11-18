import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { killsOf } from './bestiary.mjs'
import { BOSS_ITEM_CHANCE } from './constants.mjs'
import { createEngine } from './engine.mjs'
import { instanceIndexOf } from './instance-content.mjs'
import { INSTANCE_BOSS_ITEM_MAX } from './instance-constants.mjs'
import { bossItemChance, tierFactor, vaultItemChance } from './instance-rewards.mjs'
import { INSTANCE_REFUSALS, openness } from './instance-run.mjs'
import { legendaryOf } from './legendary.mjs'
import { emptySave } from './worlds.mjs'

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
const MINUTE = 60_000
const START = 400 * 24 * 3_600_000
const ROOM = 'local:/work/rumble-banana'
const SESSIONS = ['first', 'second', 'third', 'fourth', 'fifth']
const ACTIVITIES = ['write', 'read', 'run', 'think', 'delegate']
const sessions = SESSIONS.map((sessionId) => ({ projectId: ROOM, sessionId, state: 'working', tokensPerMinute: 20_000 }))

/** A strong party of five, its world far above every instance's level. */
function strongParty() {
  let save = emptySave()
  for (const [at, sessionId] of SESSIONS.entries()) {
    save = engine.applyTokens(save, { projectId: ROOM, sessionId, tokens: 200_000_000, activity: ACTIVITIES[at], now: START })
  }
  return save
}

/** Enters an instance and plays until the run ends, with Auto taking the boons. */
function clear(save, instanceId, { tier = 1, from = START } = {}) {
  let next = engine.enterInstance(save, { projectId: ROOM, instanceId, tier })
  assert.ok(next.worlds.main.projects[ROOM].run, engine.enterProblem(save, { projectId: ROOM, instanceId, tier }))
  const events = []
  for (let minute = 0; next.worlds.main.projects[ROOM].run && minute < 600; minute++) {
    const moved = engine.advanceWithEvents(next, { from: from + minute * MINUTE, to: from + (minute + 1) * MINUTE, sessions, autoPlay: true })
    next = moved.save
    events.push(...moved.events)
  }
  const end = events.find((event) => event.type === 'instance' && (event.kind === 'cleared' || event.kind === 'failed'))
  return { save: next, events, end }
}
const project = (save) => save.worlds.main.projects[ROOM]

test('the first clear gives the room the instance\'s relic, which is active when it is the room\'s first', () => {
  const { save, end } = clear(strongParty(), 'sunken-crypt')
  assert.equal(end.kind, 'cleared')
  assert.ok(end.found.legendary.includes('tidewake-bell'))
  assert.ok(legendaryOf(project(save)).relics.includes('tidewake-bell'))
  assert.equal(legendaryOf(project(save)).active, legendaryOf(project(save)).relics[0])
})

test('a later clear gives no second relic, but its purse of materials and coins', () => {
  const first = clear(strongParty(), 'sunken-crypt')
  const coins = first.save.worlds.main.coins
  const second = clear(first.save, 'sunken-crypt', { from: START + 10 * 3_600_000 })
  assert.equal(second.end.kind, 'cleared')
  assert.ok(!second.end.found.legendary.includes('tidewake-bell'))
  assert.ok(second.end.found.coins > 0 && Object.keys(second.end.found.materials).length > 0)
  assert.ok(second.save.worlds.main.coins >= coins + second.end.found.coins)
  assert.equal(second.save.worlds.main.instances['sunken-crypt'].clears, 2)
})

test('a room that already owns the relic gets coins on the first clear instead', () => {
  const save = strongParty()
  const owning = { ...save, worlds: { main: { ...save.worlds.main, projects: { [ROOM]: { ...project(save), legendary: { relics: ['tidewake-bell'], active: 'tidewake-bell', relicPity: 0, bossPity: 0 } } } } } }
  const plain = clear(save, 'sunken-crypt').end.found.coins
  const { end } = clear(owning, 'sunken-crypt')
  assert.ok(!end.found.legendary.includes('tidewake-bell'))
  assert.ok(end.found.coins > plain, `${end.found.coins} against ${plain}`)
})

test('clearing an instance opens the next on the road; the last cleared leaves nothing closed', () => {
  let save = strongParty()
  const foundry = index.byId.get('emberdeep-foundry')
  assert.equal(openness(save.worlds.main, foundry, index).reason, INSTANCE_REFUSALS.closed)
  let from = START
  const firstRegion = index.regions[0].instanceIds
  for (const id of firstRegion) {
    const ran = clear(save, id, { from })
    assert.equal(ran.end.kind, 'cleared', id)
    save = ran.save
    from += 12 * 3_600_000
  }
  for (const id of firstRegion) assert.equal(openness(save.worlds.main, index.byId.get(id), index).open, true)
  // The first road complete unlocks the next region: its first instance waits only for the world's level.
  const next = index.byId.get(index.regions[1].instanceIds[0])
  assert.notEqual(openness(save.worlds.main, next, index).reason, INSTANCE_REFUSALS.regionLocked)
  const relics = legendaryOf(project(save)).relics
  for (const id of firstRegion) assert.ok(relics.includes(index.byId.get(id).relic), id)
})

test('a clear credits the instance\'s races with champions in the bestiary', () => {
  const save = strongParty()
  const { save: after, events } = clear(save, 'sunken-crypt')
  const kills = events.filter((event) => event.type === 'kill' && event.instance)
  const counted = ['skeleton', 'zombie', 'ghost'].reduce((sum, race) => sum + killsOf(after.worlds.main.bestiary.races[race]), 0)
  const runKillsOfRaces = kills.filter((event) => event.rank !== 'boss' && event.rank !== 'champion').length + 2
  assert.ok(counted >= runKillsOfRaces + 3, `${counted} counted`)
})

test('the boss\'s own item and the vault\'s are never a second copy, and come back more often at higher tiers', () => {
  assert.ok(INSTANCE_BOSS_ITEM_MAX < BOSS_ITEM_CHANCE.boss, 'rarer than a wave boss\'s: a run meets its boss far more often')
  assert.ok(bossItemChance(5) > bossItemChance(1))
  assert.equal(bossItemChance(1000), INSTANCE_BOSS_ITEM_MAX)
  assert.ok(vaultItemChance(4) > vaultItemChance(1))
  assert.ok(tierFactor(3) > tierFactor(1))
  let save = strongParty()
  const owned = new Map()
  for (let run = 0; run < 8; run++) {
    const ran = clear(save, 'sunken-crypt', { from: START + run * 12 * 3_600_000 })
    save = ran.save
    for (const id of ran.end.found.legendary) owned.set(id, (owned.get(id) ?? 0) + 1)
  }
  for (const [id, count] of owned) assert.equal(count, 1, id)
  const chest = project(save).chest.filter((item) => item.legendary)
  assert.equal(new Set(chest.map((item) => item.entryId)).size, chest.length)
})
