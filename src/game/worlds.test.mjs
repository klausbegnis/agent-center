import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_WORLD, SAVE_VERSION, addMaterials, assignProject, emptyProject, emptySave, emptyWorld,
  excludeProject, migrate, resetWorld, withProject, withWorld, worldIdOf
} from './worlds.mjs'

const nextWave = (project) => ({ ...project, wave: project.wave + 1 })

function saveWithProject() {
  const save = withProject(emptySave(), 'rumble-banana', (project) => ({
    ...project,
    wave: 6,
    chest: [{ id: 'iron-axe', slot: 'weapon', damageType: 'physical', tier: 1, recipe: ['bars', 'ore'],
      level: 0, heldBy: null }]
  }))
  return withWorld(save, DEFAULT_WORLD, (world) => ({ ...world, materials: { bars: 40 } }))
}

test('a project never assigned plays in the default world', () => {
  assert.equal(worldIdOf(emptySave(), 'rumble-banana'), DEFAULT_WORLD)
})

test('changing a project creates its world and the project when missing', () => {
  const save = withProject(emptySave(), 'rumble-banana', nextWave, { wave: 4 })
  const project = save.worlds[DEFAULT_WORLD].projects['rumble-banana']
  assert.equal(project.wave, 5)
  assert.deepEqual(project.chest, [])
  assert.equal(project.retiredCount, 0)
})

test('the change sees the world the project belongs to', () => {
  let seen = null
  const save = withWorld(emptySave(), DEFAULT_WORLD, (world) => ({ ...world, lastTokenAt: 42 }))
  withProject(save, 'rumble-banana', (project, world) => {
    seen = world.lastTokenAt
    return project
  })
  assert.equal(seen, 42)
})

test('changing a project leaves the save it was given as it was', () => {
  const before = saveWithProject()
  withProject(before, 'rumble-banana', nextWave)
  assert.equal(before.worlds[DEFAULT_WORLD].projects['rumble-banana'].wave, 6)
})

test('moving a project to another world carries its wave and chest, not the materials', () => {
  const moved = assignProject(saveWithProject(), 'rumble-banana', 'world-2')
  assert.equal(worldIdOf(moved, 'rumble-banana'), 'world-2')
  assert.equal(moved.worlds[DEFAULT_WORLD].projects['rumble-banana'], undefined)
  assert.deepEqual(moved.worlds[DEFAULT_WORLD].materials, { bars: 40 })
  const project = moved.worlds['world-2'].projects['rumble-banana']
  assert.equal(project.wave, 6)
  assert.equal(project.chest[0].id, 'iron-axe')
  assert.deepEqual(moved.worlds['world-2'].materials, {})
})

test('assigning a project with no data yet only records the world', () => {
  const save = assignProject(emptySave(), 'rumble-banana', 'world-2')
  assert.equal(worldIdOf(save, 'rumble-banana'), 'world-2')
  assert.deepEqual(save.worlds, {})
})

test('an excluded project is untouched by changes and keeps its data', () => {
  const excluded = excludeProject(saveWithProject(), 'rumble-banana')
  assert.equal(worldIdOf(excluded, 'rumble-banana'), null)
  assert.equal(withProject(excluded, 'rumble-banana', nextWave), excluded)
  assert.equal(excluded.worlds[DEFAULT_WORLD].projects['rumble-banana'].wave, 6)
})

test('an excluded project assigned again brings back the data it left behind', () => {
  const excluded = excludeProject(saveWithProject(), 'rumble-banana')
  const back = assignProject(excluded, 'rumble-banana', 'world-2')
  assert.equal(back.worlds['world-2'].projects['rumble-banana'].wave, 6)
  assert.equal(back.worlds[DEFAULT_WORLD].projects['rumble-banana'], undefined)
})

test('assigning no world puts the project out of the game', () => {
  assert.equal(worldIdOf(assignProject(saveWithProject(), 'rumble-banana', null), 'rumble-banana'), null)
})

test('resetting a world empties it and leaves the other worlds alone', () => {
  const save = withWorld(saveWithProject(), 'world-2', (world) => ({ ...world, materials: { ore: 3 } }))
  const reset = resetWorld(save, DEFAULT_WORLD)
  assert.deepEqual(reset.worlds[DEFAULT_WORLD], emptyWorld())
  assert.deepEqual(reset.worlds['world-2'].materials, { ore: 3 })
})

test('materials add up by id', () => {
  assert.deepEqual(addMaterials({ bars: 2, ore: 1 }, { ore: 4, runes: 5 }), { bars: 2, ore: 5, runes: 5 })
})

test('a new project starts at the wave it is given with nothing else', () => {
  assert.deepEqual(emptyProject({ wave: 9 }), {
    wave: 9, monster: null, stamina: null, restingUntil: null, chest: [], characters: {}, retirees: [],
    retiredCount: 0
  })
})

test('migrate turns null, garbage and unknown versions into an empty save without throwing', () => {
  const garbage = [null, undefined, 0, 'save', [], { version: 'one' }, { version: SAVE_VERSION + 1 },
    { version: 0 }, { version: 1.5 }]
  for (const value of garbage) assert.deepEqual(migrate(value), emptySave(), JSON.stringify(value))
})

test('migrate keeps a valid save as it is', () => {
  const save = { ...saveWithProject(), settings: { keepTitles: true } }
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(save))), save)
})

test('migrate repairs malformed parts of a save of this version', () => {
  const repaired = migrate({
    version: SAVE_VERSION,
    worlds: {
      broken: 'not a world',
      [DEFAULT_WORLD]: {
        materials: { bars: 3, ore: 'many' },
        projects: { 'rumble-banana': { wave: 2, chest: 7 } }
      }
    },
    projectWorld: { 'rumble-banana': DEFAULT_WORLD, 'other-project': 12 },
    settings: null
  })
  assert.deepEqual(Object.keys(repaired.worlds), [DEFAULT_WORLD])
  assert.deepEqual(repaired.worlds[DEFAULT_WORLD].materials, { bars: 3 })
  assert.deepEqual(repaired.worlds[DEFAULT_WORLD].projects['rumble-banana'], emptyProject({ wave: 2 }))
  assert.deepEqual(repaired.projectWorld, { 'rumble-banana': DEFAULT_WORLD })
  assert.equal(repaired.settings.keepTitles, false)
})
