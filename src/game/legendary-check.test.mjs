import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import { legendaryIndexOf } from './legendary-effects.mjs'
import { legendaryItemFor } from './legendary-drops.mjs'
import { cleanSave } from './save-check.mjs'
import { emptySave } from './worlds.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('../../game/monsters.json'),
  items: readJson('../../game/items.json'),
  legendary: readJson('../../game/legendary.json')
}
const engine = createEngine({ content })
const index = legendaryIndexOf(content)
const ROOM = 'local:/work/rumble-banana'

/** A save whose room owns two relics and holds a legendary weapon in its chest. */
function savedWithLoot() {
  const save = engine.applyTokens(emptySave(), { projectId: ROOM, sessionId: 'a', tokens: 500_000, activity: 'write', now: 0 })
  const room = save.worlds.main.projects[ROOM]
  room.legendary = { relics: ['rimeheart', 'tidecall-conch'], active: 'tidecall-conch', relicPity: 2, bossPity: 0 }
  room.chest = [...room.chest, legendaryItemFor(index.byId.get('labyrinth-cleaver'), 20)]
  return save
}
const change = (edit) => {
  const save = structuredClone(savedWithLoot())
  edit(save.worlds.main.projects[ROOM])
  return engine.cleanSave(save)
}

test('a save with relics and legendary equipment comes back unchanged', () => {
  const save = savedWithLoot()
  assert.deepEqual(engine.cleanSave(save), { ok: true, save })
})

test('a relic the game does not have is refused', () => {
  const result = change((room) => room.legendary.relics.push('made-up-relic'))
  assert.match(result.problem, /legendary.relics.2 is not a relic the game has/)
})

test('legendary equipment is not a relic a room can own', () => {
  assert.match(change((room) => room.legendary.relics.push('oathbreaker')).problem, /not a relic the game has/)
})

test('a relic owned twice is refused', () => {
  assert.match(change((room) => room.legendary.relics.push('rimeheart')).problem, /owned twice/)
})

test('an active relic the room does not own is refused', () => {
  assert.match(change((room) => { room.legendary.active = 'jawbone-lyre' }).problem, /not a relic the room owns/)
})

test('pity out of range and unknown keys are refused', () => {
  assert.match(change((room) => { room.legendary.bossPity = -2 }).problem, /bossPity is out of range/)
  assert.match(change((room) => { room.legendary.extra = 1 }).problem, /legendary.extra is not something/)
})

test('a second copy of a legendary item is refused', () => {
  const result = change((room) => room.chest.push({ ...legendaryItemFor(index.byId.get('labyrinth-cleaver'), 20), id: 'labyrinth-cleaver-2' }))
  assert.equal(result.ok, false)
})

test('legendary equipment made otherwise than its entry is refused', () => {
  const result = change((room) => { room.chest.at(-1).recipe = ['logs', 'ore'] })
  assert.match(result.problem, /not made as its legendary entry is/)
})

test('a plain item that uses a legendary id, or a legendary flag that is not true, is refused', () => {
  assert.match(change((room) => { delete room.chest.at(-1).legendary }).problem, /without being legendary/)
  assert.match(change((room) => { room.chest.at(-1).legendary = 'yes' }).problem, /legendary is not true/)
})

test('without legendary content, a save holding legendary loot is refused', () => {
  assert.equal(cleanSave(savedWithLoot()).ok, false)
  const plain = engine.applyTokens(emptySave(), { projectId: ROOM, sessionId: 'a', tokens: 500_000, activity: 'write', now: 0 })
  assert.equal(cleanSave(plain).ok, true)
})
