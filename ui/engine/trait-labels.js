// The words of traits: what each trait's effect does, worded from the effect itself (the same data
// the engine plays by), and the labels of the Party tab's trait slots, the agent card, the Chest
// tab's scrolls and a city's trait broker. Never touches the DOM.
import { coinsText } from './market-labels.js'
import { SKILL_LABEL } from './labels.js'

const percent = (amount) => `${Math.round(Math.abs(amount) * 1000) / 10}%`
const signed = (amount) => `${amount < 0 ? '−' : '+'}${percent(amount)}`
/** A race id as a plural: "goblins", "lizardfolk". */
const pluralRace = (id) => (id.endsWith('folk') ? id : `${id}s`)
/** "a", "a and b", "a, b and c". */
const listText = (words) => (words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`)
const RANK_WORDS = { elite: 'elites', champion: 'champions', boss: 'bosses', legendary: 'legendary bosses', veteran: 'veterans', normal: 'plain monsters' }

/** Each effect type's words, for the character carrying the trait (or its party, or its world). */
const EFFECT_WORDS = {
  damage: (effect) => {
    const type = effect.damageType ? `${effect.damageType} ` : ''
    const against = effect.ranks ? ` against ${listText(effect.ranks.map((rank) => RANK_WORDS[rank] ?? rank))}` : ''
    return `${signed(effect.amount)} ${type}damage${against}`
  },
  attackSpeed: (effect) => `${signed(effect.amount)} attack speed`,
  critChance: (effect) => `${signed(effect.amount)} critical chance`,
  staminaDrain: (effect) => `monsters drain ${percent(effect.amount)} ${effect.amount < 0 ? 'more' : 'less'} stamina while it fights`,
  outfitStamina: (effect) => `its outfit adds ${percent(effect.amount)} more to the party's stamina`,
  healing: (effect) => `${signed(effect.amount)} healing`,
  supportAura: (effect) => `its support aura is ${percent(effect.amount)} stronger`,
  gatherYield: (effect) => (effect.materials
    ? `${signed(effect.amount)} ${listText(effect.materials)} gathered`
    : `${signed(effect.amount)} to everything it gathers`),
  skillXp: (effect) => `${signed(effect.amount)} ${(SKILL_LABEL[effect.skill] ?? effect.skill).toLowerCase()} experience from its tokens`,
  characterXp: (effect) => `${signed(effect.amount)} character experience`,
  raceDamage: (effect) => `${signed(effect.amount)} damage against ${listText(effect.races.map(pluralRace))}`,
  raceDrop: (effect) => `the party finds items ${percent(effect.amount)} more often on ${listText(effect.races.map(pluralRace))}`,
  scrollFind: (effect) => `the party finds trait scrolls ${percent(effect.amount)} more often`,
  brokerDiscount: (effect) => `trait brokers charge the world ${percent(effect.amount)} less`
}

const capitalised = (text) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * What a trait does, in one line: "+1% damage", "+6% arcana experience from its tokens, but −3%
 * to everything it gathers". '' for an effect this version cannot word.
 *
 * @param {{ effect: object, drawback?: object }} entry a trait of the catalogue
 */
export function traitEffectText(entry) {
  const main = EFFECT_WORDS[entry?.effect?.effect]?.(entry.effect) ?? ''
  if (!main) return ''
  const drawback = entry.drawback ? EFFECT_WORDS[entry.drawback.effect]?.(entry.drawback) : ''
  return capitalised(drawback ? `${main}, but ${drawback}` : main)
}

/** The effect types this module can word, for a test to compare with the engine's. */
export const WORDED_TRAIT_EFFECTS = Object.keys(EFFECT_WORDS)

/** "Stout Arm (Common): +1% damage". */
export const traitSummary = (entry, tierName) => `${entry.name} (${tierName}): ${traitEffectText(entry)}`

export const TRAITS = {
  title: 'Traits',
  slotsLabel: (name) => `${name}'s traits`,
  freeSlot: 'Free slot',
  freeSlotLabel: (name) => `A free trait slot of ${name}: teach it a scroll`,
  lockedSlot: (level) => `Lv ${level}`,
  lockedSlotLabel: (level) => `Another trait slot opens at level ${level}`,
  badgeLabel: (summary, canChange) => (canChange ? `${summary}. Swap it for a scroll` : summary),
  born: 'Born with it',
  doubleEdged: 'Double-edged',
  close: 'Close',
  teachTitle: (name) => `Teach ${name} a trait from the chest`,
  teach: (traitName) => `Teach ${traitName}`,
  teachLabel: (traitName, text) => `Teach ${traitName}: ${text}`,
  swapTitle: (traitName, fee) => `Swap ${traitName} for a scroll. It goes back to the chest as a scroll for ${coinsText(fee)}.`,
  swap: (traitName) => `Take ${traitName}`,
  swapLabel: (oldName, traitName, text, fee) => `Swap ${oldName} for ${traitName} (${text}) for ${coinsText(fee)}`,
  noScrolls: 'No trait scrolls in this room\'s chest. Elites and bosses drop them, and city brokers sell them.',
  noNewScrolls: 'Every scroll in the chest is a trait this character already carries.',
  cannotPay: (fee) => `The world needs ${coinsText(fee)} for the swap.`,
  taught: (name, traitName) => `${name} learned ${traitName}.`,
  swapped: (name, traitName, oldName) => `${name} learned ${traitName}; ${oldName} went back to the chest as a scroll.`,
  viewOnly: 'This page only watches: traits are taught from the computer that runs Orca.',
  collection: (known, total) => `Collection: ${known} of ${total} traits`
}

export const SCROLLS = {
  title: 'Trait scrolls',
  none: 'No trait scrolls yet. Elites and bosses drop them now and then, and every city\'s broker sells a few a day.',
  hint: 'Teach a scroll to a character from the Party tab.',
  count: (count) => `×${count}`,
  scrollLabel: (summary, count) => `${summary}. ${count} in the chest`,
  send: 'Send a scroll',
  sendButton: 'Send',
  scrollPicker: 'Scroll to send',
  roomPicker: 'Room to send the scroll to',
  sendLabel: 'Send the chosen scroll to the chosen room',
  noScrollPick: 'No scroll to send',
  noRoomPick: 'No other room',
  noRoom: 'No other room in this world plays yet.',
  sent: (traitName, roomName) => `A scroll of ${traitName} went to ${roomName}.`,
  /** The room's line when a kill drops a scroll. */
  found: (traitName) => `Trait scroll: ${traitName}!`
}

export const BROKER = {
  title: 'Trait broker',
  intro: 'Scrolls of this city\'s traits, new every game day. A scroll goes into the chosen room\'s chest.',
  discount: (share) => `Your characters' trading traits take ${percent(share)} off.`,
  buy: (price) => `Buy for ${coinsText(price)}`,
  buyLabel: (traitName, text, price) => `Buy a scroll of ${traitName} (${text}) for ${coinsText(price)}`,
  sold: 'Sold today',
  cannotPay: 'Not enough coins',
  sellTitle: 'Sell a scroll',
  sellHint: 'The broker pays a quarter of a scroll\'s price.',
  sellPicker: 'Scroll to sell',
  noSell: 'No scroll in the room\'s chest',
  sell: (price) => `Sell for ${coinsText(price)}`,
  sellLabel: (price) => `Sell the chosen scroll for ${coinsText(price)}`,
  swapHint: 'To swap a trait a character carries for a scroll, open its trait in the Party tab.',
  bought: (traitName) => `A scroll of ${traitName} is in the chest.`,
  soldOne: (traitName, price) => `Sold a scroll of ${traitName} for ${coinsText(price)}.`
}
