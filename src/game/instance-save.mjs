// Instances as the save keeps them, read back: `migrate` repairs what the plugin's own storage
// holds (instance*Normalized), `cleanSave` refuses a file whose parts are not what the engine writes
// (check*). A world keeps `instances: { [id]: { runs, clears, bestTier, rematch? } }`, a room in a run its
// `run`, and a room after a failed run its `instanceCooldowns`. Pure.
import { BOON_TYPES, BOONS_OFFERED } from './instance-boons.mjs'
import { INSTANCE_COOLDOWN_MS, INSTANCE_TRIES } from './instance-constants.mjs'
import { REMATCH_TIERS, isRematch, rematchTier } from './instance-rematch.mjs'
import { MATERIALS } from './skills.mjs'

/** A tier no world will ever reach, so a file cannot keep an absurd one. */
export const MAX_TIER = 10_000
/** Ticks a run, a try or a wait can count; far beyond any run, so a file cannot keep an absurd one. */
const MAX_TICKS = 10_000_000
const ROOMS = 6
/** The most fights a room holds (a crowded hall). */
const MAX_FIGHTS = 6

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const isCount = (value, max = Number.MAX_SAFE_INTEGER) => Number.isInteger(value) && value >= 0 && value <= max
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

/**
 * A world's progress in its instances, repaired: whole counts, a best tier only with a clear. Null
 * when there is nothing to keep, so a world that never entered keeps no field.
 *
 * @param {unknown} value
 * @returns {Record<string, { runs: number, clears: number, bestTier: number }> | null}
 */
export function normalizeWorldInstances(value) {
  if (!isPlainObject(value)) return null
  const kept = Object.entries(value).filter(([, entry]) => isPlainObject(entry) && isCount(entry.runs) && isCount(entry.clears) &&
    isCount(entry.bestTier, MAX_TIER)).map(([id, entry]) => [id, {
    runs: entry.runs, clears: entry.clears, bestTier: entry.bestTier,
    // The best rematch cleared (instance-rematch.mjs), kept only with a clear.
    ...(isRematch(entry.rematch) && entry.clears > 0 ? { rematch: entry.rematch } : {})
  }])
  return kept.length ? Object.fromEntries(kept) : null
}

/** Whether a run as stored has every field the fight reads, of the right kind. */
function isRun(run) {
  return isPlainObject(run) && typeof run.instance === 'string' && isCount(run.tier, MAX_TIER) && run.tier >= 1 &&
    isCount(run.room, ROOMS - 1) && isCount(run.fight, MAX_FIGHTS) && isCount(run.tries) && isCount(run.tryTicks) &&
    isCount(run.waitTicks) && isCount(run.ticks) && isCount(run.attempt) && isPlainObject(run.found) &&
    isPlainObject(run.frozen) && isNumber(run.frozen.wave) && isNumber(run.frozen.waveKills) && isRematchRun(run)
}

/** A rematch's run plays at its rematch's tier; a run without the field is a normal one. */
const isRematchRun = (run) => run.rematch === undefined || (isRematch(run.rematch) && run.tier === rematchTier(run.rematch))

/**
 * A room's instance state as stored, repaired: a run that cannot be played is dropped, the room
 * back on its wave with the monster it left; cooldowns are kept while they have time left.
 *
 * @param {object} project the project, already normalized otherwise
 * @returns {object}
 */
export function normalizeProjectInstance(project) {
  const { run, instanceCooldowns, ...rest } = project
  const cooldowns = isPlainObject(instanceCooldowns)
    ? Object.entries(instanceCooldowns).filter(([, ms]) => isNumber(ms) && ms > 0)
    : []
  const next = cooldowns.length ? { ...rest, instanceCooldowns: Object.fromEntries(cooldowns) } : rest
  if (run === undefined) return next
  if (isRun(run)) return { ...next, run }
  return { ...next, monster: isPlainObject(run?.frozen?.monster) ? run.frozen.monster : null }
}

/**
 * @typedef {{ ok: true, value: any } | { ok: false, problem: [string, string] }} Checked
 * `problem` is where (a path under the part checked) and what is wrong
 */

const refuse = (where, what) => ({ ok: false, problem: [where, what] })

/**
 * A world's instance progress as an imported file holds it: instances the content has, whole counts,
 * no more clears than runs, a best tier exactly when there is a clear.
 *
 * @param {unknown} value
 * @param {import('./instance-content.mjs').InstanceIndex | null} index
 * @returns {Checked}
 */
export function checkWorldInstances(value, index) {
  if (value === undefined) return { ok: true, value: null }
  if (!index) return refuse('instances', 'are kept by a game that has none')
  if (!isPlainObject(value)) return refuse('instances', 'is not an object')
  const checked = {}
  for (const [id, entry] of Object.entries(value)) {
    if (!index.byId.has(id)) return refuse(`instances.${id}`, 'is not an instance the game has')
    const keys = Object.keys(entry ?? {})
    const hasRematch = keys.includes('rematch')
    const isProgress = isPlainObject(entry) && keys.length === (hasRematch ? 4 : 3) && isCount(entry.runs) &&
      isCount(entry.clears, entry.runs) && isCount(entry.bestTier, MAX_TIER) && (entry.clears > 0) === (entry.bestTier > 0) &&
      (!hasRematch || (isCount(entry.rematch, REMATCH_TIERS) && entry.rematch >= 1 && entry.rematch <= entry.clears))
    if (!isProgress) return refuse(`instances.${id}`, 'is not progress the engine writes')
    checked[id] = { runs: entry.runs, clears: entry.clears, bestTier: entry.bestTier, ...(hasRematch ? { rematch: entry.rematch } : {}) }
  }
  return { ok: true, value: Object.keys(checked).length ? checked : null }
}

/** What a run found, rebuilt: materials, coins, legendary ids the content has, kills. */
function checkFound(found, legendaryIds) {
  if (!isPlainObject(found)) return null
  const materials = isPlainObject(found.materials) ? found.materials : null
  if (!materials || !Object.entries(materials).every(([id, amount]) => MATERIALS.includes(id) && isNumber(amount) && amount >= 0)) return null
  const legendary = Array.isArray(found.legendary) ? found.legendary : null
  if (!legendary || !legendary.every((id) => legendaryIds.has(id)) || new Set(legendary).size !== legendary.length) return null
  if (!isCount(found.coins) || !isCount(found.kills)) return null
  return { materials: { ...materials }, coins: found.coins, legendary: [...legendary], kills: found.kills }
}

/** A run's boon and offer: none, an offer of known boons, or one chosen. */
function boonsAreValid(run, index) {
  const known = (id) => index.boonById.has(id) && Object.hasOwn(BOON_TYPES, index.boonById.get(id).effect.effect)
  if (run.boon !== null && !known(run.boon)) return false
  if (run.offered === null) return true
  return run.boon === null && Array.isArray(run.offered) && run.offered.length === BOONS_OFFERED &&
    run.offered.every(known) && new Set(run.offered).size === run.offered.length
}

/**
 * A room's run as an imported file holds it, rebuilt from the fields the engine writes. The frozen
 * monster is checked by the caller's own monster check.
 *
 * @param {unknown} value
 * @param {import('./instance-content.mjs').InstanceIndex | null} index
 * @param {{ legendaryIds: Set<string>, monster: (value: unknown, path: string) => object | null }} checks
 * @returns {Checked}
 */
export function checkRun(value, index, { legendaryIds, monster }) {
  if (value === undefined) return { ok: true, value: null }
  if (!index) return refuse('run', 'is kept by a game that has no instances')
  if (!isRun(value) || !index.byId.has(value.instance)) return refuse('run', 'is not a run the engine writes')
  if (value.tries > INSTANCE_TRIES + BOON_TYPES.tries.max || Math.max(value.ticks, value.tryTicks, value.waitTicks) > MAX_TICKS) {
    return refuse('run', 'counts more than a run can')
  }
  if (!boonsAreValid(value, index)) return refuse('run.boon', 'is not a boon the game offers')
  const found = checkFound(value.found, legendaryIds)
  if (!found) return refuse('run.found', 'is not what a run finds')
  const frozen = value.frozen
  if (!isCount(frozen.wave) || frozen.wave < 1 || !isCount(frozen.waveKills) || !isCount(frozen.fightTicks ?? 0) ||
    typeof (frozen.fightRested ?? false) !== 'boolean') {
    return refuse('run.frozen', 'is not a wave the engine writes')
  }
  const run = {
    instance: value.instance, tier: value.tier, ...(value.rematch ? { rematch: value.rematch } : {}),
    attempt: value.attempt, room: value.room, fight: value.fight,
    tries: value.tries, tryTicks: value.tryTicks, waitTicks: value.waitTicks, ticks: value.ticks,
    boon: value.boon, offered: value.offered ? [...value.offered] : null, found,
    frozen: {
      wave: frozen.wave, waveKills: frozen.waveKills, monster: monster(frozen.monster, 'run.frozen.monster'),
      fightTicks: frozen.fightTicks ?? 0, fightRested: frozen.fightRested ?? false
    }
  }
  return { ok: true, value: run }
}

/**
 * A room's cooldowns as an imported file holds them: instances the content has, whole ms left of
 * at most a whole cooldown.
 *
 * @param {unknown} value
 * @param {import('./instance-content.mjs').InstanceIndex | null} index
 * @returns {Checked}
 */
export function checkCooldowns(value, index) {
  if (value === undefined) return { ok: true, value: null }
  if (!index || !isPlainObject(value)) return refuse('instanceCooldowns', 'are not cooldowns the engine writes')
  for (const [id, ms] of Object.entries(value)) {
    if (!index.byId.has(id) || !isNumber(ms) || ms <= 0 || ms > INSTANCE_COOLDOWN_MS) {
      return refuse(`instanceCooldowns.${id}`, 'is not a cooldown the engine writes')
    }
  }
  return { ok: true, value: Object.keys(value).length ? { ...value } : null }
}

/**
 * A world may have one room inside each instance; a file with two would play both.
 *
 * @param {Record<string, { run?: { instance: string } }>} projects
 * @returns {string | null} the instance two rooms are inside
 */
export function sharedInstance(projects) {
  const seen = new Set()
  for (const project of Object.values(projects)) {
    const id = project.run?.instance
    if (!id) continue
    if (seen.has(id)) return id
    seen.add(id)
  }
  return null
}
