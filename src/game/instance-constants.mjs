// The numbers of instances (docs/GAME.md, "Instances"), kept apart from constants.mjs so the run's
// balance reads in one place. Every one was set with `npm run simulate`; the reasons are below.

/**
 * A run's monsters stand this many levels above the world's at tier 1, about where a room's wave
 * settles (three to eight above), so the first run feels like the waves the party knows.
 */
export const INSTANCE_FIRST_LEVELS = 3
/** Each tier above the first adds this many levels: health, drain and rewards grow with them. */
export const INSTANCE_TIER_LEVELS = 2
/** The instance's boss has this much more health than a wave's boss of its level. */
export const INSTANCE_BOSS_HP = 1.5
/** The rank of the elite's chamber: the instance's mini-boss fights as a champion with an affix. */
export const INSTANCE_ELITE_RANK = 'champion'
/** The hall's fights in a row, unless the tier's modifier says otherwise. */
export const INSTANCE_HALL_FIGHTS = 3
/** One hall monster in this many is a veteran; the rest are plain. */
export const INSTANCE_VETERAN_ONE_IN = 3

/** Failed tries on one room before the run ends. */
export const INSTANCE_TRIES = 3
/**
 * A try at a room lasts at most this many times the ticks a reference party of the world's level
 * needs to kill its monsters (HITS_TO_KILL by their health). Rests count: a party that runs out of
 * stamina too often, or hits too softly for the tier, runs out of time, rests and starts the room
 * over. 4 lets a lone defender, the weakest hitter, clear tier 1 with its rests even against a
 * monster that resists its damage; at 2.5 it failed the first room.
 */
export const INSTANCE_TRY_SLACK = 4

/**
 * A trap's or puzzle's check passes when the party's score reaches the difficulty times a roll
 * between CHECK_ROLL_LOW and CHECK_ROLL_LOW + CHECK_ROLL_SPAN. A score of 1 (a reference
 * character's attribute, or a work skill at the world level) passes 4 times in 5 at tier 1.
 */
export const INSTANCE_CHECK_DIFFICULTY = 0.8
/** Each tier above the first makes the check this share harder. */
export const INSTANCE_CHECK_TIER_STEP = 0.1
export const CHECK_ROLL_LOW = 0.6
export const CHECK_ROLL_SPAN = 0.8
/** A sprung trap takes this share of the party's stamina pool; the party moves on. */
export const INSTANCE_TRAP_STAMINA = 0.35
/** A failed puzzle is tried again after this many ticks of working time, and costs a try. */
export const INSTANCE_PUZZLE_RETRY_TICKS = 6
/** A passed check finds materials worth this many plain kills of the run's level. */
export const INSTANCE_CHECK_BONUS_KILLS = 2

/**
 * The vault waits this many ticks of working time (five minutes) for a boon to be chosen, then
 * takes the first one offered: the game never stalls waiting for a person.
 */
export const INSTANCE_VAULT_WAIT_TICKS = 30
/**
 * After a failed or recalled run the room waits this much working time (fighting waves) before it
 * may enter that instance again: two hours, so a failure costs a little and a retry comes the same day.
 */
export const INSTANCE_COOLDOWN_MS = 2 * 60 * 60 * 1000

/**
 * A clear's purse: materials worth this many plain kills of the run's level, split by the
 * instance's loot, this share more for each tier above the first, and coins. Set with the
 * simulator so an hour inside pays about what an hour on the waves does (88 to 117%).
 */
export const INSTANCE_PURSE_KILLS = 16
export const INSTANCE_PURSE_TIER_STEP = 0.05
/** The purse's coins: this many times REWARD_GROWTH ** level, with the same tier factor. */
export const INSTANCE_PURSE_COINS = 40
/** The vault's loot: materials worth this many plain kills of the run's level. */
export const INSTANCE_VAULT_KILLS = 3
/**
 * The instance's boss leaves its own item with this chance, plus this much for each tier above
 * the first, up to the most, with no pity: a run meets its boss about once a working day, so with
 * the waves' pity (5% a miss) and 10% + 1% a tier a light user owned 18 of 40 legendary items in a
 * year and a heavy one 33. At these odds the collection is a goal of several years (docs/GAME.md,
 * "Instances"), and a run's boss is a rarer source than a wave's boss (BOSS_ITEM_CHANCE).
 */
export const INSTANCE_BOSS_ITEM_CHANCE = 0.004
export const INSTANCE_BOSS_ITEM_TIER_STEP = 0.0008
export const INSTANCE_BOSS_ITEM_MAX = 0.012
/**
 * The vault holds a legendary item of its pool with this chance, more at higher tiers, up to the
 * most: rare, so a run that pays one is news (about one run in two hundred).
 */
export const INSTANCE_VAULT_ITEM_CHANCE = 0.003
export const INSTANCE_VAULT_ITEM_TIER_STEP = 0.0005
export const INSTANCE_VAULT_ITEM_MAX = 0.01
/** A clear credits each of the instance's races with this many champion kills per tier. */
export const INSTANCE_BESTIARY_CHAMPIONS = 1
/**
 * A room that already owns the instance's relic when it first clears it gets coins instead:
 * this many times REWARD_GROWTH ** level, the price of a city's relic (STALL_RELIC_PRICE_BASE).
 */
export const INSTANCE_RELIC_COINS = 3000
