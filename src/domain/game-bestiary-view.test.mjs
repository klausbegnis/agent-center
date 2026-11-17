import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bestiaryItemIds, describeBestiaryEvent } from './game-bestiary-view.mjs'

const bestiary = {
  races: [{ id: 'orc', name: 'Orcs' }],
  bosses: [{ id: 'skrix', name: 'Skrix', epithet: 'the Lantern Thief' }]
}

test('a bestiary event is named after its race or its boss', () => {
  assert.equal(describeBestiaryEvent({ type: 'bestiary', kind: 'race', id: 'orc', discovered: true }, bestiary).name, 'Orcs')
  assert.equal(describeBestiaryEvent({ type: 'bestiary', kind: 'boss', id: 'skrix', discovered: true }, bestiary).name,
    'Skrix, the Lantern Thief')
  const hunter = { type: 'bestiary', kind: 'hunter', level: 2 }
  assert.deepEqual(describeBestiaryEvent(hunter, bestiary), hunter)
  assert.equal(describeBestiaryEvent({ type: 'bestiary', kind: 'race', id: 'kraken' }, bestiary).name, undefined)
})

test('only the boss items a world found are named in the state', () => {
  const worlds = [{ bestiary: { bosses: [{ item: 'pilfered-lantern', found: true }, { item: 'labyrinth-cleaver', found: false }, { item: null, found: false }] } }, {}]
  assert.deepEqual(bestiaryItemIds(worlds), ['pilfered-lantern'])
})
