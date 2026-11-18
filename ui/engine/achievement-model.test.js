import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withTitle } from './achievement-labels.js'
import {
  achievementEffects,
  achievementGroups,
  achievementRow,
  partyTitleOf,
  titleOptions
} from './achievement-model.js'

const ROOM = 'local:/work/rumble-banana'
const OTHER = 'local:/work/sneaky-pancake'

test('a party\'s title is the one its room wears, and none for another room', () => {
  const game = { achievements: { partyTitles: { [ROOM]: { id: 'monsters-4', title: 'the Relentless' } } } }
  assert.equal(partyTitleOf(game, ROOM), 'the Relentless')
  assert.equal(partyTitleOf(game, OTHER), null)
  assert.equal(partyTitleOf(undefined, ROOM), null)
})

test('a title that starts with "the" follows the name; any other follows a comma', () => {
  assert.equal(withTitle('Pip', 'the Relentless'), 'Pip the Relentless')
  assert.equal(withTitle('Pip', 'Bane of Trolls'), 'Pip, Bane of Trolls')
  assert.equal(withTitle('Pip', null), 'Pip')
})

test('an achievement in progress shows its value of its target, an earned one its date', () => {
  const going = achievementRow({ id: 'a', points: 10, name: 'Warming Up', description: 'd', share: 0.5, value: 50, target: 100 })
  assert.equal(going.progressText, '50 of 100')
  assert.equal(going.isEarned, false)
  const done = achievementRow({ id: 'b', points: 5, name: 'First Blood', description: 'd', share: 1, earnedAt: Date.UTC(2026, 0, 5) })
  assert.equal(done.isEarned, true)
  assert.match(done.progressText, /^Earned /)
})

test('a hidden achievement not earned yet is shown as a secret', () => {
  const secret = achievementRow({ id: 'c', points: 100, hidden: true, share: 0 })
  assert.equal(secret.isSecret, true)
  assert.equal(secret.name, 'Hidden achievement')
})

test('a group counts its earned achievements and keeps the catalogue\'s order', () => {
  const [group] = achievementGroups({ groups: [{ id: 'battle', name: 'Battle', earned: 1, list: [
    { id: 'a', points: 5, name: 'A', description: 'd', share: 1, earnedAt: 1 },
    { id: 'b', points: 10, name: 'B', description: 'd', share: 0, value: 0, target: 100 }
  ] }] })
  assert.equal(group.count, '1/2')
  assert.equal(group.share, 0.5)
  assert.deepEqual(group.rows.map((row) => row.id), ['a', 'b'])
})

test('the title picker offers no title, then every title earned', () => {
  assert.deepEqual(titleOptions({ titles: [{ id: 'monsters-4', title: 'the Relentless' }] }),
    [['', 'No title'], ['monsters-4', 'the Relentless']])
})

test('an achievement is celebrated in every room that plays; the back-fill once', () => {
  const game = { rooms: { [ROOM]: { joined: true }, [OTHER]: { joined: true }, 'gpu-rig:/data/quantum-pickle': { joined: false } } }
  const earned = achievementEffects([{ type: 'achievement', kind: 'earned', name: 'First Blood', title: null }], game)
  assert.deepEqual(earned.map((effect) => effect.roomId), [ROOM, OTHER])
  assert.equal(earned[0].tone, 'achievement')
  const backfill = achievementEffects([{ type: 'achievement', kind: 'backfill', count: 8 }], game)
  assert.equal(backfill.length, 1)
  assert.match(backfill[0].text, /^8 achievements already earned/)
})
