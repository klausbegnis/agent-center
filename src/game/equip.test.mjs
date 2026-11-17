import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { addToChest } from './chest.mjs'
import { createEngine } from './engine.mjs'
import { AUTO, changedSlots, equipProblem } from './equip.mjs'
import { createItem } from './items.mjs'
import { cleanSave } from './save-check.mjs'
import { emptySave, migrate } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const items = readJson('items.json')
const engine = createEngine({ content: { monsters: readJson('monsters.json'), items } })
const ROOM = 'local:/work/rumble-banana'
const ACTIVITIES = ['write', 'read', 'run', 'think']

/** A room with four characters, one of each class, the starter chest and a few more items. */
function room() {
  let save = emptySave()
  for (const [index, sessionId] of ['a', 'b', 'c', 'd'].entries()) {
    save = engine.applyTokens(save, { projectId: ROOM, sessionId, tokens: 1_000_000, activity: ACTIVITIES[index], now: 0 })
  }
  const entry = (id) => items.items.find((item) => item.id === id)
  const project = save.worlds.main.projects[ROOM]
  let chest = project.chest
  for (const id of ['tempered-shortsword', 'inscribed-codex', 'quilted-gambeson']) chest = addToChest(chest, createItem(entry(id)))
  save.worlds.main.projects[ROOM] = { ...project, chest }
  return save
}

const projectOf = (save) => save.worlds.main.projects[ROOM]
const classOf = (save, className) => Object.values(projectOf(save).characters).find((member) => member.class === className)
const itemOf = (save, id) => projectOf(save).chest.find((item) => item.id === id)
const equip = (save, sessionId, slot, itemId) => engine.equipItem(save, { projectId: ROOM, sessionId, slot, itemId })

/** Every item held names its holder, and every holder names its items: the save check's rule. */
function assertConsistent(save) {
  assert.equal(cleanSave(save).ok, true, cleanSave(save).problem)
}

test('a free item is taken and pins the slot; the previous one goes back to the chest, free', () => {
  const save = room()
  const fighter = classOf(save, 'physical')
  const before = fighter.equipment.weapon
  const next = equip(save, fighter.sessionId, 'weapon', 'tempered-shortsword')
  const after = projectOf(next).characters[fighter.sessionId]
  assert.equal(after.equipment.weapon, 'tempered-shortsword')
  assert.deepEqual(after.pinned, { weapon: true })
  assert.equal(itemOf(next, 'tempered-shortsword').heldBy, fighter.sessionId)
  assert.equal(itemOf(next, before).heldBy, null)
  assertConsistent(next)
})

test('an item another character holds is swapped: each gets the other\'s', () => {
  let save = room()
  const fighter = classOf(save, 'physical')
  const guardian = classOf(save, 'defense')
  save = equip(save, fighter.sessionId, 'weapon', 'tempered-shortsword')
  const guardianWeapon = projectOf(save).characters[guardian.sessionId].equipment.weapon
  const next = equip(save, guardian.sessionId, 'weapon', 'tempered-shortsword')
  assert.equal(projectOf(next).characters[guardian.sessionId].equipment.weapon, 'tempered-shortsword')
  assert.equal(projectOf(next).characters[fighter.sessionId].equipment.weapon, guardianWeapon)
  assert.equal(itemOf(next, guardianWeapon).heldBy, fighter.sessionId)
  // The one who gave its item keeps its own pin; the one who chose is pinned.
  assert.deepEqual(projectOf(next).characters[guardian.sessionId].pinned, { weapon: true })
  assertConsistent(next)
})

test('a swap that would leave the holder with a weapon it cannot use is refused, with the reason', () => {
  const save = room()
  const mage = classOf(save, 'magical')
  const fighter = classOf(save, 'physical')
  // The mage cannot take the fighter's physical weapon at all.
  const fighterWeapon = fighter.equipment.weapon
  assert.equal(equipProblem(projectOf(save), { sessionId: mage.sessionId, slot: 'weapon', itemId: fighterWeapon }),
    'that character cannot use that weapon')
  assert.equal(equip(save, mage.sessionId, 'weapon', fighterWeapon), save)
})

test('a swap where the holder could not use what it gets back is refused', () => {
  // A mage holding a physical weapon cannot happen, so build it: the fighter wears the outfit,
  // and taking it from someone who holds a weapon in that slot is impossible by slot. Check the
  // rule on weapons by giving the guardian a magical weapon by hand.
  let save = room()
  const guardian = classOf(save, 'defense')
  const fighter = classOf(save, 'physical')
  const project = projectOf(save)
  const codex = project.chest.find((item) => item.damageType === 'magical' && item.heldBy === null)
  const own = guardian.equipment.weapon
  const chest = project.chest.map((item) => (item.id === codex.id ? { ...item, heldBy: guardian.sessionId }
    : item.id === own ? { ...item, heldBy: null } : item))
  const characters = { ...project.characters, [guardian.sessionId]: { ...guardian, equipment: { ...guardian.equipment, weapon: codex.id } } }
  save = { ...save, worlds: { main: { ...save.worlds.main, projects: { [ROOM]: { ...project, chest, characters } } } } }
  assert.equal(equipProblem(projectOf(save), { sessionId: guardian.sessionId, slot: 'weapon', itemId: fighter.equipment.weapon }),
    'the one holding it cannot use what it would get in exchange')
})

test('a slot can be emptied, and stays empty', () => {
  const save = room()
  const fighter = classOf(save, 'physical')
  const next = equip(save, fighter.sessionId, 'outfit', null)
  const after = projectOf(next).characters[fighter.sessionId]
  assert.equal(after.equipment.outfit, null)
  assert.deepEqual(after.pinned, { outfit: true })
  assert.equal(projectOf(next).chest.filter((item) => item.slot === 'outfit').every((item) => item.heldBy === null), true)
  assertConsistent(next)
})

test('Auto unpins a slot and takes the best free item at once', () => {
  let save = room()
  const fighter = classOf(save, 'physical')
  save = equip(save, fighter.sessionId, 'outfit', null)
  const next = equip(save, fighter.sessionId, 'outfit', AUTO)
  const after = projectOf(next).characters[fighter.sessionId]
  assert.equal(after.pinned, undefined)
  assert.equal(after.equipment.outfit, 'quilted-gambeson', 'the tier 2 outfit beats the starter one')
  assertConsistent(next)
})

test('refusals: a stranger, an unknown slot or item, an item of another slot', () => {
  const save = room()
  const fighter = classOf(save, 'physical')
  const problem = (choice) => equipProblem(projectOf(save), { sessionId: fighter.sessionId, slot: 'weapon', itemId: null, ...choice })
  assert.equal(problem({ sessionId: 'nobody' }), 'not a character of this room')
  assert.equal(problem({ slot: 'ring' }), 'not an equipment slot')
  assert.equal(problem({ itemId: 'made-up' }), 'not an item of this room\'s chest')
  assert.equal(problem({ itemId: 'quilted-gambeson' }), 'that item does not go in the weapon slot')
  assert.equal(equip(save, 'nobody', 'weapon', null), save)
})

test('choosing what a character already holds pins it and changes nothing else', () => {
  const save = room()
  const fighter = classOf(save, 'physical')
  const next = equip(save, fighter.sessionId, 'weapon', fighter.equipment.weapon)
  assert.deepEqual(projectOf(next).characters[fighter.sessionId].pinned, { weapon: true })
  assert.deepEqual(projectOf(next).chest, projectOf(save).chest)
})

test('best gear for everyone re-picks every unpinned slot and leaves pinned ones alone', () => {
  let save = room()
  const fighter = classOf(save, 'physical')
  const mage = classOf(save, 'magical')
  save = equip(save, fighter.sessionId, 'outfit', null)
  const next = engine.bestGearForRoom(save, { projectId: ROOM })
  assert.equal(projectOf(next).characters[fighter.sessionId].equipment.outfit, null, 'a pinned empty slot stays empty')
  assert.equal(projectOf(next).characters[mage.sessionId].equipment.weapon, 'inscribed-codex')
  assert.ok(changedSlots(projectOf(save), projectOf(next)).length > 0)
  assertConsistent(next)
  // Run again: nothing more to change.
  assert.equal(engine.bestGearForRoom(next, { projectId: ROOM }), next)
})

test('a retiring character returns its items and forgets its pins; it comes back on Auto', () => {
  let save = room()
  const fighter = classOf(save, 'physical')
  save = equip(save, fighter.sessionId, 'outfit', null)
  save = engine.closeSession(save, { projectId: ROOM, sessionId: fighter.sessionId, now: 10 })
  assert.equal(projectOf(save).chest.some((item) => item.heldBy === fighter.sessionId), false)
  save = engine.applyTokens(save, { projectId: ROOM, sessionId: fighter.sessionId, tokens: 1000, activity: 'write', now: 20 })
  const back = projectOf(save).characters[fighter.sessionId]
  assert.equal(back.pinned, undefined)
  assert.notEqual(back.equipment.outfit, null)
})

test('moving a left-behind room leaves the target\'s pinned items with their holders', () => {
  let save = room()
  const fighter = classOf(save, 'physical')
  save = equip(save, fighter.sessionId, 'weapon', 'tempered-shortsword')
  const other = 'local:/work/fuzzy-anvil'
  save = engine.applyTokens(save, { projectId: other, sessionId: 'old', tokens: 1000, activity: 'write', now: 0 })
  save = engine.moveProjectItems(save, { fromProjectId: other, toProjectId: ROOM, now: 5 })
  assert.equal(itemOf(save, 'tempered-shortsword').heldBy, fighter.sessionId)
  assert.deepEqual(projectOf(save).characters[fighter.sessionId].pinned, { weapon: true })
  assertConsistent(save)
})

test('the save check keeps known pins and refuses anything else; old saves have none', () => {
  const save = equip(room(), classOf(room(), 'physical').sessionId, 'weapon', 'tempered-shortsword')
  assert.deepEqual(cleanSave(save).save, save)
  const broken = (pinned) => {
    const copy = structuredClone(save)
    Object.values(copy.worlds.main.projects[ROOM].characters)[0].pinned = pinned
    return cleanSave(copy).ok
  }
  assert.equal(broken({ ring: true }), false)
  assert.equal(broken({ weapon: 'yes' }), false)
  assert.equal(broken({ weapon: false }), false)
  assert.equal(broken([]), false)
  const old = migrate(JSON.parse(JSON.stringify(room())))
  assert.equal(Object.values(old.worlds.main.projects[ROOM].characters).every((member) => member.pinned === undefined), true)
  assert.equal(cleanSave(old).ok, true)
})

test('the view tells which slots are pinned', () => {
  const save = equip(room(), classOf(room(), 'physical').sessionId, 'tool', null)
  const party = engine.view(save).worlds[0].projects[0].party
  assert.equal(party.find((member) => member.class === 'physical').pinned.tool, true)
  assert.deepEqual(party.find((member) => member.class === 'magical').pinned, {})
})
