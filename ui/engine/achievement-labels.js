// The wording of achievements, titles and the "While you worked" summary. Never touches the DOM.

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

