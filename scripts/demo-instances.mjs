// The demo's instances: the frozen demo shows the roadmap with the Sunken Crypt cleared, a room in
// Emberdeep Foundry facing its boss with a boon, and the rest closed; INSTANCE_VAULT=1 puts another
// room in the Sunken Crypt's vault at tier 2, so the boon choice, the route's picture and a tier's
// modifier can be seen. The state goes in as an imported save would, the runs as the engine keeps
// them, already walked to their room.
import { readFileSync } from 'node:fs'
import { indexInstances } from '../src/game/instance-content.mjs'
import { boonsOffered } from '../src/game/instance-fight.mjs'

const instances = () => indexInstances(JSON.parse(readFileSync(new URL('../game/instances.json', import.meta.url), 'utf8')))

/** The room that cleared the Sunken Crypt and now fights in Emberdeep Foundry. */
const RUN_ROOM = 'local:/work/rumble-banana'
/** The room the vault scenario puts in the Sunken Crypt's vault. */
const VAULT_ROOM = 'local:/work/cosmic-llama'
/** Skills at this level open the foundry (World Lv 10) and leave the hive (16) locked. */
const DEMO_SKILL_LEVEL = 12
const WORK_SKILLS = ['forge', 'lore', 'engineering', 'arcana', 'command']
/** The run's room indexes: the boss, the vault. */
const BOSS_ROOM = 5
const VAULT_ROOM_INDEX = 4

/** A run as the engine keeps it, walked to a room, its wave the project's own. */
function runAt(project, { instance, tier, room, boon = null, offered = null, ticks }) {
  return {
    instance, tier, attempt: 1, room, fight: 0, tries: 0, tryTicks: 0, waitTicks: 0, ticks, boon, offered,
    found: { materials: {}, coins: 0, legendary: [], kills: room + 2 },
    frozen: { wave: project.wave, waveKills: project.waveKills, monster: project.monster, fightTicks: 0, fightRested: false }
  }
}

/**
 * Gives the demo's world its instances, then a round with the clock where it is.
 *
 * @param {object} game the demo's game mode
 * @param {{ vault?: boolean }} [options] `vault`: another room waits in the Sunken Crypt's vault
 */
export async function showDemoInstances(game, { vault = false } = {}) {
  const file = await game.exportSave()
  const world = file.save.worlds.main
  for (const id of WORK_SKILLS) {
    const skill = world.skills[id] ?? { level: 1, xp: 0, banked: 0, stars: 0 }
    world.skills[id] = { ...skill, level: Math.max(skill.level, DEMO_SKILL_LEVEL) }
  }
  world.instances = {
    'sunken-crypt': { runs: 3, clears: 2, bestTier: 1 },
    'emberdeep-foundry': { runs: 1, clears: 0, bestTier: 0 }
  }
  const runner = world.projects[RUN_ROOM]
  if (runner) {
    const legendary = runner.legendary ?? { relics: [], active: null, relicPity: 0, bossPity: 0 }
    if (!legendary.relics.includes('tidewake-bell')) legendary.relics = [...legendary.relics, 'tidewake-bell']
    runner.legendary = { ...legendary, active: legendary.active ?? 'tidewake-bell' }
    runner.run = runAt(runner, { instance: 'emberdeep-foundry', tier: 1, room: BOSS_ROOM, boon: 'whetted-blades', ticks: 260 })
    runner.monster = null
  }
  const waiting = world.projects[VAULT_ROOM]
  if (vault && waiting) {
    const run = runAt(waiting, { instance: 'sunken-crypt', tier: 2, room: VAULT_ROOM_INDEX, ticks: 180 })
    run.offered = boonsOffered(instances(), `main|${VAULT_ROOM}|sunken-crypt|demo`)
    world.instances['sunken-crypt'].runs += 1
    waiting.run = run
    waiting.monster = null
  }
  await game.importSave(file)
  await game.round()
}
