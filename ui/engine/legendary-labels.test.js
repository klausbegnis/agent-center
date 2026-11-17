import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EFFECT_TYPES } from '../../src/game/legendary-content.mjs'
import { effectText, hoursText, listText, madeForText, sourceText, WORDED_EFFECTS } from './legendary-labels.js'

const shipped = JSON.parse(readFileSync(new URL('../../game/legendary.json', import.meta.url), 'utf8')).legendary

/** The amount as the text must show it: a share as a percentage, seconds and hours as they are. */
function shownAmount(effect) {
  if (effect.effect === 'restTime') return `${effect.amount} s`
  if (effect.effect === 'gatherHours') return hoursText(effect.amount)
  return `${Math.round(effect.amount * 1000) / 10}%`
}

test('every effect type the engine knows has words for each scope it acts in', () => {
  assert.deepEqual(Object.keys(WORDED_EFFECTS).sort(), Object.keys(EFFECT_TYPES).sort())
  for (const [type, { scopes }] of Object.entries(EFFECT_TYPES)) {
    assert.deepEqual([...WORDED_EFFECTS[type]].sort(), [...scopes].sort(), type)
  }
})

test('every shipped item\'s shown text states its effect\'s amount and qualifiers', () => {
  for (const entry of shipped) {
    const text = effectText(entry.effect, entry.slot)
    assert.ok(text.includes(shownAmount(entry.effect)), `${entry.id}: ${text}`)
    for (const material of entry.effect.materials ?? []) assert.ok(text.includes(material), `${entry.id}: ${text}`)
    if (entry.effect.damageType) assert.ok(text.includes(entry.effect.damageType), `${entry.id}: ${text}`)
    if (entry.effect.skill) assert.ok(text.toLowerCase().includes(entry.effect.skill), `${entry.id}: ${text}`)
    assert.ok(!/undefined|NaN/.test(text), `${entry.id}: ${text}`)
  }
})

test('a relic\'s text speaks of the party and equipment\'s of who holds it', () => {
  assert.equal(effectText({ effect: 'staminaDrain', scope: 'party', amount: 0.05 }), 'Monsters drain 5% less stamina')
  assert.equal(effectText({ effect: 'staminaDrain', scope: 'holder', amount: 0.04 }, 'weapon'),
    'While the wielder fights, monsters drain 4% less stamina')
  assert.equal(effectText({ effect: 'attackSpeed', scope: 'holder', amount: 0.04 }, 'outfit'), '+4% attack speed for the wearer')
  assert.equal(effectText({ effect: 'gatherYield', scope: 'holder', amount: 0.12, materials: ['ore'] }, 'tool'),
    '+12% ore while the holder mines')
  assert.equal(effectText({ effect: 'damage', scope: 'party', amount: 0.06, ranks: ['boss', 'legendary'] }),
    '+6% damage against bosses and legendary bosses')
  assert.equal(effectText({ effect: 'teleport', scope: 'party', amount: 1 }), '')
})

test('hours under one read as minutes', () => {
  assert.equal(hoursText(0.25), '15 min')
  assert.equal(hoursText(2), '2 h')
})

test('lists read as a sentence', () => {
  assert.equal(listText(['ore']), 'ore')
  assert.equal(listText(['crops', 'fish']), 'crops and fish')
  assert.equal(listText(['logs', 'hides', 'runes']), 'logs, hides and runes')
})

test('an item says where it comes from and who it is made for', () => {
  assert.equal(sourceText({ kind: 'equipment', boss: { name: 'Gorrath' } }), 'Dropped by Gorrath')
  assert.equal(sourceText({ kind: 'boss-relic', boss: { name: 'Skrix' } }), 'Skrix\'s own, never sold')
  assert.equal(madeForText({ class: 'physical' }), 'Made for a Fighter')
  assert.equal(madeForText({ trade: 'mining' }), 'Made for a miner')
})

const bestiary = JSON.parse(readFileSync(new URL('../../game/bestiary.json', import.meta.url), 'utf8'))

test('every bestiary perk and hunter level is worded with its amount and qualifiers', () => {
  const effects = [...bestiary.races.map((race) => race.perk), ...bestiary.hunter.levels.flat()]
  for (const effect of effects) {
    const text = effectText(effect)
    assert.ok(text.includes(shownAmount(effect)), `${effect.effect}: ${text}`)
    if (effect.damageType) assert.ok(text.includes(effect.damageType), text)
    assert.ok(!/undefined|NaN/.test(text), text)
  }
})

test('damage against a race names the race as the bestiary calls it', () => {
  const effect = { effect: 'raceDamage', scope: 'world', amount: 0.045, races: ['orc'] }
  assert.equal(effectText(effect, undefined, { raceNames: { orc: 'Orcs' } }), '+4.5% damage against orcs')
  assert.equal(effectText(effect), '+4.5% damage against orc')
})
