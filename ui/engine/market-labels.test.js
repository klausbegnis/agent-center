import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatCoins,
  formatPrice,
  offerBlockText,
  offerFacts,
  priceEach,
  sellButton,
  tradeResult
} from './market-labels.js'

test('a unit price keeps two decimals below ten coins and none above', () => {
  assert.equal(formatPrice(5.4), '5.4')
  assert.equal(formatPrice(2), '2')
  assert.equal(formatPrice(0.054), '0.05')
  assert.equal(formatPrice(0.001), 'under 0.01')
  assert.equal(formatPrice(12.7), '12')
})

test('a price says whether it is above or below the city\'s usual with a sign, not colour alone', () => {
  assert.equal(priceEach(5.4, 'up'), '5.4 each ▲')
  assert.equal(priceEach(5.4, 'down'), '5.4 each ▼')
  assert.equal(priceEach(5.4, 'usual'), '5.4 each')
})

test('coins are counted to the coin until they are many', () => {
  assert.equal(formatCoins(70_710), '70,710')
  assert.equal(formatCoins(2.5e9), '2.5 B')
})

test('the Sell button names the total, and a trade what it gives', () => {
  assert.equal(sellButton(1234), 'Sell for 1,234 coins')
  assert.equal(sellButton(0), 'Sell')
  assert.equal(tradeResult({ units: 151, change: 3 }, 'ore'), '→ 151 Ore, 3 coins back')
  assert.equal(tradeResult({ units: 151, change: 0 }, 'ore'), '→ 151 Ore')
  assert.equal(tradeResult({ units: 0, change: 0 }, 'ore'), 'Too little to get one unit.')
})

test('a stall piece reads its facts and why it cannot be bought', () => {
  assert.equal(offerFacts({ tier: 3, slot: 'weapon', damageType: 'magical', power: 4 }), 'Tier 3 · Weapon, magical · gear level 4')
  assert.equal(offerBlockText('coins', { price: 1500, coins: 400 }), 'Needs 1,100 coins more.')
  assert.equal(offerBlockText('sold', { price: 1, coins: 0 }), 'Sold today.')
  assert.equal(offerBlockText(null, { price: 1, coins: 9 }), '')
})
