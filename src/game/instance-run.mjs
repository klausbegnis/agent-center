// A room's run through an instance, as the save keeps it: which instances a world has opened and
// cleared, entering one (the room's wave is frozen and comes back on the way out), choosing a
// boon in the vault, recalling the party, and the cooldown after a run that did not clear. The
// fight inside is instance-fight.mjs. Pure: every function returns new objects.
import { modifierAt, runBonuses } from './instance-boons.mjs'
import { FIGHT_ROOMS } from './instance-content.mjs'
import { INSTANCE_COOLDOWN_MS } from './instance-constants.mjs'
import { REGION_LOCKED, isRegionUnlocked, regionBonuses, regionOfInstance } from './instance-regions.mjs'
import { rematchBonuses, rematchProblem, rematchTier } from './instance-rematch.mjs'
import { worldLevel } from './progression.mjs'
import { withProjectIn, worldIdOf } from './worlds.mjs'

/** Why a room cannot enter an instance, as the actions and the Roadmap say it. */
export const INSTANCE_REFUSALS = Object.freeze({
  noInstances: 'this game has no instances',
  unknownInstance: 'unknown instance',
  notPlaying: 'not a room that plays',
  inside: 'the room is already inside an instance',
  closed: 'the road to it is not cleared yet',
  regionLocked: REGION_LOCKED,
  level: 'the world\'s level is too low',
  tier: 'that tier is not open: clear the one below it first',
  taken: 'another room is inside it',
  noCharacters: 'the room has no characters',
  cooldown: 'the party is still recovering from its last run there',
  notInside: 'the room is not inside an instance',
  notAtVault: 'the party is not at the vault',
  unknownBoon: 'not a boon offered in this vault'
})

/** @typedef {{ runs: number, clears: number, bestTier: number, rematch?: number }} InstanceProgress */

/**
 * A world's progress in one instance; nothing for one it never entered.
 *
 * @param {{ instances?: Record<string, InstanceProgress> }} world
 * @param {string} instanceId
 * @returns {InstanceProgress}
 */
export const progressOf = (world, instanceId) => world?.instances?.[instanceId] ?? { runs: 0, clears: 0, bestTier: 0 }

/**
 * Whether an instance is open in a world: the world has reached its level and, past the first on
 * the road, the one before it is cleared.
 *
 * @param {object} world
 * @param {object} instance the content entry
 * @param {import('./instance-content.mjs').InstanceIndex} index
 * @returns {{ open: boolean, reason: string | null }} `reason` says why not
 */
export function openness(world, instance, index) {
  const region = regionOfInstance(index, instance.id)
  // A later region opens once the one before it is complete (instance-regions.mjs).
  if (region && !isRegionUnlocked(world, region, index)) return { open: false, reason: INSTANCE_REFUSALS.regionLocked }
  const at = index.order.indexOf(instance.id)
  if (at > 0 && progressOf(world, index.order[at - 1]).clears === 0) return { open: false, reason: INSTANCE_REFUSALS.closed }
  if (worldLevel(world.skills) < instance.opensAt) return { open: false, reason: INSTANCE_REFUSALS.level }
  return { open: true, reason: null }
}

/** The highest tier a world may enter an instance at: one above the best it cleared. */
export const highestTier = (world, instanceId) => progressOf(world, instanceId).bestTier + 1

/** The room of the world inside an instance now, or null. */
export function roomInside(world, instanceId) {
  return Object.keys(world.projects).sort().find((projectId) => world.projects[projectId].run?.instance === instanceId) ?? null
}

/** Working time left before a room may enter an instance again, in ms; 0 when it may. */
export const cooldownOf = (project, instanceId) => project?.instanceCooldowns?.[instanceId] ?? 0

/**
 * Why a room cannot enter an instance at a tier, or null when it can.
 *
 * @param {object} save
 * @param {{ projectId: string, instanceId: string, tier: number, rematch?: number }} entry a rematch
 *   (instance-rematch.mjs) plays at its own tier, so `tier` is then not read
 * @param {import('./instance-content.mjs').InstanceIndex | null} index
 * @returns {string | null}
 */
export function enterProblem(save, { projectId, instanceId, tier, rematch }, index) {
  if (!index) return INSTANCE_REFUSALS.noInstances
  const instance = index.byId.get(instanceId)
  if (!instance) return INSTANCE_REFUSALS.unknownInstance
  const worldId = worldIdOf(save, projectId)
  const world = worldId === null ? null : save.worlds[worldId]
  const project = world?.projects[projectId]
  if (!project) return INSTANCE_REFUSALS.notPlaying
  if (project.run) return INSTANCE_REFUSALS.inside
  const open = openness(world, instance, index)
  if (!open.open) return open.reason
  if (rematch !== undefined) {
    const problem = rematchProblem(progressOf(world, instanceId), instance, rematch, worldLevel(world.skills))
    if (problem) return problem
  } else if (!Number.isInteger(tier) || tier < 1 || tier > highestTier(world, instanceId)) return INSTANCE_REFUSALS.tier
  if (roomInside(world, instanceId)) return INSTANCE_REFUSALS.taken
  if (Object.keys(project.characters).length === 0) return INSTANCE_REFUSALS.noCharacters
  if (cooldownOf(project, instanceId) > 0) return INSTANCE_REFUSALS.cooldown
  return null
}

/** The run's first room, with the room's wave kept to come back to. */
function startedRun(project, { instanceId, tier, attempt, rematch }) {
  return {
    instance: instanceId,
    tier,
    ...(rematch ? { rematch } : {}),
    attempt,
    room: 0,
    fight: 0,
    tries: 0,
    tryTicks: 0,
    waitTicks: 0,
    ticks: 0,
    boon: null,
    offered: null,
    found: { materials: {}, coins: 0, legendary: [], kills: 0 },
    frozen: {
      wave: project.wave,
      waveKills: project.waveKills,
      monster: project.monster,
      fightTicks: project.fightTicks,
      fightRested: project.fightRested
    }
  }
}

/**
 * The room enters an instance at a tier: its wave is frozen, its rest is over and its first
 * monster waits for its party's first working tick. The same save when refused (enterProblem).
 *
 * @param {object} save
 * @param {{ projectId: string, instanceId: string, tier: number }} entry
 * @param {import('./instance-content.mjs').InstanceIndex | null} index
 * @returns {object}
 */
export function enterInstance(save, entry, index) {
  if (enterProblem(save, entry, index)) return save
  const worldId = worldIdOf(save, entry.projectId)
  const world = save.worlds[worldId]
  const project = world.projects[entry.projectId]
  const progress = progressOf(world, entry.instanceId)
  const tier = entry.rematch !== undefined ? rematchTier(entry.rematch) : entry.tier
  const run = startedRun(project, { instanceId: entry.instanceId, tier, attempt: progress.runs, rematch: entry.rematch })
  const inside = { ...project, run, monster: null, restTicks: 0, fightTicks: 0, fightRested: false }
  const instances = { ...world.instances, [entry.instanceId]: { ...progress, runs: progress.runs + 1 } }
  return { ...save, worlds: { ...save.worlds, [worldId]: { ...withProjectIn(world, entry.projectId, inside), instances } } }
}

/**
 * The project back on its waves: the frozen wave, its kills and its monster as they were. A run that
 * did not clear leaves the instance on a cooldown for this room.
 *
 * @param {object} project
 * @param {{ cleared: boolean }} outcome
 * @returns {object}
 */
export function leaveInstance(project, { cleared }) {
  const { run, ...rest } = project
  if (!run) return project
  const back = { ...rest, ...run.frozen, restTicks: 0 }
  if (cleared) return back
  return { ...back, instanceCooldowns: { ...project.instanceCooldowns, [run.instance]: INSTANCE_COOLDOWN_MS } }
}

/**
 * The room's working time on its waves counts down its cooldowns; one that ends is forgotten.
 *
 * @param {object} project
 * @param {number} ms working time fought
 * @returns {object}
 */
export function coolDown(project, ms) {
  if (!project.instanceCooldowns || ms <= 0) return project
  const left = Object.entries(project.instanceCooldowns)
    .map(([id, value]) => [id, value - ms]).filter(([, value]) => value > 0)
  const { instanceCooldowns: _ended, ...rest } = project
  return left.length ? { ...rest, instanceCooldowns: Object.fromEntries(left) } : rest
}

/**
 * The project and its world after its run is recalled by hand: it ends as a failed run does,
 * keeping what was found. The same save when the room is not inside.
 *
 * @param {object} save
 * @param {{ projectId: string }} which
 * @returns {object}
 */
export function recallParty(save, { projectId }) {
  const worldId = worldIdOf(save, projectId)
  const world = worldId === null ? null : save.worlds[worldId]
  const project = world?.projects[projectId]
  if (!project?.run) return save
  return { ...save, worlds: { ...save.worlds, [worldId]: withProjectIn(world, projectId, leaveInstance(project, { cleared: false })) } }
}

/**
 * Why a boon cannot be chosen now, or null.
 *
 * @param {object} save
 * @param {{ projectId: string, boonId: string }} choice
 * @param {import('./instance-content.mjs').InstanceIndex | null} index
 */
export function boonProblem(save, { projectId, boonId }, index) {
  const worldId = worldIdOf(save, projectId)
  const run = worldId === null ? null : save.worlds[worldId]?.projects[projectId]?.run
  if (!index || !run) return INSTANCE_REFUSALS.notInside
  if (!run.offered || run.boon) return INSTANCE_REFUSALS.notAtVault
  return run.offered.includes(boonId) ? null : INSTANCE_REFUSALS.unknownBoon
}

/**
 * The run with a boon taken: it lasts the rest of the run, and the party moves on to the boss. A
 * boon that gives stamina back gives it now.
 *
 * @param {object} project inside an instance, at the vault
 * @param {string} boonId one of the offered
 * @param {import('./instance-content.mjs').InstanceIndex} index
 * @returns {object}
 */
export function withBoon(project, boonId, index) {
  const bonuses = runBonuses(index.boonById.get(boonId), null)
  const stamina = Math.min(1, project.stamina + bonuses.staminaNow)
  const run = { ...project.run, boon: boonId, offered: null, room: project.run.room + 1, fight: 0, tries: 0, tryTicks: 0, waitTicks: 0 }
  return { ...project, stamina, run }
}

/**
 * The project with a boon chosen; the same save when refused (boonProblem).
 *
 * @param {object} save
 * @param {{ projectId: string, boonId: string }} choice
 * @param {import('./instance-content.mjs').InstanceIndex | null} index
 */
export function chooseBoon(save, choice, index) {
  if (boonProblem(save, choice, index)) return save
  const worldId = worldIdOf(save, choice.projectId)
  const world = save.worlds[worldId]
  const project = withBoon(world.projects[choice.projectId], choice.boonId, index)
  return { ...save, worlds: { ...save.worlds, [worldId]: withProjectIn(world, choice.projectId, project) } }
}

/**
 * The run's content: its instance, the room it is in, and what its boon and its tier's modifier do.
 *
 * @param {object} run
 * @param {import('./instance-content.mjs').InstanceIndex} index
 */
export function runContext(run, index) {
  const instance = index.byId.get(run.instance)
  const modifier = modifierAt(instance, run.tier, index)
  const boon = run.boon ? index.boonById.get(run.boon) ?? null : null
  return { instance, room: instance.rooms[run.room], modifier, boon, bonuses: { ...runBonuses(boon, modifier), ...rematchBonuses(run), ...regionBonuses(index, run.instance) } }
}

/** Whether a room's kind is fought. */
export const isFightRoom = (kind) => FIGHT_ROOMS.includes(kind)
