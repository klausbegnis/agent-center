import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  activityMark,
  FAMILIAR_CAP,
  familiarPoints,
  familiarSize,
  household,
  subagentScale
} from './familiars.js'

const theme = {
  room: { width: 400, height: 250 },
  actors: { width: 40, height: 50, subScale: 0.75, familiar: { symbol: 'pet', width: 20, height: 16 } }
}
const plainTheme = { room: theme.room, actors: { width: 40, height: 50, subScale: 0.75 } }
const parent = { id: 'pane-1', point: { x: 200, y: 200 } }

const agent = (id, parentId = null) => ({ id, parentId })

test('subagents are grouped under their parent and leave the stations to the agents', () => {
  const { mains, familiars } = household([agent('a'), agent('a/1', 'a'), agent('b'), agent('a/2', 'a')])
  assert.deepEqual(mains.map((item) => item.id), ['a', 'b'])
  assert.deepEqual(familiars.get('a').map((item) => item.id), ['a/1', 'a/2'])
  assert.equal(familiars.has('b'), false)
})

test('a subagent whose parent is not in the room takes a station of its own', () => {
  const { mains, familiars } = household([agent('a'), agent('gone/1', 'gone')])
  assert.deepEqual(mains.map((item) => item.id), ['a', 'gone/1'])
  assert.equal(familiars.size, 0)
})

test('a familiar has the size its theme gives it', () => {
  assert.deepEqual(familiarSize(theme), { width: 20, height: 16, lift: 0 })
})

test('a familiar with only a width keeps the proportions of a character', () => {
  const narrow = { ...theme, actors: { ...theme.actors, familiar: { symbol: 'pet', width: 20, lift: 6 } } }
  assert.deepEqual(familiarSize(narrow), { width: 20, height: 25, lift: 6 })
})

test('a theme without a familiar gets the size of its small character', () => {
  assert.deepEqual(familiarSize(plainTheme), { width: 30, height: 37.5, lift: 0 })
})

test('a theme that does not say how small a subagent is gets the default', () => {
  assert.equal(subagentScale({ actors: { width: 40, height: 50 } }), 0.7)
})

test('the same parent always gets its familiars in the same places', () => {
  assert.deepEqual(familiarPoints(theme, parent, 4), familiarPoints(theme, parent, 4))
})

test('the first two familiars stand on opposite sides of the parent, clear of it', () => {
  const [first, second] = familiarPoints(theme, parent, 2).points
  assert.equal(first.x - parent.point.x, parent.point.x - second.x)
  assert.equal(first.y, second.y)
  const clearance = theme.actors.width / 2 + theme.actors.familiar.width / 2
  assert.ok(Math.abs(first.x - parent.point.x) >= clearance)
})

test('familiars move with their parent', () => {
  const moved = { id: parent.id, point: { x: 120, y: 150 } }
  const before = familiarPoints(theme, parent, 3).points
  const after = familiarPoints(theme, moved, 3).points
  for (let index = 0; index < before.length; index++) {
    assert.equal(after[index].x - before[index].x, -80)
    assert.equal(after[index].y - before[index].y, -50)
  }
})

test('no two familiars of one parent stand on the same spot', () => {
  const { points } = familiarPoints(theme, parent, FAMILIAR_CAP)
  const spots = new Set(points.map((point) => `${point.x},${point.y}`))
  assert.equal(spots.size, FAMILIAR_CAP)
})

test('adding a familiar leaves the ones already there where they were', () => {
  const two = familiarPoints(theme, parent, 2).points
  const three = familiarPoints(theme, parent, 3).points
  assert.deepEqual(three.slice(0, 2), two)
})

test('up to the cap every familiar is shown and there is no marker', () => {
  const layout = familiarPoints(theme, parent, FAMILIAR_CAP)
  assert.equal(layout.points.length, FAMILIAR_CAP)
  assert.equal(layout.hidden, 0)
  assert.equal(layout.marker, null)
})

test('beyond the cap the rest are counted and a marker stands outside the familiars', () => {
  const layout = familiarPoints(theme, parent, FAMILIAR_CAP + 3)
  assert.equal(layout.points.length, FAMILIAR_CAP)
  assert.equal(layout.hidden, 3)
  assert.equal(layout.marker.y, parent.point.y)
  const furthest = Math.max(...layout.points.map((point) => Math.abs(point.x - parent.point.x)))
  assert.ok(Math.abs(layout.marker.x - parent.point.x) > furthest)
})

test('a parent with no subagents has no familiars', () => {
  assert.deepEqual(familiarPoints(theme, parent, 0), { points: [], hidden: 0, marker: null })
})

test('familiars of a parent in a corner stay inside the room', () => {
  for (const point of [{ x: 4, y: 20 }, { x: 398, y: 250 }]) {
    const layout = familiarPoints(theme, { id: 'pane-9', point }, FAMILIAR_CAP + 1)
    for (const spot of [...layout.points, layout.marker]) {
      assert.ok(spot.x >= 10 && spot.x <= 390, `x ${spot.x}`)
      assert.ok(spot.y >= 16 && spot.y <= 250, `y ${spot.y}`)
    }
  }
})

test('a familiar that needs attention shows the same bubble text as an agent', () => {
  assert.deepEqual(activityMark('wait'), { text: '?' })
  assert.deepEqual(activityMark('blocked'), { text: '!' })
  assert.deepEqual(activityMark('sleep'), { text: 'zz' })
})

test('each kind of work has an icon of its own', () => {
  const paths = ['write', 'read', 'run', 'think'].map((activity) => activityMark(activity).path)
  assert.ok(paths.every((path) => typeof path === 'string' && path.length > 0))
  assert.equal(new Set(paths).size, paths.length)
})

test('an activity without an icon gets the thinking one', () => {
  assert.deepEqual(activityMark('juggle'), activityMark('think'))
})
