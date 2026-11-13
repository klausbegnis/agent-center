// Plays a year of made-up usage through the real game engine and prints how levels, waves,
// fights, materials and upgrades progress, then a balance check against the design targets.
// Deterministic: every "random" choice is a hash. Run it with `npm run simulate`.
import { readFileSync } from 'node:fs'
import { createEngine } from '../src/game/engine.mjs'
import { chanceOf, hashOf } from '../src/game/hash.mjs'
import { effectiveGearLevel, referenceGearLevel } from '../src/game/items.mjs'
import { effectiveLevel, worldLevel } from '../src/game/progression.mjs'
import { GATHERING_SKILLS, WORK_SKILLS } from '../src/game/skills.mjs'
import { GROUP_UPGRADE_IDS } from '../src/game/spending.mjs'
import { emptySave } from '../src/game/worlds.mjs'
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

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('../game/monsters.json'),
  items: readJson('../game/items.json'),
  races: readJson('../game/races.json'),
  bosses: readJson('../game/bosses.json')
}
const engine = createEngine({ content })

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
  const { save, events } = engine.advanceWithEvents(run.save, { from, to, sessions: readings })
  run.save = save
  const killMaterials = sumOf(events.map((event) => materialTotal(event.materials)))
  for (const event of events) run.period.kills.push(event)
  run.dayKills += events.length
  run.period.killMaterials += killMaterials
  run.period.gathered += materialTotal(run.save.worlds.main?.materials) - before - killMaterials
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
    run.save = engine.closeSession(run.save, { projectId: session.projectId, sessionId: session.id, now })
    run.serial += 1
    const next = openSession(run.scenario, slot, run.serial)
    next.startsAt = now + STEP * (hashOf(`${next.id}|gap`) % 6)
    run.slots[slot] = next
  })
}

/** One working step: tokens for the working sessions, then the engine's advance. */
function playStep(run, from, to) {
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
      run.save = engine.applyTokens(run.save, { projectId, sessionId, tokens, activity, now: from, themeId })
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
    run.save = engine.prestige(run.save, { worldId: 'main', skillId })
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
  const spent = engine.autoSpendWithPurchases(run.save)
  run.save = spent.save
  run.period.purchases += spent.purchases.length
  prestigeAll(run, day)
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
    shares: sharesOf(world, projects, level)
  }
}

function closePeriod(run, day) {
  run.rows.push(snapshot(run, day))
  for (const event of run.period.kills) run.allKills.push(event)
  run.totals.killMaterials += run.period.killMaterials
  run.totals.gathered += run.period.gathered
  run.period = newPeriod()
}

function simulate(scenario) {
  const run = {
    scenario,
    save: emptySave(),
    slots: Array.from({ length: scenario.concurrent }, (_, slot) => openSession(scenario, slot, slot)),
    serial: scenario.concurrent,
    period: newPeriod(),
    milestones: {},
    firstPrestige: null,
    daysWithoutKill: 0,
    rows: [],
    allKills: [],
    totals: { killMaterials: 0, gathered: 0 }
  }
  for (let day = 0; day < DAYS; day++) {
    if (isWorkday(day)) playWorkday(run, day)
    else advanceAndCount(run, day * DAY, (day + 1) * DAY, idleReadings(run))
    trackMilestones(run, day)
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
    ['day', 'materials', 'buys/day', 'camp/bench/rune', 'gear', 'ref gear', 'gathered', 'world', 'gear %',
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
}

const started = Date.now()
const runs = SCENARIOS.map(simulate)
for (const run of runs) printScenario(run)
printBalanceCheck(runs, engine, tokensPerWorkingHour)
const seconds = fixed((Date.now() - started) / 1000)
console.log(`\nSimulated ${DAYS} days of ${runs.length} scenarios in ${seconds} s.`)
console.log('Skills show level*stars. Waves are per project. Ticks: the median fight, in ticks of ten ' +
  'seconds. Rested: fights with a rest. Fighting: share of working hours a party fought. Gear: mean ' +
  'effective level of the weapons in use. The last three columns split a typical hit between world, ' +
  'gear and character.')
