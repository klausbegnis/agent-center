import assert from 'node:assert/strict'
import { test } from 'node:test'
import { subagentsOf } from './cli.mjs'

test('the subagents a snapshot lists on their agent keep only what the room needs', () => {
  const listed = [
    { id: 'sub-1', state: 'working', startedAt: 1_000, agentType: 'claude', description: 'Survey the parser', extra: 'x' },
    { id: 7, state: 'done', startedAt: 'soon', description: '' },
    { state: 'working' },
    null
  ]
  assert.deepEqual(subagentsOf(listed), [
    { id: 'sub-1', state: 'working', startedAt: 1_000, description: 'Survey the parser' },
    { id: '7', state: 'done', startedAt: null, description: null }
  ])
})

test('an agent from an older Orca lists no subagents', () => {
  assert.deepEqual(subagentsOf(undefined), [])
  assert.deepEqual(subagentsOf('many'), [])
})
