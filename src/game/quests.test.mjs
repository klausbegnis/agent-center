import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { METRICS } from './achievement-metrics.mjs'
import { chronicleActions } from './chronicle.mjs'
import { createEngine } from './engine.mjs'
import { JOURNAL_COUNTERS } from './journal.mjs'
import { QUEST_SLOTS, questIndexOf, validateQuests } from './quest-content.mjs'
import { noteQuests, paceOf, rollQuests } from './quests.mjs'
import { emptySave } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('monsters.json'),
  items: readJson('items.json'),
  races: readJson('races.json'),
  bosses: readJson('bosses.json'),
  bestiary: readJson('bestiary.json'),
  cities: readJson('cities.json'),
  instances: readJson('instances.json'),
  traits: readJson('traits.json'),
  events: readJson('events.json'),
  quests: readJson('quests.json')
}
const engine = createEngine({ content })
const ROOM = 'local:/work/rumble-banana'
const OTHER = 'local:/work/turbo-waffle'
const DAY = 20_400
const MS = DAY * 86_400_000 + 9 * 3_600_000

/** A room with a party of two that has spent some tokens. */
function party(tokens = 3_000_000) {
  let save = emptySave()
  for (const [sessionId, activity] of [['first', 'write'], ['second', 'think']]) {
    save = engine.applyTokens(save, { projectId: ROOM, sessionId, tokens, activity, now: MS })
  }
  return save
}
/** A journal of played days before `day`, each with these counts. */
function withJournal(save, counts, days = 5) {
  const row = (day) => [day, ...JOURNAL_COUNTERS.map((name) => counts[name] ?? 0)]
  const rows = Array.from({ length: days }, (_, at) => row(DAY - days + at))
  return { ...save, journal: { days: rows, totals: JOURNAL_COUNTERS.map(() => 0), since: JOURNAL_COUNTERS.map(() => 0), seenAt: null, activeDays: days, highlights: [] } }
}
/** The day rolled for the main world. */
const rolled = (save, day = DAY) => noteQuests(save, { before: null, events: [], day, isNews: false }, content).save
const kill = (extra = {}) => ({ type: 'kill', roomId: ROOM, rank: 'normal', race: 'goblin', ...extra })
const withDaily = (save, change) => ({ ...save, worlds: { ...save.worlds, main: { ...save.worlds.main, daily: change(save.worlds.main.daily) } } })

test('the shipped quests are valid and can fill every slot', () => {
  assert.deepEqual(validateQuests(content.quests), [])
  assert.ok(validateQuests({ ...content.quests, kinds: content.quests.kinds.filter((kind) => !kind.slots.hard) }).some((problem) => problem.includes('hard')))
})

test('a day\'s three quests come from the world and the day alone: a reload shows the same ones', () => {
  const save = party()
  const first = rollQuests(save, 'main', DAY, content)
  assert.deepEqual(rollQuests(structuredClone(save), 'main', DAY, content), first)
  assert.deepEqual(first.map((quest) => quest.slot), QUEST_SLOTS)
  assert.equal(new Set(first.map((quest) => quest.kind)).size, 3)
  const days = new Set(Array.from({ length: 30 }, (_, at) => rollQuests(save, 'main', DAY + at, content).map((quest) => quest.kind).join()))
  assert.ok(days.size > 3, 'the days differ')
})

test('a quest is never one the world cannot finish today', () => {
  const save = party()
  for (let day = DAY; day < DAY + 60; day++) {
    for (const quest of rollQuests(save, 'main', day, content)) {
      assert.ok(quest.target >= 1, quest.kind)
      // No boss, coin, instance or rematch quest for a young world that has none of them.
      assert.ok(!['boss', 'coins', 'instance', 'rematch'].includes(quest.kind), `${quest.kind} on day ${day}`)
    }
  }
})

test('the amounts follow the world\'s own pace from the journal', () => {
  const save = party()
  const light = withJournal(save, { kills: 60, levels: 4, skillLevels: 2, materials: 2000 })
  const heavy = withJournal(save, { kills: 1200, bosses: 8, levels: 40, skillLevels: 9, materials: 90_000, coins: 5000 })
  assert.equal(paceOf(light, light.worlds.main, DAY, content.quests.defaults).kills, 60)
  assert.equal(paceOf(save, save.worlds.main, DAY, content.quests.defaults).kills, content.quests.defaults.kills, 'no journal: the defaults')
  const killTarget = (quests) => quests.find((quest) => quest.kind === 'kills')?.target
  let found = false
  for (let day = DAY; day < DAY + 40 && !found; day++) {
    const a = killTarget(rollQuests(light, 'main', day, content))
    const b = killTarget(rollQuests(heavy, 'main', day, content))
    if (a && b && rollQuests(light, 'main', day, content)[0].kind === rollQuests(heavy, 'main', day, content)[0].kind) {
      assert.ok(b > a * 10)
      found = true
    }
  }
  assert.ok(found)
})

test('a boss quest needs a world that meets bosses every day, and a coin quest one that earns coins every day', () => {
  const save = withJournal(party(), { kills: 1200, bosses: 8, coins: 5000, materials: 90_000 })
  const kinds = new Set(Array.from({ length: 60 }, (_, at) => rollQuests(save, 'main', DAY + at, content)).flat().map((quest) => quest.kind))
  assert.ok(kinds.has('boss'))
  assert.ok(kinds.has('coins'))
})

test('each kind counts what it names: kills, a race, elites, bosses', () => {
  const count = (kind, extra, events) => {
    const save = withDaily(rolled(party()), (daily) => ({ ...daily, quests: [{ kind, slot: 'easy', target: 100, progress: 0, done: false, reward: { ore: 1 }, ...extra }, ...daily.quests.slice(1).filter((quest) => quest.kind !== kind)].slice(0, 3) }))
    return noteQuests(save, { before: save, events, day: DAY }, content).save.worlds.main.daily.quests[0].progress
  }
  assert.equal(count('kills', {}, [kill(), kill(), { type: 'kill', roomId: OTHER, rank: 'normal' }]), 2)
  assert.equal(count('race', { race: 'werewolf' }, [kill(), kill({ race: 'werewolf' })]), 1)
  assert.equal(count('elites', {}, [kill({ rank: 'elite' }), kill({ rank: 'champion' }), kill()]), 2)
  assert.equal(count('boss', {}, [kill({ rank: 'boss' }), kill({ rank: 'legendary' }), kill({ rank: 'elite' })]), 2)
})

test('collect, coins and a trade are counted from what the world gained', () => {
  const base = rolled(party())
  const quest = (kind, extra = {}) => withDaily(base, (daily) => ({ ...daily, quests: [{ kind, slot: 'easy', target: 1000, progress: 0, done: false, reward: { ore: 1 }, ...extra }, ...daily.quests.slice(1).filter((each) => each.kind !== kind)].slice(0, 3) }))
  const withWorld = (save, change) => ({ ...save, worlds: { main: { ...save.worlds.main, ...change } } })
  const collect = quest('collect', { material: 'ore' })
  const richer = withWorld(collect, { materials: { ...collect.worlds.main.materials, ore: (collect.worlds.main.materials.ore ?? 0) + 40 } })
  assert.equal(noteQuests(richer, { before: collect, midway: richer, day: DAY }, content).save.worlds.main.daily.quests[0].progress, 40)
  assert.equal(noteQuests(richer, { before: collect, day: DAY }, content).save.worlds.main.daily.quests[0].progress, 0, 'no midway: an action, not earning')
  const coins = quest('coins')
  const paid = withWorld(coins, { coins: (coins.worlds.main.coins ?? 0) + 25 })
  assert.equal(noteQuests(paid, { before: coins, day: DAY }, content).save.worlds.main.daily.quests[0].progress, 25)
  const trade = quest('trade', { target: 1 })
  const sold = withWorld(trade, { market: { ...trade.worlds.main.market, pressure: { goldmill: { crops: 0.2 } } } })
  assert.equal(noteQuests(sold, { before: trade, day: DAY }, content).save.worlds.main.daily.quests[0].done, true)
})

test('a quest pays its reward once, the moment it is done, and all three pay the day\'s bonus once', () => {
  const start = withDaily(rolled(party()), (daily) => ({
    ...daily,
    quests: daily.quests.map((quest) => ({ ...quest, kind: quest.slot === 'easy' ? 'kills' : quest.slot === 'medium' ? 'elites' : 'boss', target: 1, progress: 0, done: false, reward: { ore: 10 } }))
  }))
  const ore = (save) => save.worlds.main.materials.ore ?? 0
  const one = noteQuests(start, { before: start, events: [kill()], day: DAY }, content)
  assert.equal(ore(one.save), ore(start) + 10)
  assert.deepEqual(one.news.map((news) => news.kind), ['done'])
  const again = noteQuests(one.save, { before: one.save, events: [kill()], day: DAY }, content)
  assert.equal(ore(again.save), ore(one.save), 'not paid twice')
  const all = noteQuests(again.save, { before: again.save, events: [kill({ rank: 'elite' }), kill({ rank: 'boss' })], day: DAY }, content)
  assert.deepEqual(all.news.map((news) => news.kind), ['done', 'done', 'day'])
  const daily = all.save.worlds.main.daily
  assert.equal(daily.bonus, true)
  assert.equal(daily.streak, 1)
  assert.deepEqual(daily.totals, [3, 1])
  assert.equal(METRICS.questsDone.measure(all.save, {}), 3)
  assert.equal(METRICS.questDays.measure(all.save, {}), 1)
  const after = noteQuests(all.save, { before: all.save, events: [kill({ rank: 'boss' })], day: DAY }, content)
  assert.deepEqual(after.news, [])
})

test('at midnight the day\'s quests roll anew; the streak stays through a day nobody played', () => {
  const done = withDaily(rolled(party()), (daily) => ({ ...daily, bonus: true, quests: daily.quests.map((quest) => ({ ...quest, progress: quest.target, done: true })), streak: 3, best: 3 }))
  const next = rolled(done, DAY + 1).worlds.main.daily
  assert.equal(next.day, DAY + 1)
  assert.ok(next.quests.every((quest) => !quest.done && quest.progress === 0))
  assert.equal(next.streak, 3, 'a finished day keeps the streak going')
  const unfinished = { ...rolled(done, DAY + 1) }
  // The next day was played (the journal counted kills) and left unfinished: the streak breaks.
  const played = withJournal(unfinished, { kills: 50 }, 0)
  played.journal.days = [[DAY + 1, ...JOURNAL_COUNTERS.map((name) => (name === 'kills' ? 50 : 0))]]
  assert.equal(rolled(played, DAY + 2).worlds.main.daily.streak, 0)
  // A day nobody worked does not.
  assert.equal(rolled(unfinished, DAY + 2).worlds.main.daily.streak, 3)
  assert.equal(rolled(unfinished, DAY + 9).worlds.main.daily.streak, 3, 'nor days the game did not run')
})

test('the day\'s quests are kept per world, and the content without quests leaves the save alone', () => {
  const save = party()
  const { quests: _quests, ...without } = content
  assert.equal(noteQuests(save, { before: null, day: DAY }, without).save, save)
  assert.equal(questIndexOf(without), null)
})

test('the chronicle rolls the day, counts it, tells it, and keeps quests in the journal\'s highlights', () => {
  const { chronicle, chronicleView } = chronicleActions(content)
  const save = party()
  const first = chronicle(save, { before: null, events: [], at: MS, day: DAY })
  const daily = first.save.worlds.main.daily
  assert.equal(daily.day, DAY)
  const ready = withDaily(first.save, (record) => ({ ...record, quests: record.quests.map((quest, at) => (at === 0 ? { ...quest, kind: 'kills', target: 1 } : quest)) }))
  const counted = chronicle(ready, { before: ready, events: [kill()], at: MS + 1000, day: DAY })
  assert.deepEqual(counted.quests.map((news) => news.kind), ['done'])
  assert.ok(counted.save.journal.highlights.some((highlight) => highlight.kind === 'quest' && highlight.ref === 'kills'))
  const view = chronicleView(counted.save, { day: DAY })
  assert.equal(view.quests.main.quests[0].done, true)
  assert.deepEqual(chronicleView(counted.save, { day: DAY + 1 }).quests, {}, 'yesterday\'s quests are not shown')
})
