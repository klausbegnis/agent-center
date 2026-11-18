import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { MARKET_DAY_MS } from './constants.mjs'
import { createEngine } from './engine.mjs'
import { BROKER_REFUSALS, brokerOffers, scrollPrice, scrollSalePrice, swapFee } from './trait-broker.mjs'
import { BROKER_OFFERS } from './trait-constants.mjs'
import { traitIndexOf } from './trait-content.mjs'
import { TRAIT_REFUSALS } from './traits.mjs'
import { emptySave } from './worlds.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('../../game/monsters.json'),
  items: readJson('../../game/items.json'),
  cities: readJson('../../game/cities.json'),
  traits: readJson('../../game/traits.json')
}
const engine = createEngine({ content })
const index = traitIndexOf(content)
const ROOM = 'rumble-banana'
const CITY = 'goldmill'

const started = (coins) => {
  const save = engine.applyTokens(emptySave(), { projectId: ROOM, sessionId: 'first', tokens: 1_000_000, activity: 'think', now: 0 })
  return { ...save, worlds: { main: { ...save.worlds.main, coins } } }
}
const offersOf = (save, cityId = CITY) => engine.view(save).worlds[0].traits.brokers[cityId].offers
const buy = (save, offer) =>
  ({ worldId: 'main', cityId: CITY, offerIndex: offer.index, traitId: offer.traitId, projectId: ROOM })
const scrollsOf = (save) => save.worlds.main.projects[ROOM].scrolls ?? {}

test('a broker offers a few different traits of its own city, the same all day', () => {
  const offers = brokerOffers(index, { worldId: 'main', cityId: CITY, day: 3, level: 10 })
  assert.equal(offers.length, BROKER_OFFERS)
  assert.equal(new Set(offers.map((offer) => offer.traitId)).size, BROKER_OFFERS)
  assert.ok(offers.every((offer) => index.byId.get(offer.traitId).city === CITY && offer.tier !== 'mythic'))
  assert.deepEqual(brokerOffers(index, { worldId: 'main', cityId: CITY, day: 3, level: 10 }), offers)
})

test('the offers change from one game day to the next', () => {
  const days = Array.from({ length: 10 }, (_, day) =>
    brokerOffers(index, { worldId: 'main', cityId: CITY, day, level: 10 }).map((offer) => offer.traitId).join())
  assert.ok(new Set(days).size > 1)
})

test('prices grow with the tier and the world level, and a discount lowers them', () => {
  assert.ok(scrollPrice('rare', 10) > scrollPrice('common', 10))
  assert.ok(scrollPrice('common', 50) > scrollPrice('common', 10))
  assert.ok(scrollPrice('common', 10, 0.2) < scrollPrice('common', 10))
  assert.ok(scrollSalePrice('common', 10) < scrollPrice('common', 10))
  assert.ok(swapFee('rare', 10) < scrollPrice('rare', 10))
})

test('a scroll sells for more than a scroll of the tier below costs, at every discount', () => {
  const tiers = ['common', 'rare', 'epic', 'mythic']
  for (const level of [1, 20, 80]) {
    for (let at = 1; at < tiers.length; at += 1) {
      assert.ok(scrollSalePrice(tiers[at], level) > scrollPrice(tiers[at - 1], level), `${tiers[at]} at ${level}`)
    }
  }
})

test('buying an offer puts its scroll in the room\'s chest for coins, once a day', () => {
  const save = started(1_000_000)
  const [offer] = offersOf(save)
  const bought = engine.buyTraitScroll(save, buy(save, offer))
  assert.equal(scrollsOf(bought)[offer.traitId], 1)
  assert.equal(bought.worlds.main.coins, 1_000_000 - offer.price)
  assert.ok(bought.worlds.main.traits.known.includes(offer.traitId))
  assert.equal(engine.buyScrollProblem(bought, buy(bought, offer)), BROKER_REFUSALS.sold)
  assert.ok(offersOf(bought)[0].sold)
})

test('an offer the world cannot pay for, or one that is not today\'s, is refused', () => {
  const poor = started(0)
  const [offer] = offersOf(poor)
  assert.equal(engine.buyScrollProblem(poor, buy(poor, offer)), BROKER_REFUSALS.coins)
  const rich = started(1_000_000)
  assert.equal(engine.buyScrollProblem(rich, { ...buy(rich, offer), traitId: 'starborn' }), BROKER_REFUSALS.noOffer)
})

test('a city that does not trade with the world yet has no broker', () => {
  const save = started(1_000_000)
  assert.equal(engine.view(save).worlds[0].traits.brokers.runespire, undefined)
  const purchase = { worldId: 'main', cityId: 'runespire', offerIndex: 0, traitId: 'keen-eye', projectId: ROOM }
  assert.equal(engine.buyScrollProblem(save, purchase), BROKER_REFUSALS.noCity)
})

test('selling a scroll pays its sale price into the world\'s coins', () => {
  const save = started(0)
  const withScroll = { ...save, worlds: { main: { ...save.worlds.main, projects: { [ROOM]: { ...save.worlds.main.projects[ROOM], scrolls: { 'stout-arm': 2 } } } } } }
  const sold = engine.sellTraitScroll(withScroll, { worldId: 'main', cityId: CITY, projectId: ROOM, traitId: 'stout-arm' })
  assert.equal(scrollsOf(sold)['stout-arm'], 1)
  assert.ok(sold.worlds.main.coins > 0)
  assert.equal(engine.sellScrollProblem(save, { worldId: 'main', cityId: CITY, projectId: ROOM, traitId: 'stout-arm' }), TRAIT_REFUSALS.noScroll)
})

test('a day that turns while the person looks makes the old offer refused, not bought by mistake', () => {
  const save = started(1_000_000)
  const [offer] = offersOf(save)
  const later = { ...save, worlds: { main: { ...save.worlds.main, market: { clock: 40 * MARKET_DAY_MS, pressure: {}, sold: {} } } } }
  const today = offersOf(later)[0]
  if (today.traitId !== offer.traitId) assert.equal(engine.buyScrollProblem(later, buy(later, offer)), BROKER_REFUSALS.noOffer)
  assert.equal(engine.buyScrollProblem(later, buy(later, today)), null)
})
