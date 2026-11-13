// What the game simulator measures beyond raw counts, and the balance check that compares a
// year of simulated play with the owner's design targets (docs/GAME.md, "Balance").
import {
  CHARACTER_LEVEL_BASE,
  CHARACTER_LEVEL_EXPONENT,
  REFERENCE_TOKENS_PER_MINUTE,
  SEASONED_LEVEL,
  SKILL_CAP,
  TOKENS_PER_XP
} from '../src/game/constants.mjs'
import { startingAttributes } from '../src/game/characters.mjs'
import { itemFactor, referenceGearLevel } from '../src/game/items.mjs'
import { characterHit, engineeringSpeed, referenceAttributes } from '../src/game/power.mjs'
import { xpToNext } from '../src/game/progression.mjs'
import { WORK_SKILLS } from '../src/game/skills.mjs'
import { emptySave } from '../src/game/worlds.mjs'

const HOUR = 3_600_000
const ACTIVITIES = ['write', 'read', 'run', 'think', 'delegate']

export const sumOf = (values) => values.reduce((sum, value) => sum + value, 0)
export const meanOf = (values) => (values.length ? sumOf(values) / values.length : null)
export const median = (values) => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
const isMissing = (value) => value === null || value === undefined
export const percent = (value) => (isMissing(value) ? '-' : `${Math.round(value * 100)}%`)
export const fixed = (value, digits = 1) => (isMissing(value) ? '-' : value.toFixed(digits))

/** Prints rows under headers, each column right-aligned to its widest cell. */
export function printTable(headers, rows) {
  const widthOf = (index) => Math.max(headers[index].length, ...rows.map((row) => String(row[index]).length))
  const widths = headers.map((_, index) => widthOf(index))
  const line = (cells) => cells.map((cell, index) => String(cell).padStart(widths[index])).join('  ')
  console.log(line(headers))
  console.log(widths.map((width) => '-'.repeat(width)).join('  '))
  for (const row of rows) console.log(line(row))
}

const hitOf = (character, skills, weaponFactor = 1) => characterHit({
  character, skills, weaponFactor, tokensPerMinute: REFERENCE_TOKENS_PER_MINUTE, speed: engineeringSpeed(skills)
}).amount

/**
 * How a project's typical hit splits between the world, the project's gear and the character,
 * on a log scale: the world is a newcomer of this world against one of an untrained world, the
 * character is the real character against that newcomer, and the gear is its weapon's factor.
 *
 * @returns {[number, number, number] | null} world, gear and character shares
 */
export function hitShares(world, project) {
  const shares = []
  for (const character of Object.values(project.characters)) {
    const className = character.class
    const untrained = { class: className, level: 1, attributes: startingAttributes(className, {}) }
    const newcomer = { ...character, level: 1, attributes: startingAttributes(character.class, world.skills) }
    const weapon = project.chest.find((item) => item.id === character.equipment.weapon) ?? null
    const fromWorld = Math.log(hitOf(newcomer, world.skills) / hitOf(untrained, {}))
    const fromCharacter = Math.log(hitOf(character, world.skills) / hitOf(newcomer, world.skills))
    const fromGear = Math.log(itemFactor(weapon))
    const whole = fromWorld + fromCharacter + fromGear
    if (whole > 0) shares.push([fromWorld / whole, fromGear / whole, fromCharacter / whole])
  }
  if (shares.length === 0) return null
  return [0, 1, 2].map((index) => meanOf(shares.map((share) => share[index])))
}

/** A save whose world has every work skill at `level`, with a party of four in `fuzzy-anvil`. */
function trainedParty(engine, level) {
  let save = emptySave()
  const levels = Array.from({ length: Math.min(level, SKILL_CAP) - 1 }, (_, index) => index + 1)
  const xp = sumOf(levels.map(xpToNext))
  for (const activity of ACTIVITIES) {
    const reading = { projectId: 'turbo-waffle', sessionId: `t-${activity}`, activity, now: 0 }
    save = engine.applyTokens(save, { ...reading, tokens: xp * TOKENS_PER_XP })
  }
  for (const [index, sessionId] of ['a', 'b', 'c', 'd'].entries()) {
    const reading = { projectId: 'fuzzy-anvil', sessionId, activity: ACTIVITIES[index], now: 0 }
    save = engine.applyTokens(save, { ...reading, tokens: 2_000_000 })
  }
  const world = save.worlds.main
  const project = world.projects['fuzzy-anvil']
  const chest = project.chest.map((item) => ({ ...item, level: Math.round(referenceGearLevel(level)) }))
  const projects = { ...world.projects, 'fuzzy-anvil': { ...project, chest } }
  return { ...save, worlds: { main: { ...world, projects } } }
}

/**
 * Eight hours of fighting for fixed parties in a trained world with reference gear: the rest
 * share, and the median ticks by kind of monster.
 */
export function compositionCheck(engine, level) {
  const save = trainedParty(engine, level)
  const characters = Object.values(save.worlds.main.projects['fuzzy-anvil'].characters)
  const parties = {
    balanced: null, 'no defender': 'defense', 'no supporter': 'support', 'no magic': 'magical'
  }
  const results = {}
  for (const [name, missing] of Object.entries(parties)) {
    const sessions = characters.filter((character) => character.class !== missing).map((character) => ({
      projectId: 'fuzzy-anvil', sessionId: character.sessionId, state: 'working',
      tokensPerMinute: REFERENCE_TOKENS_PER_MINUTE
    }))
    const { events } = engine.advanceWithEvents(save, { from: 0, to: 8 * HOUR, sessions })
    const ticksOf = (filter) => median(events.filter(filter).map((event) => event.ticks))
    results[name] = {
      rest: events.filter((event) => event.rested).length / events.length,
      common: ticksOf((event) => event.kind === 'common' && !event.affix),
      armored: ticksOf((event) => event.kind === 'armored' && !event.affix),
      elite: ticksOf((event) => event.affix),
      boss: ticksOf((event) => event.kind === 'boss'),
      longest: Math.max(...events.map((event) => event.ticks))
    }
  }
  return results
}

/** Tokens a session needs to reach SEASONED_LEVEL on the character curve. */
export function tokensToSeasoned() {
  let xp = 0
  for (let level = 1; level < SEASONED_LEVEL; level++) {
    xp += Math.round(CHARACTER_LEVEL_BASE * level ** CHARACTER_LEVEL_EXPONENT)
  }
  return xp * TOKENS_PER_XP
}

/** A newcomer's hit against a seasoned reference character of the same world, without gear. */
export function newcomerShare(level) {
  const skill = { level, xp: 0, banked: 0, stars: 0 }
  const skills = Object.fromEntries(WORK_SKILLS.map((skillId) => [skillId, skill]))
  const newcomer = { class: 'physical', level: 1, attributes: startingAttributes('physical', skills) }
  const attributes = referenceAttributes('physical', level)
  const seasoned = { class: 'physical', level: SEASONED_LEVEL, attributes }
  return hitOf(newcomer, skills) / hitOf(seasoned, skills)
}

const between = (value, low, high) => value !== null && value !== undefined && value >= low && value <= high

/** The progression targets, from the milestone days of each scenario. */
function progressionChecks(byId) {
  const { light, medium, heavy } = byId
  const day = (value) => (value === undefined || value === null ? '-' : `day ${value}`)
  return [
    ['medium: most used skill reaches 10 within about a day', between(medium.milestones[10], 1, 3),
      day(medium.milestones[10])],
    ['medium: 30 within about three weeks', between(medium.milestones[30], 7, 28),
      day(medium.milestones[30])],
    ['medium: first prestige in four to six months', between(medium.firstPrestige, 110, 190),
      day(medium.firstPrestige)],
    ['light: slower than medium, a year or more is fine',
      (light.firstPrestige ?? Infinity) > medium.firstPrestige,
      light.firstPrestige ? day(light.firstPrestige) : 'after the year'],
    ['heavy: first prestige in weeks, not days', between(heavy.firstPrestige, 14, 70),
      day(heavy.firstPrestige)]
  ]
}

/** The power targets: the split of a hit, a newcomer's share, how soon a character is seasoned. */
function powerChecks(runs, perHourOf) {
  const results = []
  for (const run of runs) {
    const established = run.rows.filter((row) => row.day >= 90 && row.shares)
    const shareAt = (index) => meanOf(established.map((row) => row.shares[index]))
    const [world, gear, own] = [0, 1, 2].map(shareAt)
    results.push([`${run.scenario.id}: hit about 70/20/10 world/gear/character from day 90`,
      between(world, 0.6, 0.82) && between(gear, 0.12, 0.3) && between(own, 0.04, 0.16),
      `${percent(world)} / ${percent(gear)} / ${percent(own)}`])
  }
  const share = newcomerShare(60)
  const newcomer = 'a newcomer does about three quarters of a seasoned character'
  results.push([newcomer, between(share, 0.68, 0.82), percent(share)])
  for (const run of runs) {
    const hours = tokensToSeasoned() / perHourOf(run.scenario)
    results.push([`${run.scenario.id}: seasoned within a few hours of real work`, hours <= 4,
      `${fixed(hours)} hours of an agent working`])
  }
  return results
}

/** The fight and material targets for one scenario, from day 30 on. */
function scenarioChecks(run) {
  const id = run.scenario.id
  const late = run.rows.filter((row) => row.day >= 30)
  const gaps = late.flatMap((row) => row.waves.map((wave) => wave - row.level))
  const kills = Math.min(...late.map((row) => row.killsPerHour))
  const common = run.allKills.filter((event) => event.kind === 'common' && !event.affix)
  const ticks = median(common.map((event) => event.ticks))
  const buys = late.map((row) => row.purchasesPerDay)
  const gathered = run.totals.gathered / Math.max(1, run.totals.gathered + run.totals.killMaterials)
  return [
    [`${id}: waves settle a little above the world level`, gaps.every((gap) => between(gap, 0, 10)),
      `wave - world level from ${Math.min(...gaps)} to ${Math.max(...gaps)}`],
    [`${id}: several kills per hour of fighting`, kills >= 3, `at least ${fixed(kills)} an hour`],
    [`${id}: never a fighting day without a kill`, run.daysWithoutKill === 0, `${run.daysWithoutKill} days`],
    [`${id}: a common monster takes about four minutes`, between(ticks, 18, 42),
      `median ${ticks} ticks (${fixed((ticks * 10) / 60)} min)`],
    [`${id}: a meaningful upgrade every one to two working days`,
      buys.every((value) => between(value, 0.4, 4)),
      `${fixed(Math.min(...buys))} to ${fixed(Math.max(...buys))} a day`],
    [`${id}: gathering is 15 to 30% of materials`, between(gathered, 0.15, 0.3), percent(gathered)]
  ]
}

/** The party composition targets at a low, a middle and a high level. */
function compositionChecks(engine) {
  const results = []
  for (const level of [10, 60, 150]) {
    const parties = compositionCheck(engine, level)
    const { balanced } = parties
    results.push([`level ${level}: a balanced party rarely rests`, balanced.rest <= 0.15,
      percent(balanced.rest)])
    for (const name of ['no defender', 'no supporter']) {
      const { rest } = parties[name]
      results.push([`level ${level}: ${name} rests noticeably more`, rest >= balanced.rest + 0.25,
        `${percent(rest)} of kills`])
    }
    const slower = parties['no magic'].armored / parties['no magic'].common
    results.push([`level ${level}: no magic is about twice as slow on armored`, between(slower, 1.6, 2.6),
      `x${fixed(slower)}`])
    const boss = balanced.boss / balanced.common
    const elite = balanced.elite / balanced.common
    results.push([`level ${level}: elites and bosses harder, always beaten`,
      between(boss, 2.5, 8) && elite > 1.2 && Number.isFinite(balanced.longest),
      `boss x${fixed(boss)}, elite x${fixed(elite)}, longest ${balanced.longest} ticks`])
  }
  return results
}

/**
 * Prints the balance check: every target with PASS or FAIL and what was measured.
 *
 * @param {object[]} runs the simulated scenarios
 * @param {object} engine
 * @param {(scenario: object) => number} perHourOf tokens a session spends per hour of work
 */
export function printBalanceCheck(runs, engine, perHourOf) {
  const byId = Object.fromEntries(runs.map((run) => [run.scenario.id, run]))
  const results = [
    ...progressionChecks(byId),
    ...powerChecks(runs, perHourOf),
    ...runs.flatMap(scenarioChecks),
    ...compositionChecks(engine)
  ]
  console.log('\n## Balance check\n')
  const rows = results.map(([name, passed, detail]) => [passed ? 'PASS' : 'FAIL', name, detail])
  printTable(['', 'target', 'measured'], rows)
  const failed = results.filter(([, passed]) => !passed).length
  console.log(`\n${results.length - failed} of ${results.length} targets met.`)
}
