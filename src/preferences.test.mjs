import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPreferences, RANDOM_THEME } from './preferences.mjs'

function setup(saved = {}) {
  const data = new Map(Object.entries(saved))
  const storage = {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => void data.set(key, value)
  }
  const safe = async (_label, run, fallback) => {
    try {
      return await run()
    } catch {
      return fallback
    }
  }
  const preferences = createPreferences({ storage, listThemeIds: () => ['pixel-dark', 'forest-camp'], safe })
  return { preferences, data }
}

test('starts on the built-in default theme with nothing hidden', async () => {
  const { preferences } = setup()
  await preferences.load()
  assert.deepEqual(preferences.snapshot(), { theme: 'pixel-dark', roomThemes: {}, hidden: [] })
})

test('loads what was saved, ignoring a theme that no longer exists', async () => {
  const { preferences } = setup({ theme: 'gone', roomThemes: { a: 'forest-camp' }, hiddenRooms: ['b'] })
  await preferences.load()
  assert.deepEqual(preferences.snapshot(), { theme: 'pixel-dark', roomThemes: { a: 'forest-camp' }, hidden: ['b'] })
})

test('setting the default theme saves it and refuses an unknown one', async () => {
  const { preferences, data } = setup()
  await preferences.setTheme('forest-camp')
  assert.equal(data.get('theme'), 'forest-camp')
  await assert.rejects(() => preferences.setTheme('nope'), /unknown theme/)
})

test('a room can pick a theme and go back to the default', async () => {
  const { preferences } = setup()
  await preferences.setRoomTheme('room-1', 'forest-camp')
  assert.deepEqual(preferences.snapshot().roomThemes, { 'room-1': 'forest-camp' })
  await preferences.setRoomTheme('room-1', null)
  assert.deepEqual(preferences.snapshot().roomThemes, {})
})

test('hiding a room twice lists it once, and showing it removes it', async () => {
  const { preferences } = setup()
  await preferences.setRoomHidden('room-1', true)
  await preferences.setRoomHidden('room-1', true)
  assert.deepEqual(preferences.snapshot().hidden, ['room-1'])
  await preferences.setRoomHidden('room-1', false)
  assert.deepEqual(preferences.snapshot().hidden, [])
})

test('the default theme can be Random: it is saved and reported as the theme', async () => {
  const { preferences, data } = setup()
  await preferences.setTheme(RANDOM_THEME)
  assert.equal(data.get('theme'), RANDOM_THEME)
  assert.equal(preferences.snapshot().theme, RANDOM_THEME)
})

test('a saved Random default is loaded again', async () => {
  const { preferences } = setup({ theme: RANDOM_THEME })
  await preferences.load()
  assert.equal(preferences.snapshot().theme, RANDOM_THEME)
})

test('a room cannot pick Random as its own theme', async () => {
  const { preferences } = setup()
  await preferences.setRoomTheme('room-1', RANDOM_THEME)
  assert.deepEqual(preferences.snapshot().roomThemes, {})
})

// The engine in ui/ keeps its own copy of this value; the two must stay equal.
test('the Random value is the one the engine expects', async () => {
  const engine = await import('../ui/engine/room-themes.js')
  assert.equal(RANDOM_THEME, engine.RANDOM_THEME)
})
