import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readSaveText, saveFileName, saveFileText } from './save-file.js'

test('a downloaded save file is named after the local date', () => {
  assert.equal(saveFileName(new Date(2026, 0, 5, 23, 30)), 'agent-center-save-2026-01-05.json')
  assert.equal(saveFileName(new Date(2026, 10, 13, 0, 5)), 'agent-center-save-2026-11-13.json')
})

test('the text of a save file reads back as the same file', () => {
  const file = { format: 'agent-center-game', version: 1, save: { version: 1, worlds: {} }, autoSpend: true }
  assert.deepEqual(readSaveText(saveFileText(file)), { file })
})

test('nothing pasted, broken JSON and JSON that is not one object are told apart', () => {
  assert.deepEqual(readSaveText('   '), { error: 'empty' })
  assert.deepEqual(readSaveText('{"format": '), { error: 'invalid' })
  assert.deepEqual(readSaveText('[1, 2]'), { error: 'notObject' })
  assert.deepEqual(readSaveText('null'), { error: 'notObject' })
})
