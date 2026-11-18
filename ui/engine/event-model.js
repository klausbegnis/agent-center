// What the weekly event's banner and the rooms' markers show, from a world of the view state
// (`world.weekly`, see docs/GAME.md "Weekly events"). Never touches the DOM.
import { clampShare } from './game-format.js'
import { EVENTS, KIND_LABEL, eventLines, goalText, rewardText, timeLeftText } from './event-labels.js'

/** Where a kind's icon is, under the plugin's folder. */
export const eventIconUrl = (base, kind) => `${base}ui/art/events/${kind}.png`

/**
 * The banner of a world's event, or null when the world has none yet.
 *
 * @param {{ weekly?: object | null } | null | undefined} world
 * @returns {{ id: string, name: string, kind: string, kindLabel: string, flavour: string, lines: string[],
 *   timeLeft: string, goal: { text: string, progress: number, count: number, done: boolean, share: number },
 *   reward: string, next: { name: string, kind: string, kindLabel: string, flavour: string, lines: string[],
 *   goal: string } | null } | null}
 */
export function bannerModel(world) {
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
    timeLeft: timeLeftText(weekly.msLeft),
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
  const banner = bannerModel(world)
  if (!banner) return null
  const goal = banner.goal.done ? 'goal reached' : `${banner.goal.progress} of ${banner.goal.count}`
  return { kind: banner.kind, label: `${EVENTS.marker(banner.name, banner.timeLeft)}; ${goal}` }
}
