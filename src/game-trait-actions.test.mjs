import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createTraitActions, traitInputOf } from './game-trait-actions.mjs'
import { createEngine } from './game/engine.mjs'
import { emptySave } from './game/worlds.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('../game/monsters.json'),
  items: readJson('../game/items.json'),
  cities: readJson('../game/cities.json'),
  traits: readJson('../game/traits.json')
}
const engine = createEngine({ content })
const ROOM = 'rumble-banana'
const OTHER = 'turbo-waffle'

/** The trait actions over a save kept here, with the checks game-actions.mjs gives them. */
function setup() {
  let save = engine.applyTokens(emptySave(), { projectId: ROOM, sessionId: 'first', tokens: 1_000_000, activity: 'think', now: 0 })
  save = engine.applyTokens(save, { projectId: OTHER, sessionId: 'second', tokens: 1_000_000, activity: 'think', now: 0 })
  const world = save.worlds.main
  save = { ...save, worlds: { main: { ...world, coins: 1_000_000, projects: { ...world.projects, [ROOM]: { ...world.projects[ROOM], scrolls: { 'stout-arm': 1 } } } } } }
  const kept = { save }
  const change = (update) => {
    const next = update(kept.save)
    if (next === kept.save) return { changed: false }
    kept.save = next
    return { changed: true }
  }
  const joinedProject = (current, roomId) => {
    const project = current.worlds.main.projects[roomId]
    if (!project) throw new Error('unknown room')
    return project
  }
  const actions = createTraitActions({
    engine,
    change,
    joinedProject,
    requireSending: (current, roomId, toRoomId) => ({ fromProjectId: roomId, toProjectId: toRoomId }),
    requireWorld: (current, worldId) => {
      if (!current.worlds[worldId]) throw new Error('unknown world')
    },
    requireCity: (cityId) => {
      if (!engine.cityIds.includes(cityId)) throw new Error('unknown city')
    }
  })
  return { actions, kept }
}

test('the controller\'s check keeps the fields an action takes and refuses a wrong kind', () => {
  assert.deepEqual(traitInputOf({ action: 'send', roomId: 'a', toRoomId: 'b', traitId: 'c', extra: 1 }),
    { action: 'send', roomId: 'a', toRoomId: 'b', traitId: 'c' })
  assert.throws(() => traitInputOf({ action: 'buy', worldId: 'main', cityId: 'goldmill', offerIndex: '0', traitId: 'x', roomId: 'r' }))
  assert.throws(() => traitInputOf({ action: 'steal' }))
  assert.throws(() => traitInputOf(null))
})

test('a scroll is sent to another room of the world', async () => {
  const { actions, kept } = setup()
  const answer = await actions.traitAction({ action: 'send', roomId: ROOM, toRoomId: OTHER, traitId: 'stout-arm' })
  assert.equal(answer.changed, true)
  assert.deepEqual(kept.save.worlds.main.projects[OTHER].scrolls, { 'stout-arm': 1 })
})

test('a refused choice says why', async () => {
  const { actions } = setup()
  await assert.rejects(actions.traitAction({ action: 'teach', roomId: ROOM, sessionId: 'first', traitId: 'stout-arm' }), /slot/)
  await assert.rejects(actions.traitAction({ action: 'sell', worldId: 'main', cityId: 'atlantis', roomId: ROOM, traitId: 'stout-arm' }),
    /unknown city/)
})

test('an offer of the day is bought into the room\'s chest', async () => {
  const { actions, kept } = setup()
  const [offer] = engine.view(kept.save).worlds[0].traits.brokers.goldmill.offers
  const input = { action: 'buy', worldId: 'main', cityId: 'goldmill', offerIndex: offer.index, traitId: offer.traitId, roomId: ROOM }
  assert.equal((await actions.traitAction(input)).changed, true)
  assert.ok(kept.save.worlds.main.projects[ROOM].scrolls[offer.traitId] >= 1)
})
