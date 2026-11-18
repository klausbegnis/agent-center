// The bridge's side of achievements and the journal: after every change it keeps, the engine counts
// what the change gained into the journal, on the local calendar day, and grants what is now
// earned; new achievements become `achievement` events of `recent`, and a back-fill one notice.
// The actions are a party's title and "the summary was seen".

/** A calendar day in milliseconds. */
const DAY_MS = 24 * 60 * 60_000

/**
 * The local calendar day of a time, as a whole number of days, so the journal rolls over at the
 * person's midnight. The offset comes from the clock's time zone unless given.
 *
 * @param {number} ms
 * @param {(ms: number) => number} [offsetMinutesOf] minutes behind UTC, as `Date#getTimezoneOffset`
 */
export function localDayOf(ms, offsetMinutesOf = (at) => new Date(at).getTimezoneOffset()) {
  return Math.floor((ms - offsetMinutesOf(ms) * 60_000) / DAY_MS)
}

/**
 * Counts a change the bridge keeps and grants what it earned.
 *
 * @param {object} engine
 * @param {{ before: object | null, save: object, midway?: object, events?: object[], at: number,
 *   isNews: boolean, dayOf?: (ms: number) => number }} change
 * @returns {{ save: object, news: object[] }} the save to keep and the events to tell
 */
export function chronicleChange(engine, { before, save, midway, events = [], at, isNews, dayOf = localDayOf }) {
  if (typeof engine.chronicle !== 'function') return { save, news: [] }
  const told = engine.chronicle(save, { before, midway, events, at, day: dayOf(at), isNews })
  if (!isNews) return { save: told.save, news: [] }
  const news = told.earned.map(({ id, name, points, title }) =>
    ({ type: 'achievement', kind: 'earned', achievement: id, name, points, title }))
  if (told.backfilled) news.push({ type: 'achievement', kind: 'backfill', count: told.backfilled })
  // A daily quest done, and the day's three done, for the rooms of its world (quests.mjs).
  news.push(...(told.quests ?? []))
  return { save: told.save, news }
}

/**
 * The view state's `achievements` and `journal`, for a running game.
 *
 * @param {object} engine
 * @param {object} save
 * @param {number} at now
 * @param {(ms: number) => number} [dayOf]
 */
export function chronicleView(engine, save, at, dayOf = localDayOf) {
  if (typeof engine.chronicleView !== 'function') return {}
  const day = dayOf(at)
  const { achievements, journal, quests } = engine.chronicleView(save, { day })
  const daily = quests && Object.keys(quests).length ? { quests: { worlds: quests, msLeft: msToNextDay(at, day, dayOf) } } : {}
  return { ...(achievements ? { achievements } : {}), journal, ...daily }
}

/** Precision of the time left until the next day: a second. */
const NEXT_DAY_PRECISION_MS = 1000
/** A local day lasts 23 to 25 hours when the clocks change: the next one begins within this. */
const LONGEST_DAY_MS = 26 * 60 * 60_000

/**
 * The time until the next local day begins, on the game's clock: the first moment `dayOf` names a
 * later day, so a day of 23 or 25 hours, when the clocks change, is measured right.
 *
 * @param {number} at
 * @param {number} day `dayOf(at)`
 * @param {(ms: number) => number} [dayOf]
 */
export function msToNextDay(at, day, dayOf = localDayOf) {
  let low = at
  let high = at + LONGEST_DAY_MS
  while (high - low > NEXT_DAY_PRECISION_MS) {
    const mid = low + Math.floor((high - low) / 2)
    if (dayOf(mid) > day) high = mid
    else low = mid
  }
  return high - at
}

/** An error whose message names what was refused, cut so a long input cannot flood the log. */
const refuse = (what, value) => new Error(`${what}: ${String(value).slice(0, 80)}`)

/**
 * @param {{
 *   engine: object,
 *   change: (update: (save: object) => object) => { changed: boolean },
 *   joinedProject: (save: object, roomId: string) => object,
 *   now: () => number
 * }} dependencies `change` applies an update to the save, `joinedProject` refuses a room that
 *   does not play
 */
export function createChronicleActions({ engine, change, joinedProject, now }) {
  return {
    /**
     * Puts a title earned by an achievement on a room's party, or takes it off with null.
     *
     * @param {{ roomId: string, achievementId: string | null }} input
     */
    async setPartyTitle({ roomId, achievementId }) {
      return change((save) => {
        joinedProject(save, roomId)
        if (achievementId !== null && typeof achievementId !== 'string') throw refuse('unknown achievement', achievementId)
        const choice = { projectId: roomId, achievementId }
        const problem = engine.titleProblem(save, choice)
        if (problem) throw new Error(problem)
        return engine.setPartyTitle(save, choice)
      })
    },

    /** Marks the "While you worked" summary as read: what is new is counted from now. */
    async markSummarySeen() {
      return change((save) => engine.markJournalSeen(save, now()))
    }
  }
}
