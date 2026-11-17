// Which character takes a piece of legendary equipment from the chest. A piece is made for a class
// (a weapon or an outfit) or a trade (a tool); a new character that fits takes it over the plain
// item it would have taken, unless that one is far ahead. Pure.
import { bestFreeItem, findItem, isBetter, weaponTypeOf } from './chest.mjs'
import { LEGENDARY_PICK_MARGIN } from './constants.mjs'
import { effectiveGearLevel } from './items.mjs'

const SLOTS = ['weapon', 'outfit', 'tool']

/**
 * Whether a piece of legendary equipment is made for the character.
 *
 * @param {object | undefined} entry the content entry
 * @param {{ class: string, trade?: string | null }} character `trade` is the one it gathers now
 *   (effectiveTrade in trades.mjs)
 * @returns {boolean}
 */
export function fitsCharacter(entry, character) {
  if (entry?.kind !== 'equipment') return false
  return entry.slot === 'tool' ? entry.trade === character.trade : entry.class === character.class
}

/**
 * Whether a character may hold an item, the one rule of every pick, automatic or by hand: a weapon
 * of its class's damage type, any outfit or tool, and a legendary item only when it is made for it
 * (its class, or for a tool the trade it gathers).
 *
 * @param {{ class: string, trade?: string | null }} character with the trade it gathers now
 * @param {{ slot: string, damageType?: string, legendary?: boolean, entryId?: string }} item
 * @param {import('./legendary-content.mjs').LegendaryIndex | null} index
 * @returns {boolean}
 */
export function mayHold(character, item, index) {
  if (item.slot === 'weapon' && item.damageType !== weaponTypeOf(character.class)) return false
  return !item.legendary || fitsCharacter(index?.byId.get(item.entryId), character)
}

/**
 * Why a character may not hold a legendary item it could otherwise use, or null.
 *
 * @param {{ class: string, trade?: string | null }} character
 * @param {{ legendary?: boolean, entryId?: string }} item
 * @param {import('./legendary-content.mjs').LegendaryIndex | null} index
 */
export function legendaryMisfit(character, item, index) {
  if (!item.legendary || fitsCharacter(index?.byId.get(item.entryId), character)) return null
  return index?.byId.get(item.entryId)?.slot === 'tool'
    ? 'that legendary tool is made for another trade'
    : 'that legendary item is made for another class'
}

/** Swaps one item a character holds for another (or none), in the chest. */
function swapHeld(chest, sessionId, fromId, toId) {
  return chest.map((item) => {
    if (item.id === toId) return { ...item, heldBy: sessionId }
    return item.id === fromId ? { ...item, heldBy: null } : item
  })
}

/**
 * A legendary item `equipFromChest` gave a character it is not made for goes back, and the best
 * free plain item of the slot takes its place: legendary equipment only goes to who it fits.
 */
function returnMisfits(picked, character, index) {
  let { chest } = picked
  const equipment = { ...picked.equipment }
  for (const slot of SLOTS) {
    const held = equipment[slot] ? findItem(chest, equipment[slot]) : null
    if (!held?.legendary || fitsCharacter(index.byId.get(held.entryId), character)) continue
    const damageType = slot === 'weapon' ? held.damageType : undefined
    const plain = bestFreeItem(chest.filter((item) => !item.legendary), { slot, damageType })
    chest = swapHeld(chest, character.sessionId, held.id, plain?.id ?? null)
    equipment[slot] = plain?.id ?? null
  }
  return { chest, equipment }
}

/**
 * The equipment a new character takes once legendary items are weighed: a legendary item not made
 * for it is never taken, and for each slot the best free legendary item made for it replaces the
 * plain one `equipFromChest` chose, unless that one is more than LEGENDARY_PICK_MARGIN upgrade
 * levels ahead.
 *
 * @param {{ chest: object[], equipment: Record<string, string | null> }} picked what equipFromChest gave
 * @param {{ sessionId: string, class: string, trade?: string | null }} character
 * @param {import('./legendary-content.mjs').LegendaryIndex | null} index
 * @returns {{ chest: object[], equipment: Record<string, string | null> }}
 */
export function equipLegendary(picked, character, index) {
  if (!index) return picked
  let { chest, equipment } = returnMisfits(picked, character, index)
  for (const slot of SLOTS) {
    const fitting = chest.filter((item) => item.legendary && item.heldBy === null && item.slot === slot &&
      fitsCharacter(index.byId.get(item.entryId), character))
    if (fitting.length === 0) continue
    const best = fitting.reduce((chosen, item) => (isBetter(item, chosen) ? item : chosen))
    const plain = equipment[slot] ? findItem(chest, equipment[slot]) : null
    if (plain && effectiveGearLevel(plain) - effectiveGearLevel(best) > LEGENDARY_PICK_MARGIN) continue
    chest = swapHeld(chest, character.sessionId, plain?.id ?? null, best.id)
    equipment = { ...equipment, [slot]: best.id }
  }
  return { chest, equipment }
}
