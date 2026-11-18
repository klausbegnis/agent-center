// Instances as a UI draws them, worked out from the save and the content: the world's roadmap (which
// picture of the road, each instance's state, who is inside, what each room may enter) and a room's
// run (where it is, how it goes, its boon, its tier's modifier). No rule of the game is needed to
// read it. Pure.
import { INSTANCE_TRIES, INSTANCE_VAULT_WAIT_TICKS } from './instance-constants.mjs'
import { TICK_SECONDS } from './constants.mjs'
import { instanceIndexOf } from './instance-content.mjs'
import { roomTimeLimit } from './instance-fight.mjs'
import { fightsIn, runLevel } from './instance-monsters.mjs'
import { isRegionComplete, isRegionUnlocked, regionOfInstance } from './instance-regions.mjs'
import { REMATCH_TIERS, bestRematch, rematchOpensAt, rematchTier } from './instance-rematch.mjs'
import { INSTANCE_REFUSALS, cooldownOf, enterProblem, highestTier, openness, progressOf, roomInside, runContext } from './instance-run.mjs'
import { worldLevel } from './progression.mjs'

const MS_PER_TICK = TICK_SECONDS * 1000
const named = (entry) => (entry ? { id: entry.id, name: entry.name, effect: { ...entry.effect } } : null)

/**
 * An instance's state on the road: `hidden` under fog until the one before it is cleared, `locked`
 * until the world's level, then `open`, or `inside` while a room runs it.
 */
function stateOf(world, instance, index) {
  const open = openness(world, instance, index)
  if (roomInside(world, instance.id)) return 'inside'
  if (open.open) return 'open'
  return open.reason === INSTANCE_REFUSALS.closed || open.reason === INSTANCE_REFUSALS.regionLocked ? 'hidden' : 'locked'
}

/**
 * Why each room of the world cannot enter the instance at its first tier (or, with `rematch`, go for
 * that rematch), or null when it can.
 */
function entriesOf(worldId, world, instance, index, rematch) {
  const save = { worlds: { [worldId]: world }, projectWorld: Object.fromEntries(Object.keys(world.projects).map((id) => [id, worldId])) }
  const entry = rematch ? { instanceId: instance.id, tier: 1, rematch } : { instanceId: instance.id, tier: 1 }
  return Object.fromEntries(Object.keys(world.projects).sort()
    .map((projectId) => [projectId, enterProblem(save, { ...entry, projectId }, index)]))
}

/**
 * The next rematch of a beaten instance (instance-rematch.mjs): its number, tier, the world level it
 * opens at and why each room cannot go; null before the boss is beaten or past Rematch X.
 */
function nextRematchOf(worldId, world, instance, index, progress) {
  const rematch = bestRematch(progress) + 1
  if (progress.clears === 0 || rematch > REMATCH_TIERS) return null
  return {
    rematch,
    tier: rematchTier(rematch),
    opensAt: rematchOpensAt(instance, rematch),
    entry: entriesOf(worldId, world, instance, index, rematch)
  }
}

function instanceView(worldId, world, instance, { index, owned }) {
  const progress = progressOf(world, instance.id)
  const inside = roomInside(world, instance.id)
  const state = stateOf(world, instance, index)
  const region = regionOfInstance(index, instance.id)?.id ?? null
  // Under fog an instance shows nothing but its place: it sends no progress and no entries, so the
  // view stays small with a whole region locked.
  if (state === 'hidden') return { id: instance.id, region, state, clears: progress.clears }
  return {
    id: instance.id,
    region,
    state,
    runs: progress.runs,
    clears: progress.clears,
    bestTier: progress.bestTier,
    highestTier: highestTier(world, instance.id),
    rematch: bestRematch(progress),
    nextRematch: nextRematchOf(worldId, world, instance, index, progress),
    relic: instance.relic,
    relicFound: owned.has(instance.relic),
    roomInside: inside,
    roomIndex: inside ? world.projects[inside].run.room : null,
    entry: entriesOf(worldId, world, instance, index)
  }
}

/**
 * A world's place on the road, or null when the content has no instances: which picture of the
 * roadmap, and each instance's state, progress, who is inside and what each room may enter.
 *
 * @param {string} worldId
 * @param {object} world
 * @param {object} content
 */
export function worldInstancesView(worldId, world, content) {
  const index = instanceIndexOf(content)
  if (!index) return null
  const owned = new Set(Object.values(world.projects).flatMap((project) => project.legendary?.relics ?? []))
  const list = index.instances.map((instance) => instanceView(worldId, world, instance, { index, owned }))
  const regions = index.regions.map((region) => regionView(world, region, index, list))
  // The first region's place stays at the top, as before regions.
  const { map, cleared, total, complete } = regions[0]
  return { map, cleared, total, complete, list, regions }
}

/** A region's place on the road: open or not, the picture for its progress, its cleared count. */
function regionView(world, region, index, list) {
  const cleared = list.filter((entry) => region.instanceIds.includes(entry.id) && entry.clears > 0).length
  const map = [...region.maps].reverse().find((each) => each.cleared <= cleared) ?? region.maps[0]
  return {
    id: region.id,
    unlocked: isRegionUnlocked(world, region, index),
    map: { ...map },
    cleared,
    total: region.instanceIds.length,
    complete: isRegionComplete(world, region)
  }
}

/**
 * The content's instances as a UI draws them, the same for every world: the region, and each
 * instance's names, races, art, place on the map, rooms, relic, boss, elite and its rotation of
 * tier modifiers (by id, each worded once in `modifiers`). Null without instances.
 *
 * @param {object} content
 */
export function instancesContentView(content) {
  const index = instanceIndexOf(content)
  if (!index) return null
  const regionOf = (region) => ({
    id: region.id, name: region.name, title: region.title, width: region.map.width, height: region.map.height, after: region.after
  })
  return {
    region: regionOf(index.regions[0]),
    // Every region in road order, the first included; `after` names the region that unlocks it.
    regions: index.regions.map(regionOf),
    instances: index.instances.map((instance) => ({
      id: instance.id,
      region: regionOfInstance(index, instance.id).id,
      name: instance.name,
      races: [...instance.races],
      opensAt: instance.opensAt,
      map: { ...instance.map },
      banner: instance.banner,
      card: instance.card,
      alt: instance.alt,
      ...(instance.route ? { route: { ...instance.route } } : {}),
      relic: instance.relic,
      // Their names are the bestiary's (game.bestiary.bosses).
      boss: instance.boss,
      elite: instance.elite,
      rooms: instance.rooms.map((room) => ({ kind: room.kind, name: room.name, ...(room.check ? { check: { ...room.check } } : {}) })),
      rotation: [...instance.modifiers]
    })),
    modifiers: Object.fromEntries([...index.modifierById].map(([id, modifier]) => [id, { name: modifier.name, effect: { ...modifier.effect } }]))
  }
}

/**
 * A room's run as a UI draws it, or null when the room is on its waves.
 *
 * @param {string} worldId
 * @param {string} projectId
 * @param {object} project
 * @param {object} world
 * @param {object} content
 */
export function runView(worldId, projectId, project, world, content) {
  const index = instanceIndexOf(content)
  const run = project.run
  if (!index || !run || !index.byId.has(run.instance)) return null
  const { instance, room, modifier, boon, bonuses } = runContext(run, index)
  const fights = fightsIn(room.kind, bonuses)
  const limit = fights > 0 ? roomTimeLimit({ worldId, projectId, index }, run) : 0
  const atVault = room.kind === 'vault' && run.offered !== null
  return {
    instance: instance.id,
    name: instance.name,
    tier: run.tier,
    rematch: run.rematch ?? null,
    level: runLevel(worldLevel(world.skills), run.tier),
    room: run.room,
    roomName: room.name,
    roomKind: room.kind,
    fight: run.fight,
    fights,
    progress: Math.min(1, (run.room + (fights ? run.fight / fights : 0)) / instance.rooms.length),
    triesLeft: Math.max(0, INSTANCE_TRIES + bonuses.tries - run.tries),
    timeShare: limit ? Math.min(1, run.tryTicks / limit) : 0,
    workedMs: run.ticks * MS_PER_TICK,
    boon: named(boon),
    offered: atVault ? run.offered.map((id) => named(index.boonById.get(id))) : null,
    vaultWaitMs: atVault ? Math.max(0, INSTANCE_VAULT_WAIT_TICKS - run.waitTicks) * MS_PER_TICK : null,
    modifier: named(modifier),
    found: {
      materials: { ...run.found.materials }, coins: run.found.coins, legendary: [...run.found.legendary], kills: run.found.kills
    }
  }
}

/**
 * Working time left on a room's cooldowns, by instance, in ms; null when there is none.
 *
 * @param {object} project
 */
export function cooldownsView(project) {
  const ids = Object.keys(project.instanceCooldowns ?? {})
  return ids.length ? Object.fromEntries(ids.map((id) => [id, cooldownOf(project, id)])) : null
}

