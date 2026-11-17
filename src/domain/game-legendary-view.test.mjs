import assert from 'node:assert/strict'
import { test } from 'node:test'
import { describeLegendaryDrop, legendaryMarks, legendaryShown } from './game-legendary-view.mjs'

const content = {
  relicCount: 22,
  equipmentCount: 12,
  entries: {
    rimeheart: { id: 'rimeheart', name: 'Rimeheart', kind: 'boss-relic' },
    oathbreaker: { id: 'oathbreaker', name: 'Oathbreaker', kind: 'equipment' },
    'jawbone-lyre': { id: 'jawbone-lyre', name: 'Jawbone Lyre', kind: 'boss-relic' },
    'elder-acorn': { id: 'elder-acorn', name: 'Elder Acorn', kind: 'relic' }
  }
}

test('only the entries the state refers to are sent, with the content\'s counts', () => {
  const shown = legendaryShown(content, {
    rooms: { a: { relics: { owned: ['rimeheart'] }, chest: [] }, b: { joined: false } },
    characters: { 'pane-1': { equipment: { weapon: { legendary: true, entryId: 'oathbreaker' }, outfit: null } } },
    recent: [{ type: 'legendary', item: 'elder-acorn' }, { type: 'drop', item: 'jawbone-lyre' }]
  })
  assert.deepEqual(Object.keys(shown.entries).sort(), ['elder-acorn', 'oathbreaker', 'rimeheart'])
  assert.equal(shown.relicCount, 22)
  assert.equal(legendaryShown(null, { rooms: {}, characters: {}, recent: [] }), null)
})

test('a legendary drop is told with the name and kind of what dropped', () => {
  assert.deepEqual(describeLegendaryDrop({ type: 'legendary', item: 'rimeheart' }, content),
    { type: 'legendary', item: 'rimeheart', name: 'Rimeheart', kind: 'boss-relic' })
  assert.deepEqual(describeLegendaryDrop({ type: 'legendary', item: 'gone' }, content), { type: 'legendary', item: 'gone' })
})

test('only a legendary item carries the legendary marks', () => {
  assert.deepEqual(legendaryMarks({ legendary: true, entryId: 'oathbreaker' }), { legendary: true, entryId: 'oathbreaker' })
  assert.deepEqual(legendaryMarks({ id: 'blade' }), {})
})

test('a relic a market\'s stall offers is among the entries sent', () => {
  const shown = legendaryShown(content, {
    rooms: {}, characters: {}, recent: [],
    worlds: [{ market: { cities: [{ relic: { byRoom: { a: 'elder-acorn', b: null } } }, { id: 'closed' }] } }]
  })
  assert.deepEqual(Object.keys(shown.entries), ['elder-acorn'])
})
