import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import { AUTO } from './equip.mjs'
import { legendaryItemFor } from './legendary-drops.mjs'
import { legendaryIndexOf } from './legendary-effects.mjs'
import { mayHold } from './legendary-equip.mjs'
import { emptySave } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = { monsters: readJson('monsters.json'), items: readJson('items.json'), legendary: readJson('legendary.json') }
const engine = createEngine({ content })
const index = legendaryIndexOf(content)
const ROOM = 'local:/work/rumble-banana'
const ACTIVITIES = ['write', 'read', 'run', 'think']

/** A room with one character of each class, the starter chest, Oathbreaker and the Gravewake Mattock, free. */
function room() {
  let save = emptySave()
  for (const [at, sessionId] of ['a', 'b', 'c', 'd'].entries()) {
    save = engine.applyTokens(save, { projectId: ROOM, sessionId, tokens: 1_000_000, activity: ACTIVITIES[at], now: 0 })
  }
  const project = save.worlds.main.projects[ROOM]
  const extra = ['oathbreaker', 'gravewake-mattock'].map((id) => legendaryItemFor(index.byId.get(id), 1))
  save.worlds.main.projects[ROOM] = { ...project, chest: [...project.chest, ...extra] }
  return save
}
const projectOf = (save) => save.worlds.main.projects[ROOM]
const classOf = (save, className) => Object.values(projectOf(save).characters).find((member) => member.class === className)
const itemOf = (save, id) => projectOf(save).chest.find((item) => item.id === id)
const equip = (save, sessionId, slot, itemId) => engine.equipItem(save, { projectId: ROOM, sessionId, slot, itemId })
const problem = (save, sessionId, slot, itemId) => engine.equipProblem(projectOf(save), { sessionId, slot, itemId })

test('one rule says who may hold an item: the weapon type, and a legendary item only for who it is made', () => {
  const oathbreaker = legendaryItemFor(index.byId.get('oathbreaker'), 1)
  const mattock = legendaryItemFor(index.byId.get('gravewake-mattock'), 1)
  assert.equal(mayHold({ class: 'physical' }, oathbreaker, index), true)
  assert.equal(mayHold({ class: 'defense' }, oathbreaker, index), false)
  assert.equal(mayHold({ class: 'magical' }, oathbreaker, index), false)
  assert.equal(mayHold({ class: 'magical', trade: 'mining' }, mattock, index), true)
  assert.equal(mayHold({ class: 'magical', trade: 'fishing' }, mattock, index), false)
  assert.equal(mayHold({ class: 'physical' }, oathbreaker, null), false)
})

test('Auto gives the Fighter the legendary weapon made for it, and never the Guardian', () => {
  const save = room()
  const fighter = classOf(save, 'physical')
  const guardian = classOf(save, 'defense')
  const guarded = equip(save, guardian.sessionId, 'weapon', AUTO)
  assert.notEqual(projectOf(guarded).characters[guardian.sessionId].equipment.weapon, 'oathbreaker')
  const auto = equip(save, fighter.sessionId, 'weapon', AUTO)
  assert.equal(projectOf(auto).characters[fighter.sessionId].equipment.weapon, 'oathbreaker')
  assert.equal(itemOf(auto, 'oathbreaker').heldBy, fighter.sessionId)
})

test('by hand, a legendary item is refused, with the reason, to a character it is not made for', () => {
  const save = room()
  const guardian = classOf(save, 'defense')
  assert.equal(problem(save, guardian.sessionId, 'weapon', 'oathbreaker'), 'that legendary item is made for another class')
  assert.equal(equip(save, guardian.sessionId, 'weapon', 'oathbreaker'), save)
  const fighter = classOf(save, 'physical')
  assert.equal(problem(save, fighter.sessionId, 'weapon', 'oathbreaker'), null)
})

test('a legendary tool follows the trade a character gathers now, its own choice included', () => {
  let save = room()
  const mage = classOf(save, 'magical')
  save = engine.setCharacterTrade(save, { projectId: ROOM, sessionId: mage.sessionId, trade: 'fishing' })
  assert.equal(problem(save, mage.sessionId, 'tool', 'gravewake-mattock'), 'that legendary tool is made for another trade')
  save = engine.setCharacterTrade(save, { projectId: ROOM, sessionId: mage.sessionId, trade: 'mining' })
  assert.equal(problem(save, mage.sessionId, 'tool', 'gravewake-mattock'), null)
})

test('a swap that would hand a legendary item to a character it is not made for is refused', () => {
  let save = room()
  const fighter = classOf(save, 'physical')
  const guardian = classOf(save, 'defense')
  save = equip(save, fighter.sessionId, 'weapon', 'oathbreaker')
  const guardianWeapon = projectOf(save).characters[guardian.sessionId].equipment.weapon
  assert.equal(problem(save, fighter.sessionId, 'weapon', guardianWeapon), 'the one holding it cannot use what it would get in exchange')
})

test('a pinned legendary item stays where it is through Best gear for everyone', () => {
  let save = room()
  const fighter = classOf(save, 'physical')
  save = equip(save, fighter.sessionId, 'weapon', 'oathbreaker')
  const best = engine.bestGearForRoom(save, { projectId: ROOM })
  assert.equal(projectOf(best).characters[fighter.sessionId].equipment.weapon, 'oathbreaker')
  assert.deepEqual(projectOf(best).characters[fighter.sessionId].pinned, { weapon: true })
})

test('Best gear for everyone neither loses nor copies a legendary item, and gives each to who it fits', () => {
  let save = room()
  const guardian = classOf(save, 'defense')
  // An odd start: the Guardian holds the mattock by some earlier pick, unpinned.
  const project = projectOf(save)
  const chest = project.chest.map((item) => {
    if (item.id === 'gravewake-mattock') return { ...item, heldBy: guardian.sessionId }
    return item.id === guardian.equipment.tool ? { ...item, heldBy: null } : item
  })
  const characters = { ...project.characters, [guardian.sessionId]: { ...guardian, equipment: { ...guardian.equipment, tool: 'gravewake-mattock' } } }
  save.worlds.main.projects[ROOM] = { ...project, chest, characters }
  const best = engine.bestGearForRoom(save, { projectId: ROOM })
  const after = projectOf(best)
  assert.equal(after.chest.length, project.chest.length)
  assert.deepEqual(after.chest.filter((item) => item.legendary).map((item) => item.id).sort(), ['gravewake-mattock', 'oathbreaker'])
  const fighter = classOf(best, 'physical')
  assert.equal(fighter.equipment.weapon, 'oathbreaker')
  const mattockHolder = after.chest.find((item) => item.id === 'gravewake-mattock').heldBy
  if (mattockHolder) assert.equal(after.characters[mattockHolder].trade, 'mining')
  assert.equal(engine.cleanSave(best).ok, true)
})

test('a save with a pinned slot holding a legendary item imports as it is', () => {
  let save = room()
  const fighter = classOf(save, 'physical')
  save = equip(save, fighter.sessionId, 'weapon', 'oathbreaker')
  assert.deepEqual(engine.cleanSave(save), { ok: true, save })
})
