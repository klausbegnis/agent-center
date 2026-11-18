// The party's journal, for the "While you worked" summary: a rolling log of the last days, each a
// fixed row of counters, the same counters since the person last looked and over all time, and a
// short list of highlights. Bounded whatever happens: at most JOURNAL_DAYS days and
// JOURNAL_HIGHLIGHTS highlights. A day is the caller's (the bridge passes the local calendar day,
// so it rolls over at midnight); the engine reads no clock. Pure.

/** What a day counts, in this order in every row. */
export const JOURNAL_COUNTERS = Object.freeze([
  'kills', 'bosses', 'levels', 'skillLevels', 'loot', 'coins', 'materials', 'achievements', 'buildings', 'cleared', 'failed'
])
/** Days kept: two weeks, so the strip can show 14 bars. */
export const JOURNAL_DAYS = 14
/** Highlights kept, newest last: enough for a day and a look back, small enough to stay tiny. */
export const JOURNAL_HIGHLIGHTS = 24
/** What a highlight can be about; `ref` is a content id of that kind. */
export const HIGHLIGHT_KINDS = Object.freeze(['legendary', 'loot', 'boss', 'achievement', 'building', 'stage', 'instance',
  'scroll', 'weekly', 'city', 'rematch', 'region'])

/**
 * @typedef {{ at: number, kind: string, ref: string, value?: number }} Highlight
 * @typedef {{ days: number[][], totals: number[], since: number[], seenAt: number | null,
 *   activeDays: number, highlights: Highlight[] }} Journal `days` holds `[day, ...counts]`, oldest
 *   first; `since` counts from `seenAt`, when the person last opened the summary
 */

const zeros = () => JOURNAL_COUNTERS.map(() => 0)

/** @returns {Journal} */
export function emptyJournal() {
  return { days: [], totals: zeros(), since: zeros(), seenAt: null, activeDays: 0, highlights: [] }
}

/** Counts as a row, from an object that names some of them; anything else is 0. */
export function countsRow(counts) {
  return JOURNAL_COUNTERS.map((name) => {
    const value = counts?.[name]
    return Number.isSafeInteger(value) && value > 0 ? value : 0
  })
}

/** A row as an object, for a view. */
export const countsObject = (row) => Object.fromEntries(JOURNAL_COUNTERS.map((name, at) => [name, row?.[at] ?? 0]))

const addRows = (row, more) => row.map((value, at) => Math.min(Number.MAX_SAFE_INTEGER, value + more[at]))

/**
 * The journal with what a change gained, on its day. A day earlier than the newest kept (a clock
 * set back) is added to the newest, so the days never go backwards.
 *
 * @param {Journal | undefined} journal
 * @param {{ day: number, counts: Record<string, number>, highlights?: Highlight[] }} gained
 * @returns {Journal} the same journal when nothing was gained
 */
export function recordJournal(journal, { day, counts, highlights = [] }) {
  const current = journal ?? emptyJournal()
  const row = countsRow(counts)
  if (row.every((value) => value === 0) && highlights.length === 0) return current
  const days = current.days.map((entry) => [...entry])
  const newest = days.at(-1)
  let { activeDays } = current
  if (newest && newest[0] >= day) {
    days[days.length - 1] = [newest[0], ...addRows(newest.slice(1), row)]
  } else {
    days.push([day, ...row])
    activeDays += 1
  }
  return {
    days: days.slice(-JOURNAL_DAYS),
    totals: addRows(current.totals, row),
    since: addRows(current.since, row),
    seenAt: current.seenAt,
    activeDays,
    highlights: [...current.highlights, ...highlights].slice(-JOURNAL_HIGHLIGHTS)
  }
}

/**
 * The journal once the person has looked at the summary: nothing is new since then.
 *
 * @param {Journal | undefined} journal
 * @param {number} at
 * @returns {Journal}
 */
export function markJournalSeen(journal, at) {
  const current = journal ?? emptyJournal()
  return { ...current, since: zeros(), seenAt: at }
}

/**
 * The summary a UI shows: today, since the person last looked, the last JOURNAL_DAYS days (a day
 * with nothing done is a row of zeros), and the highlights, each named by `nameOf`.
 *
 * @param {Journal | undefined} journal
 * @param {{ day: number, nameOf: (highlight: Highlight) => string | null }} options `day` is today
 */
export function journalView(journal, { day, nameOf }) {
  const current = journal ?? emptyJournal()
  const byDay = new Map(current.days.map(([entryDay, ...row]) => [entryDay, row]))
  const days = []
  for (let at = day - JOURNAL_DAYS + 1; at <= day; at++) days.push({ day: at, ...countsObject(byDay.get(at)) })
  const named = current.highlights.map((highlight) => ({ ...highlight, name: nameOf(highlight) }))
  const isNew = (highlight) => current.seenAt === null || highlight.at > current.seenAt
  const since = named.filter(isNew)
  return {
    today: { day, ...countsObject(byDay.get(day)) },
    since: { seenAt: current.seenAt, ...countsObject(current.since), highlights: since },
    days,
    highlights: named,
    activeDays: current.activeDays,
    unread: since.length > 0
  }
}
