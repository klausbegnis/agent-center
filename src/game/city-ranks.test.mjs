import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  CHARTER_COINS,
  CHARTER_UNITS,
  CITY_RANK_FEE_CUT,
  CITY_STANDING,
  EXTRA_OFFER_INDEX,
  LEGENDARY_OFFER_INDEX,
  RANKED_RELIC_CHANCE
} from './city-rank-constants.mjs'
import { cityRankIndexOf } from './city-ranks-content.mjs'
import { buyCharter, charterPrice, charterProblem, cityFeeOf, cityRankEffects, cityStandingOf, noteTrade, stallExtras } from './city-ranks.mjs'
import { validateCities } from './content-cities.mjs'
import { MARKET_FEE, MARKET_FEE_FLOOR, MATERIAL_BASE_VALUES, REWARD_GROWTH, STALL_OFFERS, STALL_RELIC_CHANCE } from './constants.mjs'
import { createEngine } from './engine.mjs'
import { legendaryIndexOf } from './legendary-effects.mjs'
import { unitBuyPrice, unitSellPrice } from './market-prices.mjs'
import { pricePoint } from './market.mjs'
import { stallOffers } from './stall.mjs'
import { emptyProject, emptyWorld } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('monsters.json'),
  items: readJson('items.json'),
  cities: readJson('cities.json'),
  legendary: readJson('legendary.json')
}
const engine = createEngine({ content })
const cities = content.cities.cities
const index = cityRankIndexOf(content)
const goldmill = cities.find((city) => city.id === 'goldmill')

/** A level 1 world, where Goldmill is open, with a room, coins and materials. */
function richWorld({ coins = 1e9, amount = 1e6, cityRanks } = {}) {
  const materials = Object.fromEntries(Object.keys(MATERIAL_BASE_VALUES).map((id) => [id, amount]))
  return { ...emptyWorld(), coins, materials, projects: { room: emptyProject() }, ...(cityRanks ? { cityRanks } : {}) }
}
const saveOf = (world) => ({ version: 1, worlds: { main: world }, projectWorld: { room: 'main' }, settings: { keepTitles: false } })

test('the shipped cities have valid ranks, every banner exists and every legendary piece is content equipment', () => {
  assert.deepEqual(validateCities(content.cities), [])
  const legendary = legendaryIndexOf(content)
  for (const city of cities) {
    const ranks = index.byCity.get(city.id)
    assert.ok(ranks, `${city.id} has ranks`)
    for (const { banner } of ranks.banners) assert.ok(existsSync(new URL(`../../${banner}`, import.meta.url)), banner)
    for (const id of ranks.legendary) assert.equal(legendary.byId.get(id)?.kind, 'equipment', id)
  }
  const sold = cities.flatMap((city) => index.byCity.get(city.id).legendary)
  assert.equal(new Set(sold).size, sold.length, 'no piece is sold by two cities')
})

test('ranks that miss banners or charters, or whose perks pass a cap together, are refused', () => {
  const broken = (change) => {
    const data = structuredClone(content.cities)
    change(data)
    return validateCities(data)
  }
  assert.ok(broken((data) => data.cities[0].ranks.banners.pop()).some((problem) => problem.includes('"banners"')))
  assert.ok(broken((data) => { data.cities[0].ranks.charters[0].effect.scope = 'party' }).length > 0)
  assert.ok(broken((data) => { data.cities[0].ranks.banners[0].banner = '../secret.png' }).length > 0)
  assert.ok(broken((data) => { delete data.rankTitles }).some((problem) => problem.includes('rankTitles')))
  assert.ok(broken((data) => {
    for (const city of data.cities) for (const charter of city.ranks.charters) charter.effect = { effect: 'thorns', scope: 'world', amount: 0.01 }
  }).some((problem) => problem.includes('more than the cap')))
  const { ranks: _ranks, ...plain } = content.cities.cities[0]
  assert.deepEqual(validateCities({ cities: [plain] }), [], 'a city without ranks is fine')
})

test('a deal grows the city\'s standing by the base value it moved, measured against the world level', () => {
  const before = richWorld()
  const sold = { ...before, materials: { ...before.materials, ore: before.materials.ore - 10 }, coins: before.coins + 50 }
  const noted = noteTrade(before, sold, 'goldmill')
  assert.equal(cityStandingOf(noted, 'goldmill').standing, (10 * MATERIAL_BASE_VALUES.ore) / REWARD_GROWTH)
  const stall = { ...before, coins: before.coins - 300 }
  assert.equal(cityStandingOf(noteTrade(before, stall, 'goldmill'), 'goldmill').standing, 300 / REWARD_GROWTH)
  assert.equal(noteTrade(before, before, 'goldmill'), before)
  assert.deepEqual(cityStandingOf(emptyWorld(), 'goldmill'), { rank: 1, standing: 0 })
})

test('the engine counts every sale, purchase, trade and stall piece towards the city', () => {
  let save = saveOf(richWorld())
  save = engine.sellMaterial(save, { worldId: 'main', cityId: 'goldmill', materialId: 'ore', amount: 100 })
  const afterSale = cityStandingOf(save.worlds.main, 'goldmill').standing
  assert.ok(afterSale > 0)
  save = engine.tradeMaterial(save, { worldId: 'main', cityId: 'goldmill', fromId: 'ore', toId: 'fish', amount: 100 })
  assert.ok(cityStandingOf(save.worlds.main, 'goldmill').standing > afterSale)
  const refused = engine.sellMaterial(save, { worldId: 'main', cityId: 'goldmill', materialId: 'ore', amount: 1e12 })
  assert.equal(refused, save, 'a refused deal counts nothing')
  assert.equal(cityStandingOf(save.worlds.main, 'deepforge').standing, 0)
})

test('a charter needs the standing, then costs coins and the wanted materials, and raises the rank by one', () => {
  const price = charterPrice(goldmill, 2, 1)
  assert.equal(price.coins, Math.round(CHARTER_COINS[1] * REWARD_GROWTH))
  assert.deepEqual(price.materials, { ore: Math.round(CHARTER_UNITS[1] * REWARD_GROWTH), bars: Math.round(CHARTER_UNITS[1] * REWARD_GROWTH) })
  assert.equal(charterPrice(goldmill, 6, 1), null)
  const unknown = richWorld()
  assert.match(charterProblem(unknown, cities, index, 'goldmill'), /not traded enough/)
  assert.equal(buyCharter(unknown, cities, index, 'goldmill'), unknown)
  const ready = richWorld({ cityRanks: { goldmill: { rank: 1, standing: CITY_STANDING[1] } } })
  assert.equal(charterProblem(ready, cities, index, 'goldmill'), null)
  const bought = buyCharter(ready, cities, index, 'goldmill')
  assert.deepEqual(bought.cityRanks.goldmill, { rank: 2, standing: CITY_STANDING[1] })
  assert.equal(bought.coins, ready.coins - price.coins)
  assert.equal(bought.materials.ore, ready.materials.ore - price.materials.ore)
  const poor = richWorld({ coins: 0, cityRanks: ready.cityRanks })
  assert.match(charterProblem(poor, cities, index, 'goldmill'), /coins/)
  const bare = richWorld({ amount: 0, cityRanks: ready.cityRanks })
  assert.match(charterProblem(bare, cities, index, 'goldmill'), /materials/)
  const top = richWorld({ cityRanks: { goldmill: { rank: 5, standing: 1e9 } } })
  assert.match(charterProblem(top, cities, index, 'goldmill'), /last rank/)
  assert.match(charterProblem(ready, cities, index, 'runespire'), /does not trade/)
  assert.match(charterProblem(ready, cities, null, 'goldmill'), /no ranks/)
})

test('the engine buys a charter for a world and says why it cannot', () => {
  const save = saveOf(richWorld({ cityRanks: { goldmill: { rank: 1, standing: CITY_STANDING[1] } } }))
  assert.equal(engine.charterProblem(save, { worldId: 'main', cityId: 'goldmill' }), null)
  assert.equal(engine.buyCharter(save, { worldId: 'main', cityId: 'goldmill' }).worlds.main.cityRanks.goldmill.rank, 2)
  assert.equal(engine.buyCharter(save, { worldId: 'elsewhere', cityId: 'goldmill' }), save)
  assert.match(engine.charterProblem(save, { worldId: 'elsewhere', cityId: 'goldmill' }), /no such world/)
})

test('a rank lowers the fee in its city only, never to nothing, and no round trip makes money', () => {
  const ranked = richWorld({ cityRanks: { goldmill: { rank: 5, standing: 0 } } })
  assert.equal(cityFeeOf(ranked, 'goldmill'), MARKET_FEE - 4 * CITY_RANK_FEE_CUT)
  assert.equal(cityFeeOf(ranked, 'deepforge'), MARKET_FEE)
  const most = { ...ranked, upgrades: { storehouse: 1e12 } }
  assert.ok(cityFeeOf(most, 'goldmill') >= MARKET_FEE_FLOOR - 4 * CITY_RANK_FEE_CUT - 1e-12)
  assert.ok(cityFeeOf(most, 'goldmill') > 0)
  for (const materialId of Object.keys(MATERIAL_BASE_VALUES)) {
    const point = pricePoint(most, goldmill, materialId)
    assert.ok(unitSellPrice(point) < MATERIAL_BASE_VALUES[materialId], `${materialId} sells below base`)
    for (const city of cities) {
      const ask = unitBuyPrice(pricePoint(most, city, materialId))
      assert.ok(unitSellPrice(point) < ask, `${materialId} bought in ${city.id} costs more than Goldmill pays`)
    }
  }
})

test('a richer stall: one more piece from rank II, a tier higher from III, relics more often from IV', () => {
  assert.deepEqual(stallExtras(1), { extraOffers: 0, tierBonus: 0, relicChance: STALL_RELIC_CHANCE })
  assert.deepEqual(stallExtras(4), { extraOffers: 1, tierBonus: 1, relicChance: RANKED_RELIC_CHANCE })
  const where = { worldId: 'main', cityId: 'goldmill', day: 3, level: 20 }
  const plain = stallOffers(content.items, where)
  const two = stallOffers(content.items, { ...where, rank: 2 })
  const three = stallOffers(content.items, { ...where, rank: 3 })
  assert.equal(plain.length, STALL_OFFERS)
  assert.deepEqual(two.slice(0, STALL_OFFERS), plain, 'the usual offers stay as they were')
  assert.equal(two.at(-1).index, EXTRA_OFFER_INDEX)
  assert.ok(three.every((offer) => offer.entry.tier === plain[0].entry.tier + 1))
})

test('the extra piece is bought at its own index, and a rank V stall sells legendary pieces now and then', () => {
  const world = richWorld({ cityRanks: { goldmill: { rank: 5, standing: 0 } } })
  const offer = stallOffers(content.items, { worldId: 'main', cityId: 'goldmill', day: 0, level: 1, rank: 5 }).at(-1)
  const purchase = { worldId: 'main', cityId: 'goldmill', offerIndex: offer.index, entryId: offer.entry.id, projectId: 'room' }
  const bought = engine.buyStallOffer(saveOf(world), purchase)
  assert.equal(bought.worlds.main.projects.room.chest.at(-1).entryId, offer.entry.id)
  assert.ok(cityStandingOf(bought.worlds.main, 'goldmill').standing > 0, 'a stall piece counts towards the city')
  // The first day the legendary piece is on offer.
  let day = 0
  let view = null
  while (!view && day < 400) {
    const at = { ...world, market: { clock: day * 86_400_000, pressure: {}, sold: {} } }
    const city = engine.view(saveOf(at)).worlds[0].market.cities.find((entry) => entry.id === 'goldmill')
    if (city.legendary) view = { at, offer: city.legendary }
    day += 1
  }
  assert.ok(view, 'a rank V stall offers a legendary piece within a year')
  assert.equal(view.offer.index, LEGENDARY_OFFER_INDEX)
  const entryId = view.offer.byRoom.room
  assert.ok(index.byCity.get('goldmill').legendary.includes(entryId))
  const piece = { worldId: 'main', cityId: 'goldmill', offerIndex: LEGENDARY_OFFER_INDEX, entryId, projectId: 'room' }
  const owned = engine.buyStallOffer(saveOf(view.at), piece)
  const item = owned.worlds.main.projects.room.chest.find((entry) => entry.entryId === entryId)
  assert.equal(item.legendary, true)
  assert.equal(owned.worlds.main.coins, view.at.coins - view.offer.price)
  assert.equal(engine.buyStallOffer(owned, piece), owned, 'bought once a day')
  const lower = { ...view.at, cityRanks: { goldmill: { rank: 4, standing: 0 } } }
  assert.equal(engine.buyStallOffer(saveOf(lower), piece).worlds.main, lower, 'not below rank V')
  assert.ok(engine.cleanSave(owned).ok, 'the sold index is one a save may keep')
})

test('every rank reached gives its charter\'s perk to the world, kept with every other source under the caps', () => {
  assert.deepEqual(cityRankEffects(richWorld(), index), [])
  const two = cityRankEffects(richWorld({ cityRanks: { goldmill: { rank: 2, standing: 0 } } }), index)
  assert.deepEqual(two, [index.byCity.get('goldmill').charters[0].effect])
  const all = Object.fromEntries(cities.map((city) => [city.id, { rank: 5, standing: 0 }]))
  assert.equal(cityRankEffects(richWorld({ cityRanks: all }), index).length, cities.length * 4)
})
