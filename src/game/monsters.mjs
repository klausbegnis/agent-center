// Which monster a project meets on a wave, how many kills a wave takes, and the monster's numbers.
// Everything comes from a hash of world, project, wave and kill, so the same fight is always the same.
import {
  ARMORED_SHARE,
  BOSS_EVERY,
  COMMON_SHARE,
  ELITE,
  ELITE_ONE_IN,
  HITS_TO_KILL,
  MONSTER_KINDS,
  REFERENCE_PARTY_SIZE,
  WAVE_KILLS_GROWTH
} from './constants.mjs'
import { monstersFor } from './content.mjs'
import { chanceOf, hashOf } from './hash.mjs'

/** The affixes an elite can carry. The last two swap the monster's resistances for that kind's. */
export const AFFIXES = ['regenerating', 'enraged', 'thorny', 'swift', 'armored', 'ethereal']

/**
 * @typedef {{ worldId: string, projectId: string, wave: number, kill?: number }} Where
 * `kill` counts the monsters already killed on this wave; 0 when left out.
 */

/** One text per monster and purpose, so each roll is independent of the others. */
const rollText = ({ worldId, projectId, wave, kill = 0 }, purpose) =>
  `${worldId}|${projectId}|${wave}|${kill}|${purpose}`

/** The first monster of every BOSS_EVERY-th wave is its boss. */
const isBoss = ({ wave, kill = 0 }) => wave % BOSS_EVERY === 0 && kill === 0

/**
 * The kills a wave takes before the next one: 1 at or below the world level, then
 * WAVE_KILLS_GROWTH times more for each level above it.
 *
 * @param {number} wave
 * @param {number} worldLevel
 * @returns {number}
 */
export function killsToPass(wave, worldLevel) {
  return Math.ceil(WAVE_KILLS_GROWTH ** Math.max(0, wave - worldLevel))
}

/**
 * The kind of a monster: the boss that opens every BOSS_EVERY-th wave, otherwise common,
 * armored or ethereal by hash.
 *
 * @param {Where} where
 * @returns {'common' | 'armored' | 'ethereal' | 'boss'}
 */
export function kindForWave(where) {
  if (isBoss(where)) return 'boss'
  const roll = chanceOf(rollText(where, 'kind'))
  if (roll < COMMON_SHARE) return 'common'
  return roll < COMMON_SHARE + ARMORED_SHARE ? 'armored' : 'ethereal'
}

/**
 * The elite affix of a monster, or null. About one monster in ELITE_ONE_IN, never a boss.
 *
 * @param {Where} where
 * @returns {string | null} one of AFFIXES
 */
export function eliteFor(where) {
  if (isBoss(where)) return null
  if (chanceOf(rollText(where, 'elite')) >= 1 / ELITE_ONE_IN) return null
  return AFFIXES[hashOf(rollText(where, 'affix')) % AFFIXES.length]
}

/** Damage factors by type: the kind's, unless a resistance affix replaces them. */
function resistancesFor(kind, affix) {
  const source = affix === 'armored' || affix === 'ethereal' ? MONSTER_KINDS[affix] : MONSTER_KINDS[kind]
  return { physical: source.physical, magical: source.magical }
}

/**
 * The monster a project meets on a wave, at full health. Its level is the wave.
 *
 * @param {object} options
 * @param {string} options.worldId
 * @param {string} options.projectId
 * @param {number} options.wave
 * @param {number} [options.kill] the monsters already killed on this wave
 * @param {number} [options.partySize] the working characters it meets; the full reference party
 *   when left out
 * @param {string | null} options.themeId the room's theme, for picking the entry
 * @param {{ monsters: object[] }} options.content a valid monsters file
 * @param {(level: number) => { physical: number, magical: number, total: number }} options.referencePartyHit
 * @returns {{ id: string, name: string, kind: string, affix: string | null, level: number,
 *   maxHp: number, hp: number, physical: number, magical: number, attack: number, reward: number,
 *   loot: Record<string, number>, sprite: { body: string, accent: string } }}
 */
export function monsterFor(options) {
  const { worldId, projectId, wave, kill = 0, themeId, content, referencePartyHit } = options
  const partySize = Math.min(options.partySize ?? REFERENCE_PARTY_SIZE, REFERENCE_PARTY_SIZE)
  const partyShare = partySize / REFERENCE_PARTY_SIZE
  const where = { worldId, projectId, wave, kill }
  const kind = kindForWave(where)
  const affix = eliteFor(where)
  const entries = monstersFor(content, { kind, themeId })
  const entry = entries[hashOf(rollText(where, 'entry')) % entries.length]
  const factors = MONSTER_KINDS[kind]
  const eliteHp = affix ? ELITE.hp : 1
  const maxHp = HITS_TO_KILL * referencePartyHit(wave).total * partyShare * factors.hp * eliteHp
  return {
    id: entry.id,
    name: entry.name,
    kind,
    affix,
    level: wave,
    maxHp,
    hp: maxHp,
    ...resistancesFor(kind, affix),
    attack: factors.attack,
    reward: factors.reward * (affix ? ELITE.reward : 1),
    loot: { ...entry.loot },
    sprite: { ...entry.sprite }
  }
}
