import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bestiaryModel } from './bestiary-model.js'

const look = { rig: 'humanoid-medium', parts: {}, colours: {} }
const content = {
  races: [
    { id: 'goblin', name: 'Goblins', thresholds: [10, 40, 150], look },
    { id: 'orc', name: 'Orcs', thresholds: [10, 40, 150], look },
    { id: 'slime', name: 'Slimes', thresholds: [10, 40, 150], look }
  ],
  bosses: [
    { id: 'skrix', name: 'Skrix', epithet: 'the Lantern Thief', race: 'goblin', look, item: 'pilfered-lantern' },
    { id: 'morvash', name: 'Morvash', epithet: 'the Bog Tyrant', race: 'troll', look, item: null },
    { id: 'gorrath', name: 'Gorrath', epithet: 'the Labyrinth Lord', race: 'minotaur', look, item: 'labyrinth-cleaver' }
  ]
}
const raceDamage = (amount, race) => ({ effect: 'raceDamage', scope: 'world', amount, races: [race] })
const perk = { effect: 'killMaterials', scope: 'world', amount: 0.01 }
const world = {
  id: 'main',
  bestiary: {
    discovered: 2, raceCount: 3, beaten: 1, bossCount: 3,
    hunter: { count: 1, level: 0, maxLevel: 2, from: 0, to: 2, now: [], next: [{ effect: 'legendaryPity', scope: 'world', amount: 0.25 }] },
    bonuses: [raceDamage(0.015, 'orc'), raceDamage(0.03, 'slime'), perk],
    races: [
      { id: 'goblin', discovered: false, kills: 0, level: 0, maxLevel: 3, from: 0, to: 10 },
      { id: 'orc', discovered: true, kills: 12, ranks: [10, 1, 1, 0, 0, 0], eliteKills: 1, firstDay: 20_457,
        level: 1, maxLevel: 3, from: 10, to: 40, now: [raceDamage(0.015, 'orc')], next: [raceDamage(0.03, 'orc'), perk] },
      { id: 'slime', discovered: true, kills: 45, ranks: [45, 0, 0, 0, 0, 0], eliteKills: 0, firstDay: 20_450,
        level: 2, maxLevel: 3, from: 40, to: 150, now: [raceDamage(0.03, 'slime'), perk], next: [raceDamage(0.045, 'slime'), perk] }
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

test('the header counts what the world discovered and beat', () => {
  const model = bestiaryModel(game, world)
  assert.equal(model.racesText, '2 of 3 races')
  assert.equal(model.bossesText, '1 of 3 bosses')
  assert.equal(model.hunter.levelText, 'Level 0 of 2')
  assert.equal(model.hunter.progressText, '1 of 2 bosses')
  assert.equal(model.hunter.share, 0.5)
  assert.deepEqual(model.hunter.next.lines, ['+25% to the extra legendary chance each boss without a drop adds'])
})

test('the world\'s bonuses read as a short list: race damage summed up in one line', () => {
  assert.deepEqual(bestiaryModel(game, world).bonuses, [
    '+1.5% to +3% damage against 2 races mastered',
    'Kills give 1% more materials'
  ])
})

test('creatures come discovered first, the most killed first, unknown ones last', () => {
  assert.deepEqual(bestiaryModel(game, world).creatures.map((card) => card.id), ['slime', 'orc', 'goblin'])
})

test('an unknown race is a silhouette named ???, with no bonus and no details', () => {
  const goblin = bestiaryModel(game, world).creatures.find((card) => card.id === 'goblin')
  assert.deepEqual([goblin.discovered, goblin.name, goblin.bonusText, goblin.details], [false, '???', '', null])
  assert.equal(goblin.look, look)
  assert.deepEqual(goblin.pips, [false, false, false])
})

test('a known race shows its kills, pips, progress to the next threshold and bonuses now and next', () => {
  const orc = bestiaryModel(game, world).creatures.find((card) => card.id === 'orc')
  assert.equal(orc.killsText, '12 kills')
  assert.deepEqual(orc.pips, [true, false, false])
  assert.equal(orc.progressText, '12 / 40 kills')
  assert.ok(Math.abs(orc.share - 2 / 30) < 1e-9)
  assert.equal(orc.bonusText, '+1.5% damage · next +3%')
  assert.equal(orc.label, 'Orcs: 12 kills, mastery 1 of 3')
  assert.deepEqual(orc.details.now, ['+1.5% damage against orcs'])
  assert.deepEqual(orc.details.next, { at: 'At 40 kills', lines: ['+3% damage against orcs', 'Kills give 1% more materials'] })
  assert.deepEqual(orc.details.ranks.slice(0, 3).map((rank) => [rank.name, rank.count]), [['Plain', 10], ['Veteran', 1], ['Elite', 1]])
  assert.match(orc.details.firstKill, /^First kill: /)
})

test('bosses show their name once beaten, their wins and their item\'s hint', () => {
  const [skrix, ...others] = bestiaryModel(game, world).bosses
  assert.deepEqual([skrix.name, skrix.epithet, skrix.beatenText, skrix.legendary], ['Skrix', 'the Lantern Thief', '×2', 1])
  assert.deepEqual(skrix.item, { id: 'pilfered-lantern', found: true, name: 'Pilfered Lantern' })
  assert.match(skrix.label, /beaten 2 times\. 1 as legendary\. Its legendary item, Pilfered Lantern, has been found/)
  const gorrath = others.find((card) => card.id === 'gorrath')
  assert.deepEqual([gorrath.name, gorrath.item.found], ['???', false])
  assert.match(gorrath.label, /guards a legendary item not found yet/)
  assert.equal(others.find((card) => card.id === 'morvash').item, null)
})

test('the others are a line of their own, and a world without a bestiary has no model', () => {
  assert.equal(bestiaryModel(game, world).others, 'Others, the rooms\' own creatures: 7 kills')
  assert.equal(bestiaryModel({}, world), null)
  assert.equal(bestiaryModel(game, { id: 'main' }), null)
})
