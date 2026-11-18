import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { TRAIT_EFFECT_TYPES } from '../../src/game/trait-content.mjs'
import { WORDED_TRAIT_EFFECTS, traitEffectText } from './trait-labels.js'
import { agentTraits, collection, roomScrolls, scrollChoices, swapCost, traitEntries, traitSlotsOf } from './trait-model.js'

const traits = JSON.parse(readFileSync(new URL('../../game/traits.json', import.meta.url), 'utf8'))
const catalogue = {
  tiers: traits.tiers,
  entries: traits.traits.map((trait) => ({ ...trait, city: trait.city ?? null })),
  total: traits.traits.length,
  slotLevels: [10, 20, 30]
}
const game = {
  traits: catalogue,
  rooms: { room: { scrolls: [{ traitId: 'stout-arm', count: 2 }, { traitId: 'whirlwind', count: 1 }, { traitId: 'gone', count: 1 }] } },
  characters: { agent: { traits: { carried: ['stout-arm'], slots: 2, nextSlotAt: 20, born: 'stout-arm' } } }
}
const entries = traitEntries(game)

test('every effect type a trait may have is worded, and every shipped trait reads as a line', () => {
  assert.deepEqual([...WORDED_TRAIT_EFFECTS].sort(), Object.keys(TRAIT_EFFECT_TYPES).sort())
  for (const trait of traits.traits) assert.ok(traitEffectText(trait).length > 5, trait.id)
})

test('a double-edged trait says its drawback', () => {
  assert.match(traitEffectText(entries.get('hothead')), /^\+3% damage, but monsters drain 1\.5% more stamina/)
})

test('a character\'s slots are its traits, then its free slots, then the slots it earns later', () => {
  const slots = traitSlotsOf(game.characters.agent, entries, catalogue.slotLevels)
  assert.deepEqual(slots.map((slot) => slot.kind), ['trait', 'free', 'locked', 'locked'])
  assert.deepEqual(slots.filter((slot) => slot.kind === 'locked').map((slot) => slot.level), [20, 30])
  assert.equal(slots[0].isBorn, true)
})

test('a room\'s scrolls come best tier first, and an unknown one is left out', () => {
  assert.deepEqual(roomScrolls(game, 'room', entries).map((scroll) => scroll.entry.id), ['whirlwind', 'stout-arm'])
})

test('a character is offered only the scrolls of traits it does not carry', () => {
  const choices = scrollChoices(game.characters.agent, roomScrolls(game, 'room', entries))
  assert.deepEqual(choices.map((scroll) => scroll.entry.id), ['whirlwind'])
})

test('a swap\'s fee comes from the world, and says whether the world can pay', () => {
  const world = { coins: 100, traits: { swapFees: { common: 40, epic: 900 } } }
  assert.deepEqual(swapCost(world, entries.get('stout-arm')), { fee: 40, canPay: true })
  assert.equal(swapCost(world, entries.get('whirlwind')).canPay, false)
})

test('the agent card shows the traits a character carries, nothing for a guest', () => {
  const state = { game: { ...game, characters: { ...game.characters, guest: { guest: true } } } }
  assert.deepEqual(agentTraits(state, { id: 'agent' }).map((entry) => entry.name), ['Stout Arm'])
  assert.equal(agentTraits(state, { id: 'guest' }), null)
})

test('the collection counts the traits a world has had of the whole catalogue', () => {
  assert.deepEqual(collection({ traits: { known: ['a', 'b'] } }, game), { known: 2, total: traits.traits.length })
  assert.equal(collection({}, game), null)
})
