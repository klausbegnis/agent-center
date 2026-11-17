import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { GATHER_STOPS_AFTER_HOURS } from './constants.mjs'
import { createEngine } from './engine.mjs'
import { emptySave } from './worlds.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('../../game/monsters.json'),
  items: readJson('../../game/items.json'),
  legendary: readJson('../../game/legendary.json')
}
const engine = createEngine({ content })
const HOUR = 3_600_000
const ROOM = 'rumble-banana'

const tokensFor = (save, reading) =>
  engine.applyTokens(save, { projectId: ROOM, sessionId: 'first', tokens: 1_000_000, activity: 'think', now: 0, ...reading })
const project = (save) => save.worlds.main.projects[ROOM]
/** The save with the room's legendary loot and chest changed. */
function withRoom(save, change) {
  const world = save.worlds.main
  return { ...save, worlds: { main: { ...world, projects: { ...world.projects, [ROOM]: change(project(save)) } } } }
}
const withRelic = (save, relicId) => withRoom(save, (room) => ({ ...room, legendary: { relics: [relicId], active: relicId } }))
const materialTotal = (save) => Object.values(save.worlds.main.materials).reduce((sum, amount) => sum + amount, 0)

test('the Codex gives every character of the room more experience for the same tokens', () => {
  const start = tokensFor(emptySave(), { tokens: 10_000 })
  const plain = tokensFor(start, { tokens: 1_000_000 })
  const codex = tokensFor(withRelic(start, 'codex-of-unwritten-pages'), { tokens: 1_000_000 })
  const gained = (save) => project(save).characters.first.level * 1e6 + project(save).characters.first.xp
  assert.ok(gained(codex) > gained(plain))
})

test('the Moonwane Scepter\'s holder trains arcana faster, and only arcana', () => {
  let start = tokensFor(emptySave(), { tokens: 10_000 })
  const character = project(start).characters.first
  const weaponId = character.equipment.weapon
  start = withRoom(start, (room) => ({
    ...room,
    chest: [...room.chest.filter((item) => item.id !== weaponId), {
      id: 'moonwane-scepter', entryId: 'moonwane-scepter', slot: 'weapon', damageType: 'magical', tier: 1,
      recipe: ['pages', 'crystals'], level: 0, heldBy: 'first', legendary: true
    }],
    characters: { first: { ...character, equipment: { ...character.equipment, weapon: 'moonwane-scepter' } } }
  }))
  const arcanaXp = (save) => save.worlds.main.skills.arcana.level * 1e9 + save.worlds.main.skills.arcana.xp
  const plain = tokensFor(withRoom(start, (room) => ({ ...room, chest: room.chest.map((item) => ({ ...item, legendary: undefined })) })), {})
  const held = tokensFor(start, {})
  assert.ok(arcanaXp(held) > arcanaXp(plain))
})

test('the Millwind Vane keeps idle characters gathering a while past the usual stop', () => {
  const start = tokensFor(emptySave(), {})
  const idle = [{ projectId: ROOM, sessionId: 'first', state: 'idle' }]
  const window = { from: GATHER_STOPS_AFTER_HOURS * HOUR, to: (GATHER_STOPS_AFTER_HOURS + 1) * HOUR, sessions: idle }
  assert.equal(materialTotal(engine.advance(start, window)), materialTotal(start))
  assert.ok(materialTotal(engine.advance(withRelic(start, 'millwind-vane'), window)) > materialTotal(start))
})

test('the Everwarm Anvil makes the room\'s item upgrades cheaper', () => {
  const start = tokensFor(emptySave(), {})
  const costOf = (save) => {
    const room = engine.view(save).worlds[0].projects.find((entry) => entry.id === ROOM)
    return Object.values(room.chest[0].upgradeCost)[0]
  }
  assert.ok(costOf(withRelic(start, 'everwarm-anvil')) < costOf(start))
})

test('the Seventh-Circle Prism cuts more off each new monster with a rune circle', () => {
  const start = tokensFor(emptySave(), {})
  const withCircle = (save) => ({ ...save, worlds: { main: { ...save.worlds.main, upgrades: { runeCircle: 5 } } } })
  const working = { sessions: [{ projectId: ROOM, sessionId: 'first', state: 'working', tokensPerMinute: 20_000 }] }
  const share = (save) => project(engine.prepareFights(save, working)).monster
  const plain = share(withCircle(start))
  const prism = share(withCircle(withRelic(start, 'seventh-circle-prism')))
  assert.ok(prism.hp / prism.maxHp < plain.hp / plain.maxHp)
})

test('a party with Rimeheart rests less often over the same hours', () => {
  let start = emptySave()
  for (const [index, sessionId] of ['a', 'b'].entries()) {
    start = tokensFor(start, { sessionId, activity: ['write', 'think'][index], tokens: 2_000_000 })
  }
  const sessions = ['a', 'b'].map((sessionId) => ({ projectId: ROOM, sessionId, state: 'working', tokensPerMinute: 20_000 }))
  const rests = (save) => engine.advanceWithEvents(save, { from: 0, to: 6 * HOUR, sessions }).events
  const plain = rests(start)
  const eased = rests(withRelic(start, 'rimeheart'))
  assert.ok(eased.length >= plain.length)
})
