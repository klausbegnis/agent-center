// One combat tick between a project's working party and its monster, and the reward for a kill.
// Pure: every function returns new objects and leaves its inputs alone.
import {
  ENRAGED_MAX_BONUS,
  HEAL_CAP_SHARE,
  HEAL_HALF,
  ITEM_DROP_BASE,
  ITEM_DROP_MAX,
  ITEM_DROP_PER_LUCK,
  MITIGATION_CAP,
  MITIGATION_HALF,
  MONSTER_RANKS,
  POWER_GROWTH,
  REGENERATING_DAMAGE_SHARE,
  REGENERATING_SHARE,
  REWARD_BASE,
  REWARD_GROWTH,
  STAMINA_BASE,
  STAMINA_TICKS,
  SWIFT_ATTACK,
  THORNY_SHARE
} from './constants.mjs'
import { chanceOf } from './hash.mjs'
import { rankOf } from './monsters.mjs'

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
 * @param {{ resilience: number }[]} defenders each defender's resilience as a ratio of the
 *   reference defender's at the monster's level (1 for a reference defender)
 * @returns {number}
 */
export function mitigation(defenders) {
  const resilience = sumOf(defenders, 'resilience')
  return resilience <= 0 ? 0 : (MITIGATION_CAP * resilience) / (resilience + MITIGATION_HALF)
}

/**
 * The stamina the supporters restore per tick.
 *
 * @param {{ medicine: number }[]} supporters each supporter's medicine as a ratio of the reference
 *   supporter's at the monster's level
 * @param {number} maxStamina
 * @returns {number}
 */
export function healing(supporters, maxStamina) {
  const medicine = sumOf(supporters, 'medicine')
  return medicine <= 0 ? 0 : (maxStamina * HEAL_CAP_SHARE * medicine) / (medicine + HEAL_HALF)
}

/**
 * How much harder the monster's affix makes it strike, at the health it has left. `weakening`
 * (legendary loot) takes that share off what the affix adds.
 */
function affixAttackFactor(monster, hp, weakening = 0) {
  if (monster.affix === 'swift') return 1 + (SWIFT_ATTACK - 1) * (1 - weakening)
  if (monster.affix === 'enraged') return 1 + ENRAGED_MAX_BONUS * (1 - hp / monster.maxHp) * (1 - weakening)
  return 1
}

/**
 * The damage factor of a type against the monster. A resistance affix's resisted type is brought
 * `weakening` of the way back to full damage.
 */
function damageFactor(monster, type, weakening) {
  const factor = monster[type]
  const resisted = (monster.affix === 'armored' || monster.affix === 'ethereal') && factor < 1
  return resisted ? factor + (1 - factor) * weakening : factor
}

/**
 * The monster's health after the party's hits and its own regeneration, and the damage taken.
 * Regeneration never undoes more than part of the damage, so every fight moves forward.
 */
function strikeMonster(monster, hits, weakening = 0) {
  const dealt = hits.physical * damageFactor(monster, 'physical', weakening) +
    hits.magical * damageFactor(monster, 'magical', weakening)
  const damage = Math.min(monster.hp, dealt)
  const hp = settle(monster.hp - damage, monster.maxHp)
  if (hp === 0 || monster.affix !== 'regenerating') return { hp, damage }
  const kept = 1 - weakening
  const regenerated = Math.min(REGENERATING_SHARE * kept * monster.maxHp, REGENERATING_DAMAGE_SHARE * kept * damage)
  return { hp: Math.min(monster.maxHp, hp + regenerated), damage }
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
 * @param {{ drainFactor?: number, affixWeakening?: number, thorns?: number }} [fight.legendary] the
 *   party's legendary loot: a factor on the stamina the monster drains, the share its affix is
 *   weakened by, and the share of the stamina it drains (of the pool) it loses of its own health
 * @returns {{ monster: object, stamina: number, damage: number, killed: boolean, exhausted: boolean }}
 */
export function fightTick(fight) {
  const { monster, hits, defenders, supporters, stamina, maxStamina, level = monster.level } = fight
  const { drainFactor = 1, affixWeakening = 0, thorns: reflect = 0 } = fight.legendary ?? {}
  const struck = strikeMonster(monster, hits, affixWeakening)
  const { damage } = struck
  let hp = struck.hp
  const strike = hp === 0
    ? 0
    : monsterAttack(monster, level) * affixAttackFactor(monster, hp, affixWeakening) *
      (1 - mitigation(defenders)) * drainFactor
  if (reflect > 0 && strike > 0) hp = settle(Math.max(0, hp - (reflect * monster.maxHp * strike) / maxStamina), monster.maxHp)
  const killed = hp === 0
  const thornyShare = THORNY_SHARE * (1 - affixWeakening)
  const thorns = monster.affix === 'thorny' ? (thornyShare * maxStamina * damage) / monster.maxHp : 0
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

/**
 * The chance of an item drop for a party's luck, times the monster's rank factor and the share
 * more from legendary loot, never above the cap.
 */
function itemDropChance(luck, dropFactor, dropBonus = 0) {
  const chance = Math.min(ITEM_DROP_MAX, ITEM_DROP_BASE + ITEM_DROP_PER_LUCK * luck)
  return Math.min(ITEM_DROP_MAX, chance * dropFactor * (1 + dropBonus))
}

/** A monster saved before ranks carries no drop factor: its rank's, from the kind and affix it has. */
const dropFactorOf = (monster) => monster.dropFactor ?? MONSTER_RANKS[rankOf(monster)].drop

/**
 * What a kill gives: materials split by the monster's loot weights, and whether an item drops.
 *
 * @param {{ level: number, reward: number, dropFactor?: number, affix: string | null,
 *   loot: Record<string, number> }} monster
 * @param {{ luck: number, seed: string, dropBonus?: number }} roll seed makes the drop deterministic
 *   (e.g. world, project, wave); `dropBonus` is a share more item drop chance (legendary loot)
 * @returns {{ materials: Record<string, number>, itemDrop: boolean }}
 */
export function rewardFor(monster, { luck, seed, dropBonus = 0 }) {
  const total = Math.round(REWARD_BASE * REWARD_GROWTH ** monster.level * monster.reward)
  return {
    materials: splitByWeights(total, monster.loot),
    itemDrop: chanceOf(`${seed}|item`) < itemDropChance(luck, dropFactorOf(monster), dropBonus)
  }
}
