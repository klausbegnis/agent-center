import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { instanceIndexOf, validateInstances } from './instance-content.mjs'
import { roomHealthShare } from './instance-monsters.mjs'
import {
  REGION_LOCKED,
  isRegionComplete,
  isRegionUnlocked,
  regionOfInstance,
  steppedRank,
  waveRosterOf
} from './instance-regions.mjs'
import { INSTANCE_REFUSALS, openness, runContext } from './instance-run.mjs'
import { instancesContentView, worldInstancesView } from './instance-view.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = {
  races: readJson('races.json'),
  bosses: readJson('bosses.json'),
  legendary: readJson('legendary.json'),
  instances: readJson('instances.json')
}
const index = instanceIndexOf(content)
const [oldRoad, isles] = index.regions
const SKILL = (level) => ({ level, xp: 0, banked: 0, stars: 0 })

/** A world at a level, with the instances listed cleared once. */
function world(level, cleared = []) {
  return {
    skills: Object.fromEntries(['forge', 'lore', 'engineering', 'arcana', 'command'].map((id) => [id, SKILL(level)])),
    projects: {},
    instances: Object.fromEntries(cleared.map((id) => [id, { runs: 1, clears: 1, bestTier: 1 }]))
  }
}

test('the road has two regions: the Old Road of six, then the Gloaming Isles of eight', () => {
  assert.deepEqual(index.regions.map((region) => region.id), ['old-road', 'gloaming-isles'])
  assert.equal(oldRoad.instanceIds.length, 6)
  assert.equal(isles.instanceIds.length, 8)
  assert.equal(isles.after, 'old-road')
  assert.equal(regionOfInstance(index, 'abyssal-gate').id, 'gloaming-isles')
})

test('the second region stays locked until the whole first road is cleared, then opens by level', () => {
  const lighthouse = index.byId.get(isles.instanceIds[0])
  const almost = world(500, oldRoad.instanceIds.slice(0, 5))
  assert.equal(isRegionUnlocked(almost, isles, index), false)
  assert.equal(openness(almost, lighthouse, index).reason, REGION_LOCKED)
  const done = world(lighthouse.opensAt - 1, oldRoad.instanceIds)
  assert.equal(isRegionComplete(done, oldRoad), true)
  assert.equal(isRegionUnlocked(done, isles, index), true)
  assert.equal(openness(done, lighthouse, index).reason, INSTANCE_REFUSALS.level)
  assert.equal(openness(world(lighthouse.opensAt, oldRoad.instanceIds), lighthouse, index).open, true)
  const second = index.byId.get(isles.instanceIds[1])
  assert.equal(openness(world(500, oldRoad.instanceIds), second, index).reason, INSTANCE_REFUSALS.closed)
})

test('the second region opens deeper: higher levels than the first road\'s last instance, rising along it', () => {
  const levels = isles.instanceIds.map((id) => index.byId.get(id).opensAt)
  assert.ok(levels[0] > index.byId.get(oldRoad.instanceIds.at(-1)).opensAt)
  assert.ok(levels.every((level, at) => at === 0 || level > levels[at - 1]))
})

test('a later region\'s plain monsters rank one higher, so its rooms are tougher and take longer', () => {
  assert.equal(steppedRank('normal', 1), 'veteran')
  assert.equal(steppedRank('veteran', 1), 'elite')
  assert.equal(steppedRank('normal', 0), 'normal')
  const run = (instance) => ({ instance, tier: 1, room: 1, boon: null })
  const plain = runContext(run('sunken-crypt'), index).bonuses
  const stepped = runContext(run('saltreach-lighthouse'), index).bonuses
  assert.equal(stepped.rankStep, 1)
  assert.equal(plain.rankStep, 0)
  const seed = (fight) => `same|${fight}`
  assert.ok(roomHealthShare('hall', stepped, seed) > roomHealthShare('hall', plain, seed))
})

test('the second region\'s bosses and elites are met only in their instances, never on the waves', () => {
  const roster = waveRosterOf(content)
  const islesBosses = isles.instanceIds.flatMap((id) => [index.byId.get(id).boss, index.byId.get(id).elite])
  assert.equal(islesBosses.length, 16)
  assert.ok(islesBosses.every((id) => content.bosses.bosses.some((boss) => boss.id === id)))
  assert.ok(islesBosses.every((id) => !roster.bosses.some((boss) => boss.id === id)))
  assert.ok(roster.bosses.some((boss) => boss.id === 'ossric'), 'the first road\'s bosses stay on the waves')
  assert.equal(waveRosterOf(content), roster, 'worked out once per content')
})

test('every boss of the second region guards an item of its own, and every instance there has its relic', () => {
  const byBoss = new Map(content.legendary.legendary.filter((entry) => entry.boss).map((entry) => [entry.boss, entry]))
  for (const id of isles.instanceIds) {
    const instance = index.byId.get(id)
    assert.ok(byBoss.has(instance.boss), instance.boss)
    const relic = content.legendary.legendary.find((entry) => entry.id === instance.relic)
    assert.equal(relic.kind, 'instance-relic')
    assert.equal(relic.instance, id)
  }
})

test('a region must come after one before it and hold its instances together', () => {
  const others = { races: content.races, bosses: content.bosses, legendary: content.legendary }
  const data = structuredClone(content.instances)
  data.regions[0].after = 'nowhere'
  assert.ok(validateInstances(data, others).some((problem) => /"after"/.test(problem)))
  const shuffled = structuredClone(content.instances)
  shuffled.instances.splice(2, 0, shuffled.instances.pop())
  assert.ok(validateInstances(shuffled, others).some((problem) => /together/.test(problem)))
  const stray = structuredClone(content.instances)
  stray.instances.at(-1).region = 'atlantis'
  assert.ok(validateInstances(stray, others).some((problem) => /"region"/.test(problem)))
})

test('the view lists each region with its picture, its progress and whether it is open', () => {
  const view = worldInstancesView('main', world(70, oldRoad.instanceIds), content)
  assert.deepEqual(view.regions.map((region) => [region.id, region.unlocked, region.cleared, region.total]),
    [['old-road', true, 6, 6], ['gloaming-isles', true, 0, 8]])
  assert.equal(view.regions[1].map.art, 'ui/instances/isles-map-1.png')
  assert.equal(view.complete, true, 'the first region keeps its place at the top')
  assert.equal(view.list.find((entry) => entry.id === 'saltreach-lighthouse').state, 'open')
  const locked = worldInstancesView('main', world(70), content)
  assert.equal(locked.regions[1].unlocked, false)
  assert.equal(locked.list.find((entry) => entry.id === 'saltreach-lighthouse').state, 'hidden')
  const shown = instancesContentView(content)
  assert.deepEqual(shown.regions.map((region) => region.after), [null, 'old-road'])
  assert.equal(shown.instances.find((entry) => entry.id === 'abyssal-gate').region, 'gloaming-isles')
})
