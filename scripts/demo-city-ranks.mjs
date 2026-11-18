// The demo's city ranks: the cities stand at different ranks, so the Market tab shows a city at its
// first rank, one ready for its next charter and one at its last; CITY_RANK=n puts every city at
// rank n instead, so each rank's banner can be reviewed. The ranks go in as an imported save would.
import { CITY_RANK_MAX, CITY_STANDING } from '../src/game/city-rank-constants.mjs'

/**
 * The demo's mix: Goldmill ready for its charter to rank IV, Deepforge on its way to III,
 * Brinehaven at its last rank, Tallwood at its first, Runespire at rank II.
 */
const DEMO_RANKS = Object.freeze({ goldmill: [3, 1.1], deepforge: [2, 0.45], brinehaven: [5, 1], tallwood: [1, 0.2], runespire: [2, 0.7] })

/** A standing the share of the way from a rank's need to the next one's. */
function standingAt(rank, share) {
  const from = CITY_STANDING[rank - 1]
  const to = CITY_STANDING[rank] ?? from * 2
  return Math.round(from + (to - from) * share)
}

/**
 * The city ranks a demo world shows: the mix above, or every city at one rank.
 *
 * @param {number | null} rank every city's rank, or null for the mix
 * @returns {Record<string, { rank: number, standing: number }>}
 */
export function demoCityRanks(rank) {
  if (rank === null) {
    return Object.fromEntries(Object.entries(DEMO_RANKS)
      .map(([cityId, [at, share]]) => [cityId, { rank: at, standing: standingAt(at, share) }]))
  }
  const at = Math.min(CITY_RANK_MAX, Math.max(1, Math.round(rank)))
  return Object.fromEntries(Object.keys(DEMO_RANKS).map((cityId) => [cityId, { rank: at, standing: standingAt(at, 0.6) }]))
}

/**
 * Gives the demo's world these city ranks, as an imported save would, then a round with the clock
 * where it is links the agents again and earns nothing.
 *
 * @param {object} game the demo's game mode
 * @param {Record<string, { rank: number, standing: number }>} cityRanks
 */
export async function showDemoCityRanks(game, cityRanks) {
  const file = await game.exportSave()
  file.save.worlds.main.cityRanks = { ...cityRanks }
  await game.importSave(file)
  await game.round()
}
