import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { BOON_TYPES, MODIFIER_TYPES } from '../../src/game/instance-boons.mjs'
import { boonText, modifierText, WORDED_BOONS, WORDED_MODIFIERS } from './instance-labels.js'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))

test('every boon and modifier type has words, and each shipped one states its amount', () => {
  assert.deepEqual([...WORDED_BOONS].sort(), Object.keys(BOON_TYPES).sort())
  assert.deepEqual([...WORDED_MODIFIERS].sort(), Object.keys(MODIFIER_TYPES).sort())
  const data = readJson('instances.json')
  for (const boon of data.boons) {
    const text = boonText(boon.effect)
    assert.ok(text && !/undefined|NaN/.test(text), `${boon.id}: ${text}`)
  }
  for (const modifier of data.modifiers) {
    const text = modifierText(modifier.effect)
    assert.ok(text && !/undefined|NaN/.test(text), `${modifier.id}: ${text}`)
  }
  assert.equal(boonText({ effect: 'bossDamage', amount: 0.15 }), '+15% damage against the boss')
  assert.equal(modifierText({ effect: 'affix', affix: 'enraged', rooms: ['entrance', 'hall', 'elite', 'boss'] }), 'Every monster is enraged')
  assert.equal(modifierText({ effect: 'affix', affix: 'armored', rooms: ['boss'] }), 'The boss is armored')
  assert.equal(modifierText({ effect: 'affix', affix: 'swift', rooms: ['hall'] }), 'The hall\'s monsters are swift')
  assert.equal(modifierText({ effect: 'hallFights', amount: 5 }), 'The hall holds 5 fights')
})
