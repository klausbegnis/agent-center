import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  activityLabel,
  actorDescription,
  defaultThemeOptions,
  hiddenSubagents,
  occupancy,
  roomThemeOptions,
  roomTitle,
  since,
  subagentOf,
  themeLoadFailure
} from './labels.js'
import { RANDOM_THEME } from './room-themes.js'

const themes = [
  { id: 'meadow', name: 'Meadow' },
  { id: 'harbour', name: 'Harbour' }
]

test('since rounds to minutes, then hours', () => {
  const now = 10 * 60 * 60_000
  assert.equal(since(now - 20_000, now), 'just now')
  assert.equal(since(now - 4 * 60_000, now), '4 min ago')
  assert.equal(since(now - 150 * 60_000, now), '2 h ago')
})

test('since never goes negative for a timestamp in the future', () => {
  assert.equal(since(5_000, 0), 'just now')
})

test('occupancy counts agents and subagents separately', () => {
  const agent = { parentId: null }
  const sub = { parentId: 'a' }
  assert.equal(occupancy([]), 'empty')
  assert.equal(occupancy([agent]), '1 agent')
  assert.equal(occupancy([agent, agent, sub]), '2 agents · 1 subagent')
})

test('the room title leaves the host out for this machine', () => {
  assert.equal(roomTitle({ name: 'storefront', host: 'local' }), 'storefront')
  assert.equal(roomTitle({ name: 'storefront', host: null }), 'storefront')
  assert.equal(roomTitle({ name: 'turbo-waffle', host: 'build-box' }), 'turbo-waffle · build-box')
})

test('an activity without a label shows as its own name', () => {
  assert.equal(activityLabel('write'), 'Writing code')
  assert.equal(activityLabel('juggle'), 'juggle')
})

test('the default theme can be Random or any theme, with Random listed first', () => {
  assert.deepEqual(defaultThemeOptions({ theme: 'meadow', themes }), [
    [RANDOM_THEME, 'Random'],
    ['meadow', 'Meadow'],
    ['harbour', 'Harbour']
  ])
})

test("a room's choices start with the default and say which theme that is", () => {
  assert.deepEqual(roomThemeOptions({ theme: 'harbour', themes }), [
    ['', 'Default (Harbour)'],
    ['meadow', 'Meadow'],
    ['harbour', 'Harbour']
  ])
})

test("a room's choices say when the default is Random", () => {
  assert.equal(roomThemeOptions({ theme: RANDOM_THEME, themes })[0][1], 'Default (Random)')
})

test('a default theme that is gone shows as its id', () => {
  assert.equal(roomThemeOptions({ theme: 'gone', themes })[0][1], 'Default (gone)')
})

test('a failed load names the default theme, or says none loaded under Random', () => {
  assert.equal(themeLoadFailure({ theme: 'meadow', themes }), 'Could not load the theme "meadow".')
  assert.equal(themeLoadFailure({ theme: RANDOM_THEME, themes }), 'Could not load any theme.')
})

test('a subagent is described by the agent it works for', () => {
  assert.equal(subagentOf('Fix checkout rounding'), 'subagent of Fix checkout rounding')
  assert.equal(subagentOf(undefined), 'subagent')
})

test('a character is announced by name and activity, a subagent with its parent as well', () => {
  const main = { name: 'Search filters', activity: 'run', parentId: null }
  const sub = { name: 'Explore', activity: 'read', parentId: 'pane-1' }
  assert.equal(actorDescription(main), 'Search filters: Running a command')
  assert.equal(actorDescription(sub, 'Search filters'), 'Explore: Reading files, subagent of Search filters')
})

test('the marker for subagents that are not shown counts them', () => {
  assert.deepEqual(hiddenSubagents(1), { short: '+1', full: '1 more subagent' })
  assert.deepEqual(hiddenSubagents(4), { short: '+4', full: '4 more subagents' })
})

test('kills towards the next wave are short on screen and spelled out for screen readers', async () => {
  const { waveKillsLabel } = await import('./labels.js')
  assert.deepEqual(waveKillsLabel({ wave: 15, waveKills: 2, killsToPass: 16 }), {
    short: '2/16',
    full: '2 of 16 kills to pass wave 15'
  })
  assert.equal(waveKillsLabel({ wave: 3, waveKills: 0, killsToPass: 1 }).full, '0 of 1 kill to pass wave 3')
})

test('only a boss or an elite wears a tag, and an elite names its affix', async () => {
  const { monsterTag } = await import('./labels.js')
  assert.equal(monsterTag({ kind: 'common', affix: null }), null)
  assert.equal(monsterTag({ kind: 'boss', affix: null }), 'Boss')
  assert.equal(monsterTag({ kind: 'armored', affix: 'thorny' }), 'Elite · Thorny')
})

test('a monster is described with its level, kind and health', async () => {
  const { monsterDescription } = await import('./labels.js')
  const monster = { name: 'Practice Dummy', kind: 'armored', affix: 'swift', level: 15 }
  assert.equal(monsterDescription(monster, '12%'), 'Practice Dummy, level 15, armored, elite, swift, 12% health')
})

test('a character\'s mark adds its level and class, or that it is a guest', async () => {
  const { badgeDescription } = await import('./labels.js')
  assert.equal(badgeDescription({ kind: 'member', level: 9, classId: 'support', isGathering: false }), 'level 9 Healer')
  assert.equal(
    badgeDescription({ kind: 'member', level: 2, classId: 'magical', trade: 'fishing', isGathering: true }),
    'level 2 Mage, gathering Fishing'
  )
  assert.equal(badgeDescription({ kind: 'guest' }), 'guest, keeps no progress')
})
