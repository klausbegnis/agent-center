// The monsters of an instance's rooms: generated from its races in the entrance and the hall, its
// elite (a mini-boss of the roster) as a champion, and its named boss, tougher than on waves. Their
// numbers come from the same formulas as a wave's (monsters.mjs), at the run's level, so health,
// drain and rewards follow the world and the tier. Every roll is a hash of the run. Pure.
import { HITS_TO_KILL, MONSTER_KINDS, MONSTER_RANKS, REFERENCE_PARTY_SIZE } from './constants.mjs'
import { hashOf } from './hash.mjs'
import {
  INSTANCE_BOSS_HP,
  INSTANCE_ELITE_RANK,
  INSTANCE_FIRST_LEVELS,
  INSTANCE_HALL_FIGHTS,
  INSTANCE_TIER_LEVELS,
  INSTANCE_VETERAN_ONE_IN
} from './instance-constants.mjs'
import { AFFIXES } from './monsters.mjs'
import { generateMonster, rigIdOf } from './races.mjs'

/** The kinds a plain room's monster may be, by hash: the resistances a party meets on waves. */
const ROOM_KINDS = ['common', 'common', 'armored', 'ethereal']

/**
 * The level of a run's monsters: a little above the world's, two more for each tier above the first.
 *
 * @param {number} worldLevel
 * @param {number} tier from 1
 */
export const runLevel = (worldLevel, tier) => worldLevel + INSTANCE_FIRST_LEVELS + INSTANCE_TIER_LEVELS * (tier - 1)

/**
 * How many fights a room holds: the hall three (or its modifier's count), the other fighting rooms one.
 *
 * @param {string} kind the room's kind
 * @param {{ hallFights: number | null }} bonuses the run's (instance-boons.mjs)
 */
export function fightsIn(kind, bonuses) {
  if (kind === 'hall') return bonuses.hallFights ?? INSTANCE_HALL_FIGHTS
  return ['entrance', 'elite', 'boss'].includes(kind) ? 1 : 0
}

/** A room's monster's kind and rank, before its looks. */
function shapeOf(kind, seed) {
  if (kind === 'boss') return { kind: 'boss', rank: 'boss' }
  if (kind === 'elite') return { kind: ROOM_KINDS[hashOf(`${seed}|kind`) % ROOM_KINDS.length], rank: INSTANCE_ELITE_RANK }
  const isVeteran = kind === 'hall' && hashOf(`${seed}|veteran`) % INSTANCE_VETERAN_ONE_IN === 0
  return { kind: ROOM_KINDS[hashOf(`${seed}|kind`) % ROOM_KINDS.length], rank: isVeteran ? 'veteran' : 'normal' }
}

/**
 * The share of a reference kill's health a room's monster has: what a reference party needs of
 * HITS_TO_KILL to beat it, the measure of the room's time.
 */
export function healthShare(roomKind, monsterKind, rank) {
  return MONSTER_KINDS[monsterKind].hp * MONSTER_RANKS[rank].hp * (roomKind === 'boss' ? INSTANCE_BOSS_HP : 1)
}

/** The reference health share of every fight of a room, for its time limit. */
export function roomHealthShare(roomKind, bonuses, seedOf) {
  let share = 0
  for (let fight = 0; fight < fightsIn(roomKind, bonuses); fight++) {
    const { kind, rank } = shapeOf(roomKind, seedOf(fight))
    share += healthShare(roomKind, kind, rank)
  }
  return share
}

/** The affix a room's monster carries: the modifier's for its room, else a champion's own. */
function affixOf(roomKind, rank, seed, bonuses) {
  if (roomKind === 'boss' && bonuses.noBossAffix) return null
  if (bonuses.affixes[roomKind]) return bonuses.affixes[roomKind]
  return rank === INSTANCE_ELITE_RANK ? AFFIXES[hashOf(`${seed}|affix`) % AFFIXES.length] : null
}

/** A named boss of the roster as itself: its fixed look and full name. */
function rosterLook(bosses, races, bossId) {
  const boss = bosses?.bosses.find((each) => each.id === bossId)
  const race = boss ? races?.races.find((each) => each.id === boss.race) : null
  if (!boss || !race) return null
  const parts = { ...boss.parts, extras: [...(boss.parts.extras ?? [])] }
  return { id: boss.id, name: `${boss.name}, ${boss.epithet}`, race: boss.race, look: { rig: rigIdOf(race), parts, colours: { ...boss.colours } } }
}

const narrowed = new WeakMap()
/** The races file narrowed to the instance's races, once per instance entry. */
function racesOf(instance, races) {
  if (!narrowed.has(instance)) narrowed.set(instance, { ...races, races: races.races.filter((race) => instance.races.includes(race.id)) })
  return narrowed.get(instance)
}

/** What a room's monster looks like and is called: the roster's boss or elite, else one of the races. */
function appearanceOf({ roomKind, rank, instance, content, seed }) {
  const bossId = roomKind === 'boss' ? instance.boss : roomKind === 'elite' ? instance.elite : null
  const named = bossId ? rosterLook(content.bosses, content.races, bossId) : null
  if (named) return named
  if (!content.races) return { id: instance.races[0], name: instance.name, sprite: { body: 'blob', accent: 'none' } }
  const generated = generateMonster(racesOf(instance, content.races), { seed: `${seed}|look`, rank })
  return { id: generated.race, name: generated.name, race: generated.race, look: generated.look }
}

/**
 * A monster of a run's room, at full health.
 *
 * @param {object} options
 * @param {object} options.instance the content entry
 * @param {string} options.roomKind entrance, hall, elite or boss
 * @param {string} options.seed the run, room and fight
 * @param {number} options.level the run's level (runLevel)
 * @param {number} options.partySize the working characters it meets
 * @param {import('./instance-boons.mjs').RunBonuses} options.bonuses
 * @param {{ races?: object, bosses?: object }} options.content
 * @param {(level: number) => { total: number }} options.referencePartyHit
 * @returns {object} a monster the fight plays like a wave's
 */
export function instanceMonster({ instance, roomKind, seed, level, partySize, bonuses, content, referencePartyHit }) {
  const { kind, rank } = shapeOf(roomKind, seed)
  const partyShare = Math.min(Math.max(1, partySize), REFERENCE_PARTY_SIZE) / REFERENCE_PARTY_SIZE
  const maxHp = HITS_TO_KILL * referencePartyHit(level).total * partyShare * healthShare(roomKind, kind, rank)
  const affix = affixOf(roomKind, rank, seed, bonuses)
  const resist = affix === 'armored' || affix === 'ethereal' ? MONSTER_KINDS[affix] : MONSTER_KINDS[kind]
  return {
    ...appearanceOf({ roomKind, rank, instance, content, seed }),
    kind,
    rank,
    affix,
    level,
    maxHp,
    hp: maxHp,
    physical: resist.physical,
    magical: resist.magical,
    attack: MONSTER_KINDS[kind].attack,
    reward: MONSTER_KINDS[kind].reward * MONSTER_RANKS[rank].reward,
    dropFactor: MONSTER_RANKS[rank].drop,
    loot: { ...instance.loot }
  }
}
