// City ranks alongside the features under them: a city's festival week, the trait broker, the
// achievements, the day journal and the news a rank-up makes.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { achievementIndexOf } from './achievement-content.mjs'
import { METRICS } from './achievement-metrics.mjs'
import { CITY_STANDING, FESTIVAL_FEE_CUT } from './city-rank-constants.mjs'
import { citiesOfWeek, festivalCityOf } from './city-festival.mjs'
import { cityRankIndexOf } from './city-ranks-content.mjs'
import { cityFeeOf, cityRankHighlights, cityRankNews } from './city-ranks.mjs'
import { MARKET_FEE, MATERIAL_BASE_VALUES } from './constants.mjs'
import { createEngine } from './engine.mjs'
import { unitBuyPrice, unitSellPrice } from './market-prices.mjs'
import { pricePoint } from './market.mjs'
import { brokerOffers } from './trait-broker.mjs'
import { traitIndexOf } from './trait-content.mjs'
import { emptyProject, emptyWorld } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('monsters.json'),
  items: readJson('items.json'),
  cities: readJson('cities.json'),
  legendary: readJson('legendary.json'),
  events: readJson('events.json'),
  traits: readJson('traits.json'),
  achievements: readJson('achievements.json')
}
const engine = createEngine({ content })
const cities = content.cities.cities
const festival = content.events.events.find((event) => event.kind === 'festival')
const festivalWeek = { week: '2026-W47', event: festival.id, progress: 0, done: false, seenAt: 0 }

function richWorld(extra = {}) {
  const materials = Object.fromEntries(Object.keys(MATERIAL_BASE_VALUES).map((id) => [id, 1e6]))
  return { ...emptyWorld(), coins: 1e9, materials, projects: { room: emptyProject() }, ...extra }
}
const saveOf = (world) => ({ version: 1, worlds: { main: world }, projectWorld: { room: 'main' }, settings: { keepTitles: false } })

test('a festival week marks its city and lowers the fee there by FESTIVAL_FEE_CUT', () => {
  const world = richWorld({ weekly: festivalWeek })
  assert.equal(festivalCityOf(world, content), festival.city)
  assert.equal(festivalCityOf(richWorld(), content), null)
  const marked = citiesOfWeek(cities, world, content)
  assert.deepEqual(marked.filter((city) => city.festival).map((city) => city.id), [festival.city])
  assert.equal(citiesOfWeek(cities, richWorld(), content), cities)
  assert.ok(Math.abs(cityFeeOf(world, festival.city, true) - (MARKET_FEE - FESTIVAL_FEE_CUT)) < 1e-12)
  const view = engine.view(saveOf(world)).worlds[0].market.cities.find((city) => city.id === festival.city)
  if (view.open) {
    assert.equal(view.festival, true)
    assert.equal(view.rank.festival, true)
    assert.ok(view.fee < MARKET_FEE)
  }
})

test('at rank V in its festival week, with a Storehouse far up, a city still never pays more than it asks', () => {
  const city = { ...cities.find((entry) => entry.id === festival.city), festival: true }
  const world = richWorld({ weekly: festivalWeek, upgrades: { storehouse: 1e12 }, cityRanks: { [city.id]: { rank: 5, standing: 0 } } })
  assert.ok(cityFeeOf(world, city.id, true) > 0)
  for (const materialId of Object.keys(MATERIAL_BASE_VALUES)) {
    const bid = unitSellPrice(pricePoint(world, city, materialId))
    assert.ok(bid < MATERIAL_BASE_VALUES[materialId], `${materialId} sells below base`)
    for (const other of cities) {
      const ask = unitBuyPrice(pricePoint(world, { ...other, festival: other.id === city.id }, materialId))
      assert.ok(bid < ask, `${materialId} bought in ${other.id} costs more than ${city.id} pays`)
    }
  }
})

test('a rank III broker offers one more scroll and a rank V broker more epic ones, never a mythic', () => {
  const index = traitIndexOf(content)
  const where = { worldId: 'main', cityId: 'brinehaven', level: 20 }
  const days = Array.from({ length: 200 }, (_, day) => day)
  const count = (rank) => days.flatMap((day) => brokerOffers(index, { ...where, day, rank }))
  assert.ok(count(3).length > count(1).length)
  const epics = (rank) => count(rank).filter((offer) => offer.tier === 'epic').length
  assert.ok(epics(5) > epics(3), `${epics(5)} epic offers at rank V, ${epics(3)} at III`)
  assert.ok(count(5).every((offer) => offer.tier !== 'mythic'))
  assert.equal(brokerOffers(index, { ...where, day: 4 }).length, brokerOffers(index, { ...where, day: 4, rank: 2 }).length)
})

test('city ranks are measured for achievements: charters bought, the best rank and the cities at the last', () => {
  const save = saveOf(richWorld({ cityRanks: { goldmill: { rank: 3, standing: 0 }, deepforge: { rank: 5, standing: 0 } } }))
  assert.equal(METRICS.charters.measure(save, {}), 6)
  assert.equal(METRICS.cityRank.measure(save, {}), 5)
  assert.equal(METRICS.citiesAtTopRank.measure(save, {}), 1)
  assert.equal(METRICS.charters.measure(saveOf(richWorld()), {}), 0)
  const ids = [...achievementIndexOf(content).byId.keys()]
  for (const id of ['charter-1', 'city-rank-3', 'city-rank-5', 'city-rank-all']) assert.ok(ids.includes(id), id)
})

test('a charter is news for the rooms and a highlight of the journal, and nothing else is', () => {
  const before = saveOf(richWorld({ cityRanks: { goldmill: { rank: 1, standing: CITY_STANDING[1] } } }))
  const after = engine.buyCharter(before, { worldId: 'main', cityId: 'goldmill' })
  const news = engine.cityRankNews(before, after)
  assert.deepEqual(news.map(({ type, cityId, rank, title }) => ({ type, cityId, rank, title })),
    [{ type: 'city', cityId: 'goldmill', rank: 2, title: 'Town' }])
  assert.equal(news[0].banner, 'ui/cities/goldmill-2.png')
  assert.deepEqual(cityRankHighlights(before, after, 5), [{ at: 5, kind: 'city', ref: 'goldmill', value: 2 }])
  assert.deepEqual(engine.cityRankNews(after, after), [])
  const sold = engine.sellMaterial(after, { worldId: 'main', cityId: 'goldmill', materialId: 'ore', amount: 10 })
  assert.deepEqual(cityRankNews(after, sold, { cities, index: cityRankIndexOf(content) }), [], 'standing alone is no news')
})
