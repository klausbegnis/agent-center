// The simulator's second policy: a player who visits the market once a working day. It trades
// surplus materials for the ones the next purchase lacks, buys stall gear that beats what a room
// has, and sells what is still left over for coins. Uses only what the Market tab offers.
import { effectiveGearLevel, upgradeCost } from '../src/game/items.mjs'
import { isCityOpen, marketDay, pricePoint, tradeUnits } from '../src/game/market.mjs'
import { unitBuyPrice, unitSellPrice } from '../src/game/market-prices.mjs'
import { SPEND_WEIGHTS } from '../src/game/constants.mjs'
import { worldLevel } from '../src/game/progression.mjs'
import { isChestFullOf, soldOffers, stallOffers } from '../src/game/stall.mjs'
import { GROUP_UPGRADE_IDS, groupLevel, groupUpgradeCost, itemsInUse } from '../src/game/spending.mjs'
import { MATERIALS } from '../src/game/skills.mjs'

/** A material is surplus beyond this many times the most any one purchase needs of it. */
const RESERVE_PURCHASES = 3
/** A sale stops once the city's price for the material has fallen this far below its usual. */
const SALE_PRICE_FLOOR = 0.7
/** A trade sells this much more than the estimate needs, to cover the price it moves. */
const TRADE_MARGIN = 1.15
/** The shortages filled a visit: the cheapest purchases the world cannot afford. */
const SHORTAGES_FILLED = 3

/** Every purchase the world could make now, with the score autoSpend ranks it by (lowest first). */
function purchasesOf(world) {
  const level = worldLevel(world.skills)
  const workbenchLevel = groupLevel(world.upgrades, 'workbench')
  const items = Object.values(world.projects).flatMap(itemsInUse)
    .map((item) => ({ kind: item.slot, cost: upgradeCost(item, { workbenchLevel, worldLevel: level }) }))
  const groups = GROUP_UPGRADE_IDS
    .map((id) => ({ kind: 'group', cost: groupUpgradeCost(id, groupLevel(world.upgrades, id), level) }))
  return [...items, ...groups].map(({ kind, cost }) =>
    ({ cost, score: Object.values(cost).reduce((sum, amount) => sum + amount, 0) / SPEND_WEIGHTS[kind] }))
}

function reservesOf(world) {
  const reserves = Object.fromEntries(MATERIALS.map((id) => [id, 0]))
  for (const { cost } of purchasesOf(world)) {
    for (const [id, amount] of Object.entries(cost)) reserves[id] = Math.max(reserves[id], amount * RESERVE_PURCHASES)
  }
  return reserves
}

const surplusOf = (world, reserves, id) => Math.max(0, Math.floor((world.materials[id] ?? 0) - reserves[id]))
const openCities = (world, cities) => cities.filter((city) => isCityOpen(city, worldLevel(world.skills)))

/** Trades surplus for what the cheapest purchases out of reach lack. */
function fillShortages(engine, save, cities, counts) {
  let next = save
  const costs = purchasesOf(next.worlds.main)
    .filter(({ cost }) => Object.entries(cost).some(([id, amount]) => (next.worlds.main.materials[id] ?? 0) < amount))
    .sort((a, b) => a.score - b.score)
    .slice(0, SHORTAGES_FILLED)
    .map(({ cost }) => cost)
  for (const cost of costs) {
    for (const [toId, amount] of Object.entries(cost)) {
      const world = next.worlds.main
      const short = amount - (world.materials[toId] ?? 0)
      if (short <= 0) continue
      const sellers = openCities(world, cities).filter((city) => city.produces.includes(toId))
      if (sellers.length === 0) continue
      const reserves = reservesOf(world)
      const city = sellers[0]
      const fromId = MATERIALS.filter((id) => id !== toId && !Object.hasOwn(cost, id))
        .sort((a, b) => surplusOf(world, reserves, b) * unitSellPrice(pricePoint(world, city, b)) -
          surplusOf(world, reserves, a) * unitSellPrice(pricePoint(world, city, a)))[0]
      const ask = unitBuyPrice(pricePoint(world, city, toId))
      const bid = unitSellPrice(pricePoint(world, city, fromId))
      const units = Math.min(surplusOf(world, reserves, fromId), Math.ceil(short * ask / bid * TRADE_MARGIN))
      if (units < 1 || tradeUnits(world, city, { fromId, toId, amount: units }) < 1) continue
      const traded = engine.tradeMaterial(next, { worldId: 'main', cityId: city.id, fromId, toId, amount: units })
      if (traded !== next) counts.trades += 1
      next = traded
    }
  }
  return next
}

/** The strongest piece a room keeps of a slot (and a weapon's damage type), in gear levels. */
function bestPower(project, entry) {
  const same = project.chest.filter((item) => item.slot === entry.slot &&
    (entry.slot !== 'weapon' || item.damageType === entry.damageType))
  return Math.max(-1, ...same.map(effectiveGearLevel))
}

/** Buys each stall piece that beats what a room keeps, while the coins last. */
function buyGear(engine, save, cities, items, counts) {
  let next = save
  for (const city of openCities(next.worlds.main, cities)) {
    const world = next.worlds.main
    const level = worldLevel(world.skills)
    const offers = stallOffers(items, { worldId: 'main', cityId: city.id, day: marketDay(world.market), level })
    for (const offer of offers) {
      if (soldOffers(next.worlds.main.market, city.id).includes(offer.index)) continue
      const power = effectiveGearLevel({ tier: offer.entry.tier, level: 0 })
      const projectId = Object.keys(next.worlds.main.projects).sort().find((id) => {
        const project = next.worlds.main.projects[id]
        return bestPower(project, offer.entry) < power && !isChestFullOf(project.chest, offer.entry.id)
      })
      if (!projectId || next.worlds.main.coins < offer.price) continue
      const bought = engine.buyStallOffer(next, { worldId: 'main', cityId: city.id, offerIndex: offer.index, entryId: offer.entry.id, projectId })
      if (bought !== next) counts.gear += 1
      next = bought
    }
  }
  return next
}

/** Sells what is still surplus, each where it pays best, before the price falls too far. */
function sellSurplus(engine, save, cities, counts) {
  let next = save
  const reserves = reservesOf(next.worlds.main)
  for (const id of MATERIALS) {
    const world = next.worlds.main
    const surplus = surplusOf(world, reserves, id)
    if (surplus < 1) continue
    const [city] = openCities(world, cities)
      .sort((a, b) => unitSellPrice(pricePoint(world, b, id)) - unitSellPrice(pricePoint(world, a, id)))
    if (!city) continue
    const point = pricePoint(world, city, id)
    const floor = point.usual * SALE_PRICE_FLOOR
    const room = Math.log(Math.min(point.usual, point.base) / floor) - Math.max(0, point.pressure)
    const amount = Math.min(surplus, Math.floor(room * point.depth))
    if (amount < 1) continue
    const before = world.coins
    next = engine.sellMaterial(next, { worldId: 'main', cityId: city.id, materialId: id, amount })
    counts.earned += next.worlds.main.coins - before
  }
  return next
}

/**
 * One visit to the market, after the evening's autoSpend; autoSpend runs again after it.
 *
 * @param {ReturnType<typeof import('../src/game/engine.mjs').createEngine>} engine
 * @param {object} save
 * @param {{ cities: object[], items: { items: object[] } }} content
 * @param {{ trades: number, gear: number, earned: number }} counts added to
 * @returns {object} the save after the visit and the autoSpend that follows
 */
export function visitMarket(engine, save, { cities, items }, counts) {
  if (!save.worlds.main) return save
  let next = fillShortages(engine, save, cities, counts)
  next = buyGear(engine, next, cities, items, counts)
  next = sellSurplus(engine, next, cities, counts)
  return engine.autoSpend(next)
}
