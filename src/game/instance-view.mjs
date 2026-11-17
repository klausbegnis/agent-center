// Instances as a UI draws them, worked out from the save and the content: the world's roadmap (which
// picture of the road, each instance's state, who is inside, what each room may enter) and a room's
// run (where it is, how it goes, its boon, its tier's modifier). No rule of the game is needed to
// read it. Pure.
import { INSTANCE_TRIES, INSTANCE_VAULT_WAIT_TICKS } from './instance-constants.mjs'
import { TICK_SECONDS } from './constants.mjs'
import { instanceIndexOf } from './instance-content.mjs'
import { roomTimeLimit } from './instance-fight.mjs'
import { fightsIn, runLevel } from './instance-monsters.mjs'
import { cooldownOf, enterProblem, highestTier, openness, progressOf, roomInside, runContext } from './instance-run.mjs'
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
  return open.reason === 'the road to it is not cleared yet' ? 'hidden' : 'locked'
}

/** Why each room of the world cannot enter the instance at its first tier, or null when it can. */
function entriesOf(worldId, world, instance, index) {
  const save = { worlds: { [worldId]: world }, projectWorld: Object.fromEntries(Object.keys(world.projects).map((id) => [id, worldId])) }
  return Object.fromEntries(Object.keys(world.projects).sort()
    .map((projectId) => [projectId, enterProblem(save, { projectId, instanceId: instance.id, tier: 1 }, index)]))
}

function instanceView(worldId, world, instance, { index, owned }) {
  const progress = progressOf(world, instance.id)
  const inside = roomInside(world, instance.id)
  return {
    id: instance.id,
    state: stateOf(world, instance, index),
    runs: progress.runs,
    clears: progress.clears,
    bestTier: progress.bestTier,
    highestTier: highestTier(world, instance.id),
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
  const cleared = list.filter((entry) => entry.clears > 0).length
  const map = [...index.region.maps].reverse().find((each) => each.cleared <= cleared) ?? index.region.maps[0]
  return { map: { ...map }, cleared, total: list.length, complete: cleared === list.length, list }
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
  const { region } = index
  return {
    region: { id: region.id, name: region.name, title: region.title, width: region.map.width, height: region.map.height },
    instances: index.instances.map((instance) => ({
      id: instance.id,
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

