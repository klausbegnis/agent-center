// The simulator's fourth policy: a player who runs the highest open instance whenever one is
// available. Checked at every working step: a road instance not cleared yet comes first; then the
// next rematch of a beaten boss (instance-rematch.mjs), highest instance first, unless that rematch
// failed at the world's level now (it waits for a tenth more); then the highest instance at one tier above
// the last clear there, one below after a failure (never under 1). The first room that may enter
// goes in (a room another holds, or one on a cooldown, leaves the next one down to the other rooms).
// Auto takes the vault's first boon. Uses only what the Roadmap tab offers.
import { worldLevel } from '../src/game/progression.mjs'

/** A rematch that failed is tried again once the world's level is this share higher (and one more). */
const REMATCH_RETRY_SHARE = 0.1

/** The first room of the world that may enter, sent in; the same save when none may. */
function sendFirst(engine, save, projectIds, entry) {
  for (const projectId of projectIds) {
    const each = { ...entry, projectId }
    if (engine.enterProblem(save, each) === null) return engine.enterInstance(save, each)
  }
  return save
}

/** The next rematch of each beaten instance the policy would go for now, highest first. */
function rematchesDue(world, memory) {
  const level = worldLevel(world.skills)
  const due = []
  for (const instanceId of [...memory.order].reverse()) {
    const progress = world.instances?.[instanceId]
    if (!progress?.clears) continue
    if (memory.rematchRetry[instanceId] === 'failed') memory.rematchRetry[instanceId] = Math.ceil(level * (1 + REMATCH_RETRY_SHARE)) + 1
    if (level < (memory.rematchRetry[instanceId] ?? 0)) continue
    due.push({ instanceId, rematch: (progress.rematch ?? 0) + 1 })
  }
  return due
}

/**
 * @param {ReturnType<typeof import('../src/game/engine.mjs').createEngine>} engine
 * @param {object} save
 * @param {{ order: string[], tiers: Record<string, number>, rematchRetry: Record<string, number | string> }} memory
 *   the road's instances in order, the tier the policy will try next for each, and when a failed
 *   rematch is tried again
 * @returns {object} the save, with a room sent in when one could go
 */
export function enterHighestInstance(engine, save, memory) {
  const world = save.worlds.main
  if (!world) return save
  const projectIds = Object.keys(world.projects).sort()
  const fresh = [...memory.order].reverse().filter((id) => !world.instances?.[id]?.clears)
  const candidates = [
    ...fresh.map((instanceId) => ({ instanceId, tier: memory.tiers[instanceId] ?? 1 })),
    ...rematchesDue(world, memory).map((entry) => ({ ...entry, tier: 1 })),
    ...[...memory.order].reverse().map((instanceId) => ({ instanceId, tier: memory.tiers[instanceId] ?? 1 }))
  ]
  for (const entry of candidates) {
    const next = sendFirst(engine, save, projectIds, entry)
    if (next !== save) return next
  }
  return save
}

/**
 * The tier to try next after a run's end: one up after a clear, one down after a failure; a failed
 * rematch waits for the world to grow.
 *
 * @param {{ tiers: Record<string, number>, rematchRetry: Record<string, number | string> }} memory
 * @param {{ kind: string, instance: string, tier: number, rematch?: number }} event a run's end
 */
export function rememberRun(memory, event) {
  if (event.rematch) {
    if (event.kind === 'failed') memory.rematchRetry[event.instance] = 'failed'
    return
  }
  if (event.kind === 'cleared') memory.tiers[event.instance] = event.tier + 1
  if (event.kind === 'failed') memory.tiers[event.instance] = Math.max(1, event.tier - 1)
}
