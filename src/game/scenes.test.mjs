import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { monstersFor } from './content.mjs'
import { createEngine } from './engine.mjs'
import { cleanSave } from './save-check.mjs'
import { sceneOrder, sceneThemeOf } from './scenes.mjs'
import { emptySave, migrate, resetWorld } from './worlds.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = { monsters: readJson('../../game/monsters.json'), items: readJson('../../game/items.json') }
const engine = createEngine({ content })

const HOUR = 3_600_000
const THEMES = ['pixel-dark', 'gothic-dungeon', 'guild-hall']
const BANANA = 'local:/work/rumble-banana'
const SESSIONS = ['first', 'second', 'third', 'fourth']

const working = (sessionId, extra = {}) =>
  ({ projectId: BANANA, sessionId, state: 'working', tokensPerMinute: 20_000, ...extra })
const project = (save) => save.worlds.main.projects[BANANA]

/** A room whose four sessions spent tokens, so every class is in its party. */
function partyOfFour() {
  let save = emptySave()
  for (const [index, sessionId] of SESSIONS.entries()) {
    const activity = ['write', 'read', 'run', 'think'][index]
    save = engine.applyTokens(save, { projectId: BANANA, sessionId, tokens: 2_000_000, activity, now: 0 })
  }
  return save
}

test('a room\'s scene order holds every theme once, whatever order the themes are given in', () => {
  const order = sceneOrder(BANANA, THEMES)
  assert.deepEqual([...order].sort(), [...THEMES].sort())
  assert.deepEqual(sceneOrder(BANANA, [...THEMES].reverse()), order)
})

test('consecutive kills never share a scene while there are two themes or more', () => {
  for (const themeIds of [THEMES.slice(0, 2), THEMES, [...THEMES, 'lighthouse', 'harbour']]) {
    for (let kills = 0; kills < 30; kills++) {
      assert.notEqual(sceneThemeOf(BANANA, themeIds, kills), sceneThemeOf(BANANA, themeIds, kills + 1))
    }
  }
})

test('a room walks through every theme before any comes again', () => {
  const themeIds = [...THEMES, 'lighthouse', 'harbour']
  for (let start = 0; start < 12; start++) {
    const stretch = themeIds.map((_, step) => sceneThemeOf(BANANA, themeIds, start + step))
    assert.equal(new Set(stretch).size, themeIds.length)
  }
})

test('a room\'s scene depends only on the room and its kills', () => {
  assert.equal(sceneThemeOf(BANANA, THEMES, 7), sceneThemeOf(BANANA, THEMES, 7))
  const orders = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((roomId) => sceneOrder(roomId, THEMES).join())
  assert.ok(new Set(orders).size > 1, 'rooms do not all travel in the same order')
})

test('with one theme or none a room has one scene or none', () => {
  assert.equal(sceneThemeOf(BANANA, ['pixel-dark'], 5), 'pixel-dark')
  assert.equal(sceneThemeOf(BANANA, [], 5), null)
})

test('every kill adds one to the room\'s kill count', () => {
  const sessions = SESSIONS.map((sessionId) => working(sessionId))
  const result = engine.advanceWithEvents(partyOfFour(), { from: 0, to: HOUR, sessions })
  const kills = result.events.filter((event) => event.type === 'kill').length
  assert.ok(kills >= 2)
  assert.equal(project(result.save).kills, kills)
  assert.equal(engine.view(result.save).worlds[0].projects[0].kills, kills)
})

test('a travelling room is in the scene of its kill count and meets monsters of that scene', () => {
  const travelling = () => SESSIONS.map((sessionId) => working(sessionId, { scenes: THEMES }))
  let save = engine.prepareFights(partyOfFour(), { sessions: travelling() })
  assert.equal(project(save).themeId, sceneThemeOf(BANANA, THEMES, 0))
  const seen = new Set()
  for (let step = 0; step < 6; step++) {
    save = engine.advance(save, { from: step * HOUR, to: (step + 1) * HOUR, sessions: travelling() })
    const { kills, themeId, monster } = project(save)
    assert.equal(themeId, sceneThemeOf(BANANA, THEMES, kills))
    seen.add(themeId)
    const fitting = monstersFor(content.monsters, { kind: monster.kind, themeId }).map((entry) => entry.id)
    assert.ok(fitting.includes(monster.id), `${monster.id} fits ${themeId}`)
  }
  assert.ok(seen.size > 1)
})

test('a room that does not travel keeps the theme it is given', () => {
  const sessions = SESSIONS.map((sessionId) => working(sessionId, { themeId: 'guild-hall' }))
  const save = engine.advance(partyOfFour(), { from: 0, to: HOUR, sessions })
  assert.ok(project(save).kills > 0)
  assert.equal(project(save).themeId, 'guild-hall')
})

test('a save from before the kill count starts it at 0, and a check keeps it', () => {
  const save = partyOfFour()
  const { kills, ...older } = project(save)
  assert.equal(kills, 0)
  const stored = { ...save, worlds: { main: { ...save.worlds.main, projects: { [BANANA]: older } } } }
  assert.equal(project(migrate(stored)).kills, 0)
  const checked = cleanSave(migrate(stored))
  assert.equal(checked.ok, true)
  assert.equal(project(checked.save).kills, 0)
  const withKills = (kills) =>
    ({ ...save, worlds: { main: { ...save.worlds.main, projects: { [BANANA]: { ...older, kills } } } } })
  assert.equal(project(cleanSave(withKills(12)).save).kills, 12)
  assert.equal(cleanSave(withKills(-1)).ok, false)
})

test('a world reset starts the kill count over', () => {
  const sessions = SESSIONS.map((sessionId) => working(sessionId))
  const fought = engine.advance(partyOfFour(), { from: 0, to: HOUR, sessions })
  assert.ok(project(fought).kills > 0)
  const reading = { projectId: BANANA, sessionId: 'first', tokens: 10, activity: 'write', now: 0 }
  const again = engine.applyTokens(resetWorld(fought, 'main'), reading)
  assert.equal(project(again).kills, 0)
})
