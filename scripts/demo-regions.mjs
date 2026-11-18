// The demo's road further on, for INSTANCE_ROAD: `cleared` shows the first region done, with rematch
// tier badges on its sites and a rematch ready. The state goes in as an imported save would, after
// demo-instances.mjs has set the world up.
import { readFileSync } from 'node:fs'

const readInstances = () => JSON.parse(readFileSync(new URL('../game/instances.json', import.meta.url), 'utf8'))

/** The best rematch shown on each site of the first region, in road order. */
const REMATCHES = [4, 3, 2, 1, 1, 0]
/** Skills at this level open every rematch shown and the next one of the crypt. */
const CLEARED_SKILL_LEVEL = 58
const WORK_SKILLS = ['forge', 'lore', 'engineering', 'arcana', 'command']

/** The world's skills raised to a level, never lowered. */
function raiseSkills(world, level) {
  for (const id of WORK_SKILLS) {
    const skill = world.skills[id] ?? { level: 1, xp: 0, banked: 0, stars: 0 }
    world.skills[id] = { ...skill, level: Math.max(skill.level, level) }
  }
}

/** Every instance of the first region cleared, with the rematches of REMATCHES. */
function clearFirstRegion(world, data) {
  const first = data.instances.filter((entry) => !entry.region)
  world.instances = { ...world.instances }
  first.forEach((entry, at) => {
    const rematch = REMATCHES[at] ?? 0
    world.instances[entry.id] = { runs: 6 + rematch, clears: 4 + rematch, bestTier: 3, ...(rematch ? { rematch } : {}) }
  })
}

/** The rooms leave the runs the vault demo put them in, back on their waves. */
function leaveRuns(world) {
  for (const project of Object.values(world.projects)) {
    if (!project.run) continue
    project.monster = project.run.frozen.monster
    delete project.run
  }
}

/**
 * Moves the demo's world along the road.
 *
 * @param {object} game the demo's game mode
 * @param {'cleared'} road
 */
export async function showDemoRoad(game, road) {
  if (road !== 'cleared') return
  const file = await game.exportSave()
  const world = file.save.worlds.main
  const data = readInstances()
  leaveRuns(world)
  raiseSkills(world, CLEARED_SKILL_LEVEL)
  clearFirstRegion(world, data)
  await game.importSave(file)
  await game.round()
}
