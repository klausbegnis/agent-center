// The words of the daily quests: what each quest asks, worded from its kind, target and what it
// names, the card's labels, the room's lines and the time left until the next day. Never touches the
// DOM.
import { formatAmount } from './game-format.js'
import { materialLabel } from './labels.js'

const HOUR_MS = 3_600_000

export const QUESTS = {
  open: 'Daily quests',
  openNew: 'Daily quests: something new to see',
  title: 'Daily quests',
  close: 'Close',
  viewOnly: 'You are viewing this game from another computer.',
  slots: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
  done: 'Done, reward paid',
  reward: (text) => `Reward: ${text}`,
  bonusTitle: 'All three done',
  bonusPaid: (text) => `Paid: ${text}`,
  bonusOpen: (text) => `Bonus: ${text}`,
  streak: (days, best) => (days ? `Streak: ${days} day${days === 1 ? '' : 's'} (best ${best})` : `No streak yet (best ${best})`),
  streakNote: 'Each day in a row with all three done makes the bonus larger, up to a week. A day without work does not break it.',
  nextDay: (left) => `New quests in ${left}`,
  /** The button's label: "Daily quests: 1 of 3 done, new quests in 5 h". */
  button: (doneCount, total, left) => `Daily quests: ${doneCount} of ${total} done, new quests in ${left}`,
  roomDone: (text) => `Quest done: ${text}!`,
  roomDay: (streak) => `All daily quests done!${streak > 1 ? ` Streak ${streak}` : ''}`
}

/**
 * What a quest asks, in words: "Defeat 40 goblins", "Collect 1,200 ore".
 *
 * @param {{ kind: string, target: number, raceName?: string, material?: string }} quest
 */
export function questText(quest) {
  const count = formatAmount(quest.target)
  const plural = (one, many) => (quest.target === 1 ? one : many)
  switch (quest.kind) {
    case 'kills': return `Defeat ${count} ${plural('monster', 'monsters')}`
    case 'race': {
      // A race's name is plural ("Skeletons"); its id is the singular ("skeleton", "lizardfolk").
      const race = quest.target === 1 ? (quest.race ?? quest.raceName ?? 'monster') : (quest.raceName ?? quest.race ?? 'monsters')
      return `Defeat ${count} ${race.toLowerCase()}`
    }
    case 'elites': return `Defeat ${count} ${plural('elite or champion', 'elites or champions')}`
    case 'boss': return `Defeat ${count} ${plural('boss', 'bosses')}`
    case 'collect': return `Collect ${count} ${materialLabel(quest.material).toLowerCase()}`
    case 'coins': return `Earn ${count} coins`
    case 'trade': return 'Sell or trade at a market city'
    case 'instance': return 'Clear an instance on the roadmap'
    case 'rematch': return 'Win a boss rematch'
    case 'weekly': return `Bring the weekly goal ${count} closer`
    case 'levels': return `Level up characters ${count} ${plural('time', 'times')}`
    case 'skills': return `Gain ${count} skill ${plural('level', 'levels')}`
    default: return quest.kind
  }
}

/** The game icon of each kind; a supply run shows its material's. */
export const QUEST_ICON = {
  kills: 'weapon-physical', race: 'tab-bestiary', elites: 'star', boss: 'tab-bestiary', coins: 'coin', trade: 'coin',
  instance: 'tab-dungeon', rematch: 'tab-dungeon', weekly: 'star', levels: 'tab-party', skills: 'lore'
}

/** The time left until the next day, short: "5 h 12 min", "40 min". */
export function nextDayText(ms) {
  if (!(ms > 0)) return 'a moment'
  const hours = Math.floor(ms / HOUR_MS)
  const minutes = Math.floor((ms - hours * HOUR_MS) / 60_000)
  if (hours === 0) return `${Math.max(1, minutes)} min`
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`
}

/** A reward's materials: "1,200 ore and 980 fish". */
export function rewardText(reward) {
  const parts = Object.entries(reward ?? {}).filter(([, amount]) => amount > 0)
    .map(([material, amount]) => `${formatAmount(amount)} ${materialLabel(material).toLowerCase()}`)
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}
