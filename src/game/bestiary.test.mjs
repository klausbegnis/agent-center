import assert from 'node:assert/strict'
import { test } from 'node:test'
import { indexBestiary } from './bestiary-content.mjs'
import {
  distinctBossesOf,
  eliteKillsOf,
  gameDayOf,
  hunterLevelOf,
  hunterRankOf,
  killsOf,
  levelFor,
  masteryOf,
  normalizeBestiary,
  noteKill,
  pointsOf,
  totalPointsOf
} from './bestiary.mjs'

const bosses = { bosses: [{ id: 'skrix' }, { id: 'gorrath' }, { id: 'morvash' }] }
const index = indexBestiary({
  points: { normal: 1, veteran: 2, elite: 5, champion: 10, boss: 25, legendary: 60 },
  mastery: { levels: 3, firstCost: 2, growth: 2, perLevel: { effect: 'raceDamage', scope: 'world', amount: 0.01 }, perkEvery: 3 },
  races: [
    { id: 'goblin', name: 'Goblins', title: 'Goblin-bane', perk: { effect: 'itemDrop', scope: 'world', amount: 0.02 } },
    { id: 'slime', name: 'Slimes', title: 'Slime-scourer', perk: { effect: 'killMaterials', scope: 'world', amount: 0.01 } }
  ],
  rank: { firstCost: 10, growth: 2, half: 5, effect: { effect: 'killMaterials', scope: 'world', amount: 0.02 } },
  hunter: { thresholds: [1, 2], levels: [[{ effect: 'legendaryPity', scope: 'world', amount: 0.1 }], [{ effect: 'legendaryPity', scope: 'world', amount: 0.25 }]] }
}, bosses)
// Goblin levels need 2, 6, 14, 30, 62... points; hunter ranks 10, 30, 70...

const goblin = (rank = 'normal') => ({ id: 'goblin', race: 'goblin', kind: 'common', rank })
const boss = (id, rank = 'boss') => ({ id, race: 'goblin', kind: 'boss', rank })
const handmade = (rank = 'normal') => ({ id: 'pantry-rat-pack', kind: 'common', rank, sprite: { body: 'swarm' } })

/** Notes kills one after another and gathers the news. */
function noteAll(monsters, day = 20_000, start = null) {
  let bestiary = start
  const news = []
  for (const monster of monsters) {
    const noted = noteKill(bestiary, monster, { day, index })
    bestiary = noted.bestiary
    news.push(...noted.news)
  }
  return { bestiary, news }
}
const repeat = (count, make) => Array.from({ length: count }, make)

test('a kill counts for its race under its rank, with the day of the first kill', () => {
  const { bestiary } = noteAll([goblin(), goblin('elite'), goblin('champion')], 20_100)
  assert.deepEqual(bestiary.races.goblin, [1, 0, 1, 1, 0, 0, 20_100])
  assert.equal(killsOf(bestiary.races.goblin), 3)
  assert.equal(eliteKillsOf(bestiary.races.goblin), 2)
})

test('a kill is worth points by its rank', () => {
  const { bestiary } = noteAll([goblin(), goblin('veteran'), goblin('elite'), goblin('champion'), boss('skrix'), boss('skrix', 'legendary')])
  assert.equal(pointsOf(bestiary.races.goblin, index), 1 + 2 + 5 + 10 + 25 + 60)
})

test('a later kill keeps the day of the first', () => {
  const first = noteAll([goblin()], 20_000)
  const later = noteAll([goblin()], 20_050, first.bestiary)
  assert.equal(later.bestiary.races.goblin[6], 20_000)
})

test('a hand-made monster counts under the others, and is no race discovered', () => {
  const { bestiary, news } = noteAll([handmade(), handmade('veteran')])
  assert.deepEqual(bestiary.others, [1, 1, 0, 0, 0, 0, 20_000])
  assert.deepEqual(bestiary.races, {})
  assert.deepEqual(news, [])
})

test('a boss of the roster counts for its race and as beaten, legendary wins apart', () => {
  const { bestiary } = noteAll([boss('skrix'), boss('skrix', 'legendary')])
  assert.deepEqual(bestiary.bosses.skrix, [2, 1, 20_000])
  assert.deepEqual(bestiary.races.goblin.slice(4, 6), [1, 1])
})

test('a monster that is not a boss wave\'s boss never counts as a boss beaten', () => {
  const { bestiary } = noteAll([{ ...boss('skrix'), rank: 'elite' }])
  assert.deepEqual(bestiary.bosses, {})
})

test('the first kill of a race and of a boss is news, the next ones are not', () => {
  const { news } = noteAll([goblin(), goblin('veteran'), boss('gorrath'), boss('gorrath')])
  assert.deepEqual(news.filter((item) => item.discovered), [
    { kind: 'race', id: 'goblin', discovered: true },
    { kind: 'boss', id: 'gorrath', discovered: true }
  ])
})

test('the first level comes with the second plain kill, and each new level is news', () => {
  const { bestiary, news } = noteAll(repeat(6, () => goblin()))
  assert.deepEqual(news.filter((item) => item.kind === 'race' && item.level).map((item) => item.level), [1, 2])
  assert.equal(masteryOf(bestiary, 'goblin', index), 2)
  assert.equal(masteryOf(bestiary, 'slime', index), 0)
})

test('a strong monster is an event: a champion alone lifts a race several levels, told once', () => {
  const { news } = noteAll([goblin('champion')])
  assert.deepEqual(news.filter((item) => item.kind === 'race' && item.level), [{ kind: 'race', id: 'goblin', level: 2 }])
})

test('mastery goes on past the powered levels, with news of every level', () => {
  const { bestiary, news } = noteAll([goblin('legendary'), goblin('legendary')])
  assert.equal(masteryOf(bestiary, 'goblin', index), 5)
  assert.ok(news.some((item) => item.kind === 'race' && item.level === 5))
})

test('the hunter rank counts every point of the bestiary, the others\' too, with news of each rank', () => {
  const { bestiary, news } = noteAll([goblin('champion'), handmade('elite'), goblin('champion'), goblin('champion')])
  assert.equal(totalPointsOf(bestiary, index), 35)
  assert.equal(hunterRankOf(bestiary, index), 2)
  assert.deepEqual(news.filter((item) => item.kind === 'rank'), [{ kind: 'rank', level: 1 }, { kind: 'rank', level: 2 }])
})

test('the boss hunter counts distinct bosses: the first boss already gives a level', () => {
  const again = noteAll([boss('skrix'), boss('skrix'), boss('skrix')])
  assert.equal(distinctBossesOf(again.bestiary, index), 1)
  assert.equal(hunterLevelOf(again.bestiary, index), 1)
  assert.deepEqual(again.news.filter((item) => item.kind === 'hunter'), [{ kind: 'hunter', level: 1 }])
  const two = noteAll([boss('skrix'), boss('morvash')])
  assert.equal(hunterLevelOf(two.bestiary, index), 2)
})

test('without a bestiary in the content nothing is counted', () => {
  assert.deepEqual(noteKill(null, goblin(), { day: 1, index: null }), { bestiary: null, news: [] })
})

test('a level is the number of thresholds a count has reached', () => {
  assert.equal(levelFor(0, [10, 40]), 0)
  assert.equal(levelFor(10, [10, 40]), 1)
  assert.equal(levelFor(1000, [10, 40]), 2)
})

test('the game day changes at midnight UTC', () => {
  assert.equal(gameDayOf(Date.UTC(2026, 0, 5, 23, 59)), gameDayOf(Date.UTC(2026, 0, 5)))
  assert.equal(gameDayOf(Date.UTC(2026, 0, 6)), gameDayOf(Date.UTC(2026, 0, 5)) + 1)
})

test('migrating keeps counters the engine writes and the back-fill mark, and drops the others', () => {
  const stored = {
    races: { goblin: [3, 0, 1, 0, 0, 0, 20_000], slime: [0, 0, 0, 0, 0, 0, 20_000], orc: [1, 2] },
    bosses: { skrix: [2, 1, 20_001], gorrath: [1, 2, 20_002], morvash: [0, 0, 1] },
    others: 'many',
    filled: 12
  }
  assert.deepEqual(normalizeBestiary(stored),
    { races: { goblin: [3, 0, 1, 0, 0, 0, 20_000] }, bosses: { skrix: [2, 1, 20_001] }, filled: 12 })
  assert.equal(normalizeBestiary(undefined), null)
  assert.equal(normalizeBestiary({ races: {}, bosses: {} }), null)
  assert.deepEqual(normalizeBestiary({ races: {}, bosses: {}, filled: 0 }), { races: {}, bosses: {}, filled: 0 })
  assert.equal(normalizeBestiary({ races: {}, bosses: {}, filled: -1 }), null)
})
