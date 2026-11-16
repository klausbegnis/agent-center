import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { COPIES_PER_ITEM, MARKET_DAY_MS, STALL_OFFERS } from './constants.mjs'
import { dropTier } from './drops.mjs'
import { createItem } from './items.mjs'
import { emptyMarket } from './market.mjs'
import { WORK_SKILLS } from './skills.mjs'
import { buyStallOffer, stallOffers, stallPrice, stallTier } from './stall.mjs'
import { emptyProject, emptyWorld } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const items = readJson('items.json')
const { cities } = readJson('cities.json')
const ROOM = 'local:/work/rumble-banana'

function worldAt(level, { coins = 0, day = 0 } = {}) {
  const skills = Object.fromEntries(WORK_SKILLS.map((id) => [id, { level, xp: 0, banked: 0, stars: 0 }]))
  const market = { ...emptyMarket(), clock: day * MARKET_DAY_MS + 1000 }
  return { ...emptyWorld(), skills, coins, market, projects: { [ROOM]: emptyProject() } }
}

const where = (level, day = 4, cityId = 'goldmill') => ({ worldId: 'main', cityId, day, level })
const context = { worldId: 'main', cities, items }

test('a stall sells one tier above what the world\'s monsters drop, up to the last tier', () => {
  for (const level of [1, 16, 40, 80, 200]) assert.equal(stallTier(level), Math.min(10, dropTier(level) + 1))
  for (const offer of stallOffers(items, where(40))) assert.equal(offer.entry.tier, stallTier(40))
})

test('a stall offers a few pieces of different kinds, the same for the same world, city and day', () => {
  const offers = stallOffers(items, where(40))
  assert.equal(offers.length, STALL_OFFERS)
  const kinds = offers.map((offer) => `${offer.entry.slot}/${offer.entry.damageType ?? ''}`)
  assert.equal(new Set(kinds).size, kinds.length)
  assert.deepEqual(stallOffers(items, where(40)), offers)
  assert.ok(offers.every((offer, index) => offer.index === index && offer.kind === 'item'))
})

test('the offers change with the day, the city and the world', () => {
  const ids = (offers) => offers.map((offer) => offer.entry.id).join()
  const days = new Set(Array.from({ length: 12 }, (_, day) => ids(stallOffers(items, where(40, day)))))
  assert.ok(days.size > 1)
  const citiesSeen = new Set(cities.map((city) => ids(stallOffers(items, where(40, 4, city.id)))))
  assert.ok(citiesSeen.size > 1)
})

test('a piece costs more the higher its tier, and follows the world level', () => {
  const entry = (tier) => ({ tier, recipe: ['ore', 'logs'] })
  assert.ok(stallPrice(entry(4), 40) > stallPrice(entry(3), 40))
  assert.ok(stallPrice(entry(4), 60) < stallPrice(entry(4), 40), 'a tier behind the world is cheap')
  assert.ok(stallPrice(entry(10), 400) >= 1)
  assert.ok(Number.isFinite(stallPrice(entry(10), 5000)))
})

test('a bought piece goes into the chosen room\'s chest and the coins pay for it', () => {
  const [offer] = stallOffers(items, where(40))
  const world = worldAt(40, { coins: offer.price + 5, day: 4 })
  const purchase = { cityId: 'goldmill', offerIndex: 0, entryId: offer.entry.id, projectId: ROOM }
  const next = buyStallOffer(world, context, purchase)
  assert.equal(next.coins, 5)
  assert.deepEqual(next.projects[ROOM].chest, [createItem(offer.entry)])
  assert.deepEqual(next.market.sold.goldmill, { day: 4, offers: [0] })
  assert.equal(buyStallOffer({ ...next, coins: 1e12 }, context, purchase).projects[ROOM].chest.length, 1,
    'an offer is sold once a day')
})

test('the next day the stall has new stock', () => {
  const [offer] = stallOffers(items, where(40))
  const world = worldAt(40, { coins: 1e12, day: 4 })
  const bought = buyStallOffer(world, context, { cityId: 'goldmill', offerIndex: 0, entryId: offer.entry.id, projectId: ROOM })
  const nextDay = { ...bought, market: { ...bought.market, clock: 5 * MARKET_DAY_MS } }
  const [tomorrow] = stallOffers(items, where(40, 5))
  const again = buyStallOffer(nextDay, context, { cityId: 'goldmill', offerIndex: 0, entryId: tomorrow.entry.id, projectId: ROOM })
  assert.notEqual(again, nextDay)
})

test('a purchase is refused without the coins, for a closed city, an offer that changed or an unknown room', () => {
  const [offer] = stallOffers(items, where(40))
  const purchase = { cityId: 'goldmill', offerIndex: 0, entryId: offer.entry.id, projectId: ROOM }
  const world = worldAt(40, { coins: offer.price - 1, day: 4 })
  assert.equal(buyStallOffer(world, context, purchase), world)
  const rich = worldAt(40, { coins: 1e12, day: 4 })
  const runespireOffer = stallOffers(items, where(3, 4, 'runespire'))[0]
  for (const wrong of [
    { cityId: 'runespire', entryId: runespireOffer.entry.id },
    { entryId: 'whittled-cudgel' },
    { offerIndex: STALL_OFFERS },
    { projectId: 'local:/work/turbo-waffle' },
    { cityId: 'atlantis' }
  ]) {
    const low = { ...rich, skills: wrong.cityId === 'runespire' ? worldAt(3).skills : rich.skills }
    assert.equal(buyStallOffer(low, context, { ...purchase, ...wrong }), low, JSON.stringify(wrong))
  }
})

test('a room whose chest keeps as many copies as it may cannot buy another', () => {
  const [offer] = stallOffers(items, where(40))
  const world = worldAt(40, { coins: 1e12, day: 4 })
  let chest = []
  for (let copy = 0; copy < COPIES_PER_ITEM; copy += 1) {
    chest = [...chest, { ...createItem(offer.entry), id: copy ? `${offer.entry.id}-${copy + 1}` : offer.entry.id }]
  }
  const full = { ...world, projects: { [ROOM]: { ...emptyProject(), chest } } }
  const purchase = { cityId: 'goldmill', offerIndex: 0, entryId: offer.entry.id, projectId: ROOM }
  assert.equal(buyStallOffer(full, context, purchase), full)
})
