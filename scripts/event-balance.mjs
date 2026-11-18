// Weekly events in the simulator: what each scenario's world made of its weeks (the event, how far
// its goal came, whether it was reached), printed by `npm run simulate`.
import { percent, printTable } from './game-balance.mjs'

/**
 * Remembers the world's week as it stands: called once a simulated day, the last call of a week
 * holds what that week ended with.
 *
 * @param {{ save: object, weeks?: Map<string, object> }} run
 */
export function noteWeek(run) {
  const weekly = run.save.worlds.main?.weekly
  if (!weekly) return
  run.weeks ??= new Map()
  run.weeks.set(weekly.week, { event: weekly.event, progress: weekly.progress, done: weekly.done })
}

/**
 * Prints, per scenario, how many weeks reached their goal, in all and by kind of goal.
 *
 * @param {object[]} runs
 * @param {{ events: { id: string, goal: { kind: string } }[] }} data the parsed game/events.json
 */
export function printWeekly(runs, data) {
  console.log('\n## Weekly events: the goals reached\n')
  const kindOf = new Map(data.events.map((event) => [event.id, event.goal.kind]))
  const kinds = [...new Set(data.events.map((event) => event.goal.kind))]
  const rows = runs.map((run) => {
    const weeks = [...(run.weeks ?? new Map()).values()]
    const share = (list) => (list.length ? `${percent(list.filter((week) => week.done).length / list.length)} of ${list.length}` : '-')
    return [run.scenario.id, share(weeks), ...kinds.map((kind) => share(weeks.filter((week) => kindOf.get(week.event) === kind)))]
  })
  printTable(['scenario', 'all weeks', ...kinds.map((kind) => `goal: ${kind}`)], rows)
  console.log('A week counts once it has begun; the first and last weeks of the year are partly played.')
}
