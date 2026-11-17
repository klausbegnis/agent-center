import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { killsOf } from './bestiary.mjs'
import { createEngine } from './engine.mjs'
import { emptySave, migrate, resetWorld } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('monsters.json'),
  items: readJson('items.json'),
  races: readJson('races.json'),
  bosses: readJson('bosses.json'),
  legendary: readJson('legendary.json'),
  bestiary: readJson('bestiary.json')
}
const engine = createEngine({ content })
const { bestiary: _bestiary, ...withoutBestiary } = content
const plainEngine = createEngine({ content: withoutBestiary })
const HOUR = 3_600_000
const DAY = 24 * HOUR
const ROOM = 'local:/work/rumble-banana'
const ACTIVITIES = ['write', 'read', 'run', 'think', 'delegate']
const SESSIONS = ['first', 'second', 'third', 'fourth']

/** A party of four that has spent some tokens in a room, at a fixed start. */
function party(chosen = engine) {
  let save = emptySave()
  for (const [index, sessionId] of SESSIONS.entries()) {
    save = chosen.applyTokens(save, { projectId: ROOM, sessionId, tokens: 3_000_000, activity: ACTIVITIES[index], now: 400 * DAY })
  }
  return save
}

/** Hours of the party fighting, from day 400, with every kill event. */
function fight(hours, chosen = engine, start = party(chosen)) {
  const sessions = SESSIONS.map((sessionId) => ({ projectId: ROOM, sessionId, state: 'working', tokensPerMinute: 20_000 }))
  let save = start
  const events = []
  for (let hour = 0; hour < hours; hour++) {
    const from = 400 * DAY + hour * HOUR
    const moved = chosen.advanceWithEvents(save, { from, to: from + HOUR, sessions })
    save = moved.save
    events.push(...moved.events)
  }
  return { save, events }
}

const bestiaryTotal = (bestiary) =>
  Object.values(bestiary.races).reduce((sum, counter) => sum + killsOf(counter), 0) + killsOf(bestiary.others)

test('every kill of a fight is counted once in its world\'s bestiary', () => {
  const { save, events } = fight(6)
  const { bestiary } = save.worlds.main
  assert.ok(events.length > 10)
  assert.equal(bestiaryTotal(bestiary), events.length)
  assert.equal(save.worlds.main.projects[ROOM].kills, events.length)
  for (const counter of Object.values(bestiary.races)) assert.equal(counter[6], 400)
})

test('a kill event says when it was the first of its race', () => {
  const { save, events } = fight(6)
  const discovered = events.flatMap((event) => event.bestiary ?? []).filter((news) => news.discovered && news.kind === 'race')
  assert.deepEqual(discovered.map((news) => news.id).sort(), Object.keys(save.worlds.main.bestiary.races).sort())
})

test('without a bestiary in the content the same fight counts nothing and plays the same', () => {
  const counted = fight(4)
  const plain = fight(4, plainEngine)
  assert.equal(plain.save.worlds.main.bestiary, undefined)
  assert.equal(plain.events.length, counted.events.length)
  assert.ok(plain.events.every((event) => !event.bestiary))
})

test('a save from before the bestiary loads without one, its rooms\' kills kept', () => {
  const { save } = plainEngine.advanceWithEvents(party(plainEngine), {
    from: 400 * DAY, to: 400 * DAY + HOUR, sessions: [{ projectId: ROOM, sessionId: 'first', state: 'working' }]
  })
  const loaded = migrate(JSON.parse(JSON.stringify(save)))
  assert.equal('bestiary' in loaded.worlds.main, false)
  assert.equal(loaded.worlds.main.projects[ROOM].kills, save.worlds.main.projects[ROOM].kills)
})

test('migrating a saved bestiary keeps it as it was', () => {
  const { save } = fight(3)
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(save))).worlds.main.bestiary, save.worlds.main.bestiary)
})

test('a world reset forgets its bestiary with the rest of the world', () => {
  const { save } = fight(3)
  assert.equal(resetWorld(save, 'main').worlds.main.bestiary, undefined)
})

test('a played save with a bestiary passes the save check unchanged', () => {
  const { save } = fight(3)
  assert.deepEqual(engine.cleanSave(save), { ok: true, save })
})

/** The played save with its bestiary changed. */
function withBestiary(change) {
  const save = structuredClone(fight(2).save)
  change(save.worlds.main.bestiary)
  return save
}

test('the save check refuses a bestiary that counts what the game does not have', () => {
  const race = withBestiary((bestiary) => { bestiary.races.kraken = [1, 0, 0, 0, 0, 0, 1] })
  assert.match(engine.cleanSave(race).problem, /bestiary.races.kraken is not a race the game has/)
  const boss = withBestiary((bestiary) => { bestiary.bosses['made-up'] = [1, 0, 1] })
  assert.match(engine.cleanSave(boss).problem, /bestiary.bosses.made-up is not a boss the game has/)
  const key = withBestiary((bestiary) => { bestiary.extra = {} })
  assert.match(engine.cleanSave(key).problem, /bestiary.extra is not something the game keeps/)
})

test('the save check refuses counters the engine would not write', () => {
  const firstRace = (bestiary) => Object.keys(bestiary.races)[0]
  const short = withBestiary((bestiary) => { bestiary.races[firstRace(bestiary)] = [1, 2] })
  assert.match(engine.cleanSave(short).problem, /is not a list the game keeps/)
  const fraction = withBestiary((bestiary) => { bestiary.races[firstRace(bestiary)][0] = 1.5 })
  assert.match(engine.cleanSave(fraction).problem, /is not a whole count/)
  const empty = withBestiary((bestiary) => { bestiary.races[firstRace(bestiary)] = [0, 0, 0, 0, 0, 0, 5] })
  assert.match(engine.cleanSave(empty).problem, /counts no kill/)
  const legendary = withBestiary((bestiary) => { bestiary.bosses.skrix = [1, 2, 400] })
  assert.match(engine.cleanSave(legendary).problem, /bestiary.bosses.skrix.1 is more than its wins/)
  const nothing = withBestiary((bestiary) => { bestiary.races = {}; delete bestiary.others; delete bestiary.filled })
  assert.match(engine.cleanSave(nothing).problem, /counts nothing/)
})

test('a save that keeps a bestiary is refused by a game that has none', () => {
  const { save } = fight(2)
  assert.match(plainEngine.cleanSave(save).problem, /the game has no bestiary/)
})
