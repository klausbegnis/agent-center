import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import { cleanSave } from './save-check.mjs'
import { emptySave } from './worlds.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = { monsters: readJson('../../game/monsters.json'), items: readJson('../../game/items.json') }
const engine = createEngine({ content })
const HOUR = 3_600_000
const ACTIVITIES = ['write', 'read', 'run', 'think', 'delegate']
const ROOM = 'local:/work/rumble-banana'

/** A save after hours of a four-character party fighting, with a retiree, purchases and a monster. */
function playedSave() {
  let save = emptySave()
  for (const [index, sessionId] of ['first', 'second', 'third', 'fourth'].entries()) {
    save = engine.applyTokens(save, { projectId: ROOM, sessionId, tokens: 3_000_000, activity: ACTIVITIES[index], now: 0 })
  }
  const sessions = ['first', 'second', 'third', 'fourth']
    .map((sessionId) => ({ projectId: ROOM, sessionId, state: 'working', tokensPerMinute: 20_000 }))
  for (let hour = 0; hour < 6; hour++) {
    save = engine.advance(save, { from: hour * HOUR, to: (hour + 1) * HOUR, sessions })
    save = engine.autoSpend(save)
  }
  return engine.closeSession(save, { projectId: ROOM, sessionId: 'fourth', now: 6 * HOUR })
}

/** A copy of the played save with one change made to its room. */
function withRoom(change) {
  const save = structuredClone(playedSave())
  change(save.worlds.main.projects[ROOM])
  return save
}

test('a save the engine wrote comes back unchanged', () => {
  const save = playedSave()
  const project = save.worlds.main.projects[ROOM]
  assert.ok(project.monster, 'the played save has a fight under way')
  assert.ok(project.retirees.length === 1)
  assert.deepEqual(cleanSave(save), { ok: true, save })
})

test('fields the engine does not write are left out', () => {
  const save = withRoom((project) => {
    project.secret = 'kept nowhere'
    Object.values(project.characters)[0].extra = { deep: true }
  })
  const cleaned = cleanSave(save)
  assert.equal(cleaned.ok, true)
  const project = cleaned.save.worlds.main.projects[ROOM]
  assert.equal('secret' in project, false)
  assert.equal(Object.values(project.characters).some((character) => 'extra' in character), false)
})

test('an item held by nobody in the room is refused', () => {
  const save = withRoom((project) => {
    project.chest[0].heldBy = 'made-up-session'
  })
  assert.match(cleanSave(save).problem, /is held by nobody here/)
})

test('equipment that names an item the character does not hold is refused', () => {
  const save = withRoom((project) => {
    const character = Object.values(project.characters)[0]
    const free = project.chest.find((item) => item.heldBy === null && item.slot === 'weapon')
    character.equipment.weapon = free?.id ?? 'not-in-the-chest'
  })
  assert.match(cleanSave(save).problem, /equipment\.weapon is not an item it holds/)
})

test('two items with one id, a project in two worlds and unknown values are refused', () => {
  const twice = withRoom((project) => {
    project.chest.push({ ...project.chest[0], heldBy: null })
  })
  assert.match(cleanSave(twice).problem, /holds two items with the id/)
  const twoWorlds = structuredClone(playedSave())
  twoWorlds.worlds.side = structuredClone(twoWorlds.worlds.main)
  assert.match(cleanSave(twoWorlds).problem, /is in two worlds/)
  const unknownClass = withRoom((project) => {
    Object.values(project.characters)[0].class = 'wizard'
  })
  assert.match(cleanSave(unknownClass).problem, /\.class is not one the game knows/)
  const tier = withRoom((project) => {
    project.chest[0].tier = 99
  })
  assert.match(cleanSave(tier).problem, /chest\.0\.tier is out of range/)
  const longTitle = withRoom((project) => {
    Object.values(project.characters)[0].title = 'x'.repeat(10_000)
  })
  assert.match(cleanSave(longTitle).problem, /title is not a valid name/)
})

test('a value that is not a save of this version is refused', () => {
  assert.equal(cleanSave(null).ok, false)
  assert.equal(cleanSave({ ...emptySave(), version: 2 }).ok, false)
})
