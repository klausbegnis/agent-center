import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HITS_TO_KILL, MONSTER_KINDS, STAMINA_TICKS } from './constants.mjs'
import { fightTick, healing, mitigation, monsterAttack, referenceStamina, rewardFor } from './combat.mjs'

const referencePartyHit = (level) => ({
  physical: 60 * 1.04 ** level,
  magical: 40 * 1.04 ** level,
  total: 100 * 1.04 ** level
})
const BALANCE_LEVELS = [1, 20, 60, 150]

/** A monster of a kind and level, built the way monsters.mjs builds one. */
function monsterOf(kind, level, affix = null) {
  const factors = MONSTER_KINDS[kind]
  const maxHp = HITS_TO_KILL * referencePartyHit(level).total * factors.hp * (affix ? 1.5 : 1)
  return {
    id: 'rumble-banana', name: 'Rumble Banana', kind, affix, level, maxHp, hp: maxHp,
    physical: factors.physical, magical: factors.magical, attack: factors.attack, reward: factors.reward,
    loot: { ore: 2, runes: 1 }
  }
}

/** The reference party of a level: the stub's hits, one defender and one supporter. */
function referenceParty(level) {
  const trained = 1 + Math.floor(level / 2)
  const { physical, magical } = referencePartyHit(level)
  return {
    hits: { physical, magical },
    defenders: [{ resilience: trained }],
    supporters: [{ medicine: trained }]
  }
}

/** Plays ticks until the monster dies or the party is exhausted; a dead monster is replaced. */
function fight({ party, makeMonster, level, kills = 1 }) {
  const maxStamina = referenceStamina(level)
  let state = { monster: makeMonster(), stamina: maxStamina }
  let killed = 0
  for (let tick = 1; tick <= 2000; tick++) {
    const result = fightTick({ ...party, ...state, maxStamina, level })
    if (result.exhausted) return { ticks: tick, killed, exhausted: true, stamina: 0, maxStamina }
    if (result.killed) killed += 1
    if (killed === kills) {
      return { ticks: tick, killed, exhausted: false, stamina: result.stamina, maxStamina }
    }
    state = { monster: result.killed ? makeMonster() : result.monster, stamina: result.stamina }
  }
  throw new Error('the fight never ended')
}

test('a reference party kills a common monster of its level in exactly HITS_TO_KILL ticks', () => {
  for (const level of BALANCE_LEVELS) {
    const makeMonster = () => monsterOf('common', level)
    const result = fight({ party: referenceParty(level), makeMonster, level })
    assert.deepEqual([result.ticks, result.exhausted], [HITS_TO_KILL, false], `level ${level}`)
  }
})

test('a reference party with a defender and a supporter holds its stamina against common monsters', () => {
  for (const level of BALANCE_LEVELS) {
    const makeMonster = () => monsterOf('common', level)
    const result = fight({ party: referenceParty(level), makeMonster, level, kills: 10 })
    assert.equal(result.exhausted, false, `level ${level}`)
    assert.equal(result.stamina, result.maxStamina, `level ${level}`)
  }
})

test('without a defender or a supporter a party lasts STAMINA_TICKS ticks against a common monster', () => {
  for (const level of BALANCE_LEVELS) {
    const party = { hits: { physical: 0, magical: 0 }, defenders: [], supporters: [] }
    const result = fight({ party, makeMonster: () => monsterOf('common', level), level })
    assert.deepEqual([result.exhausted, result.ticks], [true, STAMINA_TICKS], `level ${level}`)
  }
})

test('without a defender or a supporter a reference party is exhausted before its second kill', () => {
  for (const level of BALANCE_LEVELS) {
    const party = { ...referenceParty(level), defenders: [], supporters: [] }
    const result = fight({ party, makeMonster: () => monsterOf('common', level), level, kills: 2 })
    assert.deepEqual([result.exhausted, result.killed], [true, 1], `level ${level}`)
  }
})

test('without a defender or a supporter the party is exhausted before it kills a boss', () => {
  for (const level of BALANCE_LEVELS) {
    const party = { ...referenceParty(level), defenders: [], supporters: [] }
    const result = fight({ party, makeMonster: () => monsterOf('boss', level), level })
    assert.deepEqual([result.exhausted, result.killed], [true, 0], `level ${level}`)
  }
})

test('an all-physical party takes twice as long against an armored monster', () => {
  for (const level of BALANCE_LEVELS) {
    const party = { ...referenceParty(level), hits: { physical: referencePartyHit(level).total, magical: 0 } }
    const common = fight({ party, makeMonster: () => monsterOf('common', level), level })
    const armored = fight({ party, makeMonster: () => monsterOf('armored', level), level })
    assert.equal(armored.ticks, 2 * common.ticks, `level ${level}`)
  }
})

test('a fight tick leaves its inputs unchanged', () => {
  const monster = monsterOf('common', 5, 'thorny')
  const party = referenceParty(5)
  const before = structuredClone({ monster, party })
  fightTick({ monster, ...party, stamina: 10, maxStamina: referenceStamina(5), level: 5 })
  assert.deepEqual({ monster, party }, before)
})

test('an exhausted party leaves the monster with the health it had left', () => {
  const monster = { ...monsterOf('common', 3), hp: 500 }
  const result = fightTick({ monster, hits: { physical: 100, magical: 0 }, defenders: [], supporters: [],
    stamina: 1, maxStamina: referenceStamina(3), level: 3 })
  assert.deepEqual([result.exhausted, result.stamina, result.killed], [true, 0, false])
  assert.equal(result.monster.hp, 400)
})

test('the monster drains a fortieth of the reference stamina of its level per tick', () => {
  assert.ok(Math.abs(monsterAttack({ attack: 1 }, 20) * STAMINA_TICKS - referenceStamina(20)) < 1e-9)
  assert.ok(Math.abs(monsterAttack({ attack: 1.5 }, 20) - 1.5 * monsterAttack({ attack: 1 }, 20)) < 1e-9)
})

test('mitigation grows with resilience, with diminishing returns, and stays below one', () => {
  const at = (resilience) => mitigation([{ resilience }])
  assert.equal(mitigation([]), 0)
  assert.ok(at(2) - at(1) > at(11) - at(10))
  assert.ok(at(1_000_000) < 1)
  assert.equal(mitigation([{ resilience: 3 }, { resilience: 4 }]), at(7))
})

test('healing grows with medicine and with the stamina pool', () => {
  assert.equal(healing([], 1000), 0)
  assert.ok(healing([{ medicine: 2 }], 1000) > healing([{ medicine: 1 }], 1000))
  assert.ok(Math.abs(healing([{ medicine: 2 }], 2000) - 2 * healing([{ medicine: 2 }], 1000)) < 1e-9)
})

/** Damage taken by a monster over ticks with the given affix, against a party that never tires. */
const staminaLost = (affix, monsterHp) => {
  const monster = { ...monsterOf('common', 10, affix), hp: monsterHp ?? monsterOf('common', 10).maxHp }
  const maxStamina = referenceStamina(10)
  const result = fightTick({ monster, hits: { physical: 1000, magical: 0 }, defenders: [], supporters: [],
    stamina: maxStamina, maxStamina, level: 10 })
  return { lost: maxStamina - result.stamina, result }
}

test('a swift monster strikes harder than a plain one', () => {
  assert.ok(staminaLost('swift').lost > staminaLost(null).lost)
})

test('an enraged monster strikes harder as its health falls', () => {
  const healthy = staminaLost('enraged')
  const wounded = staminaLost('enraged', 2000)
  assert.ok(wounded.lost > healthy.lost)
})

test('a thorny monster costs stamina for the damage dealt to it', () => {
  assert.ok(staminaLost('thorny').lost > staminaLost(null).lost)
})

test('a regenerating monster heals after it is hit, but not past its full health', () => {
  const { result } = staminaLost('regenerating')
  const plain = staminaLost(null).result
  assert.ok(result.monster.hp > plain.monster.hp)
  assert.ok(result.monster.hp <= result.monster.maxHp)
})

test('a kill gives whole materials split by the loot weights that add up to the reward', () => {
  const monster = monsterOf('common', 40)
  const { materials } = rewardFor(monster, { luck: 1, seed: 'world-1|rumble-banana|40' })
  const total = Math.round(10 * 1.03 ** 40 * monster.reward)
  assert.equal(materials.ore + materials.runes, total)
  assert.ok(Number.isInteger(materials.ore) && Number.isInteger(materials.runes))
  assert.ok(materials.ore > materials.runes)
})

test('an elite kill gives more materials', () => {
  const plain = rewardFor(monsterOf('common', 40), { luck: 1, seed: 'rumble' }).materials
  const eliteMonster = { ...monsterOf('common', 40), affix: 'swift', reward: 3 }
  const elite = rewardFor(eliteMonster, { luck: 1, seed: 'rumble' }).materials
  assert.ok(elite.ore + elite.runes > plain.ore + plain.runes)
})

test('the same kill always gives the same reward', () => {
  const monster = monsterOf('armored', 12)
  const roll = { luck: 4, seed: 'world-1|7' }
  assert.deepEqual(rewardFor(monster, roll), rewardFor(monster, roll))
})

const dropShare = (monster, luck) => {
  const seeds = Array.from({ length: 4000 }, (_, index) => `world-1|rumble-banana|${index}`)
  return seeds.filter((seed) => rewardFor(monster, { luck, seed }).itemDrop).length / seeds.length
}

test('items drop about one kill in twenty without luck', () => {
  assert.ok(Math.abs(dropShare(monsterOf('common', 5), 0) - 0.05) < 0.015)
})

test('luck raises the item drop chance up to half of the kills', () => {
  assert.ok(dropShare(monsterOf('common', 5), 20) > dropShare(monsterOf('common', 5), 0) + 0.05)
  assert.ok(Math.abs(dropShare(monsterOf('common', 5), 10_000) - 0.5) < 0.03)
})

test('an elite triples the item drop chance', () => {
  assert.ok(Math.abs(dropShare(monsterOf('common', 5, 'swift'), 0) - 0.15) < 0.02)
})
