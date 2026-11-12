import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slotPoint, speciesFor, stationFor } from './stations.js'

const theme = {
  room: { width: 400, height: 250 },
  actors: {
    width: 40,
    height: 50,
    species: { claude: { parts: ['ears'] }, codex: { parts: ['antenna'] }, default: { parts: [] } }
  },
  stations: {
    write: [
      { x: 300, y: 100 },
      { x: 340, y: 100 }
    ],
    idle: [{ x: 200, y: 200 }]
  }
}

test('an activity uses its own station when the theme has one', () => {
  assert.equal(stationFor(theme, 'write'), theme.stations.write)
})

test('an activity without a station falls back, ending at idle', () => {
  assert.equal(stationFor(theme, 'run'), theme.stations.write)
  assert.equal(stationFor(theme, 'think'), theme.stations.idle)
  assert.equal(stationFor(theme, 'sleep'), theme.stations.idle)
})

test('a theme with no stations still gives one slot inside the room', () => {
  const [slot] = stationFor({ ...theme, stations: {} }, 'write')
  assert.deepEqual(slot, { x: 200, y: 200 })
})

test('characters take the theme slots first, then queue to the left of the last one', () => {
  const slots = theme.stations.write
  assert.equal(slotPoint(theme, slots, 0), slots[0])
  assert.equal(slotPoint(theme, slots, 1), slots[1])
  const firstExtra = slotPoint(theme, slots, 2)
  assert.equal(firstExtra.x, 340 - 36)
  assert.ok(slotPoint(theme, slots, 3).x < firstExtra.x)
})

test('the species is matched inside the agent kind, with a default', () => {
  assert.deepEqual(speciesFor(theme, 'claude-code'), { parts: ['ears'] })
  assert.deepEqual(speciesFor(theme, 'Codex'), { parts: ['antenna'] })
  assert.deepEqual(speciesFor(theme, 'gemini'), { parts: [] })
  assert.deepEqual(speciesFor(theme, null), { parts: [] })
})
