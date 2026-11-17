import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rebalanceChanges, splitSourceLine } from './skill-mix-labels.js'

test('a split explained by tools says so', () => {
  assert.equal(splitSourceLine({ from: 'tools', mix: 'observed' }), 'Split from your agents\' tools.')
})

test('a split partly estimated names what the unknown time follows', () => {
  assert.match(splitSourceLine({ from: 'mixed', mix: 'default' }), /not visible for some agents.*default mix/)
  assert.match(splitSourceLine({ from: 'mix', mix: 'observed' }), /tools your other agents were seen using/)
})

test('nothing is said before any work was seen', () => {
  assert.equal(splitSourceLine({ from: 'none', mix: 'default' }), null)
  assert.equal(splitSourceLine(undefined), null)
})

test('a rebalance preview lists only the skills that move', () => {
  const preview = [{ skillId: 'arcana', from: 52, to: 16 }, { skillId: 'forge', from: 15, to: 15 },
    { skillId: 'command', from: 1, to: 10 }]
  assert.equal(rebalanceChanges(preview), 'Arcana 52 → 16, Command 1 → 10')
  assert.equal(rebalanceChanges([{ skillId: 'forge', from: 3, to: 3 }]), null)
})
