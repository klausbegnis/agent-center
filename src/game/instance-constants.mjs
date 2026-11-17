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
