import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CHEST_ITEMS_SHOWN,
  RECENT_EVENTS_KEPT,
  RETIREES_SHOWN,
  buildGameView,
  gameStatus,
  keepRecent,
  partyStateOf,
  tokenSourceOf
} from './game-view.mjs'

const BANANA = 'local:/work/rumble-banana'

test('the game runs when it is on and its save is not from a newer plugin', () => {
  assert.equal(gameStatus({ enabled: true, newerSave: false }), 'running')
  assert.equal(gameStatus({ enabled: false, newerSave: true }), 'off')
  assert.equal(gameStatus({ enabled: true, newerSave: true }), 'newer-save')
})

test('real session totals are used only when Orca offers them and the person granted them', () => {
  assert.equal(tokenSourceOf({ supported: true, granted: true }), 'history')
  assert.equal(tokenSourceOf({ supported: false, granted: true }), 'estimated')
  assert.equal(tokenSourceOf({ supported: true, granted: false }), 'estimated')
})

test('a waiting or blocked session pauses the party, and a party with nobody working is idle', () => {
  assert.equal(partyStateOf([{ state: 'working' }, { state: 'blocked' }], false), 'paused')
  assert.equal(partyStateOf([{ state: 'idle' }], false), 'idle')
  assert.equal(partyStateOf([], false), 'idle')
  assert.equal(partyStateOf([{ state: 'working' }], true), 'resting')
  assert.equal(partyStateOf([{ state: 'working' }], false), 'fighting')
})

test('only the newest events are kept', () => {
  const events = Array.from({ length: RECENT_EVENTS_KEPT + 3 }, (_, id) => ({ id }))
  const kept = keepRecent([], events)
  assert.equal(kept.length, RECENT_EVENTS_KEPT)
  assert.equal(kept.at(-1).id, RECENT_EVENTS_KEPT + 2)
})

function item(id, power, heldBy = null) {
  return { id, name: id, slot: 'weapon', damageType: 'physical', tier: 1, level: power, power, heldBy, upgradeCost: {}, affordable: false }
}

function engineView({ chest = [], retirees = [] } = {}) {
  const project = {
    id: BANANA, wave: 3, waveKills: 0, killsToPass: 1, monster: null, stamina: 1, resting: false,
    party: [], chest, retirees, retiredCount: 0, retireeBonus: 0
  }
  return { worlds: [{ id: 'main', level: 2, projects: [project] }], projectWorld: {}, keepTitles: false }
}

const input = (view, extra = {}) => ({
  status: 'running', tokenSource: 'estimated', autoSpend: false, keepTitles: false, engineView: view, defaultWorldId: 'main',
  roomIds: [BANANA], links: new Map(), statesByRoom: {}, recent: [], debug: {}, ...extra
})

test('a game that is not running sends only its status and settings', () => {
  const view = buildGameView(input(null, { status: 'off' }))
  assert.deepEqual(view, { status: 'off', tokenSource: null, autoSpend: false, keepTitles: false })
})

test('a running game says where its tokens come from', () => {
  assert.equal(buildGameView(input(engineView())).tokenSource, 'estimated')
  assert.equal(buildGameView(input(engineView(), { tokenSource: 'history' })).tokenSource, 'history')
})

test('a room shows the items in use first, then the strongest, up to a limit', () => {
  const chest = [item('spare-weak', 1), ...Array.from({ length: CHEST_ITEMS_SHOWN }, (_, index) => item(`spare-${index}`, 10 + index)),
    item('in-use', 0, 's1')]
  const room = buildGameView(input(engineView({ chest }))).rooms[BANANA]
  assert.equal(room.chest.length, CHEST_ITEMS_SHOWN)
  assert.equal(room.chest[0].id, 'in-use')
  assert.equal(room.chest.some((shown) => shown.id === 'spare-weak'), false)
  assert.equal(room.chestSize, CHEST_ITEMS_SHOWN + 2)
})

test('retirees are shown newest first, without titles unless they are kept', () => {
  const retirees = Array.from({ length: RETIREES_SHOWN + 2 }, (_, index) =>
    ({ nameId: index, class: 'support', level: 3, retiredAt: index, title: 'Release notes' }))
  const room = buildGameView(input(engineView({ retirees }))).rooms[BANANA]
  assert.equal(room.retirees.length, RETIREES_SHOWN)
  assert.equal(room.retirees[0].nameId, RETIREES_SHOWN + 1)
  assert.equal(room.retirees[0].title, null)
  assert.equal(room.retiredCount, RETIREES_SHOWN + 2)
  const kept = buildGameView(input(engineView({ retirees }), { keepTitles: true })).rooms[BANANA]
  assert.equal(kept.retirees[0].title, 'Release notes')
})

test('a room out of the game or not playing yet says so', () => {
  const excluded = buildGameView(input({ ...engineView(), projectWorld: { [BANANA]: null } })).rooms[BANANA]
  assert.deepEqual(excluded, { worldId: null, joined: false })
  const fresh = buildGameView(input({ worlds: [], projectWorld: {} })).rooms[BANANA]
  assert.deepEqual(fresh, { worldId: 'main', joined: false })
})
