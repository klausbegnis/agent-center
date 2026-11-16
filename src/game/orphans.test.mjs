import assert from 'node:assert/strict'
import { test } from 'node:test'
import { COPIES_PER_ITEM } from './constants.mjs'
import { upgradeCost } from './items.mjs'
import { moveProjectItems } from './orphans.mjs'
import { retireeBonus } from './retirement.mjs'
import { emptyProject, emptySave, emptyWorld } from './worlds.mjs'

const FROM = 'local:/work/fuzzy-anvil'
const TO = 'local:/work/rumble-banana'

const item = (id, extra = {}) => ({
  id, entryId: id, slot: 'tool', tier: 1, recipe: ['ore', 'logs'], level: 0, heldBy: null, ...extra
})

/** A save whose main world holds the two projects as given. */
function saveWith(from, to, world = {}) {
  const save = emptySave()
  save.worlds.main = {
    ...emptyWorld(),
    ...world,
    projects: { [FROM]: { ...emptyProject(), ...from }, [TO]: { ...emptyProject(), ...to } }
  }
  save.projectWorld[FROM] = 'main'
  return save
}

const character = (sessionId) => ({
  sessionId, class: 'physical', level: 3, xp: 0, attributes: {}, levelActivityXp: {},
  equipment: { weapon: null, outfit: null, tool: `${sessionId}-tool` }, trade: 'mining', tokens: 10,
  bornAt: 0, lastSeenAt: 50, skillXp: { forge: 4 }, gatherCarry: 0, title: null, state: 'idle'
})

test('every item moves free into the target chest, with ids that stay unique', () => {
  const save = saveWith(
    { chest: [item('brass-multitool', { level: 3 }), item('ashwood-wand', { slot: 'weapon', damageType: 'magical' })] },
    { chest: [item('brass-multitool', { heldBy: 's1' })], characters: { s1: { ...character('s1'), equipment: { weapon: null, outfit: null, tool: 'brass-multitool' } } } }
  )
  const moved = moveProjectItems(save, { fromProjectId: FROM, toProjectId: TO })
  const chest = moved.worlds.main.projects[TO].chest
  assert.deepEqual(chest.map((owned) => owned.id).sort(), ['ashwood-wand', 'brass-multitool', 'brass-multitool-2'])
  assert.equal(chest.find((owned) => owned.id === 'brass-multitool-2').level, 3)
  assert.equal(chest.find((owned) => owned.id === 'brass-multitool').heldBy, 's1')
  assert.equal(chest.filter((owned) => owned.heldBy === null).length, 2)
})

test('the source\'s characters retire first, so nothing they held stays held', () => {
  const save = saveWith(
    { chest: [item('w1-tool', { heldBy: 'w1' })], characters: { w1: { ...character('w1'), equipment: { weapon: null, outfit: null, tool: 'w1-tool' } } } },
    {}
  )
  const moved = moveProjectItems(save, { fromProjectId: FROM, toProjectId: TO, now: 99 })
  const target = moved.worlds.main.projects[TO]
  assert.deepEqual(target.chest.map((owned) => [owned.id, owned.heldBy]), [['w1-tool', null]])
  assert.equal(target.retiredCount, 1)
})

test('copies past the cap are the lowest, salvaged into the world\'s materials as a drop would be', () => {
  const own = Array.from({ length: COPIES_PER_ITEM - 1 }, (_, index) =>
    item(index === 0 ? 'brass-multitool' : `brass-multitool-${index + 1}`, { entryId: 'brass-multitool', level: 2 }))
  const arriving = [
    item('brass-multitool', { level: 5 }),
    item('brass-multitool-2', { entryId: 'brass-multitool', level: 1 }),
    item('brass-multitool-3', { entryId: 'brass-multitool', level: 0 })
  ]
  const save = saveWith({ chest: arriving }, { chest: own }, { materials: { ore: 1 } })
  const moved = moveProjectItems(save, { fromProjectId: FROM, toProjectId: TO })
  const chest = moved.worlds.main.projects[TO].chest
  assert.equal(chest.length, COPIES_PER_ITEM)
  assert.deepEqual(chest.map((owned) => owned.level).sort(), [2, 2, 2, 5])
  const oneSalvage = upgradeCost(item('brass-multitool'), { worldLevel: 1 })
  assert.deepEqual(moved.worlds.main.materials, { ore: 1 + 2 * oneSalvage.ore, logs: 2 * oneSalvage.logs })
})

test('a better copy arriving pushes out the target\'s lowest free copy, never a held one', () => {
  const own = [
    item('brass-multitool', { heldBy: 's1' }),
    ...[2, 3, 4].map((copy) => item(`brass-multitool-${copy}`, { entryId: 'brass-multitool' }))
  ]
  const save = saveWith(
    { chest: [item('brass-multitool', { level: 7 })] },
    { chest: own, characters: { s1: { ...character('s1'), equipment: { weapon: null, outfit: null, tool: 'brass-multitool' } } } }
  )
  const chest = moveProjectItems(save, { fromProjectId: FROM, toProjectId: TO }).worlds.main.projects[TO].chest
  assert.equal(chest.length, COPIES_PER_ITEM)
  assert.equal(chest.find((owned) => owned.id === 'brass-multitool').heldBy, 's1')
  assert.ok(chest.some((owned) => owned.level === 7))
  assert.equal(new Set(chest.map((owned) => owned.id)).size, COPIES_PER_ITEM)
})

test('retirees, kept and folded, are folded into the target, and the bonus counts them', () => {
  const record = { sessionId: 'old', nameId: 1, class: 'support', level: 4, xp: 0, attributes: {}, tokens: 0, mainSkill: null, retiredAt: 0, title: null, trade: null, bornAt: null }
  const save = saveWith({ retirees: [record, { ...record, sessionId: 'older' }], retiredCount: 5 }, { retiredCount: 1 })
  const target = moveProjectItems(save, { fromProjectId: FROM, toProjectId: TO }).worlds.main.projects[TO]
  assert.equal(target.retiredCount, 8)
  assert.equal(retireeBonus(target), retireeBonus({ retirees: [], retiredCount: 8 }))
})

test('the source leaves the world and projectWorld', () => {
  const moved = moveProjectItems(saveWith({}, {}), { fromProjectId: FROM, toProjectId: TO })
  assert.equal(Object.hasOwn(moved.worlds.main.projects, FROM), false)
  assert.equal(Object.hasOwn(moved.projectWorld, FROM), false)
})

test('projects of two worlds, a missing one or the same one twice give the same save back', () => {
  const save = saveWith({}, {})
  save.worlds.side = { ...emptyWorld(), projects: { other: emptyProject() } }
  assert.equal(moveProjectItems(save, { fromProjectId: FROM, toProjectId: 'other' }), save)
  assert.equal(moveProjectItems(save, { fromProjectId: 'nowhere', toProjectId: TO }), save)
  assert.equal(moveProjectItems(save, { fromProjectId: TO, toProjectId: TO }), save)
})
