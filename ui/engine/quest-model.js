// What the daily quests' button, card and room lines show, from the view state's `game.quests`
// (docs/GAME.md, "Daily quests"). Never touches the DOM.
import { clampShare } from './game-format.js'
import { QUESTS, QUEST_ICON, nextDayText, questText, rewardText } from './quest-labels.js'

/** A world's day of quests from the view state, or null. */
export const dayOf = (game, worldId) => game?.quests?.worlds?.[worldId] ?? null

/**
 * The button: how many quests are done and whether there is news (a quest or the day done since the
 * card was last opened). `seen` is the count of done quests and the bonus the card last showed.
 *
 * @param {object | null} game
 * @param {string | null} worldId
 * @param {string | null} seen what the card showed when last opened, by `doneKey`
 * @returns {{ done: number, total: number, label: string, isNew: boolean, allDone: boolean } | null}
 */
export function questButtonModel(game, worldId, seen) {
  const day = dayOf(game, worldId)
  if (!day) return null
  const done = day.quests.filter((quest) => quest.done).length
  const key = doneKey(game, worldId)
  return {
    done,
    total: day.quests.length,
    allDone: day.bonus.paid,
    isNew: seen !== key,
    label: QUESTS.button(done, day.quests.length, nextDayText(game.quests.msLeft))
  }
}

/** What the card last showed, as a key: the day's quests and which are done. */
export function doneKey(game, worldId) {
  const day = dayOf(game, worldId)
  if (!day) return null
  return day.quests.map((quest) => `${quest.kind}:${quest.target}:${quest.done ? 1 : 0}`).join('|')
}

/**
 * The card: each quest with what it asks, its progress, reward and state, the bonus and the streak.
 *
 * @param {object | null} game
 * @param {string | null} worldId
 */
export function questCardModel(game, worldId) {
  const day = dayOf(game, worldId)
  if (!day) return null
  return {
    quests: day.quests.map((quest) => ({
      kind: quest.kind,
      slot: QUESTS.slots[quest.slot] ?? quest.slot,
      icon: quest.kind === 'collect' && quest.material ? quest.material : QUEST_ICON[quest.kind] ?? 'star',
      text: questText(quest),
      progress: quest.progress,
      target: quest.target,
      share: clampShare(quest.progress / Math.max(1, quest.target)),
      done: quest.done,
      reward: quest.done ? QUESTS.done : QUESTS.reward(rewardText(quest.reward))
    })),
    bonus: {
      paid: day.bonus.paid,
      text: day.bonus.paid ? QUESTS.bonusPaid(rewardText(day.bonus.reward)) : QUESTS.bonusOpen(rewardText(day.bonus.reward))
    },
    streak: QUESTS.streak(day.streak, day.best),
    nextDay: QUESTS.nextDay(nextDayText(game.quests.msLeft))
  }
}

/**
 * The room lines of the quests' events: a short one when a quest is done, a bigger one when the
 * day's three are, in every room of the quest's world that plays.
 *
 * @param {object[]} events new events of the view state
 * @param {object} game
 * @returns {{ roomId: string, target: 'room', text: string, tone: string }[]}
 */
export function questEffects(events, game) {
  const effects = []
  for (const event of events) {
    if (event.type !== 'quest') continue
    const roomIds = Object.keys(game.rooms ?? {}).filter((roomId) => game.rooms[roomId]?.joined && game.rooms[roomId]?.worldId === event.worldId)
    const raceName = event.race ? game.bestiary?.races?.find?.((race) => race.id === event.race)?.name : null
    const text = event.kind === 'day'
      ? QUESTS.roomDay(event.streak)
      : QUESTS.roomDone(questText({ kind: event.quest, target: event.target, race: event.race, raceName, material: event.material }))
    const tone = event.kind === 'day' ? 'achievement' : 'purchase'
    for (const roomId of roomIds) effects.push({ roomId, target: 'room', text, tone })
  }
  return effects
}
