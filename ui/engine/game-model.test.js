import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  characterBadge,
  chosenRoomId,
  holderName,
  joinedRooms,
  roomCharacters,
  roomFighters,
  standingMonsterKey,
  worldById,
  GAME_TABS,
  gameModeOf,
  isEstimated,
  monsterAccent,
  newWorldId,
  partyStatusOf,
  roomFight,
  roomWorlds,
  tabAfterKey,
  tabOrDefault
} from './game-model.js'

const running = { status: 'running', worlds: [], rooms: {}, characters: {}, recent: [] }

test('a state without a game, or with the game off, shows no game at all', () => {
  assert.equal(gameModeOf(undefined), 'off')
  assert.equal(gameModeOf({ status: 'off', autoSpend: false, keepTitles: false }), 'off')
})

test('a running game shows in full', () => {
  assert.equal(gameModeOf(running), 'running')
})

test('a game that cannot run, for a known or an unknown reason, explains itself', () => {
  assert.equal(gameModeOf({ status: 'needs-permission' }), 'unavailable')
  assert.equal(gameModeOf({ status: 'unsupported' }), 'unavailable')
  assert.equal(gameModeOf({ status: 'some-later-status' }), 'unavailable')
})

test('a running status without its worlds and rooms is not drawn as running', () => {
  assert.equal(gameModeOf({ status: 'running' }), 'unavailable')
})

test('a saved tab is kept only when it is one of the tabs', () => {
  assert.equal(tabOrDefault('skills'), 'skills')
  assert.equal(tabOrDefault('market'), 'market')
  assert.equal(tabOrDefault('settings'), 'rooms')
  assert.equal(tabOrDefault(null), 'rooms')
})

test('the arrow keys move along the tabs and wrap round, Home and End go to either end', () => {
  assert.equal(tabAfterKey('rooms', 'ArrowRight'), 'arsenal')
  assert.equal(tabAfterKey('skills', 'ArrowRight'), 'market')
  assert.equal(tabAfterKey('market', 'ArrowRight'), 'rooms')
  assert.equal(tabAfterKey('rooms', 'ArrowLeft'), 'market')
  assert.equal(tabAfterKey('arsenal', 'Home'), GAME_TABS[0])
  assert.equal(tabAfterKey('arsenal', 'End'), 'market')
  assert.equal(tabAfterKey('arsenal', 'Enter'), null)
})

test('progress is estimated only when the worker says so; a missing source means measured', () => {
  assert.equal(isEstimated({ ...running, tokenSource: 'estimated' }), true)
  assert.equal(isEstimated({ ...running, tokenSource: 'measured' }), false)
  assert.equal(isEstimated(running), false)
})

const fightingRoom = {
  worldId: 'main',
  joined: true,
  wave: 15,
  waveKills: 2,
  killsToPass: 16,
  monster: {
    id: 'dummy',
    name: 'Practice Dummy',
    kind: 'boss',
    affix: null,
    level: 15,
    healthShare: 0.12,
    sprite: { body: 'wide', accent: '#7D8590' }
  },
  party: 'fighting',
  stamina: 0.8
}

test('a room that has not joined, or is out of the game, has no fight', () => {
  const game = { rooms: { a: { worldId: 'main', joined: false }, b: { worldId: null, joined: false } } }
  assert.equal(roomFight(game, 'a'), null)
  assert.equal(roomFight(game, 'b'), null)
  assert.equal(roomFight(game, 'missing'), null)
})

test('a joined room shows its wave, its monster and its party', () => {
  const fight = roomFight({ rooms: { a: fightingRoom } }, 'a')
  assert.equal(fight.wave, 15)
  assert.equal(fight.health, 0.12)
  assert.equal(fight.isBoss, true)
  assert.equal(fight.isElite, false)
  assert.equal(fight.party, 'fighting')
})

test('a joined room between monsters still shows its wave and party', () => {
  const fight = roomFight({ rooms: { a: { ...fightingRoom, monster: null, party: 'idle' } } }, 'a')
  assert.equal(fight.monster, null)
  assert.equal(fight.health, 0)
  assert.equal(fight.party, 'idle')
})

test('a paused party says whether an agent is blocked or waiting for the person', () => {
  assert.equal(partyStatusOf({ ...fightingRoom, party: 'paused', pausedBy: 'blocked' }), 'blocked')
  assert.equal(partyStatusOf({ ...fightingRoom, party: 'paused', pausedBy: 'waiting' }), 'waiting')
  assert.equal(partyStatusOf({ ...fightingRoom, monster: null, party: 'paused', pausedBy: 'waiting' }), 'waiting')
})

test('a room that has just joined is getting ready, never paused', () => {
  assert.equal(partyStatusOf({ ...fightingRoom, monster: null, party: 'fighting' }), 'starting')
  // A worker that does not say why it paused, about a room with no monster yet.
  assert.equal(partyStatusOf({ ...fightingRoom, monster: null, party: 'paused' }), 'starting')
  assert.equal(partyStatusOf({ ...fightingRoom, party: 'paused' }), 'waiting')
})

test('a fighting, resting or idle party is shown as it is', () => {
  assert.equal(partyStatusOf(fightingRoom), 'fighting')
  assert.equal(partyStatusOf({ ...fightingRoom, party: 'resting' }), 'resting')
  assert.equal(partyStatusOf({ ...fightingRoom, party: 'idle' }), 'idle')
})

test('a character is marked with its level and class, a guest only as a guest', () => {
  assert.equal(characterBadge(undefined), null)
  assert.deepEqual(characterBadge({ guest: true, level: 1 }), { kind: 'guest' })
  const character = { guest: false, level: 9, class: 'support', trade: 'fishing', state: 'working' }
  const badge = characterBadge(character)
  const expected = { kind: 'member', level: 9, classId: 'support', trade: 'fishing', isGathering: false }
  assert.deepEqual(badge, expected)
})

test('an idle character shows the trade it gathers', () => {
  const badge = characterBadge({ guest: false, level: 3, class: 'magical', trade: 'mining', state: 'idle' })
  assert.equal(badge.isGathering, true)
})

test('a monster is drawn in its own colour only when that is a plain hex colour', () => {
  assert.equal(monsterAccent({ sprite: { accent: '#7D8590' } }), '#7D8590')
  assert.equal(monsterAccent({ sprite: { accent: 'red; background: url(x)' } }), '#8a8f99')
  assert.equal(monsterAccent(null), '#8a8f99')
})

function arsenalState() {
  return {
    rooms: [
      { id: 'out', name: 'turbo-waffle', agents: [{ id: 'pane-5', name: 'Webhook retries' }] },
      { id: 'in', name: 'rumble-banana', agents: [
        { id: 'pane-1', name: 'Fix checkout rounding' },
        { id: 'pane-2', name: 'Search filters' },
        { id: 'pane-3', name: 'Cart drawer polish' }
      ] }
    ],
    game: {
      status: 'running',
      rooms: { out: { worldId: 'main', joined: false }, in: { worldId: 'main', joined: true } },
      characters: {
        'pane-1': { sessionId: 's-1', guest: false, class: 'physical', level: 4 },
        'pane-2': { sessionId: null, guest: true, level: 1 },
        'pane-5': { sessionId: null, guest: true, level: 1 }
      }
    }
  }
}

test('only rooms that have joined can be chosen, the first one by default', () => {
  const state = arsenalState()
  assert.deepEqual(joinedRooms(state).map((room) => room.id), ['in'])
  assert.equal(chosenRoomId(state, 'out'), 'in')
  assert.equal(chosenRoomId(state, null), 'in')
  assert.equal(chosenRoomId({ ...state, game: { rooms: {} } }, 'in'), null)
})

test('a room lists its characters with their agents and only counts its guests', () => {
  const { members, guests } = roomCharacters(arsenalState(), 'in')
  assert.deepEqual(members.map(({ agent }) => agent.name), ['Fix checkout rounding'])
  assert.equal(guests, 1)
})

test('an item names the agent whose character holds it', () => {
  const state = arsenalState()
  assert.equal(holderName({ heldBy: 's-1' }, state, 'in'), 'Fix checkout rounding')
  assert.equal(holderName({ heldBy: null }, state, 'in'), null)
  assert.equal(holderName({ heldBy: 's-gone' }, state, 'in'), '')
})

test('a world is found by its id', () => {
  const game = { worlds: [{ id: 'main' }, { id: 'side-projects' }] }
  assert.equal(worldById(game, 'side-projects').id, 'side-projects')
  assert.equal(worldById(game, 'nowhere'), null)
})

test('a new world takes its id from the typed name, as the worker accepts it', () => {
  assert.deepEqual(newWorldId('Side Quests!', ['main']), { id: 'side-quests' })
  assert.deepEqual(newWorldId('  --Night  shift-- ', ['main']), { id: 'night-shift' })
  assert.equal(newWorldId('a'.repeat(50), []).id.length, 32)
})

test('a new world needs a name, a name of its own, and room for one more world', () => {
  assert.deepEqual(newWorldId('!!', ['main']), { error: 'empty' })
  assert.deepEqual(newWorldId('Main', ['main']), { error: 'taken' })
  const eight = Array.from({ length: 8 }, (_, index) => `world-${index}`)
  assert.deepEqual(newWorldId('one more', eight), { error: 'full' })
})

test('every room the game knows of is listed with its world, a room out of the game with none', () => {
  const state = {
    rooms: [{ id: 'a' }, { id: 'b' }, { id: 'none' }],
    game: { rooms: { a: { worldId: 'main', joined: true }, b: { worldId: null, joined: false } } }
  }
  const listed = roomWorlds(state).map(({ room, worldId }) => [room.id, worldId])
  assert.deepEqual(listed, [['a', 'main'], ['b', null]])
})

test('a monster stands in the room while its party fights, rests or waits, and not while it is idle', () => {
  const game = (party) => ({ rooms: { room: { joined: true, wave: 4, waveKills: 1, killsToPass: 3, party,
    pausedBy: null, stamina: 1, monster: { id: 'blob', level: 4, healthShare: 0.5, hp: 50, maxHp: 100 } } } })
  const fight = roomFight(game('fighting'), 'room')
  assert.equal(standingMonsterKey(fight), '4|1|blob|4')
  assert.equal(fight.hp, 50)
  assert.equal(standingMonsterKey(roomFight(game('resting'), 'room')), '4|1|blob|4')
  assert.equal(standingMonsterKey(roomFight(game('idle'), 'room')), '4|1|blob|4')
})

test('only working characters fight, and only while the party fights a monster', () => {
  const room = {
    agents: [{ id: 'a', activity: 'write' }, { id: 'b', activity: 'idle' }, { id: 'g', activity: 'read' }]
  }
  const game = {
    characters: { a: { class: 'magical', state: 'working' }, b: { class: 'physical', state: 'idle' },
      g: { guest: true, level: 1 } }
  }
  const fighting = { party: 'fighting', monster: { id: 'blob' } }
  const fighters = roomFighters(room, game, fighting)
  assert.deepEqual(fighters, [{ id: 'a', classId: 'magical' }, { id: 'g', classId: null }])
  assert.deepEqual(roomFighters(room, game, { ...fighting, party: 'resting' }), [])
})
