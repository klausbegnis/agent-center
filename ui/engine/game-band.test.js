import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BAND_MAX, BAND_MIN, bandHeight, monsterSize } from './game-band.js'

const theme = (stations) => ({ room: { width: 400, height: 250 }, actors: { width: 36, height: 45 }, stations })

test('the band ends above the highest head at any station, with room for a bubble', () => {
  const height = bandHeight(theme({ write: [{ x: 100, y: 100 }], sleep: [{ x: 300, y: 200 }] }))
  assert.ok(Math.abs(height - ((100 - 45) / 250 - 0.04)) < 1e-9)
})

test('the entrance does not limit the band: characters only pass through it', () => {
  const height = bandHeight(theme({ enter: { x: 30, y: 50 }, write: [{ x: 100, y: 100 }] }))
  assert.ok(height > 0.17)
})

test('the band keeps a legible size whatever the stations', () => {
  assert.equal(bandHeight(theme({ write: [{ x: 100, y: 40 }] })), BAND_MIN)
  assert.equal(bandHeight(theme({ write: [{ x: 100, y: 240 }] })), BAND_MAX)
  assert.equal(bandHeight(theme({})), BAND_MAX)
})

test('a boss is drawn larger than an elite, and an elite larger than a common monster', () => {
  const boss = monsterSize({ kind: 'boss', affix: null })
  const elite = monsterSize({ kind: 'common', affix: 'thorny' })
  const common = monsterSize({ kind: 'armored', affix: null })
  assert.ok(boss > elite && elite > common)
  assert.equal(boss, 1)
})
