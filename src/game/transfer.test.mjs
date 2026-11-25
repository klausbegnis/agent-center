import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COPIES_PER_ITEM } from './constants.mjs'
import { legendaryItemFor } from './legendary-drops.mjs'
import { legendaryIndexOf } from './legendary-effects.mjs'
import { cleanSave } from './save-check.mjs'
import { upgradeCost } from './items.mjs'
import { TRANSFER_REFUSALS, sendItem, sendItemProblem, sendRelic, sendRelicProblem } from './transfer.mjs'
import { emptyProject, emptySave, emptyWorld } from './worlds.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const legendary = JSON.parse(fs.readFileSync(path.join(ROOT, 'game', 'legendary.json'), 'utf8'))
const index = legendaryIndexOf({ legendary })

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

/** A living character of the source holding the slots given. */
const hero = (sessionId, equipment, extra = {}) => ({
  sessionId, class: 'physical', level: 3, xp: 0, attributes: {}, levelActivityXp: {}, trade: 'mining',
  tokens: 10, bornAt: 0, lastSeenAt: 0, skillXp: {}, gatherCarry: 0, title: null, state: 'working',
  equipment: { weapon: null, outfit: null, tool: null, ...equipment }, ...extra
})
/** The source with a chest and one character, s1, holding what `equipment` names. */
const holding = (chest, equipment, extra = {}) => ({ chest, characters: { s1: hero('s1', equipment, extra) } })

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

test('an item a character holds is refused without confirmation, and nothing changes', () => {
  const save = saveWith(holding([item('brass-multitool', { heldBy: 's1' })], { tool: 'brass-multitool' }), { chest: [] })
  const sending = { fromProjectId: FROM, toProjectId: TO, itemId: 'brass-multitool' }
  assert.equal(sendItemProblem(save, sending), TRANSFER_REFUSALS.heldUnconfirmed)
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

test('a relic not owned or one the target owns is refused', () => {
  const save = saveWith(withRelics(['rimeheart', 'tidecall-conch'], 'rimeheart'), withRelics(['tidecall-conch'], 'tidecall-conch'))
  const problem = (relicId, toProjectId = TO) => sendRelicProblem(save, { fromProjectId: FROM, toProjectId, relicId })
  assert.equal(problem('everwarm-anvil'), TRANSFER_REFUSALS.noRelic)
  assert.equal(problem('tidecall-conch'), TRANSFER_REFUSALS.relicOwned)
  assert.equal(problem('tidecall-conch', ELSEWHERE), TRANSFER_REFUSALS.otherWorld)
  assert.equal(sendRelic(save, { fromProjectId: FROM, toProjectId: TO, relicId: 'tidecall-conch' }), save)
})

test('the active relic can be sent: the sending room is left with no active relic', () => {
  const save = saveWith(withRelics(['rimeheart', 'tidecall-conch'], 'rimeheart'), withRelics(['everwarm-anvil'], 'everwarm-anvil'))
  assert.equal(sendRelicProblem(save, { fromProjectId: FROM, toProjectId: TO, relicId: 'rimeheart' }), null)
  const next = sendRelic(save, { fromProjectId: FROM, toProjectId: TO, relicId: 'rimeheart' })
  assert.deepEqual(relicsOf(next, FROM), { relics: ['tidecall-conch'], active: null, relicPity: 0, bossPity: 0 })
  assert.deepEqual(relicsOf(next, TO).relics, ['everwarm-anvil', 'rimeheart'])
  assert.equal(relicsOf(next, TO).active, 'everwarm-anvil')
})

test('a room whose only relic was active and sent keeps none, and a target with none makes it active', () => {
  const save = saveWith(withRelics(['rimeheart'], 'rimeheart'), {})
  const next = sendRelic(save, { fromProjectId: FROM, toProjectId: TO, relicId: 'rimeheart' })
  // A room with nothing legendary left keeps no record of it at all.
  assert.equal(relicsOf(next, FROM), null)
  assert.equal(relicsOf(next, TO).active, 'rimeheart')
  assert.equal(cleanSave(next, { cityIds: [], legendary }).ok, true)
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

const characterOf = (save, sessionId) => save.worlds.main.projects[FROM].characters[sessionId]

test('a held item is taken from its holder, whose slot takes the best free item at once', () => {
  const chest = [item('brass-multitool', { level: 5, heldBy: 's1' }), item('trusty-pocketknife', { level: 1 })]
  const save = saveWith(holding(chest, { tool: 'brass-multitool' }), { chest: [] })
  const sent = sendItem(save, { fromProjectId: FROM, toProjectId: TO, itemId: 'brass-multitool', confirmHeld: true }, index)
  assert.deepEqual(chestOf(sent.save, TO).map((owned) => [owned.id, owned.heldBy]), [['brass-multitool', null]])
  assert.equal(characterOf(sent.save, 's1').equipment.tool, 'trusty-pocketknife')
  assert.equal(chestOf(sent.save, FROM).find((owned) => owned.id === 'trusty-pocketknife').heldBy, 's1')
  assert.deepEqual(sent.repicks, [{ sessionId: 's1', slot: 'tool', itemId: 'trusty-pocketknife' }])
})

test('a slot pinned by hand goes back to Auto when its item is sent', () => {
  const chest = [item('brass-multitool', { heldBy: 's1' }), item('ashwood-wand', { slot: 'weapon', damageType: 'magical', heldBy: 's1' })]
  const save = saveWith(holding(chest, { tool: 'brass-multitool', weapon: 'ashwood-wand' }, { class: 'magical', pinned: { tool: true, weapon: true } }), { chest: [] })
  const next = sendItem(save, { fromProjectId: FROM, toProjectId: TO, itemId: 'brass-multitool', confirmHeld: true }, index).save
  assert.deepEqual(characterOf(next, 's1').pinned, { weapon: true })
  assert.equal(characterOf(next, 's1').equipment.tool, null)
})

test('the last pin gone leaves no pins at all', () => {
  const save = saveWith(holding([item('brass-multitool', { heldBy: 's1' })], { tool: 'brass-multitool' }, { pinned: { tool: true } }), { chest: [] })
  const next = sendItem(save, { fromProjectId: FROM, toProjectId: TO, itemId: 'brass-multitool', confirmHeld: true }, index).save
  assert.equal(characterOf(next, 's1').pinned, undefined)
})

test('the holder re-picks only what it may hold: a weapon of its damage type', () => {
  const chest = [
    item('whittled-cudgel', { slot: 'weapon', damageType: 'physical', level: 4, heldBy: 's1' }),
    item('ashwood-wand', { slot: 'weapon', damageType: 'magical', level: 9 }),
    item('stone-club', { slot: 'weapon', damageType: 'physical', level: 0 })
  ]
  const save = saveWith(holding(chest, { weapon: 'whittled-cudgel' }), { chest: [] })
  const next = sendItem(save, { fromProjectId: FROM, toProjectId: TO, itemId: 'whittled-cudgel', confirmHeld: true }, index).save
  assert.equal(characterOf(next, 's1').equipment.weapon, 'stone-club')
})

test('the holder never takes a legendary item made for someone else', () => {
  const cleaver = legendaryItemFor(index.byId.get('labyrinth-cleaver'), 10)
  const madeFor = index.byId.get('labyrinth-cleaver').class
  const other = ['physical', 'magical', 'defense', 'support'].find((value) => value !== madeFor && value !== 'magical')
  const chest = [item('whittled-cudgel', { slot: 'weapon', damageType: 'physical', heldBy: 's1' }), cleaver]
  const save = saveWith(holding(chest, { weapon: 'whittled-cudgel' }, { class: other }), { chest: [] })
  const next = sendItem(save, { fromProjectId: FROM, toProjectId: TO, itemId: 'whittled-cudgel', confirmHeld: true }, index).save
  assert.equal(characterOf(next, 's1').equipment.weapon, null)
  assert.equal(chestOf(next, FROM).find((owned) => owned.legendary).heldBy, null)
})

test('a held legendary item is sent under its own id and its holder re-picks', () => {
  const entry = index.byId.get('labyrinth-cleaver')
  const cleaver = { ...legendaryItemFor(entry, 10), heldBy: 's1' }
  const chest = [cleaver, item('whittled-cudgel', { slot: 'weapon', damageType: 'physical' })]
  const save = saveWith(holding(chest, { weapon: cleaver.id }, { class: entry.class }), { chest: [] })
  const sent = sendItem(save, { fromProjectId: FROM, toProjectId: TO, itemId: cleaver.id, confirmHeld: true }, index)
  assert.deepEqual(chestOf(sent.save, TO).map((owned) => [owned.id, owned.legendary]), [['labyrinth-cleaver', true]])
  assert.equal(characterOf(sent.save, 's1').equipment.weapon, 'whittled-cudgel')
})

test('several items go at once, held and free, and nothing is lost or doubled', () => {
  const chest = [
    item('brass-multitool', { heldBy: 's1' }),
    item('trusty-pocketknife'),
    item('padded-jerkin', { slot: 'outfit', heldBy: 's1' }),
    item('whittled-cudgel', { slot: 'weapon', damageType: 'physical' })
  ]
  const save = saveWith(holding(chest, { tool: 'brass-multitool', outfit: 'padded-jerkin' }), { chest: [] })
  const itemIds = ['brass-multitool', 'padded-jerkin', 'whittled-cudgel']
  const sent = sendItem(save, { fromProjectId: FROM, toProjectId: TO, itemIds, confirmHeld: true }, index)
  const ids = [...chestOf(sent.save, FROM), ...chestOf(sent.save, TO)].map((owned) => owned.id).sort()
  assert.deepEqual(ids, ['brass-multitool', 'padded-jerkin', 'trusty-pocketknife', 'whittled-cudgel'])
  assert.deepEqual(chestOf(sent.save, TO).map((owned) => owned.id).sort(), [...itemIds].sort())
  assert.deepEqual(characterOf(sent.save, 's1').equipment, { weapon: null, outfit: null, tool: 'trusty-pocketknife' })
  assert.equal(sent.repicks.length, 2)
})

test('a list with an item twice, none at all, or two copies of one legendary item is refused', () => {
  const entry = index.byId.get('labyrinth-cleaver')
  const save = saveWith({ chest: [item('brass-multitool'), legendaryItemFor(entry, 1), { ...legendaryItemFor(entry, 2), id: 'labyrinth-cleaver-2' }] }, { chest: [] })
  const problem = (itemIds) => sendItemProblem(save, { fromProjectId: FROM, toProjectId: TO, itemIds })
  assert.equal(problem(['brass-multitool', 'brass-multitool']), TRANSFER_REFUSALS.twice)
  assert.equal(problem([]), TRANSFER_REFUSALS.noItems)
  assert.equal(problem(['labyrinth-cleaver', 'labyrinth-cleaver-2']), TRANSFER_REFUSALS.legendaryTwice)
})

test('the save still passes the check an imported file must pass after a held item is sent', () => {
  const chest = [item('brass-multitool', { heldBy: 's1' }), item('trusty-pocketknife')]
  const save = saveWith(holding(chest, { tool: 'brass-multitool' }, { pinned: { tool: true } }), { chest: [] })
  const next = sendItem(save, { fromProjectId: FROM, toProjectId: TO, itemId: 'brass-multitool', confirmHeld: true }, index).save
  const checked = cleanSave(next, { cityIds: [], legendary })
  assert.equal(checked.ok, true, checked.problem)
})
