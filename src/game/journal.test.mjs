import assert from 'node:assert/strict'
import { test } from 'node:test'
import { journalGains } from './journal-gains.mjs'
import { JOURNAL_DAYS, JOURNAL_HIGHLIGHTS, emptyJournal, journalView, markJournalSeen, recordJournal } from './journal.mjs'
import { emptyProject, emptySave, emptyWorld } from './worlds.mjs'

const DAY = 20_000
const AT = 1_800_000_000_000
const ROOM = 'local:/work/rumble-banana'
const nameOf = ({ ref }) => ref

const viewOf = (journal, day = DAY) => journalView(journal, { day, nameOf })

test('what a change gained is counted on its day, since the last look and over all time', () => {
  const journal = recordJournal(undefined, { day: DAY, counts: { kills: 3, coins: 40 } })
  const view = viewOf(journal)
  assert.equal(view.today.kills, 3)
  assert.equal(view.today.coins, 40)
  assert.equal(view.since.kills, 3)
  assert.equal(journal.totals[0], 3)
})

test('a change that gained nothing leaves the journal as it was', () => {
  const journal = recordJournal(undefined, { day: DAY, counts: { kills: 1 } })
  assert.equal(recordJournal(journal, { day: DAY, counts: { kills: 0 } }), journal)
})

test('the day rolls over at the next day: yesterday keeps its counts and today starts at zero', () => {
  const yesterday = recordJournal(undefined, { day: DAY, counts: { kills: 5 } })
  const today = recordJournal(yesterday, { day: DAY + 1, counts: { kills: 2 } })
  const view = viewOf(today, DAY + 1)
  assert.equal(view.today.kills, 2)
  assert.equal(view.days.at(-2).kills, 5)
  assert.equal(today.activeDays, 2)
})

test('the journal keeps the last fourteen days and no more', () => {
  let journal = emptyJournal()
  for (let day = DAY; day < DAY + 20; day++) journal = recordJournal(journal, { day, counts: { kills: 1 } })
  assert.equal(journal.days.length, JOURNAL_DAYS)
  assert.equal(journal.days[0][0], DAY + 20 - JOURNAL_DAYS)
  assert.equal(journal.totals[0], 20)
  assert.equal(journal.activeDays, 20)
})

test('a clock set back adds to the newest day instead of going backwards', () => {
  const journal = recordJournal(recordJournal(undefined, { day: DAY, counts: { kills: 1 } }), { day: DAY - 3, counts: { kills: 1 } })
  assert.deepEqual(journal.days.map((row) => row[0]), [DAY])
  assert.equal(journal.days[0][1], 2)
})

test('highlights are capped, newest kept', () => {
  let journal = emptyJournal()
  for (let at = 0; at < JOURNAL_HIGHLIGHTS + 5; at++) {
    journal = recordJournal(journal, { day: DAY, counts: {}, highlights: [{ at, kind: 'boss', ref: `boss-${at}` }] })
  }
  assert.equal(journal.highlights.length, JOURNAL_HIGHLIGHTS)
  assert.equal(journal.highlights.at(-1).ref, `boss-${JOURNAL_HIGHLIGHTS + 4}`)
})

test('looking at the summary clears what is new, and only later highlights are unread', () => {
  const before = recordJournal(undefined, { day: DAY, counts: { kills: 4 }, highlights: [{ at: AT, kind: 'boss', ref: 'skrix' }] })
  assert.equal(viewOf(before).unread, true)
  const seen = markJournalSeen(before, AT + 10)
  assert.equal(viewOf(seen).unread, false)
  assert.equal(viewOf(seen).since.kills, 0)
  assert.equal(viewOf(seen).today.kills, 4)
  const after = recordJournal(seen, { day: DAY, counts: {}, highlights: [{ at: AT + 20, kind: 'loot', ref: 'tempered-shortsword', value: 3 }] })
  assert.deepEqual(viewOf(after).since.highlights.map((highlight) => highlight.ref), ['tempered-shortsword'])
})

test('the strip shows every one of the last fourteen days, empty ones as zeros', () => {
  const view = viewOf(recordJournal(undefined, { day: DAY - 3, counts: { kills: 1 } }))
  assert.equal(view.days.length, JOURNAL_DAYS)
  assert.equal(view.days.at(-1).day, DAY)
  assert.equal(view.days.at(-4).kills, 1)
  assert.equal(view.days.at(-1).kills, 0)
})

/** A save with one room and the given world fields. */
function saveWith(world = {}, project = {}) {
  const save = emptySave()
  save.worlds.main = { ...emptyWorld(), ...world, projects: { [ROOM]: { ...emptyProject(), ...project } } }
  return save
}

test('a round\'s kills, bosses, level-ups and instance results come from its events', () => {
  const events = [
    { type: 'kill', roomId: ROOM, rank: 'normal' }, { type: 'kill', roomId: ROOM, rank: 'boss' },
    { type: 'level', roomId: ROOM, level: 4 },
    { type: 'instance', kind: 'cleared', instance: 'sunken-crypt', tier: 2 }, { type: 'instance', kind: 'failed', instance: 'hollow-hive' }
  ]
  const { counts, highlights } = journalGains({ before: saveWith(), after: saveWith(), events, at: AT, tierOf: () => 1 })
  assert.equal(counts.kills, 2)
  assert.equal(counts.bosses, 1)
  assert.equal(counts.levels, 1)
  assert.equal(counts.cleared, 1)
  assert.equal(counts.failed, 1)
  assert.deepEqual(highlights, [{ at: AT, kind: 'instance', ref: 'sunken-crypt', value: 2 }])
})

test('coins, skill levels and building levels are what the save gained; materials only up to midway', () => {
  const before = saveWith({ coins: 100, materials: { ore: 10 }, upgrades: { campfire: 1 }, skills: { forge: { level: 3, xp: 0, banked: 0, stars: 0 } } })
  const midway = saveWith({ coins: 100, materials: { ore: 50 } })
  const after = saveWith({ coins: 180, materials: { ore: 0 }, upgrades: { campfire: 3 }, skills: { forge: { level: 5, xp: 0, banked: 0, stars: 0 } } })
  const { counts } = journalGains({ before, after, midway, at: AT, tierOf: () => 1 })
  assert.equal(counts.coins, 80)
  assert.equal(counts.materials, 40)
  assert.equal(counts.buildings, 2)
  assert.equal(counts.skillLevels, 2)
  assert.equal(journalGains({ before, after, at: AT, tierOf: () => 1 }).counts.materials, 0)
})

test('loot is notable when legendary or of a higher tier than its room held', () => {
  const before = saveWith({}, { chest: [{ id: 'a', entryId: 'a', slot: 'weapon', tier: 3, level: 0, recipe: [], heldBy: null }] })
  const events = [
    { type: 'drop', roomId: ROOM, item: 'low' }, { type: 'drop', roomId: ROOM, item: 'high' },
    { type: 'drop', roomId: ROOM, item: 'high-again' }, { type: 'legendary', roomId: ROOM, item: 'rimeheart' }
  ]
  const tiers = { low: 3, high: 4, 'high-again': 4 }
  const { counts, highlights } = journalGains({ before, after: before, events, at: AT, tierOf: (id) => tiers[id] })
  assert.equal(counts.loot, 2)
  assert.deepEqual(highlights.map((highlight) => highlight.ref).sort(), ['high', 'rimeheart'])
})
