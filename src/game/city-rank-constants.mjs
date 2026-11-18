// The numbers of city ranks (docs/GAME.md, "City ranks"), kept apart from constants.mjs so their
// balance reads in one place. Every one was set with `npm run simulate`; the reasons are below.
import { STALL_OFFERS } from './constants.mjs'

/** A city starts at rank I and grows to rank V; the save keeps ranks II to V. */
export const CITY_RANK_MAX = 5

/**
 * The standing a city needs before its charter for each rank can be bought, by rank (index 0 is
 * rank I, which every city has). Standing is what a world traded there: every unit sold or bought
 * counts its base value, every stall purchase its price, each divided by REWARD_GROWTH **
 * worldLevel at the time, so standing grows at the same pace at every level, like the prices it is
 * measured against. Cumulative: rank V needs the whole sum traded since rank I.
 */
export const CITY_STANDING = [0, 3000, 25000, 120000, 500000]

/**
 * A charter's price for each rank (index 0 unused), in coins and in units of each material the
 * city wants, both times REWARD_GROWTH ** worldLevel, rounded, at least 1: steep and growing like
 * every price, so the last rank of every city is a goal of many months for a regular player.
 */
export const CHARTER_COINS = [0, 500, 2000, 6000, 15000]
export const CHARTER_UNITS = [0, 100, 400, 1200, 3000]

/**
 * Each rank above the first takes this off the market's fee in that city, after the Storehouse.
 * At rank V the fee is two points lower; whatever the fee, a sale still pays less than base value
 * and a purchase costs more, so no trade can make money.
 */
export const CITY_RANK_FEE_CUT = 0.005

/** From this rank a city's stall offers one more piece of gear a day. */
export const EXTRA_OFFER_RANK = 2
/** From this rank a city's stall sells gear one tier higher. */
export const TIER_BONUS_RANK = 3
/** From this rank a city's stall offers one of its relics more often. */
export const RELIC_RANK = 4
/** The day's chance of a relic at the stall from RELIC_RANK, instead of STALL_RELIC_CHANCE. */
export const RANKED_RELIC_CHANCE = 0.4
/** At this rank a city's stall now and then sells legendary equipment of its own list. */
export const LEGENDARY_RANK = 5
/** The day's chance that a rank V city's stall offers one of its legendary pieces. */
export const STALL_LEGENDARY_CHANCE = 0.2
/**
 * A stall's legendary piece costs this times REWARD_GROWTH ** worldLevel coins, rounded: twice a
 * stall relic, since the piece comes upgraded to the reference gear of the world.
 */
export const STALL_LEGENDARY_PRICE_BASE = 6000

/**
 * The places of a ranked stall's offers among the day's: the gear's come first (0 to
 * STALL_OFFERS - 1), the relic's at STALL_OFFERS, then the extra piece of gear and the legendary
 * piece, so the indexes saves already keep never change meaning.
 */
export const EXTRA_OFFER_INDEX = STALL_OFFERS + 1
export const LEGENDARY_OFFER_INDEX = STALL_OFFERS + 2
export const LAST_OFFER_INDEX = LEGENDARY_OFFER_INDEX
