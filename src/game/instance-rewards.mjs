// What a run pays beyond its kills: the clear (the world's progress in the instance) and the
// vault. Works on the run's copy of the project, like the fight. Pure.
import { progressOf } from './instance-run.mjs'

/**
 * A clear of the instance: the world counts it and remembers its best tier.
 *
 * @param {object} state the run's working copy of the project
 * @param {object} context the run's (instance-fight.mjs)
 */
export function clearRewards(state, context) {
  const run = state.run
  const progress = progressOf({ instances: context.tally.instances }, run.instance)
  context.tally.instances = {
    ...context.tally.instances,
    [run.instance]: { ...progress, clears: progress.clears + 1, bestTier: Math.max(progress.bestTier, run.tier) }
  }
}

/** The vault's loot, found as the party walks in. */
export function vaultLoot() {}
