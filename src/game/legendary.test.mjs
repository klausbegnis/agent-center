import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import { legendaryIndexOf } from './legendary-effects.mjs'
import { legendaryItemFor } from './legendary-drops.mjs'
import { mergeLegendary, normalizeLegendary, ownsLegendary, withRelic } from './legendary.mjs'
import { moveProjectItems } from './orphans.mjs'
import { emptyProject, emptySave, emptyWorld, migrate } from './worlds.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('../../game/monsters.json'),
  items: readJson('../../game/items.json'),
  legendary: readJson('../../game/legendary.json')
}
const index = legendaryIndexOf(content)
const cleaver = (extra = {}) => ({ ...legendaryItemFor(index.byId.get('labyrinth-cleaver'), 20), ...extra })
const state = (relics, active = relics[0] ?? null) => ({ relics, active, relicPity: 0, bossPity: 0 })

test('a room\'s first relic becomes active and later ones wait to be picked', () => {
  const first = withRelic(emptyProject(), 'rimeheart')
  assert.deepEqual(first.legendary, state(['rimeheart']))
  const second = withRelic(first, 'tidecall-conch')
  assert.deepEqual(second.legendary.relics, ['rimeheart', 'tidecall-conch'])
  assert.equal(second.legendary.active, 'rimeheart')
  assert.equal(withRelic(second, 'rimeheart'), second)
})

test('a room owns relics it keeps and equipment in its chest', () => {
  const project = { ...withRelic(emptyProject(), 'rimeheart'), chest: [cleaver()] }
  assert.equal(ownsLegendary(project, 'rimeheart'), true)
  assert.equal(ownsLegendary(project, 'labyrinth-cleaver'), true)
  assert.equal(ownsLegendary(project, 'oathbreaker'), false)
})

test('stored legendary state is repaired, and nothing to keep leaves no field', () => {
  assert.deepEqual(normalizeLegendary({ relics: ['a', 'a', 7, 'b'], active: 'c', relicPity: -1, bossPity: 3 }),
    { relics: ['a', 'b'], active: null, relicPity: 0, bossPity: 3 })
  assert.equal(normalizeLegendary({ relics: [], active: null }), null)
  assert.equal(normalizeLegendary('nonsense'), null)
})

test('an old save loads with no legendary loot, and a stored one is kept', () => {
  const save = emptySave()
  save.worlds.main = { ...emptyWorld(), projects: { room: emptyProject() } }
  assert.equal('legendary' in migrate(save).worlds.main.projects.room, false)
  save.worlds.main.projects.room.legendary = state(['rimeheart'])
  assert.deepEqual(migrate(save).worlds.main.projects.room.legendary, state(['rimeheart']))
})

test('merged relics keep the target\'s first, its active one and its pity', () => {
  const target = { chest: [], legendary: { ...state(['rimeheart', 'tidecall-conch'], 'tidecall-conch'), bossPity: 2 } }
  const merged = mergeLegendary(target, { items: [], legendary: state(['jawbone-lyre', 'rimeheart']) })
  assert.deepEqual(merged.legendary, { relics: ['rimeheart', 'tidecall-conch', 'jawbone-lyre'], active: 'tidecall-conch', relicPity: 0, bossPity: 2 })
})

test('a target without relics takes the source\'s active one', () => {
  const merged = mergeLegendary({ chest: [] }, { items: [], legendary: state(['jawbone-lyre', 'rimeheart'], 'rimeheart') })
  assert.equal(merged.legendary.active, 'rimeheart')
})

test('of two copies of a legendary item the better stays, but a held one always stays', () => {
  const better = mergeLegendary({ chest: [cleaver({ level: 1 })] }, { items: [cleaver({ level: 5 })] })
  assert.equal(better.chest.length, 1)
  assert.equal(better.chest[0].level, 5)
  assert.equal(better.salvaged[0].level, 1)
  const held = mergeLegendary({ chest: [cleaver({ level: 1, heldBy: 's1' })] }, { items: [cleaver({ level: 5 })] })
  assert.equal(held.chest[0].heldBy, 's1')
  assert.equal(held.salvaged[0].level, 5)
})

test('moving a chest left behind moves its relics and legendary equipment too', () => {
  const save = emptySave()
  save.worlds.main = {
    ...emptyWorld(),
    projects: {
      old: { ...emptyProject(), chest: [cleaver({ level: 4 })], legendary: state(['jawbone-lyre']) },
      room: { ...emptyProject(), legendary: state(['rimeheart']) }
    }
  }
  const moved = moveProjectItems(save, { fromProjectId: 'old', toProjectId: 'room' }).worlds.main.projects.room
  assert.deepEqual(moved.legendary.relics, ['rimeheart', 'jawbone-lyre'])
  assert.equal(moved.chest.find((item) => item.legendary).id, 'labyrinth-cleaver')
})

test('a world reset forgets the rooms\' legendary loot with the rest', () => {
  const engine = createEngine({ content })
  let save = engine.applyTokens(emptySave(), { projectId: 'room', sessionId: 's', tokens: 100_000, activity: 'write', now: 0 })
  save.worlds.main.projects.room.legendary = state(['rimeheart'])
  const reset = { ...save, worlds: { ...save.worlds, main: emptyWorld() } }
  const after = engine.applyTokens(reset, { projectId: 'room', sessionId: 's', tokens: 100_000, activity: 'write', now: 1 })
  assert.equal(after.worlds.main.projects.room.legendary, undefined)
})
