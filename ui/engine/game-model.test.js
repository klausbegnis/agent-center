import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GAME_TABS, gameModeOf, isEstimated, tabAfterKey, tabOrDefault } from './game-model.js'

const running = { status: 'running', worlds: [], rooms: {}, characters: {}, recent: [] }

test('a state without a game, or with the game off, shows no game at all', () => {
  assert.equal(gameModeOf(undefined), 'off')
  assert.equal(gameModeOf({ status: 'off', autoSpend: false, keepTitles: false }), 'off')
})

test('a running game shows in full', () => {
  assert.equal(gameModeOf(running), 'running')
})

test('a game that cannot run, for a known or an unknown reason, explains itself', () => {
  assert.equal(gameModeOf({ status: 'needs-permission' }), 'unavailable')
  assert.equal(gameModeOf({ status: 'unsupported' }), 'unavailable')
  assert.equal(gameModeOf({ status: 'some-later-status' }), 'unavailable')
})

test('a running status without its worlds and rooms is not drawn as running', () => {
  assert.equal(gameModeOf({ status: 'running' }), 'unavailable')
})

test('a saved tab is kept only when it is one of the tabs', () => {
  assert.equal(tabOrDefault('skills'), 'skills')
  assert.equal(tabOrDefault('settings'), 'rooms')
  assert.equal(tabOrDefault(null), 'rooms')
})

test('the arrow keys move along the tabs and wrap round, Home and End go to either end', () => {
  assert.equal(tabAfterKey('rooms', 'ArrowRight'), 'arsenal')
  assert.equal(tabAfterKey('skills', 'ArrowRight'), 'rooms')
  assert.equal(tabAfterKey('rooms', 'ArrowLeft'), 'skills')
  assert.equal(tabAfterKey('arsenal', 'Home'), GAME_TABS[0])
  assert.equal(tabAfterKey('arsenal', 'End'), 'skills')
  assert.equal(tabAfterKey('arsenal', 'Enter'), null)
})

test('progress is estimated only when the worker says so; a missing source means measured', () => {
  assert.equal(isEstimated({ ...running, tokenSource: 'estimated' }), true)
  assert.equal(isEstimated({ ...running, tokenSource: 'measured' }), false)
  assert.equal(isEstimated(running), false)
})
