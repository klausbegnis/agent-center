import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BOSS_EVERY, ELITE, ELITE_ONE_IN, HITS_TO_KILL, MONSTER_KINDS } from './constants.mjs'
import { AFFIXES, eliteFor, kindForWave, monsterFor } from './monsters.mjs'

const referencePartyHit = (level) => ({
  physical: 60 * 1.04 ** level,
  magical: 40 * 1.04 ** level,
  total: 100 * 1.04 ** level
})

const entry = (id, kind, themes) => ({
  id,
  name: id,
  kind,
  loot: { ore: 1 },
  sprite: { body: 'blob', accent: '#123456' },
  ...(themes ? { themes } : {})
})
const content = () => ({
  monsters: [
    ...Object.keys(MONSTER_KINDS).map((kind) => entry(`plain-${kind}`, kind)),
    entry('rumble-banana', 'common', ['world-theme']),
    entry('rumble-cherry', 'common', ['world-theme'])
  ]
})

const wavesUpTo = (count) => Array.from({ length: count }, (_, index) => index + 1)
const where = (wave) => ({ worldId: 'world-1', projectId: 'rumble-banana', wave })
/** The first wave that matches, so tests do not depend on what the hash happens to give. */
const firstWave = (matches) => wavesUpTo(5000).find(matches)
const build = (wave, themeId = null) =>
  monsterFor({ ...where(wave), themeId, content: content(), referencePartyHit })

test('every BOSS_EVERY-th wave is a boss and no other wave is', () => {
  for (const wave of wavesUpTo(100)) {
    assert.equal(kindForWave(where(wave)) === 'boss', wave % BOSS_EVERY === 0)
  }
})

test('about half of the other waves are common, and the rest armored or ethereal', () => {
  const kinds = wavesUpTo(4000).filter((wave) => wave % BOSS_EVERY).map((wave) => kindForWave(where(wave)))
  const share = (kind) => kinds.filter((each) => each === kind).length / kinds.length
  assert.ok(share('common') > 0.45 && share('common') < 0.55)
  assert.ok(share('armored') > 0.2 && share('ethereal') > 0.2)
})

test('a wave always has the same kind, and another project can differ', () => {
  const kinds = (projectId) =>
    wavesUpTo(50).map((wave) => kindForWave({ worldId: 'world-1', projectId, wave }))
  assert.deepEqual(kinds('rumble-banana'), kinds('rumble-banana'))
  assert.notDeepEqual(kinds('rumble-banana'), kinds('rumble-cherry'))
})

test('about one wave in ELITE_ONE_IN is an elite, never a boss wave', () => {
  const elites = wavesUpTo(8000).filter((wave) => eliteFor(where(wave)) !== null)
  assert.equal(elites.some((wave) => wave % BOSS_EVERY === 0), false)
  const share = elites.length / (8000 * (1 - 1 / BOSS_EVERY))
  assert.ok(Math.abs(share - 1 / ELITE_ONE_IN) < 0.02)
})

test('elites carry every affix over enough waves', () => {
  const affixes = new Set(wavesUpTo(8000).map((wave) => eliteFor(where(wave))).filter(Boolean))
  assert.deepEqual([...affixes].sort(), [...AFFIXES].sort())
})

test('the same wave always gives the same monster', () => {
  assert.deepEqual(build(17, 'world-theme'), build(17, 'world-theme'))
})

test('a monster has the wave as level and full health that takes HITS_TO_KILL reference hits', () => {
  const wave = firstWave((each) => kindForWave(where(each)) === 'common' && !eliteFor(where(each)))
  const monster = build(wave)
  assert.equal(monster.level, wave)
  assert.equal(monster.hp, monster.maxHp)
  assert.ok(Math.abs(monster.maxHp - HITS_TO_KILL * referencePartyHit(wave).total) < 1e-6)
})

test('a boss has its kind\'s health, attack and reward', () => {
  const monster = build(BOSS_EVERY)
  assert.equal(monster.kind, 'boss')
  assert.equal(monster.affix, null)
  assert.ok(Math.abs(monster.maxHp - 4 * HITS_TO_KILL * referencePartyHit(BOSS_EVERY).total) < 1e-6)
  assert.equal(monster.attack, MONSTER_KINDS.boss.attack)
  assert.equal(monster.reward, MONSTER_KINDS.boss.reward)
})

test('an armored monster takes half damage from physical hits', () => {
  const wave = firstWave((each) => kindForWave(where(each)) === 'armored' && !eliteFor(where(each)))
  const monster = build(wave)
  assert.deepEqual([monster.physical, monster.magical], [0.5, 1.5])
})

test('an elite has more health and reward than its kind', () => {
  const wave = firstWave((each) => kindForWave(where(each)) === 'common' && eliteFor(where(each)))
  const monster = build(wave)
  assert.ok(Math.abs(monster.maxHp - ELITE.hp * HITS_TO_KILL * referencePartyHit(wave).total) < 1e-6)
  assert.equal(monster.reward, ELITE.reward)
})

test('an ethereal affix on an armored monster replaces its resistances', () => {
  const isEtherealArmored = (each) =>
    kindForWave(where(each)) === 'armored' && eliteFor(where(each)) === 'ethereal'
  const wave = firstWave(isEtherealArmored)
  const monster = build(wave)
  assert.deepEqual([monster.kind, monster.physical, monster.magical], ['armored', 1.5, 0.5])
})

test('a monster is picked among the theme\'s entries of its kind', () => {
  const ids = new Set(
    wavesUpTo(200)
      .filter((wave) => kindForWave(where(wave)) === 'common')
      .map((wave) => build(wave, 'world-theme').id)
  )
  assert.deepEqual([...ids].sort(), ['rumble-banana', 'rumble-cherry'])
})

test('a theme without its own entry of a kind gets a generic one', () => {
  assert.equal(build(BOSS_EVERY, 'world-theme').id, 'plain-boss')
})
