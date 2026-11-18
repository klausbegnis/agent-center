import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import { SCROLL_COPIES } from './trait-constants.mjs'
import { traitIndexOf } from './trait-content.mjs'
import { bornTrait } from './trait-effects.mjs'
import { TRAIT_REFUSALS, rollScrollDrop, settleScrollDrop } from './traits.mjs'
import { emptySave } from './worlds.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('../../game/monsters.json'),
  items: readJson('../../game/items.json'),
  cities: readJson('../../game/cities.json'),
  traits: readJson('../../game/traits.json')
}
const engine = createEngine({ content })
const index = traitIndexOf(content)
const ROOM = 'rumble-banana'
const OTHER = 'turbo-waffle'

const tokensFor = (save, sessionId = 'first', projectId = ROOM) =>
  engine.applyTokens(save, { projectId, sessionId, tokens: 1_000_000, activity: 'think', now: 0 })
const project = (save, projectId = ROOM) => save.worlds.main.projects[projectId]
/** The save with a room changed. */
function withRoom(save, change, projectId = ROOM) {
  const world = save.worlds.main
  return { ...save, worlds: { ...save.worlds, main: { ...world, projects: { ...world.projects, [projectId]: change(project(save, projectId)) } } } }
}
const withCharacter = (save, change, sessionId = 'first') => withRoom(save, (room) =>
  ({ ...room, characters: { ...room.characters, [sessionId]: change(room.characters[sessionId]) } }))
const withScrolls = (save, scrolls, projectId = ROOM) => withRoom(save, (room) => ({ ...room, scrolls }), projectId)
const withCoins = (save, coins) => ({ ...save, worlds: { ...save.worlds, main: { ...save.worlds.main, coins } } })
const traitsOfFirst = (save) => project(save).characters.first.traits
const born = bornTrait('first', index)
/** A trait that is not the first character's born trait, of a tier. */
const otherTrait = (tier, skip = []) => index.byTier[tier].find((entry) => entry.id !== born && !skip.includes(entry.id)).id

test('a new character is born with its trait, and the view shows it with its slots', () => {
  const save = tokensFor(emptySave())
  const member = engine.view(save).worlds[0].projects[0].party[0]
  assert.deepEqual(member.traits.carried, [born])
  assert.equal(member.traits.slots, 1)
  assert.equal(member.traits.nextSlotAt, 10)
})

test('a scroll teaches its trait into a free slot and is used up', () => {
  const scroll = otherTrait('common')
  let save = withCharacter(tokensFor(emptySave()), (character) => ({ ...character, level: 12 }))
  save = withScrolls(save, { [scroll]: 1 })
  const taught = engine.teachTrait(save, { projectId: ROOM, sessionId: 'first', traitId: scroll })
  assert.deepEqual(traitsOfFirst(taught), [born, scroll])
  assert.equal(project(taught).scrolls, undefined)
})

test('a character with every slot full cannot be taught, and is told to swap', () => {
  const scroll = otherTrait('common')
  const save = withScrolls(tokensFor(emptySave()), { [scroll]: 1 })
  const choice = { projectId: ROOM, sessionId: 'first', traitId: scroll }
  assert.equal(engine.teachProblem(save, choice), TRAIT_REFUSALS.noSlot)
  assert.equal(engine.teachTrait(save, choice), save)
})

test('a trait already carried, or a scroll the chest lacks, is refused', () => {
  const save = withScrolls(withCharacter(tokensFor(emptySave()), (character) => ({ ...character, level: 12 })), { [born]: 1 })
  assert.equal(engine.teachProblem(save, { projectId: ROOM, sessionId: 'first', traitId: born }), TRAIT_REFUSALS.carries)
  assert.equal(engine.teachProblem(save, { projectId: ROOM, sessionId: 'first', traitId: otherTrait('rare') }), TRAIT_REFUSALS.noScroll)
})

test('a swap puts the scroll\'s trait in the old one\'s slot, and the old one back as a scroll, for a fee', () => {
  const scroll = otherTrait('rare')
  const save = withCoins(withScrolls(tokensFor(emptySave()), { [scroll]: 1 }), 100_000)
  const swapped = engine.swapTrait(save, { projectId: ROOM, sessionId: 'first', oldTraitId: born, traitId: scroll })
  assert.deepEqual(traitsOfFirst(swapped), [scroll])
  assert.deepEqual(project(swapped).scrolls, { [born]: 1 })
  assert.ok(swapped.worlds.main.coins < 100_000)
})

test('a swap the world cannot pay for is refused', () => {
  const scroll = otherTrait('rare')
  const save = withCoins(withScrolls(tokensFor(emptySave()), { [scroll]: 1 }), 0)
  const swap = { projectId: ROOM, sessionId: 'first', oldTraitId: born, traitId: scroll }
  assert.ok(engine.swapProblem(save, swap))
  assert.equal(engine.swapTrait(save, swap), save)
})

test('a retiring character gives the traits it was taught back as scrolls and keeps its born trait', () => {
  const scroll = otherTrait('common')
  let save = withCharacter(tokensFor(emptySave()), (character) => ({ ...character, level: 12 }))
  save = engine.teachTrait(withScrolls(save, { [scroll]: 1 }), { projectId: ROOM, sessionId: 'first', traitId: scroll })
  const closed = engine.closeSession(save, { projectId: ROOM, sessionId: 'first', now: 1 })
  assert.deepEqual(project(closed).scrolls, { [scroll]: 1 })
  const back = tokensFor(closed)
  assert.deepEqual(engine.view(back).worlds[0].projects[0].party[0].traits.carried, [born])
})

test('a scroll goes to another room of the world, never past the copies a chest keeps', () => {
  const scroll = otherTrait('common')
  let save = tokensFor(tokensFor(emptySave()), 'second', OTHER)
  save = withScrolls(save, { [scroll]: 2 })
  const sent = engine.sendScroll(save, { fromProjectId: ROOM, toProjectId: OTHER, traitId: scroll })
  assert.deepEqual(project(sent).scrolls, { [scroll]: 1 })
  assert.deepEqual(project(sent, OTHER).scrolls, { [scroll]: 1 })
  const full = withScrolls(save, { [scroll]: SCROLL_COPIES }, OTHER)
  assert.equal(engine.sendScrollProblem(full, { fromProjectId: ROOM, toProjectId: OTHER, traitId: scroll }), TRAIT_REFUSALS.chestFull)
})

test('a room left behind brings its scrolls and its characters\' taught traits to the room it moves into', () => {
  const scroll = otherTrait('common')
  let save = tokensFor(tokensFor(emptySave()), 'second', OTHER)
  save = withScrolls(save, { [scroll]: 1, [otherTrait('rare')]: 2 })
  const moved = engine.moveProjectItems(save, { fromProjectId: ROOM, toProjectId: OTHER, now: 1 })
  assert.equal(project(moved, OTHER).scrolls[scroll], 1)
  assert.equal(project(moved, OTHER).scrolls[otherTrait('rare')], 2)
})

test('only elites, champions and bosses drop scrolls, and the same kill always drops the same one', () => {
  const room = { characters: {} }
  const roll = (rank, seed) => rollScrollDrop({ monster: { rank }, seed, project: room }, index)
  const seeds = Array.from({ length: 4000 }, (_, at) => `main|${ROOM}|1|${at}`)
  assert.equal(seeds.filter((seed) => roll('normal', seed)).length, 0)
  assert.ok(seeds.filter((seed) => roll('boss', seed)).length > 50)
  assert.equal(roll('boss', seeds[7]), roll('boss', seeds[7]))
})

test('a better scroll find makes scrolls drop more often', () => {
  const seeds = Array.from({ length: 6000 }, (_, at) => `seed-${at}`)
  const count = (scrollFind) => seeds.filter((seed) =>
    rollScrollDrop({ monster: { rank: 'elite' }, seed, scrollFind, project: { characters: {} } }, index)).length
  assert.ok(count(0.6) > count(0))
})

test('a dropped scroll goes into the room\'s chest', () => {
  const seed = Array.from({ length: 500 }, (_, at) => `drop-${at}`)
    .find((candidate) => rollScrollDrop({ monster: { rank: 'legendary' }, seed: candidate, project: {} }, index))
  const state = { characters: {} }
  const traitId = settleScrollDrop(state, { monster: { rank: 'legendary' }, seed }, index)
  assert.deepEqual(state.scrolls, { [traitId]: 1 })
})

test('the world\'s collection keeps every trait it ever had, once an advance has seen it', () => {
  const save = tokensFor(emptySave())
  const advanced = engine.advance(save, { from: 0, to: 60_000, sessions: [] })
  assert.deepEqual(advanced.worlds.main.traits.known, [born])
  assert.deepEqual(engine.view(save).worlds[0].traits.known, [born])
})

test('without traits in the content nothing of them is kept or shown', () => {
  const { traits: _traits, ...plain } = content
  const plainEngine = createEngine({ content: plain })
  const save = plainEngine.applyTokens(emptySave(), { projectId: ROOM, sessionId: 'first', tokens: 1_000_000, activity: 'think', now: 0 })
  const advanced = plainEngine.advance(save, { from: 0, to: 60_000, sessions: [] })
  assert.equal(advanced.worlds.main.traits, undefined)
  assert.equal(plainEngine.view(advanced).traits, undefined)
  assert.equal(plainEngine.teachProblem(save, { projectId: ROOM, sessionId: 'first', traitId: 'stout-arm' }), TRAIT_REFUSALS.noTraits)
})
