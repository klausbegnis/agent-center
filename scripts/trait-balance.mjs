// The simulator's traits: how much of the catalogue a world has collected at each checkpoint, a
// player who visits the trait brokers once a working day (buys one scroll of a trait the world
// lacks when the coins allow, and teaches scrolls into free slots), and the table that compares the
// two. The aim: a light user collects a fair part of the catalogue in a year, a heavy one most of
// it, and nobody all of it.
import { worldLevel } from '../src/game/progression.mjs'
import { isCityOpen } from '../src/game/market.mjs'
import { brokerSold, offersFor } from '../src/game/trait-broker.mjs'
import { traitIndexOf } from '../src/game/trait-content.mjs'
import { traitSlots, traitsOf } from '../src/game/trait-effects.mjs'
import { collectedTraits, scrollsOf } from '../src/game/traits.mjs'
import { printTable } from './game-balance.mjs'

/** The broker policy keeps this share of the world's coins for the market policy's own buys. */
const COINS_KEPT = 0.5
/** Scrolls bought at most in one visit. */
const SCROLLS_PER_VISIT = 1

/**
 * A world's trait collection at a checkpoint: traits ever had, and scrolls in its chests.
 *
 * @param {object} world
 * @param {object} content
 * @returns {{ known: number, scrolls: number } | null}
 */
export function traitProgress(world, content) {
  const index = traitIndexOf(content)
  if (!index || !world) return null
  const scrolls = Object.values(world.projects).reduce((sum, project) =>
    sum + Object.values(scrollsOf(project)).reduce((count, value) => count + value, 0), 0)
  return { known: collectedTraits(world, index).length, scrolls }
}

/** Buys a scroll of a trait the world lacks from an open city, when half the coins cover it. */
function buyMissing(engine, save, stats, { index, cities }) {
  let next = save
  let bought = 0
  for (const city of cities) {
    const world = next.worlds.main
    if (bought >= SCROLLS_PER_VISIT || !isCityOpen(city, worldLevel(world.skills))) continue
    const known = new Set(collectedTraits(world, index))
    const sold = brokerSold(world, city.id)
    const offer = offersFor(world, { worldId: 'main', cityId: city.id, index })
      .find((entry) => !known.has(entry.traitId) && !sold.includes(entry.index) && entry.price <= (world.coins ?? 0) * COINS_KEPT)
    const projectId = Object.keys(world.projects).sort()[0]
    if (!offer || !projectId) continue
    const purchase = { worldId: 'main', cityId: city.id, offerIndex: offer.index, traitId: offer.traitId, projectId }
    const after = engine.buyTraitScroll(next, purchase)
    if (after === next) continue
    stats.bought += 1
    stats.spent += offer.price
    bought += 1
    next = after
  }
  return next
}

/** Teaches each living character with a free slot the best scroll of its room it does not carry. */
function teachFreeSlots(engine, save, stats, index) {
  let next = save
  for (const [projectId, project] of Object.entries(next.worlds.main.projects)) {
    for (const character of Object.values(project.characters)) {
      const room = next.worlds.main.projects[projectId]
      const carried = traitsOf(room.characters[character.sessionId], index)
      if (carried.length >= traitSlots(character.level)) continue
      const best = Object.keys(scrollsOf(room)).filter((id) => !carried.includes(id))
        .sort((a, b) => index.byTier[index.byId.get(b).tier].length - index.byTier[index.byId.get(a).tier].length)[0]
      if (!best) continue
      const taught = engine.teachTrait(next, { projectId, sessionId: character.sessionId, traitId: best })
      if (taught !== next) stats.taught += 1
      next = taught
    }
  }
  return next
}

/**
 * The broker policy's visit, once a working day.
 *
 * @param {object} engine
 * @param {object} save
 * @param {{ bought: number, spent: number, taught: number }} stats counted up
 * @param {object} content
 */
export function visitBroker(engine, save, stats, content) {
  const index = traitIndexOf(content)
  if (!index || !save.worlds.main) return save
  const bought = buyMissing(engine, save, stats, { index, cities: content.cities?.cities ?? [] })
  return teachFreeSlots(engine, bought, stats, index)
}

/**
 * Prints how many traits each scenario collects in a year, with and without the broker policy.
 *
 * @param {object[]} runs the scenarios as usual
 * @param {object[]} brokerRuns the same with the market and the broker policies
 * @param {object} content
 */
export function printTraits(runs, brokerRuns, content) {
  const total = content.traits.traits.length
  console.log(`\n## Traits: the world's collection (of ${total}) without and with a daily visit to the trait brokers\n`)
  const rows = []
  runs.forEach((run, at) => {
    const broker = brokerRuns[at]
    const known = (source, day) => source.rows.find((row) => row.day === day)?.traits?.known ?? '-'
    const drops = run.allKills.filter((event) => event.scroll).length
    rows.push([run.scenario.id, known(run, 30), known(run, 90), known(run, 180), known(run, 365),
      known(broker, 90), known(broker, 365), run.serial, drops, broker.traitBroker.bought, broker.traitBroker.taught])
  })
  printTable(['scenario', 'day 30', '90', '180', '365', 'broker 90', 'broker 365', 'sessions', 'scroll drops',
    'bought', 'taught'], rows)
  console.log('Day columns: traits the world has had, born to its characters or found as scrolls. Broker: the same ' +
    'player with the market policy and a daily visit to the brokers. Sessions: characters born in the year, each ' +
    'with a trait. Scroll drops: scrolls from elites, champions and bosses in the year.')
  for (const run of runs) {
    const year = run.rows.find((row) => row.day === 365)?.traits?.known ?? 0
    const verdict = year < total ? 'PASS' : 'FAIL'
    console.log(`${verdict} ${run.scenario.id}: the whole catalogue is a long-term goal (${year} of ${total} in a year)`)
  }
}
