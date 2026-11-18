// The demo's achievements and "While you worked" summary: two weeks of a made-up journal (every
// number from a hash of the day, so it is the same on every run), a few highlights, a last look a
// few hours ago so "Since you last looked" has something in it, and the legendary room's party
// wearing a title it earned. It goes in as an imported save would; the achievements themselves are
// the ones the demo's save really earns.
import { localDayOf } from '../src/game-chronicle.mjs'
import { hashOf } from '../src/game/hash.mjs'
import { JOURNAL_COUNTERS } from '../src/game/journal.mjs'

/** How long ago the person last opened the summary, in the demo's game time. */
const LAST_LOOK_MS = 3 * 60 * 60_000
const HOUR_MS = 60 * 60_000

/** A made-up day of work: a quiet weekend now and then, a busy day now and then. */
function demoDay(day) {
  const swing = (key, most) => hashOf(`demo-journal|${day}|${key}`) % (most + 1)
  const isQuiet = hashOf(`demo-journal|${day}|quiet`) % 7 < 2
  const scale = isQuiet ? 0.1 : 1
  const counts = {
    kills: Math.round((180 + swing('kills', 420)) * scale),
    bosses: Math.round(swing('bosses', 4) * scale),
    levels: Math.round((4 + swing('levels', 10)) * scale),
    skillLevels: Math.round((2 + swing('skills', 6)) * scale),
    loot: swing('loot', 2),
    coins: Math.round((2_000 + swing('coins', 9_000)) * scale),
    materials: Math.round((900 + swing('materials', 3_000)) * scale),
    achievements: swing('achievements', 2),
    buildings: swing('buildings', 3),
    cleared: swing('cleared', 1),
    failed: 0
  }
  return [day, ...JOURNAL_COUNTERS.map((name) => counts[name])]
}

const sumRows = (rows) => JOURNAL_COUNTERS.map((_, at) => rows.reduce((sum, row) => sum + row[at + 1], 0))

/**
 * Gives the demo's game its journal and a title, then a round links the agents again.
 *
 * @param {object} game the demo's game mode
 * @param {{ now: number, titleRoom: string }} options `titleRoom` is the room whose party wears a title
 */
export async function showDemoChronicle(game, { now, titleRoom }) {
  const file = await game.exportSave()
  const today = localDayOf(now)
  const earlier = Array.from({ length: 13 }, (_, at) => demoDay(today - 13 + at))
  const todayRow = file.save.journal?.days?.find((row) => row[0] === today) ?? demoDay(today)
  const days = [...earlier, todayRow]
  const seenAt = now - LAST_LOOK_MS
  const since = demoDay(today + 1).slice(1).map((count) => Math.floor(count / 3))
  since[JOURNAL_COUNTERS.indexOf('cleared')] = 1
  file.save.journal = {
    days,
    totals: sumRows(days),
    since,
    seenAt,
    activeDays: 41,
    highlights: [
      { at: now - 30 * HOUR_MS, kind: 'stage', ref: 'village' },
      { at: now - 26 * HOUR_MS, kind: 'boss', ref: 'skrix' },
      { at: now - 20 * HOUR_MS, kind: 'achievement', ref: 'relics-1' },
      { at: now - 2 * HOUR_MS, kind: 'legendary', ref: 'rimeheart' },
      { at: now - HOUR_MS, kind: 'loot', ref: 'tempered-shortsword', value: 3 },
      { at: now - HOUR_MS / 2, kind: 'instance', ref: 'sunken-crypt', value: 1 },
      { at: now - HOUR_MS / 4, kind: 'building', ref: 'hearth', value: 2 }
    ]
  }
  await game.importSave(file)
  // The title is chosen as a person would, from what the save has really earned.
  const titles = game.getView().achievements?.titles ?? []
  if (titles.length) await game.setPartyTitle({ roomId: titleRoom, achievementId: titles[0].id })
  await game.round()
}
