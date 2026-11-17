import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import { cleanSave } from './save-check.mjs'
import { assignProject, emptySave, emptyWorld } from './worlds.mjs'

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

test('a generated monster keeps its rank and look, and a made-up look is refused', () => {
  const look = { rig: 'humanoid', parts: { head: 'goblin-grin', extras: ['cape'], held: null }, colours: { skin: '#8f9a62' } }
  const generated = withRoom((project) => {
    delete project.monster.sprite
    Object.assign(project.monster, { rank: 'veteran', dropFactor: 1.5, race: 'goblin', look })
  })
  const cleaned = cleanSave(generated)
  assert.equal(cleaned.ok, true)
  assert.deepEqual(cleaned.save.worlds.main.projects[ROOM].monster.look, look)
  assert.equal(cleaned.save.worlds.main.projects[ROOM].monster.rank, 'veteran')

  const badColour = withRoom((project) => {
    Object.assign(project.monster, { race: 'goblin', look: { ...look, colours: { skin: 'url(x)' } } })
  })
  assert.equal(cleanSave(badColour).ok, false)
  const badRank = withRoom((project) => {
    project.monster.rank = 'godlike'
  })
  assert.equal(cleanSave(badRank).ok, false)
  const nothingToDraw = withRoom((project) => {
    delete project.monster.sprite
  })
  assert.equal(cleanSave(nothingToDraw).ok, false)
})

test('more worlds than there can be are refused, counting those only a room names', () => {
  const save = structuredClone(playedSave())
  for (const worldId of ['one', 'two', 'three', 'four', 'five', 'six', 'seven']) save.worlds[worldId] = emptyWorld()
  assert.equal(cleanSave(save).ok, true)
  save.projectWorld['local:/work/turbo-waffle'] = 'eight'
  assert.match(cleanSave(save).problem, /worlds are more than the 8 there can be/)
})

test('a world id the actions would not accept is refused, as a key or as a room\'s world', () => {
  for (const worldId of ['Side Projects', 'side_projects', '-side', 'x'.repeat(33), '']) {
    const asKey = structuredClone(playedSave())
    asKey.worlds[worldId] = emptyWorld()
    assert.equal(cleanSave(asKey).ok, false, `world ${worldId}`)
    const asValue = structuredClone(playedSave())
    asValue.projectWorld['local:/work/turbo-waffle'] = worldId
    assert.equal(cleanSave(asValue).ok, false, `projectWorld ${worldId}`)
  }
})

test('a project kept in another world than its own is refused', () => {
  const moved = structuredClone(playedSave())
  moved.worlds.side = { ...emptyWorld(), projects: moved.worlds.main.projects }
  moved.worlds.main.projects = {}
  assert.match(cleanSave(moved).problem, /projects\.local:\/work\/rumble-banana is not in its own world, main/)
  const assignedElsewhere = structuredClone(playedSave())
  assignedElsewhere.projectWorld[ROOM] = 'side'
  assert.match(cleanSave(assignedElsewhere).problem, /is not in its own world, side/)
})

test('the saves the engine writes when a room changes world or leaves the game come back unchanged', () => {
  const outOfGame = assignProject(playedSave(), ROOM, null)
  assert.deepEqual(cleanSave(outOfGame), { ok: true, save: outOfGame })
  const moved = assignProject(playedSave(), ROOM, 'side-projects')
  assert.ok(moved.worlds['side-projects'].projects[ROOM])
  assert.deepEqual(cleanSave(moved), { ok: true, save: moved })
  // A room put in a new world names it before its first tokens create it.
  const named = assignProject(playedSave(), 'local:/work/turbo-waffle', 'later')
  assert.equal(named.worlds.later, undefined)
  assert.deepEqual(cleanSave(named), { ok: true, save: named })
})

test('a key that would reach an object\'s prototype is refused wherever an id is a key', () => {
  const json = JSON.stringify(playedSave())
  const sessionId = Object.keys(playedSave().worlds.main.projects[ROOM].characters)[0]
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const cases = {
      world: json.replace('"worlds":{"main":', `"worlds":{"${key}":`),
      project: json.replace(`"projects":{"${ROOM}":`, `"projects":{"${key}":`),
      character: json.replace(`"characters":{"${sessionId}":`, `"characters":{"${key}":`),
      projectWorld: json.replace('"projectWorld":{}', `"projectWorld":{"${key}":"main"}`)
    }
    for (const [where, text] of Object.entries(cases)) {
      assert.notEqual(text, json, `${where} was replaced`)
      assert.match(cleanSave(JSON.parse(text)).problem ?? '', /is not a name the game uses/, `${key} as a ${where}`)
    }
  }
})

const cityIds = ['goldmill', 'deepforge']
/** The played save with coins and a market that has moved. */
function tradedSave() {
  const save = structuredClone(playedSave())
  save.worlds.main.coins = 1234
  save.worlds.main.market = {
    clock: 6 * HOUR,
    pressure: { goldmill: { ore: 0.5, crops: -1.2 } },
    sold: { deepforge: { day: 0, offers: [0, 2] } }
  }
  return save
}

test('coins and a market with known cities and pressures in range come back unchanged', () => {
  const save = tradedSave()
  assert.deepEqual(cleanSave(save, { cityIds }), { ok: true, save })
})

test('a save from before the market comes back with no coins and a market at rest', () => {
  const save = structuredClone(playedSave())
  delete save.worlds.main.coins
  delete save.worlds.main.market
  const cleaned = cleanSave(save, { cityIds })
  assert.equal(cleaned.ok, true)
  assert.equal(cleaned.save.worlds.main.coins, 0)
  assert.deepEqual(cleaned.save.worlds.main.market, { clock: null, pressure: {}, sold: {} })
})

test('made-up coins, cities, materials, pressures and offers are refused', () => {
  const broken = [
    (world) => { world.coins = -1 },
    (world) => { world.coins = 2.5 },
    (world) => { world.coins = 1e200 },
    (world) => { world.coins = 'lots' },
    (world) => { world.market.pressure.atlantis = { ore: 1 } },
    (world) => { world.market.pressure.goldmill.gold = 1 },
    (world) => { world.market.pressure.goldmill.ore = 50 },
    (world) => { world.market.pressure.goldmill.ore = -3 },
    (world) => { world.market.pressure.goldmill.ore = Number.NaN },
    (world) => { world.market.sold.deepforge.offers = [0, 0] },
    (world) => { world.market.sold.deepforge.offers = [7] },
    (world) => { world.market.sold.deepforge.day = -1 },
    (world) => { world.market.sold = JSON.parse('{"__proto__": { "day": 0, "offers": [] }}') },
    (world) => { world.market = [] }
  ]
  for (const [index, change] of broken.entries()) {
    const save = tradedSave()
    change(save.worlds.main)
    assert.equal(cleanSave(save, { cityIds }).ok, false, `change ${index}`)
  }
})

test('the engine checks a market against the cities of its content', () => {
  const cities = readJson('../../game/cities.json')
  const withCities = createEngine({ content: { ...content, cities } })
  assert.equal(withCities.cleanSave(tradedSave()).ok, true)
  assert.equal(engine.cleanSave(tradedSave()).ok, false)
})
