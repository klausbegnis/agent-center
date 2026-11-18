import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createCharacter } from './characters.mjs'
import { LEGENDARY_EFFECT_CAPS } from './constants.mjs'
import { memberBonuses, tokenBonuses } from './legendary-effects.mjs'
import { TRAIT_EFFECT_CAPS } from './trait-constants.mjs'
import { traitIndexOf } from './trait-content.mjs'
import {
  bornTrait,
  brokerDiscountOf,
  nextSlotLevel,
  traitEffectsOf,
  traitPartyBonuses,
  traitSlots,
  traitsOf,
  withTraitEffects
} from './trait-effects.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = { traits: readJson('../../game/traits.json') }
const index = traitIndexOf(content)

const characterOf = (sessionId, extra = {}) =>
  ({ ...createCharacter({ sessionId, livingClasses: [], skills: {}, now: 0 }), ...extra })
const roomWith = (...characters) => ({ characters: Object.fromEntries(characters.map((character) => [character.sessionId, character])) })

test('a character has one slot at birth and one more at each milestone', () => {
  assert.deepEqual([1, 9, 10, 19, 20, 30, 99].map(traitSlots), [1, 1, 2, 2, 3, 4, 4])
  assert.equal(nextSlotLevel(1), 10)
  assert.equal(nextSlotLevel(30), null)
})

test('the born trait is the same for the same session and is never mythic', () => {
  assert.equal(bornTrait('session-a', index), bornTrait('session-a', index))
  const borns = Array.from({ length: 400 }, (_, at) => index.byId.get(bornTrait(`session-${at}`, index)))
  assert.ok(borns.every((entry) => entry && entry.tier !== 'mythic'))
  assert.ok(new Set(borns.map((entry) => entry.id)).size > 20, 'many different traits are born')
  assert.ok(borns.filter((entry) => entry.tier === 'common').length > borns.length / 2, 'most are common')
})

test('a character from a save before traits carries its born trait, and its slots follow its level', () => {
  const old = characterOf('veteran', { level: 25 })
  assert.deepEqual(traitsOf(old, index), [bornTrait('veteran', index)])
  assert.equal(traitSlots(old.level), 3)
})

test('the traits a person set are the ones carried, and an id the content dropped is left out', () => {
  const taught = characterOf('taught', { traits: ['stout-arm', 'gone-trait', 'keen-eye'] })
  assert.deepEqual(traitsOf(taught, index), ['stout-arm', 'keen-eye'])
})

test('a trait acts on the character that carries it, through the equipment\'s path', () => {
  const fighter = characterOf('fighter', { traits: ['stout-arm'] })
  const room = roomWith(fighter)
  const held = withTraitEffects([], room, fighter, content)
  const plain = memberBonuses([], []).hitFactor('physical', 'normal')
  assert.ok(memberBonuses([], held).hitFactor('physical', 'normal') > plain)
})

test('a guest, never saved, carries no trait', () => {
  const guest = characterOf('guest')
  assert.deepEqual(traitEffectsOf(roomWith(), guest, content), [])
})

test('traits of one type add up to the traits\' cap and no more', () => {
  const stacked = characterOf('stacked', { level: 40, traits: ['heart-of-the-forge', 'hothead', 'stout-arm', 'duelist'] })
  const effects = traitEffectsOf(roomWith(stacked), stacked, content)
  const damage = effects.filter((effect) => effect.effect === 'damage').reduce((sum, effect) => sum + effect.amount, 0)
  assert.ok(Math.abs(damage - TRAIT_EFFECT_CAPS.damage) < 1e-9)
  assert.ok(TRAIT_EFFECT_CAPS.damage < LEGENDARY_EFFECT_CAPS.damage)
})

test('a double-edged trait gives its bonus and takes its drawback', () => {
  const owl = characterOf('owl', { traits: ['night-owl'] })
  const effects = traitEffectsOf(roomWith(owl), owl, content)
  assert.ok(effects.some((effect) => effect.effect === 'skillXp' && effect.amount > 0))
  assert.ok(effects.some((effect) => effect.effect === 'gatherYield' && effect.amount < 0))
})

test('a trait that makes characters learn faster raises the character\'s own experience', () => {
  const pupil = characterOf('pupil', { traits: ['bright-pupil'] })
  const held = withTraitEffects([], roomWith(pupil), pupil, content)
  assert.ok(tokenBonuses([], held, 'lore').characterFactor > 1)
})

test('a race trait adds damage against that race only', () => {
  const hunter = characterOf('hunter', { traits: ['goblin-wise'] })
  const bonuses = memberBonuses([], withTraitEffects([], roomWith(hunter), hunter, content))
  assert.ok(bonuses.hitFactor('physical', 'normal', 'goblin') > bonuses.hitFactor('physical', 'normal', 'orc'))
})

test('the party\'s traits make items drop more against their races and scrolls drop more', () => {
  const finder = characterOf('finder', { traits: ['web-shaker', 'magpie'] })
  const party = traitPartyBonuses(roomWith(finder), [finder], content)
  assert.ok(party.raceDrop('spider') > 0)
  assert.equal(party.raceDrop('goblin'), 0)
  assert.ok(party.scrollFind > 0)
})

test('every living character\'s trading traits lower the world\'s broker prices, under a cap', () => {
  const traders = ['guild-patron', 'silver-tongue', 'haggler'].map((id, at) => characterOf(`t${at}`, { traits: [id] }))
  const world = { projects: { a: roomWith(...traders), b: roomWith(characterOf('plain', { traits: [] })) } }
  assert.equal(brokerDiscountOf(world, index), TRAIT_EFFECT_CAPS.brokerDiscount)
  assert.equal(brokerDiscountOf({ projects: {} }, index), 0)
})
