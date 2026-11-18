import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gameEffects, MAX_ROOM_LINES } from './game-effects.js'

function state() {
  return {
    rooms: [{ id: 'room', agents: [{ id: 'pane-1', name: 'Fix checkout rounding' }] }],
    game: {
      status: 'running',
      worlds: [{ id: 'main', roomIds: ['room'], upgrades: [{ id: 'campfire', level: 4 }] }],
      rooms: { room: { joined: true, chest: [{ id: 'ashwood-wand-2', name: 'Ashwood Wand', level: 3 }] } },
      characters: {
        'pane-1': { guest: false, equipment: { weapon: { name: 'Whittled Cudgel' }, outfit: null } }
      }
    }
  }
}
const none = { events: [], arrivals: [], hits: [] }

test('kills in one state are told once, with everything they paid', () => {
  const kill = (materials) => ({ type: 'kill', roomId: 'room', materials })
  const effects = gameEffects({ ...none, events: [kill({ ore: 14, bars: 5 }), kill({ ore: 2 })] }, state())
  assert.deepEqual(effects.map((effect) => [effect.target, effect.text]), [
    ['monster', 'Defeated ×2'],
    ['room', '+ 16 Ore, 5 Bars']
  ])
})

test('a level up shows on the character, only its highest level', () => {
  const level = (value) => ({ type: 'level', roomId: 'room', agentId: 'pane-1', level: value })
  const effects = gameEffects({ ...none, events: [level(4), level(5)] }, state())
  assert.deepEqual(effects, [
    { roomId: 'room', target: 'agent', agentId: 'pane-1', text: 'Level 5!', tone: 'level' }
  ])
})

test('an arrival says who came and what it took from the chest', () => {
  const [effect] = gameEffects({ ...none, arrivals: ['pane-1'] }, state())
  assert.equal(effect.text, 'Fix checkout rounding arrived and took Whittled Cudgel')
})

test('a drop is named after the chest item it became, a retiree by its generated name', () => {
  const effects = gameEffects({ ...none, events: [
    { type: 'drop', roomId: 'room', item: 'ashwood-wand' },
    { type: 'retire', roomId: 'room', nameId: 7, level: 10 }
  ] }, state())
  assert.equal(effects[0].text, 'Found Ashwood Wand')
  assert.match(effects[1].text, /^[A-Z][a-z]+ [A-Z][a-z]+ retired at level 10$/)
})

test('a group purchase shows in every room of its world', () => {
  const purchase = { type: 'purchase', kind: 'group', worldId: 'main', upgradeId: 'campfire' }
  const [effect] = gameEffects({ ...none, events: [purchase] }, state())
  assert.equal(effect.text, 'Built Hearth level 4')
})

test('a settlement\'s new tier and new stage play in every room of its world, the stage with its picture', () => {
  const settlement = {
    buildings: [{ id: 'hearth', tierCount: 3, current: { tier: 2, art: 'ui/settlement/building-hearth-2.png' } }],
    stages: [{ id: 'outpost', art: 'ui/settlement/stage-2-outpost.png' }]
  }
  const game = { ...state(), game: { ...state().game, worlds: [{ ...state().game.worlds[0], settlement }] } }
  const news = (extra) => ({ type: 'settlement', worldId: 'main', ...extra })
  const effects = gameEffects({ ...none, events: [
    news({ kind: 'tier', buildingId: 'hearth', building: 'Hearth', tier: 2, name: 'Cooking hearth' }),
    news({ kind: 'stage', stageId: 'outpost', name: 'Outpost' }),
    news({ kind: 'tier', buildingId: 'hearth', building: 'Workshop', tier: 1, name: 'Workshop' })
  ] }, game)
  assert.deepEqual(effects.map((effect) => [effect.roomId, effect.tone, effect.text]), [
    ['room', 'settlement', 'Hearth grew into a Cooking hearth!'],
    ['room', 'stage', 'The settlement is now an Outpost!'],
    ['room', 'settlement', 'Workshop built!']
  ])
  assert.equal(effects[0].settlementArt, 'ui/settlement/building-hearth-2.png')
  assert.equal(effects[1].settlementArt, 'ui/settlement/stage-2-outpost.png')
})

test('health lost between states adds no line of its own: the fight shows each blow', () => {
  assert.deepEqual(gameEffects({ ...none, hits: [{ roomId: 'room', share: 0.06 }] }, state()), [])
})

test('a busy room shows only its newest lines', () => {
  const retire = (index) => ({ type: 'retire', roomId: 'room', nameId: index, level: index })
  const events = Array.from({ length: 6 }, (_, index) => retire(index))
  const effects = gameEffects({ ...none, events }, state())
  assert.equal(effects.length, MAX_ROOM_LINES)
  assert.match(effects.at(-1).text, /level 5$/)
})

test('events of a room that is not on screen are left out', () => {
  const kill = { type: 'kill', roomId: 'elsewhere', materials: {} }
  assert.deepEqual(gameEffects({ ...none, events: [kill] }, state()), [])
})

test('a drop and an upgrade use the names and the level the worker gives them', () => {
  const state = {
    rooms: [{ id: 'room', agents: [] }],
    game: { rooms: { room: { joined: true, chest: [] } }, worlds: [], characters: {} }
  }
  const events = [
    { id: 1, type: 'drop', roomId: 'room', item: 'ashwood-wand', name: 'Ashwood Wand', tier: 2 },
    { id: 2, type: 'purchase', kind: 'weapon', roomId: 'room', projectId: 'room', itemId: 'rod',
      name: 'Spark Rod', level: 4 }
  ]
  const texts = gameEffects({ events, arrivals: [], hits: [] }, state).map((effect) => effect.text)
  assert.ok(texts.includes('Found Ashwood Wand'))
  assert.ok(texts.includes('Upgraded Spark Rod to Lv 4'))
})

test('a legendary drop is celebrated in gold with its picture', () => {
  const event = { type: 'legendary', roomId: 'room', item: 'rimeheart', name: 'Rimeheart', kind: 'boss-relic' }
  const [effect] = gameEffects({ ...none, events: [event] }, state())
  assert.deepEqual(effect, { roomId: 'room', target: 'room', text: 'Legendary! Rimeheart', tone: 'legendary', artId: 'rimeheart' })
})

test('a bestiary discovery, level, title, hunter rank and boss hunter level are celebrated over the room', () => {
  const events = [
    { type: 'bestiary', roomId: 'room', kind: 'race', creatureId: 'orc', discovered: true, name: 'Orcs' },
    { type: 'bestiary', roomId: 'room', kind: 'race', creatureId: 'orc', level: 2, name: 'Orcs' },
    { type: 'bestiary', roomId: 'room', kind: 'race', creatureId: 'orc', level: 27, name: 'Orcs', title: 'Orc-bane', prestige: 2 },
    { type: 'bestiary', roomId: 'room', kind: 'rank', level: 4 },
    { type: 'bestiary', roomId: 'room', kind: 'hunter', level: 1 }
  ]
  const effects = gameEffects({ ...none, events }, state())
  assert.deepEqual(effects.map((effect) => [effect.text, effect.tone]), [
    ['Orcs: Orc-bane II!', 'bestiary'],
    ['Hunter rank 4!', 'bestiary'],
    ['Boss hunter 1!', 'bestiary']
  ])
})

test('the newest bestiary lines win when there are more than a room shows at once', () => {
  const events = [
    { type: 'bestiary', roomId: 'room', kind: 'race', creatureId: 'orc', discovered: true, name: 'Orcs' },
    { type: 'bestiary', roomId: 'room', kind: 'race', creatureId: 'orc', level: 2, name: 'Orcs' }
  ]
  assert.deepEqual(gameEffects({ ...none, events }, state()).map((effect) => effect.text),
    ['New in the bestiary: Orcs', 'Orcs: level 2!'])
})

test('a city that rose a rank is celebrated in every room of its world, with its new banner', () => {
  const event = { type: 'city', worldId: 'main', cityId: 'goldmill', rank: 3, name: 'Goldmill', title: 'City',
    banner: 'ui/cities/goldmill-3.png' }
  const effects = gameEffects({ ...none, events: [event] }, state())
  assert.deepEqual(effects.map((effect) => [effect.roomId, effect.tone, effect.text, effect.settlementArt]),
    [['room', 'stage', 'Goldmill rose to rank III · City!', 'ui/cities/goldmill-3.png']])
  assert.deepEqual(gameEffects({ ...none, events: [{ ...event, worldId: 'elsewhere' }] }, state()), [])
})
