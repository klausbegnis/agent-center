// Achievements: long-term goals over every system of the game, granted once and kept for good,
// even through a world reset. Each is a condition over the save (achievement-content.mjs); some
// grant a title a room's party can wear. The first time a save is checked, everything already met
// is granted quietly (the back-fill), and `filled` keeps how many. Pure: the caller passes the time.
import { METRICS, metricContext } from './achievement-metrics.mjs'

/**
 * @typedef {{ earned: Record<string, number>, titles: Record<string, string>, filled: number }} Achievements
 *   `earned` is when each was earned (ms), `titles` the title each room's party wears, by project
 *   id and the achievement that grants it, `filled` how many the back-fill granted
 */

/** Rounds of granting at most: an achievement for earning achievements can unlock another one. */
const MAX_PASSES = 4

/** @returns {Achievements} */
export const emptyAchievements = () => ({ earned: {}, titles: {}, filled: 0 })

/** The value of one metric for a save, worked out once per check. */
function measureWith(save, context, cache) {
  return (when) => {
    const metric = METRICS[when.metric]
    if (!metric) return 0
    const param = metric.param ? when[metric.param] : undefined
    const key = `${when.metric}|${param ?? ''}`
    if (!cache.has(key)) cache.set(key, metric.measure(save, context, param))
    return cache.get(key)
  }
}

/**
 * How far a condition is: its share done (0 to 1), and for a single metric its value and target.
 *
 * @param {object} when
 * @param {(when: object) => number} measure
 * @returns {{ share: number, value?: number, target?: number }}
 */
export function progressOf(when, measure) {
  if (Array.isArray(when.all)) {
    const parts = when.all.map((part) => progressOf(part, measure))
    return { share: parts.reduce((sum, part) => sum + part.share, 0) / parts.length }
  }
  const value = measure(when)
  return { share: Math.min(1, value / when.atLeast), value, target: when.atLeast }
}

const isMet = (when, measure) => progressOf(when, measure).share >= 1

/** The points of the achievements earned. */
const pointsOf = (earned, index) =>
  Object.keys(earned).reduce((sum, id) => sum + (index.byId.get(id)?.points ?? 0), 0)

/** A checker over a save: its metrics, with the achievements earned so far filled in. */
function checkerOf(save, content, earned, index) {
  const context = { ...metricContext(content), earnedCount: Object.keys(earned).length, earnedPoints: pointsOf(earned, index) }
  return measureWith(save, context, new Map())
}

/** The titles of rooms that still play somewhere: a room that left the save takes its title along. */
function keptTitles(save, titles) {
  const kept = Object.entries(titles).filter(([projectId]) =>
    Object.values(save.worlds).some((world) => Object.hasOwn(world.projects, projectId)))
  return kept.length === Object.keys(titles).length ? titles : Object.fromEntries(kept)
}

/**
 * Grants every achievement whose condition the save now meets. A save that never had achievements
 * is back-filled: what it already meets is granted, `backfilled` says how many, and none of it is
 * news.
 *
 * @param {object} save
 * @param {{ content: object, index: import('./achievement-content.mjs').AchievementIndex | null, at: number }} options
 * @returns {{ save: object, earned: string[], backfilled: number | null }}
 */
export function grantAchievements(save, { content, index, at }) {
  if (!index) return { save, earned: [], backfilled: null }
  const isBackfill = save.achievements === undefined
  const current = save.achievements ?? emptyAchievements()
  const earned = { ...current.earned }
  const fresh = []
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const measure = checkerOf(save, content, earned, index)
    const met = index.list.filter((entry) => !Object.hasOwn(earned, entry.id) && isMet(entry.when, measure))
    if (met.length === 0) break
    for (const entry of met) {
      earned[entry.id] = at
      fresh.push(entry.id)
    }
  }
  const titles = keptTitles(save, current.titles)
  if (!isBackfill && fresh.length === 0 && titles === current.titles) return { save, earned: [], backfilled: null }
  const filled = isBackfill ? fresh.length : current.filled
  const next = { ...save, achievements: { earned, titles, filled } }
  return isBackfill ? { save: next, earned: [], backfilled: fresh.length } : { save: next, earned: fresh, backfilled: null }
}

/**
 * Why a room's party cannot wear a title now, or null.
 *
 * @param {object} save
 * @param {{ projectId: string, achievementId: string | null }} choice null takes the title off
 * @param {import('./achievement-content.mjs').AchievementIndex | null} index
 */
export function titleProblem(save, { projectId, achievementId }, index) {
  if (!index) return 'the game has no achievements'
  if (!Object.values(save.worlds).some((world) => Object.hasOwn(world.projects, projectId))) return 'the room does not play'
  if (achievementId === null) return null
  const entry = index.byId.get(achievementId)
  if (!entry?.title) return 'that achievement grants no title'
  if (!Object.hasOwn(save.achievements?.earned ?? {}, achievementId)) return 'that title has not been earned yet'
  return null
}

/**
 * The save with a room's party wearing a title, or none with null; unchanged when refused or
 * when nothing would change.
 *
 * @param {object} save
 * @param {{ projectId: string, achievementId: string | null }} choice
 * @param {import('./achievement-content.mjs').AchievementIndex | null} index
 */
export function setPartyTitle(save, { projectId, achievementId }, index) {
  if (titleProblem(save, { projectId, achievementId }, index)) return save
  const current = save.achievements ?? emptyAchievements()
  if ((current.titles[projectId] ?? null) === achievementId) return save
  const titles = { ...current.titles }
  if (achievementId === null) delete titles[projectId]
  else titles[projectId] = achievementId
  return { ...save, achievements: { ...current, titles } }
}

/**
 * One achievement as a UI shows it, kept small: a field that would be empty is left out. A hidden
 * one not earned yet keeps its name, goal and title to itself. `value` and `target` are a single
 * metric's; `share` is how far it is (1 once earned).
 */
function entryView(entry, { earned, measure }) {
  const earnedAt = Object.hasOwn(earned, entry.id) ? earned[entry.id] : null
  const shown = { id: entry.id, points: entry.points, ...(entry.hidden ? { hidden: true } : {}) }
  if (earnedAt !== null) {
    const title = entry.title ? { title: entry.title } : {}
    return { ...shown, name: entry.name, description: entry.description, ...title, earnedAt, share: 1 }
  }
  if (entry.hidden) return { ...shown, share: 0 }
  const { share, value, target } = progressOf(entry.when, measure)
  return {
    ...shown,
    name: entry.name,
    description: entry.description,
    ...(entry.title ? { title: entry.title } : {}),
    share: Math.round(share * 1000) / 1000,
    ...(target === undefined ? {} : { value: Math.min(value, target), target })
  }
}

/**
 * The achievements as a UI shows them: points, every group with its achievements and their
 * progress, the titles earned and the one each room's party wears.
 *
 * @param {object} save
 * @param {{ content: object, index: import('./achievement-content.mjs').AchievementIndex | null }} options
 */
export function achievementsView(save, { content, index }) {
  if (!index) return null
  const current = save.achievements ?? emptyAchievements()
  const measure = checkerOf(save, content, current.earned, index)
  const isEarned = (entry) => Object.hasOwn(current.earned, entry.id)
  return {
    points: pointsOf(current.earned, index),
    totalPoints: index.list.reduce((sum, entry) => sum + entry.points, 0),
    earned: index.list.filter(isEarned).length,
    total: index.list.length,
    filled: current.filled,
    groups: index.groups.map((group) => {
      const inGroup = index.list.filter((entry) => entry.group === group.id)
      return {
        id: group.id,
        name: group.name,
        earned: inGroup.filter(isEarned).length,
        list: inGroup.map((entry) => entryView(entry, { earned: current.earned, measure }))
      }
    }),
    titles: index.list.filter((entry) => isEarned(entry) && entry.title).map((entry) => ({ id: entry.id, title: entry.title })),
    partyTitles: Object.fromEntries(Object.entries(current.titles)
      .filter(([, id]) => index.byId.get(id)?.title)
      .map(([projectId, id]) => [projectId, { id, title: index.byId.get(id).title }]))
  }
}
