// The regions of the road (docs/GAME.md, "Regions"): the first, `region` in game/instances.json, holds
// the instances without a `region` key; each region of `regions` after it holds the instances that
// name it, unlocks once the region it comes `after` is complete, and may raise its rooms' monsters
// by `rankStep` ranks. A third region is only data and art. Checks, the index and the rules. Pure.

/** A later region's keys; the first region's are instance-content.mjs's. */
export const LATER_REGION_KEYS = ['id', 'name', 'title', 'map', 'maps', 'after', 'rankStep']
/** How far a region may raise its rooms' plain monsters: normal to veteran, veteran to elite. */
const MAX_RANK_STEP = 1
/** The ranks a room's plain monster climbs, in order. */
const RANK_LADDER = ['normal', 'veteran', 'elite']

/** Why an instance of a region that is not open yet cannot be entered. */
export const REGION_LOCKED = 'its region is not open yet: complete the road before it'

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * Problems of the regions after the first: their own keys (the shared ones are checked like the
 * first region's by `checkShared`), an `after` that names a region before it, a rank step, at least
 * one instance each, and instances grouped in the road's order.
 *
 * @param {object} data the parsed game/instances.json
 * @param {(region: object, name: string) => string[]} checkShared the first region's checks
 * @returns {string[]}
 */
export function validateRegions(data, checkShared) {
  if (data.regions === undefined) return instancesNamingNoRegion(data, [])
  if (!Array.isArray(data.regions)) return ['"regions" must be a list of regions']
  const problems = []
  const seen = [data.region?.id]
  data.regions.forEach((region, at) => {
    const name = `regions[${at}]`
    if (!isObject(region)) return problems.push(`${name} must be an object`)
    problems.push(...checkShared(region, `region "${region.id ?? at}"`))
    if (seen.includes(region.id)) problems.push(`region "${region.id}": another region has the same id`)
    if (!seen.includes(region.after)) problems.push(`region "${region.id}": "after" must name a region before it`)
    const step = region.rankStep ?? 0
    if (!Number.isInteger(step) || step < 0 || step > MAX_RANK_STEP) {
      problems.push(`region "${region.id}": "rankStep" must be a whole number from 0 to ${MAX_RANK_STEP}`)
    }
    seen.push(region.id)
  })
  return [...problems, ...instancesNamingNoRegion(data, seen.slice(1)), ...regionOrderProblems(data)]
}

/** Instances must name a later region that exists; each later region must hold at least one. */
function instancesNamingNoRegion(data, laterIds) {
  const problems = []
  for (const entry of data.instances.filter(isObject)) {
    if (entry.region !== undefined && !laterIds.includes(entry.region)) {
      problems.push(`instance "${entry.id}": "region" must be the id of a region of "regions"`)
    }
  }
  for (const id of laterIds) {
    if (!data.instances.some((entry) => entry?.region === id)) problems.push(`region "${id}": holds no instance`)
  }
  return problems
}

/** The road runs region by region: the first region's instances, then each later region's in turn. */
function regionOrderProblems(data) {
  const order = [undefined, ...(data.regions ?? []).filter(isObject).map((region) => region.id)]
  const positions = data.instances.filter(isObject).map((entry) => order.indexOf(entry.region))
  return positions.some((position, at) => at > 0 && position < positions[at - 1])
    ? ['"instances" must list each region\'s instances together, in the order of the regions']
    : []
}

/** The map size of the region an instance entry belongs to, for its point's check. */
export function mapSizeOf(data, entry) {
  if (entry?.region === undefined) return data.region?.map
  return (data.regions ?? []).find((region) => region?.id === entry.region)?.map
}

/**
 * The regions in road order, each with the ids of its instances: the first one's `after` is null.
 *
 * @param {object} data a valid instances file
 * @returns {{ id: string, name: string, title: string, map: object, maps: object[], after: string | null,
 *   rankStep: number, instanceIds: string[] }[]}
 */
export function indexRegions(data) {
  const all = [{ ...data.region, after: null, rankStep: 0 }, ...(data.regions ?? []).map((region) => ({ ...region, rankStep: region.rankStep ?? 0 }))]
  return all.map((region, at) => ({
    ...region,
    instanceIds: data.instances.filter((entry) => (at === 0 ? entry.region === undefined : entry.region === region.id)).map((entry) => entry.id)
  }))
}

/** The region an instance belongs to. */
export const regionOfInstance = (index, instanceId) => index.regions.find((region) => region.instanceIds.includes(instanceId)) ?? null

/** Whether every instance of a region has been cleared in a world. */
export const isRegionComplete = (world, region) => region.instanceIds.every((id) => (world?.instances?.[id]?.clears ?? 0) > 0)

/**
 * Whether a region is open in a world: the first always, a later one once the region it comes after
 * is complete.
 *
 * @param {object} world
 * @param {object} region an indexed region
 * @param {{ regions: object[] }} index
 */
export function isRegionUnlocked(world, region, index) {
  if (!region.after) return true
  const before = index.regions.find((each) => each.id === region.after)
  return Boolean(before) && isRegionComplete(world, before)
}

/** What an instance's region adds to a run's numbers: how many ranks its plain monsters climb. */
export function regionBonuses(index, instanceId) {
  return { rankStep: regionOfInstance(index, instanceId)?.rankStep ?? 0 }
}

/** A plain monster's rank raised by its region's step (never past an elite). */
export function steppedRank(rank, step) {
  const at = RANK_LADDER.indexOf(rank)
  if (at < 0 || !step) return rank
  return RANK_LADDER[Math.min(RANK_LADDER.length - 1, at + step)]
}

const rosters = new WeakMap()

/**
 * The bosses the waves meet: the roster without the bosses and elites of regions after the first,
 * who are met only in their instances, so their items drop only there.
 *
 * @param {{ bosses?: { bosses: object[] }, instances?: object }} content
 * @returns {{ bosses: object[] } | undefined}
 */
export function waveRosterOf(content) {
  const bosses = content?.bosses
  const data = content?.instances
  if (!bosses || !data?.regions?.length) return bosses
  if (!rosters.has(bosses)) {
    const kept = new Set(data.instances.filter((entry) => entry.region !== undefined).flatMap((entry) => [entry.boss, entry.elite]))
    rosters.set(bosses, { ...bosses, bosses: bosses.bosses.filter((boss) => !kept.has(boss.id)) })
  }
  return rosters.get(bosses)
}

