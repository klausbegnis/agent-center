import assert from 'node:assert/strict'
import { test } from 'node:test'
import { choiceLabel, powerChange, slotButtonLabel, takeText } from './equip-labels.js'
import { canUse, isPinned, optionAfter, slotChoices } from './equip-model.js'

const item = (id, slot, power, extra = {}) => ({ id, name: id, slot, tier: 1, level: power, power, heldBy: null, ...extra })
const state = {
  rooms: [{ id: 'room', agents: [{ id: 'pane-1', name: 'Crash triage' }, { id: 'pane-2', name: 'Onboarding' }, { id: 'pane-3', name: 'Docs' }] }],
  game: {
    characters: {
      'pane-1': { sessionId: 's1', class: 'physical' },
      'pane-2': { sessionId: 's2', class: 'defense' },
      'pane-3': { sessionId: 's3', class: 'magical' }
    }
  }
}
const room = {
  chest: [
    item('cudgel', 'weapon', 0, { damageType: 'physical', heldBy: 's1' }),
    item('sword', 'weapon', 4, { damageType: 'physical' }),
    item('axe', 'weapon', 2, { damageType: 'physical', heldBy: 's2' }),
    item('wand', 'weapon', 3, { damageType: 'magical', heldBy: 's3' }),
    item('coat', 'outfit', 1)
  ]
}
const fighter = { sessionId: 's1', class: 'physical', equipment: { weapon: { id: 'cudgel' }, outfit: null, tool: null } }
const choicesOf = (character, slot) => slotChoices({ state, roomId: 'room', room, character, slot })

test('a slot offers the chest\'s items that fit it, best first, a weapon only of the class\'s type', () => {
  assert.deepEqual(choicesOf(fighter, 'weapon').map((choice) => choice.item.id), ['sword', 'axe', 'cudgel'])
  assert.deepEqual(choicesOf(fighter, 'outfit').map((choice) => choice.item.id), ['coat'])
  assert.equal(canUse('magical', room.chest[1]), false)
  assert.equal(canUse('support', room.chest[4]), true)
})

test('each choice says what it changes and how it is taken', () => {
  const [sword, axe, cudgel] = choicesOf(fighter, 'weapon')
  assert.deepEqual([sword.change, sword.take, sword.holder], [4, 'free', null])
  assert.deepEqual([axe.change, axe.take, axe.holder], [2, 'swap', 'Onboarding'])
  assert.deepEqual([cudgel.isCurrent, cudgel.take, cudgel.change], [true, 'equipped', 0])
  assert.equal(choicesOf({ ...fighter, equipment: {} }, 'outfit')[0].change, 1)
})

test('a swap that would hand the holder a weapon it cannot use is refused', () => {
  const cudgelFor = (guardianWeapon, chest) => slotChoices({
    state, roomId: 'room', room: { chest }, slot: 'weapon',
    character: { sessionId: 's2', class: 'defense', equipment: { weapon: { id: guardianWeapon } } }
  }).find((choice) => choice.item.id === 'cudgel')
  // The fighter can take the guardian's axe in exchange: a swap.
  assert.equal(cudgelFor('axe', room.chest).take, 'swap')
  // A guardian somehow holding a wand could not hand it to the fighter: refused.
  const withWand = room.chest.map((entry) => (entry.id === 'wand' ? { ...entry, heldBy: 's2' } : entry))
  assert.equal(cudgelFor('wand', withWand).take, 'refused')
})

test('a slot is pinned only when chosen by hand', () => {
  assert.equal(isPinned({ pinned: { weapon: true } }, 'weapon'), true)
  assert.equal(isPinned({}, 'weapon'), false)
})

test('the arrow keys, Home and End move through the picker\'s options', () => {
  assert.equal(optionAfter(0, 'ArrowDown', 3), 1)
  assert.equal(optionAfter(0, 'ArrowUp', 3), 2)
  assert.equal(optionAfter(1, 'End', 3), 2)
  assert.equal(optionAfter(2, 'Home', 3), 0)
  assert.equal(optionAfter(1, 'Enter', 3), null)
  assert.equal(optionAfter(0, 'ArrowDown', 0), null)
})

test('the picker\'s wording says the change, the swap and the pin', () => {
  assert.equal(powerChange(2), '+2')
  assert.equal(powerChange(-1), '−1')
  assert.equal(powerChange(0), 'same')
  assert.equal(takeText({ take: 'swap', holder: 'Onboarding' }), 'swap with Onboarding')
  assert.match(takeText({ take: 'refused', holder: 'Docs' }), /^held by Docs: cannot swap/)
  assert.equal(slotButtonLabel('weapon', { name: 'Sword', tier: 3, level: 1 }, true),
    'Weapon: Sword, Tier 3, +1, chosen by hand. Choose another')
  assert.equal(slotButtonLabel('tool', null, false), 'Tool: nothing. Choose another')
  assert.equal(choiceLabel({ item: { name: 'Sword', tier: 3, level: 1 }, change: 2, take: 'free' }),
    'Sword, Tier 3, +1, power +2, free')
})

const legendaryState = {
  ...state,
  game: {
    ...state.game,
    legendary: {
      entries: {
        oathbreaker: { id: 'oathbreaker', name: 'Oathbreaker', kind: 'equipment', slot: 'weapon', class: 'physical',
          effect: { effect: 'critChance', scope: 'holder', amount: 0.04 } }
      }
    }
  }
}
const oathbreaker = item('oathbreaker', 'weapon', 1, { damageType: 'physical', legendary: true, entryId: 'oathbreaker' })
const legendaryChoices = (character, chest) =>
  slotChoices({ state: legendaryState, roomId: 'room', room: { chest }, character, slot: 'weapon' })

test('a legendary weapon is offered to the class it is made for, with its buff, and refused to another', () => {
  const chest = [...room.chest, oathbreaker]
  const forFighter = legendaryChoices(fighter, chest).find((choice) => choice.item.id === 'oathbreaker')
  assert.equal(forFighter.take, 'free')
  assert.equal(forFighter.legendary.text, '+4% critical chance for the wielder')
  assert.match(choiceLabel(forFighter), /legendary: \+4% critical chance for the wielder/)
  const guardian = { sessionId: 's2', class: 'defense', equipment: { weapon: { id: 'axe' } } }
  const forGuardian = legendaryChoices(guardian, chest).find((choice) => choice.item.id === 'oathbreaker')
  assert.equal(forGuardian.take, 'unfit')
  assert.equal(takeText(forGuardian), 'Made for a Fighter: this one cannot hold it')
})

test('a swap that would hand a legendary weapon to a class it is not made for is refused', () => {
  const chest = room.chest.map((entry) => (entry.id === 'cudgel' ? { ...entry, heldBy: null } : entry))
    .concat([{ ...oathbreaker, heldBy: 's1' }])
  const armed = { ...fighter, equipment: { weapon: { id: 'oathbreaker' } } }
  const axe = legendaryChoices(armed, chest).find((choice) => choice.item.id === 'axe')
  assert.equal(axe.take, 'refused')
})
