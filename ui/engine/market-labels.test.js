import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatCoins,
  formatPrice,
  offerBlockText,
  offerFacts,
  ofHeld,
  priceEach,
  rateText,
  sellButton,
  tradeButton,
  tradeWhy
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

test('the Sell and Trade buttons state the whole deal, and say only the action with no deal', () => {
  assert.equal(sellButton(300, 708), 'Sell 300 for 708 coins')
  assert.equal(sellButton(1, 1), 'Sell 1 for 1 coin')
  assert.equal(sellButton(0, 0), 'Sell')
  assert.equal(tradeButton({ amount: 555, fromId: 'bars', units: 260, toId: 'crops' }), 'Trade 555 Bars for 260 Crops')
  assert.equal(tradeButton({ amount: 3, fromId: 'bars', units: 0, toId: 'crops' }), 'Trade')
})

test('a trade reads how much of a stock is given, the rate, and why it gives nothing', () => {
  assert.equal(ofHeld(555, 1204, 'bars'), '555 of 1,204 Bars')
  assert.equal(rateText(2.1346, 'crops', 'bars'), '1 Crops per 2.13 Bars')
  assert.equal(rateText(2, 'crops', 'bars'), '1 Crops per 2 Bars')
  assert.equal(rateText(0.7, 'ore', 'crops'), '1.43 Ore per 1 Crops')
  assert.equal(tradeWhy('none', { amount: 0, fromId: 'bars', toId: 'crops' }), 'Choose how many Bars to give.')
  assert.equal(tradeWhy('tooLittle', { amount: 1, fromId: 'bars', toId: 'crops' }), '1 Bars is not enough for one Crops.')
})

test('a stall piece reads its facts and why it cannot be bought', () => {
  assert.equal(offerFacts({ tier: 3, slot: 'weapon', damageType: 'magical', power: 4 }), 'Tier 3 · Weapon, magical · gear level 4')
  assert.equal(offerBlockText('coins', { price: 1500, coins: 400 }), 'Needs 1,100 coins more.')
  assert.equal(offerBlockText('sold', { price: 1, coins: 0 }), 'Sold today.')
  assert.equal(offerBlockText(null, { price: 1, coins: 9 }), '')
})
