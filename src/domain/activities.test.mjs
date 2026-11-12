import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activityForTool, isDelegateTool } from './activities.mjs'

test('maps known tools to the activity the character acts out', () => {
  assert.equal(activityForTool('Edit'), 'write')
  assert.equal(activityForTool('Grep'), 'read')
  assert.equal(activityForTool('Bash'), 'run')
})

test('ignores the case of the tool name', () => {
  assert.equal(activityForTool('bash'), 'run')
  assert.equal(activityForTool('APPLY_PATCH'), 'write')
})

test('an unknown or missing tool shows as thinking', () => {
  assert.equal(activityForTool('SomethingNew'), 'think')
  assert.equal(activityForTool(undefined), 'think')
})

test('only the delegation tools start a subagent', () => {
  assert.equal(isDelegateTool('Agent'), true)
  assert.equal(isDelegateTool('Task'), true)
  assert.equal(isDelegateTool('Bash'), false)
  assert.equal(isDelegateTool(null), false)
})
