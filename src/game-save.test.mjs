import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GAME_STORAGE_KEY, STORED_VERSION, createGameSave, fitForStorage } from './game-save.mjs'
import { SAVE_VERSION, emptySave, migrate } from './game/worlds.mjs'

/** A storage in memory that can be told to fail, and a timer the test fires by hand. */
function setup({ stored, failGet = false } = {}) {
  const values = new Map(stored === undefined ? [] : [[GAME_STORAGE_KEY, stored]])
  const writes = []
  const logs = []
  const timers = []
  const storage = {
    failSet: false,
    get: async (key) => {
      if (failGet) throw new Error('disk asleep')
      return values.get(key) ?? null
    },
    set: async (key, value) => {
      if (storage.failSet) throw new Error('disk full')
      values.set(key, value)
      writes.push(value)
    }
  }
  const gameSave = createGameSave({
    storage,
    migrate,
    saveVersion: SAVE_VERSION,
    log: (message) => logs.push(message),
    setTimer: (run) => timers.push(run),
    clearTimer: () => {}
  })
  const fireTimers = async () => {
    while (timers.length) await timers.shift()()
    await gameSave.flush()
  }
  return { gameSave, storage, values, writes, logs, timers, fireTimers }
}

const progressed = () => ({ ...emptySave(), projectWorld: { 'local:/work/rumble-banana': 'main' } })

test('nothing stored loads an empty game with nothing watched yet', async () => {
  const { gameSave } = setup()
  const data = await gameSave.load()
  assert.deepEqual(data.save, emptySave())
  assert.deepEqual(data.bridge, { baselines: {}, watchedUntil: null, autoSpend: false, tokenSource: null })
})

test('a stored game comes back with its baselines and settings', async () => {
  const bridge = { baselines: { 's1': { total: 10, at: 5 } }, watchedUntil: 5, autoSpend: true, tokenSource: 'estimated' }
  const { gameSave } = setup({ stored: { version: STORED_VERSION, save: progressed(), bridge } })
  const data = await gameSave.load()
  assert.deepEqual(data.save.projectWorld, { 'local:/work/rumble-banana': 'main' })
  assert.deepEqual(data.bridge, bridge)
})

test('a save watched before the estimate existed is known to come from the session history', async () => {
  const bridge = { baselines: {}, watchedUntil: 5, autoSpend: false }
  const { gameSave } = setup({ stored: { version: STORED_VERSION, save: progressed(), bridge } })
  const data = await gameSave.load()
  assert.equal(data.bridge.tokenSource, 'history')
})

test('a change is written once after the delay, not on every change', async () => {
  const { gameSave, writes, timers, fireTimers } = setup()
  const data = await gameSave.load()
  gameSave.set({ ...data, bridge: { ...data.bridge, autoSpend: true } })
  gameSave.set({ ...data, bridge: { ...data.bridge, watchedUntil: 9 } })
  assert.equal(timers.length, 1)
  assert.equal(writes.length, 0)
  await fireTimers()
  assert.equal(writes.length, 1)
  assert.equal(writes[0].bridge.watchedUntil, 9)
  assert.equal(writes[0].version, STORED_VERSION)
})

test('flushing writes what is pending at once, and nothing when nothing changed', async () => {
  const { gameSave, writes } = setup()
  const data = await gameSave.load()
  await gameSave.flush()
  assert.equal(writes.length, 0)
  gameSave.set(data)
  await gameSave.flush()
  assert.equal(writes.length, 1)
})

test('a save from a newer plugin is never overwritten', async () => {
  const newer = { version: STORED_VERSION, save: { ...progressed(), version: SAVE_VERSION + 1 }, bridge: {} }
  const { gameSave, values, writes } = setup({ stored: newer })
  await gameSave.load()
  assert.equal(gameSave.isFromNewerVersion(), true)
  gameSave.set({ save: emptySave(), bridge: { baselines: {}, watchedUntil: 1, autoSpend: false } })
  await gameSave.flush()
  assert.equal(writes.length, 0)
  assert.equal(values.get(GAME_STORAGE_KEY), newer)
})

test('a wrapper from a newer plugin is never overwritten either', async () => {
  const { gameSave, writes } = setup({ stored: { version: STORED_VERSION + 1 } })
  await gameSave.load()
  assert.equal(gameSave.isFromNewerVersion(), true)
  gameSave.set(gameSave.get())
  await gameSave.flush()
  assert.equal(writes.length, 0)
})

test('a storage that cannot be read leaves the game playing and the stored value untouched', async () => {
  const { gameSave, writes, logs } = setup({ failGet: true })
  const data = await gameSave.load()
  assert.deepEqual(data.save, emptySave())
  gameSave.set(data)
  await gameSave.flush()
  assert.equal(writes.length, 0)
  assert.equal(logs.length, 1)
})

test('a failed write is reported once and tried again on the next flush', async () => {
  const { gameSave, storage, writes, logs } = setup()
  const data = await gameSave.load()
  storage.failSet = true
  gameSave.set(data)
  await gameSave.flush()
  await gameSave.flush()
  assert.equal(logs.length, 1)
  storage.failSet = false
  await gameSave.flush()
  assert.equal(writes.length, 1)
})

test('garbage in storage loads as an empty game', async () => {
  const { gameSave } = setup({ stored: 'not a save' })
  const data = await gameSave.load()
  assert.deepEqual(data.save, emptySave())
})

/** A save whose one room has many retirees, each with a long title. */
function crowdedValue(retireeCount) {
  const retirees = Array.from({ length: retireeCount }, (_, index) =>
    ({ sessionId: `s${index}`, nameId: index, title: 'x'.repeat(80), retiredAt: retireeCount - index }))
  const project = { retirees, retiredCount: 3 }
  const save = { ...emptySave(), worlds: { main: { projects: { 'local:/work/rumble-banana': project } } } }
  const baselines = Object.fromEntries(Array.from({ length: 900 }, (_, index) => [`b${index}`, { total: 1, at: index }]))
  return { version: STORED_VERSION, save, bridge: { baselines, watchedUntil: 1, autoSpend: false } }
}

test('a save that fits is stored as it is', () => {
  const value = crowdedValue(2)
  assert.equal(fitForStorage(value).value, value)
})

test('a save too large for one key drops old baselines, then folds old retirees into the count', () => {
  const value = crowdedValue(50)
  const roomOf = (fitted) => fitted.save.worlds.main.projects['local:/work/rumble-banana']
  const small = fitForStorage(value, 20_000)
  assert.equal(small.fits, true)
  assert.ok(Object.keys(small.value.bridge.baselines).length <= 200)
  const room = roomOf(small.value)
  assert.equal(room.retirees.length + room.retiredCount, 53)
  assert.equal(room.retirees[0].sessionId, 's0')
})

test('a save that cannot be made to fit is reported, not written', async () => {
  assert.equal(fitForStorage(crowdedValue(50), 100).fits, false)
})
