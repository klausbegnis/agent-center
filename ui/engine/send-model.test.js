import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEND } from './send-labels.js'
import { canSendItem, sendTargets, sendableRelics } from './send-model.js'

const STOREFRONT = 'local:/work/storefront'
const SEARCH = 'local:/work/search'
const LEDGER = 'build-box:/srv/ledger'
const OTHER_WORLD = 'local:/work/archive'
const WAITING = 'local:/work/waiting'

const state = {
  rooms: [
    { id: STOREFRONT, name: 'storefront', host: 'local' },
    { id: LEDGER, name: 'ledger', host: 'build-box' },
    { id: OTHER_WORLD, name: 'archive', host: 'local' },
    { id: WAITING, name: 'waiting', host: 'local' },
    { id: SEARCH, name: 'search', host: 'local' }
  ],
  game: {
    rooms: {
      [STOREFRONT]: { joined: true, worldId: 'main', relics: { owned: ['rimeheart', 'tidecall-conch'], active: 'rimeheart' } },
      [LEDGER]: { joined: true, worldId: 'main' },
      [OTHER_WORLD]: { joined: true, worldId: 'side' },
      [WAITING]: { joined: false, worldId: 'main' },
      [SEARCH]: { joined: true, worldId: 'main' }
    }
  }
}

test('an item can go to every other room that plays in the same world, in the order listed', () => {
  assert.deepEqual(sendTargets(state, STOREFRONT), [
    { id: LEDGER, name: 'ledger · build-box' },
    { id: SEARCH, name: 'search' }
  ])
})

test('a room alone in its world, or out of the game, has nowhere to send', () => {
  assert.deepEqual(sendTargets(state, OTHER_WORLD), [])
  assert.deepEqual(sendTargets(state, 'local:/work/unknown'), [])
})

test('only an item nobody holds can be sent', () => {
  assert.equal(canSendItem({ heldBy: null }), true)
  assert.equal(canSendItem({ heldBy: 's1' }), false)
  assert.equal(canSendItem(null), false)
})

test('every relic but the active one can be sent', () => {
  assert.deepEqual(sendableRelics(state.game, STOREFRONT), ['tidecall-conch'])
  assert.deepEqual(sendableRelics(state.game, LEDGER), [])
})

test('the message says where the item went and when a copy was salvaged, the sent one included', () => {
  assert.equal(SEND.itemSent('Brass Multitool', 'search'), 'Brass Multitool went to search.')
  assert.match(SEND.itemSent('Brass Multitool', 'search', { salvaged: 1, sentSalvaged: false }), /lowest one was salvaged/)
  assert.match(SEND.itemSent('Brass Multitool', 'search', { salvaged: 1, sentSalvaged: true }), /it was salvaged/)
})
