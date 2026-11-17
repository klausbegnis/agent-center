// The simulator's third policy: a player who funnels every piece of gear into one room. Once a
// working day it sends every free item and every relic that is not active from the world's other
// rooms into the first room, then has that room re-pick its best gear. Uses only what the Chest
// tab offers (sending items and relics, Best gear for everyone).

/**
 * @param {ReturnType<typeof import('../src/game/engine.mjs').createEngine>} engine
 * @param {object} save
 * @returns {{ save: object, items: number, relics: number }} what was sent
 */
export function funnelGear(engine, save) {
  const world = save.worlds.main
  const projectIds = Object.keys(world?.projects ?? {}).sort()
  if (projectIds.length < 2) return { save, items: 0, relics: 0 }
  const [target, ...others] = projectIds
  let next = save
  let items = 0
  let relics = 0
  for (const source of others) {
    const project = next.worlds.main.projects[source]
    for (const item of project.chest.filter((owned) => owned.heldBy === null)) {
      const sending = { fromProjectId: source, toProjectId: target, itemId: item.id }
      if (engine.sendItemProblem(next, sending)) continue
      next = engine.sendItem(next, sending)
      items += 1
    }
    for (const relicId of project.legendary?.relics ?? []) {
      const sending = { fromProjectId: source, toProjectId: target, relicId }
      if (engine.sendRelicProblem(next, sending)) continue
      next = engine.sendRelic(next, sending)
      relics += 1
    }
  }
  next = engine.bestGearForRoom(next, { projectId: target })
  return { save: next, items, relics }
}
