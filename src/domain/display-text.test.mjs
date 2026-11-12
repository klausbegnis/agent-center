import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displayText } from './display-text.mjs'

test('a plain title is kept as it is', () => {
  assert.equal(displayText('Fix checkout rounding', 80), 'Fix checkout rounding')
})

test('a long title is cut to the limit, with an ellipsis', () => {
  const text = displayText('x'.repeat(5000), 60)
  assert.equal([...text].length, 60)
  assert.ok(text.endsWith('…'))
})

test('control characters, bidi overrides and runs of whitespace are taken out', () => {
  assert.equal(displayText('Release\u202E notes\n\tdraft\u0007', 80), 'Release notes draft')
})

test('an emoji sequence keeps its joiner', () => {
  assert.equal(displayText('Ship it 🧑\u200D💻', 80), 'Ship it 🧑\u200D💻')
})

test('emoji are counted and cut as whole characters', () => {
  assert.equal(displayText('🚀🚀🚀🚀', 3), '🚀🚀…')
})

test('anything that is not text, or is empty once cleaned, gives null', () => {
  assert.equal(displayText(42, 80), null)
  assert.equal(displayText(' \u200B ', 80), null)
})
