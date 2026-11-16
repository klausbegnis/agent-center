// Which monster a project meets on a wave, how many kills a wave takes, and the monster's numbers.
// Everything comes from a hash of world, project, wave and kill, so the same fight is always the same.
import {
  AFFIX_RANKS,
  ARMORED_SHARE,
  BOSS_EVERY,
  COMMON_SHARE,
  HITS_TO_KILL,
  LEGENDARY_ONE_IN,
  MONSTER_KINDS,
  MONSTER_RANKS,
  REFERENCE_PARTY_SIZE,
  WAVE_KILLS_GROWTH
} from './constants.mjs'
import { monstersFor } from './content.mjs'
import { chanceOf, hashOf } from './hash.mjs'
import { bossFor, generateMonster, HANDMADE_SHARE } from './races.mjs'

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

/** The ranks off boss waves, rarest first, so a low roll is the rare one. */
const WAVE_RANKS = ['champion', 'elite', 'veteran', 'normal']

/**
 * The rank of a monster: on a boss wave `legendary` one time in LEGENDARY_ONE_IN, otherwise
 * `boss`; off them `champion`, `elite`, `veteran` or `normal` by MONSTER_RANKS' shares.
 *
 * @param {Where} where
 * @returns {'normal' | 'veteran' | 'elite' | 'champion' | 'boss' | 'legendary'}
 */
export function rankFor(where) {
  if (isBoss(where)) {
    return chanceOf(rollText(where, 'legendary')) < 1 / LEGENDARY_ONE_IN ? 'legendary' : 'boss'
  }
  const roll = chanceOf(rollText(where, 'elite'))
  let below = 0
  for (const rank of WAVE_RANKS) {
    below += MONSTER_RANKS[rank].share
    if (roll < below) return rank
  }
  return 'normal'
}

/**
 * The affix of a monster, or null: an elite, a champion and a legendary boss carry one.
 *
 * @param {Where} where
 * @returns {string | null} one of AFFIXES
 */
export function affixFor(where) {
  if (!AFFIX_RANKS.includes(rankFor(where))) return null
  return AFFIXES[hashOf(rollText(where, 'affix')) % AFFIXES.length]
}

/**
 * The rank of a monster as saved. Monsters saved before ranks existed have none: a boss is a
 * boss, one with an affix an elite, any other normal.
 *
 * @param {{ rank?: string, kind?: string, affix?: string | null }} monster
 */
export function rankOf(monster) {
  if (Object.hasOwn(MONSTER_RANKS, monster?.rank ?? '')) return monster.rank
  if (monster?.kind === 'boss') return 'boss'
  return monster?.affix ? 'elite' : 'normal'
}

/** Damage factors by type: the kind's, unless a resistance affix replaces them. */
function resistancesFor(kind, affix) {
  const source = affix === 'armored' || affix === 'ethereal' ? MONSTER_KINDS[affix] : MONSTER_KINDS[kind]
  return { physical: source.physical, magical: source.magical }
}

/**
 * What a monster looks like and is called. A themed hand-made entry shows as itself
 * HANDMADE_SHARE of the time; otherwise a boss wave brings the project's next boss of the roster
 * and any other wave a generated monster. Without races (older content) every entry shows as
 * itself. The entry's loot is kept either way.
 */
function appearanceFor({ where, entry, kind, rank, themeId, races, bosses }) {
  const handmade = { id: entry.id, name: entry.name, sprite: { ...entry.sprite } }
  if (!races) return handmade
  if (entry.themes && chanceOf(rollText(where, 'handmade')) < HANDMADE_SHARE) return handmade
  if (kind === 'boss') {
    if (!bosses) return handmade
    const bossNumber = Math.floor(where.wave / BOSS_EVERY)
    const boss = bossFor(bosses, races, { worldId: where.worldId, projectId: where.projectId, bossNumber })
    return { id: boss.id, name: boss.name, race: boss.race, look: boss.look }
  }
  const generated = generateMonster(races, { seed: rollText(where, 'look'), themeId, rank })
  return { id: generated.race, name: generated.name, race: generated.race, look: generated.look }
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
 * @param {{ palettes: object, races: object[] }} [options.races] a valid races file; without it
 *   every monster is a hand-made entry
 * @param {{ bosses: object[] }} [options.bosses] a valid bosses file
 * @param {(level: number) => { physical: number, magical: number, total: number }} options.referencePartyHit
 * @returns {{ id: string, name: string, kind: string, rank: string, affix: string | null,
 *   level: number, maxHp: number, hp: number, physical: number, magical: number, attack: number,
 *   reward: number, dropFactor: number, loot: Record<string, number>, race?: string,
 *   look?: { rig: string, parts: object, colours: object }, sprite?: { body: string, accent: string } }}
 *   a hand-made entry has `sprite`, a generated monster or a boss of the roster `race` and `look`
 */
export function monsterFor(options) {
  const { worldId, projectId, wave, kill = 0, themeId, content, races, bosses, referencePartyHit } = options
  const partySize = Math.min(options.partySize ?? REFERENCE_PARTY_SIZE, REFERENCE_PARTY_SIZE)
  const partyShare = partySize / REFERENCE_PARTY_SIZE
  const where = { worldId, projectId, wave, kill }
  const kind = kindForWave(where)
  const rank = rankFor(where)
  const affix = affixFor(where)
  const ranked = MONSTER_RANKS[rank]
  const entries = monstersFor(content, { kind, themeId })
  const entry = entries[hashOf(rollText(where, 'entry')) % entries.length]
  const factors = MONSTER_KINDS[kind]
  const maxHp = HITS_TO_KILL * referencePartyHit(wave).total * partyShare * factors.hp * ranked.hp
  return {
    ...appearanceFor({ where, entry, kind, rank, themeId, races, bosses }),
    kind,
    rank,
    affix,
    level: wave,
    maxHp,
    hp: maxHp,
    ...resistancesFor(kind, affix),
    attack: factors.attack,
    reward: factors.reward * ranked.reward,
    dropFactor: ranked.drop,
    loot: { ...entry.loot }
  }
}
