import assert from 'node:assert/strict'
import { test } from 'node:test'
import { COPIES_PER_ITEM } from './constants.mjs'
import { upgradeCost } from './items.mjs'
import { TRANSFER_REFUSALS, sendItem, sendItemProblem, sendRelic, sendRelicProblem } from './transfer.mjs'
import { emptyProject, emptySave, emptyWorld } from './worlds.mjs'

const FROM = 'local:/work/storefront'
const TO = 'local:/work/search'
const ELSEWHERE = 'local:/work/ledger'

const item = (id, extra = {}) => ({
  id, entryId: id, slot: 'tool', tier: 1, recipe: ['ore', 'logs'], level: 0, heldBy: null, ...extra
})
const legendaryItem = (id, extra = {}) => item(id, { legendary: true, slot: 'weapon', damageType: 'physical', ...extra })

/** A save whose main world holds the two projects as given, and a third room in another world. */
function saveWith(from, to) {
  const save = emptySave()
  save.worlds.main = {
    ...emptyWorld(),
    projects: { [FROM]: { ...emptyProject(), ...from }, [TO]: { ...emptyProject(), ...to } }
  }
  save.worlds.side = { ...emptyWorld(), projects: { [ELSEWHERE]: emptyProject() } }
  save.projectWorld = { [FROM]: 'main', [TO]: 'main', [ELSEWHERE]: 'side' }
  return save
}

const chestOf = (save, projectId, worldId = 'main') => save.worlds[worldId].projects[projectId].chest
const relicsOf = (save, projectId) => save.worlds.main.projects[projectId].legendary ?? null

test('a free item leaves its chest and arrives free in the other room\'s', () => {
  const save = saveWith({ chest: [item('brass-multitool', { level: 3 })] }, { chest: [] })
  const { save: next, salvaged } = sendItem(save, { fromProjectId: FROM, toProjectId: TO, itemId: 'brass-multitool' })
  assert.deepEqual(chestOf(next, FROM), [])
  assert.deepEqual(chestOf(next, TO).map((owned) => [owned.id, owned.level, owned.heldBy]), [['brass-multitool', 3, null]])
  assert.deepEqual(salvaged, [])
})

test('a copy arriving next to one already there is numbered like a drop', () => {
  const save = saveWith({ chest: [item('brass-multitool', { level: 3 })] }, { chest: [item('brass-multitool')] })
  const { save: next } = sendItem(save, { fromProjectId: FROM, toProjectId: TO, itemId: 'brass-multitool' })
  assert.deepEqual(chestOf(next, TO).map((owned) => owned.id).sort(), ['brass-multitool', 'brass-multitool-2'])
  assert.ok(chestOf(next, TO).every((owned) => owned.entryId === 'brass-multitool'))
})

test('an item a character holds is refused, and nothing changes', () => {
  const save = saveWith({ chest: [item('brass-multitool', { heldBy: 's1' })] }, { chest: [] })
  const sending = { fromProjectId: FROM, toProjectId: TO, itemId: 'brass-multitool' }
  assert.equal(sendItemProblem(save, sending), TRANSFER_REFUSALS.held)
  assert.equal(sendItem(save, sending).save, save)
})

test('an item that is not in the chest is refused', () => {
  const save = saveWith({ chest: [] }, { chest: [] })
  assert.equal(sendItemProblem(save, { fromProjectId: FROM, toProjectId: TO, itemId: 'nothing' }), TRANSFER_REFUSALS.noItem)
})

test('a room of another world, or the same room, is refused', () => {
  const save = saveWith({ chest: [item('brass-multitool')] }, { chest: [] })
  assert.equal(sendItemProblem(save, { fromProjectId: FROM, toProjectId: ELSEWHERE, itemId: 'brass-multitool' }),
    TRANSFER_REFUSALS.otherWorld)
  assert.equal(sendItemProblem(save, { fromProjectId: FROM, toProjectId: FROM, itemId: 'brass-multitool' }),
    TRANSFER_REFUSALS.sameRoom)
})

test('a chest at the copies cap keeps the best copies and salvages the lowest into the world\'s materials', () => {
  const own = Array.from({ length: COPIES_PER_ITEM }, (_, index) =>
    item(index === 0 ? 'brass-multitool' : `brass-multitool-${index + 1}`, { entryId: 'brass-multitool', level: 2 }))
  const save = saveWith({ chest: [item('brass-multitool', { level: 5 })] }, { chest: own })
  const { save: next, salvaged } = sendItem(save, { fromProjectId: FROM, toProjectId: TO, itemId: 'brass-multitool' })
  const levels = chestOf(next, TO).map((owned) => owned.level).sort((a, b) => b - a)
  assert.equal(levels.length, COPIES_PER_ITEM)
  assert.deepEqual(levels, [5, 2, 2, 2])
  assert.equal(salvaged.length, 1)
  assert.equal(salvaged[0].level, 2)
  const expected = upgradeCost({ ...salvaged[0], level: 0 }, { worldLevel: 1 })
  assert.deepEqual(next.worlds.main.materials, expected)
})

test('a sent item lower than every copy at the cap is the one salvaged', () => {
  const own = Array.from({ length: COPIES_PER_ITEM }, (_, index) =>
    item(index === 0 ? 'brass-multitool' : `brass-multitool-${index + 1}`, { entryId: 'brass-multitool', level: 4 }))
  const save = saveWith({ chest: [item('brass-multitool', { level: 1 })] }, { chest: own })
  const { save: next, salvaged } = sendItem(save, { fromProjectId: FROM, toProjectId: TO, itemId: 'brass-multitool' })
  assert.equal(salvaged[0].level, 1)
  assert.deepEqual(chestOf(next, FROM), [])
  assert.ok(chestOf(next, TO).every((owned) => owned.level === 4))
})

test('copies held in the target count against the cap and always stay', () => {
  const own = Array.from({ length: COPIES_PER_ITEM }, (_, index) =>
    item(index === 0 ? 'brass-multitool' : `brass-multitool-${index + 1}`,
      { entryId: 'brass-multitool', level: 0, heldBy: `s${index}` }))
  const save = saveWith({ chest: [item('brass-multitool', { level: 9 })] }, { chest: own })
  const { save: next, salvaged } = sendItem(save, { fromProjectId: FROM, toProjectId: TO, itemId: 'brass-multitool' })
  assert.equal(salvaged.length, 1)
  assert.equal(salvaged[0].level, 9)
  assert.ok(chestOf(next, TO).every((owned) => owned.heldBy !== null))
})

test('a legendary item arrives under its own id and is never salvaged', () => {
  const save = saveWith({ chest: [legendaryItem('labyrinth-cleaver', { level: 7 })] }, { chest: [] })
  const { save: next, salvaged } = sendItem(save, { fromProjectId: FROM, toProjectId: TO, itemId: 'labyrinth-cleaver' })
  assert.deepEqual(chestOf(next, TO).map((owned) => [owned.id, owned.legendary, owned.level]), [['labyrinth-cleaver', true, 7]])
  assert.deepEqual(salvaged, [])
})

test('a legendary item the target already owns is refused, so there are never two', () => {
  const save = saveWith({ chest: [legendaryItem('labyrinth-cleaver', { level: 7 })] }, { chest: [legendaryItem('labyrinth-cleaver')] })
  const sending = { fromProjectId: FROM, toProjectId: TO, itemId: 'labyrinth-cleaver' }
  assert.equal(sendItemProblem(save, sending), TRANSFER_REFUSALS.legendaryOwned)
  assert.equal(sendItem(save, sending).save, save)
})

const withRelics = (relics, active) => ({ legendary: { relics, active, relicPity: 0, bossPity: 0 } })

test('a relic that is not active moves to the other room and leaves this one', () => {
  const save = saveWith(withRelics(['rimeheart', 'tidecall-conch'], 'rimeheart'), withRelics(['everwarm-anvil'], 'everwarm-anvil'))
  const next = sendRelic(save, { fromProjectId: FROM, toProjectId: TO, relicId: 'tidecall-conch' })
  assert.deepEqual(relicsOf(next, FROM).relics, ['rimeheart'])
  assert.equal(relicsOf(next, FROM).active, 'rimeheart')
  assert.deepEqual(relicsOf(next, TO).relics, ['everwarm-anvil', 'tidecall-conch'])
  assert.equal(relicsOf(next, TO).active, 'everwarm-anvil')
})

test('a relic sent to a room with none becomes its active one', () => {
  const save = saveWith(withRelics(['rimeheart', 'tidecall-conch'], 'rimeheart'), {})
  const next = sendRelic(save, { fromProjectId: FROM, toProjectId: TO, relicId: 'tidecall-conch' })
  assert.equal(relicsOf(next, TO).active, 'tidecall-conch')
})

test('the active relic, one not owned, or one the target owns is refused', () => {
  const save = saveWith(withRelics(['rimeheart', 'tidecall-conch'], 'rimeheart'), withRelics(['tidecall-conch'], 'tidecall-conch'))
  const problem = (relicId, toProjectId = TO) => sendRelicProblem(save, { fromProjectId: FROM, toProjectId, relicId })
  assert.equal(problem('rimeheart'), TRANSFER_REFUSALS.activeRelic)
  assert.equal(problem('everwarm-anvil'), TRANSFER_REFUSALS.noRelic)
  assert.equal(problem('tidecall-conch'), TRANSFER_REFUSALS.relicOwned)
  assert.equal(problem('tidecall-conch', ELSEWHERE), TRANSFER_REFUSALS.otherWorld)
  assert.equal(sendRelic(save, { fromProjectId: FROM, toProjectId: TO, relicId: 'rimeheart' }), save)
})

test('pity counters stay with their room', () => {
  const save = saveWith(
    { legendary: { relics: ['rimeheart', 'tidecall-conch'], active: 'rimeheart', relicPity: 3, bossPity: 2 } },
    { legendary: { relics: [], active: null, relicPity: 1, bossPity: 0 } }
  )
  const next = sendRelic(save, { fromProjectId: FROM, toProjectId: TO, relicId: 'tidecall-conch' })
  assert.deepEqual([relicsOf(next, FROM).relicPity, relicsOf(next, FROM).bossPity], [3, 2])
  assert.deepEqual([relicsOf(next, TO).relicPity, relicsOf(next, TO).bossPity], [1, 0])
})
