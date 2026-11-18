// The simulator's second policy: a player who visits the market once a working day. It trades
// surplus materials for the ones the next purchase lacks, buys stall gear that beats what a room
// has, sells what is still left over for coins, buys a stall's relic whenever it can, and spends
// the coins left above the price of a relic on building levels paid half in coins. Uses only what
// the Market and Camp tabs offer.
import { effectiveGearLevel, upgradeCost } from '../src/game/items.mjs'
import { legendaryIndexOf } from '../src/game/legendary-effects.mjs'
import { legendaryOf } from '../src/game/legendary.mjs'
import { isCityOpen, marketDay, pricePoint, tradeUnits } from '../src/game/market.mjs'
import { unitBuyPrice, unitSellPrice } from '../src/game/market-prices.mjs'
import { buildingPrices } from '../src/game/buildings.mjs'
import { buyCharters, charterReserve } from './city-rank-policy.mjs'
import { SPEND_WEIGHTS } from '../src/game/constants.mjs'
import { worldLevel } from '../src/game/progression.mjs'
import { isChestFullOf, soldOffers, stallOffers } from '../src/game/stall.mjs'
import { settlementIndexOf } from '../src/game/settlement-content.mjs'
import { RELIC_OFFER_INDEX, stallRelicOffer, stallRelicPrice } from '../src/game/stall-relic.mjs'
import { GROUP_UPGRADE_IDS, groupLevel, groupUpgradeCost, isUpgradeOpen, itemsInUse } from '../src/game/spending.mjs'
import { MATERIALS } from '../src/game/skills.mjs'

/** A material is surplus beyond this many times the most any one purchase needs of it. */
const RESERVE_PURCHASES = 3
/** A sale stops once the city's price for the material has fallen this far below its usual. */
const SALE_PRICE_FLOOR = 0.7
/** A trade sells this much more than the estimate needs, to cover the price it moves. */
const TRADE_MARGIN = 1.15
/** The shortages filled a visit: the cheapest purchases the world cannot afford. */
const SHORTAGES_FILLED = 3
/** Building levels paid half in coins at most in one visit. */
const COIN_LEVELS_PER_VISIT = 20

/** Every purchase the world could make now, with the score autoSpend ranks it by (lowest first). */
function purchasesOf(world, settlement) {
  const level = worldLevel(world.skills)
  const workbenchLevel = groupLevel(world.upgrades, 'workbench')
  const items = Object.values(world.projects).flatMap(itemsInUse)
    .map((item) => ({ kind: item.slot, cost: upgradeCost(item, { workbenchLevel, worldLevel: level }) }))
  const groups = GROUP_UPGRADE_IDS.filter((id) => isUpgradeOpen(world, id, settlement))
    .map((id) => ({ kind: 'group', cost: groupUpgradeCost(id, groupLevel(world.upgrades, id), level) }))
  return [...items, ...groups].map(({ kind, cost }) =>
    ({ cost, score: Object.values(cost).reduce((sum, amount) => sum + amount, 0) / SPEND_WEIGHTS[kind] }))
}

function reservesOf(world, settlement) {
  const reserves = Object.fromEntries(MATERIALS.map((id) => [id, 0]))
  for (const { cost } of purchasesOf(world, settlement)) {
    for (const [id, amount] of Object.entries(cost)) reserves[id] = Math.max(reserves[id], amount * RESERVE_PURCHASES)
  }
  return reserves
}

const surplusOf = (world, reserves, id) => Math.max(0, Math.floor((world.materials[id] ?? 0) - reserves[id]))
const openCities = (world, cities) => cities.filter((city) => isCityOpen(city, worldLevel(world.skills)))

/** Trades surplus for what the cheapest purchases out of reach lack. */
function fillShortages(engine, save, { cities, settlement }, counts) {
  let next = save
  const costs = purchasesOf(next.worlds.main, settlement)
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
      const reserves = reservesOf(world, settlement)
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

/** Buys a stall's relic whenever the coins cover it, for the first room that lacks it. */
function buyRelics(engine, save, { cities, legendary }, counts) {
  const index = legendaryIndexOf({ legendary })
  let next = save
  for (const city of openCities(next.worlds.main, cities)) {
    const world = next.worlds.main
    const day = marketDay(world.market)
    if (soldOffers(world.market, city.id).includes(RELIC_OFFER_INDEX)) continue
    for (const projectId of Object.keys(world.projects).sort()) {
      const where = { worldId: 'main', cityId: city.id, day, level: worldLevel(world.skills) }
      const offer = stallRelicOffer(index, { ...where, ownedIds: legendaryOf(world.projects[projectId]).relics })
      if (!offer || world.coins < offer.price) continue
      const purchase = { worldId: 'main', cityId: city.id, offerIndex: RELIC_OFFER_INDEX, entryId: offer.entry.id, projectId }
      const bought = engine.buyStallOffer(next, purchase)
      if (bought !== next) counts.relics = (counts.relics ?? 0) + 1
      next = bought
      break
    }
  }
  return next
}

/** Sells what is still surplus, each where it pays best, before the price falls too far. */
function sellSurplus(engine, save, { cities, settlement }, counts) {
  let next = save
  const reserves = reservesOf(next.worlds.main, settlement)
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
 * Builds the cheapest building level whose price with coins the world can pay, again and again,
 * keeping a relic's price in coins for the stalls and the next charter's for a city's rank.
 */
function buildWithCoins(engine, save, { settlement, cities }, counts) {
  let next = save
  for (let built = 0; built < COIN_LEVELS_PER_VISIT; built++) {
    const world = next.worlds.main
    const reserve = stallRelicPrice(worldLevel(world.skills)) + charterReserve(world, cities)
    const [cheapest] = GROUP_UPGRADE_IDS.filter((id) => isUpgradeOpen(world, id, settlement))
      .map((upgradeId) => ({ upgradeId, price: buildingPrices(world, upgradeId, settlement).withCoins }))
      .filter(({ price }) => price && world.coins - price.coins >= reserve &&
        Object.entries(price.cost).every(([id, amount]) => (world.materials[id] ?? 0) >= amount))
      .sort((a, b) => a.price.coins - b.price.coins)
    if (!cheapest) break
    const bought = engine.buyGroupUpgrade(next, { worldId: 'main', upgradeId: cheapest.upgradeId, useCoins: true })
    if (bought === next) break
    counts.coinLevels = (counts.coinLevels ?? 0) + 1
    counts.coinsOnBuildings = (counts.coinsOnBuildings ?? 0) + world.coins - bought.worlds.main.coins
    next = bought
  }
  return next
}

/**
 * One visit to the market, after the evening's autoSpend; autoSpend runs again after it.
 *
 * @param {ReturnType<typeof import('../src/game/engine.mjs').createEngine>} engine
 * @param {object} save
 * @param {{ cities: object[], items: { items: object[] }, legendary?: object, settlement?: object }} content
 * @param {{ trades: number, gear: number, earned: number, relics?: number, coinLevels?: number,
 *   coinsOnBuildings?: number }} counts added to
 * @returns {object} the save after the visit and the autoSpend that follows
 */
export function visitMarket(engine, save, { cities, items, legendary, settlement: data }, counts) {
  if (!save.worlds.main) return save
  const settlement = settlementIndexOf({ settlement: data })
  let next = fillShortages(engine, save, { cities, settlement }, counts)
  next = buyGear(engine, next, cities, items, counts)
  next = sellSurplus(engine, next, { cities, settlement }, counts)
  next = buyRelics(engine, next, { cities, legendary }, counts)
  next = buyCharters(engine, next, cities, counts)
  next = buildWithCoins(engine, next, { settlement, cities }, counts)
  return engine.autoSpend(next)
}
