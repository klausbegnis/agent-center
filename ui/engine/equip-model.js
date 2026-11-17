// What a character's slot picker on the Party tab offers, worked out from the view state: the
// items of the room's chest that fit the slot, best first, each with what it changes and whether
// it can be taken (free, swapped with its holder, or not at all and why). The same rules as the
// worker's src/game/equip.mjs; the worker checks again. Never touches the DOM.
import { roomCharacters } from './game-model.js'
import { legendaryDetails } from './legendary-model.js'

/** The equipment slots, in the order they are shown. */
export const EQUIP_SLOTS = Object.freeze(['weapon', 'outfit', 'tool'])
/** The choice that hands a slot back to the automatic pick. */
export const AUTO_CHOICE = 'auto'

/** The weapon damage type a class can use. */
export const weaponTypeOf = (characterClass) => (characterClass === 'magical' ? 'magical' : 'physical')

/** Whether a character of a class can use an item in its slot. */
export const canUse = (characterClass, item) =>
  item.slot !== 'weapon' || item.damageType === weaponTypeOf(characterClass)

/**
 * Whether a character may hold an item, the worker's rule (`mayHold` in legendary-equip.mjs): it
 * can use it, and a legendary item is made for its class or, for a tool, the trade it gathers.
 *
 * @param {object | undefined} game the view state's game, for the legendary entries
 * @param {{ class: string, trade?: string | null }} character
 * @param {object} item
 */
export function mayHold(game, character, item) {
  if (!canUse(character.class, item)) return false
  if (!item.legendary) return true
  const entry = game?.legendary?.entries?.[item.entryId]
  if (!entry) return false
  return entry.slot === 'tool' ? entry.trade === character.trade : entry.class === character.class
}

/** Strongest first (effective gear level), then tier, then level, then id: the chest's own order. */
function byStrength(a, b) {
  return (b.power ?? 0) - (a.power ?? 0) || b.tier - a.tier || b.level - a.level ||
    String(a.id).localeCompare(String(b.id))
}

/**
 * The choices of a character's slot: every item of the room's chest that fits, best first, each
 * `{ item, isCurrent, change, holder, take, legendary }` where `change` is its power against the
 * current item's (the current one counts as 0 when the slot is empty), `holder` the name of who
 * holds it (null when free), `take` is 'equipped', 'free', 'swap', 'refused' (a swap the holder
 * could not take) or 'unfit' (a legendary item made for another class or trade), and
 * `legendary` a legendary item's entry with its buff in words, or null.
 *
 * @param {{ state: object, roomId: string, room: { chest?: object[] }, character: object,
 *   slot: string }} where
 * @returns {{ item: object, isCurrent: boolean, change: number, holder: string | null,
 *   take: 'equipped' | 'free' | 'swap' | 'refused' | 'unfit', legendary: object | null }[]}
 */
export function slotChoices({ state, roomId, room, character, slot }) {
  const chest = room.chest ?? []
  const currentId = character.equipment?.[slot]?.id ?? null
  const current = chest.find((item) => item.id === currentId) ?? null
  const base = current?.power ?? 0
  const members = roomCharacters(state, roomId).members
  const memberOf = (sessionId) => members.find((member) => member.character.sessionId === sessionId) ?? null
  return chest
    .filter((item) => item.slot === slot && canUse(character.class, item))
    .sort(byStrength)
    .map((item) => {
      const isCurrent = item.id === currentId
      const holderMember = item.heldBy && !isCurrent ? memberOf(item.heldBy) : null
      let take = isCurrent ? 'equipped' : 'free'
      if (!isCurrent && item.heldBy) {
        // The holder gets what this character holds there now, or nothing.
        const usable = holderMember && (!current || mayHold(state.game, holderMember.character, current))
        take = usable ? 'swap' : 'refused'
      }
      if (!isCurrent && !mayHold(state.game, character, item)) take = 'unfit'
      const holder = isCurrent || !item.heldBy ? null : holderMember?.agent.name ?? ''
      const legendary = legendaryDetails(state.game, item)
      return { item, isCurrent, change: (item.power ?? 0) - base, holder, take, legendary }
    })
}

/** Whether a slot was chosen by hand. */
export const isPinned = (character, slot) => character.pinned?.[slot] === true

/**
 * The option an arrow key moves to in the picker's list of buttons, or null for a key it ignores.
 *
 * @param {number} index the focused option
 * @param {string} key
 * @param {number} count
 */
export function optionAfter(index, key, count) {
  if (count === 0) return null
  if (key === 'ArrowDown' || key === 'ArrowRight') return (index + 1) % count
  if (key === 'ArrowUp' || key === 'ArrowLeft') return (index - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}
