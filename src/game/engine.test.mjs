import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  GATHER_STOPS_AFTER_HOURS,
  GROUP_UPGRADES,
  MAX_FIGHT_TICKS_PER_ADVANCE,
  SKILL_CAP,
  TICK_SECONDS,
  TOKENS_PER_XP
} from './constants.mjs'
import { createEngine } from './engine.mjs'
import { chanceOf, hashOf } from './hash.mjs'
import { referenceGearLevel } from './power.mjs'
import { effectiveLevel, xpToNext } from './progression.mjs'
import { assignProject, emptySave, excludeProject } from './worlds.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = { monsters: readJson('../../game/monsters.json'), items: readJson('../../game/items.json') }
const engine = createEngine({ content })

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const ACTIVITIES = ['write', 'read', 'run', 'think', 'delegate']

function tokensFor(save, reading) {
  const defaults = { projectId: 'rumble-banana', tokens: 100_000, activity: 'write', now: 0 }
  return engine.applyTokens(save, { ...defaults, ...reading })
}

/** Experience from level 1 to `level` on the skill curve. */
const xpToReach = (level) => Array.from({ length: level - 1 }, (_, index) => xpToNext(index + 1))
  .reduce((sum, xp) => sum + xp, 0)

/** Trains every work skill of the default world to `level` through another project's sessions. */
function trainWorld(save, level) {
  let next = save
  const tokens = xpToReach(level) * TOKENS_PER_XP
  for (const activity of ACTIVITIES) {
    next = tokensFor(next, { projectId: 'turbo-waffle', sessionId: `trainer-${activity}`, tokens, activity })
  }
  return next
}

/** The save with the default world's materials replaced. */
const withMaterials = (save, materials) =>
  ({ ...save, worlds: { ...save.worlds, main: { ...save.worlds.main, materials } } })

const working = (sessionId, projectId = 'rumble-banana', extra = {}) =>
  ({ projectId, sessionId, state: 'working', tokensPerMinute: 20_000, ...extra })

/** A project with four sessions that have each spent some tokens, so every class is present. */
function partyOfFour(save = emptySave(), projectId = 'rumble-banana', tokens = 2_000_000) {
  let next = save
  for (const [index, sessionId] of ['first', 'second', 'third', 'fourth'].entries()) {
    next = tokensFor(next, { projectId, sessionId, tokens, activity: ACTIVITIES[index] })
  }
  return next
}

const project = (save, projectId = 'rumble-banana', worldId = 'main') =>
  save.worlds[worldId].projects[projectId]

/** The save with every item of the project upgraded to the reference gear of a level. */
function withReferenceGear(save, level, projectId = 'rumble-banana') {
  const owned = project(save, projectId)
  const chest = owned.chest.map((item) => ({ ...item, level: Math.round(referenceGearLevel(level)) }))
  const world = save.worlds.main
  const projects = { ...world.projects, [projectId]: { ...owned, chest } }
  return { ...save, worlds: { ...save.worlds, main: { ...world, projects } } }
}
const materialTotal = (world) =>
  Object.values(world?.materials ?? {}).reduce((sum, amount) => sum + amount, 0)

test('tokens give experience to the work skill of the activity and to the session\'s character', () => {
  const save = tokensFor(emptySave(), { sessionId: 'first', tokens: 50 * TOKENS_PER_XP, activity: 'read' })
  const world = save.worlds.main
  assert.equal(world.skills.lore.xp, 50)
  assert.equal(world.skills.forge, undefined)
  const character = project(save).characters.first
  assert.equal(character.tokens, 50 * TOKENS_PER_XP)
  assert.equal(world.lastTokenAt, 0)
})

test('a project joins at the world level and its characters cover the classes', () => {
  const save = partyOfFour(trainWorld(emptySave(), 10), 'cosmic-llama')
  assert.equal(project(save, 'cosmic-llama').wave, 10)
  const classes = Object.values(project(save, 'cosmic-llama').characters).map((character) => character.class)
  assert.deepEqual(new Set(classes).size, 4)
})

test('a new character takes its equipment from the chest', () => {
  const save = partyOfFour()
  const { chest, characters } = project(save)
  for (const character of Object.values(characters)) {
    const weapon = chest.find((item) => item.id === character.equipment.weapon)
    assert.equal(weapon.heldBy, character.sessionId)
    assert.equal(weapon.damageType, character.class === 'magical' ? 'magical' : 'physical')
  }
})

test('the same calls twice give deep-equal saves', () => {
  const play = () => {
    let save = partyOfFour()
    const sessions = ['first', 'second', 'third', 'fourth'].map((sessionId) => working(sessionId))
    for (let step = 0; step < 12; step++) {
      save = engine.advance(save, { from: step * 10 * MINUTE, to: (step + 1) * 10 * MINUTE, sessions })
      const now = step * 10 * MINUTE
      save = tokensFor(save, { sessionId: 'second', tokens: 300_000, activity: 'think', now })
    }
    return engine.autoSpend(save)
  }
  assert.deepEqual(play(), play())
})

test('working sessions fight: kills give materials and the wave never runs far ahead of the world', () => {
  let save = partyOfFour()
  const sessions = ['first', 'second', 'third', 'fourth'].map((sessionId) => working(sessionId))
  const result = engine.advanceWithEvents(save, { from: 0, to: HOUR, sessions })
  save = result.save
  assert.ok(result.events.filter((event) => event.type === 'kill').length >= 5)
  assert.ok(materialTotal(save.worlds.main) > 0)
  assert.ok(project(save).wave <= engine.view(save).worlds[0].level + 8)
})

test('a waiting or blocked session pauses its project\'s fight', () => {
  const save = partyOfFour()
  for (const state of ['waiting', 'blocked']) {
    const sessions = [working('first'), working('second'), { ...working('third'), state }]
    const result = engine.advanceWithEvents(save, { from: 0, to: HOUR, sessions })
    assert.equal(result.events.length, 0, state)
    assert.equal(project(result.save).monster, null, state)
  }
})

test('an idle character gathers its trade until a while after the world\'s last tokens', () => {
  const save = partyOfFour()
  const idle = [{ projectId: 'rumble-banana', sessionId: 'first', state: 'idle' }]
  const trade = project(save).characters.first.trade
  const early = engine.advance(save, { from: 0, to: 2 * HOUR, sessions: idle })
  assert.ok(early.worlds.main.skills[trade].xp > 0)
  assert.ok(materialTotal(early.worlds.main) > 0)
  const late = engine.advance(save, {
    from: (GATHER_STOPS_AFTER_HOURS + 1) * HOUR, to: (GATHER_STOPS_AFTER_HOURS + 3) * HOUR, sessions: idle
  })
  assert.equal(materialTotal(late.worlds.main), 0)
})

test('a long gap of working time is cut to a bounded number of ticks', () => {
  const save = partyOfFour()
  const sessions = ['first', 'second', 'third', 'fourth'].map((sessionId) => working(sessionId))
  const capped = MAX_FIGHT_TICKS_PER_ADVANCE * TICK_SECONDS * 1000
  const once = engine.advanceWithEvents(save, { from: 0, to: capped, sessions })
  const year = engine.advanceWithEvents(save, { from: 0, to: 365 * 24 * HOUR, sessions })
  assert.deepEqual(project(year.save).wave, project(once.save).wave)
  assert.equal(year.events.length, once.events.length)
})

test('many short readings fight exactly as far as one long one', () => {
  const start = partyOfFour()
  const sessions = ['first', 'second', 'third', 'fourth'].map((sessionId) => working(sessionId))
  let short = start
  for (let step = 0; step < 37; step++) {
    short = engine.advance(short, { from: step * 7_000, to: (step + 1) * 7_000, sessions })
  }
  const long = engine.advance(start, { from: 0, to: 37 * 7_000, sessions })
  assert.deepEqual(project(short), project(long))
})

test('an excluded project is left untouched by tokens, time and closing', () => {
  let save = partyOfFour()
  save = excludeProject(save, 'rumble-banana')
  const before = structuredClone(save)
  save = tokensFor(save, { sessionId: 'first', tokens: 5_000_000 })
  save = tokensFor(save, { sessionId: 'newcomer', tokens: 5_000_000 })
  save = engine.advance(save, { from: 0, to: 2 * HOUR, sessions: [working('first'), working('second')] })
  save = engine.closeSession(save, { projectId: 'rumble-banana', sessionId: 'first', now: 10 })
  assert.deepEqual(save, before)
})

test('a closed session retires and comes back with its level when it spends tokens again', () => {
  let save = partyOfFour()
  const level = project(save).characters.second.level
  save = engine.closeSession(save, { projectId: 'rumble-banana', sessionId: 'second', now: 5 })
  assert.equal(project(save).characters.second, undefined)
  assert.equal(project(save).retirees[0].sessionId, 'second')
  assert.equal(project(save).retirees[0].mainSkill, 'lore')
  save = tokensFor(save, { sessionId: 'second', tokens: 1_000, activity: 'read', now: 10 })
  assert.equal(project(save).characters.second.level, level)
  assert.equal(project(save).retirees.length, 0)
})

test('a newcomer inherits the weapon a retiree left in the chest', () => {
  let save = partyOfFour()
  const itemId = project(save).characters.first.equipment.weapon
  save = withMaterials(save, { logs: 999, bars: 999, crystals: 999 })
  save = engine.upgradeItem(save, { projectId: 'rumble-banana', itemId })
  const leaving = project(save).characters.first
  save = engine.closeSession(save, { projectId: 'rumble-banana', sessionId: 'first', now: 5 })
  save = tokensFor(save, { sessionId: 'heir', tokens: 1_000 })
  const heir = project(save).characters.heir
  assert.equal(heir.class, leaving.class)
  assert.equal(heir.equipment.weapon, leaving.equipment.weapon)
})

test('a guest fights with the party but leaves no character, retiree or experience behind', () => {
  const save = partyOfFour()
  const sessions = [working('first'), working('visitor', 'rumble-banana', { guest: true })]
  let next = engine.advance(save, { from: 0, to: HOUR, sessions })
  next = tokensFor(next, { sessionId: 'visitor', tokens: 9_000_000, now: 1, guest: true })
  next = engine.closeSession(next, { projectId: 'rumble-banana', sessionId: 'visitor', now: 2 })
  assert.equal(project(next).characters.visitor, undefined)
  assert.ok(project(next).retirees.every((retiree) => retiree.sessionId !== 'visitor'))
  assert.deepEqual(next.worlds.main.skills, save.worlds.main.skills)
  assert.ok(JSON.stringify(project(next).chest).includes('visitor') === false)
})

test('worlds do not share skills or materials', () => {
  let save = assignProject(emptySave(), 'fuzzy-anvil', 'second-world')
  save = partyOfFour(save, 'rumble-banana')
  const sessions = ['first', 'second', 'third', 'fourth'].map((id) => working(id))
  save = engine.advance(save, { from: 0, to: HOUR, sessions })
  save = tokensFor(save, { projectId: 'fuzzy-anvil', sessionId: 'alone', tokens: 50_000, activity: 'run' })
  const other = save.worlds['second-world']
  assert.deepEqual(Object.keys(other.skills), ['engineering'])
  assert.equal(materialTotal(other), 0)
  assert.ok(materialTotal(save.worlds.main) > 0)
  assert.equal(save.worlds.main.skills.engineering.xp > 0, true)
  assert.equal(other.skills.engineering.xp, 50)
})

test('a balanced party rests less than one without a defender or a supporter, at low and high levels', () => {
  for (const level of [1, 90]) {
    const restShare = (dropClass) => {
      const save = withReferenceGear(partyOfFour(trainWorld(emptySave(), level)), level)
      const sessions = Object.values(project(save).characters)
        .filter((character) => character.class !== dropClass).map((character) => working(character.sessionId))
      const kills = engine.advanceWithEvents(save, { from: 0, to: 6 * HOUR, sessions }).events
      return kills.filter((event) => event.rested).length / kills.length
    }
    const balanced = restShare(null)
    assert.ok(restShare('defense') > balanced + 0.2, `level ${level} without defender`)
    assert.ok(restShare('support') > balanced + 0.2, `level ${level} without supporter`)
  }
})

test('autoSpend buys upgrades and never spends more than the world has', () => {
  let save = partyOfFour()
  const materials = Object.fromEntries(['bars', 'logs', 'crystals', 'hides', 'crops', 'ore', 'gears', 'runes']
    .map((id) => [id, 5_000]))
  save = { ...save, worlds: { main: { ...save.worlds.main, materials } } }
  const { save: spent, purchases } = engine.autoSpendWithPurchases(save)
  assert.ok(purchases.length > 3)
  assert.ok(Object.values(spent.worlds.main.materials).every((amount) => amount >= 0))
  assert.ok(purchases.some((purchase) => purchase.kind === 'group'))
  assert.ok(purchases.some((purchase) => purchase.kind === 'weapon'))
})

test('a group upgrade is bought only when the world can pay for it', () => {
  const save = partyOfFour()
  assert.equal(engine.buyGroupUpgrade(save, { worldId: 'main', upgradeId: 'campfire' }), save)
  const [first, second] = GROUP_UPGRADES.campfire.recipe
  const rich = withMaterials(save, { [first]: 1_000, [second]: 1_000 })
  const bought = engine.buyGroupUpgrade(rich, { worldId: 'main', upgradeId: 'campfire' })
  assert.equal(bought.worlds.main.upgrades.campfire, 1)
  assert.ok(bought.worlds.main.materials[first] < 1_000)
})

test('prestige is refused below the cap and keeps the effective level at it', () => {
  let save = tokensFor(emptySave(), { sessionId: 'first', tokens: 1_000_000, activity: 'write' })
  assert.equal(engine.prestige(save, { worldId: 'main', skillId: 'forge' }), save)
  const tokens = xpToReach(SKILL_CAP) * TOKENS_PER_XP
  save = tokensFor(save, { sessionId: 'first', tokens, activity: 'write' })
  const before = effectiveLevel(save.worlds.main.skills.forge)
  const after = engine.prestige(save, { worldId: 'main', skillId: 'forge' }).worlds.main.skills.forge
  assert.equal(after.stars, 1)
  assert.ok(effectiveLevel(after) >= before)
})

test('titles are kept only while the setting is on, and turning it off forgets them', () => {
  let save = engine.setKeepTitles(emptySave(), true)
  save = tokensFor(save, { sessionId: 'first', title: 'Tidy the attic' })
  save = engine.closeSession(save, { projectId: 'rumble-banana', sessionId: 'first', now: 1 })
  assert.equal(project(save).retirees[0].title, 'Tidy the attic')
  save = engine.setKeepTitles(save, false)
  assert.equal(project(save).retirees[0].title, null)
  save = tokensFor(save, { sessionId: 'second', title: 'Sweep the porch' })
  assert.equal(project(save).characters.second.title, null)
})

test('the view shows each world\'s skills and each project\'s fight and party', () => {
  let save = partyOfFour()
  save = engine.advance(save, { from: 0, to: 20 * MINUTE, sessions: [working('first'), working('second')] })
  const [world] = engine.view(save).worlds
  assert.equal(world.workSkills.length, 5)
  assert.equal(world.upgrades.length, 3)
  const [shown] = world.projects
  assert.equal(shown.party.length, 4)
  assert.ok(shown.monster.healthShare > 0 && shown.monster.healthShare <= 1)
  assert.ok(shown.party.every((member) => member.equipment.weapon && member.equipment.weapon.name))
})

/** Levels, waves and materials of a save, to compare before and after a step. */
function progressOf(save) {
  const skills = {}
  const characters = {}
  const waves = {}
  const materials = {}
  for (const [worldId, world] of Object.entries(save.worlds)) {
    materials[worldId] = materialTotal(world)
    for (const [skillId, skill] of Object.entries(world.skills)) {
      skills[`${worldId}|${skillId}`] = effectiveLevel(skill)
    }
    for (const [projectId, owned] of Object.entries(world.projects)) {
      waves[projectId] = owned.wave
      for (const character of [...Object.values(owned.characters), ...owned.retirees]) {
        characters[`${projectId}|${character.sessionId}`] = character.level
      }
    }
  }
  return { skills, characters, waves, materials }
}

function assertNothingLost(before, after, { spent }) {
  for (const [key, value] of Object.entries(before.skills)) assert.ok(after.skills[key] >= value, key)
  for (const [key, value] of Object.entries(before.characters)) assert.ok(after.characters[key] >= value, key)
  for (const [key, value] of Object.entries(before.waves)) assert.ok(after.waves[key] >= value, key)
  if (spent) return
  for (const [key, value] of Object.entries(before.materials)) assert.ok(after.materials[key] >= value, key)
}

test('over a long sequence nothing is ever lost except materials spent on purchases', () => {
  let save = assignProject(emptySave(), 'sneaky-pancake', 'side')
  const projects = ['rumble-banana', 'turbo-waffle', 'sneaky-pancake']
  const sessions = ['amber', 'birch', 'cedar', 'dune', 'ember', 'fern', 'grove']
  const states = ['working', 'working', 'working', 'idle', 'waiting', 'blocked']
  let now = 0
  for (let step = 0; step < 600; step++) {
    const roll = (purpose) => chanceOf(`sequence|${step}|${purpose}`)
    const pick = (list, purpose) => list[hashOf(`sequence|${step}|${purpose}`) % list.length]
    const before = progressOf(save)
    let spent = false
    const action = roll('action')
    const projectId = pick(projects, 'project')
    const sessionId = pick(sessions, 'session')
    if (action < 0.45) {
      const tokens = Math.floor(roll('tokens') * 3_000_000)
      const activity = pick(ACTIVITIES, 'activity')
      save = engine.applyTokens(save, { projectId, sessionId, tokens, activity, now })
    } else if (action < 0.85) {
      const readings = sessions.map((id, index) => ({
        projectId: projects[index % projects.length], sessionId: id, state: pick(states, `state|${id}`),
        tokensPerMinute: 30_000, guest: id === 'grove'
      }))
      save = engine.advance(save, { from: now, to: now + 15 * MINUTE, sessions: readings })
      now += 15 * MINUTE
    } else if (action < 0.92) {
      save = engine.closeSession(save, { projectId, sessionId, now })
    } else if (action < 0.97) {
      save = engine.autoSpend(save)
      spent = true
    } else {
      for (const skillId of ['forge', 'lore', 'mining']) {
        save = engine.prestige(save, { worldId: 'main', skillId })
      }
    }
    assertNothingLost(before, progressOf(save), { spent })
  }
})
