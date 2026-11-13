// Every number the game engine is balanced with, in one place. The formulas that use them are
// in docs/GAME.md. Change a number here, then run `node scripts/simulate-game.mjs` to see what
// it does to progression before opening a pull request.

/** Tokens a session spends for one experience point. Calibrated against real usage later. */
export const TOKENS_PER_XP = 1000

/** Experience from level n to n + 1 is LEVEL_BASE * n ** LEVEL_EXPONENT, rounded. */
export const LEVEL_BASE = 100
export const LEVEL_EXPONENT = 1.6
/** A skill stops at this level and banks further experience until it is prestiged. */
export const SKILL_CAP = 99
/** Past the cap a character's next level costs the cap's cost times this, per level. */
export const POST_CAP_GROWTH = 1.01
/** Each prestige star: more experience in that skill, and a stronger effect. */
export const STAR_XP_BONUS = 0.05
export const STAR_EFFECT_BONUS = 0.02

/** Power grows by this factor per effective level, for characters and monsters alike. */
export const POWER_GROWTH = 1.04
export const BASE_HIT = 10
/** Damage added per point of the class attribute, and per upgrade level of a weapon. */
export const ATTRIBUTE_HIT_BONUS = 0.02
export const GEAR_LEVEL_BONUS = 0.05
/** A new character does this share of a seasoned one's work, reaching 1 at SEASONED_LEVEL. */
export const NEWCOMER_SHARE = 0.75
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
export const ATTRIBUTE_POINTS_PER_LEVEL = 3

/** One combat tick is this much working time. A reference party kills in HITS_TO_KILL ticks. */
export const TICK_SECONDS = 10
export const HITS_TO_KILL = 24
/** Without defence or healing, a reference party's stamina lasts this many ticks. */
export const STAMINA_TICKS = 40
export const REST_SECONDS = 60
export const BOSS_EVERY = 10
export const ELITE_ONE_IN = 8

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

export const UPGRADE_COST_BASE = 50
export const UPGRADE_COST_GROWTH = 1.35
export const RETIREE_BONUS = 0.01
export const RETIREE_BONUS_MAX = 0.25
export const RETIREES_KEPT = 50
