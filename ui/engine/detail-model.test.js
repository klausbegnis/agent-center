import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agentCharacter } from './detail-model.js'

const AGENT = { id: 'pane-1', name: 'Fix checkout rounding', parentId: null }
const MEMBER = {
  sessionId: 's1', link: 'session', guest: false, class: 'support', level: 9, levelProgress: 0.42,
  attributes: { strength: 1, arcane: 2, agility: 3, precision: 4, resilience: 1, medicine: 12, luck: 5 },
  equipment: { weapon: { id: 'w', name: 'Whittled Cudgel', tier: 1, level: 3 }, outfit: null, tool: null },
  trade: 'fishing', state: 'working'
}
const stateWith = (character, status = 'running') =>
  ({ game: { status, characters: character ? { 'pane-1': character } : {} } })

test('an agent with no character, a subagent or a game that is off show nothing of the game', () => {
  assert.equal(agentCharacter(stateWith(null), AGENT), null)
  assert.equal(agentCharacter(stateWith(MEMBER, 'off'), AGENT), null)
  assert.equal(agentCharacter({ game: { status: 'off' } }, AGENT), null)
  assert.equal(agentCharacter(stateWith(MEMBER), { ...AGENT, parentId: 'pane-0' }), null)
  assert.equal(agentCharacter(stateWith(MEMBER), null), null)
})

test('a guest only says that it keeps no progress', () => {
  const guest = { sessionId: null, link: 'guest', guest: true, level: 1 }
  assert.deepEqual(agentCharacter(stateWith(guest), AGENT), { kind: 'guest', text: 'Guest, keeps no progress' })
})

test('a character shows its class, level, progress, seven attributes and three slots', () => {
  const card = agentCharacter(stateWith(MEMBER), AGENT)
  assert.equal(card.facts, 'Healer · Lv 9')
  assert.equal(card.progressText, '42%')
  assert.deepEqual(card.attributes.map((entry) => `${entry.short} ${entry.value}`),
    ['Str 1', 'Arc 2', 'Agi 3', 'Pre 4', 'Res 1', 'Med 12', 'Luck 5'])
  assert.deepEqual(card.equipment.map((entry) => [entry.iconId, entry.name, entry.level]), [
    ['weapon-physical', 'Whittled Cudgel', '+3'],
    ['outfit', 'nothing', ''],
    ['tool', 'nothing', '']
  ])
  assert.equal(card.equipment[0].label, 'Weapon: Whittled Cudgel, Tier 1, +3')
  assert.equal(card.trade, null)
})

test('a character whose agent is done names the trade it gathers, and a Mage holds a magical weapon', () => {
  const card = agentCharacter(stateWith({ ...MEMBER, class: 'magical', state: 'idle' }), AGENT)
  assert.equal(card.trade, 'Gathering Fishing')
  assert.equal(card.equipment[0].iconId, 'weapon-magical')
})

test('an idle character names the trade it gathers now, a chosen one rather than the game\'s pick', () => {
  const chosen = { ...MEMBER, state: 'idle', trade: 'runecraft', tradeChoice: 'runecraft', autoTrade: 'fishing' }
  assert.equal(agentCharacter(stateWith(chosen), AGENT).trade, 'Gathering Runecraft')
})

test('legendary gear names its picture, and the card shows the room\'s active relic and its buff', () => {
  const character = {
    ...MEMBER,
    equipment: { weapon: { id: 'oathbreaker', name: 'Oathbreaker', tier: 2, level: 1, legendary: true, entryId: 'oathbreaker' }, outfit: null, tool: null }
  }
  const state = stateWith(character)
  state.rooms = [{ id: 'room', agents: [AGENT] }]
  state.game.rooms = { room: { joined: true, relics: { owned: ['rimeheart'], active: 'rimeheart' } } }
  state.game.legendary = {
    relicCount: 22,
    entries: { rimeheart: { id: 'rimeheart', name: 'Rimeheart', kind: 'boss-relic', effect: { effect: 'staminaDrain', scope: 'party', amount: 0.05 } } }
  }
  const card = agentCharacter(state, AGENT)
  assert.equal(card.equipment[0].legendaryId, 'oathbreaker')
  assert.equal(card.equipment[1].legendaryId, null)
  assert.deepEqual(card.relic, { id: 'rimeheart', name: 'Rimeheart', text: 'Monsters drain 5% less stamina',
    line: 'Relic: Rimeheart · Monsters drain 5% less stamina' })
})
