import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEngine } from './engine.mjs'
import { checkDaily, normalizeDaily } from './quest-save.mjs'
import { noteQuests } from './quests.mjs'
import { emptySave, migrate } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const quests = readJson('quests.json')
const content = { monsters: readJson('monsters.json'), items: readJson('items.json'), quests }
const engine = createEngine({ content })
const ROOM = 'local:/work/rumble-banana'
const DAY = 20_400

function played() {
  const save = engine.applyTokens(emptySave(), { projectId: ROOM, sessionId: 'first', tokens: 2_000_000, activity: 'write', now: DAY * 86_400_000 })
  return noteQuests(save, { before: null, day: DAY, isNews: false }, content).save
}

test('a save from before the daily quests loads with everything it had and no day', () => {
  const save = engine.applyTokens(emptySave(), { projectId: ROOM, sessionId: 'first', tokens: 2_000_000, activity: 'write', now: 0 })
  assert.deepEqual(migrate(structuredClone(save)), save)
  const checked = engine.cleanSave(structuredClone(save))
  assert.equal(checked.ok, true)
  assert.equal(checked.save.worlds.main.daily, undefined)
})

test('a day of quests round-trips through migrate and the save check unchanged', () => {
  const save = played()
  assert.ok(save.worlds.main.daily)
  assert.deepEqual(migrate(structuredClone(save)), save)
  assert.deepEqual(engine.cleanSave(structuredClone(save)), { ok: true, save })
})

test('migrate drops a broken day, which the next change rolls again', () => {
  const daily = played().worlds.main.daily
  assert.deepEqual(normalizeDaily(daily), daily)
  assert.equal(normalizeDaily({ ...daily, day: -1 }), null)
  assert.equal(normalizeDaily({ ...daily, quests: daily.quests.slice(1) }), null)
  assert.equal(normalizeDaily({ ...daily, extra: 1 }), null)
})

test('the save check refuses a day the engine never writes', () => {
  const daily = played().worlds.main.daily
  const refuse = (value, text) => {
    const result = checkDaily(value, quests)
    assert.equal(result.ok, false)
    assert.ok(result.problem.join(' ').includes(text), result.problem.join(' '))
  }
  const quest = daily.quests[0]
  const withQuest = (change) => ({ ...daily, quests: [{ ...quest, ...change }, ...daily.quests.slice(1)] })
  refuse(withQuest({ kind: 'dancing' }), 'kind')
  refuse(withQuest({ progress: quest.target + 1 }), 'up to the target')
  refuse(withQuest({ progress: quest.target, done: false }), 'whether the target is reached')
  refuse(withQuest({ material: 'gold' }), 'material')
  refuse(withQuest({ reward: { gold: 3 } }), 'materials')
  refuse({ ...daily, quests: [daily.quests[0], daily.quests[0], daily.quests[0]] }, 'a kind twice')
  refuse({ ...daily, bonus: true }, 'every quest is done')
  refuse({ ...daily, streak: 5, best: 2 }, 'up to the best')
  refuse({ ...daily, totals: [1] }, 'quests and days done')
  assert.equal(checkDaily(daily, undefined).ok, false, 'a game without daily quests keeps none')
  assert.deepEqual(checkDaily(undefined, undefined), { ok: true, value: null })
})
