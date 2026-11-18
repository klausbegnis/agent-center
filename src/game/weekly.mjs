// The weekly event in play: each world keeps the week it last saw (`weekly`), which event that week
// has and how far the week's goal has come. At every advance the week is checked against the time
// the caller passes, so a new week switches the event with no reload; the event's effects join the
// world's other effects under the same caps, a race week brings its race twice as often and counts
// its kills half again in the bestiary, and the goal pays its reward once a week. Pure.
import { noteKill } from './bestiary.mjs'
import { rewardFor } from './combat.mjs'
import { chanceOf } from './hash.mjs'
import { worldLevel } from './progression.mjs'
import { eventIdOfWeek, weekOf } from './weekly-calendar.mjs'
import { eventIndexOf } from './weekly-content.mjs'
import { addMaterials } from './worlds.mjs'

/** @typedef {import('./legendary-effects.mjs').Effect} Effect */
/**
 * @typedef {{ week: string, event: string, progress: number, done: boolean, seenAt: number, goals?: number }} Weekly
 *   what a world keeps of the week: its ISO key, its event's id, the goal's progress, whether its
 *   reward was paid, the last time an advance looked (so the time left is told on the game's own
 *   clock, the demo's included), and how many weeks' goals the world ever reached (for achievements)
 */

/**
 * A race week counts a kill of its race once more in the bestiary this share of the time (by hash
 * of the kill): half again the points. Every kill counted twice took a medium user's bestiary past
 * its "at most about 10% kills per hour at a year" target (12.6%); this keeps it at about 10%.
 */
export const FEATURED_BESTIARY_EXTRA = 0.5

const NONE = Object.freeze([])

/**
 * The event a world plays now, from what it keeps, or null: no event seen yet, or one the content
 * no longer has.
 *
 * @param {{ weekly?: Weekly } | null | undefined} world
 * @param {object} [content]
 * @returns {object | null} the event's entry of game/events.json
 */
export function eventOfWorld(world, content) {
  const id = world?.weekly?.event
  return (id && eventIndexOf(content)?.byId.get(id)) ?? null
}

/** The effects of each world's event, by the weekly object it keeps (a new one every advance). */
const worked = new WeakMap()

/**
 * The effects the world's event gives every party of the world: effects of the closed set, scope
 * `world`, summed with the bestiary's and the settlement's under LEGENDARY_EFFECT_CAPS.
 *
 * @param {{ weekly?: Weekly } | null | undefined} world
 * @param {object} [content]
 * @returns {Effect[]}
 */
export function weeklyEffectsOf(world, content) {
  const weekly = world?.weekly
  if (!weekly || typeof weekly !== 'object') return NONE
  const known = worked.get(weekly)
  if (known && known.content === content) return known.effects
  const effects = eventOfWorld(world, content)?.effects ?? NONE
  worked.set(weekly, { content, effects })
  return effects
}

/**
 * The race a race week brings more often, or null.
 *
 * @param {{ weekly?: Weekly } | null | undefined} world
 * @param {object} [content]
 * @returns {string | null}
 */
export function featuredRaceOf(world, content) {
  const event = eventOfWorld(world, content)
  return event?.kind === 'race' ? event.race : null
}

/**
 * Counts a kill in the world's bestiary (bestiary.mjs's noteKill), and a kill of a race week's race
 * once more FEATURED_BESTIARY_EXTRA of the time.
 *
 * @param {object | null} bestiary
 * @param {object} monster
 * @param {{ day: number, index: object | null, featuredRace: string | null, seed?: string }} options
 *   `seed` is the kill's, so the same kill always counts the same
 * @returns {{ bestiary: object | null, news: object[] }}
 */
export function noteWeeklyKill(bestiary, monster, { day, index, featuredRace, seed = '' }) {
  const isFeatured = Boolean(featuredRace) && monster.race === featuredRace
  const times = isFeatured && chanceOf(`${seed}|weekly-bestiary`) < FEATURED_BESTIARY_EXTRA ? 2 : 1
  let noted = { bestiary, news: [] }
  for (let count = 0; count < times; count++) {
    const next = noteKill(noted.bestiary, monster, { day, index })
    noted = { bestiary: next.bestiary, news: [...noted.news, ...next.news] }
  }
  return noted
}

/**
 * Every world with the week of `at` and its event: a world on another week, or with another event
 * for it (the catalogue changed), starts the week's goal over. Unchanged without weekly events.
 *
 * @param {object} save
 * @param {number} at milliseconds, the end of the advance
 * @param {object} [content]
 * @returns {object}
 */
export function withWeek(save, at, content) {
  const index = eventIndexOf(content)
  if (!index || !Number.isFinite(at)) return save
  const week = weekOf(at)
  const eventId = eventIdOfWeek(index.ids, week.index, index.pinned)
  let worlds = null
  for (const [worldId, world] of Object.entries(save.worlds)) {
    const kept = world.weekly
    const isSame = kept?.week === week.key && kept.event === eventId
    const goals = kept?.goals ? { goals: kept.goals } : {}
    const weekly = isSame
      ? { ...kept, seenAt: Math.max(kept.seenAt ?? at, at) }
      : { week: week.key, event: eventId, progress: 0, done: false, seenAt: at, ...goals }
    worlds ??= { ...save.worlds }
    worlds[worldId] = { ...world, weekly }
  }
  return worlds ? { ...save, worlds } : save
}

/** Whether a kill event counts for a goal. */
const COUNTS = {
  race: (kill, event) => kill.race === event.race,
  kills: () => true,
  bosses: (kill) => kill.rank === 'boss' || kill.rank === 'legendary',
  elites: (kill) => kill.rank === 'elite' || kill.rank === 'champion'
}

/**
 * The reward of a week's goal: materials worth `rewardKills` plain kills at the world's level, split
 * over the event's reward materials.
 *
 * @param {object} world
 * @param {object} event
 * @param {number} rewardKills
 * @returns {Record<string, number>}
 */
export function weeklyReward(world, event, rewardKills) {
  const loot = Object.fromEntries(event.reward.map((material) => [material, 1]))
  const monster = { level: worldLevel(world.skills), reward: rewardKills, loot, dropFactor: 0 }
  return rewardFor(monster, { luck: 0, seed: `${world.weekly?.week}|${event.id}|reward` }).materials
}

/**
 * The goal's progress from an advance's kill events, and its reward the moment it is reached, once
 * a week per world.
 *
 * @param {object} save after the advance
 * @param {object[]} events the advance's events: kills carry `projectId`, `rank` and `race`
 * @param {object} [content]
 * @returns {object}
 */
export function noteWeeklyProgress(save, events, content) {
  const index = eventIndexOf(content)
  if (!index) return save
  const kills = events.filter((event) => event.type === 'kill')
  if (kills.length === 0) return save
  let worlds = null
  for (const [worldId, world] of Object.entries(save.worlds)) {
    const event = eventOfWorld(world, content)
    if (!event || world.weekly.done) continue
    const counts = COUNTS[event.goal.kind]
    const found = kills.filter((kill) => Object.hasOwn(world.projects, kill.projectId) && counts(kill, event)).length
    if (found === 0) continue
    const progress = Math.min(event.goal.count, world.weekly.progress + found)
    const done = progress >= event.goal.count
    const materials = done ? addMaterials(world.materials, weeklyReward(world, event, index.rewardKills)) : world.materials
    worlds ??= { ...save.worlds }
    const goals = (world.weekly.goals ?? 0) + (done ? 1 : 0)
    worlds[worldId] = { ...world, materials, weekly: { ...world.weekly, progress, done, ...(goals ? { goals } : {}) } }
  }
  return worlds ? { ...save, worlds } : save
}

/**
 * An advance with the week checked first and the goal counted after.
 *
 * @param {object} save
 * @param {{ to: number }} interval
 * @param {object} content
 * @param {(save: object) => { save: object, events: object[] }} advance the engine's own advance
 * @returns {{ save: object, events: object[] }}
 */
export function advanceWeek(save, interval, content, advance) {
  const moved = advance(withWeek(save, interval.to, content))
  return { ...moved, save: noteWeeklyProgress(moved.save, moved.events, content) }
}

/**
 * The journal's highlights of a change: each world whose week's goal was reached by it, as a
 * `weekly` highlight naming the event.
 *
 * @param {object | null} before
 * @param {object} after
 * @param {number} at
 * @returns {{ at: number, kind: 'weekly', ref: string }[]}
 */
export function weeklyHighlights(before, after, at) {
  if (!before) return []
  return Object.entries(after.worlds).flatMap(([worldId, world]) => {
    const now = world.weekly
    const was = before.worlds[worldId]?.weekly
    const isNew = now?.done && !(was?.done && was.week === now.week)
    return isNew ? [{ at, kind: 'weekly', ref: now.event }] : []
  })
}
