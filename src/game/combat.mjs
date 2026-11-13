// One combat tick between a project's working party and its monster, and the reward for a kill.
// Pure: every function returns new objects and leaves its inputs alone.
import { POWER_GROWTH, REWARD_BASE, REWARD_GROWTH, STAMINA_TICKS } from './constants.mjs'
import { chanceOf } from './hash.mjs'

/**
 * A reference party's stamina at level 0. Drain and healing are both shares of the pool, so
 * this only sets the scale of the numbers shown; 1000 keeps them readable at low levels.
 */
const STAMINA_BASE = 1000
/**
 * Mitigation is MITIGATION_CAP * R / (R + MITIGATION_HALF_RESILIENCE) for a total resilience R:
 * one point blocks 16%, eleven (a level 20 defender) 59%, and it never passes 80%, so a party
 * of defenders alone cannot make a monster harmless.
 */
const MITIGATION_CAP = 0.8
const MITIGATION_HALF_RESILIENCE = 4
/**
 * Healing per tick is HEAL_CAP_SHARE * M / (M + HEAL_HALF_MEDICINE) of the stamina pool for a
 * total medicine M: one point heals 2.4%, just above the 2.1% a common monster still drains
 * through one point of resilience, so a level 1 reference party holds. Never above 6%.
 */
const HEAL_CAP_SHARE = 0.06
const HEAL_HALF_MEDICINE = 1.5
/** A regenerating monster heals this share of its health each tick it survives (about +56% ticks). */
const REGENERATING_SHARE = 0.01
/** An enraged monster's attack rises with the health it lost, up to this much more near death. */
const ENRAGED_MAX_BONUS = 1
/** A thorny monster turns this share of the health it loses into the same share of lost stamina. */
const THORNY_SHARE = 0.5
/** A swift monster strikes this much harder. */
const SWIFT_ATTACK = 1.5
/** The chance of an item drop: a base, a bonus per point of luck, a cap, and the elite factor. */
const ITEM_DROP_BASE = 0.05
const ITEM_DROP_PER_LUCK = 0.005
const ITEM_DROP_MAX = 0.5
const ELITE_ITEM_DROP_FACTOR = 3
/** Floating point leaves crumbs; less than this share of the whole counts as nothing left. */
const SETTLE_SHARE = 1e-9

/** The value, or 0 when only floating-point crumbs of the whole are left. */
const settle = (value, whole) => (value <= whole * SETTLE_SHARE ? 0 : value)
const sumOf = (people, attribute) => people.reduce((total, person) => total + person[attribute], 0)

/**
 * The stamina of a reference party of a level.
 *
 * @param {number} level
 * @returns {number}
 */
export const referenceStamina = (level) => STAMINA_BASE * POWER_GROWTH ** level

/**
 * The stamina a monster drains per tick before defence: a party of `level` with no defence and
 * no healing lasts STAMINA_TICKS ticks against a common monster, less against a harder kind.
 *
 * @param {{ attack: number }} monster
 * @param {number} level the monster's level
 * @returns {number}
 */
export const monsterAttack = (monster, level) => (referenceStamina(level) / STAMINA_TICKS) * monster.attack

/**
 * The share of a monster's attack the defenders block, from 0 up to (never reaching) MITIGATION_CAP.
 *
 * @param {{ resilience: number }[]} defenders
 * @returns {number}
 */
export function mitigation(defenders) {
  const resilience = sumOf(defenders, 'resilience')
  return resilience <= 0 ? 0 : (MITIGATION_CAP * resilience) / (resilience + MITIGATION_HALF_RESILIENCE)
}

/**
 * The stamina the supporters restore per tick.
 *
 * @param {{ medicine: number }[]} supporters
 * @param {number} maxStamina
 * @returns {number}
 */
export function healing(supporters, maxStamina) {
  const medicine = sumOf(supporters, 'medicine')
  return medicine <= 0 ? 0 : (maxStamina * HEAL_CAP_SHARE * medicine) / (medicine + HEAL_HALF_MEDICINE)
}

/** How much harder the monster's affix makes it strike, at the health it has left. */
function affixAttackFactor(monster, hp) {
  if (monster.affix === 'swift') return SWIFT_ATTACK
  if (monster.affix === 'enraged') return 1 + ENRAGED_MAX_BONUS * (1 - hp / monster.maxHp)
  return 1
}

/** The monster's health after the party's hits and its own regeneration, and the damage taken. */
function strikeMonster(monster, hits) {
  const dealt = hits.physical * monster.physical + hits.magical * monster.magical
  const damage = Math.min(monster.hp, dealt)
  const hp = settle(monster.hp - damage, monster.maxHp)
  if (hp === 0 || monster.affix !== 'regenerating') return { hp, damage }
  return { hp: Math.min(monster.maxHp, hp + REGENERATING_SHARE * monster.maxHp), damage }
}

/**
 * One tick of a fight: the party hits, the monster (if alive) strikes back, thorns bite, the
 * supporters heal. When stamina reaches 0 the party is exhausted and must rest; the monster
 * keeps its health.
 *
 * @param {object} fight
 * @param {{ hp: number, maxHp: number, physical: number, magical: number, attack: number,
 *   affix: string | null, level: number }} fight.monster
 * @param {{ physical: number, magical: number }} fight.hits the party's damage this tick, by type
 * @param {{ resilience: number }[]} fight.defenders
 * @param {{ medicine: number }[]} fight.supporters
 * @param {number} fight.stamina
 * @param {number} fight.maxStamina
 * @param {number} [fight.level] the level the monster strikes at; its own level when left out
 * @returns {{ monster: object, stamina: number, damage: number, killed: boolean, exhausted: boolean }}
 */
export function fightTick(fight) {
  const { monster, hits, defenders, supporters, stamina, maxStamina, level = monster.level } = fight
  const { hp, damage } = strikeMonster(monster, hits)
  const killed = hp === 0
  const strike = killed
    ? 0
    : monsterAttack(monster, level) * affixAttackFactor(monster, hp) * (1 - mitigation(defenders))
  const thorns = monster.affix === 'thorny' ? (THORNY_SHARE * maxStamina * damage) / monster.maxHp : 0
  const restored = Math.min(maxStamina, stamina - strike - thorns + healing(supporters, maxStamina))
  const nextStamina = settle(Math.max(0, restored), maxStamina)
  return {
    monster: { ...monster, hp },
    stamina: nextStamina,
    damage,
    killed,
    exhausted: nextStamina === 0
  }
}

/**
 * Splits a whole number by weights into whole numbers that add up to it: each gets its floor,
 * and what is left goes to the largest remainders, earlier entries first on a tie.
 */
function splitByWeights(total, weights) {
  const entries = Object.entries(weights)
  const weightSum = entries.reduce((sum, [, weight]) => sum + weight, 0)
  const shares = entries.map(([id, weight], order) => {
    const exact = (total * weight) / weightSum
    return { id, order, amount: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })
  let left = total - shares.reduce((sum, share) => sum + share.amount, 0)
  const byRemainder = [...shares].sort((a, b) => b.remainder - a.remainder || a.order - b.order)
  for (const share of byRemainder) {
    if (left <= 0) break
    share.amount += 1
    left -= 1
  }
  return Object.fromEntries(shares.map((share) => [share.id, share.amount]))
}

/** The chance of an item drop for a party's luck, tripled for an elite, never above the cap. */
function itemDropChance(luck, isElite) {
  const chance = Math.min(ITEM_DROP_MAX, ITEM_DROP_BASE + ITEM_DROP_PER_LUCK * luck)
  return isElite ? Math.min(ITEM_DROP_MAX, chance * ELITE_ITEM_DROP_FACTOR) : chance
}

/**
 * What a kill gives: materials split by the monster's loot weights, and whether an item drops.
 *
 * @param {{ level: number, reward: number, affix: string | null, loot: Record<string, number> }} monster
 * @param {{ luck: number, seed: string }} roll seed makes the drop deterministic (e.g. world, project, wave)
 * @returns {{ materials: Record<string, number>, itemDrop: boolean }}
 */
export function rewardFor(monster, { luck, seed }) {
  const total = Math.round(REWARD_BASE * REWARD_GROWTH ** monster.level * monster.reward)
  return {
    materials: splitByWeights(total, monster.loot),
    itemDrop: chanceOf(`${seed}|item`) < itemDropChance(luck, Boolean(monster.affix))
  }
}
