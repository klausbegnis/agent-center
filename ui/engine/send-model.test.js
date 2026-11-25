import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEND, nameList } from './send-labels.js'
import {
  chosenItems,
  holdersOf,
  itemSending,
  relicSending,
  repickedNames,
  sendTargets,
  sendableRelics
} from './send-model.js'

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


test('every relic the room owns can be sent, the active one included', () => {
  assert.deepEqual(sendableRelics(state.game, STOREFRONT), ['rimeheart', 'tidecall-conch'])
  assert.deepEqual(sendableRelics(state.game, LEDGER), [])
})

test('the message after sending the active relic says the room has none active now', () => {
  assert.equal(SEND.relicSent('Rimeheart', 'search'), 'Rimeheart went to search.')
  assert.match(SEND.relicSent('Rimeheart', 'search', true), /^Rimeheart went to search\. It was the active relic here/)
  assert.match(SEND.activeRelicQuestion('Rimeheart', 'search'), /active relic: the room will have no active relic/)
})

test('the message says where the item went and when a copy was salvaged, the sent one included', () => {
  assert.equal(SEND.itemSent('Brass Multitool', 'search'), 'Brass Multitool went to search.')
  assert.match(SEND.itemSent('Brass Multitool', 'search', { salvaged: 1, sentSalvaged: 0 }), /lowest one was salvaged/)
  assert.match(SEND.itemSent('Brass Multitool', 'search', { salvaged: 1, sentSalvaged: 1 }), /it was salvaged/)
})

/** The same rooms, with characters, a legendary item in the ledger's chest and the agents named. */
function withPeople() {
  return {
    ...state,
    rooms: state.rooms.map((room) => (room.id === STOREFRONT
      ? { ...room, agents: [{ id: 'pane-1', name: 'Search filters' }, { id: 'pane-2', name: 'Cart drawer' }] }
      : { ...room, agents: [] })),
    game: {
      ...state.game,
      rooms: {
        ...state.game.rooms,
        [LEDGER]: { ...state.game.rooms[LEDGER], chest: [{ id: 'labyrinth-cleaver', legendary: true, entryId: 'labyrinth-cleaver' }] }
      },
      characters: { 'pane-1': { sessionId: 's1' }, 'pane-2': { sessionId: 's2' } }
    }
  }
}

test('the send control of an item lists the rooms it can go to and who holds it', () => {
  const sending = itemSending(withPeople(), STOREFRONT, { id: 'whittled-cudgel', heldBy: 's1' }, { canSend: true, words: SEND })
  assert.equal(sending.reason, null)
  assert.deepEqual(sending.targets.map((room) => room.id), [LEDGER, SEARCH])
  assert.deepEqual([sending.isHeld, sending.holder], [true, 'Search filters'])
})

test('the send control is there but says why on a page that only watches', () => {
  const sending = itemSending(withPeople(), STOREFRONT, { id: 'whittled-cudgel' }, { canSend: false, words: SEND })
  assert.equal(sending.reason, SEND.viewOnly)
})

test('a room alone in its world says no other room plays yet', () => {
  const sending = itemSending(withPeople(), OTHER_WORLD, { id: 'whittled-cudgel' }, { canSend: true, words: SEND })
  assert.equal(sending.reason, SEND.noRoom)
})

test('a room that owns a legendary item already is offered but cannot be picked', () => {
  const cleaver = { id: 'labyrinth-cleaver', legendary: true, entryId: 'labyrinth-cleaver' }
  const sending = itemSending(withPeople(), STOREFRONT, cleaver, { canSend: true, words: SEND })
  assert.deepEqual(sending.targets.map((room) => [room.id, room.owns]), [[LEDGER, true], [SEARCH, false]])
  assert.equal(sending.reason, null)
})

test('when every other room owns the legendary item, the control says so', () => {
  const cleaver = { id: 'labyrinth-cleaver', legendary: true, entryId: 'labyrinth-cleaver' }
  const only = { ...withPeople(), rooms: withPeople().rooms.filter((room) => room.id !== SEARCH) }
  assert.equal(itemSending(only, STOREFRONT, cleaver, { canSend: true, words: SEND }).reason, SEND.legendaryEverywhere)
})

test('the relic row says why it cannot be used: no relic, no other room', () => {
  const words = SEND
  assert.equal(relicSending(withPeople(), STOREFRONT, { canSend: true, words }).reason, null)
  assert.equal(relicSending(withPeople(), LEDGER, { canSend: true, words }).reason, SEND.noRelics)
  const alone = { ...state, game: { ...state.game, rooms: { ...state.game.rooms, [OTHER_WORLD]: { joined: true, worldId: 'side', relics: { owned: ['a', 'b'], active: 'a' } } } } }
  assert.equal(relicSending(alone, OTHER_WORLD, { canSend: true, words }).reason, SEND.noRoom)
  assert.equal(relicSending(withPeople(), STOREFRONT, { canSend: false, words }).reason, SEND.viewOnly)
})

test('a room whose only relic is active can send it, and the row says which one is active', () => {
  const onlyActive = { ...state, game: { ...state.game, rooms: { ...state.game.rooms, [STOREFRONT]: { ...state.game.rooms[STOREFRONT], relics: { owned: ['rimeheart'], active: 'rimeheart' } } } } }
  const sending = relicSending(onlyActive, STOREFRONT, { canSend: true, words: SEND })
  assert.equal(sending.reason, null)
  assert.deepEqual(sending.relicIds, ['rimeheart'])
  assert.equal(sending.activeId, 'rimeheart')
})

test('the holders of chosen items are named once each, in chest order', () => {
  const items = [{ heldBy: 's2' }, { heldBy: null }, { heldBy: 's1' }, { heldBy: 's2' }]
  assert.deepEqual(holdersOf(withPeople(), items), ['Cart drawer', 'Search filters'])
  assert.equal(SEND.moveQuestion(3, 'search', ['Cart drawer', 'Search filters']),
    'Send 3 items to search? Cart drawer and Search filters will take the next best of what they lose.')
})

test('what a holder took instead is said by its agent\'s name', () => {
  const said = repickedNames(withPeople(), [{ sessionId: 's1', slot: 'weapon', itemName: 'Whittled Cudgel' }, { sessionId: 'gone', slot: 'tool', itemName: null }])
  assert.deepEqual(said, [{ name: 'Search filters', slot: 'weapon', itemName: 'Whittled Cudgel' }])
  assert.equal(SEND.repicked('Search filters', 'Whittled Cudgel'), 'Search filters now holds Whittled Cudgel.')
  assert.equal(SEND.repicked('Search filters', null, 'outfit'), 'Search filters now holds no outfit.')
})

test('a held item asks before it goes, naming its holder and what it will take', () => {
  assert.equal(SEND.heldQuestion('Oathbreaker', 'cosmic-llama', 'Search filters', 'weapon'),
    'Send Oathbreaker to cosmic-llama? Search filters will take the next best weapon.')
})

test('the chosen items are the ones still in the chest, in its order', () => {
  const chest = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  assert.deepEqual(chosenItems(chest, new Set(['c', 'gone', 'a'])).map((item) => item.id), ['a', 'c'])
  assert.equal(nameList(['A', 'B', 'C']), 'A, B and C')
})
