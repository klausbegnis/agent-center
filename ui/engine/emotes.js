// Emotes: the short moves a character plays now and then, such as a hop, a stretch or a spell.
// This module decides which emote plays on whom and when. Pure: no DOM, no timers and no
// randomness; every choice is derived from the character's id and the time it is given.
import { hash } from './hash.js'

/** The moves the engine can give a character. ui/stage.css has an `ac-emote-<name>` for each. */
export const EMOTE_MOTIONS = ['hop', 'spin', 'flip', 'shake', 'sway', 'tilt', 'float', 'stretch', 'wiggle']

/** How an emote's effect symbol can move. ui/stage.css has an `ac-effect-<name>` for each. */
export const EFFECT_MOTIONS = ['rise', 'pulse', 'toss']
export const DEFAULT_EFFECT_MOTION = 'rise'

/**
 * When an emote plays: `sometimes` while the character is at that activity, or `start`, once,
 * right after the character takes the activity up.
 */
export const EMOTE_MOMENTS = ['sometimes', 'start']
const DEFAULT_MOMENT = 'sometimes'

/** An emote is a glance, not a show: shorter is not seen, longer gets in the way. */
export const MIN_EMOTE_SECONDS = 0.5
export const MAX_EMOTE_SECONDS = 4
export const DEFAULT_EMOTE_SECONDS = 1.6

/**
 * How often a character emotes. Emote number n of a character falls somewhere in the `jitterMs`
 * after n periods, so two in a row are between period - jitter and period + jitter apart: 20 to
 * 60 seconds normally. `fast` is for looking at emotes while drawing them: a few seconds apart,
 * and the emotes that normally play only at the start of an activity take turns with the rest.
 */
const PACES = {
  normal: { periodMs: 40_000, jitterMs: 20_000, rotateStartEmotes: false },
  fast: { periodMs: 4_000, jitterMs: 2_000, rotateStartEmotes: true }
}
export const DEFAULT_PACE = 'normal'
/** The pace name that turns emotes off. */
export const NO_EMOTES = 'off'

/** Familiars emote this many times more rarely than agents, so the agents stay the main act. */
const FAMILIAR_RARITY = 3

/** A character takes this long to walk to a new place (0.9 s in ui/stage.css) and settle. */
const WALK_MS = 1_200

/**
 * After a pause (a hidden page, a sleeping laptop) only this much of the missed time is looked
 * at, so the characters do not all catch up with an emote at the same moment.
 */
const MAX_CATCH_UP_MS = 1_000

/** What a theme without `actors.emotes` gets: motions only, so they suit any art. */
export const DEFAULT_EMOTES = [
  { id: 'cheer', on: ['sleep'], when: 'start', motion: 'hop', seconds: 1.4 },
  { id: 'stretch', on: ['write', 'read', 'run'], motion: 'stretch', seconds: 1.8 },
  { id: 'ponder', on: ['think', 'delegate'], motion: 'tilt', seconds: 1.6 },
  { id: 'fidget', on: ['wait'], motion: 'sway', seconds: 1.6 },
  { id: 'fume', on: ['blocked'], motion: 'shake', seconds: 0.9 },
  { id: 'look-around', on: ['idle'], motion: 'tilt', seconds: 1.6 }
]

/**
 * The pace with that name, or null when emotes are off or the name is unknown.
 *
 * @param {string} [name] `normal`, `fast` or `off`
 * @returns {{ periodMs: number, jitterMs: number, rotateStartEmotes: boolean } | null}
 */
export function paceFor(name = DEFAULT_PACE) {
  return Object.hasOwn(PACES, name) ? PACES[name] : null
}

/** The emotes of a theme's characters: its own list, or the default set when it has none. */
export function emotesFor(theme) {
  return theme.actors.emotes ?? DEFAULT_EMOTES
}

/**
 * The emotes of a theme's familiars: one per motion the theme lists, at any activity. A theme
 * that lists none, or draws no familiar, has familiars that do not emote.
 */
export function familiarEmotesFor(theme) {
  const motions = theme.actors.familiar?.emotes ?? []
  return motions.map((motion) => ({ id: motion, motion, seconds: DEFAULT_EMOTE_SECONDS }))
}

export function emoteSeconds(emote) {
  return emote.seconds ?? DEFAULT_EMOTE_SECONDS
}

/**
 * The activity of an agent that finished and was not looked at yet. It plays what the theme
 * gives for finishing (the emotes of `sleep`, and any of its own), again and again until the
 * person has seen it.
 */
const UNSEEN = 'done'
const FINISHED = 'sleep'

const playsAt = (emote, activity) =>
  !emote.on || emote.on.includes(activity) || (activity === UNSEEN && emote.on.includes(FINISHED))
const momentOf = (emote) => emote.when ?? DEFAULT_MOMENT

/**
 * When emote number `round` of a character is due, in the same clock as `now`. Each character
 * has its own offset inside the period, which is what keeps a room from moving in unison.
 */
export function emoteTime(id, round, pace) {
  const offset = hash(id) % pace.periodMs
  const jitter = hash(`${id}|${round}`) % pace.jitterMs
  return round * pace.periodMs + offset + jitter
}

/**
 * The number of the emote that became due after `from` and no later than `to`, or null. When
 * more than one did, the latest.
 */
export function emoteRound(id, from, to, pace) {
  const offset = hash(id) % pace.periodMs
  // The jitter is shorter than a period, so only this round and the one before can be due.
  const latest = Math.floor((to - offset) / pace.periodMs)
  for (const round of [latest, latest - 1]) {
    const time = emoteTime(id, round, pace)
    if (time > from && time <= to) return round
  }
  return null
}

/**
 * Picks the emote a character plays, among those that fit its activity and the moment.
 *
 * @param {object[]} emotes
 * @param {{ id: string, activity: string }} character
 * @param {string[]} moments the moments to pick from: `sometimes`, `start` or both
 * @param {number} round which emote of this character it is; another round, another pick
 * @returns {object | null}
 */
export function chooseEmote(emotes, character, moments, round) {
  const fitting = emotes.filter(
    (emote) =>
      playsAt(emote, character.activity) &&
      // An unseen finish keeps celebrating: its one-off emotes take turns with the rest.
      (character.activity === UNSEEN || moments.includes(momentOf(emote)))
  )
  if (fitting.length === 0) return null
  return fitting[hash(`${character.id}|${round}|emote`) % fitting.length]
}

/**
 * Keeps track of the characters of one room and says when each one starts and ends an emote.
 * It never plays two emotes on one character at once and none on a character that is walking.
 *
 * @param {object} theme
 * @param {{ periodMs: number, jitterMs: number, rotateStartEmotes: boolean }} pace
 */
export function createEmoteSchedule(theme, pace) {
  const agentEmotes = emotesFor(theme)
  const familiarEmotes = familiarEmotesFor(theme)
  const familiarPace = {
    ...pace,
    periodMs: pace.periodMs * FAMILIAR_RARITY,
    jitterMs: pace.jitterMs * FAMILIAR_RARITY
  }
  const occasionalMoments = pace.rotateStartEmotes ? EMOTE_MOMENTS : [DEFAULT_MOMENT]

  /** @type {Map<string, object>} what is known of each character, by id */
  const known = new Map()
  let lastTick = null

  /**
   * Tells the schedule who is in the room now. Call it whenever the room is drawn.
   *
   * @param {{ id: string, activity: string, place: string, isFamiliar: boolean }[]} characters
   *   `place` is any text that changes when the character is sent somewhere else
   * @param {number} now
   * @returns {string[]} the ids whose emote has to stop: they left, or set off walking
   */
  function observe(characters, now) {
    const interrupted = []
    const present = new Set()
    for (const character of characters) {
      present.add(character.id)
      const entry = known.get(character.id)
      if (!entry) {
        // Someone new walks in from the entrance, and is not greeted with a start emote.
        known.set(character.id, { ...character, movedAt: now, startPending: false, playingUntil: null })
        continue
      }
      if (entry.place !== character.place) {
        entry.movedAt = now
        if (entry.playingUntil !== null) interrupted.push(character.id)
        entry.playingUntil = null
      }
      // Going to sleep after being seen is not a second finish.
      const wasSeen = entry.activity === UNSEEN && character.activity === FINISHED
      if (entry.activity !== character.activity && !wasSeen) entry.startPending = true
      Object.assign(entry, character)
    }
    for (const [id, entry] of known) {
      if (present.has(id)) continue
      if (entry.playingUntil !== null) interrupted.push(id)
      known.delete(id)
    }
    return interrupted
  }

  function nextEmote(entry, from, now) {
    const emotes = entry.isFamiliar ? familiarEmotes : agentEmotes
    if (emotes.length === 0) return null
    const round = emoteRound(entry.id, from, now, entry.isFamiliar ? familiarPace : pace)
    if (entry.startPending) {
      entry.startPending = false
      // `now` stands in for the round, so finishing twice does not always bring the same emote.
      const emote = chooseEmote(emotes, entry, ['start'], Math.floor(now / pace.periodMs))
      if (emote) return emote
    }
    return round === null ? null : chooseEmote(emotes, entry, occasionalMoments, round)
  }

  /**
   * Moves the schedule on to `now`. Call it a few times a second while the room is visible.
   *
   * @returns {{ started: { id: string, emote: object }[], ended: string[] }} the emotes to
   *   start playing and the ids whose emote is over
   */
  function tick(now) {
    const from = Math.max(lastTick ?? now, now - MAX_CATCH_UP_MS)
    lastTick = now
    const started = []
    const ended = []
    for (const entry of known.values()) {
      if (entry.playingUntil !== null) {
        if (now < entry.playingUntil) continue
        entry.playingUntil = null
        ended.push(entry.id)
      }
      if (now - entry.movedAt < WALK_MS) continue
      const emote = nextEmote(entry, from, now)
      if (!emote) continue
      entry.playingUntil = now + emoteSeconds(emote) * 1000
      started.push({ id: entry.id, emote })
    }
    return { started, ended }
  }

  /** Ends every emote at once, for when the page is hidden. Returns the ids that were playing. */
  function stopAll() {
    const stopped = []
    for (const entry of known.values()) {
      if (entry.playingUntil === null) continue
      entry.playingUntil = null
      stopped.push(entry.id)
    }
    return stopped
  }

  return { observe, tick, stopAll }
}
