import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createController } from './controller.mjs'

function setup() {
  const saved = []
  const controller = createController({
    store: { snapshot: () => ({ rooms: [{ id: 'local:/work/rumble-banana', agents: [] }] }) },
    preferences: {
      snapshot: () => ({}),
      setRoomTheme: async (...input) => saved.push(['theme', ...input]),
      setRoomHidden: async (...input) => saved.push(['hidden', ...input])
    },
    snapshotSync: { sync: async () => {} },
    listThemes: () => [],
    externalView: () => null,
    openWorkspace: async () => {},
    onChange: () => {}
  })
  return { controller, saved }
}

test('a setting is saved for a room that exists', async () => {
  const { controller, saved } = setup()
  await controller.setRoomTheme('local:/work/rumble-banana', 'pixel-dark')
  await controller.setRoomHidden('local:/work/rumble-banana', true)
  assert.equal(saved.length, 2)
})

test('a setting cannot be added for a room that does not exist', async () => {
  const { controller, saved } = setup()
  await assert.rejects(controller.setRoomTheme('made-up', 'pixel-dark'), /unknown room/)
  await assert.rejects(controller.setRoomHidden('made-up', true), /unknown room/)
  assert.equal(saved.length, 0)
})

test('a setting can be cleared for a room that is gone', async () => {
  const { controller, saved } = setup()
  await controller.setRoomTheme('gone', null)
  await controller.setRoomHidden('gone', false)
  assert.equal(saved.length, 2)
})
