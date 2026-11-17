import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import { assignProject, emptySave, migrate, resetWorld } from './worlds.mjs'

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
const { instances: _instances, ...withoutInstances } = content
const plainEngine = createEngine({ content: withoutInstances })
const MINUTE = 60_000
const START = 400 * 24 * 3_600_000
const ROOM = 'local:/work/rumble-banana'
const OTHER = 'local:/work/turbo-waffle'
const SESSIONS = ['first', 'second', 'third', 'fourth', 'fifth']
const ACTIVITIES = ['write', 'read', 'run', 'think', 'delegate']

/** A room inside the Sunken Crypt, some way in, with another room on its waves. */
function inside() {
  let save = emptySave()
  for (const [at, sessionId] of SESSIONS.entries()) {
    save = engine.applyTokens(save, { projectId: ROOM, sessionId, tokens: 6_000_000, activity: ACTIVITIES[at], now: START })
  }
  save = engine.applyTokens(save, { projectId: OTHER, sessionId: 'sixth', tokens: 1_000_000, activity: 'write', now: START })
  save = engine.enterInstance(save, { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 })
  const sessions = SESSIONS.map((sessionId) => ({ projectId: ROOM, sessionId, state: 'working', tokensPerMinute: 20_000 }))
  for (let minute = 0; minute < 20; minute++) {
    save = engine.advance(save, { from: START + minute * MINUTE, to: START + (minute + 1) * MINUTE, sessions })
  }
  return save
}
const roomOf = (save, room = ROOM) => save.worlds.main.projects[room]
const changed = (save, change) => {
  const copy = structuredClone(save)
  change(copy)
  return copy
}

test('a save from before instances loads with none, and a played one round-trips unchanged', () => {
  const old = migrate(JSON.parse(JSON.stringify(emptySave())))
  assert.deepEqual(old, emptySave())
  const save = inside()
  assert.ok(roomOf(save).run)
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(save))), save)
})

test('migrating drops a run that cannot be played, the room back on the monster it left', () => {
  const save = changed(inside(), (copy) => { roomOf(copy).run.tier = 'high' })
  const repaired = migrate(save)
  assert.equal(roomOf(repaired).run, undefined)
  assert.deepEqual(roomOf(repaired).monster, roomOf(inside()).run.frozen.monster)
  const cooled = migrate(changed(inside(), (copy) => { roomOf(copy, OTHER).instanceCooldowns = { 'sunken-crypt': 1000, x: -4 } }))
  assert.deepEqual(roomOf(cooled, OTHER).instanceCooldowns, { 'sunken-crypt': 1000 })
})

test('the save check passes a played save with a run, unchanged', () => {
  const save = inside()
  const checked = engine.cleanSave(save)
  assert.equal(checked.ok, true, checked.problem)
  assert.deepEqual(checked.save, save)
})

test('the save check refuses a run or progress the engine would not write', () => {
  const refused = (change) => engine.cleanSave(changed(inside(), change))
  assert.match(refused((copy) => { roomOf(copy).run.instance = 'atlantis' }).problem, /run/)
  assert.match(refused((copy) => { roomOf(copy).run.room = 9 }).problem, /run/)
  assert.match(refused((copy) => { roomOf(copy).run.boon = 'cheat-code' }).problem, /boon/)
  assert.match(refused((copy) => { roomOf(copy).run.found.legendary = ['nothing-real'] }).problem, /found/)
  assert.match(refused((copy) => { copy.worlds.main.instances['sunken-crypt'].clears = 5 }).problem, /progress/)
  assert.match(refused((copy) => { copy.worlds.main.instances.atlantis = { runs: 1, clears: 0, bestTier: 0 } }).problem, /instance/)
  assert.match(refused((copy) => { roomOf(copy, OTHER).instanceCooldowns = { 'sunken-crypt': 9e12 } }).problem, /cooldown/)
  assert.match(refused((copy) => { roomOf(copy, OTHER).run = structuredClone(roomOf(copy).run) }).problem, /two rooms/)
  assert.equal(plainEngine.cleanSave(inside()).ok, false, 'a game without instances refuses a save with a run')
})

test('a world reset forgets its instances with its rooms', () => {
  const reset = resetWorld(inside(), 'main')
  assert.equal(reset.worlds.main.instances, undefined)
  assert.deepEqual(reset.worlds.main.projects, {})
})

test('a room moved to another world or out of the game leaves its instance, its wave as it was', () => {
  const save = inside()
  const frozen = roomOf(save).run.frozen
  const moved = assignProject(save, ROOM, 'side')
  const room = moved.worlds.side.projects[ROOM]
  assert.equal(room.run, undefined)
  assert.deepEqual([room.wave, room.monster], [frozen.wave, frozen.monster])
  const out = assignProject(save, ROOM, null)
  assert.equal(roomOf(out).run, undefined)
  assert.equal(engine.enterProblem(out, { projectId: OTHER, instanceId: 'sunken-crypt', tier: 1 }) !== 'another room is inside it', true)
})

test('a room left behind inside an instance frees it when its chest moves', () => {
  const save = inside()
  const moved = engine.moveProjectItems(save, { fromProjectId: ROOM, toProjectId: OTHER, now: START + 3_600_000 })
  assert.equal(moved.worlds.main.projects[ROOM], undefined)
  assert.notEqual(engine.enterProblem(moved, { projectId: OTHER, instanceId: 'sunken-crypt', tier: 1 }), 'another room is inside it')
})

test('the save stays small: a run adds well under a kilobyte and a half', () => {
  const save = inside()
  const size = JSON.stringify(roomOf(save).run).length + JSON.stringify(save.worlds.main.instances).length
  assert.ok(size < 1_500, `${size} bytes`)
})
