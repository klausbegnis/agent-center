import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canChooseTrades,
  characterTradeOptions,
  choiceOf,
  NO_CHOICE,
  pickerValue,
  roomTradeOptions,
  TRADES
} from './trade-model.js'

const BOTH = { setCharacterTrade: async () => true, setRoomTrade: async () => true }

test('the room\'s picker offers Auto, then the six trades by name', () => {
  assert.deepEqual(roomTradeOptions(), [
    [NO_CHOICE, 'Auto: each their own'],
    ['mining', 'Mining'], ['fishing', 'Fishing'], ['farming', 'Farming'],
    ['woodcutting', 'Woodcutting'], ['hunting', 'Hunting'], ['runecraft', 'Runecraft']
  ])
})

test('a character\'s "no choice" names the trade it falls back to: the room\'s, else the game\'s pick', () => {
  assert.deepEqual(characterTradeOptions({ autoTrade: 'mining' }, null)[0], [NO_CHOICE, 'Auto: Mining'])
  assert.deepEqual(characterTradeOptions({ autoTrade: 'mining' }, 'fishing')[0], [NO_CHOICE, 'Room\'s: Fishing'])
  assert.deepEqual(characterTradeOptions({ autoTrade: null }, 'gold')[0], [NO_CHOICE, 'Auto'])
  assert.equal(characterTradeOptions({ autoTrade: 'mining' }, null).length, TRADES.length + 1)
})

test('a picker shows a trade as itself and no choice as the empty value, and sends them back the same way', () => {
  assert.equal(pickerValue('hunting'), 'hunting')
  assert.equal(pickerValue(null), NO_CHOICE)
  assert.equal(pickerValue('forge'), NO_CHOICE)
  assert.equal(choiceOf('hunting'), 'hunting')
  assert.equal(choiceOf(NO_CHOICE), null)
  assert.equal(choiceOf('__proto__'), null)
})

test('the pickers are offered only where both choices can be sent and the page is not view only', () => {
  assert.equal(canChooseTrades({ status: 'running' }, BOTH), true)
  assert.equal(canChooseTrades({ status: 'running', viewOnly: true }, BOTH), false)
  assert.equal(canChooseTrades({ status: 'running' }, { setRoomTrade: BOTH.setRoomTrade }), false)
})
