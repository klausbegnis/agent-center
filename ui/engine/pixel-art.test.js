import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CLASS_MARKS,
  MONSTER_INKS,
  MONSTER_SHAPES,
  monsterShape,
  pixelPath,
  TRADE_MARKS,
  viewBoxOf
} from './pixel-art.js'

const isRectangular = (rows) => rows.every((row) => row.length === rows[0].length)

test('every monster body named by the game content has a drawing', () => {
  for (const body of ['blob', 'tall', 'wide', 'floating', 'swarm']) assert.ok(MONSTER_SHAPES[body], body)
})

test('every drawing is a full rectangle on its grid', () => {
  for (const rows of Object.values(MONSTER_SHAPES)) assert.equal(viewBoxOf(rows), '0 0 12 12')
  for (const rows of [...Object.values(CLASS_MARKS), ...Object.values(TRADE_MARKS)]) {
    assert.ok(isRectangular(rows))
    assert.equal(viewBoxOf(rows), '0 0 8 8')
  }
})

test('monsters use only their own inks, and every one has an outline and eyes', () => {
  for (const [body, rows] of Object.entries(MONSTER_SHAPES)) {
    const inks = new Set(rows.join('').replaceAll('.', ''))
    for (const ink of inks) assert.ok(MONSTER_INKS.includes(ink), `${body} uses ${ink}`)
    assert.ok(inks.has('o') && inks.has('e'), body)
  }
})

test('every class and every gathering trade has a mark', () => {
  assert.deepEqual(Object.keys(CLASS_MARKS).sort(), ['defense', 'magical', 'physical', 'support'])
  const trades = ['farming', 'fishing', 'hunting', 'mining', 'runecraft', 'woodcutting']
  assert.deepEqual(Object.keys(TRADE_MARKS).sort(), trades)
})

test('a run of pixels along a row becomes one rectangle', () => {
  assert.equal(pixelPath(['.##.', '#..#'], '#'), 'M1 0h2v1h-2zM0 1h1v1h-1zM3 1h1v1h-1z')
  assert.equal(pixelPath(['....'], '#'), '')
})

test('a body this UI does not know is drawn as a blob', () => {
  assert.equal(monsterShape('tentacles'), MONSTER_SHAPES.blob)
})
