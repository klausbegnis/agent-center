// What the Party, Chest and Camp tabs show, worked out from the view state: the order of the
// chest's slots, which materials a price on screen is short of, and what an upgrade changes.
// Never touches the DOM.
import { hash } from './hash.js'
import { missingMaterials } from './game-format.js'

/** The chest's slots are ordered by kind: weapons, then outfits, then tools. */
const SLOT_ORDER = ['weapon', 'outfit', 'tool']
const slotRank = (slot) => {
  const rank = SLOT_ORDER.indexOf(slot)
  return rank < 0 ? SLOT_ORDER.length : rank
}

/**
 * The chest's items in the order its slots show them: weapons, outfits, then tools; within each,
 * the held ones first, then the highest tier, then the highest level, then by id so the order
 * never changes between two equal items.
 *
 * @template {{ id: string, slot: string, tier: number, level: number, heldBy?: string | null }} Item
 * @param {Item[] | undefined} chest
 * @returns {Item[]}
 */
export function chestOrder(chest) {
  return [...(chest ?? [])].sort(
    (first, second) =>
      slotRank(first.slot) - slotRank(second.slot) ||
      Number(Boolean(second.heldBy)) - Number(Boolean(first.heldBy)) ||
      second.tier - first.tier ||
      second.level - first.level ||
      String(first.id).localeCompare(String(second.id))
  )
}

/** The chest always shows this many slots at least, so even a new chest reads as a container. */
const MIN_CHEST_SLOTS = 12
/** Empty slots drawn after the last item, so a full-looking chest still shows room in it. */
const EMPTY_SLOTS_AFTER = 4
/** Slots are padded to whole rows of this many, the columns of a 380 px panel. */
const SLOTS_PER_ROW = 6

/** How many slots the chest draws for this many items: the items, then a few empty ones. */
export function chestSlotCount(itemCount) {
  const wanted = Math.max(MIN_CHEST_SLOTS, itemCount + EMPTY_SLOTS_AFTER)
  return Math.ceil(wanted / SLOTS_PER_ROW) * SLOTS_PER_ROW
}

/**
 * The slot a key press moves to in a grid of slots read row by row, or null for a key the grid
 * ignores. Arrows stop at the edges instead of wrapping, as in a grid people scan by sight.
 *
 * @param {number} index the slot that has the focus
 * @param {string} key a KeyboardEvent key
 * @param {number} count how many slots can take the focus
 * @param {number} columns how many slots a row holds as laid out now
 */
export function slotAfterKey(index, key, count, columns) {
  const perRow = Math.max(1, columns)
  const moves = {
    ArrowRight: index + 1,
    ArrowLeft: index - 1,
    ArrowDown: index + perRow,
    ArrowUp: index - perRow,
    Home: 0,
    End: count - 1
  }
  if (!Object.hasOwn(moves, key)) return null
  const next = moves[key]
  return next >= 0 && next < count ? next : index
}

/** How many variations of each slot icon there are, so items of one kind still look apart. */
const ITEM_VARIANTS = 6
/** The hue turn between two variations, small enough that a sword still looks like a sword. */
const VARIANT_TURN_DEGREES = 28

/**
 * The hue turn an item's icon is drawn with, from its id, so the same item always looks the same
 * and two items of one kind rarely look alike. Between -70 and +70 degrees.
 *
 * @param {string} itemId
 */
export function itemHueTurn(itemId) {
  const variant = hash(itemId) % ITEM_VARIANTS
  return (variant - (ITEM_VARIANTS - 1) / 2) * VARIANT_TURN_DEGREES
}

/** Tiers run from 1 to this; a tier out of range is drawn as the nearest one. */
export const MAX_TIER = 10

/** A tier as one of the drawn tiers, 1 to MAX_TIER. */
export function tierStep(tier) {
  const whole = Math.round(Number(tier) || 1)
  return Math.min(MAX_TIER, Math.max(1, whole))
}

/**
 * The materials short for the prices on screen, each with how many of those prices it holds
 * back and the most that any of them still needs.
 *
 * @param {(Record<string, number> | null | undefined)[]} costs
 * @param {Record<string, number>} materials what the world has
 * @returns {Map<string, { prices: number, most: number }>}
 */
export function shortMaterials(costs, materials) {
  const short = new Map()
  for (const cost of costs) {
    for (const { id, amount } of missingMaterials(cost, materials)) {
      const known = short.get(id) ?? { prices: 0, most: 0 }
      short.set(id, { prices: known.prices + 1, most: Math.max(known.most, amount) })
    }
  }
  return short
}

/**
 * The game's numbers the UI needs to say what the next level of something gives. The view state
 * gives what an upgrade does now, not at the next level; these mirror src/game/constants.mjs,
 * and a test fails when the two drift apart.
 */
export const GAME_NUMBERS = {
  gearGrowth: 1.1,
  tierLevels: 2,
  campfireMax: 0.6,
  campfireHalf: 5,
  runeCircleMax: 0.2,
  runeCircleHalf: 10,
  workbenchDiscountPerLevel: 0.05
}

/**
 * What an item multiplies its effect by now and after one more level: hits for a weapon, the
 * party's stamina for an outfit, gathering for a tool.
 *
 * @param {{ tier: number, level: number, power?: number }} item
 * @returns {{ now: number, next: number }}
 */
export function itemFactors(item) {
  const power = Number.isFinite(item.power)
    ? item.power
    : item.level + GAME_NUMBERS.tierLevels * (tierStep(item.tier) - 1)
  const now = GAME_NUMBERS.gearGrowth ** power
  return { now, next: now * GAME_NUMBERS.gearGrowth }
}

/** A share that approaches its ceiling without reaching it: MAX * L / (L + HALF). */
const approaching = (max, half, level) => (level > 0 ? (max * level) / (level + half) : 0)

/**
 * A group upgrade's effect at a level, in the shape the view state gives it.
 *
 * @param {string} upgradeId campfire, workbench or runeCircle
 * @param {number} level
 */
export function groupEffectAt(upgradeId, level) {
  const numbers = GAME_NUMBERS
  if (upgradeId === 'campfire') {
    return { staminaAfterKill: approaching(numbers.campfireMax, numbers.campfireHalf, level) }
  }
  if (upgradeId === 'runeCircle') {
    return { monsterHealthCut: approaching(numbers.runeCircleMax, numbers.runeCircleHalf, level) }
  }
  if (upgradeId === 'workbench') {
    return { upgradeCostFactor: 1 / (1 + numbers.workbenchDiscountPerLevel * level) }
  }
  return {}
}

/**
 * The costs whose missing materials the strip marks for a tab: the chosen item's on Chest, every
 * group upgrade's on Camp, none elsewhere.
 *
 * @param {string} tab
 * @param {{ chosenItem: object | null, upgrades: object[] }} onScreen
 */
export function costsOnScreen(tab, { chosenItem, upgrades }) {
  if (tab === 'chest') return chosenItem ? [chosenItem.upgradeCost] : []
  if (tab === 'camp') return (upgrades ?? []).map((upgrade) => upgrade.cost)
  return []
}
