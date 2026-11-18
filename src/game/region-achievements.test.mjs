import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { validateAchievements } from './achievement-content.mjs'
import { METRICS, metricContext } from './achievement-metrics.mjs'
import { instanceIndexOf } from './instance-content.mjs'
import { journalGains } from './journal-gains.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = { instances: readJson('instances.json'), bosses: readJson('bosses.json') }
const index = instanceIndexOf(content)
const [oldRoad, isles] = index.regions
const AT = 1_767_600_000_000

/** A save of one world whose instances listed are cleared, with a best rematch on the first. */
function saveWith(cleared = [], rematch = 0) {
  const instances = Object.fromEntries(cleared.map((id) => [id, { runs: 1, clears: 1, bestTier: 1 }]))
  if (rematch) instances[cleared[0]] = { runs: 3, clears: 3, bestTier: 1, rematch }
  return { worlds: { main: { skills: {}, projects: {}, instances } } }
}
const measure = (metric, save) => METRICS[metric].measure(save, metricContext(content))

test('the rematch and region achievements measure the best rematch, the regions opened and completed', () => {
  assert.equal(measure('bestRematch', saveWith(['sunken-crypt'], 5)), 5)
  assert.equal(measure('bestRematch', saveWith(['sunken-crypt'])), 0)
  assert.equal(measure('regionsOpened', saveWith(oldRoad.instanceIds.slice(0, 5))), 0)
  assert.equal(measure('regionsOpened', saveWith(oldRoad.instanceIds)), 1)
  assert.equal(measure('regionsComplete', saveWith(oldRoad.instanceIds)), 1)
  assert.equal(measure('regionsComplete', saveWith([...oldRoad.instanceIds, ...isles.instanceIds])), 2)
})

test('the shipped achievements for rematches and regions are valid', () => {
  const achievements = readJson('achievements.json')
  const problems = validateAchievements(achievements, { ...content, bestiary: readJson('bestiary.json'),
    settlement: readJson('settlement.json'), cities: readJson('cities.json'), traits: readJson('traits.json') })
  assert.deepEqual(problems, [])
  for (const id of ['rematch-1', 'rematch-5', 'rematch-10', 'region-opened', 'region-cleared']) {
    assert.ok(achievements.achievements.some((entry) => entry.id === id), id)
  }
})

test('the journal keeps a rematch won and a region opened as highlights', () => {
  const before = saveWith(oldRoad.instanceIds.slice(0, 5))
  const after = saveWith(oldRoad.instanceIds)
  const events = [{ type: 'instance', kind: 'cleared', instance: 'sunken-crypt', tier: 5, rematch: 2 }]
  const { highlights } = journalGains({ before, after, events, at: AT, tierOf: () => 1, instanceIndex: index })
  assert.deepEqual(highlights, [
    { at: AT, kind: 'rematch', ref: 'sunken-crypt', value: 2 },
    { at: AT, kind: 'region', ref: 'gloaming-isles' }
  ])
})
