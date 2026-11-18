import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import { SCROLL_COPIES } from './trait-constants.mjs'
import { normalizeTraitRecord } from './trait-check.mjs'
import { emptySave, migrate } from './worlds.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('../../game/monsters.json'),
  items: readJson('../../game/items.json'),
  cities: readJson('../../game/cities.json'),
  traits: readJson('../../game/traits.json')
}
const engine = createEngine({ content })
const { traits: _traits, ...plainContent } = content
const plainEngine = createEngine({ content: plainContent })
const ROOM = 'local:/work/rumble-banana'

/** A save with a character taught a second trait, scrolls in the chest, a collection and a sale. */
function traitSave() {
  let save = engine.applyTokens(emptySave(), { projectId: ROOM, sessionId: 'first', tokens: 1_000_000, activity: 'think', now: 0 })
  save = engine.advance(save, { from: 0, to: 60_000, sessions: [] })
  const world = save.worlds.main
  const room = world.projects[ROOM]
  const character = { ...room.characters.first, level: 12, traits: [...engine.view(save).worlds[0].traits.known, 'keen-eye'] }
  const projects = { [ROOM]: { ...room, characters: { first: character }, scrolls: { 'stout-arm': 2 } } }
  const traits = { ...world.traits, sold: { goldmill: { day: 0, offers: [1] } } }
  return { ...save, worlds: { main: { ...world, projects, traits } } }
}

const changed = (change) => {
  const save = structuredClone(traitSave())
  change(save.worlds.main)
  return save
}

test('a save with traits comes back unchanged', () => {
  const save = traitSave()
  assert.deepEqual(engine.cleanSave(save), { ok: true, save })
})

test('a save from before traits loads with no trait field and keeps everything it had', () => {
  const old = plainEngine.applyTokens(emptySave(), { projectId: ROOM, sessionId: 'first', tokens: 1_000_000, activity: 'think', now: 0 })
  const cleaned = engine.cleanSave(migrate(structuredClone(old)))
  assert.deepEqual(cleaned, { ok: true, save: old })
  assert.equal(engine.view(old).worlds[0].projects[0].party[0].traits.carried.length, 1)
})

test('more traits than the character\'s level has slots for are refused', () => {
  const save = changed((world) => {
    world.projects[ROOM].characters.first.level = 1
  })
  assert.match(engine.cleanSave(save).problem, /slots/)
})

test('a trait the game does not have, or one carried twice, is refused', () => {
  const unknown = changed((world) => world.projects[ROOM].characters.first.traits.push('made-up'))
  const twice = changed((world) => {
    world.projects[ROOM].characters.first.traits = ['keen-eye', 'keen-eye']
  })
  assert.equal(engine.cleanSave(unknown).ok, false)
  assert.equal(engine.cleanSave(twice).ok, false)
})

test('scrolls past the copies a chest keeps, or of an unknown trait, are refused', () => {
  const many = changed((world) => {
    world.projects[ROOM].scrolls['stout-arm'] = SCROLL_COPIES + 1
  })
  const unknown = changed((world) => {
    world.projects[ROOM].scrolls['made-up'] = 1
  })
  const proto = changed((world) => {
    world.projects[ROOM].scrolls = JSON.parse('{"__proto__": 1}')
  })
  assert.equal(engine.cleanSave(many).ok, false)
  assert.equal(engine.cleanSave(unknown).ok, false)
  assert.equal(engine.cleanSave(proto).ok, false)
})

test('a broker sale of a city the game does not have, or of an offer it never had, is refused', () => {
  const city = changed((world) => {
    world.traits.sold.atlantis = { day: 0, offers: [0] }
  })
  const offer = changed((world) => {
    world.traits.sold.goldmill.offers = [99]
  })
  assert.equal(engine.cleanSave(city).ok, false)
  assert.equal(engine.cleanSave(offer).ok, false)
})

test('a save that keeps traits is refused by a game without them', () => {
  assert.equal(plainEngine.cleanSave(traitSave()).ok, false)
})

test('the plugin\'s own storage keeps a world\'s collection through migrate and repairs a broken one', () => {
  const save = traitSave()
  assert.deepEqual(migrate(structuredClone(save)).worlds.main.traits, save.worlds.main.traits)
  assert.deepEqual(normalizeTraitRecord({ known: ['a', 3], sold: { goldmill: { day: 'x' } } }), { known: ['a'] })
  assert.equal(normalizeTraitRecord('nonsense'), null)
})
