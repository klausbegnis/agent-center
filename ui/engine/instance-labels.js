// The words of instances: what a boon and a tier modifier do, worded from their data (the same data
// the engine plays by), and the labels of the World tab's Roadmap, a run's card and a room inside
// an instance. Never touches the DOM.

const percent = (amount) => `${Math.round(amount * 1000) / 10}%`

/** An affix as a modifier says it: "enraged", "armored". */
const AFFIX_WORD = {
  regenerating: 'regenerating', enraged: 'enraged', thorny: 'thorny', swift: 'swift', armored: 'armored',
  ethereal: 'ethereal'
}
/** Who an affix modifier names, by the rooms it lists. */
const ROOM_MONSTERS = { entrance: 'the entrance\'s monster', hall: 'the hall\'s monsters', elite: 'the elite', boss: 'the boss' }
const FIGHT_ROOMS = ['entrance', 'hall', 'elite', 'boss']

const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1)
const listText = (words) => (words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`)

/** Each boon type's words, given its amount. */
const BOON_TEXT = {
  bossDamage: (amount) => `+${percent(amount)} damage against the boss`,
  bossAttack: (amount) => `The boss strikes ${percent(amount)} softer`,
  staminaNow: (amount) => (amount >= 1 ? 'Stamina back to full now' : `+${percent(amount)} stamina now`),
  restShort: (amount) => `Rests take ${percent(amount)} less time`,
  tries: (amount) => `${amount} more ${amount === 1 ? 'try' : 'tries'} in every room left`,
  timeLimit: (amount) => `${percent(amount)} more time in every room left`,
  purse: (amount) => `The boss's purse holds ${percent(amount)} more`,
  bossItem: (amount) => `the boss is ${percent(amount)} more likely to leave its own item`,
  rewardRoll: (amount) => (amount === 1 ? 'A second roll at the boss\'s own item' : `${amount} more rolls at the boss's own item`),
  noBossAffix: () => 'The boss comes without an affix'
}

/** Each modifier type's words. */
const MODIFIER_TEXT = {
  affix: (effect) => {
    const word = AFFIX_WORD[effect.affix] ?? effect.affix
    if (FIGHT_ROOMS.every((room) => effect.rooms.includes(room))) return `Every monster is ${word}`
    const who = listText(effect.rooms.map((room) => ROOM_MONSTERS[room] ?? room))
    const verb = effect.rooms.length === 1 && effect.rooms[0] !== 'hall' ? 'is' : 'are'
    return `${capital(who)} ${verb} ${word}`
  },
  noCampfire: () => 'The campfire gives no stamina back between fights',
  restLonger: (effect) => `Rests take ${percent(effect.amount)} longer`,
  checkHarder: (effect) => `The trap or puzzle is ${percent(effect.amount)} harder`,
  hallFights: (effect) => `The hall holds ${effect.amount} fights`
}

/**
 * What a boon does, in words; '' for one this version cannot word.
 *
 * @param {{ effect: string, amount: number } | undefined} effect
 */
export const boonText = (effect) => BOON_TEXT[effect?.effect]?.(effect.amount) ?? ''

/**
 * What a tier modifier does, in words; '' for one this version cannot word.
 *
 * @param {{ effect: string } | undefined} effect
 */
export const modifierText = (effect) => MODIFIER_TEXT[effect?.effect]?.(effect) ?? ''

/** The types this module can word, for a test to compare with the engine's. */
export const WORDED_BOONS = Object.keys(BOON_TEXT)
export const WORDED_MODIFIERS = Object.keys(MODIFIER_TEXT)

/** A duration of working time as a person says it: "40 s", "12 min", "2 h 5 min". */
export function workTimeText(ms) {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  if (minutes < 1) return `${Math.round(Math.max(0, ms) / 1000)} s`
  if (minutes < 60) return `${minutes} min`
  const rest = minutes % 60
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${Math.floor(minutes / 60)} h`
}

/** What each room of a run is called, by kind, and the room icon drawn for it. */
export const ROOM_KIND_LABEL = {
  entrance: 'Entrance', hall: 'Hall', trap: 'Trap', puzzle: 'Puzzle', elite: 'Elite\'s chamber', vault: 'Vault', boss: 'Boss'
}

/** What a check is against, as a sentence ends: "agility", "Lore". */
const CHECK_WORD = { strength: 'strength', arcane: 'arcane', agility: 'agility', precision: 'precision', resilience: 'resilience', medicine: 'medicine', luck: 'luck' }
export const checkText = (check, skillLabel = {}) =>
  (check?.skill ? `the world's ${skillLabel[check.skill] ?? check.skill}` : `the party's best ${CHECK_WORD[check?.attribute] ?? check?.attribute}`)

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
/** A rematch's number as the roadmap writes it: 3 is "III". */
export const romanOf = (rematch) => ROMAN[rematch - 1] ?? String(rematch)

/** The World tab's Roadmap view, an instance's card, a run's card and their controls. */
export const INSTANCES = {
  views: { creatures: 'Creatures', bosses: 'Bosses', roadmap: 'Roadmap', achievements: 'Achievements' },
  viewsName: 'Show',
  title: (region) => region.name,
  cleared: (cleared, total) => `${cleared} of ${total} instances cleared`,
  complete: (title) => `Road complete: the world is ${title}.`,
  mapNote: 'Send a room\'s party into an instance: while inside, the room\'s wave waits and its working time plays the instance\'s six rooms.',
  hidden: '???',
  hiddenNote: 'Under fog until the instance before it on the road is cleared.',
  locked: (level) => `Opens at World Lv ${level}`,
  open: 'Open',
  inside: (roomName, room) => `${roomName} is inside: room ${room + 1} of 6`,
  clearedCount: (clears, bestTier) => `Cleared ×${clears} · best tier ${bestTier}`,
  notCleared: 'Not cleared yet',
  races: (names) => `Races: ${names}`,
  boss: (boss, elite) => `Boss: ${boss}. Elite: ${elite}.`,
  relic: 'Signature relic',
  relicFound: 'Found',
  relicNotFound: 'Its first clear gives it to the room that clears it',
  enter: 'Enter',
  enterLabel: (name, roomName, tier) => `Send ${roomName}'s party into ${name} at tier ${tier}`,
  room: 'Room',
  tier: 'Tier',
  tierOption: (tier, modifier) => (modifier ? `Tier ${tier}: ${modifier}` : `Tier ${tier}`),
  why: (reason) => `Cannot enter: ${reason}.`,
  noRooms: 'No room of this world can enter now.',
  marker: (name, stateText) => `${name}: ${stateText}`,
  partyMarker: (roomName) => `${roomName}'s party`,
  noWorld: 'Pick a room that plays to see its world\'s road.',
  noInstances: 'This game has no instances.',
  // A run's card.
  runTitle: (name, tier, rematch) => (rematch ? `${name} · Rematch ${romanOf(rematch)} (tier ${tier})` : `${name} · tier ${tier}`),
  roomLine: (room, name) => `Room ${room + 1} of 6: ${name}`,
  roomsName: 'Rooms of the run',
  roomIcon: (index, label, name, stage) => `Room ${index + 1}, ${label}: ${name}, ${stage}`,
  stages: { cleared: 'cleared', current: 'the party is here', ahead: 'ahead' },
  progress: 'Progress',
  fights: (fight, fights) => `fight ${Math.min(fight + 1, fights)} of ${fights}`,
  triesLeft: (count) => `${count} ${count === 1 ? 'try' : 'tries'} left in this room`,
  time: 'Time in this room',
  timeUsed: (share) => `${share} of this room's time`,
  boonNone: 'Boon: none yet (the vault offers two)',
  boon: (name, text) => `Boon: ${name}, ${text}`,
  modifierNone: 'Tier modifier: none at tier 1',
  modifier: (name, text) => `Tier modifier: ${name}, ${text}`,
  worked: (text) => `Worked inside: ${text}`,
  found: (kills, coins) => `Found so far: ${kills} kills, ${coins} coins, and the materials of every kill`,
  vaultTitle: 'The vault: choose a boon',
  vaultWait: (text) => `The first is taken after ${text} more of work, or at once with Auto.`,
  choose: 'Choose',
  chooseLabel: (name) => `Choose ${name}`,
  recall: 'Recall the party',
  recallQuestion: 'Recall the party? The run ends, what it found is kept, and this room waits a while before it may enter again.',
  recallConfirm: 'Recall',
  cooldown: (name, text) => `${name}: the party recovers for ${text} more of work on the waves.`,
  // News in a room and in recent.
  news: {
    enter: (name) => `Into ${name}!`,
    room: (name) => `${name} cleared`,
    checkPassed: (name) => `${name}: passed`,
    checkFailed: (name) => `${name}: failed`,
    vault: 'The vault!',
    boon: (name) => `Boon: ${name}`,
    cleared: (name) => `${name} cleared!`,
    rematchCleared: (name, rematch) => `${name}: Rematch ${romanOf(rematch)} won!`,
    failed: (name) => `Driven out of ${name}`,
    recalled: (name) => `Back from ${name}`
  },
  band: (name, room, roomName) => `${name} · room ${room + 1} of 6 · ${roomName}`,
  bandShort: (name, room) => `${name} · ${room + 1}/6`,
  chip: 'Inside an instance',
  // Rematches of a beaten boss.
  rematch: (rematch) => `Rematch ${romanOf(rematch)}`,
  rematchBadge: (rematch) => romanOf(rematch),
  rematchBest: (rematch) => `Best rematch cleared: ${romanOf(rematch)} of X`,
  rematchNone: 'No rematch cleared yet',
  rematchNext: (rematch, tier) => `Next: Rematch ${romanOf(rematch)}, at tier ${tier}, its boss tougher and its own item likelier`,
  rematchOpens: (level) => `Opens at World Lv ${level}`,
  rematchDone: 'Every rematch cleared: the boss is mastered.',
  rematchLabel: (name, roomName, rematch) => `Send ${roomName}'s party into a rematch of ${name}: Rematch ${romanOf(rematch)}`,
  rematchWhy: (reason) => `No rematch: ${reason}.`,
  rematchMarker: (rematch) => `best rematch ${romanOf(rematch)}`
}
