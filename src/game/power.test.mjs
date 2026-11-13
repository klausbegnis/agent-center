import assert from 'node:assert/strict'
import { test } from 'node:test'
import { POWER_GROWTH } from './constants.mjs'
import { characterHit, critChance, pace, partyHits, referencePartyHit } from './power.mjs'
import { emptySkill } from './progression.mjs'
import { ATTRIBUTES } from './skills.mjs'

const BARE_ATTRIBUTES = Object.fromEntries(ATTRIBUTES.map((attribute) => [attribute, 0]))

function character(className, overrides = {}) {
  return {
    class: className,
    level: 11,
    attributes: { ...BARE_ATTRIBUTES },
    ...overrides
  }
}

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`)
}

test('a normal working pace counts as one', () => {
  assert.equal(pace(20_000), 1)
})

test('pace never drops below a quarter or rises above double', () => {
  assert.equal(pace(0), 0.25)
  assert.equal(pace(1_000_000), 2)
  assert.equal(pace(Number.NaN), 0.25)
})

test('precision adds half a percent of critical chance per point', () => {
  close(critChance(10), 0.1)
})

test('critical chance stops at one half', () => {
  assert.equal(critChance(10_000), 0.5)
})

test('a bare seasoned physical character at level 1 hits by the formula', () => {
  const hit = characterHit({ character: character('physical'), skills: {}, tokensPerMinute: 20_000 })
  close(hit.amount, 10 * POWER_GROWTH * 1.3 * 1.05)
  assert.equal(hit.type, 'physical')
})

test('only the magical class deals magical damage', () => {
  const skills = {}
  const types = ['physical', 'magical', 'defense', 'support'].map(
    (className) => characterHit({ character: character(className), skills, tokensPerMinute: 20_000 }).type
  )
  assert.deepEqual(types, ['physical', 'magical', 'physical', 'physical'])
})

test('the class skill, attribute, weapon, pace and agility all raise the hit', () => {
  const base = characterHit({ character: character('magical'), skills: {}, tokensPerMinute: 20_000 }).amount
  const trained = characterHit({
    character: character('magical', { attributes: { ...BARE_ATTRIBUTES, arcane: 10, agility: 10 } }),
    skills: { arcana: { ...emptySkill(), level: 2 } },
    weaponFactor: 1.5,
    tokensPerMinute: 40_000
  }).amount
  close(trained / base, POWER_GROWTH * 1.2 * 1.5 * 2 * 1.1)
})

test('a newcomer hits for three quarters of a seasoned character', () => {
  const skills = {}
  const newcomerCharacter = character('defense', { level: 1 })
  const newcomer = characterHit({ character: newcomerCharacter, skills, tokensPerMinute: 20_000 })
  const seasoned = characterHit({ character: character('defense'), skills, tokensPerMinute: 20_000 })
  close(newcomer.amount / seasoned.amount, 0.75)
})

test('a support raises every other member’s hit but not its own', () => {
  const totals = partyHits([
    { class: 'physical', amount: 100, type: 'physical' },
    { class: 'support', amount: 10, type: 'physical' }
  ])
  close(totals.physical, 115 + 10)
})

test('several supports give one aura, and each one gets the other’s', () => {
  const totals = partyHits([
    { class: 'magical', amount: 100, type: 'magical' },
    { class: 'support', amount: 10, type: 'physical' },
    { class: 'support', amount: 10, type: 'physical' }
  ])
  close(totals.magical, 115)
  close(totals.physical, 23)
})

test('two classes fighting get no full party bonus', () => {
  const totals = partyHits([
    { class: 'physical', amount: 100, type: 'physical' },
    { class: 'magical', amount: 100, type: 'magical' }
  ])
  assert.deepEqual(totals, { physical: 100, magical: 100, total: 200 })
})

test('three distinct classes fighting add the full party bonus to all', () => {
  const totals = partyHits([
    { class: 'physical', amount: 100, type: 'physical' },
    { class: 'magical', amount: 100, type: 'magical' },
    { class: 'defense', amount: 100, type: 'physical' }
  ])
  close(totals.total, 330)
})

test('an empty party deals nothing', () => {
  assert.deepEqual(partyHits([]), { physical: 0, magical: 0, total: 0 })
})

test('the reference party splits its hit between physical and magical', () => {
  const reference = referencePartyHit(10)
  close(reference.physical + reference.magical, reference.total)
  assert.ok(reference.magical > 0 && reference.physical > reference.magical)
})

test('the reference party grows by about four percent a level', () => {
  for (let level = 1; level < 120; level++) {
    if ((level + 1) % 5 === 0) continue
    const growth = referencePartyHit(level + 1).total / referencePartyHit(level).total
    assert.ok(growth >= POWER_GROWTH - 1e-9 && growth < 1.065, `level ${level} grows by ${growth}`)
  }
})

test('the reference party jumps every five levels as its weapon gains a level', () => {
  close(referencePartyHit(5).total / referencePartyHit(4).total, POWER_GROWTH * 1.05)
  close(referencePartyHit(15).total / referencePartyHit(14).total, (POWER_GROWTH * 1.15) / 1.1)
})

test('the reference party keeps growing across a prestige of its skills', () => {
  assert.ok(referencePartyHit(100).total > referencePartyHit(99).total * POWER_GROWTH)
})
