// The rhythm of a fight on screen. The worker sends one state per round, never single hits, so
// this module makes up believable blows from what the state has: the length of a tick, the
// working characters and their classes, and how fast the monster's health falls. Each tick of
// the fight every attacker acts once and the monster strikes once, spread over the tick so no
// two blows land together. Pure: no DOM, no timers, no randomness; every choice comes from the
// ids and the clock it is given.
import { hash } from './hash.js'

/** What each class does on its turn. A Guardian has no turn: it raises its guard when struck at. */
export const CLASS_MOVES = { physical: 'strike', magical: 'cast', support: 'heal' }

/** How long each move lasts on screen. ui/game.css plays an animation of the same length. */
export const MOVE_MS = {
  strike: 900,
  cast: 900,
  heal: 1300,
  guard: 1000,
  hurt: 500,
  thorns: 600,
  pounce: 900,
  flinch: 450,
  regen: 1000
}

/** After a strike starts, its blow lands this much later: the top of the lunge. */
const STRIKE_LANDS_MS = 350
/** A bolt leaves the caster this long after the cast starts and takes as long to arrive. */
export const BOLT_LEAVES_MS = 250
export const BOLT_FLIES_MS = 400
/** The monster's blow lands this long after its pounce starts. */
const POUNCE_LANDS_MS = 400
/** A regenerating monster mends this long after its own blow. */
const REGEN_AFTER_MS = 650
/** A thorny monster's thorns answer a strike this long after it lands. */
const THORNS_AFTER_MS = 100

/** One tick of the fight is shown no faster or slower than this, whatever the worker says. */
const MIN_PERIOD_MS = 3_000
const MAX_PERIOD_MS = 15_000
/** What a tick lasts when the worker does not say. */
const DEFAULT_TICK_SECONDS = 10
/** Turns start up to this share of their spacing late, so the rhythm does not look ruled. */
const JITTER_SHARE = 0.25
/** A character takes this long to walk to a new place (0.9 s in ui/stage.css) and settle. */
const WALK_MS = 1_200
/** After a pause only this much missed time is looked at, so blows do not pile up. */
const MAX_CATCH_UP_MS = 1_000
/** Until the monster's health has been seen to fall, a blow is taken to do this share of it. */
const FIRST_GUESS_SHARE = 1 / 60

/**
 * @typedef {object} Beat one thing to show at one moment
 * @property {number} at when it starts, in the clock given
 * @property {'member' | 'monster'} who
 * @property {string} [id] the character's id, for a member
 * @property {string} motion one of the keys of MOVE_MS
 * @property {number} ms how long it lasts
 * @property {number} [damage] for a blow that lands on the monster: the number to show
 * @property {string} [targetId] for a pounce: the character it strikes at; for a cast, the caster
 * @property {string[]} [otherIds] for a heal: the characters the glow rises over
 */

/**
 * How long one tick of the fight lasts on screen: the tick's length, quicker as the world's
 * attack speed grows, within MIN_PERIOD_MS and MAX_PERIOD_MS.
 *
 * @param {number | null | undefined} tickSeconds
 * @param {number | null | undefined} attackSpeed
 */
export function fightPeriodMs(tickSeconds, attackSpeed) {
  const seconds = Number(tickSeconds) > 0 ? Number(tickSeconds) : DEFAULT_TICK_SECONDS
  const speed = Number(attackSpeed) > 0 ? Number(attackSpeed) : 1
  return Math.min(MAX_PERIOD_MS, Math.max(MIN_PERIOD_MS, (seconds * 1000) / speed))
}

/** The move a class makes on its turn: an unknown class strikes. Guardians have no turn. */
export function moveOf(classId) {
  if (classId === 'defense') return null
  return CLASS_MOVES[classId] ?? CLASS_MOVES.physical
}

/**
 * Who acts in one tick, in order: the monster first, a second time half way for a swift one, and
 * every character with a turn, in an order that turns round from one tick to the next.
 *
 * @param {{ id: string, classId: string }[]} members the working characters
 * @param {number} cycle which tick it is
 * @param {boolean} isSwift
 * @returns {({ kind: 'monster' } | { kind: 'member', id: string, move: string })[]}
 */
export function turnOrder(members, cycle, isSwift) {
  const acting = members
    .filter((member) => moveOf(member.classId))
    .sort((first, second) => hash(first.id) - hash(second.id) || first.id.localeCompare(second.id))
    .map((member) => ({ kind: 'member', id: member.id, move: moveOf(member.classId) }))
  const shift = acting.length ? cycle % acting.length : 0
  const rotated = [...acting.slice(shift), ...acting.slice(0, shift)]
  if (!isSwift) return [{ kind: 'monster' }, ...rotated]
  const half = Math.ceil(rotated.length / 2)
  return [{ kind: 'monster' }, ...rotated.slice(0, half), { kind: 'monster' }, ...rotated.slice(half)]
}

/** The character a monster strikes at: a Guardian when there is one, otherwise one by hash. */
function targetOf(members, key) {
  const guardians = members.filter((member) => member.classId === 'defense')
  const pool = guardians.length ? guardians : members
  if (!pool.length) return null
  return pool[hash(key) % pool.length].id
}

/**
 * Keeps track of one room's fight and says which blows to show when.
 *
 * @param {string} roomId the room's id, which sets where in a tick its turns fall
 */
export function createFightSchedule(roomId) {
  /** @type {null | { members: object[], periodMs: number, monsterKey: string, affix: string | null }} */
  let fight = null
  let lastTick = null
  /** When each character last moved, by id. */
  const movedAt = new Map()
  const places = new Map()
  /** The move each character is busy with, by id: when it started and until when it lasts. */
  const busy = new Map()
  /** What a blow does, measured from the health the monster lost between states. */
  let health = null

  /**
   * Tells the schedule how the fight stands. Call it whenever the room is drawn.
   *
   * @param {null | { members: { id: string, classId: string, place: string }[], periodMs: number,
   *   monsterKey: string, affix: string | null, hp: number, maxHp: number }} next null while
   *   nothing fights: the party waits, rests or is idle, or the monster is not standing there
   * @param {number} now
   */
  function observe(next, now) {
    for (const member of next?.members ?? []) {
      if (places.has(member.id) && places.get(member.id) !== member.place) movedAt.set(member.id, now)
      if (!places.has(member.id)) movedAt.set(member.id, now)
      places.set(member.id, member.place)
    }
    fight = next && next.members.length ? next : null
    if (!fight) return
    measureBlows(fight)
  }

  /** Learns what a blow does from the health lost since the blows shown last. */
  function measureBlows({ monsterKey, hp, maxHp }) {
    const hasNumbers = Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0
    if (!hasNumbers) {
      health = null
      return
    }
    if (!health || health.monsterKey !== monsterKey) {
      health = { monsterKey, hp, perBlow: maxHp * FIRST_GUESS_SHARE, blowsSince: 0 }
      return
    }
    if (hp < health.hp && health.blowsSince > 0) health.perBlow = (health.hp - hp) / health.blowsSince
    if (hp !== health.hp) {
      health.hp = hp
      health.blowsSince = 0
    }
  }

  /** The number a landing blow shows, or undefined while the monster's health is not known. */
  function blowDamage() {
    if (!health) return undefined
    health.blowsSince += 1
    return Math.max(1, Math.round(health.perBlow))
  }

  /** Whether a character can start a move at `at`: it is not walking, nor busy with another move. */
  function isFree(id, at) {
    const move = busy.get(id)
    const isMoving = move && at !== move.from && at < move.until
    return at - (movedAt.get(id) ?? -Infinity) >= WALK_MS && !isMoving
  }

  /** The beats of the monster's turn: its pounce, the guard or the hurt, and its mending. */
  function monsterBeats(at, turnKey) {
    const { members, affix } = fight
    const targetId = targetOf(members, turnKey)
    const beats = [{ at, who: 'monster', motion: 'pounce', ms: MOVE_MS.pounce, targetId }]
    const guardians = members.filter((member) => member.classId === 'defense' && isFree(member.id, at))
    for (const guardian of guardians) {
      beats.push({ at, who: 'member', id: guardian.id, motion: 'guard', ms: MOVE_MS.guard })
    }
    if (targetId && !guardians.length && isFree(targetId, at + POUNCE_LANDS_MS)) {
      beats.push({ at: at + POUNCE_LANDS_MS, who: 'member', id: targetId, motion: 'hurt', ms: MOVE_MS.hurt })
    }
    if (affix === 'regenerating') {
      const mends = at + POUNCE_LANDS_MS + REGEN_AFTER_MS
      beats.push({ at: mends, who: 'monster', motion: 'regen', ms: MOVE_MS.regen })
    }
    return beats
  }

  /** The beats of a character's turn: its move and, for a blow, where and when it lands. */
  function memberBeats(at, turn) {
    if (!isFree(turn.id, at)) return []
    const { members, affix } = fight
    const beats = [{ at, who: 'member', id: turn.id, motion: turn.move, ms: MOVE_MS[turn.move] }]
    if (turn.move === 'heal') {
      beats[0].otherIds = members.filter((member) => member.id !== turn.id).map((member) => member.id)
      return beats
    }
    const lands = at + (turn.move === 'cast' ? BOLT_LEAVES_MS + BOLT_FLIES_MS : STRIKE_LANDS_MS)
    beats.push({ at: lands, who: 'monster', motion: 'flinch', ms: MOVE_MS.flinch, targetId: turn.id })
    if (affix === 'thorny' && turn.move === 'strike') {
      const answers = lands + THORNS_AFTER_MS
      beats.push({ at: answers, who: 'member', id: turn.id, motion: 'thorns', ms: MOVE_MS.thorns })
    }
    return beats
  }

  /** Every beat of one tick, in time order. */
  function cycleBeats(cycle) {
    const { members, periodMs, monsterKey, affix } = fight
    const offset = hash(roomId) % periodMs
    const turns = turnOrder(members, cycle, affix === 'swift')
    const spacing = periodMs / turns.length
    const beats = []
    turns.forEach((turn, index) => {
      const turnKey = `${roomId}|${monsterKey}|${cycle}|${index}`
      const jitter = ((hash(turnKey) % 1000) / 1000) * spacing * JITTER_SHARE
      const at = cycle * periodMs + offset + index * spacing + jitter
      beats.push(...(turn.kind === 'monster' ? monsterBeats(at, turnKey) : memberBeats(at, turn)))
    })
    return beats
  }

  /**
   * Moves the schedule on to `now`. Call it a few times a second while the room is visible.
   *
   * @returns {Beat[]} the beats that start now, in time order
   */
  function tick(now) {
    const from = Math.max(lastTick ?? now, now - MAX_CATCH_UP_MS)
    lastTick = now
    if (!fight) return []
    const { periodMs } = fight
    const offset = hash(roomId) % periodMs
    const first = Math.floor((from - offset) / periodMs) - 1
    const last = Math.floor((now - offset) / periodMs)
    const due = []
    for (let cycle = first; cycle <= last; cycle += 1) {
      for (const beat of cycleBeats(cycle)) {
        if (beat.at <= from || beat.at > now) continue
        if (beat.who === 'member') busy.set(beat.id, { from: beat.at, until: beat.at + beat.ms })
        if (beat.motion === 'flinch') beat.damage = blowDamage()
        due.push(beat)
      }
    }
    return due.sort((first, second) => first.at - second.at)
  }

  /** Forgets the moves in progress, for when the page is hidden or motion is unwanted. */
  function stopAll() {
    busy.clear()
    lastTick = null
  }

  /** Whether a character is in the middle of a move at `now`, so it plays no emote. */
  function isBusy(id, now) {
    return now < (busy.get(id)?.until ?? -Infinity)
  }

  return { observe, tick, stopAll, isBusy }
}
