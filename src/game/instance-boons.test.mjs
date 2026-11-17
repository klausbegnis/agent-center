import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { BOON_TYPES, MODIFIER_TYPES, modifierAt, runBonuses, validateRunContent } from './instance-boons.mjs'
import { indexInstances } from './instance-content.mjs'
import { EFFECT_TYPES } from './legendary-content.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const legendary = readJson('legendary.json')
const problemsWith = (change) => {
  const data = readJson('instances.json')
  change(data)
  return validateRunContent(data, { legendary })
}
const mentions = (problems, text) => assert.ok(problems.some((problem) => problem.includes(text)), problems.join('\n'))

test('the shipped boons, modifiers and relics of the instances are valid', () => {
  assert.deepEqual(validateRunContent(readJson('instances.json'), { legendary }), [])
  assert.equal(readJson('instances.json').boons.length, 10)
})

test('a boon is one effect of the run\'s own types, within its bound', () => {
  mentions(problemsWith((data) => { data.boons[0].effect = { effect: 'damage', amount: 0.1 } }), '"effect.effect" must be one of')
  mentions(problemsWith((data) => { data.boons[0].effect.amount = 2 }), 'at most 0.5')
  mentions(problemsWith((data) => { data.boons[5].effect.amount = 1.5 }), 'whole')
  mentions(problemsWith((data) => { data.boons[1].id = data.boons[0].id }), 'same id')
  mentions(problemsWith((data) => { data.boons.length = 2 }), 'at least 4 boons')
})

test('a modifier names an affix and rooms with a fight, or a bounded amount', () => {
  mentions(problemsWith((data) => { data.modifiers[0].effect.affix = 'sleepy' }), '"effect.affix"')
  mentions(problemsWith((data) => { data.modifiers[0].effect.rooms = ['vault'] }), '"effect.rooms"')
  mentions(problemsWith((data) => { data.modifiers.find((each) => each.id === 'crowded-hall').effect.amount = 9 }), 'whole number from 4 to 6')
  mentions(problemsWith((data) => { data.modifiers.find((each) => each.id === 'long-rests').effect.amount = 0 }), 'above 0')
})

test('each instance rotates modifiers of the file and is won with its own relic', () => {
  mentions(problemsWith((data) => { data.instances[0].modifiers = ['made-up'] }), '"modifiers" must list')
  mentions(problemsWith((data) => { data.instances[0].relic = 'rimebitten-horn' }), 'names this instance')
  mentions(problemsWith((data) => { data.instances[0].relic = 'rimeheart' }), 'an instance relic')
})

test('tier 1 has no modifier, then the rotation comes round and round', () => {
  const data = readJson('instances.json')
  const index = indexInstances(data)
  const crypt = index.byId.get('sunken-crypt')
  assert.equal(modifierAt(crypt, 1, index), null)
  const ids = [2, 3, 4, 5].map((tier) => modifierAt(crypt, tier, index).id)
  assert.deepEqual(ids, [...crypt.modifiers, crypt.modifiers[0]])
})

test('the boon and the modifier turn into the numbers a run uses, and nothing chosen changes nothing', () => {
  const none = runBonuses(null, null)
  assert.deepEqual([none.bossDamage, none.restFactor, none.timeFactor, none.tries, none.checkFactor], [0, 1, 1, 0, 1])
  assert.equal(none.hallFights, null)
  const boons = Object.fromEntries(readJson('instances.json').boons.map((boon) => [boon.id, boon]))
  const modifiers = Object.fromEntries(readJson('instances.json').modifiers.map((each) => [each.id, each]))
  const salts = runBonuses(boons['smelling-salts'], modifiers['long-rests'])
  assert.equal(salts.restFactor, 0.5 * 2)
  assert.deepEqual(runBonuses(null, modifiers['armored-boss']).affixes, { boss: 'armored' })
  assert.equal(runBonuses(boons['binding-chalk'], null).noBossAffix, true)
  assert.equal(runBonuses(null, modifiers['crowded-hall']).hallFights, 5)
})

test('boons and modifiers add nothing to what legendary loot, the bestiary and the settlement sum under the caps', () => {
  for (const type of [...Object.keys(BOON_TYPES), ...Object.keys(MODIFIER_TYPES)]) {
    assert.ok(!Object.hasOwn(EFFECT_TYPES, type), `${type} is also a capped effect type`)
  }
  const data = readJson('instances.json')
  for (const boon of data.boons) assert.ok(boon.effect.amount <= BOON_TYPES[boon.effect.effect].max)
})
