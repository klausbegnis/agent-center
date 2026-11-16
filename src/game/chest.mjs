// A project's chest: the items its characters share. A new character takes the best free item of
// each slot; a retiring one puts its items back.
import { effectiveGearLevel } from './items.mjs'

/** The weapon damage type of each class (docs/GAME.md, "Power"). */
const CLASS_DAMAGE_TYPE = { magical: 'magical' }
const DEFAULT_DAMAGE_TYPE = 'physical'

/** @param {string} characterClass */
function damageTypeOf(characterClass) {
  return CLASS_DAMAGE_TYPE[characterClass] ?? DEFAULT_DAMAGE_TYPE
}

/**
 * Most powerful first (effective gear level), then highest tier, then highest level, then id,
 * so the order never depends on the chest's.
 *
 * @param {{ id: string, tier: number, level: number }} item
 * @param {{ id: string, tier: number, level: number }} other
 * @returns {boolean} whether `item` comes before `other`
 */
export function isBetter(item, other) {
  const power = effectiveGearLevel(item) - effectiveGearLevel(other)
  if (power !== 0) return power > 0
  if (item.tier !== other.tier) return item.tier > other.tier
  if (item.level !== other.level) return item.level > other.level
  return item.id < other.id
}

/**
 * @param {object[]} chest
 * @param {string} id
 * @returns {object | null}
 */
export function findItem(chest, id) {
  return chest.find((item) => item.id === id) ?? null
}

/**
 * The best item of the slot that nobody holds. `damageType` only narrows weapons.
 *
 * @param {object[]} chest
 * @param {{ slot: string, damageType?: string }} wanted
 * @returns {object | null}
 */
export function bestFreeItem(chest, { slot, damageType }) {
  let best = null
  for (const item of chest) {
    if (item.heldBy !== null || item.slot !== slot) continue
    if (slot === 'weapon' && damageType && item.damageType !== damageType) continue
    if (!best || isBetter(item, best)) best = item
  }
  return best
}

/**
 * Gives a character the best free weapon of its class's damage type, outfit and tool, and marks
 * them as held by its session.
 *
 * @param {object[]} chest
 * @param {{ sessionId: string, class: string }} character
 * @returns {{ chest: object[], equipment: { weapon: string | null, outfit: string | null,
 *   tool: string | null } }}
 */
export function equipFromChest(chest, { sessionId, class: characterClass }) {
  const picks = {
    weapon: bestFreeItem(chest, { slot: 'weapon', damageType: damageTypeOf(characterClass) }),
    outfit: bestFreeItem(chest, { slot: 'outfit' }),
    tool: bestFreeItem(chest, { slot: 'tool' })
  }
  const takenIds = new Set(Object.values(picks).filter(Boolean).map((item) => item.id))
  return {
    chest: chest.map((item) => (takenIds.has(item.id) ? { ...item, heldBy: sessionId } : item)),
    equipment: {
      weapon: picks.weapon?.id ?? null,
      outfit: picks.outfit?.id ?? null,
      tool: picks.tool?.id ?? null
    }
  }
}

/**
 * @param {object[]} chest
 * @param {string} sessionId
 * @returns {object[]} the chest with every item that session held free again
 */
export function releaseItems(chest, sessionId) {
  return chest.map((item) => (item.heldBy === sessionId ? { ...item, heldBy: null } : item))
}

/**
 * Puts an item in the chest. Equipment refers to items by id, so a second copy of the same entry
 * gets a numbered id (`brass-multitool-2`); `entryId` still names the content entry.
 *
 * @param {object[]} chest
 * @param {object} item
 * @returns {object[]}
 */
export function addToChest(chest, item) {
  const ids = new Set(chest.map((owned) => owned.id))
  if (!ids.has(item.id)) return [...chest, item]
  let copy = 2
  while (ids.has(`${item.id}-${copy}`)) copy++
  return [...chest, { ...item, id: `${item.id}-${copy}`, entryId: item.entryId ?? item.id }]
}
