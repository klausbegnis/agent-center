// The bestiary's one back-fill. A world that played before its bestiary counted (or before it
// counted everything) has rooms whose kills are more than the bestiary holds; once, the missing
// kills are given to its races as plain kills, spread by a hash of the world and each race, so an
// existing player does not start from nothing. The number given is kept as `filled`, which also
// marks it done: it never runs twice. Bosses are never back-filled: who was beaten is not known.
// Pure.
import { RACE_FIRST_DAY, killsOf } from './bestiary.mjs'
import { chanceOf } from './hash.mjs'

/** How much more one race can get than another: its weight is 1 plus a hash share of this. */
const SPREAD = 1

/** Every kill the world's rooms counted. */
const roomKillsOf = (world) => Object.values(world.projects ?? {}).reduce((sum, project) => sum + (project.kills ?? 0), 0)

/** Every kill the bestiary counted: its races' and its others'. */
const countedKillsOf = (bestiary) =>
  Object.values(bestiary?.races ?? {}).reduce((sum, counter) => sum + killsOf(counter), 0) + killsOf(bestiary?.others)

/**
 * `count` kills shared among the races by weight: the whole parts first, then one each to the
 * races with the largest parts left over (the races' order breaks ties).
 *
 * @param {number} count
 * @param {string[]} raceIds
 * @param {string} worldId
 * @returns {Map<string, number>}
 */
export function spreadKills(count, raceIds, worldId) {
  const weights = raceIds.map((raceId) => 1 + SPREAD * chanceOf(`${worldId}|bestiary-fill|${raceId}`))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const exact = weights.map((weight) => (count * weight) / total)
  const shares = exact.map(Math.floor)
  let left = count - shares.reduce((sum, share) => sum + share, 0)
  const byRest = raceIds.map((_, at) => at).sort((a, b) => (exact[b] - shares[b]) - (exact[a] - shares[a]) || a - b)
  for (const at of byRest) {
    if (left <= 0) break
    shares[at] += 1
    left -= 1
  }
  return new Map(raceIds.map((raceId, at) => [raceId, shares[at]]))
}

/**
 * A world with its bestiary back-filled, or the same world when that was done already.
 *
 * @param {object} world
 * @param {string} worldId
 * @param {{ index: import('./bestiary-content.mjs').BestiaryIndex | null, day: number }} fill `day`
 *   the game day a race first given kills here is first seen on
 * @returns {object}
 */
export function backfillWorld(world, worldId, { index, day }) {
  if (!index || world.bestiary?.filled !== undefined) return world
  const bestiary = world.bestiary ?? { races: {}, bosses: {} }
  const missing = Math.max(0, roomKillsOf(world) - countedKillsOf(bestiary))
  const races = { ...bestiary.races }
  for (const [raceId, kills] of spreadKills(missing, index.raceIds, worldId)) {
    if (kills === 0) continue
    const counter = races[raceId] ? [...races[raceId]] : [0, 0, 0, 0, 0, 0, day]
    counter[0] += kills
    if (!races[raceId]) counter[RACE_FIRST_DAY] = day
    races[raceId] = counter
  }
  return { ...world, bestiary: { ...bestiary, races, filled: missing } }
}

/**
 * Every world of a save back-filled once (see backfillWorld).
 *
 * @param {object} save
 * @param {{ index: import('./bestiary-content.mjs').BestiaryIndex | null, day: number }} fill
 * @returns {object} the same save when every world was done already
 */
export function backfillSave(save, fill) {
  if (!fill.index) return save
  let changed = false
  const worlds = {}
  for (const [worldId, world] of Object.entries(save.worlds)) {
    worlds[worldId] = backfillWorld(world, worldId, fill)
    if (worlds[worldId] !== world) changed = true
  }
  return changed ? { ...save, worlds } : save
}
