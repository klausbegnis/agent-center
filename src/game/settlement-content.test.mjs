import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { LEGENDARY_EFFECT_CAPS } from './constants.mjs'
import { indexSettlement, settlementIndexOf, validateSettlement } from './settlement-content.mjs'
import { GROUP_UPGRADE_IDS } from './spending.mjs'

const shipped = () => JSON.parse(readFileSync(new URL('../../game/settlement.json', import.meta.url), 'utf8'))
const known = { upgradeIds: GROUP_UPGRADE_IDS }
const problemsWith = (change) => {
  const data = shipped()
  change(data)
  return validateSettlement(data, known)
}

test('the shipped settlement is valid', () => {
  assert.deepEqual(validateSettlement(shipped(), known), [])
})

test('every group upgrade is exactly one building', () => {
  const missing = problemsWith((data) => data.buildings.pop())
  assert.ok(missing.some((problem) => problem.includes('has no building')), missing.join('\n'))
  const twice = problemsWith((data) => {
    data.buildings[1].upgrade = data.buildings[0].upgrade
  })
  assert.ok(twice.some((problem) => problem.includes('same upgrade')), twice.join('\n'))
  const unknown = problemsWith((data) => { data.buildings[0].upgrade = 'moat' })
  assert.ok(unknown.some((problem) => problem.includes('"upgrade" must be one of')), unknown.join('\n'))
})

test('stages start at 0 and each needs more building levels than the one before', () => {
  assert.ok(problemsWith((data) => { data.stages[0].from = 1 }).some((problem) => problem.includes('start "from" 0')))
  const same = problemsWith((data) => {
    data.stages[2].from = data.stages[1].from
  })
  assert.ok(same.some((problem) => problem.includes('above the one before')))
})

test('a building opens at a stage that exists and its tiers rise from level 1', () => {
  assert.ok(problemsWith((data) => { data.buildings[0].opensAt = 'metropolis' }).some((problem) => problem.includes('"opensAt"')))
  assert.ok(problemsWith((data) => { data.buildings[0].tiers[0].from = 0 }).some((problem) => problem.includes('start "from" 1')))
  assert.ok(problemsWith((data) => { data.buildings[0].tiers[2].from = 2 }).some((problem) => problem.includes('above the one before')))
})

test('art is a PNG served with the UI', () => {
  assert.ok(problemsWith((data) => { data.stages[0].art = '../secret.png' }).some((problem) => problem.includes('"art"')))
  const city = problemsWith((data) => {
    data.buildings[0].tiers[0].art = 'ui/cities/goldmill.png'
  })
  assert.ok(city.some((problem) => problem.includes('"art"')))
  assert.ok(problemsWith((data) => { data.stages[1].alt = '' }).some((problem) => problem.includes('"alt"')))
})

test('a stage bonus is a world effect, and all of them together fit under the caps', () => {
  const party = problemsWith((data) => {
    data.stages[1].bonus = [{ effect: 'staminaPool', scope: 'party', amount: 0.01 }]
  })
  assert.ok(party.some((problem) => problem.includes('scope "world"')), party.join('\n'))
  const holderOnly = problemsWith((data) => {
    data.stages[1].bonus = [{ effect: 'critChance', scope: 'world', amount: 0.01 }]
  })
  assert.ok(holderOnly.some((problem) => problem.includes('cannot act on the world')), holderOnly.join('\n'))
  const tooMuch = problemsWith((data) => {
    for (const stage of data.stages) stage.bonus = [{ effect: 'staminaPool', scope: 'world', amount: LEGENDARY_EFFECT_CAPS.staminaPool / 2 }]
  })
  assert.ok(tooMuch.some((problem) => problem.includes('add up to')), tooMuch.join('\n'))
})

test('coins are asked from a tier every building has, and renovation names its step', () => {
  assert.ok(problemsWith((data) => { data.coinsFromTier = 1 }).some((problem) => problem.includes('"coinsFromTier"')))
  assert.ok(problemsWith((data) => { data.coinsFromTier = 9 }).some((problem) => problem.includes('"coinsFromTier"')))
  assert.ok(problemsWith((data) => { data.renovation = { every: 0 } }).some((problem) => problem.includes('"renovation"')))
})

test('unknown keys are refused at every level', () => {
  assert.ok(problemsWith((data) => { data.extra = 1 }).some((problem) => problem.includes('"extra"')))
  assert.ok(problemsWith((data) => { data.buildings[0].colour = 'red' }).some((problem) => problem.includes('"colour"')))
  assert.ok(problemsWith((data) => { data.stages[0].music = 'lute' }).some((problem) => problem.includes('"music"')))
})

test('the index finds a building by its upgrade and a stage by its place', () => {
  const index = indexSettlement(shipped())
  const hearth = index.byUpgrade.get('campfire')
  assert.equal(hearth.id, 'hearth')
  assert.equal(hearth.opensAt, 0)
  assert.equal(index.stages[0].id, 'camp')
  assert.equal(index.renovationEvery, shipped().renovation.every)
  assert.equal(indexSettlement(null), null)
})

test('the index of a content file is built once', () => {
  const content = { settlement: shipped() }
  assert.equal(settlementIndexOf(content), settlementIndexOf(content))
  assert.equal(settlementIndexOf({}), null)
})
