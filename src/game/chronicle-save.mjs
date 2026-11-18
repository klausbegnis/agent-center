// The save's achievements and journal (achievements.mjs, journal.mjs) as stored: `migrate` keeps
// what is sound of what the plugin's own storage holds, and `cleanSave` refuses an imported file
// whose parts are not what the engine writes. A save from before either has neither, which is how
// the back-fill knows to run. Pure.
import { HIGHLIGHT_KINDS, JOURNAL_COUNTERS, JOURNAL_DAYS, JOURNAL_HIGHLIGHTS } from './journal.mjs'

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const isCount = (value) => Number.isSafeInteger(value) && value >= 0
const isTime = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0
const isReserved = (key) => key === '__proto__' || key === 'constructor' || key === 'prototype'
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** Content ids are short; a longer one did not come from the engine. */
const ID_LIMIT = 80
const isId = (value) => typeof value === 'string' && value.length <= ID_LIMIT && ID_PATTERN.test(value)
/** The longest project id kept as a title's key, like the save's other ids. */
const KEY_LIMIT = 512
const isKey = (value) => typeof value === 'string' && value !== '' && value.length <= KEY_LIMIT && !isReserved(value)

const isRow = (row, length) => Array.isArray(row) && row.length === length && row.every(isCount)
const isDayRow = (row) => isRow(row, JOURNAL_COUNTERS.length + 1)

function isHighlight(value) {
  return isPlainObject(value) && isTime(value.at) && HIGHLIGHT_KINDS.includes(value.kind) && isId(value.ref) &&
    (value.value === undefined || isCount(value.value)) &&
    Object.keys(value).every((key) => ['at', 'kind', 'ref', 'value'].includes(key))
}

const highlightOf = ({ at, kind, ref, value }) => ({ at, kind, ref, ...(value === undefined ? {} : { value }) })

// ---- migrate: keep what is sound ----

function normalizeAchievements(value) {
  if (!isPlainObject(value)) return undefined
  const earned = Object.fromEntries(Object.entries(isPlainObject(value.earned) ? value.earned : {})
    .filter(([id, at]) => isId(id) && isTime(at)))
  const titles = Object.fromEntries(Object.entries(isPlainObject(value.titles) ? value.titles : {})
    .filter(([projectId, id]) => isKey(projectId) && isId(id) && Object.hasOwn(earned, id)))
  return { earned, titles, filled: isCount(value.filled) ? value.filled : 0 }
}

function normalizeJournal(value) {
  if (!isPlainObject(value)) return undefined
  const zeros = JOURNAL_COUNTERS.map(() => 0)
  const days = (Array.isArray(value.days) ? value.days : []).filter(isDayRow)
    .filter((row, at, rows) => at === 0 || row[0] > rows[at - 1][0])
    .slice(-JOURNAL_DAYS).map((row) => [...row])
  const row = (candidate) => (isRow(candidate, JOURNAL_COUNTERS.length) ? [...candidate] : zeros)
  return {
    days,
    totals: row(value.totals),
    since: row(value.since),
    seenAt: isTime(value.seenAt) ? value.seenAt : null,
    activeDays: isCount(value.activeDays) ? value.activeDays : days.length,
    highlights: (Array.isArray(value.highlights) ? value.highlights : []).filter(isHighlight)
      .slice(-JOURNAL_HIGHLIGHTS).map(highlightOf)
  }
}

/**
 * The achievements and journal of a stored save, each only when it has one: `{ achievements?, journal? }`.
 *
 * @param {object} save
 */
export function migrateChronicle(save) {
  const achievements = normalizeAchievements(save?.achievements)
  const journal = normalizeJournal(save?.journal)
  return { ...(achievements ? { achievements } : {}), ...(journal ? { journal } : {}) }
}

// ---- cleanSave: refuse what the engine would not write ----

function checkAchievements(value, { index, projectIds }) {
  if (!index) return ['achievements', 'are kept, but the game has no achievements']
  if (!isPlainObject(value)) return ['achievements', 'is not an object']
  const unknown = Object.keys(value).find((key) => !['earned', 'titles', 'filled'].includes(key))
  if (unknown) return [`achievements.${unknown.slice(0, 40)}`, 'is not something the game keeps']
  if (!isPlainObject(value.earned)) return ['achievements.earned', 'is not an object']
  for (const [id, at] of Object.entries(value.earned)) {
    if (isReserved(id) || !index.byId.has(id)) return [`achievements.earned.${id.slice(0, 40)}`, 'is not an achievement the game has']
    if (!isTime(at)) return [`achievements.earned.${id}`, 'is not a time']
  }
  if (!isPlainObject(value.titles)) return ['achievements.titles', 'is not an object']
  for (const [projectId, id] of Object.entries(value.titles)) {
    if (!isKey(projectId) || !projectIds.has(projectId)) return ['achievements.titles', 'names a room that does not play']
    if (!index.byId.get(id)?.title || !Object.hasOwn(value.earned, id)) return ['achievements.titles', 'names a title not earned']
  }
  if (!isCount(value.filled)) return ['achievements.filled', 'is not a whole count']
  if (value.filled > Object.keys(value.earned).length) return ['achievements.filled', 'is more than were earned']
  return null
}

function checkJournal(value) {
  if (!isPlainObject(value)) return ['journal', 'is not an object']
  const unknown = Object.keys(value).find((key) => !['days', 'totals', 'since', 'seenAt', 'activeDays', 'highlights'].includes(key))
  if (unknown) return [`journal.${unknown.slice(0, 40)}`, 'is not something the game keeps']
  if (!Array.isArray(value.days) || value.days.length > JOURNAL_DAYS) return ['journal.days', `is not a list of at most ${JOURNAL_DAYS} days`]
  const badDay = value.days.findIndex((row, at) => !isDayRow(row) || (at > 0 && row[0] <= value.days[at - 1][0]))
  if (badDay !== -1) return [`journal.days.${badDay}`, 'is not a day the game keeps']
  for (const key of ['totals', 'since']) {
    if (!isRow(value[key], JOURNAL_COUNTERS.length)) return [`journal.${key}`, 'is not a row of whole counts']
  }
  if (value.seenAt !== null && !isTime(value.seenAt)) return ['journal.seenAt', 'is not a time']
  if (!isCount(value.activeDays)) return ['journal.activeDays', 'is not a whole count']
  if (!Array.isArray(value.highlights) || value.highlights.length > JOURNAL_HIGHLIGHTS) {
    return ['journal.highlights', `is not a list of at most ${JOURNAL_HIGHLIGHTS}`]
  }
  const bad = value.highlights.findIndex((highlight) => !isHighlight(highlight))
  return bad === -1 ? null : [`journal.highlights.${bad}`, 'is not a highlight the game keeps']
}

/**
 * The achievements and journal of a save from outside the plugin, or the first problem as
 * `[path, what]`.
 *
 * @param {object} source the save as read
 * @param {{ index: import('./achievement-content.mjs').AchievementIndex | null, worlds: object }} options
 *   `worlds` are the save's checked worlds, whose rooms a title may name
 * @returns {{ ok: true, value: object } | { ok: false, problem: [string, string] }}
 */
export function checkChronicle(source, { index, worlds }) {
  const projectIds = new Set(Object.values(worlds).flatMap((world) => Object.keys(world.projects)))
  const problem = (source.achievements === undefined ? null : checkAchievements(source.achievements, { index, projectIds })) ??
    (source.journal === undefined ? null : checkJournal(source.journal))
  if (problem) return { ok: false, problem }
  return { ok: true, value: migrateChronicle(source) }
}
