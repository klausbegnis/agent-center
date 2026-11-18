// Plays a year of made-up usage through the real game engine and prints how levels, waves,
// fights, materials and upgrades progress, then a balance check against the design targets.
// Deterministic: every "random" choice is a hash. Run it with `npm run simulate`.
import { readFileSync } from 'node:fs'
import { bestiaryIndexOf } from '../src/game/bestiary-content.mjs'
import { createEngine } from '../src/game/engine.mjs'
import { chanceOf, hashOf } from '../src/game/hash.mjs'
import { effectiveGearLevel, referenceGearLevel } from '../src/game/items.mjs'
import { effectiveLevel, worldLevel } from '../src/game/progression.mjs'
import { GATHERING_SKILLS, WORK_SKILLS } from '../src/game/skills.mjs'
import { settlementIndexOf } from '../src/game/settlement-content.mjs'
import { stageIndexOf, totalLevels } from '../src/game/settlement.mjs'
import { GROUP_UPGRADE_IDS } from '../src/game/spending.mjs'
import { emptySave } from '../src/game/worlds.mjs'
import { noteWeek, printWeekly } from './event-balance.mjs'
import { funnelGear } from './funnel-policy.mjs'
import { enterHighestInstance, rememberRun } from './instance-policy.mjs'
import { collectionChecks, newInstanceStats, noteInstanceEvents, printInstances } from './instance-balance.mjs'
import { visitMarket } from './market-policy.mjs'
import { printCityRanks, trackCityRanks } from './city-rank-balance.mjs'
import {
  fixed,
  hitShares,
  meanOf,
  median,
  percent,
  printBalanceCheck,
  printTable,
  sumOf
} from './game-balance.mjs'
import { bestiaryGain, bestiaryProgress, levelUpsIn } from './bestiary-balance.mjs'
import { legendaryGain } from './legendary-balance.mjs'
import { printTraits, traitProgress, visitBroker } from './trait-balance.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('../game/monsters.json'),
  items: readJson('../game/items.json'),
  races: readJson('../game/races.json'),
  bosses: readJson('../game/bosses.json'),
  cities: readJson('../game/cities.json'),
  legendary: readJson('../game/legendary.json'),
  bestiary: readJson('../game/bestiary.json'),
  settlement: readJson('../game/settlement.json'),
  instances: readJson('../game/instances.json'),
  traits: readJson('../game/traits.json'),
  events: readJson('../game/events.json')
}
const engine = createEngine({ content })
/**
 * The same content without the bestiary, and without legendary loot either: the fixed parties of
 * the balance check are measured on them, and the scenarios are played again without the bestiary
 * to measure what it adds.
 */
const { bestiary: _bestiary, ...legendaryContent } = content
const legendaryEngine = createEngine({ content: legendaryContent })
const { legendary: _legendary, ...plainContent } = legendaryContent
const plainEngine = createEngine({ content: plainContent })

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const STEP_MINUTES = 10
const STEP = STEP_MINUTES * MINUTE
/** Working hours: 9 to 12 and 13 to 18, Monday to Friday; day 0 is a Monday. */
const WORK_BLOCKS = [[9, 12], [13, 18]]
const WORK_HOURS_PER_DAY = 8
const DAYS = 365
const CHECKPOINTS = [1, 3, 7, 14, 30, 60, 90, 180, 365]
const PROJECTS = ['rumble-banana', 'turbo-waffle', 'cosmic-llama']
const THEMES = [null, 'pixel-dark', 'guild-hall']
/** Below this world level a hit is almost all character, and its split says nothing. */
const MIN_SHARE_LEVEL = 10

const SCENARIOS = [
  { id: 'light', tokensPerDay: 3_000_000, concurrent: 1, projects: 1, sessionWorkHours: 16 },
  { id: 'medium', tokensPerDay: 20_000_000, concurrent: 3, projects: 2, sessionWorkHours: 8 },
  { id: 'heavy', tokensPerDay: 100_000_000, concurrent: 6, projects: 3, sessionWorkHours: 4 }
]

/**
 * How a session spends its time: its activity mix, how much more or less than average it
 * works, and how often it waits for a person.
 */
const PROFILES = [
  {
    id: 'builder', workScale: 1.1, wait: 0.06,
    mix: { write: 0.45, read: 0.2, run: 0.2, think: 0.1, delegate: 0.05 }
  },
  {
    id: 'researcher', workScale: 1, wait: 0.08,
    mix: { read: 0.4, think: 0.3, write: 0.1, run: 0.15, delegate: 0.05 }
  },
  {
    id: 'lead', workScale: 0.9, wait: 0.1,
    mix: { delegate: 0.3, think: 0.2, read: 0.2, write: 0.2, run: 0.1 }
  }
]
/**
 * Tokens an agent spends per minute while it works, whatever the scenario: a light user works
 * fewer minutes, not slower ones. A session that would need more than MAX_WORK_SHARE of the
 * day works faster instead.
 */
const WORKING_TOKENS_PER_MINUTE = 25_000
const MAX_WORK_SHARE = 0.85

const isWorkday = (day) => day % 7 < 5
const legendaryKind = (id) => content.legendary.legendary.find((entry) => entry.id === id)?.kind
/** What a room owns of legendary loot: relics, boss-owned items, and all of it. */
const legendaryCounts = (project) => {
  const relics = project.legendary?.relics ?? []
  const equipment = project.chest.filter((item) => item.legendary).length
  return {
    relics: relics.length,
    bossItems: relics.filter((id) => legendaryKind(id) === 'boss-relic').length + equipment,
    total: relics.length + equipment
  }
}
const materialTotal = (materials) => sumOf(Object.values(materials ?? {}))
const workIntervals = (day) =>
  WORK_BLOCKS.map(([start, end]) => [day * DAY + start * HOUR, day * DAY + end * HOUR])

/** The share of the working day a scenario's session needs to spend its tokens at the usual rate. */
const neededWorkShare = (scenario) =>
  scenario.tokensPerDay / scenario.concurrent / (WORKING_TOKENS_PER_MINUTE * WORK_HOURS_PER_DAY * 60)

/** Tokens a session spends per hour of an agent working. */
function tokensPerWorkingHour(scenario) {
  const workHours = Math.min(MAX_WORK_SHARE, neededWorkShare(scenario)) * WORK_HOURS_PER_DAY
  return scenario.tokensPerDay / scenario.concurrent / workHours
}

function weightedPick(weights, roll) {
  const entries = Object.entries(weights)
  let left = roll * sumOf(entries.map(([, weight]) => weight))
  for (const [key, weight] of entries) {
    if (left < weight) return key
    left -= weight
  }
  return entries.at(-1)[0]
}

/** A new session for a slot: its id, project, profile, pace and how many working hours it lives. */
function openSession(scenario, slot, serial) {
  const id = `${scenario.id}-${slot}-${serial}`
  const profile = PROFILES[hashOf(`${id}|profile`) % PROFILES.length]
  return {
    id,
    projectId: PROJECTS[slot % scenario.projects],
    themeId: THEMES[slot % scenario.projects],
    profile,
    workShare: Math.min(MAX_WORK_SHARE, neededWorkShare(scenario) * profile.workScale),
    tokensPerStep: (tokensPerWorkingHour(scenario) * STEP_MINUTES) / 60,
    workMsLeft: scenario.sessionWorkHours * HOUR * (0.6 + 0.8 * chanceOf(`${id}|life`)),
    startsAt: 0
  }
}

/** One step's state of a session, by hash. */
function stateOf(session, stepKey) {
  const roll = chanceOf(`${session.id}|${stepKey}|state`)
  if (roll < session.workShare) return 'working'
  if (roll < session.workShare + session.profile.wait) return 'waiting'
  return 'idle'
}

const newPeriod = () => ({
  kills: [], retiredLevels: [], purchases: 0, workdays: 0, killMaterials: 0, gathered: 0, fightHours: 0
})

/** Advances the engine and counts kills, kill materials and gathered materials. */
function advanceAndCount(run, from, to, readings) {
  const before = materialTotal(run.save.worlds.main?.materials)
  const advanced = run.engine.advanceWithEvents(run.save, { from, to, sessions: readings, autoPlay: Boolean(run.instances) })
  run.save = advanced.save
  // A run's steps are events too (instance policy); the rest of the simulator counts kills.
  const events = advanced.events.filter((event) => event.type === 'kill')
  if (run.instances) noteInstanceEvents(run, advanced.events, { day: Math.floor(to / DAY), remember: rememberRun })
  const killMaterials = sumOf(events.map((event) => materialTotal(event.materials)))
  for (const event of events) run.period.kills.push(event)
  run.dayKills += events.length
  trackLevelUps(run, to, levelUpsIn(events))
  run.period.killMaterials += killMaterials
  run.period.gathered += materialTotal(run.save.worlds.main?.materials) - before - killMaterials
}

/**
 * The bestiary's pace: mastery levels each day, and when the first came, in days and in hours of
 * fighting since the start.
 */
function trackLevelUps(run, to, count) {
  if (count === 0) return
  const day = Math.floor(to / DAY)
  run.levelUps[day] = (run.levelUps[day] ?? 0) + count
  run.firstLevelUp ??= { day: day + 1, fightHours: run.totalFightHours + run.period.fightHours }
}

/** Adds the time each project's party fought: someone working and nobody waiting. */
function countFightTime(run, readings, duration) {
  for (const projectId of new Set(readings.map((reading) => reading.projectId))) {
    const own = readings.filter((reading) => reading.projectId === projectId)
    const working = own.some((reading) => reading.state === 'working')
    if (working && !own.some((reading) => reading.state === 'waiting')) {
      run.period.fightHours += duration / HOUR
      run.dayFightHours += duration / HOUR
    }
  }
}

/** Closes the sessions whose working life is over and opens the next ones a little later. */
function closeFinished(run, now) {
  run.slots.forEach((session, slot) => {
    if (session.workMsLeft > 0) return
    const character = run.save.worlds.main?.projects[session.projectId]?.characters[session.id]
    if (character) run.period.retiredLevels.push(character.level)
    run.save = run.engine.closeSession(run.save, { projectId: session.projectId, sessionId: session.id, now })
    run.serial += 1
    const next = openSession(run.scenario, slot, run.serial)
    next.startsAt = now + STEP * (hashOf(`${next.id}|gap`) % 6)
    run.slots[slot] = next
  })
}

/** One working step: tokens for the working sessions, then the engine's advance. */
function playStep(run, from, to) {
  if (run.instances) run.save = enterHighestInstance(run.engine, run.save, run.instances.memory)
  const stepKey = `${from}`
  const readings = []
  for (const session of run.slots) {
    if (session.startsAt > from) continue
    const { id: sessionId, projectId, themeId } = session
    const state = stateOf(session, stepKey)
    let tokensPerMinute = 0
    if (state === 'working') {
      const tokens = Math.round(session.tokensPerStep * (0.5 + chanceOf(`${sessionId}|${stepKey}|tokens`)))
      const activity = weightedPick(session.profile.mix, chanceOf(`${sessionId}|${stepKey}|activity`))
      run.save = run.engine.applyTokens(run.save, { projectId, sessionId, tokens, activity, now: from, themeId })
      tokensPerMinute = tokens / STEP_MINUTES
      session.workMsLeft -= STEP
    }
    readings.push({ projectId, sessionId, state, tokensPerMinute, themeId })
  }
  countFightTime(run, readings, to - from)
  advanceAndCount(run, from, to, readings)
  closeFinished(run, to)
}

/** The idle readings of every open session, for nights, lunch and weekends. */
const idleReadings = (run) => run.slots.map((session) => ({
  projectId: session.projectId, sessionId: session.id, state: 'idle', themeId: session.themeId
}))

/** Prestiges every capped skill, as a person would when the game offers it. */
function prestigeAll(run, day) {
  for (const skillId of [...WORK_SKILLS, ...GATHERING_SKILLS]) {
    const before = run.save
    run.save = run.engine.prestige(run.save, { worldId: 'main', skillId })
    const prestiged = run.save !== before
    if (prestiged && WORK_SKILLS.includes(skillId) && run.firstPrestige === null) run.firstPrestige = day + 1
  }
}

function playWorkday(run, day) {
  run.period.workdays += 1
  run.dayKills = 0
  run.dayFightHours = 0
  let clock = day * DAY
  for (const [start, end] of workIntervals(day)) {
    advanceAndCount(run, clock, start, idleReadings(run))
    for (let from = start; from < end; from += STEP) playStep(run, from, from + STEP)
    clock = end
  }
  advanceAndCount(run, clock, (day + 1) * DAY, idleReadings(run))
  if (run.dayFightHours > 1 && run.dayKills === 0) run.daysWithoutKill += 1
  const spent = run.engine.autoSpendWithPurchases(run.save)
  run.save = spent.save
  run.period.purchases += spent.purchases.length
  if (run.trades) tradeAtMarket(run)
  if (run.traitBroker) run.save = visitBroker(run.engine, run.save, run.traitBroker, content)
  if (run.funnel) {
    const funnelled = funnelGear(run.engine, run.save)
    run.save = funnelled.save
    run.funnelled.items += funnelled.items
    run.funnelled.relics += funnelled.relics
  }
  prestigeAll(run, day)
}

/** The market policy's visit: what it bought counts as purchases, like autoSpend's. */
function tradeAtMarket(run) {
  const before = upgradeLevels(run.save)
  const visited = { cities: content.cities.cities, items: content.items, legendary: content.legendary, settlement: content.settlement }
  run.save = visitMarket(run.engine, run.save, visited, run.market)
  run.period.purchases += upgradeLevels(run.save) - before
}

/** Every upgrade level bought in the world: items' levels and group upgrades. */
function upgradeLevels(save) {
  const world = save.worlds.main
  if (!world) return 0
  const items = Object.values(world.projects).flatMap((project) => project.chest).reduce((sum, item) => sum + item.level, 0)
  return items + sumOf(Object.values(world.upgrades))
}

/** The day the first race that comes up as often as any reached its last powered level. */
function trackLastPowered(run, day) {
  if (run.lastPoweredDay !== null || !run.save.worlds.main?.bestiary) return
  const index = bestiaryIndexOf(content)
  if (!index) return
  if (bestiaryProgress(run.save.worlds.main, content).common >= index.levels) run.lastPoweredDay = day + 1
}

/** The day each room first owned a relic and a boss-owned item. */
function trackLegendary(run, day) {
  for (const [projectId, project] of Object.entries(run.save.worlds.main?.projects ?? {})) {
    const counts = legendaryCounts(project)
    const firsts = (run.legendaryFirsts[projectId] ??= { relic: null, bossItem: null })
    if (counts.relics > 0 && firsts.relic === null) firsts.relic = day + 1
    if (counts.bossItems > 0 && firsts.bossItem === null) firsts.bossItem = day + 1
  }
}

/** The day each stage of the settlement was first reached. */
function trackStages(run, day) {
  const index = settlementIndexOf(content)
  const world = run.save.worlds.main
  if (!index || !world) return
  const stage = stageIndexOf(index, totalLevels(world.upgrades))
  for (let at = 1; at <= stage; at++) run.stageDays[at] ??= day + 1
}

/** Days at which the most used work skill reached the milestones. */
function trackMilestones(run, day) {
  const skills = run.save.worlds.main?.skills ?? {}
  const levels = WORK_SKILLS.map((skillId) => (skills[skillId] ? effectiveLevel(skills[skillId]) : 1))
  const top = Math.max(...levels)
  for (const milestone of [10, 30, 60]) {
    if (top >= milestone && run.milestones[milestone] === undefined) run.milestones[milestone] = day + 1
  }
}

/** The world, gear and character split of a hit, averaged over the projects. */
function sharesOf(world, projects, level) {
  const shares = projects.map((project) => hitShares(world, project)).filter(Boolean)
  if (shares.length === 0 || level < MIN_SHARE_LEVEL) return null
  return [0, 1, 2].map((index) => meanOf(shares.map((share) => share[index])))
}

/** One checkpoint's row of numbers. */
function snapshot(run, day) {
  const world = run.save.worlds.main
  const level = worldLevel(world.skills)
  const projects = Object.keys(world.projects).sort().map((id) => world.projects[id])
  const { kills, workdays } = run.period
  const isWeaponInUse = (item) => item.slot === 'weapon' && item.heldBy
  const weapons = projects.flatMap((project) => project.chest.filter(isWeaponInUse))
  const income = run.period.killMaterials + run.period.gathered
  return {
    day,
    skills: WORK_SKILLS.map((skillId) => world.skills[skillId] ?? { level: 1, stars: 0 }),
    level,
    retired: median(run.period.retiredLevels),
    waves: projects.map((project) => project.wave),
    medianTicks: median(kills.map((event) => event.ticks)),
    restShare: kills.length ? kills.filter((event) => event.rested).length / kills.length : null,
    killsPerHour: kills.length / Math.max(1, run.period.fightHours),
    fightShare: run.period.fightHours / Math.max(1, workdays * WORK_HOURS_PER_DAY * run.scenario.projects),
    materials: materialTotal(world.materials),
    purchasesPerDay: run.period.purchases / Math.max(1, workdays),
    groups: GROUP_UPGRADE_IDS.map((id) => world.upgrades[id] ?? 0),
    gear: meanOf(weapons.map(effectiveGearLevel)) ?? 0,
    referenceGear: referenceGearLevel(level),
    gatherShare: income > 0 ? run.period.gathered / income : 0,
    shares: sharesOf(world, projects, level),
    legendary: projects.map((project) => legendaryCounts(project).total),
    bestiary: bestiaryProgress(world, content),
    traits: traitProgress(world, content)
  }
}

function closePeriod(run, day) {
  run.totalFightHours += run.period.fightHours
  run.rows.push(snapshot(run, day))
  for (const event of run.period.kills) run.allKills.push(event)
  run.totals.killMaterials += run.period.killMaterials
  run.totals.gathered += run.period.gathered
  run.period = newPeriod()
}

/**
 * @param {object} scenario
 * @param {{ trades?: boolean, funnel?: boolean, instances?: boolean, traits?: boolean, withEngine?: object }} [policy]
 *   `trades` adds a visit to the market every working day; `funnel` sends every spare piece of gear
 *   into one room every working day; `instances` runs the highest open instance whenever one is
 *   available; `traits` adds a visit to the trait brokers (trait-balance.mjs); `withEngine` plays on
 *   another engine than the full one
 */
function simulate(scenario, { trades = false, funnel = false, instances = false, traits = false, withEngine = engine } = {}) {
  const run = {
    traitBroker: traits ? { bought: 0, spent: 0, taught: 0 } : null,
    scenario,
    instances: instances ? newInstanceStats(content.instances, content.legendary) : null,
    trades,
    funnel,
    funnelled: { items: 0, relics: 0 },
    engine: withEngine,
    market: { trades: 0, gear: 0, earned: 0, relics: 0 },
    save: emptySave(),
    slots: Array.from({ length: scenario.concurrent }, (_, slot) => openSession(scenario, slot, slot)),
    serial: scenario.concurrent,
    period: newPeriod(),
    milestones: {},
    levelUps: [],
    firstLevelUp: null,
    lastPoweredDay: null,
    totalFightHours: 0,
    legendaryFirsts: {},
    firstPrestige: null,
    stageDays: {},
    daysWithoutKill: 0,
    rows: [],
    allKills: [],
    totals: { killMaterials: 0, gathered: 0 }
  }
  for (let day = 0; day < DAYS; day++) {
    if (isWorkday(day)) playWorkday(run, day)
    else advanceAndCount(run, day * DAY, (day + 1) * DAY, idleReadings(run))
    trackMilestones(run, day)
    trackLegendary(run, day)
    trackLastPowered(run, day)
    trackStages(run, day)
    noteWeek(run)
    if (trades) trackCityRanks(run, day, content.cities.cities)
    if (CHECKPOINTS.includes(day + 1)) closePeriod(run, day + 1)
  }
  return run
}

const compact = (value) => {
  if (value < 1e4) return String(Math.round(value))
  if (value >= 1e15) return value.toExponential(1)
  const units = [['T', 1e12], ['G', 1e9], ['M', 1e6], ['k', 1e3]]
  const [suffix, size] = units.find(([, unit]) => value >= unit)
  return `${(value / size).toFixed(1)}${suffix}`
}
const skillText = (skill) => (skill.stars ? `${skill.level}*${skill.stars}` : `${skill.level}`)

function printScenario(run) {
  const { scenario } = run
  console.log(`\n## ${scenario.id}: ${compact(scenario.tokensPerDay)} tokens a working day, ` +
    `${scenario.concurrent} session(s) at a time over ${scenario.projects} project(s)\n`)
  printTable(
    ['day', ...WORK_SKILLS, 'world', 'waves', 'retired lvl', 'ticks', 'rested', 'fighting', 'kills/h'],
    run.rows.map((row) => [
      row.day, ...row.skills.map(skillText), row.level, row.waves.join('/'), row.retired ?? '-',
      row.medianTicks ?? '-', percent(row.restShare), percent(row.fightShare), fixed(row.killsPerHour)
    ])
  )
  console.log('')
  printTable(
    ['day', 'materials', 'buys/day', 'buildings', 'gear', 'ref gear', 'gathered', 'world', 'gear %',
      'char %'],
    run.rows.map((row) => [
      row.day, compact(row.materials), fixed(row.purchasesPerDay), row.groups.join('/'), fixed(row.gear),
      fixed(row.referenceGear), percent(row.gatherShare), percent(row.shares?.[0]), percent(row.shares?.[1]),
      percent(row.shares?.[2])
    ])
  )
  const milestone = (level) => run.milestones[level] ?? '-'
  console.log(`\nMost used skill: 10 on day ${milestone(10)}, 30 on day ${milestone(30)}, ` +
    `60 on day ${milestone(60)}, first prestige on day ${run.firstPrestige ?? `> ${DAYS}`}.`)
  console.log(`Legendary items owned per room: ${legendaryPace(run)}.`)
}

/** What each room owns of legendary loot at day 30, 90 and 365, and when it got its first ones. */
function legendaryPace(run) {
  const owned = (day) => run.rows.find((row) => row.day === day)?.legendary.join('/') ?? '-'
  const firsts = Object.keys(run.legendaryFirsts).sort().map((projectId) => {
    const { relic, bossItem } = run.legendaryFirsts[projectId]
    return `${projectId} day ${relic ?? '-'} / ${bossItem ?? '-'}`
  })
  return `${owned(30)} at day 30, ${owned(90)} at day 90, ${owned(365)} at day 365 ` +
    `(of ${content.legendary.legendary.length}); first relic / boss-owned item: ${firsts.join(', ')}`
}

/** The same scenarios with and without a visit to the market every working day. */
function printMarketComparison(plainRuns, tradingRuns) {
  console.log('\n## Market: no market against a daily visit (trade for what is short, buy stall gear, sell surplus)\n')
  const rows = []
  plainRuns.forEach((plain, index) => {
    const trading = tradingRuns[index]
    for (const day of [30, 90, 180, 365]) {
      const without = plain.rows.find((row) => row.day === day)
      const withMarket = trading.rows.find((row) => row.day === day)
      rows.push([plain.scenario.id, day, fixed(without.killsPerHour), fixed(withMarket.killsPerHour), fixed(without.gear),
        fixed(withMarket.gear), percent(withMarket.gear / Math.max(without.gear, 1e-9) - 1), fixed(without.purchasesPerDay),
        fixed(withMarket.purchasesPerDay), withMarket.level])
    }
  })
  printTable(['scenario', 'day', 'kills/h', 'market', 'gear', 'market', 'gear +', 'buys/day', 'market', 'world'], rows)
  for (const run of tradingRuns) {
    console.log(`${run.scenario.id}: ${run.market.trades} trades, ${run.market.gear} stall pieces, ` +
      `${run.market.relics} stall relics, ` +
      `${compact(run.market.earned)} coins from sales in a year, ${run.market.coinLevels ?? 0} building levels paid half in ` +
      `coins (${compact(run.market.coinsOnBuildings ?? 0)} coins). Legendary items owned per room: ${legendaryPace(run)}.`)
  }
}

/**
 * The scenarios with more than one room, played as usual and with all spare gear funnelled into the
 * first room: whether moving gear between rooms makes any room fight far above its world.
 */
function printFunnelComparison(plainRuns, funnelRuns) {
  console.log('\n## Sending gear: as usual against every spare item and relic sent to the first room daily\n')
  const rows = []
  plainRuns.forEach((plain, index) => {
    const funnel = funnelRuns[index]
    for (const day of [30, 90, 180, 365]) {
      const without = plain.rows.find((row) => row.day === day)
      const sent = funnel.rows.find((row) => row.day === day)
      rows.push([plain.scenario.id, day, without.level, sent.level, without.waves.join('/'), sent.waves.join('/'),
        without.medianTicks ?? '-', sent.medianTicks ?? '-', fixed(without.killsPerHour), fixed(sent.killsPerHour),
        fixed(without.gear), fixed(sent.gear), fixed(without.purchasesPerDay), fixed(sent.purchasesPerDay)])
    }
  })
  printTable(['scenario', 'day', 'world', 'funnel', 'waves', 'funnel', 'ticks', 'funnel', 'kills/h', 'funnel', 'gear',
    'funnel', 'buys/day', 'funnel'], rows)
  for (const run of funnelRuns) {
    console.log(`${run.scenario.id}: ${run.funnelled.items} items and ${run.funnelled.relics} relics sent in a year.`)
  }
}

/** Mastery levels a day, on average, over working days `from` to `to` (0-based, `to` excluded). */
function levelUpsPerWorkday(run, from, to) {
  let levels = 0
  let workdays = 0
  for (let day = from; day < to; day++) {
    levels += run.levelUps[day] ?? 0
    if (isWorkday(day)) workdays += 1
  }
  return levels / Math.max(1, workdays)
}

/** What each scenario's bestiary reached, its pace, and what it adds to kills per hour. */
function printBestiary(runs, plainRuns) {
  console.log('\n## Bestiary: races met, mastery, ranks and bosses; kills per hour without and with it\n')
  const rows = []
  runs.forEach((run, at) => {
    for (const day of [1, 7, 30, 90, 180, 365]) {
      const row = run.rows.find((each) => each.day === day)
      const without = plainRuns[at].rows.find((each) => each.day === day)
      const { discovered, levels, lowest, highest, prestige, perks, bosses, hunter, rank, meanRaceDamage } = row.bestiary
      rows.push([run.scenario.id, day, `${discovered}/20`, levels, `${lowest}-${highest}`, prestige, perks, rank,
        `${bosses}/55`, hunter, percent(meanRaceDamage), fixed(without.killsPerHour), fixed(row.killsPerHour),
        percent(row.killsPerHour / without.killsPerHour - 1)])
    }
  })
  printTable(['scenario', 'day', 'races', 'levels', 'low-high', 'prestige', 'perks', 'rank', 'bosses', 'hunter',
    'race dmg', 'kills/h', 'bestiary', 'gain'], rows)
  console.log('Levels: mastery levels in all. Low-high: the lowest and highest race. Prestige: races past their ' +
    'powered levels. Perks: races with a perk. Rank: the hunter rank. Race dmg: the damage bonus against a race, ' +
    'averaged over all twenty.\n')
  printTable(['scenario', 'first level', 'levels/day week 1', 'month 1', 'month 6', 'last powered level'],
    runs.map((run) => [run.scenario.id,
      run.firstLevelUp ? `day ${run.firstLevelUp.day}, ${fixed(run.firstLevelUp.fightHours * 60)} min of fighting` : '-',
      fixed(levelUpsPerWorkday(run, 0, 7)), fixed(levelUpsPerWorkday(run, 0, 30)), fixed(levelUpsPerWorkday(run, 150, 180)),
      run.lastPoweredDay ? `day ${run.lastPoweredDay}` : `> ${DAYS}`]))
  console.log('Levels/day: mastery levels anywhere in the bestiary per working day. Last powered level: the day ' +
    'the first race that comes up as often as any reaches it.')
}

/** The bestiary's balance targets: what it adds in the scenarios at a year, and when maxed. */
function bestiaryChecks(runs, plainRuns, bestRelics) {
  const yearly = runs.map((run, at) => {
    const gain = run.rows.at(-1).killsPerHour / plainRuns[at].rows.at(-1).killsPerHour - 1
    return [`${run.scenario.id}: the bestiary adds at most about 10% kills per hour at a year`, gain <= 0.1,
      `${percent(gain)} (${fixed(plainRuns[at].rows.at(-1).killsPerHour)} to ${fixed(run.rows.at(-1).killsPerHour)})`]
  })
  const engines = { plain: plainEngine, legendary: legendaryEngine, loaded: engine, content }
  const maxed = [10, 60, 150].map((level) => {
    const { base, kills, gain } = bestiaryGain(engines, level, bestRelics.get(level))
    return [`level ${level}: a whole bestiary adds at most about 10% to the legendary set`, gain <= 0.11,
      `+${percent(gain)} kills (${base} to ${kills})`]
  })
  return [...yearly, ...maxed]
}

/** The day each scenario reached each stage of the settlement, without and with the market. */
function printSettlement(runs, tradingRuns) {
  const stages = content.settlement.stages
  console.log('\n## Settlement: the day each stage is first reached (calendar days), without and with the market\n')
  const rows = []
  runs.forEach((run, at) => {
    for (const [policy, each] of [['plain', run], ['market', tradingRuns[at]]]) {
      const world = each.save.worlds.main
      rows.push([run.scenario.id, policy, ...stages.slice(1).map((_, stage) => each.stageDays[stage + 1] ?? '-'),
        totalLevels(world.upgrades), GROUP_UPGRADE_IDS.map((id) => world.upgrades[id] ?? 0).join('/')])
    }
  })
  printTable(['scenario', 'policy', ...stages.slice(1).map((stage) => stage.name.toLowerCase()), 'levels at 365', 'buildings'],
    rows)
  console.log(`Buildings: ${GROUP_UPGRADE_IDS.join('/')} at day 365. Thresholds: ` +
    `${stages.map((stage) => `${stage.name} ${stage.from}`).join(', ')} building levels.`)
}

/** The settlement's pace targets, from the scenarios that never trade. */
function settlementChecks(runs) {
  const byId = Object.fromEntries(runs.map((run) => [run.scenario.id, run]))
  const day = (id, stage) => byId[id].stageDays[content.settlement.stages.findIndex((entry) => entry.id === stage)]
  const shown = (value) => (value ? `day ${value}` : `after day ${DAYS}`)
  return [
    // A light user pays for nothing before about its third week; the owner accepted that pace.
    ['light: the Outpost within the first three weeks', day('light', 'outpost') <= 21, shown(day('light', 'outpost'))],
    ['light: the Hamlet in the first month', day('light', 'hamlet') <= 31, shown(day('light', 'hamlet'))],
    ['medium: the Village by about month two', day('medium', 'village') <= 75, shown(day('medium', 'village'))],
    ['medium: the Town by about month six', day('medium', 'town') <= 200, shown(day('medium', 'town'))],
    ['heavy: the Citadel after a year or more', !(day('heavy', 'citadel') < 330), shown(day('heavy', 'citadel'))]
  ]
}

const started = Date.now()
const runs = SCENARIOS.map((scenario) => simulate(scenario))
for (const run of runs) printScenario(run)
const plainRuns = SCENARIOS.map((scenario) => simulate(scenario, { withEngine: legendaryEngine }))
printBestiary(runs, plainRuns)
const bestRelics = new Map()
const legendary = {
  measure: (level) => {
    const gain = legendaryGain({ plain: plainEngine, loaded: legendaryEngine, content }, level)
    bestRelics.set(level, gain.best.relicId)
    return gain
  }
}
const instanceRuns = SCENARIOS.map((scenario) => simulate(scenario, { instances: true }))
printBalanceCheck(runs, plainEngine, tokensPerWorkingHour, legendary, () => [...bestiaryChecks(runs, plainRuns, bestRelics),
  ...settlementChecks(runs), ...collectionChecks(instanceRuns, content.legendary.legendary.length)])
const tradingRuns = SCENARIOS.map((scenario) => simulate(scenario, { trades: true }))
printMarketComparison(runs, tradingRuns)
printSettlement(runs, tradingRuns)
printWeekly(runs, content.events)
printCityRanks(tradingRuns, content.cities.cities)
const shared = SCENARIOS.filter((scenario) => scenario.projects > 1)
printFunnelComparison(runs.filter((run) => run.scenario.projects > 1), shared.map((scenario) => simulate(scenario, { funnel: true })))
printInstances(runs, instanceRuns, { content, legendaryKind })
printTraits(runs, SCENARIOS.map((scenario) => simulate(scenario, { trades: true, traits: true })), content)
const seconds = fixed((Date.now() - started) / 1000)
console.log(`\nSimulated ${DAYS} days of ${runs.length} scenarios in ${seconds} s.`)
console.log('Skills show level*stars. Waves are per project. Ticks: the median fight, in ticks of ten ' +
  'seconds. Rested: fights with a rest. Fighting: share of working hours a party fought. Gear: mean ' +
  'effective level of the weapons in use. The last three columns split a typical hit between world, ' +
  'gear and character.')
