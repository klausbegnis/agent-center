// The simulator's view of city ranks: the day each city of a trading player's world reached each
// rank, and the pace targets they are tuned to (docs/GAME.md, "City ranks").
import { cityStandingOf } from '../src/game/city-ranks.mjs'
import { printTable } from './game-balance.mjs'

const NUMERALS = ['I', 'II', 'III', 'IV', 'V']

/**
 * Notes the day each city reached each rank.
 *
 * @param {{ save: object, cityRankDays?: Record<string, number[]> }} run
 * @param {number} day the day just played, from 0
 * @param {object[]} cities
 */
export function trackCityRanks(run, day, cities) {
  const world = run.save.worlds.main
  if (!world) return
  run.cityRankDays ??= {}
  for (const city of cities) {
    const days = (run.cityRankDays[city.id] ??= [])
    const { rank } = cityStandingOf(world, city.id)
    for (let at = 2; at <= rank; at++) days[at] ??= day + 1
  }
}

/** The day a run's city first reached a rank, or null. */
const dayOf = (run, cityId, rank) => run.cityRankDays?.[cityId]?.[rank] ?? null

/**
 * Prints the day each city reached each rank for every trading run, with its standing at the end.
 *
 * @param {object[]} runs the trading runs
 * @param {object[]} cities
 */
export function printCityRanks(runs, cities) {
  console.log('\n## City ranks: the day each city reached each rank (calendar days), with a daily market visit\n')
  const rows = []
  for (const run of runs) {
    for (const city of cities) {
      const { rank, standing } = cityStandingOf(run.save.worlds.main, city.id)
      rows.push([run.scenario.id, city.name, ...[2, 3, 4, 5].map((at) => dayOf(run, city.id, at) ?? '-'),
        NUMERALS[rank - 1], Math.round(standing),
        run.engine.charterProblem(run.save, { worldId: 'main', cityId: city.id }) ?? '-'])
    }
  }
  printTable(['scenario', 'city', 'II', 'III', 'IV', 'V', 'at 365', 'standing', 'next charter at 365'], rows)
  for (const run of runs) console.log(`${run.scenario.id}: ${run.market.charters ?? 0} charters bought in a year.`)
  const checks = cityRankChecks(runs, cities)
  console.log('')
  printTable(['', 'target', 'measured'], checks.map(([name, passed, detail]) => [passed ? 'PASS' : 'FAIL', name, detail]))
}

/**
 * The pace targets: a regular (medium) player reaches the first ranks within weeks and the last
 * only after many months; a light one sees its first city rise; a heavy one does not finish them all
 * in the first months.
 *
 * @param {object[]} runs the trading runs
 * @param {object[]} cities
 * @returns {[string, boolean, string][]}
 */
function cityRankChecks(runs, cities) {
  const byId = Object.fromEntries(runs.map((run) => [run.scenario.id, run]))
  const first = (id, rank) => Math.min(...cities.map((city) => dayOf(byId[id], city.id, rank) ?? Infinity))
  const last = (id, rank) => Math.max(...cities.map((city) => dayOf(byId[id], city.id, rank) ?? Infinity))
  const shown = (value) => (Number.isFinite(value) ? `day ${value}` : 'after day 365')
  return [
    ['light: a first city reaches rank II within two months', first('light', 2) <= 60, shown(first('light', 2))],
    ['medium: a first city reaches rank II within a month', first('medium', 2) <= 31, shown(first('medium', 2))],
    ['medium: no city reaches rank V before month four', !(first('medium', 5) < 120), shown(first('medium', 5))],
    ['heavy: not every city is at rank V before month six', !(last('heavy', 5) < 180), shown(last('heavy', 5))]
  ]
}
