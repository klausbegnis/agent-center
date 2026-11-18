import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { eventEffectText, eventLines, goalText, rewardText, timeLeftText } from './event-labels.js'
import { bannerModel, eventIconUrl, markerModel } from './event-model.js'

const events = JSON.parse(readFileSync(new URL('../../game/events.json', import.meta.url), 'utf8')).events
const HOUR = 3_600_000

/** A world's weekly event as the view state gives it. */
function weekly(extra = {}) {
  return {
    week: '2026-W47',
    endsAt: 0,
    msLeft: 3 * 24 * HOUR + 4 * HOUR,
    id: 'howling-moon',
    name: 'The Howling Moon',
    kind: 'race',
    flavour: 'The moon hangs low.',
    race: 'werewolf',
    raceName: 'Werewolves',
    city: null,
    cityName: null,
    effects: [{ effect: 'raceDamage', scope: 'world', amount: 0.03, races: ['werewolf'] }],
    goal: { kind: 'race', count: 40, progress: 12, done: false },
    reward: { hides: 1200, seals: 980 },
    next: {
      week: '2026-W48', id: 'clear-skies', name: 'Clear Skies', kind: 'season', flavour: 'Dry roads.', race: null,
      raceName: null, city: null, cityName: null, effects: [{ effect: 'restTime', scope: 'world', amount: 3 }],
      goal: { kind: 'kills', count: 250 }
    },
    ...extra
  }
}

test('time left reads as a person says it', () => {
  assert.equal(timeLeftText(3 * 24 * HOUR + 4 * HOUR), '3 d 4 h left')
  assert.equal(timeLeftText(2 * 24 * HOUR), '2 d left')
  assert.equal(timeLeftText(5 * HOUR + 10), '5 h left')
  assert.equal(timeLeftText(20 * 60_000), 'under an hour left')
  assert.equal(timeLeftText(0), 'ending now')
})

test('every shipped event says what each of its effects does', () => {
  for (const event of events) {
    for (const effect of event.effects) assert.notEqual(eventEffectText(effect, { werewolf: 'Werewolves' }), '', event.id)
  }
  assert.equal(eventEffectText({ effect: 'characterXp', amount: 0.025 }), '+2.5% experience for every character')
  assert.equal(eventEffectText({ effect: 'gatherYield', amount: 0.075, materials: ['logs'] }), '+7.5% logs from gathering')
})

test('a race week says its race comes twice as often, and a festival names its city', () => {
  const lines = eventLines(weekly())
  assert.equal(lines[0], 'Werewolves come twice as often and count double in the bestiary')
  assert.equal(lines[1], '+3% damage against werewolves')
  const fair = eventLines({ kind: 'festival', cityName: 'Goldmill', effects: [] })
  assert.deepEqual(fair, ['Goldmill holds its festival'])
})

test('goals and rewards in words', () => {
  assert.equal(goalText({ kind: 'race', count: 40 }, 'Werewolves'), 'Defeat 40 werewolves')
  assert.equal(goalText({ kind: 'bosses', count: 1 }), 'Defeat 1 boss')
  assert.equal(goalText({ kind: 'bosses', count: 2 }), 'Defeat 2 bosses')
  assert.equal(goalText({ kind: 'elites', count: 20 }), 'Defeat 20 elites or champions')
  assert.equal(goalText({ kind: 'kills', count: 300 }), 'Defeat 300 monsters')
  assert.equal(rewardText({ hides: 1200, seals: 980 }), '1,200 hides and 980 seals')
})

test('the banner shows the event, its goal\'s share and next week\'s, and nothing before the first round', () => {
  const banner = bannerModel({ weekly: weekly() })
  assert.equal(banner.name, 'The Howling Moon')
  assert.equal(banner.kindLabel, 'Race week')
  assert.equal(banner.timeLeft, '3 d 4 h left')
  assert.equal(banner.goal.share, 0.3)
  assert.equal(banner.reward, 'Reward: 1,200 hides and 980 seals')
  assert.equal(banner.next.name, 'Clear Skies')
  assert.equal(banner.next.goal, 'Defeat 250 monsters')
  assert.equal(bannerModel({ weekly: null }), null)
  assert.equal(bannerModel(null), null)
  const done = bannerModel({ weekly: weekly({ goal: { kind: 'race', count: 40, progress: 40, done: true } }) })
  assert.equal(done.goal.done, true)
  assert.equal(done.reward, 'Goal reached, reward paid')
})

test('the room\'s marker names the event, the time left and the goal', () => {
  const marker = markerModel({ weekly: weekly() })
  assert.equal(marker.kind, 'race')
  assert.equal(marker.label, 'This week\'s event: The Howling Moon, 3 d 4 h left; 12 of 40')
  assert.equal(markerModel({}), null)
  assert.equal(eventIconUrl('/base/', 'race'), '/base/ui/art/events/race.png')
})
