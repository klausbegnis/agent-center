import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { indexLegendary, relicsCityCanOffer, validateLegendary } from './legendary-content.mjs'

const readJson = (name) => JSON.parse(fs.readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const shipped = readJson('legendary.json')
const bosses = { bosses: [{ id: 'skrix' }, { id: 'gorrath' }, { id: 'old-mattock' }] }
const items = { items: [{ id: 'whittled-cudgel' }] }

const relic = (extra = {}) => ({
  id: 'tidecall-conch', name: 'Tidecall Conch', kind: 'relic', city: 'brinehaven',
  effect: { effect: 'killMaterials', scope: 'party', amount: 0.06, materials: ['fish'] },
  flavour: 'The harbour tells you where the shoals are.', colour: '#ff9a9a', ...extra
})
const weapon = (extra = {}) => ({
  id: 'labyrinth-cleaver', name: 'Labyrinth Cleaver', kind: 'equipment', boss: 'gorrath', slot: 'weapon',
  damageType: 'physical', class: 'physical', recipe: ['bars', 'hides'],
  effect: { effect: 'damage', scope: 'holder', amount: 0.06 }, flavour: 'He made a few exits.', colour: '#e07a40',
  ...extra
})
const problemsOf = (...entries) => validateLegendary({ legendary: entries }, { bosses, items })

test('the shipped legendary file is valid against the shipped bosses and items', () => {
  assert.deepEqual(validateLegendary(shipped, { bosses: readJson('bosses.json'), items: readJson('items.json') }), [])
})

test('the shipped file holds ten city relics, twelve boss relics and twelve pieces of equipment', () => {
  const count = (kind) => shipped.legendary.filter((entry) => entry.kind === kind).length
  assert.deepEqual([count('relic'), count('boss-relic'), count('equipment')], [10, 12, 12])
})

test('every shipped entry has its picture and its picture with a glow', () => {
  for (const { id } of shipped.legendary) {
    for (const name of [`${id}.png`, `${id}-glow.png`]) {
      assert.ok(fs.existsSync(new URL(`../../ui/art/legendary/${name}`, import.meta.url)), name)
    }
  }
})

test('a valid relic and a valid weapon have no problems', () => {
  assert.deepEqual(problemsOf(relic(), weapon()), [])
})

test('a boss that is not in the roster is reported', () => {
  assert.match(problemsOf(weapon({ boss: 'nobody' }))[0], /must be the id of a boss/)
})

test('a boss can own one item only', () => {
  const second = weapon({ id: 'second-cleaver' })
  assert.match(problemsOf(weapon(), second).join(), /already has an item/)
})

test('an id an item of game/items.json uses is reported', () => {
  assert.match(problemsOf(relic({ id: 'whittled-cudgel' })).join(), /same id/)
})

test('a relic acts on the party and equipment on its holder', () => {
  const holderRelic = relic({ effect: { effect: 'killMaterials', scope: 'holder', amount: 0.06 } })
  assert.match(problemsOf(holderRelic).join(), /scope "party"/)
})

test('an effect type that cannot act in the scope is reported', () => {
  const critRelic = relic({ effect: { effect: 'critChance', scope: 'party', amount: 0.04 } })
  assert.match(problemsOf(critRelic).join(), /cannot act on the party/)
})

test('an amount above the effect type\'s cap is reported', () => {
  const strong = relic({ effect: { effect: 'attackSpeed', scope: 'party', amount: 0.5 } })
  assert.match(problemsOf(strong).join(), /at most 0.08/)
})

test('a qualifier the effect type does not take is reported', () => {
  const odd = relic({ effect: { effect: 'attackSpeed', scope: 'party', amount: 0.03, materials: ['ore'] } })
  assert.match(problemsOf(odd).join(), /not a qualifier of attackSpeed/)
})

test('an unknown effect type is reported', () => {
  assert.match(problemsOf(relic({ effect: { effect: 'flight', scope: 'party', amount: 0.1 } })).join(), /must be one of/)
})

test('a weapon made for a class must have that class\'s damage type', () => {
  assert.match(problemsOf(weapon({ class: 'magical' })).join(), /never holds a physical weapon/)
})

test('a tool names a trade instead of a class', () => {
  const tool = weapon({ id: 'gravewake-mattock', boss: 'old-mattock', slot: 'tool', damageType: undefined, class: 'physical' })
  delete tool.damageType
  const problems = problemsOf(tool).join()
  assert.match(problems, /"trade" must be a gathering skill/)
  assert.match(problems, /any class/)
})

test('a key that belongs to another kind is reported', () => {
  assert.match(problemsOf(relic({ slot: 'weapon' })).join(), /"slot" is not a known key for a relic/)
})

test('the index lists the pool relics in the file\'s order and each boss\'s own item', () => {
  const index = indexLegendary(shipped)
  assert.equal(index.poolRelicIds.length, 10)
  assert.equal(index.poolRelicIds[0], 'sheaf-of-the-long-summer')
  assert.equal(index.byBoss.get('gorrath').id, 'labyrinth-cleaver')
  assert.equal(index.relicCount, 22)
  assert.equal(index.equipmentCount, 12)
})

test('a city offers its own relics that the room does not own, never a boss relic', () => {
  const index = indexLegendary(shipped)
  const offered = relicsCityCanOffer(index, { cityId: 'goldmill', ownedIds: ['millwind-vane'] })
  assert.deepEqual(offered.map((entry) => entry.id), ['sheaf-of-the-long-summer'])
  assert.deepEqual(relicsCityCanOffer(index, { cityId: 'nowhere' }), [])
  assert.deepEqual(relicsCityCanOffer(null, { cityId: 'goldmill' }), [])
})
