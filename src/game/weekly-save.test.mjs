import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import { cleanSave } from './save-check.mjs'
import { checkWeekly, normalizeWeekly } from './weekly-save.mjs'
import { emptySave, migrate } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const events = readJson('events.json')
const content = { monsters: readJson('monsters.json'), items: readJson('items.json'), events }
const engine = createEngine({ content })
const ROOM = 'local:/work/rumble-banana'
const WEDNESDAY = Date.parse('2026-11-18T12:00:00Z')
const valid = { week: '2026-W47', event: 'clear-skies', progress: 12, done: false, seenAt: WEDNESDAY }
/** Clear Skies' goal. */
const GOAL = events.events.find((event) => event.id === 'clear-skies').goal.count

/** A played save from before the weekly events: one room, one character, a little fighting. */
function oldSave() {
  const save = engine.applyTokens(emptySave(), { projectId: ROOM, sessionId: 'first', tokens: 2_000_000, activity: 'write', now: WEDNESDAY })
  return { ...save, worlds: { main: { ...save.worlds.main, coins: 40 } } }
}

test('a save from before the weekly events loads with everything it had and no week', () => {
  const save = oldSave()
  assert.deepEqual(migrate(structuredClone(save)), save)
  const checked = engine.cleanSave(structuredClone(save))
  assert.equal(checked.ok, true)
  assert.equal(checked.save.worlds.main.weekly, undefined)
  assert.equal(checked.save.worlds.main.coins, 40)
})

test('a played week round-trips through migrate and the save check unchanged', () => {
  const save = engine.advance(oldSave(), { from: WEDNESDAY, to: WEDNESDAY + 3_600_000, sessions: [] })
  assert.ok(save.worlds.main.weekly)
  assert.deepEqual(migrate(structuredClone(save)), save)
  assert.deepEqual(engine.cleanSave(structuredClone(save)), { ok: true, save })
})

test('migrate keeps a well formed week and drops a broken one, which the next advance starts again', () => {
  assert.deepEqual(normalizeWeekly(valid), valid)
  assert.equal(normalizeWeekly({ ...valid, week: 'soon' }), null)
  assert.equal(normalizeWeekly({ ...valid, progress: -1 }), null)
  assert.equal(normalizeWeekly({ ...valid, seenAt: WEDNESDAY + 7 * 86_400_000 }), null)
  assert.equal(normalizeWeekly({ ...valid, extra: 1 }), null)
  const broken = { ...oldSave(), worlds: { main: { ...oldSave().worlds.main, weekly: 'yes' } } }
  assert.equal(migrate(broken).worlds.main.weekly, undefined)
})

test('the save check refuses a week the content cannot have', () => {
  const refuse = (weekly, text) => {
    const result = checkWeekly(weekly, events)
    assert.equal(result.ok, false)
    assert.ok(result.problem.join(' ').includes(text), result.problem.join(' '))
  }
  assert.deepEqual(checkWeekly(valid, events), { ok: true, value: valid })
  refuse({ ...valid, event: 'no-such-event' }, 'not an event')
  refuse({ ...valid, progress: GOAL + 1 }, 'past its goal')
  refuse({ ...valid, progress: 9999 }, 'whole number')
  refuse({ ...valid, progress: GOAL, done: false }, 'whether the goal is reached')
  refuse({ ...valid, done: true }, 'whether the goal is reached')
  refuse({ ...valid, week: '2027-W53' }, 'ISO week')
  refuse({ ...valid, seenAt: 0 }, 'in its week')
  assert.equal(checkWeekly(valid, null).ok, false, 'a game without weekly events keeps none')
  assert.deepEqual(checkWeekly(undefined, null), { ok: true, value: null })
  const save = { ...oldSave(), worlds: { main: { ...oldSave().worlds.main, weekly: { ...valid, event: 'no-such-event' } } } }
  const checked = cleanSave(save, { events })
  assert.equal(checked.ok, false)
  assert.ok(checked.problem.includes('worlds.main.weekly.event'), checked.problem)
})
