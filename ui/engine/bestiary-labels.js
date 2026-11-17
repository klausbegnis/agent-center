// The words of the Bestiary tab and of the bestiary's news in a room. A bonus is worded from its
// effect (legendary-labels.js), the same data the engine plays by. Never touches the DOM.

/** What a rank's kills are called in a race's details. */
export const RANK_NAMES = {
  normal: 'Plain', veteran: 'Veteran', elite: 'Elite', champion: 'Champion', boss: 'Boss', legendary: 'Legendary'
}

const plural = (count, one, many) => `${count.toLocaleString('en')} ${count === 1 ? one : many}`

/** A prestige rank in Roman numerals: 1 is I, 4 is IV, 12 is XII. */
export function romanNumeral(value) {
  const numerals = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let left = Math.max(0, Math.floor(value))
  let text = ''
  for (const [amount, letters] of numerals) {
    while (left >= amount) {
      text += letters
      left -= amount
    }
  }
  return text
}

/** A race's prestige title: "Goblin-bane", then "Goblin-bane II" from the second rank. */
export const prestigeTitle = (title, prestige) => (prestige > 1 ? `${title} ${romanNumeral(prestige)}` : title)

export const BESTIARY = {
  title: 'Bestiary',
  intro: 'Every creature this world has fought. Each kill is worth points by its rank; points raise a ' +
    'race\'s mastery, and every level adds a little damage against it, with a small perk every fifth.',
  races: (discovered, total) => `${discovered} of ${total} races`,
  bosses: (beaten, total) => `${beaten} of ${total} bosses`,
  racesName: 'Races discovered',
  bossesName: 'Bosses beaten',
  rank: 'Hunter rank',
  rankValue: (rank) => `Rank ${rank.toLocaleString('en')}`,
  rankProgress: (points, next) => `${points.toLocaleString('en')} / ${next.toLocaleString('en')} points`,
  rankNote: 'Every point of every race and of the rooms\' own creatures counts. It has no end.',
  hunter: 'Boss hunter',
  hunterLevel: (level, max) => `Level ${level} of ${max}`,
  hunterProgress: (count, next) => (next === null ? `${count} bosses: the whole track` : `${count} of ${next} bosses`),
  hunterNote: 'Each boss beaten once counts. Beating the same one again counts only for that boss.',
  hunterNext: (next) => `At ${next}: `,
  rankNext: 'Next rank: ',
  bonusesTitle: 'The bestiary\'s bonuses',
  noBonus: 'None yet. A race\'s first level comes with its first couple of kills.',
  raceDamageSummary: (count, lowest, highest) => (lowest === highest
    ? `+${lowest} damage against ${plural(count, 'race', 'races')} mastered`
    : `+${lowest} to +${highest} damage against ${plural(count, 'race', 'races')} mastered`),
  show: 'Show',
  creatures: 'Creatures',
  bossesTab: 'Bosses',
  sort: 'Sort',
  sortPoints: 'Most points',
  sortNext: 'Closest to a level',
  unknown: '???',
  unknownLabel: 'An unknown creature: the first kill reveals it',
  unknownDetails: 'Not met yet. The first kill of one shows what it is and starts its mastery.',
  kills: (count) => plural(count, 'kill', 'kills'),
  level: (level) => `Lv ${level}`,
  toNext: (points, next) => `${points.toLocaleString('en')} / ${next.toLocaleString('en')} points`,
  /** A card's line about now: its damage against the race, or none yet. */
  cardNow: (damage) => (damage ? `+${damage} damage` : 'No bonus yet'),
  /** A card's line about the next level: more damage, a perk with it, or past the powered levels a title. */
  cardNext: ({ damage, perk, title }) => {
    if (title) return `Next: ${title}`
    return perk ? `Next: +${damage} and a perk` : `Next: +${damage}`
  },
  prestigeNote: (title, levels) => `Past level ${levels} a race gives nothing more; its ranks are titles: ${title}.`,
  now: 'Now',
  next: (level, points) => `At level ${level} (${points.toLocaleString('en')} points)`,
  nextTitle: (title) => `Next: the title ${title}`,
  nothingYet: 'Nothing yet',
  rankBreakdown: 'Kills by rank',
  pointsOf: (rank, points) => `${rank}, ${plural(points, 'point', 'points')} each`,
  perks: 'Bonuses',
  firstKill: (day) => `First kill: ${day}`,
  eliteKills: (count) => `${count.toLocaleString('en')} elite or stronger`,
  cardLabel: (name, kills, level, points, title) =>
    `${name}${title ? `, ${title}` : ''}: level ${level}, ${points}, ${kills}`,
  others: (count) => `Others, the rooms' own creatures: ${plural(count, 'kill', 'kills')}`,
  bossBeaten: (count) => `×${count.toLocaleString('en')}`,
  bossBeatenLabel: (count) => `beaten ${plural(count, 'time', 'times')}`,
  bossLegendary: (count) => `${count.toLocaleString('en')} as legendary`,
  bossUnknownLabel: 'A boss not beaten yet',
  itemFound: (name) => `Its legendary item, ${name}, has been found`,
  itemMissing: 'It guards a legendary item not found yet',
  noWorld: 'The bestiary fills as this world\'s rooms fight.'
}

/** The day of a first kill, from its game day (days since 1 January 1970, UTC). */
export function dayText(gameDay) {
  const date = new Date(gameDay * 86_400_000)
  return date.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** What a bestiary event says over the room: a discovery, a mastery level or a hunter level. */
export const BESTIARY_EVENT = {
  prestige: (name, title) => `${name}: ${title}!`,
  rank: (rank) => `Hunter rank ${rank}!`,
  race: (name) => `New in the bestiary: ${name}`,
  boss: (name) => `Boss beaten for the first time: ${name}`,
  mastery: (name, level) => `${name}: level ${level}!`,
  hunter: (level) => `Boss hunter ${level}!`
}
