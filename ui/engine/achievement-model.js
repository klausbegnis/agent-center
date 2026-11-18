// What the Achievements view, the title picker and the rooms' celebrations show, worked out from
// the view state. Never touches the DOM.
import { ACHIEVEMENT_EVENT, ACHIEVEMENTS } from './achievement-labels.js'
import { clampShare, formatAmount } from './game-format.js'

/**
 * The title a room's party wears, or null.
 *
 * @param {object | undefined} game the view state's game
 * @param {string | null} roomId
 * @returns {string | null}
 */
export function partyTitleOf(game, roomId) {
  if (!roomId) return null
  return game?.achievements?.partyTitles?.[roomId]?.title ?? null
}

/** "18 Nov 2026" for a time, in the person's own calendar. */
export function dateText(ms) {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * An achievement as its row shows it.
 *
 * @param {object} entry from the view state's `achievements.groups[].list`
 */
export function achievementRow(entry) {
  const isEarned = entry.earnedAt !== undefined && entry.earnedAt !== null
  const isSecret = !entry.name
  const share = clampShare(entry.share)
  return {
    id: entry.id,
    isEarned,
    isSecret,
    name: isSecret ? ACHIEVEMENTS.secret : entry.name,
    description: isSecret ? ACHIEVEMENTS.secretNote : entry.description,
    points: entry.points,
    title: entry.title ?? null,
    share,
    progressText: isEarned
      ? ACHIEVEMENTS.earnedOn(dateText(entry.earnedAt))
      : entry.target !== undefined
        ? ACHIEVEMENTS.progress(formatAmount(entry.value ?? 0), formatAmount(entry.target))
        : `${Math.floor(share * 100)}%`
  }
}

/**
 * The groups as their cards show them: earned first within a group would hide the ladder's order,
 * so the catalogue's order is kept.
 *
 * @param {object | undefined} achievements the view state's `achievements`
 */
export function achievementGroups(achievements) {
  return (achievements?.groups ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    count: ACHIEVEMENTS.groupCount(group.earned, group.list.length),
    share: group.list.length ? group.earned / group.list.length : 0,
    rows: group.list.map(achievementRow)
  }))
}

/**
 * The title picker's options for a room: none, then every title earned.
 *
 * @param {object | undefined} achievements
 * @returns {[string, string][]}
 */
export function titleOptions(achievements) {
  return [['', ACHIEVEMENTS.noTitle], ...(achievements?.titles ?? []).map(({ id, title }) => [id, title])]
}

/**
 * What a room line says about an achievement event, or null.
 *
 * @param {object} event a `type: 'achievement'` event of `recent`
 */
export function achievementEventText(event) {
  if (event.kind === 'backfill') return event.count > 0 ? ACHIEVEMENT_EVENT.backfill(event.count) : null
  if (event.kind !== 'earned' || !event.name) return null
  return event.title ? ACHIEVEMENT_EVENT.earnedTitle(event.name, event.title) : ACHIEVEMENT_EVENT.earned(event.name)
}


/**
 * The lines achievement events play over the rooms: one earned is celebrated in every room that
 * plays (achievements belong to the whole game), the back-fill's one notice in the first room only.
 *
 * @param {object[]} events the new events of a state
 * @param {object} game the view state's game
 * @returns {import('./game-effects.js').Effect[]}
 */
export function achievementEffects(events, game) {
  const roomIds = Object.keys(game.rooms ?? {}).filter((roomId) => game.rooms[roomId]?.joined)
  const effects = []
  for (const event of events) {
    if (event.type !== 'achievement') continue
    const text = achievementEventText(event)
    if (!text) continue
    const rooms = event.kind === 'backfill' ? roomIds.slice(0, 1) : roomIds
    for (const roomId of rooms) effects.push({ roomId, target: 'room', text, tone: 'achievement' })
  }
  return effects
}
