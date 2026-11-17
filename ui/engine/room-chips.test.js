import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONTEXT } from './context-labels.js'
import {
  ALL_ROOMS,
  CHIP_NAME_LIMIT,
  SCROLL_MARGIN,
  chipAfterKey,
  isTypingKey,
  roomAfterShortcut,
  roomChips,
  rowOverflow,
  savedRoomOf,
  scrollToShow,
  shortText
} from './room-chips.js'

const STOREFRONT = 'local:/work/storefront'
const LEDGER = 'build-box:/srv/ledger-service-for-the-billing-team'
const SEARCH = 'local:/work/search'
const OUTSIDE = 'local:/work/outside'

/** Four rooms: three that play (one on a paired machine) and one out of the game. */
function stateWith(gameRooms = {}) {
  return {
    rooms: [
      { id: STOREFRONT, name: 'storefront', host: 'local', agents: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }] },
      { id: LEDGER, name: 'ledger-service-for-the-billing-team', host: 'build-box', agents: [{ id: 'b1' }] },
      { id: OUTSIDE, name: 'outside', host: 'local', agents: [{ id: 'c1' }] },
      { id: SEARCH, name: 'search', host: 'local', agents: [] }
    ],
    game: {
      status: 'running',
      rooms: {
        [STOREFRONT]: { joined: true, worldId: 'main', party: 'fighting', monster: { id: 'm' }, chest: [{ affordable: true }] },
        [LEDGER]: { joined: true, worldId: 'main', party: 'idle', chest: [{ affordable: false }] },
        [OUTSIDE]: { joined: false, worldId: null },
        [SEARCH]: { joined: true, worldId: 'main', party: 'paused', chest: [] },
        ...gameRooms
      },
      characters: {
        a1: { sessionId: 's1', class: 'physical' },
        a2: { sessionId: 's2', class: 'magical' },
        a3: { guest: true },
        b1: { sessionId: 's3', class: 'defense' },
        c1: { sessionId: 's4', class: 'support' }
      }
    }
  }
}

const shown = (tab, roomId = STOREFRONT, filterId = null) => ({ tab, roomId, filterId, allRoomsName: 'All rooms' })

test('every room that plays gets a chip, in the order the rooms are listed; one out of the game gets none', () => {
  const { chips } = roomChips(stateWith(), shown('chest'))
  assert.deepEqual(chips.map((chip) => chip.value), [STOREFRONT, LEDGER, SEARCH])
})

test('on Rooms the first chip is All rooms, picked while the tab is not narrowed', () => {
  const { chips, pickedValue } = roomChips(stateWith(), shown('rooms'))
  assert.equal(chips[0].value, ALL_ROOMS)
  assert.equal(chips[0].name, 'All rooms')
  assert.equal(pickedValue, ALL_ROOMS)
  assert.deepEqual(chips.filter((chip) => chip.isPicked).map((chip) => chip.value), [ALL_ROOMS])
})

test('on Rooms the room it is narrowed to is the picked chip', () => {
  const { chips } = roomChips(stateWith(), shown('rooms', STOREFRONT, LEDGER))
  assert.deepEqual(chips.filter((chip) => chip.isPicked).map((chip) => chip.value), [LEDGER])
})

test('on the other tabs the room they show is the picked chip and there is no All rooms', () => {
  const { chips } = roomChips(stateWith(), shown('camp', SEARCH))
  assert.ok(chips.every((chip) => chip.value !== ALL_ROOMS))
  assert.deepEqual(chips.filter((chip) => chip.isPicked).map((chip) => chip.value), [SEARCH])
})

test('nothing joined gives no chips, not even All rooms', () => {
  const state = stateWith({
    [STOREFRONT]: { joined: false },
    [LEDGER]: { joined: false },
    [SEARCH]: { joined: false }
  })
  assert.deepEqual(roomChips(state, shown('rooms', null)).chips, [])
})

test('a long name is cut on the chip and kept whole, with its host, as its full name', () => {
  const ledger = roomChips(stateWith(), shown('chest')).chips[1]
  assert.equal(ledger.name.length, CHIP_NAME_LIMIT)
  assert.ok(ledger.name.endsWith('…'))
  assert.equal(ledger.fullName, 'ledger-service-for-the-billing-team · build-box')
  assert.equal(ledger.host, 'build-box')
})

test('a room on this computer shows no host', () => {
  const storefront = roomChips(stateWith(), shown('chest')).chips[0]
  assert.equal(storefront.host, null)
  assert.equal(storefront.fullName, 'storefront')
})

test('a chip counts the characters of its room and leaves guests out', () => {
  const [storefront, ledger, search] = roomChips(stateWith(), shown('chest')).chips
  assert.deepEqual([storefront.characters, ledger.characters, search.characters], [2, 1, 0])
})

test('a chip says when its party fights a monster and when an upgrade is ready', () => {
  const [storefront, ledger, search] = roomChips(stateWith(), shown('chest')).chips
  assert.deepEqual([storefront.isFighting, ledger.isFighting, search.isFighting], [true, false, false])
  assert.deepEqual([storefront.canUpgrade, ledger.canUpgrade, search.canUpgrade], [true, false, false])
})

test('a party that fights but has no monster yet is not shown as fighting', () => {
  const state = stateWith({ [STOREFRONT]: { joined: true, worldId: 'main', party: 'fighting', chest: [] } })
  assert.equal(roomChips(state, shown('chest')).chips[0].isFighting, false)
})

test('a chip says its signs in words', () => {
  const storefront = roomChips(stateWith(), shown('chest')).chips[0]
  assert.equal(CONTEXT.chip(storefront), 'storefront: 2 characters, fighting, an upgrade ready')
  assert.equal(CONTEXT.chip({ fullName: 'All rooms', characters: null }), 'All rooms')
})

test('shortText leaves a name that fits as it is', () => {
  assert.equal(shortText('storefront', 16), 'storefront')
  assert.equal(shortText('abcdefghij', 5), 'abcd…')
})

test('the arrows step through the chips and wrap round; Home and End go to the ends', () => {
  assert.equal(chipAfterKey(0, 'ArrowRight', 3), 1)
  assert.equal(chipAfterKey(2, 'ArrowRight', 3), 0)
  assert.equal(chipAfterKey(0, 'ArrowLeft', 3), 2)
  assert.equal(chipAfterKey(1, 'Home', 3), 0)
  assert.equal(chipAfterKey(1, 'End', 3), 2)
  assert.equal(chipAfterKey(1, 'Enter', 3), null)
})

test('[ and ] step to the room before or after and stop at the ends', () => {
  const ids = [STOREFRONT, LEDGER, SEARCH]
  assert.equal(roomAfterShortcut(ids, STOREFRONT, ']'), LEDGER)
  assert.equal(roomAfterShortcut(ids, LEDGER, '['), STOREFRONT)
  assert.equal(roomAfterShortcut(ids, SEARCH, ']'), null)
  assert.equal(roomAfterShortcut(ids, STOREFRONT, '['), null)
  assert.equal(roomAfterShortcut(ids, STOREFRONT, 'x'), null)
})

test('from All rooms, ] goes to the first room and [ to the last', () => {
  const ids = [STOREFRONT, LEDGER, SEARCH]
  assert.equal(roomAfterShortcut(ids, null, ']'), STOREFRONT)
  assert.equal(roomAfterShortcut(ids, null, '['), SEARCH)
})

test('with a single room the shortcuts do nothing', () => {
  assert.equal(roomAfterShortcut([STOREFRONT], STOREFRONT, ']'), null)
})

test('a key pressed in a field, a list or editable text, or with a modifier, is typing', () => {
  assert.equal(isTypingKey({ tagName: 'INPUT' }), true)
  assert.equal(isTypingKey({ tagName: 'TEXTAREA' }), true)
  assert.equal(isTypingKey({ tagName: 'SELECT' }), true)
  assert.equal(isTypingKey({ tagName: 'DIV', isContentEditable: true }), true)
  assert.equal(isTypingKey({ tagName: 'BUTTON' }, { metaKey: true }), true)
  assert.equal(isTypingKey({ tagName: 'BUTTON' }), false)
  assert.equal(isTypingKey(null), false)
})

test('a chip already in view with its margins does not scroll the row', () => {
  const row = { scrollLeft: 0, clientWidth: 300, scrollWidth: 900 }
  assert.equal(scrollToShow({ left: 40, width: 80 }, row), null)
})

test('a chip past the right end scrolls it in with a margin after it', () => {
  const row = { scrollLeft: 0, clientWidth: 300, scrollWidth: 900 }
  assert.equal(scrollToShow({ left: 500, width: 80 }, row), 500 + 80 + SCROLL_MARGIN - 300)
})

test('a chip before the left end scrolls it in with a margin before it', () => {
  const row = { scrollLeft: 400, clientWidth: 300, scrollWidth: 900 }
  assert.equal(scrollToShow({ left: 200, width: 80 }, row), 200 - SCROLL_MARGIN)
})

test('scrolling never goes past either end of the row', () => {
  assert.equal(scrollToShow({ left: 10, width: 80 }, { scrollLeft: 100, clientWidth: 300, scrollWidth: 900 }), 0)
  assert.equal(scrollToShow({ left: 850, width: 50 }, { scrollLeft: 0, clientWidth: 300, scrollWidth: 900 }), 600)
})

test('a row too narrow for the chip and its margins centres it, so its start shows', () => {
  const row = { scrollLeft: 0, clientWidth: 180, scrollWidth: 2000 }
  assert.equal(scrollToShow({ left: 1000, width: 160 }, row), 990)
})

test('the arrow buttons show only while the row overflows, each while there is more that way', () => {
  assert.deepEqual(rowOverflow({ scrollLeft: 0, clientWidth: 300, scrollWidth: 300 }),
    { overflows: false, canGoBack: false, canGoOn: false })
  assert.deepEqual(rowOverflow({ scrollLeft: 0, clientWidth: 300, scrollWidth: 600 }),
    { overflows: true, canGoBack: false, canGoOn: true })
  assert.deepEqual(rowOverflow({ scrollLeft: 300, clientWidth: 300, scrollWidth: 600 }),
    { overflows: true, canGoBack: true, canGoOn: false })
})

test('the saved room comes from `room`, or else from the Arsenal days\' `arsenalRoom`', () => {
  assert.equal(savedRoomOf(STOREFRONT, LEDGER), STOREFRONT)
  assert.equal(savedRoomOf(null, LEDGER), LEDGER)
  assert.equal(savedRoomOf('', LEDGER), LEDGER)
  assert.equal(savedRoomOf(undefined, null), null)
})

test('a chip says when its party is inside an instance, in words too', () => {
  const state = stateWith({ [STOREFRONT]: { joined: true, worldId: 'main', party: 'fighting', chest: [], run: { instance: 'sunken-crypt' } } })
  const chip = roomChips(state, shown('chest')).chips[0]
  assert.equal(chip.isInside, true)
  assert.equal(roomChips(stateWith(), shown('chest')).chips[0].isInside, false)
  assert.match(CONTEXT.chip(chip), /inside an instance/)
})
