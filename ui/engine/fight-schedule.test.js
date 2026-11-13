import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFightSchedule, fightPeriodMs, moveOf, MOVE_MS, turnOrder } from './fight-schedule.js'

const TICK_MS = 250
const START = 1_000_000

const member = (id, classId) => ({ id, classId, place: `${id}-desk` })
const party = [member('pane-1', 'physical'), member('pane-2', 'magical'), member('pane-3', 'defense'),
  member('pane-4', 'support')]
const fight = (extra = {}) =>
  ({ members: party, periodMs: 10_000, monsterKey: 'wave-3', affix: null, hp: 900, maxHp: 1000, ...extra })

/** Ticks a schedule from `from` to `to` and returns every beat it started. */
function run(schedule, from, to) {
  const beats = []
  for (let now = from; now <= to; now += TICK_MS) beats.push(...schedule.tick(now))
  return beats
}

/** A schedule that has seen the fight long enough for everyone to have walked to their place. */
function settled(state = fight()) {
  const schedule = createFightSchedule('local:/work/rumble-banana')
  schedule.observe(state, START)
  run(schedule, START, START + 2_000)
  return schedule
}

test('a tick on screen lasts the tick the worker states, quicker with a higher attack speed', () => {
  assert.equal(fightPeriodMs(10, 1), 10_000)
  assert.equal(fightPeriodMs(10, 2), 5_000)
  assert.equal(fightPeriodMs(undefined, undefined), 10_000)
  assert.equal(fightPeriodMs(1000, 1), 15_000, 'never slower than the slowest pace')
})

test('each class has its own move, and a Guardian waits to raise its guard', () => {
  assert.equal(moveOf('physical'), 'strike')
  assert.equal(moveOf('magical'), 'cast')
  assert.equal(moveOf('support'), 'heal')
  assert.equal(moveOf('defense'), null)
})

test('in every tick each attacker acts once and the monster strikes once, twice when it is swift', () => {
  const beats = run(settled(), START + 2_000, START + 32_000)
  const moves = (motion) => beats.filter((beat) => beat.motion === motion).length
  assert.equal(moves('strike'), 3)
  assert.equal(moves('cast'), 3)
  assert.equal(moves('heal'), 3)
  assert.equal(moves('pounce'), 3)
  const swift = run(settled(fight({ affix: 'swift' })), START + 2_000, START + 32_000)
  assert.equal(swift.filter((beat) => beat.motion === 'pounce').length, 6)
})

test('turns are spaced out: no two moves of a tick start together', () => {
  const starts = run(settled(), START + 2_000, START + 32_000)
    .filter((beat) => ['strike', 'cast', 'heal', 'pounce'].includes(beat.motion))
    .map((beat) => beat.at)
    .sort((first, second) => first - second)
  const gaps = starts.slice(1).map((at, index) => at - starts[index])
  assert.ok(Math.min(...gaps) >= 10_000 / 4 * 0.75 - 1, `gaps ${gaps}`)
})

test('the order of turns changes from one tick to the next', () => {
  const order = (cycle) => turnOrder(party, cycle, false).map((turn) => turn.id ?? 'monster').join()
  assert.notEqual(order(0), order(1))
  assert.equal(order(0), order(3), 'three characters with a turn come round every three ticks')
})

test('a blow lands on the monster after the move starts, and a bolt lands later than a strike', () => {
  const beats = run(settled(), START + 2_000, START + 22_000)
  const landing = (attackerId) => {
    const start = beats.find((beat) => beat.id === attackerId && beat.motion !== 'hurt')
    const hit = beats.find((beat) =>
      beat.motion === 'flinch' && beat.targetId === attackerId && beat.at > start.at)
    return hit.at - start.at
  }
  assert.ok(landing('pane-2') > landing('pane-1'))
})

test('the monster strikes at the Guardian, who raises its guard, and with none somebody is hurt', () => {
  const beats = run(settled(), START + 2_000, START + 12_000)
  const pounce = beats.find((beat) => beat.motion === 'pounce')
  assert.equal(pounce.targetId, 'pane-3')
  assert.ok(beats.some((beat) => beat.motion === 'guard' && beat.id === 'pane-3' && beat.at === pounce.at))
  const unguarded = fight({ members: party.filter((item) => item.classId !== 'defense') })
  const hurt = run(settled(unguarded), START + 2_000, START + 22_000).filter((beat) => beat.motion === 'hurt')
  assert.ok(hurt.length > 0)
})

test('a healer\'s glow rises over the others in the party', () => {
  const heal = run(settled(), START + 2_000, START + 12_000).find((beat) => beat.motion === 'heal')
  assert.deepEqual(heal.otherIds.sort(), ['pane-1', 'pane-2', 'pane-3'])
})

test('an elite shows its affix: thorns answer a strike, a regenerating one mends', () => {
  const thorny = run(settled(fight({ affix: 'thorny' })), START + 2_000, START + 12_000)
  assert.ok(thorny.some((beat) => beat.motion === 'thorns' && beat.id === 'pane-1'))
  const mending = run(settled(fight({ affix: 'regenerating' })), START + 2_000, START + 12_000)
  assert.ok(mending.some((beat) => beat.motion === 'regen'))
})

test('nothing moves while there is no fight: the party waits, rests or is idle', () => {
  const schedule = settled()
  schedule.observe(null, START + 2_000)
  assert.deepEqual(run(schedule, START + 2_000, START + 30_000), [])
})

test('a character who just walked to its place waits before it fights', () => {
  const schedule = createFightSchedule('local:/work/rumble-banana')
  schedule.observe(fight(), START)
  const early = run(schedule, START, START + 1_100).filter((beat) => beat.who === 'member')
  assert.deepEqual(early, [])
})

test('a blow shows the health it took, measured from the health lost between states', () => {
  const schedule = settled(fight({ hp: 1000 }))
  const first = run(schedule, START + 2_000, START + 12_000).filter((beat) => beat.motion === 'flinch')
  assert.equal(first[0].damage, Math.round(1000 / 60), 'a first guess before any health was lost')
  schedule.observe(fight({ hp: 1000 - 40 * first.length }), START + 12_000)
  const next = run(schedule, START + 12_000, START + 22_000).find((beat) => beat.motion === 'flinch')
  assert.equal(next.damage, 40)
})

test('the same fight plays the same blows at the same moments', () => {
  const beats = () => run(settled(), START + 2_000, START + 22_000).map((beat) => `${beat.at}${beat.motion}`)
  assert.deepEqual(beats(), beats())
})

test('every move a beat can name has a length', () => {
  const beats = run(settled(fight({ affix: 'thorny' })), START, START + 30_000)
  const motions = new Set(beats.map((beat) => beat.motion))
  for (const motion of motions) assert.ok(MOVE_MS[motion] > 0, motion)
})
