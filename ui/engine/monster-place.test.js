import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boxGap, directionTo, monsterHeight, monsterRank, monsterSpot } from './monster-place.js'

const theme = (stations) =>
  ({ room: { width: 400, height: 250 }, actors: { width: 36, height: 40 }, stations })

test('a theme that names a spot for the monster gets that spot', () => {
  const spot = monsterSpot(theme({ monster: { x: 120, y: 200 }, idle: [{ x: 300, y: 200 }] }))
  assert.deepEqual(spot, { x: 120, y: 200 })
})

test('without a named spot the monster stands clear of every station and of the entrance', () => {
  const stations = {
    enter: { x: 380, y: 230 },
    write: [{ x: 60, y: 120 }, { x: 110, y: 120 }],
    idle: [{ x: 60, y: 220 }, { x: 110, y: 220 }, { x: 330, y: 230 }]
  }
  const spot = monsterSpot(theme(stations))
  const near = [...stations.write, ...stations.idle, stations.enter]
    .map((slot) => Math.hypot(slot.x - spot.x, slot.y - spot.y))
  assert.ok(Math.min(...near) > 70, JSON.stringify(spot))
  assert.ok(spot.y >= 120 && spot.y <= 230, 'it stands on the floor the stations stand on')
})

test('the computed spot is the same every time', () => {
  const stations = { idle: [{ x: 200, y: 200 }], write: [{ x: 100, y: 150 }] }
  assert.deepEqual(monsterSpot(theme(stations)), monsterSpot(theme(structuredClone(stations))))
})

test('a boss is drawn larger than an elite, and an elite larger than a common monster', () => {
  const boss = monsterHeight(theme({}), { kind: 'boss', affix: null })
  const elite = monsterHeight(theme({}), { kind: 'common', affix: 'thorny' })
  const common = monsterHeight(theme({}), { kind: 'armored', affix: null })
  assert.ok(boss > elite && elite > common)
  assert.equal(common, 60, 'a common monster is a character and a half tall')
  assert.equal(monsterRank({ kind: 'boss', affix: null }), 'boss')
})

test('each step of the rank ladder is drawn a little larger than the one below it', () => {
  const ladder = ['normal', 'veteran', 'elite', 'champion', 'boss', 'legendary']
  const heights = ladder.map((rank) => monsterHeight(theme({}), { kind: 'common', rank }))
  for (let index = 1; index < heights.length; index += 1) assert.ok(heights[index] > heights[index - 1])
})

test('a monster sent before ranks gets its rank from its kind and affix', () => {
  assert.equal(monsterRank({ kind: 'common', affix: 'swift' }), 'elite')
  assert.equal(monsterRank({ kind: 'armored', affix: null }), 'normal')
  assert.equal(monsterRank({ kind: 'common', rank: 'champion', affix: 'swift' }), 'champion')
})

test('boxes that overlap have a negative gap, and boxes apart a positive one', () => {
  const box = { left: 0, right: 10, top: 0, bottom: 10 }
  assert.equal(boxGap(box, { left: 15, right: 20, top: 0, bottom: 10 }), 5)
  assert.ok(boxGap(box, { left: 5, right: 20, top: 5, bottom: 20 }) < 0)
})

test('a lunge is aimed straight at its target', () => {
  assert.deepEqual(directionTo({ x: 0, y: 0 }, { x: 3, y: 4 }), { x: 0.6, y: 0.8 })
  assert.deepEqual(directionTo({ x: 1, y: 1 }, { x: 1, y: 1 }), { x: -1, y: 0 })
})
