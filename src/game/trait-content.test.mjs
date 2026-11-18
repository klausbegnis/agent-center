import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { MIN_TRAITS, indexTraits, traitIndexOf, validateTraits } from './trait-content.mjs'
import { TRAIT_EFFECT_CAPS } from './trait-constants.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const traits = readJson('../../game/traits.json')
const cities = readJson('../../game/cities.json')
const races = readJson('../../game/races.json')

/** The shipped file with one trait changed. */
const withTrait = (change) => ({ ...traits, traits: traits.traits.map((trait, at) => (at === 0 ? change(trait) : trait)) })

test('the shipped catalogue is valid against the cities and races', () => {
  assert.deepEqual(validateTraits(traits, { cities, races }), [])
})

test('the catalogue holds at least forty traits in every tier, a few of them double-edged', () => {
  assert.ok(traits.traits.length >= MIN_TRAITS)
  const index = indexTraits(traits)
  for (const tier of ['common', 'rare', 'epic', 'mythic']) assert.ok(index.byTier[tier].length > 0, tier)
  assert.ok(traits.traits.filter((trait) => trait.drawback).length >= 3)
})

test('every trait name is used once', () => {
  const names = traits.traits.map((trait) => trait.name)
  assert.equal(new Set(names).size, names.length)
})

test('an effect stronger than the traits\' cap is refused', () => {
  const strong = withTrait((trait) => ({ ...trait, effect: { effect: 'damage', amount: TRAIT_EFFECT_CAPS.damage * 2 } }))
  assert.ok(validateTraits(strong).some((problem) => problem.includes('at most')))
})

test('a drawback must take something away, and not much', () => {
  const kind = withTrait((trait) => ({ ...trait, drawback: { effect: 'damage', amount: 0.01 } }))
  const heavy = withTrait((trait) => ({ ...trait, drawback: { effect: 'damage', amount: -0.05 } }))
  assert.ok(validateTraits(kind).some((problem) => problem.includes('drawback')))
  assert.ok(validateTraits(heavy).some((problem) => problem.includes('drawback')))
})

test('a race the races file does not have is refused', () => {
  const unknown = withTrait((trait) => ({ ...trait, effect: { effect: 'raceDamage', amount: 0.01, races: ['mermaid'] } }))
  assert.ok(validateTraits(unknown, { races }).some((problem) => problem.includes('races')))
})

test('a mythic trait is never sold, so it names no city', () => {
  const mythic = traits.traits.find((trait) => trait.tier === 'mythic')
  const sold = { ...traits, traits: traits.traits.map((trait) => (trait === mythic ? { ...trait, city: 'goldmill' } : trait)) }
  assert.ok(validateTraits(sold, { cities }).some((problem) => problem.includes('mythic')))
})

test('a city with too few traits to fill its broker\'s day is refused', () => {
  const few = { ...traits, traits: traits.traits.map((trait) => (trait.city === 'runespire' ? { ...trait, city: 'goldmill' } : trait)) }
  assert.ok(validateTraits(few, { cities }).some((problem) => problem.includes('runespire')))
})

test('the index is built once per content and is absent without traits', () => {
  const content = { traits }
  assert.equal(traitIndexOf(content), traitIndexOf(content))
  assert.equal(traitIndexOf({}), null)
})
