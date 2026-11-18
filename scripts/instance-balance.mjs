// Instances in the simulator: the instance policy's runs counted as they end (clears, failures,
// tiers, time inside, what they paid), and the comparison with the same scenarios played on waves
// alone. Run by `npm run simulate`.
import { TICK_SECONDS } from '../src/game/constants.mjs'
import { fixed, percent, printTable, sumOf } from './game-balance.mjs'

const HOUR_MS = 3_600_000
const materialTotal = (materials) => sumOf(Object.values(materials ?? {}))

/**
 * What the instance policy keeps and counts during a run of the simulator.
 *
 * @param {{ instances: { id: string, boss: string, elite: string }[] }} data the parsed game/instances.json
 * @param {{ legendary: { id: string, kind: string, boss?: string }[] }} [legendary] the parsed
 *   game/legendary.json, to tell where each item a run finds came from
 */
export function newInstanceStats(data, legendary = { legendary: [] }) {
  const guardians = new Set(data.instances.flatMap((entry) => [entry.boss, entry.elite]))
  return {
    kinds: new Map(legendary.legendary.map((entry) => [entry.id, entry.kind])),
    guardianItems: new Set(legendary.legendary.filter((entry) => guardians.has(entry.boss)).map((entry) => entry.id)),
    memory: { order: data.instances.map((entry) => entry.id), tiers: {}, rematchRetry: {} },
    names: Object.fromEntries(data.instances.map((entry) => [entry.id, entry.name])),
    cleared: 0,
    failed: 0,
    failedTiers: [],
    firstClear: {},
    bestTier: {},
    ticksInside: 0,
    insideMaterials: 0,
    insideKillMaterials: 0,
    insideCoins: 0,
    rewards: [],
    /** Legendary items gained in a year, by where they came from: waves' bosses, or a run's relic, boss and vault. */
    sources: { waves: 0, relic: 0, boss: 0, vault: 0 },
    // Rematches (instance-rematch.mjs): clears, failures and the best one per instance.
    rematchCleared: 0,
    rematchFailed: 0,
    bestRematch: {},
    rematchDay: {}
  }
}

/**
 * Counts an advance's run events and remembers each run's end for the policy's next tier.
 *
 * @param {object} run the simulator's run, with `instances` from newInstanceStats
 * @param {object[]} events every event of the advance
 * @param {{ day: number, remember: (memory: object, event: object) => void }} context
 */
export function noteInstanceEvents(run, events, { day, remember }) {
  const stats = run.instances
  for (const event of events) {
    if (event.type === 'kill' && event.instance) stats.insideKillMaterials += materialTotal(event.materials)
    if (event.type === 'kill' && !event.instance) stats.sources.waves += event.legendary?.length ?? 0
    if (event.type === 'instance' && (event.kind === 'cleared' || event.kind === 'failed')) {
      for (const id of event.found.legendary) stats.sources[sourceOf(id, stats)] += 1
    }
    if (event.type !== 'instance' || (event.kind !== 'cleared' && event.kind !== 'failed')) continue
    stats.ticksInside += event.ticks
    stats.insideMaterials += materialTotal(event.found.materials)
    stats.insideCoins += event.found.coins
    if (event.rematch) {
      if (event.kind === 'cleared') {
        stats.rematchCleared += 1
        stats.bestRematch[event.instance] = Math.max(stats.bestRematch[event.instance] ?? 0, event.rematch)
        stats.rematchDay[event.rematch] ??= day + 1
      } else {
        stats.rematchFailed += 1
      }
    }
    if (event.kind === 'cleared') {
      stats.cleared += 1
      stats.firstClear[event.instance] ??= day + 1
      if (!event.rematch) stats.bestTier[event.instance] = Math.max(stats.bestTier[event.instance] ?? 0, event.tier)
      stats.rewards.push(...(event.drops ?? []).map((drop) => drop.id))
    } else {
      stats.failed += 1
      stats.failedTiers.push(event.tier)
    }
    remember(stats.memory, event)
  }
}

/** Where an item a run found came from: the instance's relic, an instance boss's own item, or the vault. */
function sourceOf(id, stats) {
  if (stats.kinds.get(id) === 'instance-relic') return 'relic'
  return stats.guardianItems.has(id) ? 'boss' : 'vault'
}

const hoursOfTicks = (ticks) => (ticks * TICK_SECONDS * 1000) / HOUR_MS

/** Materials per hour of fighting: inside the runs, and on the waves of the same scenario. */
function pay(run, plain) {
  const stats = run.instances
  const insideHours = hoursOfTicks(stats.ticksInside)
  const fightHours = run.totalFightHours
  const waveHours = Math.max(1, fightHours - insideHours)
  const waveMaterials = run.totals.killMaterials - stats.insideKillMaterials
  return {
    insideShare: insideHours / Math.max(1, fightHours),
    inside: stats.insideMaterials / Math.max(1, insideHours),
    waves: waveMaterials / waveHours,
    plainWaves: plain.totals.killMaterials / Math.max(1, plain.totalFightHours),
    coins: stats.insideCoins / Math.max(1, insideHours)
  }
}

/**
 * Prints the instance policy against the plain one: when each instance is first cleared, how
 * often runs fail, what an hour inside pays against an hour on the waves, the collection pace and
 * the kills per hour.
 *
 * @param {object[]} plainRuns the scenarios as usual
 * @param {object[]} instanceRuns the same with the instance policy
 * @param {{ content: object, legendaryKind: (id: string) => string | undefined }} context
 */
export function printInstances(plainRuns, instanceRuns, { content }) {
  console.log('\n## Instances: running the highest open instance whenever one is available\n')
  // The first region's instances; the regions after it are printRegions'.
  const ids = content.instances.instances.filter((entry) => !entry.region).map((entry) => entry.id)
  printTable(['scenario', ...ids.map((id) => id.split('-').at(-1)), 'title'], instanceRuns.map((run) => [
    run.scenario.id,
    ...ids.map((id) => (run.instances.firstClear[id] ? `day ${run.instances.firstClear[id]}` : '-')),
    ids.every((id) => run.instances.firstClear[id]) ? `day ${Math.max(...ids.map((id) => run.instances.firstClear[id]))}` : '-'
  ]))
  console.log('The day each instance is first cleared (calendar days); title: all six cleared.\n')
  const rows = instanceRuns.map((run, at) => {
    const stats = run.instances
    const runs = stats.cleared + stats.failed
    const money = pay(run, plainRuns[at])
    const tiers = ids.map((id) => stats.bestTier[id] ?? '-').join('/')
    return [run.scenario.id, runs, stats.cleared, percent(stats.failed / Math.max(1, runs)), tiers, percent(money.insideShare),
      fixed(money.inside), fixed(money.waves), fixed(money.plainWaves), fixed(money.coins)]
  })
  printTable(['scenario', 'runs', 'clears', 'failed', 'best tiers', 'time inside', 'mat/h inside', 'mat/h waves',
    'mat/h plain', 'coins/h inside'], rows)
  console.log('Mat/h: materials per hour of fighting, inside the runs (kills, checks, vault and purse), on the ' +
    'waves of the same scenario, and on the waves of the plain scenario.\n')
  const legendaryAt = (run, day) => run.rows.find((row) => row.day === day)?.legendary.join('/') ?? '-'
  const killsAt = (run, day) => fixed(run.rows.find((row) => row.day === day)?.killsPerHour ?? 0)
  const pace = []
  instanceRuns.forEach((run, at) => {
    const plain = plainRuns[at]
    for (const day of [30, 90, 365]) {
      pace.push([run.scenario.id, day, plain.rows.find((row) => row.day === day)?.level, run.rows.find((row) => row.day === day)?.level,
        legendaryAt(plain, day), legendaryAt(run, day), killsAt(plain, day), killsAt(run, day)])
    }
  })
  printTable(['scenario', 'day', 'world', 'with', 'legendary', 'with', 'kills/h', 'with'], pace)
  console.log('Legendary: items owned per room (of all the content has). Kills/h: kills per hour of fighting ' +
    'in the period up to that day, runs included.')
  const sources = instanceRuns.map((run) => `${run.scenario.id} ${Object.entries(run.instances.sources)
    .map(([source, count]) => `${count} ${source}`).join(', ')}`)
  console.log(`Legendary items gained in a year by source (all rooms): ${sources.join('; ')}. Waves: a wave boss's ` +
    'drop; relic: an instance\'s first clear; boss: a run\'s boss or elite item; vault: the vault.')
  console.log('')
  printRematches(instanceRuns, ids)
  printRegions(instanceRuns, content.instances)
}

/** The rematch ladder: how many were won and lost, the best per instance, and when I, V and X came. */
function printRematches(instanceRuns, ids) {
  const firstDay = (stats, rematch) => {
    const days = Object.entries(stats.rematchDay).filter(([at]) => Number(at) >= rematch).map(([, day]) => day)
    return days.length ? `day ${Math.min(...days)}` : '-'
  }
  printTable(['scenario', 'won', 'lost', 'best rematch', 'first I', 'first V', 'first X'], instanceRuns.map((run) => {
    const stats = run.instances
    return [run.scenario.id, stats.rematchCleared, stats.rematchFailed, ids.map((id) => stats.bestRematch[id] ?? '-').join('/'),
      firstDay(stats, 1), firstDay(stats, 5), firstDay(stats, 10)]
  }))
  console.log('Rematches (I to X) of beaten bosses: runs won and lost, the best per instance in road order, and the ' +
    'day the first rematch of at least I, V and X was won.')
}


/** The mean of a room's legendary items at a day of a run. */
const ownedAt = (run, day) => {
  const owned = run.rows.find((row) => row.day === day)?.legendary ?? []
  return owned.reduce((sum, count) => sum + count, 0) / Math.max(1, owned.length)
}

/**
 * The collection's pace targets, from the instance policy's runs (the player who collects most
 * without trading): a goal of several years, whose first piece still comes within weeks.
 *
 * @param {object[]} instanceRuns light, medium and heavy, in that order
 * @param {number} total the legendary items the content has
 * @returns {[string, boolean, string][]}
 */
export function collectionChecks(instanceRuns, total) {
  const byId = Object.fromEntries(instanceRuns.map((run) => [run.scenario.id, run]))
  const year = (id) => ownedAt(byId[id], 365)
  const firstDay = Math.min(...Object.values(byId.light.legendaryFirsts).flatMap((first) => [first.relic ?? Infinity, first.bossItem ?? Infinity]))
  const shown = (id) => `${fixed(year(id))} of ${total} per room`
  const most = Math.max(...byId.heavy.rows.at(-1).legendary)
  return [
    ['light: the first legendary item within the first three weeks', firstDay <= 21, `day ${firstDay}`],
    ['light: about 8 to 12 legendary items in a year', year('light') >= 8 && year('light') <= 12, shown('light')],
    ['medium: about 14 to 22 legendary items in a year', year('medium') >= 14 && year('medium') <= 22, shown('medium')],
    // Not complete before about two years: a year holds at most about three fifths of it.
    ['heavy: the collection is far from complete at a year', most <= Math.round(total * 0.6), `${fixed(year('heavy'))}, at most ${most}, of ${total}`]
  ]
}

/**
 * The regions after the first: the day each opens (the region before it complete), the day each of
 * its instances is first cleared, and how many are cleared in the year.
 */
function printRegions(instanceRuns, data) {
  for (const region of data.regions ?? []) {
    const ids = data.instances.filter((entry) => entry.region === region.id).map((entry) => entry.id)
    const before = data.instances.filter((entry) => (region.after === data.region.id ? !entry.region : entry.region === region.after))
    console.log(`\n## ${region.name}: the second region of the road\n`)
    printTable(['scenario', 'opens', ...ids.map((id) => id.split('-').at(-1)), 'cleared', 'best tiers'], instanceRuns.map((run) => {
      const first = run.instances.firstClear
      const opens = before.every((entry) => first[entry.id]) ? `day ${Math.max(...before.map((entry) => first[entry.id]))}` : '-'
      return [run.scenario.id, opens, ...ids.map((id) => (first[id] ? `day ${first[id]}` : '-')),
        `${ids.filter((id) => first[id]).length} of ${ids.length}`, ids.map((id) => run.instances.bestTier[id] ?? '-').join('/')]
    }))
    console.log(`Opens: the day the region before it is complete. Then the day each of its instances is first cleared ` +
      `(each also waits for its World Lv: ${ids.map((id) => data.instances.find((entry) => entry.id === id).opensAt).join(', ')}).`)
  }
}
