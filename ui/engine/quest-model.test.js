import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextDayText, questText, rewardText } from './quest-labels.js'
import { doneKey, questButtonModel, questCardModel, questEffects } from './quest-model.js'

const HOUR = 3_600_000
const quest = (extra) => ({ kind: 'kills', slot: 'easy', target: 40, progress: 10, done: false, reward: { ore: 12, fish: 9 }, ...extra })
function game(extra = {}) {
  return {
    rooms: { a: { joined: true, worldId: 'main' }, b: { joined: true, worldId: 'other' }, c: { joined: false, worldId: 'main' } },
    quests: {
      msLeft: 5 * HOUR + 12 * 60_000,
      worlds: {
        main: {
          quests: [quest(), quest({ kind: 'race', slot: 'medium', target: 6, progress: 6, done: true, race: 'goblin', raceName: 'Goblins' }),
            quest({ kind: 'collect', slot: 'hard', target: 1200, progress: 0, material: 'ore' })],
          bonus: { paid: false, reward: { gears: 30 } },
          streak: 2,
          best: 5,
          ...extra
        }
      }
    }
  }
}

test('each kind of quest in words', () => {
  assert.equal(questText({ kind: 'kills', target: 40 }), 'Defeat 40 monsters')
  assert.equal(questText({ kind: 'race', target: 6, raceName: 'Goblins' }), 'Defeat 6 goblins')
  assert.equal(questText({ kind: 'race', target: 1, race: 'skeleton', raceName: 'Skeletons' }), 'Defeat 1 skeleton')
  assert.equal(questText({ kind: 'race', target: 40, race: 'skeleton', raceName: 'Skeletons' }), 'Defeat 40 skeletons')
  assert.equal(questText({ kind: 'levels', target: 3 }), 'Level up characters 3 times')
  assert.equal(questText({ kind: 'boss', target: 1 }), 'Defeat 1 boss')
  assert.equal(questText({ kind: 'collect', target: 1200, material: 'ore' }), 'Collect 1,200 ore')
  assert.equal(questText({ kind: 'trade', target: 1 }), 'Sell or trade at a market city')
  assert.equal(questText({ kind: 'levels', target: 1 }), 'Level up characters 1 time')
  assert.equal(nextDayText(5 * HOUR + 12 * 60_000), '5 h 12 min')
  assert.equal(nextDayText(40 * 60_000), '40 min')
  assert.equal(rewardText({ ore: 12, fish: 9 }), '12 ore and 9 fish')
})

test('the button counts the quests done and shows a dot until the card has seen them', () => {
  const model = questButtonModel(game(), 'main', null)
  assert.equal(model.done, 1)
  assert.equal(model.total, 3)
  assert.equal(model.isNew, true)
  assert.equal(model.label, 'Daily quests: 1 of 3 done, new quests in 5 h 12 min')
  assert.equal(questButtonModel(game(), 'main', doneKey(game(), 'main')).isNew, false)
  assert.equal(questButtonModel(game(), 'other', null), null)
})

test('the card shows each quest with its progress and reward, the bonus and the streak', () => {
  const card = questCardModel(game(), 'main')
  assert.equal(card.quests[0].text, 'Defeat 40 monsters')
  assert.equal(card.quests[0].share, 0.25)
  assert.equal(card.quests[0].reward, 'Reward: 12 ore and 9 fish')
  assert.equal(card.quests[1].reward, 'Done, reward paid')
  assert.equal(card.quests[2].icon, 'ore')
  assert.equal(card.bonus.text, 'Bonus: 30 gears')
  assert.equal(card.streak, 'Streak: 2 days (best 5)')
  assert.equal(card.nextDay, 'New quests in 5 h 12 min')
  assert.equal(questCardModel(game({ bonus: { paid: true, reward: { gears: 30 } } }), 'main').bonus.text, 'Paid: 30 gears')
})

test('a quest done is told in the rooms of its world that play, the day done a little louder', () => {
  const events = [
    { type: 'quest', kind: 'done', worldId: 'main', quest: 'kills', target: 40 },
    { type: 'quest', kind: 'day', worldId: 'main', streak: 3 },
    { type: 'kill', roomId: 'a' }
  ]
  const effects = questEffects(events, game())
  assert.deepEqual(effects.map((effect) => [effect.roomId, effect.text, effect.tone]), [
    ['a', 'Quest done: Defeat 40 monsters!', 'purchase'],
    ['a', 'All daily quests done! Streak 3', 'achievement']
  ])
})
