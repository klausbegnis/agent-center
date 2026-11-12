import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assignThemes, defaultThemeIds, RANDOM_THEME, themeIdsToLoad } from './room-themes.js'

const THEME_IDS = ['meadow', 'harbour', 'attic']
const rooms = (count) =>
  Array.from({ length: count }, (_, index) => ({ id: `build-box:/work/project-${index}` }))
const random = (roomThemes = {}, usableThemeIds = THEME_IDS) => ({
  defaultTheme: RANDOM_THEME,
  roomThemes,
  usableThemeIds
})
const state = (theme, roomThemes = {}) => ({ theme, roomThemes, themes: THEME_IDS.map((id) => ({ id })) })

function countByTheme(assigned) {
  const counts = {}
  for (const themeId of assigned.values()) counts[themeId] = (counts[themeId] ?? 0) + 1
  return counts
}

test('with a real default theme, every room that picked none uses it', () => {
  const list = rooms(3)
  const assigned = assignThemes(list, { defaultTheme: 'harbour', roomThemes: {}, usableThemeIds: THEME_IDS })
  assert.deepEqual([...assigned.values()], ['harbour', 'harbour', 'harbour'])
})

test('a room that picked its own theme keeps it, under a real default and under Random', () => {
  const list = rooms(4)
  const roomThemes = { [list[1].id]: 'attic' }
  const fixed = assignThemes(list, { defaultTheme: 'meadow', roomThemes, usableThemeIds: THEME_IDS })
  assert.equal(fixed.get(list[1].id), 'attic')
  assert.equal(assignThemes(list, random(roomThemes)).get(list[1].id), 'attic')
})

test('a room whose own theme is not usable falls back to the default', () => {
  const list = rooms(2)
  const roomThemes = { [list[0].id]: 'gone' }
  const fixed = assignThemes(list, { defaultTheme: 'meadow', roomThemes, usableThemeIds: THEME_IDS })
  assert.equal(fixed.get(list[0].id), 'meadow')
  assert.ok(THEME_IDS.includes(assignThemes(list, random(roomThemes)).get(list[0].id)))
})

test('under Random, rooms get different themes while there are enough themes', () => {
  const assigned = assignThemes(rooms(3), random())
  assert.equal(new Set(assigned.values()).size, 3)
})

test('under Random, with more rooms than themes the repeats are even', () => {
  assert.deepEqual(countByTheme(assignThemes(rooms(6), random())), { meadow: 2, harbour: 2, attic: 2 })
  const uneven = Object.values(countByTheme(assignThemes(rooms(7), random()))).sort()
  assert.deepEqual(uneven, [2, 2, 3])
})

test('under Random, a room always gets the same theme', () => {
  const list = rooms(5)
  assert.deepEqual(assignThemes(list, random()), assignThemes(list, random()))
})

test('under Random, the result does not depend on the order of the rooms or of the themes', () => {
  const list = rooms(5)
  const forward = assignThemes(list, random())
  const backward = assignThemes([...list].reverse(), random({}, [...THEME_IDS].reverse()))
  for (const room of list) assert.equal(forward.get(room.id), backward.get(room.id))
})

test('under Random, the themes rooms picked themselves count when spreading the others', () => {
  const list = rooms(3)
  const assigned = assignThemes(list, random({ [list[0].id]: 'harbour' }))
  assert.equal(new Set(assigned.values()).size, 3)
})

test('under Random, different sets of rooms do not all start on the same theme', () => {
  const firstThemes = new Set()
  for (let index = 0; index < 12; index++) {
    const room = { id: `gpu-rig:/data/project-${index}` }
    firstThemes.add(assignThemes([room], random()).get(room.id))
  }
  assert.ok(firstThemes.size > 1)
})

test('under Random, a theme that did not load is never given to a room', () => {
  const assigned = assignThemes(rooms(6), random({}, ['meadow', 'attic']))
  assert.deepEqual(countByTheme(assigned), { meadow: 3, attic: 3 })
})

test('under Random, no room gets a theme when none is usable', () => {
  assert.equal(assignThemes(rooms(3), random({}, [])).size, 0)
})

test('a real default theme is the only one rooms without their own can end up with', () => {
  assert.deepEqual(defaultThemeIds(state('harbour')), ['harbour'])
})

test('under Random, rooms without their own theme can end up with any theme', () => {
  assert.deepEqual(defaultThemeIds(state(RANDOM_THEME)), THEME_IDS)
})

test('the themes to load are the default and the ones rooms picked, without unknown ones', () => {
  const roomThemes = { a: 'attic', b: 'gone', c: 'harbour' }
  assert.deepEqual(themeIdsToLoad(state('harbour', roomThemes)), ['harbour', 'attic'])
})

test('under Random, every theme is loaded', () => {
  assert.deepEqual(themeIdsToLoad(state(RANDOM_THEME, { a: 'attic' })), THEME_IDS)
})
