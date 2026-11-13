import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGameActions } from './game-actions.js'

test('only the actions the surface offers are there', () => {
  const actions = createGameActions({ setAutoSpend: async () => ({ changed: true }) }, () => {})
  assert.deepEqual(Object.keys(actions), ['setAutoSpend'])
})

test('a refused action says so in a short message and does not reject', async () => {
  const messages = []
  const original = console.error
  console.error = () => {}
  try {
    const actions = createGameActions({ resetWorld: async () => { throw new Error('refused') } }, (text) => messages.push(text))
    assert.equal(await actions.resetWorld('main'), false)
  } finally {
    console.error = original
  }
  assert.equal(messages.length, 1)
  assert.match(messages[0], /did not go through/)
})

test('an upgrade the worker could not make is reported, a switch set to its own value is not', async () => {
  const messages = []
  const unchanged = async () => ({ changed: false })
  const actions = createGameActions({ upgradeItem: unchanged, setAutoSpend: unchanged }, (text) => messages.push(text))
  assert.equal(await actions.upgradeItem('room', 'item'), false)
  assert.equal(await actions.setAutoSpend(true), true)
  assert.equal(messages.length, 1)
})
