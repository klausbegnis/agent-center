// The wording of achievements, titles and the "While you worked" summary. Never touches the DOM.

import { numeral } from './city-rank-labels.js'
export const ACHIEVEMENTS = {
  view: 'Achievements',
  heading: 'Achievements',
  points: (points, total) => `${points} of ${total} points`,
  earned: (earned, total) => `${earned} of ${total} earned`,
  groupCount: (earned, total) => `${earned}/${total}`,
  secret: 'Hidden achievement',
  secretNote: 'Keep playing to find out.',
  earnedOn: (date) => `Earned ${date}`,
  progress: (value, target) => `${value} of ${target}`,
  progressLabel: (name) => `Progress towards ${name}`,
  grantsTitle: (title) => `Title: ${title}`,
  backfilled: (count) => `${count} were already earned when achievements arrived.`,
  titleHeading: 'Title',
  titleFor: (room) => `Title of ${room}'s party`,
  noTitle: 'No title',
  noTitlesYet: 'No title earned yet. Some achievements grant one.',
  titleNote: 'A title is cosmetic: it shows beside the party\'s names, in Party and on the agent card.',
  viewOnly: 'Titles are chosen on this computer.'
}

/** A party's title beside a name: "Pip the Relentless" or "Pip, Bane of Trolls". */
export function withTitle(name, title) {
  if (!title) return name
  return /^the\s/i.test(title) ? `${name} ${title}` : `${name}, ${title}`
}

/** What plays over the rooms when an achievement is earned. */
export const ACHIEVEMENT_EVENT = {
  earned: (name) => `Achievement: ${name}!`,
  earnedTitle: (name, title) => `Achievement: ${name}! Title "${title}" unlocked`,
  backfill: (count) => `${count} achievement${count === 1 ? '' : 's'} already earned: see World, Achievements`
}

export const SUMMARY = {
  open: 'While you worked',
  openUnread: 'While you worked: something new happened',
  title: 'While you worked',
  close: 'Close',
  today: 'Today',
  since: 'Since you last looked',
  sinceFirst: 'Since the summary started counting',
  nothing: 'Nothing yet.',
  nothingSince: 'Nothing new since you last looked.',
  strip: 'The last 14 days',
  stripLabel: 'Monsters defeated on each of the last 14 days',
  dayBar: (date, kills) => `${date}: ${kills} defeated`,
  highlights: 'Highlights',
  viewOnly: 'Watching from another machine: the summary is not marked as read.',
  activeDays: (days) => `${days} day${days === 1 ? '' : 's'} played in all.`
}

/** One line per counter, in the order the card shows them; a count of 0 is left out. */
export const SUMMARY_LINES = [
  ['kills', (n, shown) => `${shown} monster${n === 1 ? '' : 's'} defeated`],
  ['bosses', (n, shown) => `${shown} boss${n === 1 ? '' : 'es'} beaten`],
  ['levels', (n, shown) => `${shown} character level${n === 1 ? '' : 's'} gained`],
  ['skillLevels', (n, shown) => `${shown} skill level${n === 1 ? '' : 's'} gained`],
  ['loot', (n, shown) => `${shown} notable find${n === 1 ? '' : 's'}`],
  ['coins', (n, shown) => `${shown} coins earned`],
  ['materials', (n, shown) => `${shown} materials gathered or won`],
  ['achievements', (n, shown) => `${shown} achievement${n === 1 ? '' : 's'} earned`],
  ['buildings', (n, shown) => `${shown} building level${n === 1 ? '' : 's'} finished`],
  ['cleared', (n, shown) => `${shown} instance${n === 1 ? '' : 's'} cleared`],
  ['failed', (n, shown) => `${shown} instance run${n === 1 ? '' : 's'} failed`]
]

/** A highlight as a line. */
export const HIGHLIGHT = {
  legendary: (name) => `Legendary find: ${name}`,
  loot: (name, tier) => `New best gear: ${name} (tier ${tier})`,
  boss: (name) => `First win over ${name}`,
  achievement: (name) => `Achievement: ${name}`,
  building: (name) => `Built: ${name}`,
  stage: (name) => `The settlement became a ${name}`,
  instance: (name, tier) => `Cleared ${name} at tier ${tier}`,
  scroll: (name) => `Trait scroll found: ${name}`,
  weekly: (name) => `Weekly goal reached: ${name}`,
  city: (name, rank) => `${name} rose to rank ${numeral(rank)}`,
  rematch: (name, rematch) => `Won Rematch ${numeral(rematch)} in ${name}`,
  region: (name) => `A new region opened: ${name}`
}
