import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createController } from './controller.mjs'
import { createUnavailableGame } from './game-mode.mjs'

function setup({ game = createUnavailableGame('off') } = {}) {
  const saved = []
  let changes = 0
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
    game,
    onChange: () => (changes += 1)
  })
  return { controller, saved, changes: () => changes }
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

/** A game that records the actions it is asked for and changes something every time. */
function recordingGame() {
  const calls = []
  const record = (name) => async (input) => {
    calls.push([name, input])
    return { changed: true }
  }
  const game = {
    getView: () => ({ status: 'running' }),
    prestigeSkill: record('prestige'),
    upgradeItem: record('upgrade'),
    buyGroupUpgrade: record('buy'),
    assignRoom: record('assign'),
    resetWorld: record('reset'),
    setAutoSpend: record('autoSpend'),
    setKeepTitles: record('keepTitles'),
    exportSave: async () => ({ format: 'agent-center-game' }),
    importSave: record('import')
  }
  return { game, calls }
}

test('the view state carries the game part', () => {
  const { controller } = setup()
  assert.deepEqual(controller.getState().game, { status: 'off', tokenSource: null, autoSpend: false, keepTitles: false })
})

test('game actions reach the game with their fields and tell the surfaces', async () => {
  const { game, calls } = recordingGame()
  const { controller, changes } = setup({ game })
  await controller.gamePrestige('main', 'forge')
  await controller.gameAssignRoom('local:/work/rumble-banana', null)
  await controller.gameSetAutoSpend(true)
  assert.deepEqual(calls, [
    ['prestige', { worldId: 'main', skillId: 'forge' }],
    ['assign', { roomId: 'local:/work/rumble-banana', worldId: null }],
    ['autoSpend', true]
  ])
  assert.equal(changes(), 3)
})

test('game actions with values of the wrong kind are refused before they reach the game', async () => {
  const { game, calls } = recordingGame()
  const { controller } = setup({ game })
  await assert.rejects(controller.gamePrestige(undefined, 'forge'), /invalid world/)
  await assert.rejects(controller.gameUpgradeItem('room', { id: 1 }), /invalid item/)
  await assert.rejects(controller.gameSetAutoSpend('yes'), /invalid auto-spend/)
  await assert.rejects(controller.gameResetWorld('x'.repeat(600)), /invalid world/)
  await assert.rejects(controller.gameImportSave('{"format":"agent-center-game"}'), /invalid save file/)
  await assert.rejects(controller.gameImportSave([]), /invalid save file/)
  assert.equal(calls.length, 0)
})

test('a game that cannot run refuses its actions', async () => {
  const { controller } = setup()
  await assert.rejects(controller.gameBuyUpgrade('main', 'campfire'), /not available/)
})

test('an export answers the file and changes nothing; an import replaces the game and says so', async () => {
  const { game, calls } = recordingGame()
  const { controller, changes } = setup({ game })
  assert.deepEqual(await controller.gameExportSave(), { format: 'agent-center-game' })
  assert.equal(changes(), 0)
  await controller.gameImportSave({ format: 'agent-center-game' })
  assert.deepEqual(calls, [['import', { format: 'agent-center-game' }]])
  assert.equal(changes(), 1)
  const unavailable = setup()
  await assert.rejects(unavailable.controller.gameExportSave(), /not available/)
})
