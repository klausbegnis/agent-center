// Checks and indexes game/achievements.json: groups, and achievements each with a name, a
// description, points, an optional title and hidden mark, and a condition. A condition is data:
// `{ metric, atLeast }` with the metric's one parameter when it takes one
// (`{ metric: 'raceKills', race: 'troll', atLeast: 500 }`), or `{ all: [conditions] }`. Metrics
// are in achievement-metrics.mjs. Pure.
import { METRICS, paramChoices } from './achievement-metrics.mjs'

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** Names and descriptions are short lines on a card. */
const NAME_LIMIT = 40
const DESCRIPTION_LIMIT = 120
const TITLE_LIMIT = 32
/** Points per achievement, so the total stays a readable number. */
const MAX_POINTS = 100
/** How deep `all` may nest: one level is all the catalogue needs. */
const MAX_DEPTH = 2
const KEYS = new Set(['id', 'group', 'name', 'description', 'points', 'when', 'hidden', 'title'])

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const isLine = (value, limit) => typeof value === 'string' && value.trim() !== '' && value.length <= limit

/** The problems of a condition, as lines naming where. */
function conditionProblems(when, path, choices, depth = 0) {
  if (!isPlainObject(when)) return [`${path} is not a condition`]
  if (Object.hasOwn(when, 'all')) {
    if (depth >= MAX_DEPTH) return [`${path} nests too deep`]
    if (!Array.isArray(when.all) || when.all.length < 2) return [`${path}.all needs two conditions or more`]
    return when.all.flatMap((part, at) => conditionProblems(part, `${path}.all.${at}`, choices, depth + 1))
  }
  const metric = Object.hasOwn(METRICS, when.metric) ? METRICS[when.metric] : null
  if (!metric) return [`${path}.metric "${String(when.metric).slice(0, 40)}" is not a metric`]
  const problems = []
  if (!Number.isSafeInteger(when.atLeast) || when.atLeast < 1) problems.push(`${path}.atLeast is not a whole number from 1`)
  const allowed = new Set(['metric', 'atLeast', ...(metric.param ? [metric.param] : [])])
  for (const key of Object.keys(when)) if (!allowed.has(key)) problems.push(`${path}.${key} is not a part of ${when.metric}`)
  if (metric.param && !choices[metric.param]?.includes(when[metric.param])) {
    problems.push(`${path}.${metric.param} is not a ${metric.param} the game has`)
  }
  return problems
}

function achievementProblems(entry, at, { groupIds, seen, choices }) {
  const path = `achievements.${at}`
  if (!isPlainObject(entry)) return [`${path} is not an object`]
  const problems = []
  if (typeof entry.id !== 'string' || !ID_PATTERN.test(entry.id)) problems.push(`${path}.id is not a kebab-case id`)
  else if (seen.has(entry.id)) problems.push(`${path}.id "${entry.id}" is used twice`)
  else seen.add(entry.id)
  if (!groupIds.has(entry.group)) problems.push(`${path}.group is not a group of the file`)
  if (!isLine(entry.name, NAME_LIMIT)) problems.push(`${path}.name is not a short name`)
  if (!isLine(entry.description, DESCRIPTION_LIMIT)) problems.push(`${path}.description is not a short line`)
  if (!Number.isInteger(entry.points) || entry.points < 1 || entry.points > MAX_POINTS) {
    problems.push(`${path}.points is not a whole number from 1 to ${MAX_POINTS}`)
  }
  if (entry.hidden !== undefined && typeof entry.hidden !== 'boolean') problems.push(`${path}.hidden is not true or false`)
  if (entry.title !== undefined && !isLine(entry.title, TITLE_LIMIT)) problems.push(`${path}.title is not a short title`)
  for (const key of Object.keys(entry)) if (!KEYS.has(key)) problems.push(`${path}.${key} is not something an achievement has`)
  return [...problems, ...conditionProblems(entry.when, `${path}.when`, choices)]
}

/**
 * Every problem of the achievements file, as lines; none means it is valid.
 *
 * @param {unknown} data the parsed game/achievements.json
 * @param {object} [content] the other content files, whose ids a parameter must name
 * @returns {string[]}
 */
export function validateAchievements(data, content = {}) {
  if (!isPlainObject(data)) return ['the file is not an object']
  if (!Array.isArray(data.groups) || data.groups.length === 0) return ['groups is not a list of groups']
  if (!Array.isArray(data.achievements) || data.achievements.length === 0) return ['achievements is not a list']
  const problems = []
  const groupIds = new Set()
  data.groups.forEach((group, at) => {
    if (!isPlainObject(group) || typeof group.id !== 'string' || !ID_PATTERN.test(group.id)) problems.push(`groups.${at} has no kebab-case id`)
    else if (groupIds.has(group.id)) problems.push(`groups.${at}.id "${group.id}" is used twice`)
    else groupIds.add(group.id)
    if (!isLine(group?.name, NAME_LIMIT)) problems.push(`groups.${at}.name is not a short name`)
  })
  const options = { groupIds, seen: new Set(), choices: paramChoices(content) }
  data.achievements.forEach((entry, at) => problems.push(...achievementProblems(entry, at, options)))
  for (const group of groupIds) {
    if (!data.achievements.some((entry) => entry?.group === group)) problems.push(`group "${group}" has no achievement`)
  }
  return problems
}

/**
 * @typedef {{ id: string, group: string, name: string, description: string, points: number,
 *   when: object, hidden: boolean, title: string | null }} Achievement
 * @typedef {{ groups: { id: string, name: string }[], list: Achievement[], byId: Map<string, Achievement> }}
 *   AchievementIndex
 */

/**
 * @param {object | null | undefined} data a valid achievements file, or none
 * @returns {AchievementIndex | null}
 */
export function indexAchievements(data) {
  if (!data) return null
  const list = data.achievements.map((entry) => ({
    id: entry.id,
    group: entry.group,
    name: entry.name,
    description: entry.description,
    points: entry.points,
    when: entry.when,
    hidden: entry.hidden === true,
    title: entry.title ?? null
  }))
  return { groups: data.groups.map(({ id, name }) => ({ id, name })), list, byId: new Map(list.map((entry) => [entry.id, entry])) }
}

const indexes = new WeakMap()

/**
 * The achievements of a set of content, indexed once per file.
 *
 * @param {{ achievements?: object } | null | undefined} content
 * @returns {AchievementIndex | null}
 */
export function achievementIndexOf(content) {
  const data = content?.achievements
  if (!data) return null
  if (!indexes.has(data)) indexes.set(data, indexAchievements(data))
  return indexes.get(data)
}
