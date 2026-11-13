import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SKILL_CAP } from './constants.mjs'
import {
  createCharacter,
  grantCharacterXp,
  pickClass,
  seasoning,
  startingAttributes,
  tradeFor
} from './characters.mjs'
import { emptySkill } from './progression.mjs'
import { CLASSES, GATHERING_SKILLS } from './skills.mjs'

function newCharacter(sessionId = 'session-1', className = 'physical') {
  return {
    ...createCharacter({ sessionId, livingClasses: [], skills: {}, now: 1_000 }),
    class: className,
    attributes: startingAttributes(className, {})
  }
}

test('four characters created one after another get four different classes', () => {
  const living = []
  for (const sessionId of ['rumble-banana', 'session-2', 'quiet-otter', 'session-4']) {
    const livingClasses = living.map((each) => each.class)
    living.push(createCharacter({ sessionId, livingClasses, skills: {}, now: 0 }))
  }
  assert.deepEqual(new Set(living.map((each) => each.class)), new Set(CLASSES))
})

test('a new character takes the only class missing from the party', () => {
  assert.equal(pickClass(['physical', 'magical', 'support', 'physical'], 'session-9'), 'defense')
})

test('the same session in the same party always gets the same class', () => {
  const living = ['physical', 'magical']
  assert.equal(pickClass(living, 'rumble-banana'), pickClass([...living], 'rumble-banana'))
})

test('ties between missing classes are spread across sessions', () => {
  const picked = new Set()
  for (let index = 0; index < 40; index++) picked.add(pickClass([], `session-${index}`))
  assert.deepEqual(picked, new Set(CLASSES))
})

test('the trade is a gathering skill fixed by the session id', () => {
  assert.equal(tradeFor('rumble-banana'), tradeFor('rumble-banana'))
  assert.ok(GATHERING_SKILLS.includes(tradeFor('rumble-banana')))
})

test('a character starts with one point in every attribute in a new world', () => {
  const attributes = startingAttributes('magical', {})
  assert.deepEqual(Object.values(attributes), [1, 1, 1, 1, 1, 1, 1])
})

test('a trained class skill gives newcomers half its effective level in the class attribute', () => {
  const skills = { lore: { ...emptySkill(), level: 9, stars: 1 } }
  const attributes = startingAttributes('defense', skills)
  assert.equal(attributes.resilience, 1 + Math.floor((SKILL_CAP + 9) / 2))
  assert.equal(attributes.strength, 1)
})

test('a new character has the save shape at level 1', () => {
  const character = createCharacter({ sessionId: 'session-1', livingClasses: [], skills: {}, now: 5_000 })
  assert.equal(character.level, 1)
  assert.equal(character.xp, 0)
  assert.deepEqual(character.levelActivityXp, {})
  assert.deepEqual(character.equipment, { weapon: null, outfit: null, tool: null })
  assert.equal(character.trade, tradeFor('session-1'))
  assert.deepEqual([character.tokens, character.bornAt, character.lastSeenAt], [0, 5_000, 5_000])
})

test('experience below the next level is tallied by activity', () => {
  const character = grantCharacterXp(grantCharacterXp(newCharacter(), 30, 'read'), 20, 'write')
  assert.equal(character.level, 1)
  assert.equal(character.xp, 50)
  assert.deepEqual(character.levelActivityXp, { read: 30, write: 20 })
})

test('a level gives two points to the class attribute and one to the dominant activity', () => {
  let character = grantCharacterXp(newCharacter('session-1', 'physical'), 60, 'run')
  character = grantCharacterXp(character, 30, 'write')
  character = grantCharacterXp(character, 10, 'think')
  assert.equal(character.level, 2)
  assert.equal(character.attributes.strength, 3)
  assert.equal(character.attributes.agility, 2)
  assert.equal(character.attributes.arcane, 1)
})

test('levelling up starts a new tally with the experience left over', () => {
  const character = grantCharacterXp(newCharacter(), 130, 'delegate')
  assert.equal(character.xp, 30)
  assert.deepEqual(character.levelActivityXp, { delegate: 30 })
})

test('one big grant climbs several levels and gives points for each', () => {
  const character = grantCharacterXp(newCharacter('session-1', 'support'), 100 + 303 + 580, 'wait')
  assert.equal(character.level, 4)
  assert.equal(character.attributes.medicine, 1 + 3 * 2)
  assert.equal(character.attributes.precision, 1 + 3)
  assert.deepEqual(character.levelActivityXp, {})
})

test('granting experience leaves the original character untouched', () => {
  const character = newCharacter()
  grantCharacterXp(character, 500, 'write')
  assert.deepEqual(character, newCharacter())
})

test('a newcomer does three quarters of a seasoned character’s work', () => {
  assert.equal(seasoning(1), 0.75)
})

test('a character is fully seasoned at level 11', () => {
  assert.equal(seasoning(11), 1)
  assert.equal(seasoning(6), 0.875)
})

test('a veteran gains half a percent per level past 11', () => {
  assert.equal(seasoning(21), 1.05)
})
