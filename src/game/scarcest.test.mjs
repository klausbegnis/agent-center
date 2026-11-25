import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import {
  SCARCEST_REVIEW_MS,
  followsScarcest,
  gatheredNeed,
  scarcestPicks,
  scarcityOrder,
  withScarcestPicks
} from './scarcest.mjs'
import { cleanSave } from './save-check.mjs'
import { GATHERING_SKILLS } from './skills.mjs'
import { effectiveTrade, setRoomTrade, tradeReason } from './trades.mjs'
import { emptySave, emptyWorld, migrate } from './worlds.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = { monsters: readJson('../../game/monsters.json'), items: readJson('../../game/items.json') }
const engine = createEngine({ content })
const HOUR = 3_600_000
const ROOM = 'rumble-banana'

/** A stock of every gathered material at `amount`, with the changes given. */
const stock = (amount, changes = {}) => ({ ore: amount, fish: amount, crops: amount, logs: amount, hides: amount, runes: amount, ...changes })
const noNeed = { ore: 0, fish: 0, crops: 0, logs: 0, hides: 0, runes: 0 }

test('the scarcest material comes first, and ties keep the order of the trades', () => {
  assert.deepEqual(scarcityOrder(stock(50, { logs: 3 }), noNeed).slice(0, 2), ['woodcutting', 'mining'])
  assert.deepEqual(scarcityOrder(stock(10), noNeed), GATHERING_SKILLS)
})

test('a material no trade yields is never picked, however little of it there is', () => {
  const order = scarcityOrder({ ...stock(50), bars: 0, crystals: 0 }, noNeed)
  assert.deepEqual([...order].sort(), [...GATHERING_SKILLS].sort())
})

test('a material the next buildings ask for counts as scarcer than one with the same stock', () => {
  const order = scarcityOrder(stock(100), { ...noNeed, hides: 80 })
  assert.equal(order[0], 'hunting')
})

test('one character takes the scarcest material', () => {
  assert.deepEqual(scarcestPicks({ order: ['fishing', 'mining', 'farming'], sessionIds: ['s1'] }), { s1: 'fishing' })
})

test('many characters spread over the three scarcest, the scarcest first, in session order', () => {
  const order = ['fishing', 'mining', 'farming', 'hunting', 'runecraft', 'woodcutting']
  const picks = scarcestPicks({ order, sessionIds: ['s4', 's2', 's1', 's3', 's5'] })
  assert.deepEqual(picks, { s1: 'fishing', s2: 'mining', s3: 'farming', s4: 'fishing', s5: 'mining' })
})

test('two characters take the two scarcest', () => {
  assert.deepEqual(scarcestPicks({ order: ['runecraft', 'hunting', 'fishing'], sessionIds: ['b', 'a'] }),
    { a: 'runecraft', b: 'hunting' })
})

test('what the buildings ask covers every gathered material', () => {
  const need = gatheredNeed({ ...emptyWorld(), upgrades: {} })
  assert.deepEqual(Object.keys(need).sort(), ['crops', 'fish', 'hides', 'logs', 'ore', 'runes'])
  assert.ok(Object.values(need).every((amount) => amount > 0))
})

/** A room with characters s1..sN; `choice` is the room's trade choice. */
function room(count, choice = 'scarcest', own = {}) {
  const characters = Object.fromEntries(Array.from({ length: count }, (_, index) => {
    const sessionId = `s${index + 1}`
    return [sessionId, { sessionId, trade: 'mining', tradeChoice: own[sessionId] ?? null }]
  }))
  return { tradeChoice: choice, characters }
}

test('a character with its own trade keeps it, and only followers get a pick', () => {
  const project = withScarcestPicks(room(2, 'scarcest', { s1: 'farming' }), { ...emptyWorld(), materials: stock(5) }, 0)
  assert.deepEqual(Object.keys(project.scarcest.picks), ['s2'])
  assert.equal(effectiveTrade(project.characters.s1, project), 'farming')
  assert.equal(tradeReason(project.characters.s1, project), 'own')
  assert.equal(tradeReason(project.characters.s2, project), 'scarcest')
  assert.equal(followsScarcest(project.characters.s1, project), false)
})

test('a character may choose what is scarcest in a room that has another choice', () => {
  const project = withScarcestPicks(room(1, 'fishing', { s1: 'scarcest' }), { ...emptyWorld(), materials: stock(9, { runes: 1 }) }, 0)
  assert.equal(effectiveTrade(project.characters.s1, project), 'runecraft')
})

test('the picks are kept for an hour of game time, then made again from the stock then', () => {
  const world = { ...emptyWorld(), materials: stock(50, { logs: 0 }) }
  const first = withScarcestPicks(room(1), world, 0)
  assert.equal(first.scarcest.picks.s1, 'woodcutting')
  const later = { ...world, materials: stock(50, { fish: 0, logs: 90 }) }
  assert.equal(withScarcestPicks(first, later, SCARCEST_REVIEW_MS - 1), first)
  assert.equal(withScarcestPicks(first, later, SCARCEST_REVIEW_MS).scarcest.picks.s1, 'fishing')
})

test('a new follower gets a pick at once, and a room nobody follows it in keeps no picks', () => {
  const world = { ...emptyWorld(), materials: stock(5) }
  const first = withScarcestPicks(room(1), world, 0)
  const grown = { ...first, characters: { ...first.characters, ...room(2).characters } }
  assert.deepEqual(Object.keys(withScarcestPicks(grown, world, 10).scarcest.picks), ['s1', 's2'])
  const back = withScarcestPicks({ ...first, tradeChoice: null }, world, 10)
  assert.equal(Object.hasOwn(back, 'scarcest'), false)
  const never = room(1, null)
  assert.equal(withScarcestPicks(never, world, 0), never)
})

test('before the room has a pick, a follower gathers its own Auto trade', () => {
  const project = room(1)
  assert.equal(effectiveTrade(project.characters.s1, project), 'mining')
})

/** A save whose room has idle characters for each session, having spent some tokens. */
function playing(...sessionIds) {
  let save = emptySave()
  for (const sessionId of sessionIds) {
    save = engine.applyTokens(save, { projectId: ROOM, sessionId, tokens: 200_000, activity: 'write', now: 0 })
  }
  return save
}

test('idle followers gather the scarcest material, and the save passes the check with its picks', () => {
  let save = playing('s1')
  save.worlds.main.materials = { ...save.worlds.main.materials, ...stock(40, { hides: 0 }) }
  save = setRoomTrade(save, { projectId: ROOM, trade: 'scarcest' })
  const before = save.worlds.main.materials.hides
  save = engine.advance(save, { from: 0, to: HOUR, sessions: [{ projectId: ROOM, sessionId: 's1', state: 'idle' }] })
  assert.ok(save.worlds.main.materials.hides > before)
  assert.equal(save.worlds.main.projects[ROOM].scarcest.picks.s1, 'hunting')
  const checked = cleanSave(save)
  assert.equal(checked.ok, true, checked.problem)
  assert.deepEqual(checked.save.worlds.main.projects[ROOM].scarcest, save.worlds.main.projects[ROOM].scarcest)
})

test('the save check refuses picks that are not gathering skills, and an old save loads without any', () => {
  let save = setRoomTrade(playing('s1'), { projectId: ROOM, trade: 'scarcest' })
  save = engine.advance(save, { from: 0, to: HOUR, sessions: [{ projectId: ROOM, sessionId: 's1', state: 'idle' }] })
  const damaged = structuredClone(save)
  damaged.worlds.main.projects[ROOM].scarcest.picks.s1 = 'forge'
  assert.match(cleanSave(damaged).problem, /scarcest\.picks\.s1 is not one the game knows/)
  const old = playing('s1')
  assert.equal(Object.hasOwn(cleanSave(old).save.worlds.main.projects[ROOM], 'scarcest'), false)
  assert.equal(migrate(save).worlds.main.projects[ROOM].tradeChoice, 'scarcest')
})
