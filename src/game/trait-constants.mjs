// The numbers of traits (docs/GAME.md, "Traits"), kept apart from constants.mjs so their balance
// reads in one place. Every one was set with `npm run simulate`; the reasons are below.

/** The trait tiers, weakest first. */
export const TRAIT_TIERS = Object.freeze(['common', 'rare', 'epic', 'mythic'])

/**
 * A character carries one trait from birth and earns another slot at each of these levels. Retired
 * characters reach level 26 to 45 in the simulator, so most end with three slots and long
 * sessions with four.
 */
export const TRAIT_SLOT_LEVELS = Object.freeze([10, 20, 30])
/** The most traits a character carries: the one it is born with and one per milestone. */
export const MAX_TRAIT_SLOTS = 1 + TRAIT_SLOT_LEVELS.length

/** The tier a new character is born with, by weight: mostly common, now and then better, never mythic. */
export const BORN_TIER_WEIGHTS = Object.freeze({ common: 88, rare: 11, epic: 1 })

/**
 * A trait scroll drops from a kill of these ranks with this chance, times (1 + scrollFind of the
 * party). Elites and champions give a scroll now and then; bosses are the main source of the
 * better tiers. A light user finds a few a year, a heavy one a few dozen.
 */
export const SCROLL_DROP_CHANCE = Object.freeze({ elite: 0.004, champion: 0.01, boss: 0.05, legendary: 0.15 })
/** The tier of a dropped scroll, by weight, for each rank that drops one. */
export const SCROLL_TIER_WEIGHTS = Object.freeze({
  elite: { common: 80, rare: 20 },
  champion: { common: 55, rare: 40, epic: 5 },
  boss: { rare: 60, epic: 35, mythic: 5 },
  legendary: { rare: 30, epic: 50, mythic: 20 }
})

/** A room keeps at most this many scrolls of one trait; one more is sold at the broker's price. */
export const SCROLL_COPIES = 5

/** A city's trait broker offers this many scrolls a day, each a different trait of the city. */
export const BROKER_OFFERS = 3
/** The tier of a broker's offer, by weight: mythic traits are never sold. */
export const BROKER_TIER_WEIGHTS = Object.freeze({ common: 70, rare: 27, epic: 3 })
/**
 * A scroll costs this many coins times REWARD_GROWTH ** worldLevel, like a stall relic, so it stays
 * a choice at every level. A light user makes a few thousand coins a year and buys a handful of
 * commons; a heavy user can buy every offer, which the daily stock and the tiers keep a long way
 * from the whole catalogue.
 */
export const BROKER_PRICES = Object.freeze({ common: 150, rare: 600, epic: 3000, mythic: 12000 })
/** The broker pays this share of a scroll's price for one sold to it. */
export const BROKER_SELL_SHARE = 0.25
/** Swapping a trait out (it comes back as a scroll) costs this share of its price. */
export const SWAP_FEE_SHARE = 0.25

/**
 * What one character's traits may add together, by type, before the other sources (relic,
 * equipment, bestiary, settlement) are added under LEGENDARY_EFFECT_CAPS. About a third to a half
 * of a type's whole cap: traits make a character individual, not a different class.
 * `raceDrop`, `scrollFind` and `brokerDiscount` are traits' own types; they are capped over the
 * party (raceDrop, scrollFind) or over the world's living characters (brokerDiscount).
 */
export const TRAIT_EFFECT_CAPS = Object.freeze({
  damage: 0.05,
  attackSpeed: 0.04,
  critChance: 0.02,
  staminaDrain: 0.05,
  outfitStamina: 0.04,
  healing: 0.06,
  supportAura: 0.08,
  gatherYield: 0.1,
  skillXp: 0.08,
  characterXp: 0.04,
  raceDamage: 0.06,
  raceDrop: 0.3,
  scrollFind: 0.6,
  brokerDiscount: 0.2
})
