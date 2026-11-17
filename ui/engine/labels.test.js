import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ICONS } from './game-icons.js'
import { GAME_TABS } from './game-model.js'
import {
  ARSENAL,
  GAME_TAB_ICON,
  GAME_TAB_LABEL,
  activityLabel,
  actorDescription,
  defaultThemeOptions,
  hiddenSubagents,
  noMonsterLabel,
  occupancy,
  partyLabel,
  partyReason,
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

test('every rank above normal wears a tag, and an affixed one names its affix', async () => {
  const { monsterTag } = await import('./labels.js')
  assert.equal(monsterTag({ kind: 'common', affix: null }), null)
  assert.equal(monsterTag({ kind: 'boss', affix: null }), 'Boss')
  assert.equal(monsterTag({ kind: 'armored', affix: 'thorny' }), 'Elite · Thorny')
  assert.equal(monsterTag({ kind: 'common', rank: 'veteran', affix: null }), 'Veteran')
  assert.equal(monsterTag({ kind: 'common', rank: 'champion', affix: 'swift' }), 'Champion · Swift')
  assert.equal(monsterTag({ kind: 'boss', rank: 'legendary', affix: 'enraged' }), 'Legendary · Enraged')
})

test('over its health bar an elite wears its affix, the other ranks their word', async () => {
  const { foeTag } = await import('./labels.js')
  assert.equal(foeTag({ kind: 'common', rank: 'normal', affix: null }), null)
  assert.equal(foeTag({ kind: 'common', rank: 'elite', affix: 'thorny' }), 'Thorny')
  assert.equal(foeTag({ kind: 'common', rank: 'veteran', affix: null }), 'Veteran')
  assert.equal(foeTag({ kind: 'boss', rank: 'boss', affix: null }), 'Boss')
})

test('a monster is described with its level, kind, rank, affix and health', async () => {
  const { monsterDescription } = await import('./labels.js')
  const monster = { name: 'Practice Dummy', kind: 'armored', affix: 'swift', level: 15 }
  const expected = 'Practice Dummy, level 15, armored, elite, swift, 12% health'
  assert.equal(monsterDescription(monster, '12%'), expected)
  const boss = { name: 'Morvash, the Bog Tyrant', kind: 'boss', rank: 'legendary', affix: 'thorny', level: 30 }
  assert.equal(monsterDescription(boss, '80%'), 'Morvash, the Bog Tyrant, level 30, legendary, thorny, 80% health')
})

test('a character\'s mark adds its level and class, or that it is a guest', async () => {
  const { badgeDescription } = await import('./labels.js')
  const member = { kind: 'member', level: 9, classId: 'support', isGathering: false }
  assert.equal(badgeDescription(member), 'level 9 Healer')
  assert.equal(
    badgeDescription({ kind: 'member', level: 2, classId: 'magical', trade: 'fishing', isGathering: true }),
    'level 2 Mage, gathering Fishing'
  )
  assert.equal(badgeDescription({ kind: 'guest' }), 'guest, keeps no progress')
})

test('what is missing for a purchase is said in words', async () => {
  const { missingText, materialsText } = await import('./labels.js')
  const entries = [{ id: 'bars', amount: 115 }, { id: 'hides', amount: 12 }]
  assert.equal(missingText(entries, String), 'Needs 115 more Bars, 12 more Hides')
  assert.equal(materialsText(entries, String), '115 Bars, 12 Hides')
})

test('an item says its slot, damage type, tier and level, and who holds it', async () => {
  const { holderText, itemFacts } = await import('./labels.js')
  const wand = { slot: 'weapon', damageType: 'magical', tier: 2, level: 3 }
  assert.equal(itemFacts(wand), 'Weapon · magical · Tier 2 · Lv 3')
  assert.equal(itemFacts({ slot: 'tool', damageType: null, tier: 1, level: 0 }), 'Tool · Tier 1 · Lv 0')
  assert.equal(holderText('Search filters'), 'Held by Search filters')
  assert.equal(holderText(null), 'Free: the next arrival takes it')
  assert.equal(holderText(''), 'In use')
})

test('a retiree shows its class, level and main skill', async () => {
  const { retireeFacts } = await import('./labels.js')
  const retiree = { class: 'magical', level: 10, mainSkill: 'command' }
  assert.equal(retireeFacts(retiree), 'Mage · Lv 10 · mostly Command')
  assert.equal(retireeFacts({ class: 'defense', level: 2, mainSkill: null }), 'Guardian · Lv 2')
})

test('each work skill says what grows it and what it strengthens, Engineering with its factor', async () => {
  const { skillEffect } = await import('./labels.js')
  assert.match(skillEffect('forge', '×1.00'), /write code.*physical attacks/)
  assert.match(skillEffect('arcana', '×1.00'), /magical attacks/)
  assert.match(skillEffect('engineering', '×1.11'), /attack speed, now ×1\.11/)
  assert.match(skillEffect('fishing', '×1.00'), /gather fish/)
})

test('stars are drawn one by one, and counted past five', async () => {
  const { starsLabel } = await import('./labels.js')
  assert.deepEqual(starsLabel(0), { short: '', full: '' })
  assert.deepEqual(starsLabel(2), { short: '★★', full: '2 stars' })
  assert.equal(starsLabel(7).short, '★×7')
})

test('the prestige question says what is kept', async () => {
  const { prestigeQuestion } = await import('./labels.js')
  const question = prestigeQuestion({ id: 'forge', stars: 1, effectiveLevel: 198 })
  assert.match(question, /level 1/)
  assert.match(question, /2 stars in all/)
  assert.match(question, /effective level stays 198/)
})

test('a paused party says why in a few words, and its reason in full', () => {
  assert.equal(partyLabel('waiting'), 'Waits for you')
  assert.equal(partyLabel('blocked'), 'Agent blocked')
  assert.match(partyReason('blocked'), /blocked/)
  assert.match(partyReason('waiting'), /waiting for you/)
})

test('with no monster the band says what the party does instead of a missing foe', () => {
  assert.equal(noMonsterLabel('idle'), 'Party idle, gathering')
  assert.equal(noMonsterLabel('starting'), 'A foe approaches')
  assert.equal(noMonsterLabel('waiting'), 'Fight on hold')
  assert.equal(noMonsterLabel('blocked'), 'Fight on hold')
  for (const party of ['idle', 'starting', 'waiting', 'blocked', 'fighting', 'resting']) {
    assert.notEqual(partyLabel(party), 'Paused')
    assert.ok(partyLabel(party))
  }
})

test('a chest slot says its item, slot, tier, level and holder, and when it can be upgraded', async () => {
  const { itemSlotLabel } = await import('./labels.js')
  const wand = { name: 'Ashwood Wand', slot: 'weapon', damageType: 'magical', tier: 2, level: 3 }
  const facts = 'Ashwood Wand: Weapon, magical, Tier 2, +3'
  assert.equal(itemSlotLabel(wand, 'Search filters', false), `${facts}, held by Search filters`)
  assert.equal(itemSlotLabel(wand, null, true), `${facts}, free. Can upgrade now`)
  assert.equal(itemSlotLabel(wand, '', false), `${facts}, in use`)
})

test("a character's slot names the slot and its item, or says it is empty", async () => {
  const { equipmentSlotLabel } = await import('./labels.js')
  const jerkin = { name: 'Padded Jerkin', tier: 1, level: 0 }
  assert.equal(equipmentSlotLabel('outfit', jerkin), 'Outfit: Padded Jerkin, Tier 1, +0')
  assert.equal(equipmentSlotLabel('tool', null), 'Tool: nothing')
})

test('what an item adds is said for its slot', async () => {
  const { itemEffectText } = await import('./labels.js')
  assert.equal(itemEffectText('weapon', '×1.10'), '×1.10 to hits')
  assert.equal(itemEffectText('tool', '×1.21'), '×1.21 to gathering')
})

test('a material tile says its amount, and how short the prices on screen are of it', async () => {
  const { materialTileLabel } = await import('./labels.js')
  assert.equal(materialTileLabel('bars', '60', null), 'Bars 60')
  const short = { prices: 1, mostText: '130' }
  assert.equal(materialTileLabel('bars', '60', short), 'Bars 60, short: a price needs 130 more')
  assert.equal(
    materialTileLabel('logs', '12 k', { prices: 2, mostText: '4,000' }),
    'Logs 12 k, short: 2 prices need up to 4,000 more'
  )
})

test('a room left behind is described by its items and retirees, and the question names both rooms', () => {
  const orphan = { roomId: 'local:/work/fuzzy-anvil', name: 'fuzzy-anvil', chestSize: 1, retiredCount: 7 }
  assert.equal(ARSENAL.orphanFacts(orphan), '1 item · 7 retirees')
  assert.match(ARSENAL.moveQuestion(orphan, 'cosmic-llama'), /from fuzzy-anvil into cosmic-llama\?/)
})

test('every game tab has a name and an icon', () => {
  for (const tab of GAME_TABS) {
    assert.ok(GAME_TAB_LABEL[tab], tab)
    assert.ok(ICONS[GAME_TAB_ICON[tab]], tab)
  }
})
