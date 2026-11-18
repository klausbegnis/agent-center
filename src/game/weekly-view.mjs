// What a UI receives of the weekly event: per world, this week's event with what it does, its goal
// and how far the world has come, the time left on the game's own clock, and next week's event. Pure.
import { weekOfIndex, weekOfKey, eventIdOfWeek } from './weekly-calendar.mjs'
import { eventIndexOf } from './weekly-content.mjs'
import { eventOfWorld, weeklyReward } from './weekly.mjs'

/** An event as the UI words it: names of its race and city with the ids, its effects as data. */
function eventView(event, content) {
  const race = event.race ? content.bestiary?.races?.find((entry) => entry.id === event.race) : null
  const city = event.city ? content.cities?.cities?.find((entry) => entry.id === event.city) : null
  return {
    id: event.id,
    name: event.name,
    kind: event.kind,
    flavour: event.flavour,
    race: event.race ?? null,
    raceName: race?.name ?? null,
    city: event.city ?? null,
    cityName: city?.name ?? null,
    effects: event.effects.map((effect) => ({ ...effect })),
    goal: { ...event.goal }
  }
}

/**
 * A world's weekly event, or null before its first advance or without weekly events.
 *
 * @param {object} world
 * @param {object} content
 * @returns {object | null} `{ week, endsAt, msLeft, ...event, goal: { kind, count, progress, done },
 *   reward: Record<string, number>, next }`; `msLeft` is measured from the last advance, on the
 *   game's clock; `reward` is what the goal pays at the world's level now
 */
export function weeklyView(world, content) {
  const index = eventIndexOf(content)
  const event = eventOfWorld(world, content)
  const week = weekOfKey(world?.weekly?.week)
  if (!index || !event || !week) return null
  const nextId = eventIdOfWeek(index.ids, week.index + 1)
  const next = index.byId.get(nextId)
  return {
    week: week.key,
    endsAt: week.endsAt,
    msLeft: Math.max(0, week.endsAt - world.weekly.seenAt),
    ...eventView(event, content),
    goal: { ...event.goal, progress: world.weekly.progress, done: world.weekly.done },
    reward: weeklyReward(world, event, index.rewardKills),
    next: next ? { week: weekOfIndex(week.index + 1).key, ...eventView(next, content) } : null
  }
}
