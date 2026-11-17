// Real time passing for the projects that have sessions: each reported session's state is
// recorded, idle characters gather, and the working party of a project fights. Also gets a
// project ready for the next stretch of time: a party that works has a monster to face.
import { createCharacter, seasoning } from './characters.mjs'
import { findItem } from './chest.mjs'
import { GATHER_XP_PER_HOUR, GEAR_GROWTH, MAX_FIGHT_TICKS_PER_ADVANCE, TICK_SECONDS } from './constants.mjs'
import { playFight, partyOf, spawnMonster } from './fight.mjs'
import { activeHours, gather, gatherRate } from './gathering.mjs'
import { itemFactor, referenceGearLevel } from './items.mjs'
import { recoverMarket } from './market.mjs'
import { effectMultiplier, effectiveLevel, emptySkill, grantSkillXp, worldLevel } from './progression.mjs'
import { retireeBonus } from './retirement.mjs'
import { inScene, scenesOf } from './scenes.mjs'
import { materialOfSkill } from './skills.mjs'
import { effectiveTrade } from './trades.mjs'
import { addMaterials, withCharacter, withProjectIn, worldIdOf } from './worlds.mjs'

const MS_PER_TICK = TICK_SECONDS * 1000
/** States in which an agent waits for a person: the whole party waits with it. */
const PAUSING_STATES = new Set(['waiting', 'blocked'])

/**
 * @typedef {{ projectId: string, sessionId: string, state: 'working' | 'waiting' | 'blocked' | 'idle',
 *   activity?: string, tokensPerMinute?: number, themeId?: string | null, guest?: boolean,
 *   scenes?: string[] | null }} SessionReading `scenes` are the themes a travelling project moves
 *   through, one per kill (see scenes.mjs); its `themeId` then follows its kill count instead
 */

/** An idle character gathers its trade (see trades.mjs) for the hours gathering still runs. */
function gatherFor(world, project, character, hours) {
  const trade = effectiveTrade(character, project)
  const tradeSkill = world.skills[trade] ?? emptySkill()
  const tool = character.equipment?.tool ? findItem(project.chest, character.equipment.tool) : null
  const ratePerHour = gatherRate({
    tradeLevel: effectiveLevel(tradeSkill),
    effect: effectMultiplier(tradeSkill),
    worldLevel: worldLevel(world.skills),
    toolFactor: itemFactor(tool) / GEAR_GROWTH ** referenceGearLevel(worldLevel(world.skills)),
    seasoning: seasoning(character.level),
    retireeBonus: retireeBonus(project)
  })
  const { units, carry } = gather({ ratePerHour, hours, carry: character.gatherCarry ?? 0 })
  const gathered = { [materialOfSkill(trade)]: units }
  const materials = units > 0 ? addMaterials(world.materials, gathered) : world.materials
  const skills = { ...world.skills, [trade]: grantSkillXp(tradeSkill, hours * GATHER_XP_PER_HOUR) }
  return { world: { ...world, materials, skills }, character: { ...character, gatherCarry: carry }, units }
}

/** Records each reported session's state and lets the idle ones gather. */
function settleCharacters(world, projectId, readings, { from, to }) {
  let current = world
  const hours = activeHours({ from, to, lastTokenAt: world.lastTokenAt })
  const sorted = [...readings].sort((a, b) => a.sessionId.localeCompare(b.sessionId, 'en'))
  for (const reading of sorted) {
    const project = current.projects[projectId]
    let character = project.characters[reading.sessionId]
    if (!character || reading.guest) continue
    character = { ...character, state: reading.state }
    if (reading.state === 'idle' && hours > 0 && effectiveTrade(character, project)) {
      const gathered = gatherFor(current, project, character, hours)
      current = gathered.world
      character = gathered.character
    }
    current = withProjectIn(current, projectId, withCharacter(current.projects[projectId], character))
  }
  return current
}

/** The working members of a project's party; guests join as newcomers that are never saved. */
function workingMembers(world, project, readings, now) {
  const members = []
  const livingClasses = Object.values(project.characters).map((character) => character.class)
  for (const reading of readings) {
    if (reading.state !== 'working') continue
    const tokensPerMinute = reading.tokensPerMinute ?? 0
    if (reading.guest) {
      const { sessionId } = reading
      const guest = createCharacter({ sessionId, livingClasses, skills: world.skills, now })
      livingClasses.push(guest.class)
      members.push({ character: guest, tokensPerMinute })
    } else if (project.characters[reading.sessionId]) {
      members.push({ character: project.characters[reading.sessionId], tokensPerMinute })
    }
  }
  return members
}

/** Moves one project forward over an interval: states, gathering, then the fight. */
function advanceProject(world, { worldId, projectId, readings, from, to, content, referencePartyHit }) {
  let current = settleCharacters(world, projectId, readings, { from, to })
  let project = current.projects[projectId]
  const themed = readings.find((reading) => reading.themeId)
  if (themed) project = { ...project, themeId: themed.themeId }
  const scenes = scenesOf(readings)
  project = inScene(project, projectId, scenes)
  if (readings.some((reading) => PAUSING_STATES.has(reading.state))) {
    return { world: withProjectIn(current, projectId, project), events: [] }
  }
  const members = workingMembers(current, project, readings, from)
  if (members.length === 0) return { world: withProjectIn(current, projectId, project), events: [] }
  const elapsed = project.fightMs + (to - from)
  const wholeTicks = Math.floor(elapsed / MS_PER_TICK)
  const ticks = Math.min(wholeTicks, MAX_FIGHT_TICKS_PER_ADVANCE)
  const fightMs = ticks < wholeTicks ? 0 : elapsed - ticks * MS_PER_TICK
  const fight = playFight({
    worldId,
    projectId,
    project: { ...project, fightMs },
    world: current,
    worldLevel: worldLevel(current.skills),
    party: partyOf(members, current, project),
    ticks,
    content,
    referencePartyHit,
    scenes
  })
  current = { ...current, materials: addMaterials(current.materials, fight.materials) }
  return { world: withProjectIn(current, projectId, fight.project), events: fight.events }
}

/**
 * Moves the world forward over an interval of real time, with the sessions as they were during it.
 *
 * @param {object} save
 * @param {{ from: number, to: number, sessions: SessionReading[] }} interval
 * @param {{ content: object, referencePartyHit: (level: number) => object }} context the parsed
 *   game content, and the reference party hit by level
 * @returns {{ save: object, events: object[] }}
 */
export function advanceWithEvents(save, { from, to, sessions = [] }, context) {
  if (!(to > from)) return { save, events: [] }
  const byProject = new Map()
  for (const reading of sessions) {
    if (!byProject.has(reading.projectId)) byProject.set(reading.projectId, [])
    byProject.get(reading.projectId).push(reading)
  }
  let next = save
  const events = []
  for (const projectId of [...byProject.keys()].sort()) {
    const worldId = worldIdOf(next, projectId)
    const world = worldId === null ? null : next.worlds[worldId]
    if (!world?.projects[projectId]) continue
    const readings = byProject.get(projectId)
    const moved = advanceProject(world, { worldId, projectId, readings, from, to, ...context })
    next = { ...next, worlds: { ...next.worlds, [worldId]: moved.world } }
    events.push(...moved.events.map((event) => ({ ...event, worldId })))
  }
  return { save: recoverMarkets(next, from, to), events }
}

/** Every world's market prices recover over the interval, whether its rooms played or not. */
function recoverMarkets(save, from, to) {
  const worlds = Object.fromEntries(Object.entries(save.worlds)
    .map(([worldId, world]) => [worldId, { ...world, market: recoverMarket(world.market, from, to) }]))
  return { ...save, worlds }
}

/** Records each reported character's state, with no time passing: nothing is gathered. */
function recordStates(world, projectId, readings) {
  let project = world.projects[projectId]
  for (const reading of readings) {
    const character = project.characters[reading.sessionId]
    if (!character || reading.guest || character.state === reading.state) continue
    project = withCharacter(project, { ...character, state: reading.state })
  }
  return project
}

/**
 * Gets the projects ready for the time to come, without moving time: each reported character's
 * state is recorded, and a project whose party has a working member and no monster yet meets
 * one now, measured against that party. A project that just joined (its first tokens were
 * counted after this round's advance) so shows its first foe at once, instead of a round later.
 *
 * @param {object} save
 * @param {{ sessions: SessionReading[] }} readings the states read this round
 * @param {{ content: object, referencePartyHit: (level: number) => object }} context
 * @returns {object}
 */
export function prepareFights(save, { sessions = [] }, context) {
  const byProject = new Map()
  for (const reading of sessions) {
    if (!byProject.has(reading.projectId)) byProject.set(reading.projectId, [])
    byProject.get(reading.projectId).push(reading)
  }
  let next = save
  for (const projectId of [...byProject.keys()].sort()) {
    const worldId = worldIdOf(next, projectId)
    const world = worldId === null ? null : next.worlds[worldId]
    if (!world?.projects[projectId]) continue
    const readings = byProject.get(projectId)
    let project = inScene(recordStates(world, projectId, readings), projectId, scenesOf(readings))
    const partySize = readings.filter((reading) =>
      reading.state === 'working' && (reading.guest || project.characters[reading.sessionId])).length
    if (!project.monster && partySize > 0) {
      const where = { worldId, projectId, project, world, content: context.content }
      project = { ...project, monster: spawnMonster({ ...where, referencePartyHit: context.referencePartyHit, partySize }) }
    }
    if (project === world.projects[projectId]) continue
    next = { ...next, worlds: { ...next.worlds, [worldId]: withProjectIn(world, projectId, project) } }
  }
  return next
}
