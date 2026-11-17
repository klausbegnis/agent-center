import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activeRelic, itemLegendary, legendaryArtUrl, legendaryDetails, RELIC_SLOTS_PER_ROW, relicsCard, stallRelic } from './legendary-model.js'

const entries = {
  rimeheart: { id: 'rimeheart', name: 'Rimeheart', kind: 'boss-relic', effect: { effect: 'staminaDrain', scope: 'party', amount: 0.05 }, flavour: 'Cold.' },
  'tidecall-conch': { id: 'tidecall-conch', name: 'Tidecall Conch', kind: 'relic', effect: { effect: 'killMaterials', scope: 'party', amount: 0.06, materials: ['fish'] }, flavour: 'Shoals.' },
  oathbreaker: { id: 'oathbreaker', name: 'Oathbreaker', kind: 'equipment', slot: 'weapon', effect: { effect: 'critChance', scope: 'holder', amount: 0.04 }, flavour: 'Mended.' }
}
const game = (relics = { owned: ['tidecall-conch', 'rimeheart'], active: 'rimeheart' }) => ({
  legendary: { relicCount: 22, equipmentCount: 12, entries },
  rooms: { room: { joined: true, relics }, away: { joined: false } }
})

test('pictures load from the plugin\'s legendary art folder under each surface\'s base', () => {
  assert.equal(legendaryArtUrl('../', 'rimeheart'), '../ui/art/legendary/rimeheart.png')
  assert.equal(legendaryArtUrl('/', 'rimeheart', { glow: true }), '/ui/art/legendary/rimeheart-glow.png')
  assert.equal(legendaryArtUrl('/', 'frame-slot'), '/ui/art/legendary/frame-slot.png')
})

test('the Relics card lists the owned relics in order, marks the active one and pads a row', () => {
  const card = relicsCard(game(), 'room')
  assert.deepEqual(card.owned.map((relic) => [relic.id, relic.isActive]), [['tidecall-conch', false], ['rimeheart', true]])
  assert.equal(card.active.id, 'rimeheart')
  assert.equal(card.active.text, 'Monsters drain 5% less stamina')
  assert.equal(card.count + card.emptySlots, RELIC_SLOTS_PER_ROW)
  assert.equal(card.total, 22)
})

test('a room without relics gets an empty row, and a room that has not joined no card', () => {
  const card = relicsCard(game({ owned: [], active: null }), 'room')
  assert.equal(card.count, 0)
  assert.equal(card.active, null)
  assert.equal(card.emptySlots, RELIC_SLOTS_PER_ROW)
  assert.equal(relicsCard(game(), 'away'), null)
  assert.equal(relicsCard({ rooms: game().rooms }, 'room'), null)
})

test('the active relic comes with its words, and none when nothing is active', () => {
  assert.equal(activeRelic(game(), 'room').name, 'Rimeheart')
  assert.equal(activeRelic(game({ owned: ['rimeheart'], active: null }), 'room'), null)
})

test('a legendary item finds its entry; a plain one has none', () => {
  assert.equal(itemLegendary(game(), { legendary: true, entryId: 'oathbreaker' }).name, 'Oathbreaker')
  assert.equal(itemLegendary(game(), { id: 'blade' }), null)
  assert.equal(legendaryDetails(game(), { legendary: true, entryId: 'oathbreaker' }).text, '+4% critical chance for the wielder')
})

test('a stall\'s relic is the one the receiving room lacks, with the reason Buy is off', () => {
  const city = { relic: { index: 3, price: 5000, sold: false, byRoom: { room: 'rimeheart', other: null } } }
  const buyer = { roomId: 'room', coins: 9000, canBuy: true }
  const offer = stallRelic(game(), city, buyer)
  assert.equal(offer.entry.name, 'Rimeheart')
  assert.equal(offer.block, null)
  assert.equal(stallRelic(game(), city, { ...buyer, coins: 10 }).block, 'coins')
  assert.equal(stallRelic(game(), city, { ...buyer, roomId: 'other' }).block, 'owned')
  const sold = stallRelic(game(), { relic: { ...city.relic, sold: true } }, buyer)
  assert.deepEqual([sold.block, sold.entry], ['sold', null])
  assert.equal(stallRelic(game(), city, { ...buyer, canBuy: false }).block, 'viewOnly')
  assert.equal(stallRelic(game(), {}, buyer), null)
})
