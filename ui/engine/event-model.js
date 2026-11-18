// What the weekly event's calendar (its button in the header and the card it opens) and the rooms'
// markers show, from a world of the view state
// (`world.weekly`, see docs/GAME.md "Weekly events"). Never touches the DOM.
import { clampShare } from './game-format.js'
import { EVENTS, KIND_LABEL, eventLines, goalText, rewardText, timeLeftText, timeLeftWords, weekDatesText } from './event-labels.js'

/** Where a kind's icon is, under the plugin's folder. */
export const eventIconUrl = (base, kind) => `${base}ui/art/events/${kind}.png`

/**
 * This week's event as the calendar's card shows it, or null when the world has none yet.
 *
 * @param {{ weekly?: object | null } | null | undefined} world
 * @returns {{ id: string, name: string, kind: string, kindLabel: string, flavour: string, lines: string[],
 *   timeLeft: string, goal: { text: string, progress: number, count: number, done: boolean, share: number },
 *   reward: string, next: { name: string, kind: string, kindLabel: string, flavour: string, lines: string[],
 *   goal: string } | null } | null}
 */
export function thisWeekModel(world) {
  const weekly = world?.weekly
  if (!weekly || typeof weekly !== 'object' || !weekly.goal) return null
  const goal = weekly.goal
  return {
    id: weekly.id,
    name: weekly.name,
    kind: weekly.kind,
    kindLabel: KIND_LABEL[weekly.kind] ?? weekly.kind,
    flavour: weekly.flavour,
    lines: eventLines(weekly),
    dates: Number.isFinite(weekly.startsAt) ? weekDatesText(weekly.startsAt) : '',
    timeLeft: timeLeftText(weekly.msLeft),
    timeLeftWords: timeLeftWords(weekly.msLeft),
    goal: {
      text: goalText(goal, weekly.raceName),
      progress: goal.progress,
      count: goal.count,
      done: goal.done === true,
      share: clampShare(goal.progress / Math.max(1, goal.count))
    },
    reward: goal.done ? EVENTS.reached : EVENTS.reward(rewardText(weekly.reward)),
    next: weekly.next ? {
      name: weekly.next.name,
      kind: weekly.next.kind,
      kindLabel: KIND_LABEL[weekly.next.kind] ?? weekly.next.kind,
      flavour: weekly.next.flavour,
      lines: eventLines(weekly.next),
      goal: goalText(weekly.next.goal, weekly.next.raceName)
    } : null
  }
}

/**
 * The small marker in a room's header: the icon of its world's event and what it says.
 *
 * @param {{ weekly?: object | null } | null | undefined} world
 * @returns {{ kind: string, label: string } | null}
 */
export function markerModel(world) {
  const week = thisWeekModel(world)
  if (!week) return null
  const goal = week.goal.done ? 'goal reached' : `${week.goal.progress} of ${week.goal.count}`
  return { kind: week.kind, label: `${EVENTS.marker(week.name, week.timeLeft)}; ${goal}` }
}

/**
 * The calendar button in the header: the event's name and kind, the goal's share and state, and
 * its label in words. Null when the world has no event yet.
 *
 * @param {{ weekly?: object | null } | null | undefined} world
 * @returns {{ name: string, kind: string, share: number, done: boolean, label: string } | null}
 */
export function calendarButtonModel(world) {
  const week = thisWeekModel(world)
  if (!week) return null
  const goal = EVENTS.buttonGoal(week.goal.progress, week.goal.count, week.goal.done)
  return {
    name: week.name,
    kind: week.kind,
    share: week.goal.share,
    done: week.goal.done,
    label: EVENTS.button(week.name, goal, week.timeLeftWords)
  }
}

/**
 * The calendar's coming weeks after this one: each week's dates, event name and kind.
 *
 * @param {{ weekly?: object | null } | null | undefined} world
 * @returns {{ week: string, dates: string, id: string, name: string, kind: string, kindLabel: string }[]}
 */
export function comingWeeks(world) {
  const upcoming = Array.isArray(world?.weekly?.upcoming) ? world.weekly.upcoming : []
  return upcoming.map((entry) => ({
    week: entry.week,
    dates: weekDatesText(entry.startsAt),
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    kindLabel: KIND_LABEL[entry.kind] ?? entry.kind
  }))
}
