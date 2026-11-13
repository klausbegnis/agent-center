import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RETIREE_BONUS, RETIREE_BONUS_MAX, RETIREES_KEPT } from './constants.mjs'
import { hashOf } from './hash.mjs'
import { comeBack, forgetTitles, retire, retireeBonus } from './retirement.mjs'

const NOW = 1_000_000

function character(sessionId, overrides = {}) {
  return {
    sessionId,
    class: 'defense',
    level: 7,
    xp: 120,
    attributes: { strength: 1, arcane: 1, agility: 2, precision: 1, resilience: 9, medicine: 1, luck: 1 },
    levelActivityXp: { read: 30 },
    equipment: { weapon: 'iron-axe', outfit: null, tool: null },
    trade: 'fishing',
    tokens: 480_000,
    bornAt: 10,
    lastSeenAt: 500,
    ...overrides
  }
}

function project(overrides = {}) {
  return {
    wave: 3,
    monster: null,
    stamina: null,
    restingUntil: null,
    chest: [
      { id: 'iron-axe', slot: 'weapon', damageType: 'physical', tier: 1, recipe: ['bars', 'ore'], level: 2,
        heldBy: 'session-1' },
      { id: 'wool-coat', slot: 'outfit', tier: 1, recipe: ['hides', 'crops'], level: 0, heldBy: 'session-2' }
    ],
    characters: { 'session-1': character('session-1'), 'session-2': character('session-2') },
    retirees: [],
    retiredCount: 0,
    ...overrides
  }
}

function retireeRecord(sessionId) {
  return { sessionId, nameId: hashOf(sessionId), class: 'support', level: 1, xp: 0, attributes: {}, tokens: 0,
    mainSkill: 'lore', retiredAt: 0, title: null }
}

const retireOne = (target, sessionId, details = {}) =>
  retire(target, sessionId, { now: NOW, mainSkill: 'lore', ...details })

test('a retiring character leaves the project and its items go back to the chest', () => {
  const before = project()
  const after = retireOne(before, 'session-1')
  assert.deepEqual(Object.keys(after.characters), ['session-2'])
  assert.equal(after.chest.find((item) => item.id === 'iron-axe').heldBy, null)
  assert.equal(after.chest.find((item) => item.id === 'wool-coat').heldBy, 'session-2')
  assert.ok(before.characters['session-1'])
})

test('the retiree record comes first and keeps what the character achieved', () => {
  const start = project({ retirees: [retireeRecord('session-0')] })
  const after = retireOne(start, 'session-1')
  const record = after.retirees[0]
  assert.equal(after.retirees.length, 2)
  assert.deepEqual(
    [record.sessionId, record.nameId, record.class, record.level, record.xp, record.tokens],
    ['session-1', hashOf('session-1'), 'defense', 7, 120, 480_000]
  )
  assert.equal(record.mainSkill, 'lore')
  assert.equal(record.retiredAt, NOW)
  assert.equal(record.attributes.resilience, 9)
})

test('retiring a session that has no character changes nothing', () => {
  const before = project()
  assert.equal(retireOne(before, 'session-9'), before)
})

test('only the newest retirees are kept and each one dropped adds to the counter', () => {
  const retirees = Array.from({ length: RETIREES_KEPT }, (_, index) => retireeRecord(`old-${index}`))
  const after = retireOne(project({ retirees, retiredCount: 4 }), 'session-1')
  assert.equal(after.retirees.length, RETIREES_KEPT)
  assert.equal(after.retirees[0].sessionId, 'session-1')
  assert.equal(after.retirees.at(-1).sessionId, `old-${RETIREES_KEPT - 2}`)
  assert.equal(after.retiredCount, 5)
})

test('the session title is kept only when the setting allows it', () => {
  const kept = retireOne(project(), 'session-1', { title: 'rumble-banana', keepTitle: true })
  const dropped = retireOne(project(), 'session-1', { title: 'rumble-banana', keepTitle: false })
  assert.equal(kept.retirees[0].title, 'rumble-banana')
  assert.equal(dropped.retirees[0].title, null)
})

test('turning the setting off forgets every title already kept', () => {
  const kept = retireOne(project(), 'session-1', { title: 'rumble-banana', keepTitle: true })
  const forgotten = forgetTitles(kept)
  assert.ok(forgotten.retirees.every((retiree) => retiree.title === null))
  assert.equal(kept.retirees[0].title, 'rumble-banana')
})

test('a session that comes back is restored with its level and its record is removed', () => {
  const retired = retireOne(project(), 'session-1')
  const { project: back, character: returned } = comeBack(retired, 'session-1', { now: NOW + 5 })
  assert.deepEqual(
    [returned.class, returned.level, returned.xp, returned.tokens, returned.trade, returned.bornAt],
    ['defense', 7, 120, 480_000, 'fishing', 10]
  )
  assert.equal(returned.attributes.resilience, 9)
  assert.equal(returned.lastSeenAt, NOW + 5)
  assert.deepEqual(returned.equipment, { weapon: null, outfit: null, tool: null })
  assert.equal(back.characters['session-1'], returned)
  assert.equal(back.retirees.length, 0)
})

test('a session that never retired here does not come back', () => {
  assert.equal(comeBack(project(), 'session-1', { now: NOW }), null)
})

test('each retiree adds to gathering, counting those folded into the counter', () => {
  const start = project({ retirees: [retireeRecord('old-1'), retireeRecord('old-2')], retiredCount: 3 })
  assert.ok(Math.abs(retireeBonus(start) - 5 * RETIREE_BONUS) < 1e-9)
})

test('the retiree bonus stops at its cap', () => {
  assert.equal(retireeBonus(project({ retiredCount: 10_000 })), RETIREE_BONUS_MAX)
})
