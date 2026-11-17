import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bestiaryModel } from './bestiary-model.js'
import { prestigeTitle, romanNumeral } from './bestiary-labels.js'

const look = { rig: 'humanoid-medium', parts: {}, colours: {} }
const content = {
  races: [
    { id: 'goblin', name: 'Goblins', title: 'Goblin-bane', look },
    { id: 'orc', name: 'Orcs', title: 'Orc-bane', look },
    { id: 'slime', name: 'Slimes', title: 'Slime-scourer', look },
    { id: 'troll', name: 'Trolls', title: 'Troll-bane', look }
  ],
  bosses: [
    { id: 'skrix', name: 'Skrix', epithet: 'the Lantern Thief', race: 'goblin', look, item: 'pilfered-lantern' },
    { id: 'morvash', name: 'Morvash', epithet: 'the Bog Tyrant', race: 'troll', look, item: null },
    { id: 'gorrath', name: 'Gorrath', epithet: 'the Labyrinth Lord', race: 'minotaur', look, item: 'labyrinth-cleaver' }
  ],
  points: { normal: 1, veteran: 2, elite: 5, champion: 10, boss: 25, legendary: 60 },
  levels: 25,
  perkEvery: 5
}
const raceDamage = (amount, race) => ({ effect: 'raceDamage', scope: 'world', amount, races: [race] })
const perk = { effect: 'killMaterials', scope: 'world', amount: 0.004 }
const world = {
  id: 'main',
  bestiary: {
    discovered: 3, raceCount: 4, beaten: 1, bossCount: 3,
    rank: { rank: 3, points: 90, from: 76, to: 115, now: [{ effect: 'killMaterials', scope: 'world', amount: 0.0026 }],
      next: [{ effect: 'killMaterials', scope: 'world', amount: 0.0033 }] },
    hunter: { count: 1, level: 1, maxLevel: 5, from: 1, to: 5, now: [], next: [{ effect: 'legendaryPity', scope: 'world', amount: 0.15 }] },
    bonuses: [raceDamage(0.008, 'orc'), raceDamage(0.018, 'slime'), perk],
    races: [
      { id: 'goblin', discovered: false, kills: 0, points: 0, level: 0, maxLevel: 25, prestige: 0, from: 0, to: 2 },
      { id: 'orc', discovered: true, kills: 12, points: 17, ranks: [10, 1, 1, 0, 0, 0], eliteKills: 1, firstDay: 20_457,
        level: 4, maxLevel: 25, prestige: 0, from: 13, to: 18, now: [raceDamage(0.008, 'orc')], next: [raceDamage(0.01, 'orc'), perk] },
      { id: 'slime', discovered: true, kills: 45, points: 75, ranks: [45, 0, 0, 3, 0, 0], eliteKills: 3, firstDay: 20_450,
        level: 9, maxLevel: 25, prestige: 0, from: 66, to: 90, now: [raceDamage(0.018, 'slime'), perk], next: [raceDamage(0.02, 'slime'), perk] },
      { id: 'troll', discovered: true, kills: 3, points: 3, ranks: [3, 0, 0, 0, 0, 0], eliteKills: 0, firstDay: 20_460,
        level: 1, maxLevel: 25, prestige: 0, from: 2, to: 5, now: [raceDamage(0.002, 'troll')], next: [raceDamage(0.004, 'troll')] }
    ],
    bosses: [
      { id: 'skrix', discovered: true, beaten: 2, legendary: 1, firstDay: 20_451, item: 'pilfered-lantern', found: true },
      { id: 'morvash', discovered: false, beaten: 0, legendary: 0, item: null, found: false },
      { id: 'gorrath', discovered: false, beaten: 0, legendary: 0, item: 'labyrinth-cleaver', found: false }
    ],
    others: { kills: 7, firstDay: 20_450 }
  }
}
const game = { bestiary: content, legendary: { entries: { 'pilfered-lantern': { name: 'Pilfered Lantern' } } } }
const card = (id, options) => bestiaryModel(game, world, options).creatures.find((entry) => entry.id === id)

test('the header counts what the world discovered and beat, and shows its hunter rank', () => {
  const model = bestiaryModel(game, world)
  assert.equal(model.racesText, '3 of 4 races')
  assert.equal(model.bossesText, '1 of 3 bosses')
  assert.equal(model.rank.rankText, 'Rank 3')
  assert.equal(model.rank.progressText, '90 / 115 points')
  assert.ok(Math.abs(model.rank.share - 14 / 39) < 1e-9)
  assert.deepEqual(model.rank.now, ['Kills give 0.3% more materials'])
  assert.equal(model.hunter.levelText, 'Level 1 of 5')
  assert.equal(model.hunter.progressText, '1 of 5 bosses')
})

test('the world\'s bonuses read as a short list: race damage summed up in one line', () => {
  assert.deepEqual(bestiaryModel(game, world).bonuses, [
    '+0.8% to +1.8% damage against 2 races mastered',
    'Kills give 0.4% more materials'
  ])
})

test('creatures come discovered first, the most points first, unknown ones last', () => {
  assert.deepEqual(bestiaryModel(game, world).creatures.map((entry) => entry.id), ['slime', 'orc', 'troll', 'goblin'])
})

test('creatures can come the closest to a new level first', () => {
  assert.deepEqual(bestiaryModel(game, world, { sort: 'next' }).creatures.map((entry) => entry.id), ['orc', 'slime', 'troll', 'goblin'])
})

test('an unknown race is a silhouette named ???, with no level, bonus or details', () => {
  const goblin = card('goblin')
  assert.deepEqual([goblin.discovered, goblin.name, goblin.levelText, goblin.nowText, goblin.details], [false, '???', '', '', null])
  assert.equal(goblin.look, look)
})

test('a known race shows its level, points to the next, and its bonus now and next, always', () => {
  const orc = card('orc')
  assert.equal(orc.levelText, 'Lv 4')
  assert.equal(orc.progressText, '17 / 18 points')
  assert.ok(Math.abs(orc.share - 4 / 5) < 1e-9)
  assert.equal(orc.nowText, '+0.8% damage')
  assert.equal(orc.nextText, 'Next: +1% and a perk')
  assert.equal(card('troll').nextText, 'Next: +0.4%')
  assert.equal(orc.label, 'Orcs: level 4, 17 / 18 points, 12 kills')
  assert.deepEqual(orc.details.now, ['+0.8% damage against orcs'])
  assert.deepEqual(orc.details.next, { at: 'At level 5 (18 points)', lines: ['+1% damage against orcs', 'Kills give 0.4% more materials'] })
  assert.deepEqual(orc.details.ranks.slice(0, 3).map((rank) => [rank.name, rank.count]), [['Plain', 10], ['Veteran', 1], ['Elite', 1]])
  assert.equal(orc.details.ranks[2].title, 'Elite, 5 points each')
})

test('past its last powered level a race carries a title, and its next step is the next title', () => {
  const top = { ...world.bestiary.races[2], level: 27, prestige: 2, points: 10_000, from: 9456, to: 12_400, now: [raceDamage(0.05, 'slime')], next: [] }
  const mastered = { ...world, bestiary: { ...world.bestiary, races: [top] } }
  const slime = bestiaryModel(game, mastered).creatures.find((entry) => entry.id === 'slime')
  assert.equal(slime.title, 'Slime-scourer II')
  assert.equal(slime.nextText, 'Next: Slime-scourer III')
  assert.equal(slime.prestige, 2)
  assert.equal(slime.details.next.at, 'Next: the title Slime-scourer III')
})

test('prestige titles count in Roman numerals from the second rank', () => {
  assert.equal(prestigeTitle('Orc-bane', 1), 'Orc-bane')
  assert.equal(prestigeTitle('Orc-bane', 4), 'Orc-bane IV')
  assert.equal(romanNumeral(1994), 'MCMXCIV')
})

test('bosses show their name once beaten, their wins and their item\'s hint', () => {
  const [skrix, ...others] = bestiaryModel(game, world).bosses
  assert.deepEqual([skrix.name, skrix.epithet, skrix.beatenText, skrix.legendary], ['Skrix', 'the Lantern Thief', '×2', 1])
  assert.deepEqual(skrix.item, { id: 'pilfered-lantern', found: true, name: 'Pilfered Lantern' })
  const gorrath = others.find((entry) => entry.id === 'gorrath')
  assert.deepEqual([gorrath.name, gorrath.item.found], ['???', false])
  assert.equal(others.find((entry) => entry.id === 'morvash').item, null)
})

test('the others are a line of their own, and a world without a bestiary has no model', () => {
  assert.equal(bestiaryModel(game, world).others, 'Others, the rooms\' own creatures: 7 kills')
  assert.equal(bestiaryModel({}, world), null)
  assert.equal(bestiaryModel(game, { id: 'main' }), null)
})
