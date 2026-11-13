import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createNetworkView } from './network-view.mjs'

const secret = Buffer.alloc(32, 7)

const state = () => ({
  rooms: [{ id: 'local:/work/rumble-banana', name: 'rumble-banana' }],
  game: {
    status: 'running',
    keepTitles: true,
    rooms: {
      'local:/work/rumble-banana': {
        joined: true,
        chest: [{ id: 'blade', heldBy: 'estimated:pane-1' }, { id: 'cloak', heldBy: null }],
        retirees: [{ nameId: 3, level: 9, title: 'Fix checkout rounding' }]
      },
      'build-box:/srv/turbo-waffle': { worldId: 'main', joined: false }
    },
    characters: {
      'pane-1': { sessionId: 'estimated:pane-1', level: 4 },
      'pane-5': { sessionId: null, guest: true, level: 1 }
    },
    recent: [{ id: 1, type: 'retire', sessionId: 'estimated:pane-2', level: 9 }, { id: 2, type: 'kill', wave: 3 }]
  }
})

test('a page on another machine is told the game is view only', () => {
  const view = createNetworkView({ secret })
  assert.equal(view(state()).game.viewOnly, true)
  assert.equal(view({ rooms: [], game: { status: 'off' } }).game.viewOnly, true)
})

test('a page on another machine gets no session id, but can still tell who holds an item', () => {
  const view = createNetworkView({ secret })
  const { game } = view(state())
  assert.doesNotMatch(JSON.stringify(game), /estimated:/)
  const room = game.rooms['local:/work/rumble-banana']
  assert.equal(room.chest[0].heldBy, game.characters['pane-1'].sessionId)
  assert.equal(room.chest[1].heldBy, null)
  assert.equal(game.characters['pane-5'].sessionId, null)
  assert.equal(game.recent[1].sessionId, undefined)
})

test('a session keeps the same alias from one state to the next, and another key gives another', () => {
  const view = createNetworkView({ secret })
  assert.equal(view(state()).game.characters['pane-1'].sessionId, view(state()).game.characters['pane-1'].sessionId)
  const other = createNetworkView({ secret: Buffer.alloc(32, 8) })
  assert.notEqual(other(state()).game.characters['pane-1'].sessionId, view(state()).game.characters['pane-1'].sessionId)
})

test('a page on another machine sees retirees without their conversation titles', () => {
  const { game } = createNetworkView({ secret })(state())
  assert.deepEqual(game.rooms['local:/work/rumble-banana'].retirees, [{ nameId: 3, level: 9, title: null }])
})

test('the rooms and everything outside the game are left as they are', () => {
  const original = state()
  const shown = createNetworkView({ secret })(original)
  assert.deepEqual(shown.rooms, original.rooms)
  assert.deepEqual(shown.game.rooms['build-box:/srv/turbo-waffle'], { worldId: 'main', joined: false })
  assert.equal(original.game.viewOnly, undefined)
})
