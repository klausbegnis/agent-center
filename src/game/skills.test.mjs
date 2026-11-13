import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CLASSES,
  GATHERING_SKILLS,
  MATERIALS,
  WORK_SKILLS,
  attributeForActivity,
  attributeOfClass,
  materialOfSkill,
  skillForActivity,
  skillOfClass
} from './skills.mjs'

test('each working activity trains its own work skill', () => {
  const skills = ['write', 'read', 'run', 'think', 'delegate'].map(skillForActivity)
  assert.deepEqual(skills, ['forge', 'lore', 'engineering', 'arcana', 'command'])
})

test('waiting, being blocked or an unknown activity trains no skill', () => {
  for (const activity of ['wait', 'blocked', 'dance', undefined, 'toString']) {
    assert.equal(skillForActivity(activity), null)
  }
})

test('work skills yield their materials in order', () => {
  assert.deepEqual(WORK_SKILLS.map(materialOfSkill), ['bars', 'pages', 'gears', 'crystals', 'seals'])
})

test('gathering skills yield their materials in order', () => {
  assert.deepEqual(GATHERING_SKILLS.map(materialOfSkill), ['ore', 'fish', 'crops', 'logs', 'hides', 'runes'])
})

test('every skill yields a different material', () => {
  assert.equal(new Set(MATERIALS).size, WORK_SKILLS.length + GATHERING_SKILLS.length)
})

test('each class is powered by its own skill and attribute', () => {
  assert.deepEqual(CLASSES.map(skillOfClass), ['forge', 'arcana', 'lore', 'command'])
  assert.deepEqual(CLASSES.map(attributeOfClass), ['strength', 'arcane', 'resilience', 'medicine'])
})

test('an activity without an attribute of its own trains precision', () => {
  assert.equal(attributeForActivity('run'), 'agility')
  assert.equal(attributeForActivity('wait'), 'precision')
})

test('the identifier lists cannot be changed by accident', () => {
  assert.throws(() => WORK_SKILLS.push('juggling'))
})
