import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import { INSTANCE_COOLDOWN_MS, INSTANCE_TRIES, INSTANCE_VAULT_WAIT_TICKS } from './instance-constants.mjs'
import { boonsOffered, checkScore } from './instance-fight.mjs'
import { instanceIndexOf } from './instance-content.mjs'
import { INSTANCE_REFUSALS, coolDown } from './instance-run.mjs'
import { worldLevel } from './progression.mjs'
import { emptySave } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('monsters.json'),
  items: readJson('items.json'),
  races: readJson('races.json'),
  bosses: readJson('bosses.json'),
  legendary: readJson('legendary.json'),
  bestiary: readJson('bestiary.json'),
  instances: readJson('instances.json')
}
const engine = createEngine({ content })
const index = instanceIndexOf(content)
const HOUR = 3_600_000
const DAY = 24 * HOUR
const START = 400 * DAY
const ROOM = 'local:/work/rumble-banana'
const OTHER = 'local:/work/turbo-waffle'
const SESSIONS = ['first', 'second', 'third', 'fourth', 'fifth']
const ACTIVITIES = ['write', 'read', 'run', 'think', 'delegate']

/** A party of five in a room, its world at a level the first instance is open at. */
function party({ tokens = 6_000_000, room = ROOM, sessions = SESSIONS, save = emptySave() } = {}) {
  let next = save
  for (const [at, sessionId] of sessions.entries()) {
    next = engine.applyTokens(next, { projectId: room, sessionId, tokens, activity: ACTIVITIES[at % 5], now: START })
  }
  return next
}
const working = (room = ROOM, sessions = SESSIONS) => sessions.map((sessionId) => ({ projectId: room, sessionId, state: 'working', tokensPerMinute: 20_000 }))

/** Plays `minutes` of working time a minute at a time, with every event. */
function play(save, minutes, { sessions = working(), autoPlay = false, from = START } = {}) {
  let next = save
  const events = []
  for (let minute = 0; minute < minutes; minute++) {
    const at = from + minute * 60_000
    const moved = engine.advanceWithEvents(next, { from: at, to: at + 60_000, sessions, autoPlay })
    next = moved.save
    events.push(...moved.events)
  }
  return { save: next, events }
}
const runOf = (save, room = ROOM) => save.worlds.main.projects[room].run
const instanceEvents = (events, kind) => events.filter((event) => event.type === 'instance' && (!kind || event.kind === kind))

/** A party fighting its waves for a while, so it has a wave, a monster and kills to keep. */
function onWaves() {
  return play(party(), 30).save
}

test('the shipped party\'s world reaches the first instance\'s level', () => {
  assert.ok(worldLevel(party().worlds.main.skills) >= index.byId.get('sunken-crypt').opensAt)
})

test('entering is refused with a reason a person can read', () => {
  const save = onWaves()
  const problem = (entry) => engine.enterProblem(save, { projectId: ROOM, tier: 1, instanceId: 'sunken-crypt', ...entry })
  assert.equal(problem({}), null)
  assert.equal(problem({ instanceId: 'emberdeep-foundry' }), INSTANCE_REFUSALS.closed)
  assert.equal(problem({ instanceId: 'atlantis' }), INSTANCE_REFUSALS.unknownInstance)
  assert.equal(problem({ tier: 2 }), INSTANCE_REFUSALS.tier)
  assert.equal(problem({ tier: 0 }), INSTANCE_REFUSALS.tier)
  assert.equal(problem({ projectId: 'local:/work/nowhere' }), INSTANCE_REFUSALS.notPlaying)
  const low = party({ tokens: 200_000 })
  assert.equal(engine.enterProblem(low, { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 }), INSTANCE_REFUSALS.level)
  assert.equal(engine.enterInstance(low, { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 }), low)
})

test('one room per instance, and a room in one instance at a time', () => {
  let save = party({ room: OTHER, sessions: ['sixth'], save: onWaves() })
  save = engine.enterInstance(save, { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 })
  assert.equal(engine.enterProblem(save, { projectId: OTHER, instanceId: 'sunken-crypt', tier: 1 }), INSTANCE_REFUSALS.taken)
  assert.equal(engine.enterProblem(save, { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 }), INSTANCE_REFUSALS.inside)
})

test('a room without a living character cannot enter', () => {
  let save = onWaves()
  for (const sessionId of SESSIONS) save = engine.closeSession(save, { projectId: ROOM, sessionId, now: START + DAY })
  assert.equal(engine.enterProblem(save, { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 }), INSTANCE_REFUSALS.noCharacters)
})

test('entering freezes the room\'s wave and counts a run; a clear brings the wave back as it was', () => {
  const before = onWaves()
  const project = before.worlds.main.projects[ROOM]
  const inside = engine.enterInstance(before, { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 })
  assert.equal(runOf(inside).room, 0)
  assert.equal(inside.worlds.main.instances['sunken-crypt'].runs, 1)
  const { save, events } = play(inside, 300, { autoPlay: true, from: START + HOUR })
  assert.ok(instanceEvents(events, 'cleared').length === 1, JSON.stringify(instanceEvents(events).map((event) => event.kind)))
  const after = save.worlds.main.projects[ROOM]
  assert.equal(after.run, undefined)
  assert.equal(after.waveKills >= project.waveKills || after.wave > project.wave, true)
  assert.deepEqual(save.worlds.main.instances['sunken-crypt'].clears, 1)
  assert.equal(save.worlds.main.instances['sunken-crypt'].bestTier, 1)
})

test('the run goes room by room, from the entrance to the boss, and only with working time', () => {
  const inside = engine.enterInstance(onWaves(), { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 })
  const paused = play(inside, 30, { sessions: working().map((reading) => ({ ...reading, state: 'waiting' })) })
  assert.deepEqual(runOf(paused.save), runOf(inside))
  const idle = play(inside, 30, { sessions: working().map((reading) => ({ ...reading, state: 'idle' })) })
  assert.equal(runOf(idle.save).ticks, 0)
  const { events } = play(inside, 300, { autoPlay: true, from: START + HOUR })
  const rooms = instanceEvents(events, 'room').map((event) => event.room)
  assert.deepEqual(rooms, [0, 1, 2, 3])
  const kinds = instanceEvents(events).map((event) => event.kind).filter((kind) => kind !== 'retry')
  assert.deepEqual(kinds, ['room', 'room', 'check', 'room', 'room', 'vault', 'boon', 'cleared'])
  const kills = events.filter((event) => event.type === 'kill' && event.instance === 'sunken-crypt')
  assert.equal(kills.length, 6, 'the entrance, three in the hall, the elite and the boss')
  assert.deepEqual(kills.map((event) => event.rank).slice(-2), ['champion', 'boss'])
})

test('the hall\'s and the entrance\'s monsters are of the instance\'s races, the elite and boss its own', () => {
  let save = engine.enterInstance(onWaves(), { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 })
  const seen = []
  for (let minute = 0; minute < 300 && runOf(save); minute++) {
    const monster = save.worlds.main.projects[ROOM].monster
    if (monster && seen.at(-1) !== monster.id + monster.rank) seen.push(monster.id + monster.rank)
    save = play(save, 1, { autoPlay: true, from: START + HOUR + minute * 60_000 }).save
  }
  const crypt = index.byId.get('sunken-crypt')
  const plain = seen.filter((id) => !id.endsWith('champion') && !id.endsWith('boss'))
  assert.ok(plain.every((id) => crypt.races.some((race) => id.startsWith(race))), seen.join())
  assert.ok(seen.includes(`${crypt.elite}champion`) && seen.includes(`${crypt.boss}boss`), seen.join())
})

test('the vault offers two boons and waits a while for a choice, then takes the first', () => {
  let save = engine.enterInstance(onWaves(), { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 })
  let minute = 0
  while (!runOf(save)?.offered && minute < 300) save = play(save, 1, { from: START + HOUR + (minute++) * 60_000 }).save
  const run = runOf(save)
  assert.equal(run.offered.length, 2)
  assert.notEqual(run.offered[0], run.offered[1])
  const waited = play(save, Math.ceil((INSTANCE_VAULT_WAIT_TICKS * 10) / 60) + 1, { from: START + 2 * DAY })
  const taken = instanceEvents(waited.events, 'boon')[0]
  assert.deepEqual([taken.boon, taken.chosenBy], [run.offered[0], 'wait'])
})

test('a boon is chosen only from the vault\'s offer, and stamina comes back at once with Second Wind', () => {
  let save = engine.enterInstance(onWaves(), { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 })
  assert.equal(engine.boonProblem(save, { projectId: ROOM, boonId: 'second-wind' }), INSTANCE_REFUSALS.notAtVault)
  let minute = 0
  while (!runOf(save)?.offered && minute < 300) save = play(save, 1, { from: START + HOUR + (minute++) * 60_000 }).save
  const offered = runOf(save).offered
  const other = index.boons.find((boon) => !offered.includes(boon.id)).id
  assert.equal(engine.boonProblem(save, { projectId: ROOM, boonId: other }), INSTANCE_REFUSALS.unknownBoon)
  assert.equal(engine.chooseBoon(save, { projectId: ROOM, boonId: other }), save)
  const tired = { ...save, worlds: { main: { ...save.worlds.main, projects: { ...save.worlds.main.projects, [ROOM]: { ...save.worlds.main.projects[ROOM], stamina: 0.2, run: { ...runOf(save), offered: ['second-wind', offered[1]] } } } } } }
  const chosen = engine.chooseBoon(tired, { projectId: ROOM, boonId: 'second-wind' })
  assert.equal(runOf(chosen).boon, 'second-wind')
  assert.equal(chosen.worlds.main.projects[ROOM].stamina, 1)
  assert.equal(index.byId.get('sunken-crypt').rooms[runOf(chosen).room].kind, 'boss')
})

test('the boons offered depend only on the run, and are two different ones', () => {
  assert.deepEqual(boonsOffered(index, 'a|b|c'), boonsOffered(index, 'a|b|c'))
  for (let at = 0; at < 50; at++) {
    const offered = boonsOffered(index, `seed-${at}`)
    assert.equal(new Set(offered).size, 2)
  }
})

/** A save whose crypt run is at a tier far above the party, so every room times out. */
function hopeless() {
  const save = onWaves()
  const world = { ...save.worlds.main, instances: { 'sunken-crypt': { runs: 0, clears: 1, bestTier: 39 } } }
  return engine.enterInstance({ ...save, worlds: { main: world } }, { projectId: ROOM, instanceId: 'sunken-crypt', tier: 40 })
}

test('a party that cannot clear a room retries it, and after three failed tries the run ends on a cooldown', () => {
  let save = hopeless()
  const events = []
  for (let minute = 0; runOf(save) && minute < 400; minute++) {
    const moved = play(save, 1, { autoPlay: true, from: START + HOUR + minute * 60_000 })
    save = moved.save
    events.push(...moved.events)
  }
  assert.equal(instanceEvents(events, 'retry').length, INSTANCE_TRIES - 1)
  assert.equal(instanceEvents(events, 'failed').length, 1)
  const project = save.worlds.main.projects[ROOM]
  assert.equal(project.run, undefined)
  assert.ok(project.instanceCooldowns['sunken-crypt'] > 0)
  assert.equal(engine.enterProblem(save, { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 }), INSTANCE_REFUSALS.cooldown)
})

test('a cooldown runs down with working time on the waves only', () => {
  const project = { instanceCooldowns: { 'sunken-crypt': INSTANCE_COOLDOWN_MS } }
  assert.equal(coolDown(project, 0), project)
  assert.equal(coolDown(project, HOUR).instanceCooldowns['sunken-crypt'], INSTANCE_COOLDOWN_MS - HOUR)
  assert.equal('instanceCooldowns' in coolDown(project, INSTANCE_COOLDOWN_MS), false)
  const failed = play(hopeless(), 400, { autoPlay: true, from: START + HOUR }).save
  const later = play(failed, 2 * 60 + 5, { from: START + 3 * DAY }).save
  assert.equal(engine.enterProblem(later, { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 }), null)
})

test('recalling the party ends the run as a failure would, keeping what it found', () => {
  const inside = engine.enterInstance(onWaves(), { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 })
  const { save } = play(inside, 20, { from: START + HOUR })
  assert.ok(runOf(save).found.kills > 0)
  const materials = save.worlds.main.materials
  const recalled = engine.recallParty(save, { projectId: ROOM })
  const project = recalled.worlds.main.projects[ROOM]
  assert.equal(project.run, undefined)
  assert.equal(project.wave, inside.worlds.main.projects[ROOM].run.frozen.wave)
  assert.deepEqual(project.monster, inside.worlds.main.projects[ROOM].run.frozen.monster)
  assert.deepEqual(recalled.worlds.main.materials, materials)
  assert.ok(project.instanceCooldowns['sunken-crypt'] > 0)
  assert.equal(engine.recallParty(recalled, { projectId: ROOM }), recalled)
})

test('a run whose characters all retire waits, then goes on with a new character', () => {
  let save = engine.enterInstance(onWaves(), { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 })
  save = play(save, 5, { from: START + HOUR }).save
  for (const sessionId of SESSIONS) save = engine.closeSession(save, { projectId: ROOM, sessionId, now: START + 2 * HOUR })
  const ticks = runOf(save).ticks
  const waiting = play(save, 30, { from: START + 3 * HOUR }).save
  assert.equal(runOf(waiting).ticks, ticks, 'no living character, no time in the run')
  const joined = party({ save: waiting, sessions: ['newcomer'] })
  const moved = play(joined, 10, { sessions: working(ROOM, ['newcomer']), from: START + 4 * HOUR }).save
  assert.ok(runOf(moved).ticks > ticks)
})

test('the room\'s kills and its world\'s bestiary count the run\'s kills', () => {
  const inside = engine.enterInstance(onWaves(), { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 })
  const kills = inside.worlds.main.projects[ROOM].kills
  const { save, events } = play(inside, 60, { from: START + HOUR })
  const runKills = events.filter((event) => event.type === 'kill').length
  assert.ok(runKills > 0)
  assert.equal(save.worlds.main.projects[ROOM].kills, kills + runKills)
})

test('a tier\'s modifier changes the run: a crowded hall holds five fights', () => {
  const crowded = index.instances.find((entry) => entry.modifiers.includes('crowded-hall'))
  const tier = 2 + crowded.modifiers.indexOf('crowded-hall')
  let save = onWaves()
  const skills = Object.fromEntries(Object.entries(save.worlds.main.skills).map(([id, skill]) => [id, { ...skill, level: 99, stars: 0 }]))
  const progress = Object.fromEntries(index.order.map((id) => [id, { runs: 0, clears: 1, bestTier: tier }]))
  save = { ...save, worlds: { main: { ...save.worlds.main, skills, instances: progress } } }
  save = engine.enterInstance(save, { projectId: ROOM, instanceId: crowded.id, tier })
  assert.ok(runOf(save))
  const { events } = play(save, 200, { autoPlay: true, from: START + HOUR })
  const hallKills = []
  let room = 0
  for (const event of events) {
    if (event.type === 'instance' && event.kind === 'room') room = event.room + 1
    if (event.type === 'kill' && room === 1) hallKills.push(event)
  }
  assert.ok(hallKills.length >= 5 || instanceEvents(events, 'retry').length > 0, `${hallKills.length} hall kills`)
})

test('a check scores an attribute against the reference and a skill against the world level', () => {
  const skills = { lore: { level: 10, xp: 0, banked: 0, stars: 0 } }
  assert.equal(checkScore({ skill: 'lore' }, { characters: [], skills, worldLevel: 10 }), 1)
  assert.equal(checkScore({ skill: 'arcana' }, { characters: [], skills, worldLevel: 10 }), 0.1)
  const strong = checkScore({ attribute: 'agility' }, { characters: [{ attributes: { agility: 40 } }], skills, worldLevel: 10 })
  const weak = checkScore({ attribute: 'agility' }, { characters: [{ attributes: { agility: 1 } }], skills, worldLevel: 10 })
  assert.ok(strong > weak)
})

test('the same run with the same working time always plays the same', () => {
  const inside = engine.enterInstance(onWaves(), { projectId: ROOM, instanceId: 'sunken-crypt', tier: 1 })
  assert.deepEqual(play(inside, 90, { from: START + HOUR }).save, play(inside, 90, { from: START + HOUR }).save)
})
