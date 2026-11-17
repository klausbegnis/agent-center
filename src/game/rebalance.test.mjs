import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptySkill, grantSkillXp, worldLevel } from './progression.mjs'
import { rebalancePreview, rebalanceWorkSkills } from './rebalance.mjs'
import { WORK_SKILLS } from './skills.mjs'

const DEFAULT_MIX = { write: 0.2, read: 0.25, run: 0.2, think: 0.25, delegate: 0.1 }

/** A skill at a level, by pouring the experience it takes. */
function skillAt(level, extra = {}) {
  let skill = emptySkill()
  while (skill.level < level) skill = grantSkillXp(skill, 125 * skill.level)
  return { ...skill, ...extra }
}

const lopsided = () => ({
  arcana: skillAt(52), engineering: skillAt(13), forge: skillAt(4), lore: skillAt(2), command: skillAt(1),
  mining: skillAt(7)
})

test('a rebalance keeps the world level and the sum of the work levels', () => {
  const before = lopsided()
  const after = rebalanceWorkSkills(before, DEFAULT_MIX)
  assert.equal(worldLevel(after), worldLevel(before))
  const sum = (skills) => WORK_SKILLS.reduce((total, skillId) => total + skills[skillId].level, 0)
  assert.equal(sum(after), sum(before))
})

test('a rebalance spreads a lopsided world by the mix', () => {
  const after = rebalanceWorkSkills(lopsided(), DEFAULT_MIX)
  assert.ok(after.arcana.level < 52)
  assert.ok(after.command.level > 1)
  assert.ok(after.lore.level >= after.command.level && after.arcana.level >= after.forge.level)
})

test('gathering skills, stars and banked experience are left where they are', () => {
  const before = { ...lopsided(), lore: skillAt(2, { stars: 1, banked: 40 }) }
  const after = rebalanceWorkSkills(before, DEFAULT_MIX)
  assert.deepEqual(after.mining, before.mining)
  assert.equal(after.lore.stars, 1)
  assert.equal(after.lore.banked, 40)
})

test('the preview lists every work skill before and after', () => {
  const preview = rebalancePreview(lopsided(), DEFAULT_MIX)
  assert.deepEqual(preview.map((entry) => entry.skillId), WORK_SKILLS)
  assert.deepEqual(preview.find((entry) => entry.skillId === 'arcana').from, 52)
})

test('a mix that gives nothing changes nothing', () => {
  const before = lopsided()
  assert.deepEqual(rebalanceWorkSkills(before, {}), before)
})
