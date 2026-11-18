// What a UI receives of the daily quests: per world, today's three quests (what each asks, how far
// it is and what it pays), the day's bonus and the streak. Only what the card and the button need.
// Pure.
import { questIndexOf } from './quest-content.mjs'
import { bonusPreview } from './quests.mjs'

/** A quest as the card shows it: the names it needs, not the content's ids alone. */
function questView(quest, content) {
  const race = quest.race ? content.bestiary?.races?.find((entry) => entry.id === quest.race) : null
  return {
    kind: quest.kind,
    slot: quest.slot,
    target: quest.target,
    progress: quest.progress,
    done: quest.done,
    reward: quest.reward,
    ...(quest.race ? { race: quest.race, raceName: race?.name ?? quest.race } : {}),
    ...(quest.material ? { material: quest.material } : {})
  }
}

/**
 * Every world's day of quests, by world id; a world without one yet is left out.
 *
 * @param {object} save
 * @param {object} content
 * @param {number} day today's local day: a record of another day is shown as none
 * @returns {Record<string, { quests: object[], bonus: { paid: boolean, reward: Record<string, number> },
 *   streak: number, best: number }>}
 */
export function questsView(save, content, day) {
  if (!questIndexOf(content)) return {}
  const views = {}
  for (const [worldId, world] of Object.entries(save.worlds)) {
    const daily = world.daily
    if (!daily || daily.day !== day) continue
    views[worldId] = {
      quests: daily.quests.map((quest) => questView(quest, content)),
      bonus: { paid: daily.bonus, reward: bonusPreview(save, worldId, content) },
      streak: daily.streak,
      best: daily.best
    }
  }
  return views
}
