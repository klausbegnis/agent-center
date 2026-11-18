import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { indexInstances, instanceIndexOf, validateInstances } from './instance-content.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const others = { races: readJson('races.json'), bosses: readJson('bosses.json'), legendary: readJson('legendary.json') }
const problemsWith = (change) => {
  const data = readJson('instances.json')
  change(data)
  return validateInstances(data, others)
}
const mentions = (problems, text) => assert.ok(problems.some((problem) => problem.includes(text)), problems.join('\n'))

test('the shipped instances are valid, six along the road', () => {
  const data = readJson('instances.json')
  assert.deepEqual(validateInstances(data, others), [])
  assert.equal(data.instances.length, 6)
})

test('every picture the instances name is shipped with the UI', () => {
  const data = readJson('instances.json')
  const pictures = [
    ...data.region.maps.map((map) => map.art),
    ...data.instances.flatMap((entry) => [entry.banner, entry.card, ...(entry.route ? [entry.route.start, entry.route.mid, entry.route.boss] : [])])
  ]
  for (const art of pictures) assert.ok(existsSync(new URL(`../../${art}`, import.meta.url)), art)
})

test('an instance has six rooms in order, a trap or a puzzle third, with a check', () => {
  mentions(problemsWith((data) => data.instances[0].rooms.pop()), 'must list six rooms')
  mentions(problemsWith((data) => { data.instances[0].rooms[1].kind = 'boss' }), 'room 2 must be hall')
  mentions(problemsWith((data) => { delete data.instances[0].rooms[2].check }), '"check" must be')
  mentions(problemsWith((data) => { data.instances[0].rooms[2].check = { skill: 'mining' } }), 'a work skill')
  mentions(problemsWith((data) => { data.instances[0].rooms[0].check = { attribute: 'luck' } }), 'only a trap or a puzzle')
})

test('its boss and elite are bosses of the roster, of its races, and belong to no other instance', () => {
  mentions(problemsWith((data) => { data.instances[0].boss = 'nobody' }), 'a boss in game/bosses.json')
  mentions(problemsWith((data) => { data.instances[0].boss = 'vorzhaal' }), 'not of its races')
  mentions(problemsWith((data) => { data.instances[1].elite = data.instances[1].boss }), 'must differ')
  mentions(problemsWith((data) => {
    data.instances[4].boss = data.instances[0].elite
    data.instances[4].races.push('zombie')
  }), 'already belongs to an instance')
})

test('a vault holds bosses\' own equipment, never an instance boss\'s item or any relic', () => {
  mentions(problemsWith((data) => { data.instances[0].vault = ['sheaf-of-the-long-summer'] }), 'not a boss\'s item')
  mentions(problemsWith((data) => { data.instances[0].vault = ['jawbone-lyre'] }), 'not a boss\'s item')
  mentions(problemsWith((data) => { data.instances[0].vault = ['stormwing-staff'] }), 'item of an instance\'s boss')
  mentions(problemsWith((data) => { data.instances[0].vault = ['bridgewardens-maul'] }), 'another instance\'s elite')
  mentions(problemsWith((data) => { data.instances[0].vault = [] }), 'each once')
})

test('races, the opening level, loot, art and the place on the map are checked', () => {
  mentions(problemsWith((data) => { data.instances[0].races = ['kobold'] }), '"races"')
  mentions(problemsWith((data) => { data.instances[2].opensAt = 2 }), 'not be below the instance before it')
  mentions(problemsWith((data) => { data.instances[0].loot = { gold: 1 } }), '"loot"')
  mentions(problemsWith((data) => { data.instances[0].banner = 'https://example.com/a.png' }), '"banner"')
  mentions(problemsWith((data) => { data.instances[0].map = { x: 300, y: 10 } }), 'inside the roadmap')
  mentions(problemsWith((data) => { data.instances[0].route.mid = 'ui/cities/x.png' }), '"route"')
})

test('the region\'s maps start at nothing cleared and rise', () => {
  mentions(problemsWith((data) => { data.region.maps[0].cleared = 1 }), 'start at 0 cleared')
  mentions(problemsWith((data) => { data.region.maps[2].cleared = 2 }), 'start at 0 cleared and rise')
  mentions(problemsWith((data) => { data.region.title = '' }), '"title"')
})

test('the index keeps the road\'s order and finds an instance by its relic', () => {
  const index = indexInstances(readJson('instances.json'))
  assert.deepEqual(index.order.slice(0, 2), ['sunken-crypt', 'emberdeep-foundry'])
  assert.equal(index.byRelic.get('tidewake-bell').id, 'sunken-crypt')
  assert.equal(instanceIndexOf({}), null)
  const content = { instances: readJson('instances.json') }
  assert.equal(instanceIndexOf(content), instanceIndexOf(content))
})
