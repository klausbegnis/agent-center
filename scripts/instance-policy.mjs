// The simulator's fourth policy: a player who runs the highest open instance whenever one is
// available. Checked at every working step: the first room that may enter the highest instance it
// can goes in (a room another holds, or one on a cooldown, leaves the next one down to the other
// rooms), at one tier above the last clear of that instance, one below after a failure (never under 1). Auto takes the
// vault's first boon. Uses only what the World tab's Roadmap offers.

/**
 * @param {ReturnType<typeof import('../src/game/engine.mjs').createEngine>} engine
 * @param {object} save
 * @param {{ order: string[], tiers: Record<string, number> }} memory the road's instances in order,
 *   and the tier the policy will try next for each
 * @returns {object} the save, with a room sent in when one could go
 */
export function enterHighestInstance(engine, save, memory) {
  const world = save.worlds.main
  if (!world) return save
  const projectIds = Object.keys(world.projects).sort()
  for (const instanceId of [...memory.order].reverse()) {
    const tier = memory.tiers[instanceId] ?? 1
    for (const projectId of projectIds) {
      const entry = { projectId, instanceId, tier }
      if (engine.enterProblem(save, entry) === null) return engine.enterInstance(save, entry)
    }
  }
  return save
}

/**
 * The tier to try next after a run's end: one up after a clear, one down after a failure.
 *
 * @param {{ tiers: Record<string, number> }} memory
 * @param {{ kind: string, instance: string, tier: number }} event a run's end
 */
export function rememberRun(memory, event) {
  if (event.kind === 'cleared') memory.tiers[event.instance] = event.tier + 1
  if (event.kind === 'failed') memory.tiers[event.instance] = Math.max(1, event.tier - 1)
}
