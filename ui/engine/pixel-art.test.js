import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MONSTER_INKS, MONSTER_SHAPES, monsterShape, pixelPath, viewBoxOf } from './pixel-art.js'

const isRectangular = (rows) => rows.every((row) => row.length === rows[0].length)

test('every monster body named by the game content has a drawing', () => {
  for (const body of ['blob', 'tall', 'wide', 'floating', 'swarm']) assert.ok(MONSTER_SHAPES[body], body)
})

test('every drawing is a full rectangle on its grid', () => {
  for (const rows of Object.values(MONSTER_SHAPES)) {
    assert.ok(isRectangular(rows))
    assert.equal(viewBoxOf(rows), '0 0 12 12')
  }
})

test('monsters use only their own inks, and every one has an outline and eyes', () => {
  for (const [body, rows] of Object.entries(MONSTER_SHAPES)) {
    const inks = new Set(rows.join('').replaceAll('.', ''))
    for (const ink of inks) assert.ok(MONSTER_INKS.includes(ink), `${body} uses ${ink}`)
    assert.ok(inks.has('o') && inks.has('e'), body)
  }
})


test('a run of pixels along a row becomes one rectangle', () => {
  assert.equal(pixelPath(['.##.', '#..#'], '#'), 'M1 0h2v1h-2zM0 1h1v1h-1zM3 1h1v1h-1z')
  assert.equal(pixelPath(['....'], '#'), '')
})

test('a body this UI does not know is drawn as a blob', () => {
  assert.equal(monsterShape('tentacles'), MONSTER_SHAPES.blob)
})
