import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFoePhases, FOE_MS } from './foe-phases.js'

test('a monster walks in, then stands there', () => {
  const phases = createFoePhases()
  phases.observe('wave-3|0', 0)
  assert.deepEqual(phases.tick(0), { phase: 'arriving', key: 'wave-3|0' })
  assert.deepEqual(phases.tick(FOE_MS.arriving), { phase: 'present', key: 'wave-3|0' })
})

test('a kill plays once, then the next monster walks in', () => {
  const phases = createFoePhases()
  phases.observe('wave-3|0', 0)
  phases.tick(FOE_MS.arriving)
  phases.observe('wave-3|1', 5_000)
  assert.deepEqual(phases.tick(5_000), { phase: 'dying', key: 'wave-3|0' })
  phases.observe('wave-3|1', 5_500)
  assert.deepEqual(phases.tick(5_000 + FOE_MS.dying), { phase: 'arriving', key: 'wave-3|1' })
})

test('the monster leaves when nobody in the room works, and comes back when someone does', () => {
  const phases = createFoePhases()
  phases.observe('wave-3|0', 0)
  phases.tick(FOE_MS.arriving)
  phases.observe(null, 2_000)
  assert.equal(phases.tick(2_000).phase, 'leaving')
  assert.deepEqual(phases.tick(2_000 + FOE_MS.leaving), { phase: 'gone', key: null })
  phases.observe('wave-3|0', 9_000)
  assert.equal(phases.tick(9_000).phase, 'arriving')
})

test('the same monster seen again changes nothing', () => {
  const phases = createFoePhases()
  phases.observe('wave-3|0', 0)
  phases.tick(FOE_MS.arriving)
  phases.observe('wave-3|0', 3_000)
  assert.equal(phases.tick(3_000).phase, 'present')
})
