import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { indexBestiary } from './bestiary-content.mjs'
import { bestiaryEffects } from './bestiary-effects.mjs'
import { CITY_STANDING } from './city-rank-constants.mjs'
import { cityRankIndexOf } from './city-ranks-content.mjs'
import { normalizeCityRanks } from './city-ranks-save.mjs'
import { cityRankEffects } from './city-ranks.mjs'
import { LEGENDARY_EFFECT_CAPS } from './constants.mjs'
import { createEngine } from './engine.mjs'
import { legendaryIndexOf } from './legendary-effects.mjs'
import { indexSettlement } from './settlement-content.mjs'
import { settlementEffects } from './settlement-effects.mjs'
import { worldEffectsOf } from './world-effects.mjs'
import { emptySave, migrate } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('monsters.json'),
  items: readJson('items.json'),
  cities: readJson('cities.json'),
  legendary: readJson('legendary.json'),
  bosses: readJson('bosses.json'),
  bestiary: readJson('bestiary.json'),
  settlement: readJson('settlement.json')
}
const engine = createEngine({ content })
const index = cityRankIndexOf(content)
const allAtTop = Object.fromEntries(content.cities.cities.map((city) => [city.id, { rank: 5, standing: 1e6 }]))

/** A save with one room, its world holding these city ranks. */
function savedWith(cityRanks) {
  const save = engine.applyTokens(emptySave(), { projectId: 'rumble-banana', sessionId: 's1', tokens: 1_000, activity: 'write', now: 0 })
  return { ...save, worlds: { main: { ...save.worlds.main, ...(cityRanks === undefined ? {} : { cityRanks }) } } }
}

test('a save from before city ranks loads with every city at rank I and keeps everything else', () => {
  const old = savedWith(undefined)
  const checked = engine.cleanSave(old)
  assert.ok(checked.ok)
  assert.equal(checked.save.worlds.main.cityRanks, undefined)
  assert.equal(migrate(old).worlds.main.cityRanks, undefined)
  assert.deepEqual(engine.view(old).worlds[0].market.cities[0].rank.rank, 1)
})

test('ranks and standing survive the save check and migrate, and odd entries are repaired or refused', () => {
  const ranked = savedWith({ goldmill: { rank: 3, standing: 12_345.5 } })
  assert.deepEqual(engine.cleanSave(ranked).save.worlds.main.cityRanks, { goldmill: { rank: 3, standing: 12_345.5 } })
  assert.deepEqual(migrate(ranked).worlds.main.cityRanks, { goldmill: { rank: 3, standing: 12_345.5 } })
  const refused = (cityRanks) => engine.cleanSave(savedWith(cityRanks))
  assert.match(refused({ atlantis: { rank: 2, standing: 0 } }).problem, /not a city with ranks/)
  assert.match(refused({ goldmill: { rank: 6, standing: 0 } }).problem, /rank from 1 to 5/)
  assert.match(refused({ goldmill: { rank: 2.5, standing: 0 } }).problem, /rank/)
  assert.match(refused({ goldmill: { rank: 2, standing: -1 } }).problem, /standing/)
  assert.match(refused({ goldmill: { rank: 2, standing: 0, extra: 1 } }).problem, /rank and a standing/)
  assert.equal(refused(JSON.parse('{"__proto__": { "rank": 2, "standing": 0 }}')).ok, false)
  assert.match(refused([]).problem, /not an object/)
  assert.deepEqual(normalizeCityRanks({ goldmill: { rank: 9, standing: 0 }, deepforge: { rank: 2, standing: 5 } }),
    { deepforge: { rank: 2, standing: 5 } })
  assert.equal(normalizeCityRanks({ goldmill: 'II' }), null)
  assert.equal(normalizeCityRanks(undefined), null)
})

test('a file may keep the stall\'s ranked offers as sold, and no index past them', () => {
  const save = savedWith(undefined)
  const sold = (offers) => ({ ...save, worlds: { main: { ...save.worlds.main, market: { clock: 0, pressure: {}, sold: { goldmill: { day: 0, offers } } } } } })
  assert.ok(engine.cleanSave(sold([0, 3, 4, 5])).ok)
  assert.equal(engine.cleanSave(sold([6])).ok, false)
})

test('with every city at rank V, the world\'s effects carry every perk, all within the caps', () => {
  const effects = worldEffectsOf({ cityRanks: allAtTop }, content)
  assert.equal(effects.length, content.cities.cities.length * 4)
  assert.equal(worldEffectsOf({ cityRanks: allAtTop }, content).length, effects.length)
  const world = { cityRanks: allAtTop }
})

test('every city at rank V, a whole settlement, the strongest relic, all legendary equipment and a whole bestiary stay within every cap', () => {
  const legendary = legendaryIndexOf(content)
  const bestiaryIndex = indexBestiary(content.bestiary, content.bosses)
  const bestiary = bestiaryEffects({
    races: Object.fromEntries(bestiaryIndex.raceIds.map((raceId) => [raceId, [1e9, 0, 0, 0, 0, 0, 20_000]])),
    bosses: Object.fromEntries(content.bosses.bosses.map((boss) => [boss.id, [1, 0, 20_000]]))
  }, bestiaryIndex)
  const top = { upgrades: { campfire: 1e9, workbench: 1e9, runeCircle: 1e9, storehouse: 1e9, defences: 1e9 } }
  const settlement = settlementEffects(top, indexSettlement(content.settlement))
  const perks = cityRankEffects({ cityRanks: allAtTop }, index)
  const amountOf = (effects, type) => effects.filter((effect) => effect.effect === type).reduce((sum, effect) => sum + effect.amount, 0)
  for (const type of new Set(perks.map((effect) => effect.effect))) {
    const entries = [...legendary.byId.values()].filter((entry) => entry.effect.effect === type)
    const relic = Math.max(0, ...entries.filter((entry) => entry.kind !== 'equipment').map((entry) => entry.effect.amount))
    const held = entries.filter((entry) => entry.kind === 'equipment').reduce((sum, entry) => sum + entry.effect.amount, 0)
    const sum = relic + held + amountOf(bestiary, type) + amountOf(settlement, type) + amountOf(perks, type)
    assert.ok(sum <= LEGENDARY_EFFECT_CAPS[type] + 1e-9, `${type}: ${sum} is over ${LEGENDARY_EFFECT_CAPS[type]}`)
  }
})

test('the view gives an open city its rank, banner, fee, charter and what the next rank gives', () => {
  const view = engine.view(savedWith({ goldmill: { rank: 2, standing: CITY_STANDING[2] } }))
  const goldmill = view.worlds[0].market.cities.find((city) => city.id === 'goldmill')
  assert.equal(goldmill.banner, 'ui/cities/goldmill-2.png')
  assert.equal(goldmill.rank.title, 'Town')
  assert.equal(goldmill.fee, goldmill.rank.fee)
  assert.equal(goldmill.rank.perks.length, 1)
  assert.equal(goldmill.rank.next.rank, 3)
  assert.equal(goldmill.rank.next.charter.name, index.byCity.get('goldmill').charters[1].name)
  assert.equal(goldmill.rank.next.tierBonus, true)
  assert.ok(['coins', 'materials', null].includes(goldmill.rank.next.block))
  assert.equal(goldmill.stall.length, 4, 'rank II offers one more piece')
  const runespire = view.worlds[0].market.cities.find((city) => city.id === 'runespire')
  assert.equal(runespire.open, false)
  assert.equal(runespire.rank, undefined, 'a closed city shows no rank')
  assert.equal(runespire.banner, 'ui/cities/runespire.png')
  const top = engine.view(savedWith({ goldmill: { rank: 5, standing: 1 } })).worlds[0].market.cities[0].rank
  assert.equal(top.next, null)
  assert.equal(top.legendary.length, 2)
  assert.ok(top.legendary.every((entry) => entry.name !== entry.id))
})
