import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CHARACTER_LEVEL_BASE,
  NEWCOMER_SHARE,
  SEASONED_LEVEL,
  SKILL_CAP,
  STARTING_LUCK_SPREAD,
  VETERAN_BONUS_PER_LEVEL
} from './constants.mjs'
import {
  createCharacter,
  fortuneAttribute,
  grantCharacterXp,
  pickClass,
  seasoning,
  startingAttributes,
  startingLuck,
  tradeFor
} from './characters.mjs'
import { characterXpToNext, emptySkill } from './progression.mjs'
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

test('a trained world gives newcomers half its level in the class attribute', () => {
  const trained = { ...emptySkill(), level: 9, stars: 1 }
  const skills = { forge: trained, lore: trained, engineering: trained, arcana: trained, command: trained }
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
  const character = grantCharacterXp(grantCharacterXp(newCharacter(), 15, 'read'), 10, 'write')
  assert.equal(character.level, 1)
  assert.equal(character.xp, 25)
  assert.deepEqual(character.levelActivityXp, { read: 15, write: 10 })
})

test('a level gives a point to the class attribute, the dominant activity and fortune', () => {
  const first = CHARACTER_LEVEL_BASE
  let character = grantCharacterXp(newCharacter('session-1', 'physical'), first * 0.6, 'run')
  character = grantCharacterXp(character, first * 0.3, 'write')
  character = grantCharacterXp(character, first * 0.1, 'think')
  assert.equal(character.level, 2)
  assert.equal(character.attributes.strength, 2)
  assert.equal(character.attributes.agility, 2)
  assert.equal(character.attributes.precision, 2)
  assert.equal(character.attributes.arcane, 1)
})

test('the fortune point alternates between precision and luck', () => {
  assert.deepEqual([2, 3, 4, 5].map(fortuneAttribute), ['precision', 'luck', 'precision', 'luck'])
})

test('levelling up starts a new tally with the experience left over', () => {
  const character = grantCharacterXp(newCharacter(), CHARACTER_LEVEL_BASE + 30, 'delegate')
  assert.equal(character.xp, 30)
  assert.deepEqual(character.levelActivityXp, { delegate: 30 })
})

test('one big grant climbs several levels and gives points for each', () => {
  const xp = characterXpToNext(1) + characterXpToNext(2) + characterXpToNext(3)
  const before = newCharacter('session-1', 'support')
  const character = grantCharacterXp(before, xp, 'wait')
  assert.equal(character.level, 4)
  assert.equal(character.attributes.medicine, 1 + 3)
  assert.equal(character.attributes.precision, 1 + 3 + 2)
  assert.equal(character.attributes.luck, before.attributes.luck + 1)
  assert.deepEqual(character.levelActivityXp, {})
})

test('a character has its own curve, far below a skill\'s, and no cap', () => {
  assert.equal(characterXpToNext(1), CHARACTER_LEVEL_BASE)
  assert.ok(characterXpToNext(SKILL_CAP + 50) > characterXpToNext(SKILL_CAP))
})

test('a new character is born with one to four points of luck by its session id', () => {
  const lucks = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map(startingLuck))
  assert.ok([...lucks].every((luck) => luck >= 1 && luck <= STARTING_LUCK_SPREAD))
  assert.ok(lucks.size > 1)
  const character = createCharacter({ sessionId: 'rumble-banana', livingClasses: [], skills: {}, now: 0 })
  assert.equal(character.attributes.luck, startingLuck('rumble-banana'))
})

test('granting experience leaves the original character untouched', () => {
  const character = newCharacter()
  grantCharacterXp(character, 500, 'write')
  assert.deepEqual(character, newCharacter())
})

test('a newcomer starts at the newcomer share of a seasoned character’s seasoning', () => {
  assert.equal(seasoning(1), NEWCOMER_SHARE)
})

test('a character is fully seasoned at the seasoned level, rising evenly before it', () => {
  assert.equal(seasoning(SEASONED_LEVEL), 1)
  const middle = (1 + SEASONED_LEVEL) / 2
  assert.ok(Math.abs(seasoning(middle) - (1 + NEWCOMER_SHARE) / 2) < 1e-9)
})

test('a veteran gains a little per level past the seasoned level', () => {
  assert.ok(Math.abs(seasoning(SEASONED_LEVEL + 10) - (1 + 10 * VETERAN_BONUS_PER_LEVEL)) < 1e-9)
})
