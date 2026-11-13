import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { validateBosses, validateRaces } from './content-races.mjs'

const readGame = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
/** A fresh copy each time, so a test can break it without touching the others. */
const races = () => readGame('races.json')
const bosses = () => readGame('bosses.json')
const withRace = (data, id, change) => {
  const race = data.races.find((each) => each.id === id)
  change(race)
  return data
}

test('the shipped races and bosses have no problems', () => {
  assert.deepEqual(validateRaces(races()), [])
  assert.deepEqual(validateBosses(bosses(), races()), [])
})

test('a race needs a known rig and build', () => {
  const data = withRace(races(), 'orc', (race) => {
    race.rig = 'centaur'
    race.build = 'huge'
  })
  const problems = validateRaces(data).join('\n')
  assert.match(problems, /race "orc": "rig" must be one of/)
  assert.match(problems, /race "orc": "build" must be one of/)
})

test('a race must fill every slot of its rig', () => {
  const data = withRace(races(), 'goblin', (race) => delete race.parts.held)
  assert.match(validateRaces(data).join('\n'), /race "goblin": "parts.held" must be a non-empty list/)
})

test('a role may only narrow its race\'s choices', () => {
  const data = withRace(races(), 'troll', (race) => race.roles[0].held.push('bow'))
  assert.match(validateRaces(data).join('\n'), /role "brute": "held" names parts the race does not have: bow/)
})

test('a colour must be a six-digit hex colour, and ids may not repeat', () => {
  const data = withRace(races(), 'slime', (race) => {
    race.palettes.skin[0].colour = 'green'
    race.palettes.skin[1].id = race.palettes.skin[0].id
  })
  const problems = validateRaces(data).join('\n')
  assert.match(problems, /needs a colour like/)
  assert.match(problems, /is listed twice/)
})

test('a name must not come out empty', () => {
  const data = withRace(races(), 'human', (race) => {
    race.descriptor = 'metal'
    race.roles[0].word = ''
  })
  assert.match(validateRaces(data).join('\n'), /role "bandit": its name would be empty/)
})

test('two races may not share an id', () => {
  const data = races()
  data.races.push({ ...data.races[0] })
  assert.match(validateRaces(data).join('\n'), /another race has the same id/)
})

test('a boss needs a known race, a part for every slot and every colour', () => {
  const data = bosses()
  data.bosses[0].race = 'kraken'
  delete data.bosses[1].parts.head
  delete data.bosses[2].colours.eye
  const problems = validateBosses(data, races()).join('\n')
  assert.match(problems, /"race" must be a race of game\/races.json/)
  assert.match(problems, /"parts.head" must name a part/)
  assert.match(problems, /"colours.eye" must be a colour/)
})

test('two bosses may not share a name', () => {
  const data = bosses()
  data.bosses[1].name = data.bosses[0].name
  assert.match(validateBosses(data, races()).join('\n'), /another boss has the same name/)
})

test('a file that is not the right shape says so once', () => {
  assert.equal(validateRaces([]).length, 1)
  assert.equal(validateBosses({ bosses: [] }, races()).length, 1)
})
