import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { EVENT_KINDS, FEWEST_EVENTS, eventIndexOf, pinEvent, validateEvents } from './weekly-content.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const data = readJson('events.json')
const others = { races: readJson('races.json'), cities: readJson('cities.json') }
/** The problems of the shipped file after a change to a copy of it. */
const problemsWith = (change) => {
  const copy = structuredClone(data)
  change(copy)
  return validateEvents(copy, others)
}
const mentions = (problems, text) => assert.ok(problems.some((problem) => problem.includes(text)), problems.join('\n'))

test('the shipped events are valid, at least sixteen, with original names, and of every kind', () => {
  assert.deepEqual(validateEvents(data, others), [])
  assert.ok(data.events.length >= FEWEST_EVENTS)
  for (const kind of EVENT_KINDS) assert.ok(data.events.some((event) => event.kind === kind), kind)
  assert.equal(new Set(data.events.map((event) => event.name)).size, data.events.length)
})

test('an event is a nudge: no effect passes half its cap', () => {
  mentions(problemsWith((copy) => { copy.events[0].effects[0].amount = 0.09 }), 'more than 0.5 of its cap')
})

test('a race week names a race of the game and a festival a city; no other kind names either', () => {
  mentions(problemsWith((copy) => { copy.events[0].race = 'mermaid' }), 'a race week')
  mentions(problemsWith((copy) => { copy.events[6].city = 'atlantis' }), 'a festival')
  mentions(problemsWith((copy) => { copy.events[10].race = 'goblin' }), 'a race week')
})

test('goals, rewards and effects are checked', () => {
  mentions(problemsWith((copy) => { copy.events[0].goal = { kind: 'dances', count: 3 } }), 'goal\'s "kind"')
  mentions(problemsWith((copy) => { copy.events[6].goal = { kind: 'race', count: 3 } }), 'only a race week')
  mentions(problemsWith((copy) => { copy.events[0].goal.count = 0 }), 'count')
  mentions(problemsWith((copy) => { copy.events[0].reward = ['gold'] }), '"reward"')
  mentions(problemsWith((copy) => { copy.events[0].effects = [] }), 'at least one effect')
  mentions(problemsWith((copy) => { copy.events[0].effects[0].scope = 'party' }), 'scope "world"')
  mentions(problemsWith((copy) => { copy.events[0].effects[0].effect = 'luck' }), 'must be one of')
})

test('a catalogue of fewer than sixteen events, or a twice listed one, is refused', () => {
  mentions(problemsWith((copy) => { copy.events = copy.events.slice(0, 5) }), 'at least 16')
  mentions(problemsWith((copy) => { copy.events.push(structuredClone(copy.events[0])) }), 'listed twice')
})

test('the demo may pin an event the catalogue has, and only one', () => {
  assert.equal(eventIndexOf({ events: pinEvent(data, 'bone-tide') }).pinned, 'bone-tide')
  assert.equal(pinEvent(data, 'no-such-event'), data)
  assert.equal(pinEvent(data, undefined), data)
  mentions(problemsWith((copy) => { copy.pinned = 'no-such-event' }), '"pinned"')
  assert.equal(eventIndexOf({}), null)
})
