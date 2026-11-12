import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  chooseEmote,
  createEmoteSchedule,
  DEFAULT_EMOTES,
  EMOTE_MOTIONS,
  emoteRound,
  emotesFor,
  emoteTime,
  familiarEmotesFor,
  paceFor
} from './emotes.js'

const pace = paceFor('normal')
const HOUR_MS = 3_600_000
const TICK_MS = 250

const stretch = { id: 'stretch', on: ['run'], motion: 'stretch', seconds: 2 }
const spell = { id: 'spell', on: ['run'], motion: 'float', seconds: 2 }
const cheer = { id: 'cheer', on: ['sleep'], when: 'start', motion: 'hop', seconds: 1 }
const themeWith = (emotes, familiar) => ({ actors: { emotes, familiar } })

const character = (id, activity = 'run', place = 'a') => ({ id, activity, place, isFamiliar: false })

/** Ticks a schedule from `from` to `to` and returns what started, with the time it did. */
function run(schedule, from, to) {
  const started = []
  for (let now = from; now <= to; now += TICK_MS) {
    for (const item of schedule.tick(now).started) started.push({ ...item, at: now })
  }
  return started
}

test('the normal pace is the default, and an unknown or "off" pace means no emotes', () => {
  assert.equal(paceFor(), paceFor('normal'))
  assert.equal(paceFor('off'), null)
  assert.equal(paceFor('constructor'), null)
  assert.ok(paceFor('fast').periodMs < pace.periodMs)
})

test('a theme without emotes gets the default set, and an empty list means none', () => {
  assert.equal(emotesFor(themeWith(undefined)), DEFAULT_EMOTES)
  assert.deepEqual(emotesFor(themeWith([])), [])
  assert.deepEqual(emotesFor(themeWith([stretch])), [stretch])
})

test('the default emotes use only motions the engine has', () => {
  for (const emote of DEFAULT_EMOTES) assert.ok(EMOTE_MOTIONS.includes(emote.motion), emote.id)
})

test('familiars emote only when the theme lists motions for them', () => {
  assert.deepEqual(familiarEmotesFor(themeWith([], { symbol: 'pet' })), [])
  assert.deepEqual(familiarEmotesFor(themeWith([])), [])
  const emotes = familiarEmotesFor(themeWith([], { symbol: 'pet', emotes: ['hop', 'spin'] }))
  assert.deepEqual(emotes.map((emote) => emote.motion), ['hop', 'spin'])
})

test('two emotes in a row of one character are 20 to 60 seconds apart', () => {
  for (const id of ['pane-1', 'pane-2', 'pane-3/sub-1']) {
    for (let round = 0; round < 200; round++) {
      const gap = emoteTime(id, round + 1, pace) - emoteTime(id, round, pace)
      assert.ok(gap > 20_000 && gap < 60_000, `${id} round ${round}: ${gap} ms`)
    }
  }
})

test('the same character emotes at the same times after a reload', () => {
  assert.equal(emoteTime('pane-1', 7, pace), emoteTime('pane-1', 7, pace))
  assert.notEqual(emoteTime('pane-1', 7, pace), emoteTime('pane-2', 7, pace))
})

test('an emote is due in the stretch of time that holds its moment and in no other', () => {
  const time = emoteTime('pane-1', 12, pace)
  assert.equal(emoteRound('pane-1', time - 100, time, pace), 12)
  assert.equal(emoteRound('pane-1', time - 1, time + 300, pace), 12)
  assert.equal(emoteRound('pane-1', time, time + 300, pace), null)
  assert.equal(emoteRound('pane-1', time - 300, time - 1, pace), null)
})

test('an emote is picked among those that fit the activity', () => {
  const emotes = [stretch, spell, cheer]
  const picked = new Set()
  for (let round = 0; round < 40; round++) {
    picked.add(chooseEmote(emotes, character('pane-1'), ['sometimes'], round).id)
  }
  assert.deepEqual([...picked].sort(), ['spell', 'stretch'])
  assert.equal(chooseEmote(emotes, character('pane-1', 'wait'), ['sometimes'], 1), null)
})

test('the same character and round always give the same emote', () => {
  const emotes = [stretch, spell]
  const first = chooseEmote(emotes, character('pane-1'), ['sometimes'], 5)
  assert.equal(chooseEmote(emotes, character('pane-1'), ['sometimes'], 5), first)
})

test('a start emote is not picked as an occasional one', () => {
  assert.equal(chooseEmote([cheer], character('pane-1', 'sleep'), ['sometimes'], 3), null)
  assert.equal(chooseEmote([cheer], character('pane-1', 'sleep'), ['start'], 3), cheer)
})

test('a character at work emotes now and then, never twice at once', () => {
  const schedule = createEmoteSchedule(themeWith([stretch]), pace)
  schedule.observe([character('pane-1')], 0)
  const started = run(schedule, 0, 10 * 60_000)
  // Ten minutes at one emote every 40 seconds on average.
  assert.ok(started.length >= 13 && started.length <= 16, `${started.length} emotes`)
  for (let index = 1; index < started.length; index++) {
    assert.ok(started[index].at - started[index - 1].at >= 20_000)
  }
})

test('the characters of a room do not emote in unison', () => {
  const schedule = createEmoteSchedule(themeWith([stretch]), pace)
  const ids = ['pane-1', 'pane-2', 'pane-3', 'pane-4', 'pane-5', 'pane-6']
  schedule.observe(ids.map((id) => character(id, 'run', id)), 0)
  const perTick = new Map()
  for (const { at } of run(schedule, 0, 5 * 60_000)) perTick.set(at, (perTick.get(at) ?? 0) + 1)
  assert.ok(perTick.size > 20)
  assert.ok(Math.max(...perTick.values()) <= 2)
})

test('an emote ends after its duration and is reported once', () => {
  const schedule = createEmoteSchedule(themeWith([stretch]), pace)
  schedule.observe([character('pane-1')], 0)
  const [first] = run(schedule, 0, 2 * 60_000)
  const fresh = createEmoteSchedule(themeWith([stretch]), pace)
  fresh.observe([character('pane-1')], 0)
  run(fresh, 0, first.at)
  assert.deepEqual(fresh.tick(first.at + 1_900).ended, [])
  assert.deepEqual(fresh.tick(first.at + 2_000).ended, ['pane-1'])
  assert.deepEqual(fresh.tick(first.at + 2_250).ended, [])
})

test('no emote plays when nothing fits what the character is doing', () => {
  const schedule = createEmoteSchedule(themeWith([stretch]), pace)
  schedule.observe([character('pane-1', 'wait')], 0)
  assert.deepEqual(run(schedule, 0, 5 * 60_000), [])
})

test('a character that just finished cheers right away, once it has arrived', () => {
  const schedule = createEmoteSchedule(themeWith([stretch, cheer]), pace)
  schedule.observe([character('pane-1', 'run', 'desk')], HOUR_MS)
  schedule.tick(HOUR_MS + 5_000)
  schedule.observe([character('pane-1', 'sleep', 'bed')], HOUR_MS + 5_000)
  // Still walking to the bed.
  assert.deepEqual(schedule.tick(HOUR_MS + 5_500).started, [])
  const { started } = schedule.tick(HOUR_MS + 6_250)
  assert.deepEqual(started, [{ id: 'pane-1', emote: cheer }])
  assert.deepEqual(run(schedule, HOUR_MS + 6_500, HOUR_MS + 5 * 60_000), [])
})

test('a character that is new to the room is not greeted with a start emote', () => {
  const schedule = createEmoteSchedule(themeWith([cheer]), pace)
  schedule.observe([character('pane-1', 'sleep')], 0)
  assert.deepEqual(run(schedule, 0, 60_000), [])
})

test('a character that sets off walking stops its emote and starts none on the way', () => {
  const schedule = createEmoteSchedule(themeWith([stretch]), pace)
  schedule.observe([character('pane-1', 'run', 'desk')], 0)
  const [first] = run(schedule, 0, 2 * 60_000)
  const fresh = createEmoteSchedule(themeWith([stretch]), pace)
  fresh.observe([character('pane-1', 'run', 'desk')], 0)
  run(fresh, 0, first.at)
  assert.deepEqual(fresh.observe([character('pane-1', 'run', 'console')], first.at + 500), ['pane-1'])
  assert.deepEqual(fresh.tick(first.at + 750), { started: [], ended: [] })
})

test('an emote due during a walk is skipped, not played late', () => {
  const due = emoteTime('pane-1', 3, pace)
  const schedule = createEmoteSchedule(themeWith([stretch]), pace)
  schedule.observe([character('pane-1', 'run', 'desk')], due - 500)
  schedule.tick(due - 250)
  assert.deepEqual(run(schedule, due, due + 5_000), [])
})

test('a character that left the room has its emote stopped', () => {
  const schedule = createEmoteSchedule(themeWith([stretch]), pace)
  schedule.observe([character('pane-1')], 0)
  const [first] = run(schedule, 0, 2 * 60_000)
  const fresh = createEmoteSchedule(themeWith([stretch]), pace)
  fresh.observe([character('pane-1')], 0)
  run(fresh, 0, first.at)
  assert.deepEqual(fresh.observe([], first.at + 250), ['pane-1'])
  assert.deepEqual(fresh.tick(first.at + 5_000), { started: [], ended: [] })
})

test('after a long pause the characters do not all emote at once', () => {
  const schedule = createEmoteSchedule(themeWith([stretch]), pace)
  const ids = Array.from({ length: 12 }, (_, index) => `pane-${index}`)
  schedule.observe(ids.map((id) => character(id, 'run', id)), 0)
  schedule.tick(1_000)
  const { started } = schedule.tick(1_000 + HOUR_MS)
  assert.ok(started.length <= 2, `${started.length} started together`)
})

test('stopping everything reports who was playing and lets them emote again later', () => {
  const schedule = createEmoteSchedule(themeWith([stretch]), pace)
  schedule.observe([character('pane-1')], 0)
  const [first] = run(schedule, 0, 2 * 60_000)
  assert.deepEqual(schedule.stopAll(), [])
  const fresh = createEmoteSchedule(themeWith([stretch]), pace)
  fresh.observe([character('pane-1')], 0)
  run(fresh, 0, first.at)
  assert.deepEqual(fresh.stopAll(), ['pane-1'])
  assert.deepEqual(fresh.stopAll(), [])
  assert.equal(run(fresh, first.at + 250, first.at + 2 * 60_000).length > 0, true)
})

test('familiars emote more rarely than agents, with the motions their theme lists', () => {
  const theme = themeWith([stretch], { symbol: 'pet', emotes: ['hop'] })
  const schedule = createEmoteSchedule(theme, pace)
  schedule.observe([character('pane-1'), { ...character('pane-1/sub-1'), isFamiliar: true }], 0)
  const started = run(schedule, 0, 30 * 60_000)
  const ofAgent = started.filter((item) => item.id === 'pane-1')
  const ofFamiliar = started.filter((item) => item.id === 'pane-1/sub-1')
  assert.ok(ofFamiliar.length > 0 && ofFamiliar.length < ofAgent.length / 2)
  assert.ok(ofFamiliar.every((item) => item.emote.motion === 'hop'))
})

test('the fast pace plays every emote in turn every few seconds, start emotes included', () => {
  const schedule = createEmoteSchedule(themeWith([cheer]), paceFor('fast'))
  schedule.observe([character('pane-1', 'sleep')], 0)
  const started = run(schedule, 0, 60_000)
  assert.ok(started.length >= 8, `${started.length} emotes in a minute`)
  assert.ok(started.every((item) => item.emote === cheer))
})

test('an unseen finish keeps playing the finishing emote, not just once', () => {
  const schedule = createEmoteSchedule(themeWith([stretch, cheer]), pace)
  schedule.observe([character('a', 'done')], 0)
  const started = run(schedule, 0, HOUR_MS / 6)
  assert.ok(started.length >= 5, `only ${started.length} emotes in ten minutes`)
  assert.ok(started.every((item) => item.emote.id === 'cheer'))
})

test('going to sleep after being seen does not play the finishing emote again', () => {
  const schedule = createEmoteSchedule(themeWith([cheer]), pace)
  schedule.observe([character('a', 'done')], 0)
  run(schedule, 0, 5_000)
  schedule.observe([character('a', 'sleep')], 5_000)
  assert.deepEqual(run(schedule, 5_000, HOUR_MS / 6), [])
})
