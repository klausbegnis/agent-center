// Checks game/events.json (already parsed) and indexes it for the engine: the weekly events, each
// with a kind, a nudge made of effects of the closed set legendary loot uses (legendary-content.mjs),
// a small goal for the week and the materials its reward is paid in. Pure: problems come back as text.
import { EFFECT_TYPES, effectProblems } from './legendary-content.mjs'
import { LEGENDARY_EFFECT_CAPS } from './constants.mjs'
import { MATERIALS } from './skills.mjs'

export const EVENT_KINDS = Object.freeze(['race', 'festival', 'bloom', 'bosses', 'bounty', 'training', 'gold', 'season'])
/** What a goal counts in the week: kills of the featured race, any kills, bosses, or elites and champions. */
export const GOAL_KINDS = Object.freeze(['race', 'kills', 'bosses', 'elites'])
/**
 * An event is a nudge, not a multiplier: each of its effects is at most this share of its type's cap
 * (LEGENDARY_EFFECT_CAPS), and its sum with every other source stays under that cap.
 */
export const EVENT_CAP_SHARE = 0.5
/** A catalogue needs this many events, so a season holds no repeats a person notices. */
export const FEWEST_EVENTS = 16
/** The most a goal may ask, and the most kills a reward may be worth: small goals, modest rewards. */
const MOST_GOAL = 5000
const MOST_REWARD_KILLS = 200
const EVENT_KEYS = ['id', 'name', 'kind', 'flavour', 'race', 'city', 'effects', 'goal', 'reward']
const TOP_KEYS = ['rewardKills', 'events', 'pinned']
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const NAME_LIMIT = 40
const FLAVOUR_LIMIT = 120

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isText = (value, limit) => typeof value === 'string' && value.trim() !== '' && value.length <= limit
const isWhole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
const unknownKeys = (object, known, label) =>
  Object.keys(object).filter((key) => !known.includes(key)).map((key) => `${label}: "${key}" is not a known key`)

/** The scope an event's effect is checked under: the world's where its type has one, else a party's. */
const checkScopeOf = (type) => (EFFECT_TYPES[type]?.scopes.includes('world') ? 'world' : 'party')

function checkEffects(name, effects, raceIds) {
  if (!Array.isArray(effects) || effects.length === 0) return [`${name}: "effects" must list at least one effect`]
  const problems = []
  for (const effect of effects) {
    if (!isObject(effect)) {
      problems.push(`${name}: every effect must be an object`)
      continue
    }
    if (effect.scope !== 'world') problems.push(`${name}: an event's effect has the scope "world"`)
    const scope = checkScopeOf(effect.effect)
    problems.push(...effectProblems(name, { ...effect, scope }, scope, { raceIds }))
    const cap = LEGENDARY_EFFECT_CAPS[effect.effect]
    if (cap !== undefined && effect.amount > cap * EVENT_CAP_SHARE + 1e-9) {
      problems.push(`${name}: ${effect.effect} ${effect.amount} is more than ${EVENT_CAP_SHARE} of its cap ${cap}`)
    }
  }
  return problems
}

/** What the kind asks of an event: the race of a race week, the city of a festival. */
function checkKind(name, event, { raceIds, cityIds }) {
  const problems = []
  if (!EVENT_KINDS.includes(event.kind)) problems.push(`${name}: "kind" must be one of: ${EVENT_KINDS.join(', ')}`)
  if (event.kind === 'race' ? !raceIds.includes(event.race) : event.race !== undefined) {
    problems.push(`${name}: a race week, and only one, names a "race" of game/races.json`)
  }
  if (event.kind === 'festival' ? !cityIds.includes(event.city) : event.city !== undefined) {
    problems.push(`${name}: a festival, and only one, names a "city" of game/cities.json`)
  }
  return problems
}

function checkGoal(name, event) {
  const goal = event.goal
  if (!isObject(goal)) return [`${name}: "goal" must be { kind, count }`]
  const problems = unknownKeys(goal, ['kind', 'count'], `${name}: goal`)
  if (!GOAL_KINDS.includes(goal.kind)) problems.push(`${name}: the goal's "kind" must be one of: ${GOAL_KINDS.join(', ')}`)
  if (goal.kind === 'race' && event.kind !== 'race') problems.push(`${name}: only a race week counts its race`)
  if (!isWhole(goal.count, 1, MOST_GOAL)) problems.push(`${name}: the goal's "count" must be a whole number from 1 to ${MOST_GOAL}`)
  return problems
}

function checkEvent(event, context) {
  if (!isObject(event)) return ['every event must be an object']
  const name = `event "${event.id}"`
  const problems = unknownKeys(event, EVENT_KEYS, name)
  if (typeof event.id !== 'string' || !KEBAB_CASE.test(event.id)) problems.push(`${name}: "id" must be kebab-case`)
  if (!isText(event.name, NAME_LIMIT)) problems.push(`${name}: "name" must be text of at most ${NAME_LIMIT} characters`)
  if (!isText(event.flavour, FLAVOUR_LIMIT)) problems.push(`${name}: "flavour" must be a line of at most ${FLAVOUR_LIMIT} characters`)
  const reward = event.reward
  if (!Array.isArray(reward) || reward.length === 0 || new Set(reward).size !== reward.length ||
    !reward.every((material) => MATERIALS.includes(material))) {
    problems.push(`${name}: "reward" must list distinct materials`)
  }
  return [...problems, ...checkKind(name, event, context), ...checkEffects(name, event.effects, context.raceIds), ...checkGoal(name, event)]
}

/**
 * Everything wrong with a parsed game/events.json; empty when it is valid.
 *
 * @param {unknown} data
 * @param {{ races?: { races: { id: string }[] }, cities?: { cities: { id: string }[] } }} [content]
 *   the races a race week may feature and the cities a festival may be held in
 * @returns {string[]}
 */
export function validateEvents(data, content = {}) {
  if (!isObject(data)) return ['game/events.json must be an object']
  const problems = unknownKeys(data, TOP_KEYS, 'game/events.json')
  if (!isWhole(data.rewardKills, 1, MOST_REWARD_KILLS)) {
    problems.push(`"rewardKills" must be a whole number from 1 to ${MOST_REWARD_KILLS}`)
  }
  if (!Array.isArray(data.events) || data.events.length < FEWEST_EVENTS) {
    return [...problems, `"events" must list at least ${FEWEST_EVENTS} events`]
  }
  const context = {
    raceIds: (content.races?.races ?? []).map((race) => race.id),
    cityIds: (content.cities?.cities ?? []).map((city) => city.id)
  }
  const ids = new Set()
  for (const event of data.events) {
    problems.push(...checkEvent(event, context))
    if (ids.has(event?.id)) problems.push(`event "${event.id}" is listed twice`)
    ids.add(event?.id)
  }
  if (data.pinned !== undefined && !ids.has(data.pinned)) problems.push('"pinned" must be the id of an event')
  return problems
}

/**
 * @typedef {{ ids: string[], byId: Map<string, object>, rewardKills: number, pinned: string | null }} EventIndex
 */

const indexes = new WeakMap()

/**
 * The index of the content's weekly events, built once per content file.
 *
 * @param {{ events?: object } | null | undefined} content
 * @returns {EventIndex | null} null when the content has no weekly events
 */
export function eventIndexOf(content) {
  const data = content?.events
  if (!isObject(data) || !Array.isArray(data.events)) return null
  if (!indexes.has(data)) {
    indexes.set(data, {
      ids: data.events.map((event) => event.id),
      byId: new Map(data.events.map((event) => [event.id, event])),
      rewardKills: data.rewardKills,
      pinned: typeof data.pinned === 'string' ? data.pinned : null
    })
  }
  return indexes.get(data)
}

/**
 * The events data with one event every week, for the demo's EVENT switch; unchanged for an id the
 * catalogue does not have.
 *
 * @param {object} data the parsed game/events.json
 * @param {string | undefined} eventId
 */
export function pinEvent(data, eventId) {
  if (!eventId || !data.events.some((event) => event.id === eventId)) return data
  return { ...data, pinned: eventId }
}
