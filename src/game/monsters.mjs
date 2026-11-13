// Which monster a project meets on a wave: its kind, whether it is an elite, and its numbers.
// Everything comes from a hash of world, project and wave, so the same wave is always the same fight.
import { BOSS_EVERY, ELITE, ELITE_ONE_IN, HITS_TO_KILL, MONSTER_KINDS } from './constants.mjs'
import { monstersFor } from './content.mjs'
import { chanceOf, hashOf } from './hash.mjs'

/** The affixes an elite can carry. The last two swap the monster's resistances for that kind's. */
export const AFFIXES = ['regenerating', 'enraged', 'thorny', 'swift', 'armored', 'ethereal']
/** Off boss waves, a common monster about half the time; the rest split between the two resistant kinds. */
const COMMON_SHARE = 0.5
const ARMORED_SHARE = 0.25

/** One text per wave and purpose, so each roll is independent of the others. */
const rollText = ({ worldId, projectId, wave }, purpose) => `${worldId}|${projectId}|${wave}|${purpose}`

const isBossWave = (wave) => wave % BOSS_EVERY === 0

/**
 * The kind of monster on a wave: a boss every BOSS_EVERY waves, otherwise common, armored or
 * ethereal by hash.
 *
 * @param {{ worldId: string, projectId: string, wave: number }} where
 * @returns {'common' | 'armored' | 'ethereal' | 'boss'}
 */
export function kindForWave(where) {
  if (isBossWave(where.wave)) return 'boss'
  const roll = chanceOf(rollText(where, 'kind'))
  if (roll < COMMON_SHARE) return 'common'
  return roll < COMMON_SHARE + ARMORED_SHARE ? 'armored' : 'ethereal'
}

/**
 * The elite affix of a wave's monster, or null. About one wave in ELITE_ONE_IN, never a boss.
 *
 * @param {{ worldId: string, projectId: string, wave: number }} where
 * @returns {string | null} one of AFFIXES
 */
export function eliteFor(where) {
  if (isBossWave(where.wave)) return null
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
 * @param {string | null} options.themeId the room's theme, for picking the entry
 * @param {{ monsters: object[] }} options.content a valid monsters file
 * @param {(level: number) => { physical: number, magical: number, total: number }} options.referencePartyHit
 * @returns {{ id: string, name: string, kind: string, affix: string | null, level: number,
 *   maxHp: number, hp: number, physical: number, magical: number, attack: number, reward: number,
 *   loot: Record<string, number>, sprite: { body: string, accent: string } }}
 */
export function monsterFor({ worldId, projectId, wave, themeId, content, referencePartyHit }) {
  const where = { worldId, projectId, wave }
  const kind = kindForWave(where)
  const affix = eliteFor(where)
  const entries = monstersFor(content, { kind, themeId })
  const entry = entries[hashOf(rollText(where, 'entry')) % entries.length]
  const factors = MONSTER_KINDS[kind]
  const eliteHp = affix ? ELITE.hp : 1
  const maxHp = HITS_TO_KILL * referencePartyHit(wave).total * factors.hp * eliteHp
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
