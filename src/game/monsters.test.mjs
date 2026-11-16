import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BOSS_EVERY,
  HITS_TO_KILL,
  LEGENDARY_ONE_IN,
  MONSTER_KINDS,
  MONSTER_RANKS,
  WAVE_KILLS_GROWTH
} from './constants.mjs'
import { AFFIXES, affixFor, killsToPass, kindForWave, monsterFor, rankFor, rankOf } from './monsters.mjs'

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

test('the first monster of every BOSS_EVERY-th wave is a boss and no other wave opens with one', () => {
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

test('off boss waves each rank comes up about as often as its share, never boss or legendary', () => {
  const ranks = wavesUpTo(20000).filter((wave) => wave % BOSS_EVERY).map((wave) => rankFor(where(wave)))
  for (const rank of ['normal', 'veteran', 'elite', 'champion']) {
    const share = ranks.filter((each) => each === rank).length / ranks.length
    assert.ok(Math.abs(share - MONSTER_RANKS[rank].share) < 0.01, `${rank}: ${share}`)
  }
  assert.ok(!ranks.includes('boss') && !ranks.includes('legendary'))
})

test('a boss wave opens with a boss, legendary about one time in LEGENDARY_ONE_IN', () => {
  const ranks = wavesUpTo(4000).map((index) => rankFor(where(index * BOSS_EVERY)))
  assert.ok(ranks.every((rank) => rank === 'boss' || rank === 'legendary'))
  const share = ranks.filter((rank) => rank === 'legendary').length / ranks.length
  assert.ok(Math.abs(share - 1 / LEGENDARY_ONE_IN) < 0.03)
})

test('only elites, champions and legendary bosses carry an affix', () => {
  for (const wave of wavesUpTo(3000)) {
    const hasAffix = affixFor(where(wave)) !== null
    assert.equal(hasAffix, ['elite', 'champion', 'legendary'].includes(rankFor(where(wave))))
  }
})

test('affixed monsters carry every affix over enough waves', () => {
  const affixes = new Set(wavesUpTo(8000).map((wave) => affixFor(where(wave))).filter(Boolean))
  assert.deepEqual([...affixes].sort(), [...AFFIXES].sort())
})

test('a monster saved before ranks gets its rank from its kind and affix', () => {
  assert.equal(rankOf({ kind: 'boss', affix: null }), 'boss')
  assert.equal(rankOf({ kind: 'common', affix: 'thorny' }), 'elite')
  assert.equal(rankOf({ kind: 'armored', affix: null }), 'normal')
  assert.equal(rankOf({ kind: 'common', rank: 'champion', affix: 'swift' }), 'champion')
})

test('the same wave always gives the same monster', () => {
  assert.deepEqual(build(17, 'world-theme'), build(17, 'world-theme'))
})

test('a monster has the wave as level and full health that takes HITS_TO_KILL reference hits', () => {
  const wave = firstWave((each) => kindForWave(where(each)) === 'common' && rankFor(where(each)) === 'normal')
  const monster = build(wave)
  assert.equal(monster.level, wave)
  assert.equal(monster.hp, monster.maxHp)
  assert.ok(Math.abs(monster.maxHp - HITS_TO_KILL * referencePartyHit(wave).total) < 1e-6)
})

test('a boss has its kind\'s health, attack and reward', () => {
  const wave = firstWave((each) => each % BOSS_EVERY === 0 && rankFor(where(each)) === 'boss')
  const monster = build(wave)
  assert.equal(monster.kind, 'boss')
  assert.equal(monster.affix, null)
  assert.ok(Math.abs(monster.maxHp - 4 * HITS_TO_KILL * referencePartyHit(wave).total) < 1e-6)
  assert.equal(monster.attack, MONSTER_KINDS.boss.attack)
  assert.equal(monster.reward, MONSTER_KINDS.boss.reward)
})

test('an armored monster takes half damage from physical hits', () => {
  const wave = firstWave((each) => kindForWave(where(each)) === 'armored' && !affixFor(where(each)))
  const monster = build(wave)
  assert.deepEqual([monster.physical, monster.magical], [0.5, 1.5])
})

for (const rank of ['veteran', 'elite', 'champion']) {
  test(`a ${rank} has its rank's health, reward and drop factor on top of its kind's`, () => {
    const wave = firstWave((each) => kindForWave(where(each)) === 'common' && rankFor(where(each)) === rank)
    const monster = build(wave)
    const factors = MONSTER_RANKS[rank]
    assert.equal(monster.rank, rank)
    assert.ok(Math.abs(monster.maxHp - factors.hp * HITS_TO_KILL * referencePartyHit(wave).total) < 1e-6)
    assert.equal(monster.reward, factors.reward)
    assert.equal(monster.dropFactor, factors.drop)
  })
}

test('a legendary boss is a boss with an affix and the legendary factors', () => {
  const wave = firstWave((each) => each % BOSS_EVERY === 0 && rankFor(where(each)) === 'legendary')
  const monster = build(wave)
  const { legendary } = MONSTER_RANKS
  assert.equal(monster.kind, 'boss')
  assert.ok(AFFIXES.includes(monster.affix))
  const expected = 4 * legendary.hp * HITS_TO_KILL * referencePartyHit(wave).total
  assert.ok(Math.abs(monster.maxHp - expected) < 1e-6)
  assert.equal(monster.reward, MONSTER_KINDS.boss.reward * legendary.reward)
})

test('an ethereal affix on an armored monster replaces its resistances', () => {
  const isEtherealArmored = (each) =>
    kindForWave(where(each)) === 'armored' && affixFor(where(each)) === 'ethereal'
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
  assert.equal(build(BOSS_EVERY, 'world-theme').kind, 'boss')
  assert.equal(build(BOSS_EVERY, 'world-theme').id, 'plain-boss')
})

test('only the first monster of a boss wave is the boss', () => {
  const where = { worldId: 'main', projectId: 'cosmic-llama', wave: 20 }
  const kinds = [1, 2, 3, 4, 5].map((kill) => kindForWave({ ...where, kill }))
  assert.ok(kinds.every((kind) => kind !== 'boss'))
})

test('the monsters of one wave differ from kill to kill', () => {
  const where = { worldId: 'main', projectId: 'cosmic-llama', wave: 7 }
  const kinds = new Set(Array.from({ length: 40 }, (_, kill) => kindForWave({ ...where, kill })))
  assert.ok(kinds.size > 1)
})

test('a wave at or below the world level passes with one kill, and each level above doubles it', () => {
  assert.equal(killsToPass(3, 10), 1)
  assert.equal(killsToPass(10, 10), 1)
  assert.equal(killsToPass(11, 10), WAVE_KILLS_GROWTH)
  assert.equal(killsToPass(14, 10), WAVE_KILLS_GROWTH ** 4)
})

test('a monster met by a smaller party has health for that many reference characters', () => {
  const where = { worldId: 'main', projectId: 'cosmic-llama', wave: 12, themeId: null }
  const options = { ...where, content: content(), referencePartyHit }
  const full = monsterFor(options)
  const pair = monsterFor({ ...options, partySize: 2 })
  const crowd = monsterFor({ ...options, partySize: 9 })
  assert.ok(Math.abs(pair.maxHp - full.maxHp / 2) < 1e-6)
  assert.equal(crowd.maxHp, full.maxHp)
})
