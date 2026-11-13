import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGameFeed } from './game-events.js'

function game({ recent = [], characters = {}, health = 0.5, waveKills = 0 } = {}) {
  return {
    status: 'running',
    recent,
    characters,
    rooms: {
      room: { joined: true, wave: 4, waveKills, monster: { id: 'wisp', level: 4, healthShare: health } }
    }
  }
}
const event = (id, type = 'level') => ({ id, type, roomId: 'room' })

test('the first state plays nothing, so a reload never replays old events', () => {
  const feed = createGameFeed()
  const first = feed.take(game({ recent: [event(1), event(2)], characters: { a: { guest: false } } }))
  assert.deepEqual(first, { events: [], arrivals: [], hits: [] })
})

test('only events newer than the last state play, each once', () => {
  const feed = createGameFeed()
  feed.take(game({ recent: [event(1)] }))
  const ids = feed.take(game({ recent: [event(1), event(2), event(3)] })).events.map((item) => item.id)
  assert.deepEqual(ids, [2, 3])
  assert.deepEqual(feed.take(game({ recent: [event(1), event(2), event(3)] })).events, [])
})

test('a worker that starts its count over is followed from its new count, without replaying', () => {
  const feed = createGameFeed()
  feed.take(game({ recent: [event(40)] }))
  assert.deepEqual(feed.take(game({ recent: [event(1), event(2)] })).events, [])
  const ids = feed.take(game({ recent: [event(1), event(2), event(3)] })).events.map((item) => item.id)
  assert.deepEqual(ids, [3])
})

test('a character that was not there before has arrived; guests do not count', () => {
  const feed = createGameFeed()
  feed.take(game({ characters: { a: { guest: false } } }))
  const characters = { a: { guest: false }, b: { guest: false }, c: { guest: true } }
  const next = feed.take(game({ characters }))
  assert.deepEqual(next.arrivals, ['b'])
})

test('health lost by the same monster is a hit; a new monster is not', () => {
  const feed = createGameFeed()
  feed.take(game({ health: 0.5 }))
  const hit = feed.take(game({ health: 0.3 }))
  assert.equal(hit.hits.length, 1)
  assert.ok(Math.abs(hit.hits[0].share - 0.2) < 1e-9)
  assert.deepEqual(feed.take(game({ health: 1, waveKills: 1 })).hits, [])
})

test('when the game stops, the feed starts over from the next state', () => {
  const feed = createGameFeed()
  feed.take(game({ recent: [event(1)] }))
  feed.take({ status: 'off' })
  assert.deepEqual(feed.take(game({ recent: [event(1), event(2)] })).events, [])
})
