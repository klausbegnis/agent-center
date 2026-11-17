// The words of the Bestiary tab and of the bestiary's news in a room. A bonus is worded from its
// effect (legendary-labels.js), the same data the engine plays by. Never touches the DOM.

/** What a rank's kills are called in a race's details. */
export const RANK_NAMES = {
  normal: 'Plain', veteran: 'Veteran', elite: 'Elite', champion: 'Champion', boss: 'Boss', legendary: 'Legendary'
}

const plural = (count, one, many) => `${count.toLocaleString('en')} ${count === 1 ? one : many}`

export const BESTIARY = {
  title: 'Bestiary',
  intro: 'Every creature this world has fought. Knowing one makes it easier: each mastery level adds a ' +
    'little damage against it, and every race has a small perk of its own.',
  races: (discovered, total) => `${discovered} of ${total} races`,
  bosses: (beaten, total) => `${beaten} of ${total} bosses`,
  racesName: 'Races discovered',
  bossesName: 'Bosses beaten',
  hunter: 'Boss hunter',
  hunterLevel: (level, max) => `Level ${level} of ${max}`,
  hunterProgress: (count, next) => (next === null ? `${count} bosses: the whole track` : `${count} of ${next} bosses`),
  hunterNote: 'Each boss beaten once counts. Beating the same one again counts only for that boss.',
  hunterNext: (next) => `At ${next}: `,
  bonusesTitle: 'The bestiary\'s bonuses',
  noBonus: 'None yet. A race\'s first mastery level comes at its tenth kill.',
  raceDamageSummary: (count, lowest, highest) => (lowest === highest
    ? `+${lowest} damage against ${plural(count, 'race', 'races')} mastered`
    : `+${lowest} to +${highest} damage against ${plural(count, 'race', 'races')} mastered`),
  show: 'Show',
  creatures: 'Creatures',
  bossesTab: 'Bosses',
  unknown: '???',
  unknownLabel: 'An unknown creature: the first kill reveals it',
  unknownDetails: 'Not met yet. The first kill of one shows what it is and starts its mastery.',
  kills: (count) => plural(count, 'kill', 'kills'),
  masteryTop: 'Mastered',
  mastered: (kills) => `${kills} · mastered`,
  toNext: (kills, next) => `${kills.toLocaleString('en')} / ${next.toLocaleString('en')} kills`,
  /** A card's bonus line: damage against the race now and at the next level. */
  cardBonus: (now, next) => {
    if (now && next) return `+${now} damage · next +${next}`
    return now ? `+${now} damage` : `Next: +${next} damage`
  },
  now: 'Now',
  next: (threshold) => `At ${threshold.toLocaleString('en')} kills`,
  nothingYet: 'Nothing yet',
  rankBreakdown: 'Kills by rank',
  perks: 'Bonuses',
  firstKill: (day) => `First kill: ${day}`,
  eliteKills: (count) => `${count.toLocaleString('en')} elite or stronger`,
  cardLabel: (name, kills, level, max) => `${name}: ${kills}, mastery ${level} of ${max}`,
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
  race: (name) => `New in the bestiary: ${name}`,
  boss: (name) => `Boss beaten for the first time: ${name}`,
  mastery: (name, level) => `${name}: mastery ${level}!`,
  hunter: (level) => `Boss hunter ${level}!`
}
