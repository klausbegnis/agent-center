// The words of the weekly events: what an event does, worded from its effects (the same data the
// engine plays by), its goal, the time left and the banner's labels. Never touches the DOM.
import { effectText, listText, WORDED_EFFECTS } from './legendary-labels.js'
import { materialLabel } from './labels.js'
import { formatAmount } from './game-format.js'

const percent = (amount) => `${Math.round(amount * 1000) / 10}%`
const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

export const EVENTS = {
  bannerName: 'This week',
  nextShow: 'Next week',
  nextHide: 'Hide next week',
  nextName: (name) => `Next week: ${name}`,
  goal: 'Goal',
  reached: 'Goal reached, reward paid',
  reward: (text) => `Reward: ${text}`,
  marker: (name, timeLeft) => `This week's event: ${name}, ${timeLeft}`,
  /** What a race week does beyond its effects. */
  raceWeek: (raceName) => `${raceName} come twice as often and earn half again the bestiary points`,
  festival: (cityName) => `${cityName} holds its festival`
}

/** The kinds' names, for the icon's tooltip and the marker. */
export const KIND_LABEL = {
  race: 'Race week',
  festival: 'Festival',
  bloom: 'In bloom',
  bosses: 'Boss hunt',
  bounty: 'Bounties',
  training: 'Training week',
  gold: 'Gold rush',
  season: 'Season'
}

/**
 * The time left in a week, as a person says it: "3 d 4 h left", "5 h left", "under an hour left".
 *
 * @param {number} ms
 */
export function timeLeftText(ms) {
  if (!(ms > 0)) return 'ending now'
  if (ms < HOUR_MS) return 'under an hour left'
  const days = Math.floor(ms / DAY_MS)
  const hours = Math.floor((ms - days * DAY_MS) / HOUR_MS)
  if (days === 0) return `${hours} h left`
  return hours ? `${days} d ${hours} h left` : `${days} d left`
}

/**
 * What one of an event's effects does, in words. Its scope is the world's; types the legendary
 * words have only for a party read the same, and a character's experience is every character's.
 *
 * @param {{ effect: string, amount: number }} effect
 * @param {Record<string, string>} [raceNames] by race id
 */
export function eventEffectText(effect, raceNames = {}) {
  if (effect.effect === 'characterXp') return `+${percent(effect.amount)} experience for every character`
  const scope = WORDED_EFFECTS[effect.effect]?.includes('world') ? 'world' : 'party'
  return effectText({ ...effect, scope }, undefined, { raceNames })
}

/**
 * Every line of what an event does: its kind's own (a race week's race, a festival's city), then
 * its effects.
 *
 * @param {{ kind: string, race?: string | null, raceName?: string | null, cityName?: string | null,
 *   effects: object[] }} event
 * @returns {string[]}
 */
export function eventLines(event) {
  const raceNames = event.race && event.raceName ? { [event.race]: event.raceName } : {}
  const lines = []
  if (event.kind === 'race' && event.raceName) lines.push(EVENTS.raceWeek(event.raceName))
  if (event.kind === 'festival' && event.cityName) lines.push(EVENTS.festival(event.cityName))
  for (const effect of event.effects) {
    const text = eventEffectText(effect, raceNames)
    if (text) lines.push(text)
  }
  return lines
}

/**
 * The week's goal in words: "Defeat 40 werewolves".
 *
 * @param {{ kind: string, count: number }} goal
 * @param {string | null} [raceName]
 */
export function goalText(goal, raceName = null) {
  if (goal.kind === 'race') return `Defeat ${goal.count} ${(raceName ?? 'of the race').toLowerCase()}`
  if (goal.kind === 'bosses') return `Defeat ${goal.count} ${goal.count === 1 ? 'boss' : 'bosses'}`
  if (goal.kind === 'elites') return `Defeat ${goal.count} elites or champions`
  return `Defeat ${goal.count} monsters`
}

/** A reward's materials: "1.2k crops and 980 fish". */
export const rewardText = (reward) =>
  listText(Object.entries(reward ?? {}).filter(([, amount]) => amount > 0)
    .map(([material, amount]) => `${formatAmount(amount)} ${materialLabel(material).toLowerCase()}`))
