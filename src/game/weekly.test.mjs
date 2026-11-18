import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { indexBestiary } from './bestiary-content.mjs'
import { killsOf } from './bestiary.mjs'
import { LEGENDARY_EFFECT_CAPS } from './constants.mjs'
import { createEngine } from './engine.mjs'
import { totalOf } from './legendary-effects.mjs'
import { generateMonster } from './races.mjs'
import { weekOf, WEEK_MS } from './weekly-calendar.mjs'
import { eventIndexOf, pinEvent } from './weekly-content.mjs'
import {
  FEATURED_BESTIARY_EXTRA,
  featuredRaceOf,
  noteWeeklyKill,
  noteWeeklyProgress,
  weeklyEffectsOf,
  weeklyHighlights,
  withWeek
} from './weekly.mjs'
import { METRICS } from './achievement-metrics.mjs'
import { chronicleActions } from './chronicle.mjs'
import { worldEffectsOf } from './world-effects.mjs'
import { emptySave } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const base = {
  monsters: readJson('monsters.json'),
  items: readJson('items.json'),
  races: readJson('races.json'),
  bosses: readJson('bosses.json'),
  bestiary: readJson('bestiary.json')
}
const eventsData = readJson('events.json')
const content = { ...base, events: eventsData }
const engine = createEngine({ content })
const plainEngine = createEngine({ content: base })
const HOUR = 3_600_000
const ROOM = 'local:/work/rumble-banana'
/** Wednesday of 2026-W47, at noon. */
const WEDNESDAY = Date.parse('2026-11-18T12:00:00Z')
const pinned = (eventId) => ({ ...content, events: pinEvent(eventsData, eventId) })

/** A room with a party of two, its tokens spent on the Monday before. */
function party(chosen = engine) {
  let save = emptySave()
  for (const [sessionId, activity] of [['first', 'write'], ['second', 'think']]) {
    save = chosen.applyTokens(save, { projectId: ROOM, sessionId, tokens: 3_000_000, activity, now: WEDNESDAY - 2 * 24 * HOUR })
  }
  return save
}
const working = ['first', 'second'].map((sessionId) => ({ projectId: ROOM, sessionId, state: 'working', tokensPerMinute: 20_000 }))
/** The world of a save with its weekly record set. */
const withWeekly = (save, weekly) => ({ ...save, worlds: { ...save.worlds, main: { ...save.worlds.main, weekly } } })
const weekKey = weekOf(WEDNESDAY).key

test('the first advance gives every world the week and its event; a later one the same week keeps its progress', () => {
  const save = engine.advance(party(), { from: WEDNESDAY, to: WEDNESDAY + HOUR, sessions: working })
  const weekly = save.worlds.main.weekly
  assert.equal(weekly.week, weekKey)
  assert.ok(eventIndexOf(content).byId.has(weekly.event))
  const later = withWeek(withWeekly(save, { ...weekly, progress: 7 }), WEDNESDAY + 2 * HOUR, content)
  assert.equal(later.worlds.main.weekly.progress, 7)
  assert.equal(later.worlds.main.weekly.seenAt, WEDNESDAY + 2 * HOUR)
})

test('crossing into a new week while running switches the event and starts its goal over, with no reload', () => {
  const sunday = Date.parse('2026-11-22T23:30:00Z')
  let save = engine.advance(party(), { from: sunday - HOUR, to: sunday, sessions: working })
  const before = save.worlds.main.weekly
  save = withWeekly(save, { ...before, progress: 3 })
  save = engine.advance(save, { from: sunday, to: sunday + HOUR, sessions: working })
  const after = save.worlds.main.weekly
  assert.equal(after.week, '2026-W48')
  assert.notEqual(after.event, before.event)
  assert.equal(after.done, false)
})

test('a game without weekly events keeps no week and gives no event', () => {
  const save = plainEngine.advance(party(plainEngine), { from: WEDNESDAY, to: WEDNESDAY + HOUR, sessions: working })
  assert.equal(save.worlds.main.weekly, undefined)
  assert.deepEqual(weeklyEffectsOf(save.worlds.main, base), [])
})

test('the event\'s effects join the world\'s others, in full far from a cap and never past one', () => {
  const world = { skills: {}, upgrades: {}, weekly: { week: weekKey, event: 'gold-in-the-streams', progress: 0, done: false, seenAt: WEDNESDAY } }
  const effects = worldEffectsOf(world, content)
  assert.equal(totalOf(effects, 'killMaterials'), 0.05)
  const crowded = [...effects, { effect: 'killMaterials', scope: 'world', amount: LEGENDARY_EFFECT_CAPS.killMaterials }]
  assert.equal(totalOf(crowded, 'killMaterials'), LEGENDARY_EFFECT_CAPS.killMaterials)
  assert.deepEqual(worldEffectsOf({ ...world, weekly: undefined }, content), [])
})

test('every shipped event stays at most half of each cap, so it is a nudge on top of what a world has', () => {
  for (const event of eventsData.events) {
    for (const effect of event.effects) assert.ok(effect.amount <= LEGENDARY_EFFECT_CAPS[effect.effect] / 2, event.id)
  }
})

test('a race week brings its race about twice as often', () => {
  const count = (featuredRace) => {
    let found = 0
    for (let seed = 0; seed < 6000; seed++) {
      if (generateMonster(base.races, { seed: `s${seed}`, featuredRace }).race === 'werewolf') found += 1
    }
    return found
  }
  const ratio = count('werewolf') / count(null)
  assert.ok(ratio > 1.7 && ratio < 2.3, `${ratio}`)
})

test('a race week counts a kill of its race once more about half the time, by the kill, and other kills once', () => {
  const index = indexBestiary(base.bestiary, base.bosses)
  const wolf = { id: 'werewolf', race: 'werewolf', rank: 'normal', kind: 'common' }
  const goblin = { id: 'goblin', race: 'goblin', rank: 'normal', kind: 'common' }
  let wolves = null
  let goblins = null
  const KILLS = 1000
  for (let kill = 0; kill < KILLS; kill++) {
    wolves = noteWeeklyKill(wolves, wolf, { day: 1, index, featuredRace: 'werewolf', seed: `k${kill}` }).bestiary
    goblins = noteWeeklyKill(goblins, goblin, { day: 1, index, featuredRace: 'werewolf', seed: `k${kill}` }).bestiary
  }
  const extra = killsOf(wolves.races.werewolf) / KILLS - 1
  assert.ok(Math.abs(extra - FEATURED_BESTIARY_EXTRA) < 0.06, `${extra}`)
  assert.equal(killsOf(goblins.races.goblin), KILLS)
  const once = (seed) => killsOf(noteWeeklyKill(null, wolf, { day: 1, index, featuredRace: 'werewolf', seed }).bestiary.races.werewolf)
  assert.equal(once('same'), once('same'))
  const world = { weekly: { week: weekKey, event: 'howling-moon', progress: 0, done: false, seenAt: WEDNESDAY } }
  assert.equal(featuredRaceOf(world, content), 'werewolf')
  assert.equal(featuredRaceOf({ ...world, weekly: { ...world.weekly, event: 'clear-skies' } }, content), null)
})

test('a race week\'s monsters in the room come up as its race more often', () => {
  const howling = createEngine({ content: pinned('howling-moon') })
  const count = (chosen) => {
    const { events } = chosen.advanceWithEvents(party(chosen), { from: WEDNESDAY, to: WEDNESDAY + 30 * HOUR, sessions: working })
    return events.filter((event) => event.type === 'kill' && event.race === 'werewolf').length
  }
  assert.ok(count(howling) > count(plainEngine))
})

/** A world at a week of an event, its goal one kill short. */
function nearlyDone(eventId) {
  const goal = eventIndexOf(content).byId.get(eventId).goal
  const weekly = { week: weekKey, event: eventId, progress: goal.count - 1, done: false, seenAt: WEDNESDAY }
  return withWeekly(party(), weekly)
}
const kill = (extra = {}) => ({ type: 'kill', projectId: ROOM, rank: 'normal', race: 'goblin', ...extra })
const materialsOf = (save) => Object.values(save.worlds.main.materials).reduce((sum, amount) => sum + amount, 0)

test('the goal pays its reward once, the moment it is reached, and not again that week', () => {
  const start = nearlyDone('gold-in-the-streams')
  const reached = noteWeeklyProgress(start, [kill(), kill()], content)
  assert.equal(reached.worlds.main.weekly.done, true)
  assert.equal(reached.worlds.main.weekly.progress, eventIndexOf(content).byId.get('gold-in-the-streams').goal.count)
  assert.ok(materialsOf(reached) > materialsOf(start))
  const again = noteWeeklyProgress(reached, [kill(), kill()], content)
  assert.equal(again, reached)
  const nextWeek = withWeek(again, WEDNESDAY + WEEK_MS, content)
  assert.equal(nextWeek.worlds.main.weekly.done, false)
  assert.equal(nextWeek.worlds.main.weekly.progress, 0)
})

test('a goal counts only what it names: its race, bosses, or elites and champions', () => {
  const wolves = nearlyDone('howling-moon')
  assert.equal(noteWeeklyProgress(wolves, [kill()], content), wolves)
  assert.equal(noteWeeklyProgress(wolves, [kill({ race: 'werewolf' })], content).worlds.main.weekly.done, true)
  const crowns = nearlyDone('hunt-of-crowns')
  assert.equal(noteWeeklyProgress(crowns, [kill({ rank: 'champion' })], content), crowns)
  assert.equal(noteWeeklyProgress(crowns, [kill({ rank: 'legendary' })], content).worlds.main.weekly.done, true)
  const banners = nearlyDone('red-banner-bounties')
  assert.equal(noteWeeklyProgress(banners, [kill({ rank: 'elite' })], content).worlds.main.weekly.done, true)
  const elsewhere = noteWeeklyProgress(crowns, [kill({ rank: 'boss', projectId: 'local:/work/turbo-waffle' })], content)
  assert.equal(elsewhere, crowns, 'a kill in a room of another world')
})

test('each goal reached counts for good, for the achievements, and is a highlight of the journal once', () => {
  const start = nearlyDone('gold-in-the-streams')
  const reached = noteWeeklyProgress(start, [kill()], content)
  assert.equal(reached.worlds.main.weekly.goals, 1)
  assert.equal(METRICS.weeklyGoals.measure(reached, {}), 1)
  assert.deepEqual(weeklyHighlights(start, reached, 5), [{ at: 5, kind: 'weekly', ref: 'gold-in-the-streams' }])
  assert.deepEqual(weeklyHighlights(reached, reached, 6), [])
  const nextWeek = withWeek(reached, WEDNESDAY + WEEK_MS, content)
  assert.equal(nextWeek.worlds.main.weekly.goals, 1, 'kept into the next week')
  assert.equal(METRICS.weeklyGoals.measure(party(), {}), 0)
})

test('the day\'s journal keeps a week\'s goal reached as a highlight with the event\'s name', () => {
  const start = nearlyDone('gold-in-the-streams')
  const reached = noteWeeklyProgress(start, [kill()], content)
  const { chronicle, chronicleView } = chronicleActions(content)
  const kept = chronicle(reached, { before: start, events: [kill()], at: WEDNESDAY, day: 20_000 }).save
  assert.deepEqual(kept.journal.highlights.map(({ kind, ref }) => [kind, ref]), [['weekly', 'gold-in-the-streams']])
  assert.equal(chronicleView(kept, { day: 20_000 }).journal.highlights[0].name, 'Gold in the Streams')
})
