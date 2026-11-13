// Every number the game engine is balanced with, in one place. The formulas that use them are
// in docs/GAME.md. Change a number here, then run `npm run simulate` to see what
// it does to progression before opening a pull request.

/** Tokens a session spends for one experience point. Calibrated against real usage later. */
export const TOKENS_PER_XP = 1000

/** Experience from level n to n + 1 is LEVEL_BASE * n ** LEVEL_EXPONENT, rounded. */
export const LEVEL_BASE = 100
export const LEVEL_EXPONENT = 1.6
/** A skill stops at this level and banks further experience until it is prestiged. */
export const SKILL_CAP = 99
/**
 * A character is one session and lives hours to a couple of days, so it has its own, faster
 * curve with no cap: level n to n + 1 costs CHARACTER_LEVEL_BASE * n ** CHARACTER_LEVEL_EXPONENT.
 * SEASONED_LEVEL then takes about 1.6 million tokens, a few hours of real work.
 */
export const CHARACTER_LEVEL_BASE = 30
export const CHARACTER_LEVEL_EXPONENT = 1
/** Each prestige star: more experience in that skill, and a stronger effect. */
export const STAR_XP_BONUS = 0.05
export const STAR_EFFECT_BONUS = 0.02

/** Power grows by this factor per effective level, for characters and monsters alike. */
export const POWER_GROWTH = 1.04
export const BASE_HIT = 10
/** Damage added per point of the class attribute. */
export const ATTRIBUTE_HIT_BONUS = 0.02
/** Each upgrade level multiplies an item's effect by this. */
export const GEAR_GROWTH = 1.1
/** One item tier is worth this many upgrade levels, in effect and in upgrade cost. */
export const TIER_LEVELS = 2
/**
 * The reference party's gear is worth this many upgrade levels per monster level, so gear is
 * about a fifth of a hit in an established world.
 */
export const REFERENCE_GEAR_PER_LEVEL = 0.125
/**
 * seasoning(1), rising to 1 at SEASONED_LEVEL. With the attribute points it has not earned yet,
 * a level 1 character does about three quarters of a seasoned one's work.
 */
export const NEWCOMER_SHARE = 0.88
export const SEASONED_LEVEL = 11
export const VETERAN_BONUS_PER_LEVEL = 0.005
/** Tokens per minute that count as a normal working pace, and the limits of the pace factor. */
export const REFERENCE_TOKENS_PER_MINUTE = 20_000
export const PACE_MIN = 0.25
export const PACE_MAX = 2

export const CLASS_HIT = { physical: 1.3, magical: 1.3, defense: 0.6, support: 0.5 }
export const SUPPORT_AURA = 0.15
export const FULL_PARTY_BONUS = 0.1
export const FULL_PARTY_CLASSES = 3
export const CRIT_BASE = 0.05
export const CRIT_PER_PRECISION = 0.005
export const CRIT_MAX = 0.5
export const CRIT_DAMAGE = 2
export const HASTE_PER_AGILITY = 0.01
/**
 * Points a character level gives: to the class attribute, to the attribute of the activity that
 * earned most during the level, and to "fortune", which alternates between precision (even
 * levels) and luck (odd levels) so crits and item drops grow without any input.
 */
export const CLASS_POINTS_PER_LEVEL = 1
export const ACTIVITY_POINTS_PER_LEVEL = 1
export const FORTUNE_POINTS_PER_LEVEL = 1
export const ATTRIBUTE_POINTS_PER_LEVEL =
  CLASS_POINTS_PER_LEVEL + ACTIVITY_POINTS_PER_LEVEL + FORTUNE_POINTS_PER_LEVEL
/** A new character's luck is 1 plus a hash of its session id modulo this: 1 to 4. */
export const STARTING_LUCK_SPREAD = 4

/** One combat tick is this much working time. A reference party kills in HITS_TO_KILL ticks. */
export const TICK_SECONDS = 10
export const HITS_TO_KILL = 24
/** Without defence or healing, a reference party's stamina lasts this many ticks. */
export const STAMINA_TICKS = 40
export const REST_SECONDS = 60
export const BOSS_EVERY = 10
export const ELITE_ONE_IN = 8
/** Off boss waves, a common monster about half the time; the rest split between the two resistant kinds. */
export const COMMON_SHARE = 0.5
export const ARMORED_SHARE = 0.25
/**
 * A reference party's stamina at level 0. Drain and healing are both shares of the pool, so
 * this only sets the scale of the numbers shown; 1000 keeps them readable at low levels.
 */
export const STAMINA_BASE = 1000
/**
 * Mitigation is MITIGATION_CAP * R / (R + MITIGATION_HALF_RESILIENCE) for a total resilience R:
 * one point blocks 16%, eleven (a level 20 defender) 59%, and it never passes 80%.
 */
export const MITIGATION_CAP = 0.8
export const MITIGATION_HALF_RESILIENCE = 4
/**
 * Healing per tick is HEAL_CAP_SHARE * M / (M + HEAL_HALF_MEDICINE) of the stamina pool for a
 * total medicine M: one point heals 2.4%. Never above 6%.
 */
export const HEAL_CAP_SHARE = 0.06
export const HEAL_HALF_MEDICINE = 1.5
/** A regenerating monster heals this share of its health each tick it survives. */
export const REGENERATING_SHARE = 0.01
/** An enraged monster's attack rises with the health it lost, up to this much more near death. */
export const ENRAGED_MAX_BONUS = 1
/** A thorny monster turns this share of the health it loses into the same share of lost stamina. */
export const THORNY_SHARE = 0.5
/** A swift monster strikes this much harder. */
export const SWIFT_ATTACK = 1.5

export const MONSTER_KINDS = {
  common: { hp: 1, attack: 1, physical: 1, magical: 1, reward: 1 },
  armored: { hp: 1, attack: 1, physical: 0.5, magical: 1.5, reward: 1.2 },
  ethereal: { hp: 1, attack: 1, physical: 1.5, magical: 0.5, reward: 1.2 },
  boss: { hp: 4, attack: 1.5, physical: 1, magical: 1, reward: 5 }
}
export const ELITE = { hp: 1.5, reward: 3 }

/** Units an idle character gathers per hour before bonuses, and when gathering stops. */
export const GATHER_PER_HOUR = 20
export const GATHER_SKILL_BONUS = 0.04
export const GATHER_STOPS_AFTER_HOURS = 8
export const REWARD_BASE = 10
export const REWARD_GROWTH = 1.03
/** The chance of an item drop: a base, a bonus per point of luck, a cap, and the elite factor. */
export const ITEM_DROP_BASE = 0.05
export const ITEM_DROP_PER_LUCK = 0.005
export const ITEM_DROP_MAX = 0.5
export const ELITE_ITEM_DROP_FACTOR = 3

/**
 * Upgrading an item of effective gear level e costs UPGRADE_COST_BASE * UPGRADE_COST_GROWTH ** e
 * of each of its two recipe materials, so a higher tier costs more to upgrade.
 */
export const UPGRADE_COST_BASE = 50
export const UPGRADE_COST_GROWTH = 1.35
export const ITEM_MAX_TIER = 10
/** A workbench of level L divides upgrade costs by 1 + WORKBENCH_DISCOUNT_PER_LEVEL * L. */
export const WORKBENCH_DISCOUNT_PER_LEVEL = 0.05
export const RETIREE_BONUS = 0.01
export const RETIREE_BONUS_MAX = 0.25
export const RETIREES_KEPT = 50
