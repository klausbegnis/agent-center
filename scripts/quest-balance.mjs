// Daily quests in the simulator: a player who plays as usual, lets the bridge's chronicle count its
// changes (the journal, achievements and the day's quests, on the simulated day), and does what a
// quest asks that play alone does not: one small sale for a market errand, a run into an open
// instance or rematch for a dungeon quest. Reports the share of played days whose three quests were
// all done, the streaks, and what the quests paid against the materials the world earned. Run by
// `npm run simulate`.
import { instanceIndexOf } from '../src/game/instance-content.mjs'
import { bestRematch, isRematch } from '../src/game/instance-rematch.mjs'
import { isCityOpen } from '../src/game/market.mjs'
import { worldLevel } from '../src/game/progression.mjs'
import { MATERIALS } from '../src/game/skills.mjs'
import { fixed, percent, printTable, sumOf } from './game-balance.mjs'

/** What the quest policy counts in a run. */
export const newQuestStats = () => ({ days: 0, completed: 0, quests: 0, done: 0, paid: 0, best: 0, byKind: {} })

const materialTotal = (materials) => sumOf(Object.values(materials ?? {}))

/**
 * Lets the chronicle count a change, as the bridge does after every change it keeps, and adds what
 * the quests paid in it to the run's count.
 *
 * @param {object} run the simulator's run, with `questStats`
 * @param {{ before: object, midway?: object, events?: object[], at: number, day: number }} change
 */
export function chronicleStep(run, { before, midway, events = [], at, day }) {
  const told = run.engine.chronicle(run.save, { before, midway, events, at, day, isNews: true })
  const was = run.save.worlds.main?.daily
  run.save = told.save
  const now = run.save.worlds.main?.daily
  if (!now) return
  const stats = run.questStats
  for (const [at2, quest] of now.quests.entries()) {
    const old = was?.day === now.day ? was.quests[at2] : null
    if (quest.done && !old?.done) stats.paid += materialTotal(quest.reward)
  }
  if (now.bonus && !(was?.day === now.day && was.bonus)) stats.paid += materialTotal(now.bonusReward)
}

/** The quests of the main world still open today, by kind. */
const openKinds = (save) => new Set((save.worlds.main?.daily?.quests ?? []).filter((quest) => !quest.done).map((quest) => quest.kind))

/**
 * What a quest asks that play alone does not do: a sale of one unit of the world's most plentiful
 * material at an open city, a run into an open instance at tier 1, or the next rematch.
 *
 * @returns {object} the save after it
 */
export function doQuestErrands(engine, save, content) {
  const world = save.worlds.main
  if (!world) return save
  const open = openKinds(save)
  let next = save
  if (open.has('trade')) {
    const city = (content.cities?.cities ?? []).find((entry) => isCityOpen(entry, worldLevel(world.skills)))
    const material = [...MATERIALS].sort((a, b) => (world.materials[b] ?? 0) - (world.materials[a] ?? 0))[0]
    // A tenth of its most plentiful material: a real sale, not a token one.
    const amount = Math.max(1, Math.floor((world.materials[material] ?? 0) / 10))
    if (city && (world.materials[material] ?? 0) > 0) next = engine.sellMaterial(next, { worldId: 'main', cityId: city.id, materialId: material, amount })
  }
  for (const kind of ['instance', 'rematch'].filter((each) => open.has(each))) next = enterFirst(engine, next, content, kind === 'rematch')
  return next
}

function enterFirst(engine, save, content, isRematchRun) {
  const index = instanceIndexOf(content)
  const world = save.worlds.main
  if (!index) return save
  for (const instance of index.instances) {
    const rematch = bestRematch(world.instances?.[instance.id]) + 1
    if (isRematchRun && !isRematch(rematch)) continue
    for (const projectId of Object.keys(world.projects).sort()) {
      const entry = isRematchRun ? { projectId, instanceId: instance.id, rematch } : { projectId, instanceId: instance.id, tier: 1 }
      if (engine.enterProblem(save, entry) === null) return engine.enterInstance(save, entry)
    }
  }
  return save
}

/**
 * Counts a played day's end: whether its three quests were all done.
 *
 * @param {object} run
 * @param {number} day
 */
export function noteQuestDay(run, day) {
  const daily = run.save.worlds.main?.daily
  if (!daily || daily.day !== day) return
  const stats = run.questStats
  stats.days += 1
  if (daily.bonus) stats.completed += 1
  stats.quests += daily.quests.length
  for (const quest of daily.quests) {
    const kind = (stats.byKind[quest.kind] ??= { offered: 0, done: 0 })
    kind.offered += 1
    if (quest.done) kind.done += 1
    if (quest.done) stats.done += 1
  }
  stats.best = Math.max(stats.best, daily.best)
}

/**
 * Prints the quests' table: days completed, quests done, the best streak and what they paid.
 *
 * @param {object[]} runs the quest policy's runs
 */
export function printQuests(runs) {
  console.log('\n## Daily quests: a player who also does the errands quests ask\n')
  printTable(['scenario', 'played days', 'all done', 'quests done', 'best streak', 'paid', 'of income'], runs.map((run) => {
    const stats = run.questStats
    const income = run.totals.killMaterials + run.totals.gathered
    return [run.scenario.id, stats.days, percent(stats.completed / Math.max(1, stats.days)),
      percent(stats.done / Math.max(1, stats.quests)), stats.best, fixed(stats.paid), percent(stats.paid / Math.max(1, income))]
  }))
  const kinds = runs.map((run) => `${run.scenario.id}: ${Object.entries(run.questStats.byKind).sort()
    .map(([kind, { offered, done }]) => `${kind} ${done}/${offered}`).join(', ')}`)
  console.log(`Played days: working days. Quests by kind, done of offered: ${kinds.join('; ')}.`)
}

/**
 * The quests' balance targets: light users finish most played days, and the quests stay a nudge.
 *
 * @param {object[]} runs light, medium and heavy
 */
export function questChecks(runs) {
  return runs.flatMap((run) => {
    const stats = run.questStats
    const share = stats.completed / Math.max(1, stats.days)
    const income = run.totals.killMaterials + run.totals.gathered
    const paid = stats.paid / Math.max(1, income)
    const checks = [[`${run.scenario.id}: daily quests pay a few percent of income`, paid <= 0.06, percent(paid)]]
    if (run.scenario.id === 'light') checks.push(['light: all daily quests done on most played days', share >= 0.6, percent(share)])
    else checks.push([`${run.scenario.id}: all daily quests done on most played days`, share >= 0.6, percent(share)])
    return checks
  })
}
