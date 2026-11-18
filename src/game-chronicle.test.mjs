import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createAgentStore } from './domain/agent-store.mjs'
import { chronicleChange, localDayOf } from './game-chronicle.mjs'
import { loadGameEngine } from './game-files.mjs'
import { createGameMode } from './game-mode.mjs'
import { GAME_STORAGE_KEY, createGameSave } from './game-save.mjs'
import { SAVE_VERSION, emptyProject, emptySave, emptyWorld, migrate } from './game/worlds.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engine = loadGameEngine(ROOT, (message) => assert.fail(message))
const MINUTE = 60_000
const BANANA = 'local:/work/rumble-banana'
const WORKSPACES = [{ id: 'w-banana', path: '/work/rumble-banana', hostId: 'local', repoId: 'banana', name: 'main' }]

/** An old save, from before achievements: a room with a thousand kills. */
function oldSave() {
  const save = emptySave()
  save.worlds.main = { ...emptyWorld(), projects: { [BANANA]: { ...emptyProject(), kills: 1_000 } } }
  save.projectWorld[BANANA] = 'main'
  return save
}

/** A game over a fake Orca, on the estimate, with a clock the test moves. */
function setup({ stored = null } = {}) {
  let clock = 1_000 * MINUTE
  const storage = new Map(stored ? [[GAME_STORAGE_KEY, { version: 1, save: stored, bridge: {} }]] : [])
  const store = createAgentStore({ now: () => clock })
  store.setWorkspaces(WORKSPACES)
  const gameSave = createGameSave({
    storage: { get: async (key) => storage.get(key) ?? null, set: async (key, value) => storage.set(key, value) },
    migrate,
    saveVersion: SAVE_VERSION,
    log: () => {},
    setTimer: () => null,
    clearTimer: () => {}
  })
  const game = createGameMode({
    engine,
    gameSave,
    readSettings: async () => ({ gameMode: true }),
    writeSetting: async () => {},
    access: () => ({ supported: false, granted: false }),
    readHistory: async () => assert.fail('the estimate never reads the history'),
    readWorkspaces: async () => [],
    readWorkMeters: () => ({}),
    store,
    preferences: { snapshot: () => ({ theme: 'pixel-dark', roomThemes: {} }) },
    now: () => clock,
    log: () => {},
    onChange: () => {}
  })
  return { game, tick: (ms) => (clock += ms) }
}

test('the local day rolls over at local midnight, not at midnight in UTC', () => {
  const lateEvening = Date.UTC(2026, 10, 18, 22, 59)
  const afterMidnight = Date.UTC(2026, 10, 18, 23, 1)
  // An hour ahead of UTC: 23:59 and 00:01 there.
  const ahead = () => -60
  assert.equal(localDayOf(afterMidnight, ahead) - localDayOf(lateEvening, ahead), 1)
  assert.equal(localDayOf(afterMidnight, () => 0), localDayOf(lateEvening, () => 0))
})

test('an old save is back-filled at its first round with one notice, not one per achievement', async () => {
  const { game } = setup({ stored: oldSave() })
  await game.round()
  const view = game.getView()
  assert.equal(view.achievements.earned, 3)
  assert.equal(view.achievements.filled, 3)
  const notices = view.recent.filter((event) => event.type === 'achievement')
  assert.deepEqual(notices.map((event) => [event.kind, event.count]), [['backfill', 3]])
})

test('an achievement earned by a change is news, with its name and points', () => {
  const before = { ...oldSave(), achievements: { earned: {}, titles: {}, filled: 0 } }
  const after = { ...before, worlds: { main: { ...before.worlds.main, projects: { [BANANA]: { ...emptyProject(), kills: 1 } } } } }
  const told = chronicleChange(engine, { before, save: after, at: 1, isNews: true, dayOf: () => 20_000 })
  assert.deepEqual(told.news[0], { type: 'achievement', kind: 'earned', achievement: 'monsters-1', name: 'First Blood', points: 5, title: null })
  // The journal's first day, opened by that achievement, earns the first day's achievement in the same change.
  assert.deepEqual(told.news.map((event) => event.achievement), ['monsters-1', 'active-days-1'])
  assert.equal(told.save.journal.highlights[0].ref, 'monsters-1')
})

test('an imported game is no news: nothing goes into the journal', () => {
  const told = chronicleChange(engine, { before: emptySave(), save: oldSave(), at: 1, isNews: false, dayOf: () => 20_000 })
  assert.deepEqual(told.news, [])
  assert.equal(told.save.journal, undefined)
  assert.equal(Object.keys(told.save.achievements.earned).length, 3)
})

test('a room\'s party wears a title it earned, and an unearned one is refused with the reason', async () => {
  const save = oldSave()
  save.worlds.main.projects[BANANA].kills = 10_000
  const { game } = setup({ stored: save })
  await game.round()
  await assert.rejects(game.setPartyTitle({ roomId: BANANA, achievementId: 'monsters-5' }), /not been earned/)
  assert.deepEqual(await game.setPartyTitle({ roomId: BANANA, achievementId: 'monsters-4' }), { changed: true })
  assert.deepEqual(game.getView().achievements.partyTitles[BANANA], { id: 'monsters-4', title: 'the Relentless' })
  await assert.rejects(game.setPartyTitle({ roomId: 'local:/work/cosmic-llama', achievementId: null }), /unknown room/)
})

test('looking at the summary marks what was new as read', async () => {
  const save = oldSave()
  save.achievements = { earned: {}, titles: {}, filled: 0 }
  const { game, tick } = setup({ stored: save })
  await game.round()
  assert.equal(game.getView().journal.unread, true)
  tick(MINUTE)
  await game.markSummarySeen()
  const { journal } = game.getView()
  assert.equal(journal.unread, false)
  assert.equal(journal.since.achievements, 0)
  assert.ok(journal.today.achievements >= 3)
})

test('the time until the next local day is measured to the day\'s real start, clock changes included', async () => {
  const { msToNextDay } = await import('./game-chronicle.mjs')
  const HOUR = 3_600_000
  const utc = () => 0
  const at = Date.UTC(2026, 10, 18, 21, 30)
  assert.ok(Math.abs(msToNextDay(at, localDayOf(at, utc), (ms) => localDayOf(ms, utc)) - 2.5 * HOUR) <= 1000)
  // A clock put an hour forward at 22:00 UTC, as when the clocks change: the day ends an hour sooner.
  const shifted = (ms) => (ms >= Date.UTC(2026, 10, 18, 22) ? -60 : 0)
  const dayOf = (ms) => localDayOf(ms, shifted)
  assert.ok(Math.abs(msToNextDay(at, dayOf(at), dayOf) - 1.5 * HOUR) <= 1000)
})
