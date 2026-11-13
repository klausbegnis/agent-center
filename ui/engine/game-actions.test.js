import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGameActions, refusalReason } from './game-actions.js'

test('only the actions the surface offers are there', () => {
  const actions = createGameActions({ setAutoSpend: async () => ({ changed: true }) }, () => {})
  assert.deepEqual(Object.keys(actions), ['setAutoSpend'])
})

test('a refused action says so in a short message and does not reject', async () => {
  const messages = []
  const original = console.error
  console.error = () => {}
  try {
    const refuse = async () => {
      throw new Error('refused')
    }
    const actions = createGameActions({ resetWorld: refuse }, (text) => messages.push(text))
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
  const transport = { upgradeItem: unchanged, setAutoSpend: unchanged }
  const actions = createGameActions(transport, (text) => messages.push(text))
  assert.equal(await actions.upgradeItem('room', 'item'), false)
  assert.equal(await actions.setAutoSpend(true), true)
  assert.equal(messages.length, 1)
})

test('an export resolves to the file the worker answered, or null when it failed', async () => {
  const file = { format: 'agent-center-game' }
  const actions = createGameActions({ exportSave: async () => file }, () => {})
  assert.equal(await actions.exportSave(), file)
  const original = console.error
  console.error = () => {}
  try {
    const failing = createGameActions({ exportSave: async () => Promise.reject(new Error('no')) }, () => {})
    assert.equal(await failing.exportSave(), null)
  } finally {
    console.error = original
  }
})

test('a refused import says the worker\'s reason', async () => {
  const messages = []
  const original = console.error
  console.error = () => {}
  try {
    const refuse = async () => {
      throw new Error('Error: the save file is damaged: worlds.main.materials.gold is not one the game knows')
    }
    const actions = createGameActions({ importSave: refuse }, (text) => messages.push(text))
    assert.equal(await actions.importSave({}), false)
  } finally {
    console.error = original
  }
  assert.deepEqual(messages, [
    'The import did not go through: the save file is damaged: worlds.main.materials.gold is not one the game knows.'
  ])
})

test('the reason of a refusal loses the prefixes a request adds', () => {
  assert.equal(refusalReason(new Error('Error: Error: the game is not running')), 'the game is not running')
  assert.equal(refusalReason(null), '')
})
