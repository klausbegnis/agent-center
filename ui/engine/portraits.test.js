import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PORTRAIT } from './portrait-labels.js'
import { portraitOf } from './portraits.js'
import { roomThemeIds } from './room-themes.js'

const STOREFRONT = 'local:/work/storefront'
const SEARCH = 'local:/work/search'

function stateWith(extra = {}) {
  return {
    theme: 'random',
    themes: [{ id: 'harbor' }, { id: 'library' }],
    roomThemes: {},
    hidden: [],
    rooms: [
      { id: STOREFRONT, agents: [{ id: 'pane-1', kind: 'claude', parentId: null }, { id: 'pane-2', kind: 'codex', parentId: 'pane-1' }] },
      { id: SEARCH, agents: [{ id: 'pane-3', kind: null, parentId: null }] }
    ],
    ...extra
  }
}

const allLoaded = () => true
const portrait = (state, roomId, agentId, isLoaded = allLoaded) =>
  portraitOf(state, { roomId, agentId, themeIds: roomThemeIds(state, isLoaded), isLoaded })

test('a character\'s portrait wears the theme its room is drawn in, and the agent\'s own look', () => {
  const state = stateWith()
  const themes = roomThemeIds(state, allLoaded)
  const shown = portrait(state, STOREFRONT, 'pane-1')
  assert.equal(shown.kind, 'sprite')
  assert.equal(shown.themeId, themes.get(STOREFRONT))
  assert.deepEqual([shown.agentKind, shown.lookId], ['claude', 'pane-1'])
})

test('under Random two rooms get different themes, and so do their portraits', () => {
  const state = stateWith()
  assert.notEqual(portrait(state, STOREFRONT, 'pane-1').themeId, portrait(state, SEARCH, 'pane-3').themeId)
})

test('a room\'s own theme choice is the portrait\'s theme', () => {
  const state = stateWith({ theme: 'harbor', roomThemes: { [SEARCH]: 'library' } })
  assert.equal(portrait(state, SEARCH, 'pane-3').themeId, 'library')
  assert.equal(portrait(state, STOREFRONT, 'pane-1').themeId, 'harbor')
})

test('a travelling room\'s scene is the portrait\'s theme', () => {
  const state = stateWith({
    theme: 'harbor',
    game: { status: 'running', travel: true, rooms: { [STOREFRONT]: { sceneTheme: 'library' } } }
  })
  assert.equal(portrait(state, STOREFRONT, 'pane-1').themeId, 'library')
})

test('a subagent wears its parent\'s look, as in the room', () => {
  assert.equal(portrait(stateWith(), STOREFRONT, 'pane-2').lookId, 'pane-1')
})

test('the key changes only with the theme or the look', () => {
  const state = stateWith({ theme: 'harbor' })
  const before = portrait(state, STOREFRONT, 'pane-1').key
  assert.equal(portrait(stateWith({ theme: 'harbor' }), STOREFRONT, 'pane-1').key, before)
  assert.notEqual(portrait(stateWith({ theme: 'library' }), STOREFRONT, 'pane-1').key, before)
})

test('an agent no room on screen runs shows the placeholder', () => {
  const shown = portrait(stateWith(), STOREFRONT, 'pane-9')
  assert.deepEqual([shown.kind, shown.reason], ['placeholder', 'off-screen'])
})

test('an agent of a hidden room shows the placeholder', () => {
  const shown = portrait(stateWith({ hidden: [SEARCH] }), SEARCH, 'pane-3')
  assert.deepEqual([shown.kind, shown.reason], ['placeholder', 'hidden'])
})

test('a theme that has not loaded yet shows the placeholder until it has', () => {
  const state = stateWith({ theme: 'harbor', roomThemes: { [SEARCH]: 'library' } })
  const themeIds = new Map([[SEARCH, 'library']])
  const waiting = portraitOf(state, { roomId: SEARCH, agentId: 'pane-3', themeIds, isLoaded: () => false })
  assert.deepEqual([waiting.kind, waiting.reason, waiting.themeId], ['placeholder', 'loading', 'library'])
  const ready = portraitOf(state, { roomId: SEARCH, agentId: 'pane-3', themeIds, isLoaded: () => true })
  assert.equal(ready.kind, 'sprite')
})

test('a placeholder says why in its tooltip', () => {
  assert.match(PORTRAIT.placeholder('Search filters', 'hidden'), /not on screen: its room is hidden/)
  assert.match(PORTRAIT.placeholder('Search filters', 'off-screen'), /not on screen/)
  assert.match(PORTRAIT.placeholder('Search filters', 'loading'), /loading/)
  assert.equal(PORTRAIT.show('Search filters'), 'Search filters: show in the room')
})
