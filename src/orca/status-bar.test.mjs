import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarize } from './status-bar.mjs'

const counts = (overrides) => ({ working: 0, waiting: 0, blocked: 0, done: 0, subs: 0, ...overrides })

test('nothing running is neutral', () => {
  assert.deepEqual(summarize(counts({})), { text: '0 active', tone: 'neutral' })
})

test('subagents count as active', () => {
  assert.deepEqual(summarize(counts({ working: 2, subs: 1 })), { text: '3 active', tone: 'accent' })
})

test('waiting outranks working, and blocked outranks waiting', () => {
  assert.equal(summarize(counts({ working: 1, waiting: 1 })).tone, 'warning')
  assert.deepEqual(summarize(counts({ working: 1, waiting: 2, blocked: 1 })), {
    text: '1 active · 2 waiting · 1 blocked',
    tone: 'danger'
  })
})
