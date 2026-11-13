import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SKILL_CAP } from './constants.mjs'
import {
  canPrestige,
  effectMultiplier,
  effectiveLevel,
  emptySkill,
  grantSkillXp,
  prestige,
  worldLevel,
  xpFromTokens,
  xpToNext
} from './progression.mjs'

/** Experience needed to go from level 1 to `level`. */
function totalXpTo(level) {
  let total = 0
  for (let step = 1; step < level; step++) total += xpToNext(step)
  return total
}

const cappedSkill = (banked = 0, stars = 0) => ({ level: SKILL_CAP, xp: 0, banked, stars })

test('a thousand tokens make one experience point', () => {
  assert.equal(xpFromTokens(2500), 2.5)
  assert.equal(xpFromTokens(-10), 0)
  assert.equal(xpFromTokens(Number.NaN), 0)
})

test('going from level 1 to 2 costs 100 experience', () => {
  assert.equal(xpToNext(1), 100)
})

test('reaching level 10 costs 13,372 experience in all', () => {
  assert.equal(totalXpTo(10), 13_372)
})

test('past the cap each character level costs one percent more than the one before', () => {
  assert.equal(xpToNext(SKILL_CAP), 155_961)
  assert.equal(xpToNext(SKILL_CAP + 1), Math.round(155_961 * 1.01))
  assert.equal(xpToNext(SKILL_CAP + 10), Math.round(155_961 * 1.01 ** 10))
})

test('a new skill starts at level 1 with nothing banked and no stars', () => {
  assert.deepEqual(emptySkill(), { level: 1, xp: 0, banked: 0, stars: 0 })
})

test('enough experience raises a skill several levels at once and keeps the rest', () => {
  const skill = grantSkillXp(emptySkill(), 100 + 303 + 50)
  assert.deepEqual(skill, { level: 3, xp: 50, banked: 0, stars: 0 })
})

test('granting experience leaves the original skill untouched', () => {
  const skill = emptySkill()
  grantSkillXp(skill, 1_000)
  assert.deepEqual(skill, emptySkill())
})

test('a skill stops at the cap and banks the experience beyond it', () => {
  const skill = grantSkillXp(emptySkill(), totalXpTo(SKILL_CAP) + 777)
  assert.deepEqual(skill, { level: SKILL_CAP, xp: 0, banked: 777, stars: 0 })
})

test('a capped skill banks everything it is granted', () => {
  assert.equal(grantSkillXp(cappedSkill(10), 40).banked, 50)
})

test('each star makes experience in that skill worth five percent more', () => {
  const skill = grantSkillXp({ ...emptySkill(), stars: 2 }, 50)
  assert.ok(Math.abs(skill.xp - 55) < 1e-9)
})

test('only a skill at the cap can be prestiged', () => {
  assert.equal(canPrestige(cappedSkill()), true)
  assert.equal(canPrestige({ ...emptySkill(), level: SKILL_CAP - 1 }), false)
  assert.deepEqual(prestige({ ...emptySkill(), level: 40 }), { ...emptySkill(), level: 40 })
})

test('prestige returns to level 1 with one more star', () => {
  const skill = prestige(cappedSkill(0, 1))
  assert.deepEqual(skill, { level: 1, xp: 0, banked: 0, stars: 2 })
})

test('prestige pours the banked experience back in without multiplying it again', () => {
  const skill = prestige(cappedSkill(100 + 303 + 10, 3))
  assert.deepEqual(skill, { level: 3, xp: 10, banked: 0, stars: 4 })
})

test('prestige never lowers the effective level', () => {
  for (const banked of [0, 5_000, totalXpTo(SKILL_CAP) * 2]) {
    const before = cappedSkill(banked, 1)
    assert.ok(effectiveLevel(prestige(before)) > effectiveLevel(before))
  }
})

test('a huge bank fills the prestiged skill back to the cap and banks the rest again', () => {
  const skill = prestige(cappedSkill(totalXpTo(SKILL_CAP) + 9))
  assert.deepEqual(skill, { level: SKILL_CAP, xp: 0, banked: 9, stars: 1 })
})

test('the effective level counts each star as a full climb to the cap', () => {
  assert.equal(effectiveLevel({ ...emptySkill(), level: 7, stars: 2 }), 2 * SKILL_CAP + 7)
})

test('each star makes a skill two percent more effective', () => {
  assert.equal(effectMultiplier({ ...emptySkill(), stars: 3 }), 1.06)
})

test('the world level is the floored mean of the five work skills', () => {
  const skills = {
    forge: { ...emptySkill(), level: 10 },
    lore: { ...emptySkill(), level: 4 },
    engineering: { ...emptySkill(), level: 3 },
    arcana: { ...emptySkill(), level: 2, stars: 1 },
    command: emptySkill()
  }
  assert.equal(worldLevel(skills), Math.floor((10 + 4 + 3 + SKILL_CAP + 2 + 1) / 5))
})

test('a world with no skills yet is level 1', () => {
  assert.equal(worldLevel({}), 1)
})

test('gathering skills do not count toward the world level', () => {
  assert.equal(worldLevel({ mining: { ...emptySkill(), level: 90 } }), 1)
})
