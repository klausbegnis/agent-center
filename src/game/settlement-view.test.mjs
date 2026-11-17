import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { settlementView } from './settlement-view.mjs'

const settlement = JSON.parse(readFileSync(new URL('../../game/settlement.json', import.meta.url), 'utf8'))
const content = { settlement }
const last = settlement.stages.at(-1)
const world = (upgrades, extra = {}) => ({ skills: {}, materials: {}, upgrades, coins: 0, ...extra })

test('past the last stage the way forward is the next renovation star', () => {
  const every = settlement.renovation.every
  const shown = settlementView(world({ campfire: last.from + every + 3 }), content)
  assert.equal(shown.stage.id, last.id)
  assert.equal(shown.stars, 1)
  assert.deepEqual([shown.next.kind, shown.next.stars, shown.next.have, shown.next.need], ['star', 2, 3, every])
})

test('every stage is listed with whether it is reached, and a world without the content has no settlement', () => {
  const shown = settlementView(world({ campfire: 1 }), content)
  assert.deepEqual(shown.stages.map((stage) => stage.reached), settlement.stages.map((_, at) => at <= 1))
  assert.equal(settlementView(world({}), {}), null)
})

test('a building is affordable only when open and paid for, and its coin price only with the coins too', () => {
  const tier2 = settlement.buildings[0].tiers[1].from
  const rich = { fish: 1e9, crops: 1e9 }
  const shown = settlementView(world({ campfire: tier2 }, { materials: rich, coins: 0 }), content)
  const hearth = shown.buildings.find((building) => building.id === 'hearth')
  assert.equal(hearth.affordable, true)
  assert.equal(hearth.coinPrice.affordable, false)
  const paid = settlementView(world({ campfire: tier2 }, { materials: rich, coins: 1e12 }), content)
  assert.equal(paid.buildings.find((building) => building.id === 'hearth').coinPrice.affordable, true)
})
