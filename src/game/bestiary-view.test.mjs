import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { bestiaryContentView, mergedEffects, worldBestiaryView } from './bestiary-view.mjs'
import { emptyProject } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = {
  items: readJson('items.json'),
  races: readJson('races.json'),
  bosses: readJson('bosses.json'),
  legendary: readJson('legendary.json'),
  bestiary: readJson('bestiary.json')
}
const world = (bestiary, projects = {}) => ({ skills: {}, materials: {}, upgrades: {}, projects, ...(bestiary ? { bestiary } : {}) })

test('each race has a portrait of its own race, the same every time, and never a chimera', () => {
  const view = bestiaryContentView(content)
  const again = bestiaryContentView({ ...content })
  assert.deepEqual(view.races.map((race) => race.look), again.races.map((race) => race.look))
  const orc = view.races.find((race) => race.id === 'orc')
  const ownHeads = content.races.races.find((race) => race.id === 'orc').parts.head
  assert.ok(ownHeads.includes(orc.look.parts.head))
  assert.equal(orc.name, 'Orcs')
})

test('each boss has its fixed look, its epithet and its legendary item when it owns one', () => {
  const view = bestiaryContentView(content)
  const skrix = view.bosses.find((boss) => boss.id === 'skrix')
  assert.equal(skrix.epithet, 'the Lantern Thief')
  assert.equal(skrix.look.parts.held, 'torch')
  assert.equal(skrix.item, 'pilfered-lantern')
  assert.equal(view.bosses.filter((boss) => boss.item).length, 24)
})

test('content without a bestiary shows none', () => {
  const { bestiary: _bestiary, ...rest } = content
  assert.equal(bestiaryContentView(rest), null)
  assert.equal(worldBestiaryView(world(), rest), null)
})

test('a world that never killed has every race and boss undiscovered and no bonus', () => {
  const view = worldBestiaryView(world(), content)
  assert.deepEqual([view.discovered, view.raceCount, view.beaten, view.bossCount], [0, 20, 0, 55])
  assert.deepEqual(view.races[0], { id: 'goblin', discovered: false, kills: 0, level: 0, maxLevel: 5, from: 0, to: 10 })
  assert.deepEqual(view.bonuses, [])
  assert.equal(view.others, null)
  assert.deepEqual([view.hunter.level, view.hunter.count, view.hunter.to], [0, 0, 5])
})

test('a race shows its kills by rank, its level, the thresholds around it and its bonuses now and next', () => {
  const view = worldBestiaryView(world({ races: { goblin: [200, 5, 4, 1, 1, 0, 20_400] }, bosses: {} }), content)
  const goblin = view.races.find((race) => race.id === 'goblin')
  assert.deepEqual([goblin.kills, goblin.eliteKills, goblin.firstDay, goblin.level, goblin.from, goblin.to], [211, 6, 20_400, 3, 200, 800])
  assert.deepEqual(goblin.ranks, [200, 5, 4, 1, 1, 0])
  assert.deepEqual(goblin.now.map((effect) => effect.effect), ['raceDamage', 'itemDrop'])
  assert.deepEqual(goblin.next.map((effect) => [effect.effect, effect.amount]), [['raceDamage', 0.04], ['itemDrop', 0.02]])
})

test('a race at its top level has no next threshold or bonus', () => {
  const view = worldBestiaryView(world({ races: { slime: [3000, 0, 0, 0, 0, 0, 1] }, bosses: {} }), content)
  const slime = view.races.find((race) => race.id === 'slime')
  assert.deepEqual([slime.level, slime.to, slime.next], [5, null, null])
})

test('a boss shows its wins, and whether a room of the world found its item', () => {
  const project = { ...emptyProject(), legendary: { relics: ['pilfered-lantern'], active: 'pilfered-lantern', relicPity: 0, bossPity: 0 } }
  const view = worldBestiaryView(world({ races: {}, bosses: { skrix: [3, 1, 20_000] } }, { room: project }), content)
  const skrix = view.bosses.find((boss) => boss.id === 'skrix')
  assert.deepEqual(skrix, { id: 'skrix', discovered: true, beaten: 3, legendary: 1, firstDay: 20_000, item: 'pilfered-lantern', found: true })
  const unbeaten = view.bosses.find((boss) => boss.id === 'gorrath')
  assert.deepEqual([unbeaten.discovered, unbeaten.item, unbeaten.found], [false, 'labyrinth-cleaver', false])
})

test('the hunter counts distinct bosses and the world\'s bonuses add up by kind', () => {
  const bosses = Object.fromEntries(content.bosses.bosses.slice(0, 15).map((boss) => [boss.id, [2, 0, 1]]))
  const races = { orc: [40, 0, 0, 0, 0, 0, 1], goblin: [10, 0, 0, 0, 0, 0, 1] }
  const view = worldBestiaryView(world({ races, bosses, others: [3, 0, 0, 0, 0, 0, 5] }), content)
  assert.deepEqual([view.hunter.count, view.hunter.level, view.hunter.from, view.hunter.to], [15, 2, 15, 30])
  assert.deepEqual(view.bonuses.map((effect) => effect.effect).sort(),
    ['damage', 'legendaryPity', 'raceDamage', 'raceDamage'])
  assert.deepEqual(view.others, { kills: 3, firstDay: 5 })
})

test('effects of the same kind add into one; different qualifiers stay apart', () => {
  const merged = mergedEffects([
    { effect: 'itemDrop', scope: 'world', amount: 0.02 },
    { effect: 'raceDamage', scope: 'world', amount: 0.015, races: ['orc'] },
    { effect: 'itemDrop', scope: 'world', amount: 0.01 },
    { effect: 'raceDamage', scope: 'world', amount: 0.03, races: ['goblin'] }
  ])
  assert.equal(merged.length, 3)
  assert.ok(Math.abs(merged[0].amount - 0.03) < 1e-12)
})
