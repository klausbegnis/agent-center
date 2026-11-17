import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { MARKET_DAY_MS, REWARD_GROWTH, STALL_OFFERS, STALL_RELIC_CHANCE, STALL_RELIC_PRICE_BASE } from './constants.mjs'
import { createEngine } from './engine.mjs'
import { legendaryIndexOf } from './legendary-effects.mjs'
import { marketView } from './market-view.mjs'
import { cleanSave } from './save-check.mjs'
import { RELIC_OFFER_INDEX, buyStallRelic, hasRelicOnDay, stallRelicOffer, stallRelicPrice } from './stall-relic.mjs'
import { emptyProject, emptySave, emptyWorld } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('monsters.json'),
  items: readJson('items.json'),
  cities: readJson('cities.json'),
  legendary: readJson('legendary.json')
}
const index = legendaryIndexOf(content)
const cities = content.cities.cities
const where = (day, extra = {}) => ({ worldId: 'main', cityId: 'goldmill', day, level: 10, ownedIds: [], ...extra })
/** The first game day goldmill's stall has a relic in the main world. */
const relicDay = (() => {
  let day = 0
  while (!hasRelicOnDay(where(day))) day += 1
  return day
})()
/** A world on that day, with coins and a room in it. */
function worldWith({ coins = 1e9, relics } = {}) {
  const project = relics ? { ...emptyProject(), legendary: { relics, active: relics[0] ?? null, relicPity: 0, bossPity: 0 } } : emptyProject()
  return { ...emptyWorld(), coins, market: { clock: relicDay * MARKET_DAY_MS, pressure: {}, sold: {} }, projects: { room: project } }
}
const buy = (world, entryId, extra = {}) =>
  buyStallRelic(world, { worldId: 'main', cities, index }, { cityId: 'goldmill', entryId, projectId: 'room', ...extra })

test('the same world, city and day always offer the same relic', () => {
  assert.deepEqual(stallRelicOffer(index, where(relicDay)), stallRelicOffer(index, where(relicDay)))
  assert.equal(stallRelicOffer(index, where(relicDay)).index, RELIC_OFFER_INDEX)
})

test('a stall offers a relic about one day in STALL_RELIC_CHANCE', () => {
  let days = 0
  for (let day = 0; day < 4000; day++) if (hasRelicOnDay(where(day))) days += 1
  assert.ok(Math.abs(days / 4000 - STALL_RELIC_CHANCE) < 0.03)
})

test('only the city\'s own relics are sold, never a boss relic', () => {
  for (const city of cities) {
    for (let day = 0; day < 200; day++) {
      const offer = stallRelicOffer(index, { ...where(day), cityId: city.id })
      if (!offer) continue
      assert.equal(offer.entry.kind, 'relic')
      assert.equal(offer.entry.city, city.id)
    }
  }
})

test('a room is never offered a relic it owns, and nothing once it owns the city\'s', () => {
  const goldmill = index.poolRelicIds.filter((id) => index.byId.get(id).city === 'goldmill')
  for (let day = 0; day < 400; day++) {
    const offer = stallRelicOffer(index, where(day, { ownedIds: [goldmill[0]] }))
    if (offer) assert.equal(offer.entry.id, goldmill[1])
    assert.equal(stallRelicOffer(index, where(day, { ownedIds: goldmill })), null)
  }
})

test('the price is steep and grows like kill rewards', () => {
  assert.equal(stallRelicPrice(0), STALL_RELIC_PRICE_BASE)
  assert.equal(stallRelicPrice(40), Math.round(STALL_RELIC_PRICE_BASE * REWARD_GROWTH ** 40))
})

test('buying the relic gives it to the room, pays for it and makes a first relic active', () => {
  const world = worldWith({ coins: 1e6 })
  const offer = stallRelicOffer(index, { ...where(relicDay), level: 1 })
  const bought = buy(world, offer.entry.id)
  assert.deepEqual(bought.projects.room.legendary.relics, [offer.entry.id])
  assert.equal(bought.projects.room.legendary.active, offer.entry.id)
  assert.equal(bought.coins, 1e6 - offer.price)
  assert.deepEqual(bought.market.sold.goldmill, { day: relicDay, offers: [RELIC_OFFER_INDEX] })
})

test('a bought relic joins a room\'s relics without changing the active one', () => {
  const world = worldWith({ relics: ['rimeheart'] })
  const offer = stallRelicOffer(index, { ...where(relicDay), level: 1, ownedIds: ['rimeheart'] })
  const bought = buy(world, offer.entry.id)
  assert.deepEqual(bought.projects.room.legendary.relics, ['rimeheart', offer.entry.id])
  assert.equal(bought.projects.room.legendary.active, 'rimeheart')
})

test('a purchase is refused without the coins, for another relic, twice a day, or in a closed city', () => {
  const offer = stallRelicOffer(index, { ...where(relicDay), level: 1 })
  const poor = worldWith({ coins: 1 })
  assert.equal(buy(poor, offer.entry.id), poor)
  const world = worldWith()
  assert.equal(buy(world, 'rimeheart'), world)
  const once = buy(world, offer.entry.id)
  const again = { ...once, projects: { room: emptyProject() } }
  assert.equal(buy(again, offer.entry.id), again)
  assert.equal(buyStallRelic(world, { worldId: 'main', cities, index }, { cityId: 'runespire', entryId: offer.entry.id, projectId: 'room' }), world)
})

test('the market view says which relic each room would get', () => {
  const view = marketView('main', worldWith(), { cities, items: content.items, legendary: content.legendary })
  const goldmill = view.cities.find((city) => city.id === 'goldmill')
  assert.equal(goldmill.relic.index, STALL_OFFERS)
  assert.equal(index.byId.get(goldmill.relic.byRoom.room).city, 'goldmill')
  assert.equal(goldmill.relic.sold, false)
})

test('the engine\'s stall purchase sells the relic by its offer index, and a save with it passes the check', () => {
  const engine = createEngine({ content })
  const save = emptySave()
  save.worlds.main = worldWith()
  const offer = stallRelicOffer(index, { ...where(relicDay), level: 1 })
  const purchase = { worldId: 'main', cityId: 'goldmill', offerIndex: RELIC_OFFER_INDEX, entryId: offer.entry.id, projectId: 'room' }
  const bought = engine.buyStallOffer(save, purchase)
  assert.deepEqual(bought.worlds.main.projects.room.legendary.relics, [offer.entry.id])
  assert.equal(engine.cleanSave(bought).ok, true)
  const tooFar = structuredClone(bought)
  tooFar.worlds.main.market.sold.goldmill.offers = [STALL_OFFERS + 1]
  assert.equal(cleanSave(tooFar, { cityIds: ['goldmill'], legendary: content.legendary }).ok, false)
})
