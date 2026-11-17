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
    setTravel: record('travel'),
    setCharacterTrade: record('characterTrade'),
    setRoomTrade: record('roomTrade'),
    setKeepTitles: record('keepTitles'),
    exportSave: async () => ({ format: 'agent-center-game' }),
    importSave: record('import'),
    moveOrphanItems: record('moveOrphan'),
    sellMaterial: record('sell'),
    tradeMaterial: record('trade'),
    buyStallOffer: record('buyOffer'),
    setEquipment: record('equip'),
    bestGear: record('bestGear'),
    setActiveRelic: record('activeRelic')
  }
  return { game, calls }
}

test('the view state carries the game part', () => {
  const { controller } = setup()
  assert.deepEqual(controller.getState().game, { status: 'off', tokenSource: null, autoSpend: false, travel: false, keepTitles: false })
})

test('game actions reach the game with their fields and tell the surfaces', async () => {
  const { game, calls } = recordingGame()
  const { controller, changes } = setup({ game })
  await controller.gamePrestige('main', 'forge')
  await controller.gameAssignRoom('local:/work/rumble-banana', null)
  await controller.gameSetAutoSpend(true)
  await controller.gameSetTravel(false)
  assert.deepEqual(calls, [
    ['prestige', { worldId: 'main', skillId: 'forge' }],
    ['assign', { roomId: 'local:/work/rumble-banana', worldId: null }],
    ['autoSpend', true],
    ['travel', false]
  ])
  assert.equal(changes(), 4)
})

test('game actions with values of the wrong kind are refused before they reach the game', async () => {
  const { game, calls } = recordingGame()
  const { controller } = setup({ game })
  await assert.rejects(controller.gamePrestige(undefined, 'forge'), /invalid world/)
  await assert.rejects(controller.gameUpgradeItem('room', { id: 1 }), /invalid item/)
  await assert.rejects(controller.gameSetAutoSpend('yes'), /invalid auto-spend/)
  await assert.rejects(controller.gameSetTravel(1), /invalid travel/)
  await assert.rejects(controller.gameResetWorld('x'.repeat(600)), /invalid world/)
  await assert.rejects(controller.gameImportSave('{"format":"agent-center-game"}'), /invalid save file/)
  await assert.rejects(controller.gameImportSave([]), /invalid save file/)
  assert.equal(calls.length, 0)
})

test('trade choices reach the game with their fields, null meaning no choice', async () => {
  const { game, calls } = recordingGame()
  const { controller } = setup({ game })
  await controller.gameSetCharacterTrade('local:/work/rumble-banana', 's1', 'mining')
  await controller.gameSetRoomTrade('local:/work/rumble-banana', null)
  assert.deepEqual(calls, [
    ['characterTrade', { roomId: 'local:/work/rumble-banana', sessionId: 's1', trade: 'mining' }],
    ['roomTrade', { roomId: 'local:/work/rumble-banana', trade: null }]
  ])
})

test('trade choices with values of the wrong kind are refused before they reach the game', async () => {
  const { game, calls } = recordingGame()
  const { controller } = setup({ game })
  await assert.rejects(controller.gameSetCharacterTrade('room', undefined, 'mining'), /invalid session/)
  await assert.rejects(controller.gameSetCharacterTrade('room', 's1', 3), /invalid trade/)
  await assert.rejects(controller.gameSetRoomTrade(null, 'mining'), /invalid room/)
  await assert.rejects(controller.gameSetRoomTrade('room', ''), /invalid trade/)
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

test('moving a left-behind room\'s items reaches the game with both rooms, which must be text', async () => {
  const { game, calls } = recordingGame()
  const { controller, changes } = setup({ game })
  await assert.rejects(controller.gameMoveOrphanItems('local:/work/fuzzy-anvil', 7), /invalid room/)
  await controller.gameMoveOrphanItems('local:/work/fuzzy-anvil', 'local:/work/rumble-banana')
  assert.deepEqual(calls, [['moveOrphan', { fromRoomId: 'local:/work/fuzzy-anvil', toRoomId: 'local:/work/rumble-banana' }]])
  assert.equal(changes(), 1)
})

test('market actions reach the game with their fields, and amounts must be whole numbers', async () => {
  const { game, calls } = recordingGame()
  const { controller, changes } = setup({ game })
  await controller.gameSellMaterial('main', 'goldmill', 'ore', 120)
  await controller.gameTradeMaterial('main', 'deepforge', 'crops', 'ore', 50)
  await controller.gameBuyStallOffer('main', 'goldmill', 2, 'runed-grimoire', 'local:/work/rumble-banana')
  assert.deepEqual(calls, [
    ['sell', { worldId: 'main', cityId: 'goldmill', materialId: 'ore', amount: 120 }],
    ['trade', { worldId: 'main', cityId: 'deepforge', fromId: 'crops', toId: 'ore', amount: 50 }],
    ['buyOffer', { worldId: 'main', cityId: 'goldmill', offerIndex: 2, entryId: 'runed-grimoire', roomId: 'local:/work/rumble-banana' }]
  ])
  assert.equal(changes(), 3)
  await assert.rejects(controller.gameSellMaterial('main', 'goldmill', 'ore', '120'), /invalid amount/)
  await assert.rejects(controller.gameSellMaterial('main', 'goldmill', 'ore', 1.5), /invalid amount/)
  await assert.rejects(controller.gameTradeMaterial('main', 'deepforge', 'crops', null, 5), /invalid material/)
  await assert.rejects(controller.gameBuyStallOffer('main', 'goldmill', '0', 'x', 'room'), /invalid offer/)
  await assert.rejects(controller.gameBuyStallOffer('main', 7, 0, 'x', 'room'), /invalid city/)
  assert.equal(calls.length, 3)
})

test('equipment actions reach the game with their fields; the item is text, null or auto', async () => {
  const { game, calls } = recordingGame()
  const { controller } = setup({ game })
  await controller.gameSetEquipment('local:/work/rumble-banana', 's1', 'weapon', null)
  await controller.gameSetEquipment('local:/work/rumble-banana', 's1', 'weapon', 'auto')
  await controller.gameBestGear('local:/work/rumble-banana')
  assert.deepEqual(calls, [
    ['equip', { roomId: 'local:/work/rumble-banana', sessionId: 's1', slot: 'weapon', itemId: null }],
    ['equip', { roomId: 'local:/work/rumble-banana', sessionId: 's1', slot: 'weapon', itemId: 'auto' }],
    ['bestGear', { roomId: 'local:/work/rumble-banana' }]
  ])
  await assert.rejects(controller.gameSetEquipment('room', 's1', 7, null), /invalid slot/)
  await assert.rejects(controller.gameSetEquipment('room', 's1', 'weapon', 3), /invalid item/)
  await assert.rejects(controller.gameBestGear(null), /invalid room/)
  assert.equal(calls.length, 3)
})

test('choosing the active relic reaches the game with the room and the relic, or null', async () => {
  const { game, calls } = recordingGame()
  const { controller, changes } = setup({ game })
  await assert.rejects(controller.gameSetActiveRelic('local:/work/rumble-banana', 7), /invalid relic/)
  await assert.rejects(controller.gameSetActiveRelic(undefined, 'rimeheart'), /invalid room/)
  await controller.gameSetActiveRelic('local:/work/rumble-banana', 'rimeheart')
  await controller.gameSetActiveRelic('local:/work/rumble-banana', null)
  assert.deepEqual(calls, [
    ['activeRelic', { roomId: 'local:/work/rumble-banana', relicId: 'rimeheart' }],
    ['activeRelic', { roomId: 'local:/work/rumble-banana', relicId: null }]
  ])
  assert.equal(changes(), 2)
})
