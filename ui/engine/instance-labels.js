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
  bossItem: (amount) => `+${percent(amount)} chance the boss leaves its own item`,
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
