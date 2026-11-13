// Item drops: which content entry a kill drops, and how a drop goes into a project's chest
// without the chest growing forever. Pure; the same seed always drops the same item.
import { addToChest } from './chest.mjs'
import { COPIES_PER_ITEM, DROP_SLOT_WEIGHTS, ITEM_MAX_TIER, TIER_LEVELS } from './constants.mjs'
import { hashOf } from './hash.mjs'
import { createItem } from './items.mjs'
import { referenceGearLevel } from './power.mjs'
import { CLASSES } from './skills.mjs'

/**
 * The highest tier a monster of this level drops: the tier whose head start is still within the
 * reference gear of that level. A drop helps a project catch up; it never jumps ahead.
 *
 * @param {number} level
 * @returns {number}
 */
export function dropTier(level) {
  const tier = 1 + Math.floor(referenceGearLevel(level) / TIER_LEVELS)
  return Math.min(ITEM_MAX_TIER, Math.max(1, tier))
}

/** A slot picked by hash with DROP_SLOT_WEIGHTS. */
function slotFor(seed) {
  const slots = Object.keys(DROP_SLOT_WEIGHTS)
  const total = slots.reduce((sum, slot) => sum + DROP_SLOT_WEIGHTS[slot], 0)
  let roll = hashOf(`${seed}|slot`) % total
  for (const slot of slots) {
    if (roll < DROP_SLOT_WEIGHTS[slot]) return slot
    roll -= DROP_SLOT_WEIGHTS[slot]
  }
  return slots[0]
}

/** A weapon's damage type: that of a class picked by hash, so drops follow a party's needs. */
function damageTypeFor(seed) {
  const className = CLASSES[hashOf(`${seed}|class`) % CLASSES.length]
  return className === 'magical' ? 'magical' : 'physical'
}

const fitsTheme = (entry, themeId) => entry.themes === undefined || entry.themes.includes(themeId)

/**
 * The content entry a kill drops: a slot and damage type by hash, then the highest tier up to
 * `dropTier(level)` among the generic entries and the room theme's own, picked by hash on a tie.
 *
 * @param {{ items: object[] }} content a valid items file
 * @param {{ level: number, themeId: string | null, seed: string }} roll
 * @returns {object | null} null when no entry fits
 */
export function droppedEntry(content, { level, themeId, seed }) {
  const slot = slotFor(seed)
  const damageType = slot === 'weapon' ? damageTypeFor(seed) : undefined
  const maxTier = dropTier(level)
  const fitting = content.items.filter((entry) => entry.slot === slot && fitsTheme(entry, themeId) &&
    entry.tier <= maxTier && (damageType === undefined || entry.damageType === damageType))
  if (fitting.length === 0) return null
  const bestTier = Math.max(...fitting.map((entry) => entry.tier))
  const best = fitting.filter((entry) => entry.tier === bestTier)
  return best[hashOf(`${seed}|entry`) % best.length]
}

/**
 * Puts a dropped entry in the chest. Below COPIES_PER_ITEM copies of the entry it is a new copy
 * at level 0; past that the lowest copy gains an upgrade level instead, so nothing is lost and
 * the chest stays small.
 *
 * @param {object[]} chest
 * @param {object} entry
 * @returns {object[]}
 */
export function addDrop(chest, entry) {
  const copies = chest.filter((item) => (item.entryId ?? item.id) === entry.id)
  if (copies.length < COPIES_PER_ITEM) return addToChest(chest, createItem(entry))
  const lowest = copies.reduce((low, item) => (item.level < low.level ? item : low))
  return chest.map((item) => (item === lowest ? { ...item, level: item.level + 1 } : item))
}
