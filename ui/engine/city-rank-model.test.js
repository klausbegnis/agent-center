import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cityRankModel } from './city-rank-model.js'

const charter = (name, perk, effect) => ({ name, perk, effect })
/** A city as the view state gives it, at rank II on its way to III. */
const city = (rank = {}) => ({
  id: 'goldmill',
  name: 'Goldmill',
  rank: {
    rank: 2,
    max: 5,
    title: 'Town',
    standing: 1_500,
    fee: 0.095,
    perks: [charter("Millers' Charter", "Millers' Bread", { effect: 'gatherHours', scope: 'world', amount: 0.15 })],
    legendary: [{ id: 'blightmoon-sickle', name: 'Blightmoon Sickle' }],
    next: {
      rank: 3,
      title: 'City',
      standing: 3_000,
      coins: 900,
      materials: { ore: 180, bars: 180 },
      charter: charter('Harvest Guild Charter', 'Harvest Lore', { effect: 'gatherXp', scope: 'world', amount: 0.005 }),
      feeCut: 0.005,
      extraOffer: false,
      tierBonus: true,
      relicMoreOften: false,
      legendary: false,
      block: 'standing'
    },
    ...rank
  }
})

test('a city without ranks has no rank card', () => {
  assert.equal(cityRankModel({ id: 'goldmill' }, { coins: 0 }), null)
})

test('the card names the rank, the standing towards the next and why the charter waits', () => {
  const model = cityRankModel(city(), { coins: 5_000 })
  assert.equal(model.heading, 'Rank II · Town')
  assert.equal(model.progress.share, 0.5)
  assert.equal(model.progress.text, '1,500 of 3,000 to rank III')
  assert.equal(model.feeText, 'Fee here: 9.5%')
  assert.match(model.perks[0].text, /^Millers' Bread: Idle characters keep gathering 9 min longer/)
  assert.equal(model.next.heading, 'Next: rank III · City')
  assert.equal(model.next.charter, 'Harvest Guild Charter')
  assert.match(model.next.gains[0], /^Harvest Lore: \+0.5% experience/)
  assert.ok(model.next.gains.includes('The stall sells gear one tier higher'))
  assert.equal(model.next.blockText, 'Trade 1,500 more standing here first')
})

test('with the standing reached, the bar is full and a missing price says what is short', () => {
  const ready = city({ standing: 3_200, next: { ...city().rank.next, block: 'coins' } })
  const model = cityRankModel(ready, { coins: 100 })
  assert.equal(model.progress.share, 1)
  assert.equal(model.progress.text, '3,000 reached: ready for rank III')
  assert.equal(model.next.blockText, '800 coins short')
  assert.equal(cityRankModel(city({ next: { ...city().rank.next, block: null } }), { coins: 1e6 }).next.blockText, '')
})

test('at the last rank the card says so and names the legendary pieces the stall may sell', () => {
  const model = cityRankModel(city({ rank: 5, title: 'Golden age', next: null }), { coins: 0 })
  assert.equal(model.next, null)
  assert.equal(model.progress.share, 1)
  assert.match(model.topText, /Blightmoon Sickle/)
})

test('a city holding its festival says so on its card', () => {
  assert.match(cityRankModel(city({ festival: true }), { coins: 0 }).festivalText, /^Festival this week/)
  assert.equal(cityRankModel(city(), { coins: 0 }).festivalText, '')
})
