import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CHEST_ITEMS_SHOWN,
  RECENT_EVENTS_KEPT,
  RETIREES_SHOWN,
  buildGameView,
  gameStatus,
  keepRecent,
  orphansOf,
  partyStateOf,
  pauseReasonOf,
  roomNameOf,
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
  roomIds: [BANANA], links: new Map(), agentStates: new Map(), agentlessStates: {}, recent: [], debug: {}, ...extra
})

test('a game that is not running sends only its status and settings', () => {
  const view = buildGameView(input(null, { status: 'off' }))
  assert.deepEqual(view, { status: 'off', tokenSource: null, autoSpend: false, travel: false, keepTitles: false })
})

test('a running game says where its tokens come from', () => {
  assert.equal(buildGameView(input(engineView())).tokenSource, 'estimated')
  assert.equal(buildGameView(input(engineView(), { tokenSource: 'history' })).tokenSource, 'history')
})

test('a room carries its kill count, and a scene only when it travels', () => {
  const view = engineView()
  view.worlds[0].projects[0].kills = 7
  const still = buildGameView(input(view)).rooms[BANANA]
  assert.equal(still.kills, 7)
  assert.equal('sceneTheme' in still, false)
  const asked = []
  const sceneThemeOf = (roomId, kills) => {
    asked.push([roomId, kills])
    return 'guild-hall'
  }
  const travelling = buildGameView(input(view, { travel: true, sceneThemeOf }))
  assert.equal(travelling.travel, true)
  assert.equal(travelling.rooms[BANANA].sceneTheme, 'guild-hall')
  assert.deepEqual(asked, [[BANANA, 7]])
})

test('a room that has not joined has no scene even while rooms travel', () => {
  const room = buildGameView(input(engineView(), { roomIds: [BANANA, 'local:/work/cosmic-llama'],
    travel: true, sceneThemeOf: () => 'guild-hall' })).rooms['local:/work/cosmic-llama']
  assert.deepEqual(room, { worldId: 'main', joined: false })
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

test('a blocked agent comes before a waiting one as the reason a party waits', () => {
  assert.equal(pauseReasonOf([{ state: 'waiting' }, { state: 'blocked' }]), 'blocked')
  assert.equal(pauseReasonOf([{ state: 'working' }, { state: 'waiting' }]), 'waiting')
  assert.equal(pauseReasonOf([{ state: 'working' }, { state: 'idle' }]), null)
})

function partyView() {
  const member = {
    sessionId: 'estimated:pane-1', class: 'physical', level: 2, levelProgress: 0, attributes: {}, equipment: {},
    trade: 'mining', state: 'idle'
  }
  const view = engineView()
  view.worlds[0].projects[0].party = [member]
  return view
}

test('a character and its party take the state its agent has now, not the one saved at the last round', () => {
  const links = new Map([['pane-1', { sessionId: 'estimated:pane-1', roomId: BANANA, how: 'agent' }]])
  const view = buildGameView(input(partyView(), { links, agentStates: new Map([['pane-1', 'working']]) }))
  assert.equal(view.characters['pane-1'].state, 'working')
  assert.equal(view.rooms[BANANA].party, 'fighting')
  assert.equal(view.rooms[BANANA].pausedBy, null)
  const waiting = buildGameView(input(partyView(), { links, agentStates: new Map([['pane-1', 'waiting']]) }))
  assert.equal(waiting.characters['pane-1'].state, 'waiting')
  assert.equal(waiting.rooms[BANANA].party, 'paused')
  assert.equal(waiting.rooms[BANANA].pausedBy, 'waiting')
})

test('a character whose agent left the room is not sent, and a session without an agent keeps its round state', () => {
  const links = new Map([['pane-1', { sessionId: 'estimated:pane-1', roomId: BANANA, how: 'agent' }]])
  const agentlessStates = { [BANANA]: [{ state: 'working' }] }
  const view = buildGameView(input(partyView(), { links, agentStates: new Map(), agentlessStates }))
  assert.deepEqual(view.characters, {})
  assert.equal(view.rooms[BANANA].party, 'fighting')
})

test('the game says how long a round of its fights lasts', () => {
  assert.equal(buildGameView(input({ ...engineView(), tickSeconds: 10 })).tickSeconds, 10)
})

test('a drop is named from the game content, and a kill gives the level of the monster it was', () => {
  const recent = [
    { id: 1, type: 'kill', roomId: BANANA, wave: 7, kind: 'common', affix: null },
    { id: 2, type: 'drop', roomId: BANANA, item: 'ashwood-wand' }
  ]
  const itemEntries = { 'ashwood-wand': { name: 'Ashwood Wand', tier: 2 } }
  const [kill, drop] = buildGameView(input({ ...engineView(), itemEntries }, { recent })).recent
  assert.equal(kill.level, 7)
  assert.equal(drop.name, 'Ashwood Wand')
  assert.equal(drop.tier, 2)
})

test('an item upgrade says its room, its name and the level each purchase reached', () => {
  const chest = [{ ...item('spark-rod', 5, 's1'), name: 'Spark Rod', level: 5 }]
  const recent = [
    { id: 1, type: 'purchase', kind: 'weapon', worldId: 'main', projectId: BANANA, itemId: 'spark-rod', cost: {} },
    { id: 2, type: 'purchase', kind: 'weapon', worldId: 'main', projectId: BANANA, itemId: 'spark-rod', cost: {} }
  ]
  const [first, second] = buildGameView(input(engineView({ chest }), { recent })).recent
  assert.deepEqual([first.roomId, first.name, first.level], [BANANA, 'Spark Rod', 4])
  assert.equal(second.level, 5)
})

test('a group upgrade says the level it reached and belongs to no single room', () => {
  const view = engineView()
  view.worlds[0].upgrades = [{ id: 'campfire', level: 3 }]
  const recent = [{ id: 1, type: 'purchase', kind: 'group', worldId: 'main', upgradeId: 'campfire', cost: {} }]
  const [purchase] = buildGameView(input(view, { recent })).recent
  assert.equal(purchase.level, 3)
  assert.equal(purchase.roomId, null)
})

const project = (id, { chest = [], retirees = [], retiredCount = 0 } = {}) => ({ id, chest, retirees, retiredCount })

test('a project of the save that is not on screen and holds items or retirees is left behind', () => {
  const anvil = 'local:/work/fuzzy-anvil'
  const view = engineView({ chest: [item('club', 1)] })
  view.worlds[0].projects.push(
    project(anvil, { chest: [item('club', 1), item('wand', 2)], retirees: [{}], retiredCount: 4 }),
    project('build-box:/srv/turbo-waffle')
  )
  const world = buildGameView(input(view)).worlds[0]
  assert.deepEqual(world.orphans, [{ roomId: anvil, name: 'fuzzy-anvil', chestSize: 2, retiredCount: 5 }])
  assert.deepEqual(world.roomIds, [BANANA])
})

test('a room still on screen is never left behind, even out of the game', () => {
  const projects = [project(BANANA, { chest: [item('club', 1)] })]
  assert.deepEqual(orphansOf(projects, [BANANA]), [])
  const view = engineView({ chest: [item('club', 1)] })
  view.projectWorld = { [BANANA]: null }
  assert.deepEqual(buildGameView(input(view)).worlds[0].orphans, [])
})

test('a room is named by the last segment of its folder, never by its path', () => {
  assert.equal(roomNameOf('local:/work/rumble-banana'), 'rumble-banana')
  assert.equal(roomNameOf('build-box:/srv/turbo-waffle/'), 'turbo-waffle')
  assert.equal(roomNameOf('gpu-rig:quantum-pickle'), 'quantum-pickle')
  assert.equal(roomNameOf('local:C:\\work\\cosmic-llama'), 'cosmic-llama')
})
