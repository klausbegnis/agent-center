// The wording of the Party tab's equipment picker, apart from labels.js, which is past the size a
// module should have.
import { levelPlus, SLOT_LABEL } from './labels.js'
import { madeForText } from './legendary-labels.js'

export const EQUIP = {
  close: 'Close',
  nothing: 'Nothing',
  nothingHint: 'Empties the slot; the item goes back to the chest.',
  auto: 'Auto',
  autoHint: 'Takes the best free item now and again whenever gear is re-picked.',
  equipped: 'Equipped',
  chosenByHand: 'chosen by hand',
  noChoices: 'The chest has nothing else for this slot.',
  bestGear: 'Best gear for everyone here',
  bestGearHint: 'Gives every slot nobody chose by hand the best free item again, as on arrival.',
  bestGearDone: (count) => (count === 0
    ? 'Everyone already has the best free gear.'
    : `Best gear: ${count} slot${count === 1 ? '' : 's'} changed.`),
  refusedSwap: 'cannot swap: the holder could not use this one\'s item'
}

/** "Weapon for Crash triage", the picker's name. */
export const pickerTitle = (slot, name) => `${SLOT_LABEL[slot] ?? slot} for ${name}`

/** What a slot button says: "Weapon: Whittled Cudgel, +2. Choose another", or "chosen by hand". */
export function slotButtonLabel(slot, item, isPinned) {
  const what = item ? `${item.name}, Tier ${item.tier}, ${levelPlus(item.level)}` : 'nothing'
  return `${SLOT_LABEL[slot] ?? slot}: ${what}${isPinned ? `, ${EQUIP.chosenByHand}` : ''}. Choose another`
}

/** The change in power a choice brings: "+2", "−1" or "same". */
export const powerChange = (change) => (change > 0 ? `+${change}` : change < 0 ? `−${-change}` : 'same')

/** A legendary choice's buff beside its power: "legendary: +4% critical chance for the wielder". */
export const legendaryNote = (legendary) => (legendary ? `legendary: ${legendary.text}` : '')

/** What taking a choice means, beside it: free, a swap with its holder, or why not. */
export function takeText({ take, holder, legendary }) {
  if (take === 'unfit') return `${madeForText(legendary ?? {})}: this one cannot hold it`
  if (take === 'equipped') return EQUIP.equipped
  if (take === 'swap') return `swap with ${holder || 'its holder'}`
  if (take === 'refused') return `held by ${holder || 'someone'}: ${EQUIP.refusedSwap}`
  return 'free'
}

/** A choice's name for screen readers: "Tempered Shortsword, Tier 3, +0, power +2, swap with …". */
export function choiceLabel(choice) {
  const { item } = choice
  const buff = choice.legendary ? `${legendaryNote(choice.legendary)}, ` : ''
  return `${item.name}, Tier ${item.tier}, ${levelPlus(item.level)}, power ${powerChange(choice.change)}, ` +
    buff + takeText(choice)
}
