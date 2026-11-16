// Every number the game engine is balanced with, in one place. The formulas that use them are
// in docs/GAME.md. Change a number here, then run `npm run simulate` to see what
// it does to progression before opening a pull request.

/** Tokens a session spends for one experience point. Calibrated against real usage later. */
export const TOKENS_PER_XP = 1000

/**
 * Experience from level n to n + 1 is LEVEL_BASE * n ** LEVEL_EXPONENT, rounded. Linear, so the
 * total grows with the square of the level and the late levels are not a wall.
 */
export const LEVEL_BASE = 125
export const LEVEL_EXPONENT = 1
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
/**
 * A character fights at its world's level, like the monsters, and its class skill adds a
 * bounded factor: (effective level of the class skill / world level) ** CLASS_SKILL_WEIGHT.
 * The five skills drift apart in proportion (one can be twice another), so a class skill used
 * as a level of its own would make one class many times too strong.
 */
export const CLASS_SKILL_WEIGHT = 0.5
export const BASE_HIT = 10
/**
 * Engineering is the party's attack speed: every working character's hit is multiplied by
 * (effective level of engineering / world level) ** ENGINEERING_SPEED_WEIGHT times its star
 * effect, kept between ENGINEERING_SPEED_MIN and ENGINEERING_SPEED_MAX. It touches the whole
 * party, so it is bounded more tightly than a class skill: a world that never runs a command
 * is slowed, never stopped. The reference party monsters are measured against uses 1.
 */
export const ENGINEERING_SPEED_WEIGHT = 0.35
export const ENGINEERING_SPEED_MIN = 0.6
export const ENGINEERING_SPEED_MAX = 1.5
/** Damage added per point of the class attribute. */
export const ATTRIBUTE_HIT_BONUS = 0.02
/** Each upgrade level multiplies an item's effect by this. */
export const GEAR_GROWTH = 1.1
/** One item tier is worth this many upgrade levels, in effect and in upgrade cost. */
export const TIER_LEVELS = 2
/**
 * The reference party's gear is worth this many upgrade levels per monster level (one every
 * eight levels), so gear is about a fifth of a hit in an established world.
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
export const PACE_MAX = 1.5
/**
 * The token estimate, for an Orca whose session history gives no token totals. An agent working
 * one minute at ESTIMATE_TOOL_CALLS_PER_MINUTE, at an activity of weight 1, is estimated at
 * ESTIMATE_TOKENS_PER_WORKING_MINUTE: the 25,000 the simulator assumes, so its progression still
 * describes what a person sees. Of that, ESTIMATE_TOKENS_PER_MINUTE_WORKED comes from time and
 * the rest from tool calls: each call is a model turn that reads the conversation back and takes
 * in the tool's result, which is where most tokens go, while time alone is the model writing.
 */
export const ESTIMATE_TOKENS_PER_WORKING_MINUTE = 25_000
export const ESTIMATE_TOOL_CALLS_PER_MINUTE = 3.75
export const ESTIMATE_TOKENS_PER_MINUTE_WORKED = 10_000
export const ESTIMATE_TOKENS_PER_TOOL_CALL =
  (ESTIMATE_TOKENS_PER_WORKING_MINUTE - ESTIMATE_TOKENS_PER_MINUTE_WORKED) / ESTIMATE_TOOL_CALLS_PER_MINUTE
/**
 * How much a minute at each activity spends against thinking; any other activity counts as
 * thinking. Writing generates the file's text as output; reading spends its tokens in the call's
 * result, already counted per call; a command or a subagent leaves the agent mostly waiting on
 * it. Over the simulator's three activity mixes the weights average 0.92 to 1.03.
 */
export const ESTIMATE_ACTIVITY_WEIGHTS = { think: 1, write: 1.3, read: 0.9, run: 0.6, delegate: 0.8 }
/**
 * Tool calls counted per minute at most: a burst of parallel calls is real, a flood is not, and
 * it would otherwise buy far more than any agent spends.
 */
export const ESTIMATE_MAX_TOOL_CALLS_PER_MINUTE = 30

/**
 * How hard each class hits. Most projects have one or two sessions at a time, so a lone
 * defender or supporter must still kill at a reasonable pace.
 */
export const CLASS_HIT = { physical: 1.2, magical: 1.2, defense: 0.8, support: 0.7 }
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
/** A new character's luck is 1 plus a hash of its session id modulo this: 1 to 4. */
export const STARTING_LUCK_SPREAD = 4

/** One combat tick is this much working time. A reference party kills in HITS_TO_KILL ticks. */
export const TICK_SECONDS = 10
export const HITS_TO_KILL = 24
/**
 * A monster's health is measured against a reference party of as many working characters as
 * the party it meets, up to this many: one per class. Most projects have one or two sessions at
 * a time, and they should still kill in about HITS_TO_KILL ticks.
 */
export const REFERENCE_PARTY_SIZE = 4
/**
 * Without defence or healing, a reference party's stamina lasts this many ticks: fewer than
 * HITS_TO_KILL, so such a party rests during its first kill.
 */
export const STAMINA_TICKS = 16
export const REST_SECONDS = 60
export const BOSS_EVERY = 10
/** Off boss waves, a common monster about half the time; the rest split between the two resistant kinds. */
export const COMMON_SHARE = 0.5
export const ARMORED_SHARE = 0.25
/**
 * A wave at or below the world level passes with one kill; each level above it multiplies the
 * kills it takes by this. Kills keep coming at any pace while the wave settles a few levels
 * above the world.
 */
export const WAVE_KILLS_GROWTH = 2
/**
 * A reference party's stamina at level 0. Drain and healing are both shares of the pool, so
 * this only sets the scale of the numbers shown; 1000 keeps them readable at low levels.
 */
export const STAMINA_BASE = 1000
/**
 * Defence and healing compare each character's attribute with the reference character's at the
 * monster's level, so they matter as much at level 200 as at level 1. For the sum r of those
 * ratios, mitigation is MITIGATION_CAP * r / (r + MITIGATION_HALF): a reference defender blocks
 * half, and nothing blocks MITIGATION_CAP or more.
 */
export const MITIGATION_CAP = 0.75
export const MITIGATION_HALF = 0.5
/**
 * Healing per tick is HEAL_CAP_SHARE * m / (m + HEAL_HALF) of the stamina pool for the sum m of
 * medicine ratios: a reference supporter heals 4% a tick, more than the 3.1% a common monster
 * drains through a reference defender, so a balanced party holds against common monsters even
 * with gear somewhat behind the reference.
 */
export const HEAL_CAP_SHARE = 0.08
export const HEAL_HALF = 1
/**
 * A party's stamina pool is the reference's times (outfit factor / reference outfit factor) **
 * OUTFIT_STAMINA_WEIGHT: outfits matter, but a project whose outfits lag is not exhausted at once.
 */
export const OUTFIT_STAMINA_WEIGHT = 0.5
/**
 * A regenerating monster heals this share of its health each tick it survives, but never more
 * than REGENERATING_DAMAGE_SHARE of the damage it took that tick, so any party can beat it.
 */
export const REGENERATING_SHARE = 0.01
export const REGENERATING_DAMAGE_SHARE = 0.5
/** An enraged monster's attack rises with the health it lost, up to this much more near death. */
export const ENRAGED_MAX_BONUS = 1
/** A thorny monster turns this share of the health it loses into the same share of lost stamina. */
export const THORNY_SHARE = 0.5
/** A swift monster strikes this much harder. */
export const SWIFT_ATTACK = 1.5
/**
 * Fight time beyond this many ticks between two readings is not counted (eight hours): a long
 * gap, such as a computer waking up, stays cheap to compute.
 */
export const MAX_FIGHT_TICKS_PER_ADVANCE = 2880

export const MONSTER_KINDS = {
  common: { hp: 1, attack: 1, physical: 1, magical: 1, reward: 1 },
  armored: { hp: 1, attack: 1, physical: 0.5, magical: 1.5, reward: 1.2 },
  ethereal: { hp: 1, attack: 1, physical: 1.5, magical: 0.5, reward: 1.2 },
  boss: { hp: 4, attack: 1.5, physical: 1, magical: 1, reward: 5 }
}
/**
 * The rank ladder, told apart in a room by its glow. Off boss waves a hash picks the rank by
 * `share`; a boss wave's boss is `legendary` one time in LEGENDARY_ONE_IN, otherwise `boss`.
 * `hp` and `reward` multiply the kind's, `drop` multiplies the item drop chance (same cap).
 * An elite, a champion and a legendary boss carry one affix.
 *
 * Why these numbers: before the ladder one monster in eight was an elite (health 1.5, reward 3,
 * drops 3), so an average monster had health 1.0625 and paid 1.25 (1.18 per unit of health). The
 * shares and factors below give health 1.0825 and pay 1.28 (1.18 per unit of health): kills per
 * hour drop by 2% and the reward per hour of fighting stays where it was. A rarer rank takes
 * longer and pays more per minute, so meeting one is good news. A legendary boss is measured
 * the same way against the boss it replaces.
 */
export const MONSTER_RANKS = {
  normal: { share: 0.75, hp: 1, reward: 1, drop: 1 },
  veteran: { share: 0.15, hp: 1.15, reward: 1.25, drop: 1.5 },
  elite: { share: 0.08, hp: 1.5, reward: 3, drop: 3 },
  champion: { share: 0.02, hp: 2, reward: 5, drop: 4 },
  boss: { hp: 1, reward: 1, drop: 1 },
  legendary: { hp: 1.3, reward: 1.6, drop: 3 }
}
/** The ranks that carry an affix. */
export const AFFIX_RANKS = ['elite', 'champion', 'legendary']
/** One boss in this many is legendary: a boss with an affix and the strongest glow. */
export const LEGENDARY_ONE_IN = 5

/**
 * Units an idle character gathers per hour before bonuses, at world level 0. The rate grows by
 * REWARD_GROWTH per world level, like kill rewards, so gathering stays a steady share of income.
 */
export const GATHER_PER_HOUR = 7
export const GATHER_SKILL_BONUS = 0.01
/** Experience an hour of gathering gives the trade's skill. */
export const GATHER_XP_PER_HOUR = 300
export const GATHER_STOPS_AFTER_HOURS = 8
export const REWARD_BASE = 10
export const REWARD_GROWTH = 1.03
/** The chance of an item drop: a base, a bonus per point of luck and a cap. Ranks multiply it. */
export const ITEM_DROP_BASE = 0.005
export const ITEM_DROP_PER_LUCK = 0.0003
export const ITEM_DROP_MAX = 0.05
/** A drop is a weapon this many times as often as an outfit or a tool. */
export const DROP_SLOT_WEIGHTS = { weapon: 2, outfit: 1, tool: 1 }
/**
 * A chest keeps this many copies of an entry; a further drop of it is salvaged into the
 * materials of one upgrade of a fresh copy.
 */
export const COPIES_PER_ITEM = 4

/**
 * Upgrades are priced against the world: an item at the reference gear of its world's level
 * costs UPGRADE_COST_BASE * REWARD_GROWTH ** worldLevel of each recipe material, which grows like
 * kill rewards, and every level above the reference multiplies that by UPGRADE_COST_GROWTH
 * (every level below divides it). Gear then stays near the reference however fast a party
 * kills, and a project that lags catches up cheaply.
 */
export const UPGRADE_COST_BASE = 400
export const UPGRADE_COST_GROWTH = 2
export const ITEM_MAX_TIER = 10
/** A workbench of level L divides upgrade costs by 1 + WORKBENCH_DISCOUNT_PER_LEVEL * L. */
export const WORKBENCH_DISCOUNT_PER_LEVEL = 0.05
/**
 * Group upgrade effects approach a ceiling without reaching it, so they keep growing with no
 * level cap and never trivialise fights: an effect of level L is MAX * L / (L + HALF).
 * The campfire gives back that share of the missing stamina after each kill; the rune circle
 * takes that share off every new monster's health.
 */
export const CAMPFIRE_MAX = 0.6
export const CAMPFIRE_HALF = 5
export const RUNE_CIRCLE_MAX = 0.2
export const RUNE_CIRCLE_HALF = 10
/**
 * The group upgrades of a world and the two materials each costs. Like items they are priced
 * against the world: level L costs GROUP_COST_BASE * REWARD_GROWTH ** worldLevel *
 * GROUP_COST_GROWTH ** (L - GROUP_LEVELS_PER_WORLD_LEVEL * worldLevel) of each, rounded.
 */
export const GROUP_UPGRADES = {
  campfire: { recipe: ['fish', 'crops'] },
  workbench: { recipe: ['ore', 'gears'] },
  runeCircle: { recipe: ['runes', 'crystals'] }
}
export const GROUP_COST_BASE = 400
export const GROUP_COST_GROWTH = 2
export const GROUP_LEVELS_PER_WORLD_LEVEL = 0.1
/**
 * autoSpend buys the affordable purchase with the lowest cost divided by its weight, so a weapon
 * in use is upgraded before a group upgrade, an outfit or a tool of the same price.
 */
export const SPEND_WEIGHTS = { weapon: 3, group: 1.5, outfit: 1, tool: 1 }
/** autoSpend stops after this many purchases in one call. */
export const SPEND_MAX_PURCHASES = 500
/**
 * Each retiree adds RETIREE_BONUS to its project's gathering, up to RETIREES_KEPT of them: the
 * cap is reached exactly when the kept records are full.
 */
export const RETIREE_BONUS = 0.005
export const RETIREES_KEPT = 50
export const RETIREE_BONUS_MAX = RETIREE_BONUS * RETIREES_KEPT

/**
 * The market. A material's base value in coins is what it is worth: no city pays more for it and
 * none sells it for less, fees aside, which is what keeps every trade from making money (see
 * docs/GAME.md, "Market"). The values are the inverse of each material's share of what the
 * three simulated players earn in a year (kills and gathering), scaled to a mean of 10 and
 * rounded: what is scarce is worth more. Seals and fish come rarely; crystals and ore often.
 */
export const MATERIAL_BASE_VALUES = Object.freeze({
  bars: 9,
  pages: 12,
  gears: 12,
  crystals: 6,
  seals: 18,
  ore: 7,
  fish: 17,
  crops: 13,
  logs: 8,
  hides: 9,
  runes: 11
})
/**
 * A city's usual price for a material, as a share of its base value: full for what it wants,
 * less for others, least for what it produces. None is above 1, so a sale never pays more than
 * the base value.
 */
export const MARKET_CITY_FACTORS = Object.freeze({ wanted: 1, neutral: 0.8, produced: 0.6 })
/** Every sale pays this share less than the price, and every purchase costs this share more. */
export const MARKET_FEE = 0.1
/**
 * How much a city's price moves: selling MARKET_DEPTH_BASE * REWARD_GROWTH ** worldLevel units
 * of a material in one city divides its price there by e, buying as much multiplies it by e. It
 * grows like kill rewards, so the market means the same at every level: about two and a half
 * upgrades at the reference gear. It also bounds a sale: a whole stock, however large, never
 * brings more than about base value x depth.
 */
export const MARKET_DEPTH_BASE = 1000
/**
 * The pressure a city's price for a material can carry: purchases lower it (dearer) down to
 * MARKET_PRESSURE_MIN, past which nothing more is sold; sales raise it (cheaper) and it is kept
 * at MARKET_PRESSURE_MAX at most. The price is the usual price times e ** -pressure.
 */
export const MARKET_PRESSURE_MIN = -2
export const MARKET_PRESSURE_MAX = 10
/** Prices recover towards the usual: the pressure halves every this much game time. */
export const MARKET_RECOVERY_HALF_LIFE_MS = 6 * 60 * 60 * 1000
/** A pressure smaller than this is forgotten, so the save keeps only prices that moved. */
export const MARKET_PRESSURE_FORGOTTEN = 1e-6
/**
 * Coins a world may hold and the amount one sale or trade may move. Far past anything a world
 * reaches; they keep every number finite. Past 2 ** 53 an amount is not counted to the unit,
 * as with materials.
 */
export const MARKET_MAX_COINS = 1e100
export const MARKET_MAX_AMOUNT = 1e100
/** The stall's offers change once a game day: a day of the clock the world is advanced to. */
export const MARKET_DAY_MS = 24 * 60 * 60 * 1000
/** Pieces of gear a city's stall offers a day. */
export const STALL_OFFERS = 3
/**
 * A stall's piece costs, in coins, the base value of the materials that would upgrade a fresh
 * tier 1 item of its recipe to its gear level in that world, times this: buying is dearer than
 * upgrading by hand, and worth it with surplus to sell.
 */
export const STALL_MARKUP = 1.5
// Legendary loot (docs/GAME.md, "Legendary loot"): relics, boss-owned relics and legendary
// equipment. Their buffs are data in game/legendary.json; these numbers bound and drop them.

/**
 * The most each effect type can add up to for one target, whatever its sources: the active relic
 * and the legendary equipment held. Effects of different sources add, then this caps the sum, so
 * a future item cannot stack a quantity past what the design allows. Today's content never
 * reaches a cap; every buff is modest so the world's skills stay the main source of power.
 * `restTime` is in seconds and `gatherHours` in hours; every other amount is a share.
 */
export const LEGENDARY_EFFECT_CAPS = {
  attackSpeed: 0.08,
  damage: 0.12,
  critChance: 0.05,
  critDamage: 0.3,
  staminaDrain: 0.1,
  staminaPool: 0.1,
  outfitStamina: 0.1,
  restTime: 20,
  staminaPerKill: 0.05,
  healing: 0.1,
  supportAura: 0.2,
  affixWeakening: 0.25,
  thorns: 0.1,
  runeCircle: 0.15,
  itemDrop: 0.2,
  killMaterials: 0.1,
  gatherYield: 0.15,
  gatherHours: 2,
  gatherXp: 0.1,
  characterXp: 0.05,
  skillXp: 0.1,
  upgradeCost: 0.1
}
/**
 * A free legendary item that fits a new character (made for its class, or for a tool its trade) is
 * taken over the slot's best plain item unless that one is more than this many upgrade levels
 * ahead. A legendary item's buff is worth about that much, and its upgrades then keep it level.
 */
export const LEGENDARY_PICK_MARGIN = 2
/**
 * A pool relic (one a city sells) drops from a boss wave's boss with this chance by its rank, plus
 * RELIC_PITY_STEP for every such kill since the room's last pool relic. A legendary boss is the
 * main source; a plain boss gives one now and then. A room that owns no relic at all gets one
 * from its first boss for certain, so even a light user, who meets a boss every few weeks, sees
 * a relic within about two weeks.
 */
export const RELIC_CHANCE = { boss: 0.08, legendary: 0.5 }
export const RELIC_PITY_STEP = 0.08
/**
 * A named boss's own relic or legendary equipment drops with this chance by rank, plus
 * BOSS_ITEM_PITY_STEP for every kill of a boss whose item the room lacks that gave nothing. A
 * room's first boss-owned item is certain: the first such boss it beats gives it. A boss comes
 * back to a room only after the whole roster (550 waves), so pity counts kills of any boss with
 * an item, not of the same one.
 */
export const BOSS_ITEM_CHANCE = { boss: 0.05, legendary: 0.15 }
export const BOSS_ITEM_PITY_STEP = 0.05
/** Pity counters stop here; the chance is certain long before. Bounds what an imported save may hold. */
export const LEGENDARY_PITY_MAX = 1000
