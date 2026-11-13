# Game mode: engine

An optional layer on top of the rooms. The tokens a session spends become progress. This page
is the contract for the engine in `src/game/`. The engine is pure: no I/O, no timers, no Orca
API, no DOM. Nothing here is wired to the worker or the UI yet.

Every number lives in `src/game/constants.mjs`. Formulas below name those constants.

## Principles

- Experience comes from tokens only. Kills and gathering give materials, never experience
  for work skills.
- Nothing is ever lost: no death, no stolen materials, no decay.
- No input is needed. The only choice is prestige.
- A character is one agent session. It is short lived, so most power is accumulated in the
  world and the project, not in the character.
- Everything is deterministic: the same save and the same inputs give the same result. Anything
  "random" comes from a hash of ids, never from `Math.random()`. Pass the clock in.

## Identifiers

- Work skills, by the activity the tokens are spent on: `forge` (write), `lore` (read),
  `engineering` (run), `arcana` (think), `command` (delegate).
- Gathering skills: `mining`, `fishing`, `farming`, `woodcutting`, `hunting`, `runecraft`.
- Materials: work skills yield `bars`, `pages`, `gears`, `crystals`, `seals` in that order;
  gathering skills yield `ore`, `fish`, `crops`, `logs`, `hides`, `runes`.
- Classes: `physical`, `magical`, `defense`, `support`. Their skill: `forge`, `arcana`,
  `lore`, `command`. Their attribute: `strength`, `arcane`, `resilience`, `medicine`.
- Attributes: `strength`, `arcane`, `agility`, `precision`, `resilience`, `medicine`, `luck`.
- Activities that give an attribute point: write `strength`, run `agility`, read
  `resilience`, think `arcane`, delegate `medicine`. Others: `precision`.

## Experience and levels

- `xp = tokens / TOKENS_PER_XP`. Each grant goes in full to the work skill of the activity and
  to the character.
- `xpToNext(n) = round(LEVEL_BASE * n ** LEVEL_EXPONENT)`.
- A skill stops at `SKILL_CAP`; further experience is banked. Prestige sets the level to 1,
  adds a star and pours the banked experience back in.
- A star multiplies experience gained in that skill by `1 + STAR_XP_BONUS * stars`.
- `effectiveLevel(skill) = stars * SKILL_CAP + level`. Power always uses the effective level,
  so prestige never makes anything weaker. Effects scale by `1 + STAR_EFFECT_BONUS * stars`.
- A character lives hours to a couple of days, so it has its own, faster curve with no cap:
  `characterXpToNext(n) = round(CHARACTER_LEVEL_BASE * n ** CHARACTER_LEVEL_EXPONENT)`.
- `worldLevel = floor(mean of the effective levels of the five work skills)`, at least 1.

## Characters

- Class: chosen when the character is created, among the classes least present in its
  project's living characters; ties are broken by a hash of the session id. The same session
  id in the same party always gets the same class.
- Starting attributes: 1 each, plus `floor(effectiveLevel(classSkill) / 2)` in the class
  attribute ("trained by those who came before"). Luck starts at `1 + hash(sessionId) mod
  STARTING_LUCK_SPREAD`.
- Each character level gives `CLASS_POINTS_PER_LEVEL` to the class attribute,
  `ACTIVITY_POINTS_PER_LEVEL` to the attribute of the activity that earned most experience
  during that level, and `FORTUNE_POINTS_PER_LEVEL` to precision on even levels and luck on odd
  ones. So every attribute has a source that needs no input.
- Gathering trade: `hash(sessionId) mod 6` over the gathering skills.

## Power

Per tick, one working character deals:

```
hit = BASE_HIT * POWER_GROWTH ** E * (1 + STAR_EFFECT_BONUS * stars)
    * (1 + ATTRIBUTE_HIT_BONUS * classAttribute)
    * itemFactor(weapon)
    * seasoning(characterLevel)
    * CLASS_HIT[class]
    * pace
    * (1 + critChance * (CRIT_DAMAGE - 1))
    * (1 + HASTE_PER_AGILITY * agility)
```

- `E` is the effective level of the class skill and `stars` its prestige stars.
- `itemFactor(item) = GEAR_GROWTH ** effectiveGearLevel(item)` with `effectiveGearLevel =
  level + TIER_LEVELS * (tier - 1)`: a tier is a head start worth `TIER_LEVELS` upgrades. No
  item counts as factor 1.
- `seasoning(l) = NEWCOMER_SHARE + (1 - NEWCOMER_SHARE) * (l - 1) / (SEASONED_LEVEL - 1)` up
  to `SEASONED_LEVEL`, then `1 + VETERAN_BONUS_PER_LEVEL * (l - SEASONED_LEVEL)`.
- `pace = clamp(tokensPerMinute / REFERENCE_TOKENS_PER_MINUTE, PACE_MIN, PACE_MAX)`.
- `critChance = min(CRIT_MAX, CRIT_BASE + CRIT_PER_PRECISION * precision)`.
- Damage type: `magical` for the magical class, `physical` for the others.
- A support character adds `SUPPORT_AURA` to every other character's hit. Three or more
  distinct classes working add `FULL_PARTY_BONUS` to all.
- Only characters whose agent is working fight. Waiting or blocked pauses that project's
  fight. Idle characters gather.

## Monsters and waves

- A project's wave starts at the world level when the project first joins, and goes up by one
  per kill. The monster's level is the wave.
- `referencePartyHit(level)` is the total hit of four reference characters, one per class,
  with `E = level` (with as many stars as that needs), character level `SEASONED_LEVEL`, the
  attributes a real character has at that level (starting attributes plus the class and
  fortune points of every level, and its activity points spread evenly over the five
  activities), gear worth `REFERENCE_GEAR_PER_LEVEL * level` upgrade levels, pace 1, with aura
  and full party bonus.
- `monsterHp = HITS_TO_KILL * referencePartyHit(level) * kind.hp * (elite ? ELITE.hp : 1)`.
- Damage taken is multiplied by `kind.physical` or `kind.magical` by type.
- Kind: every `BOSS_EVERY` waves a `boss`; otherwise a hash of world, project and wave picks
  among `common`, `armored`, `ethereal`. One wave in `ELITE_ONE_IN`, by the same hash, is an
  elite with one affix: `regenerating`, `enraged`, `thorny`, `swift`, or one of the two
  resistances. Each affix has one clear counter among the classes.
- Stamina: the monster drains `referenceStamina(level) / STAMINA_TICKS * kind.attack` a tick,
  so a reference party with no defence and no healing lasts `STAMINA_TICKS` ticks, fewer than
  `HITS_TO_KILL`: it rests during its first kill.
- Defence and healing are level-relative: each defender's resilience and each supporter's
  medicine is divided by the reference character's at the monster's level, giving ratios that
  add up to `r` and `m`. Mitigation is `MITIGATION_CAP * r / (r + MITIGATION_HALF)`; healing per
  tick is `HEAL_CAP_SHARE * m / (m + HEAL_HALF)` of the stamina pool. A reference party with
  one defender and one supporter holds its stamina against a common monster of its level, at
  every level. At zero stamina the party rests `REST_SECONDS` of fight time; the monster keeps
  its remaining health.
- A regenerating elite heals `REGENERATING_SHARE` of its health a tick, never more than
  `REGENERATING_DAMAGE_SHARE` of the damage it took that tick, so every fight can be won.
- Reward for a kill: `REWARD_BASE * REWARD_GROWTH ** level * kind.reward` materials, split by
  the monster's loot table, times `ELITE.reward` for an elite, with an item drop whose chance
  grows with the party's luck.

## Gathering

- An idle character (its agent done, seen or not) gathers its trade:
  `GATHER_PER_HOUR * (1 + GATHER_SKILL_BONUS * effectiveLevel(trade)) * toolFactor *
  seasoning * (1 + retireeBonus)` units per hour.
- Each unit gathered is one experience point in that gathering skill (gathering skills are
  the one exception to "experience from tokens only", and they never feed work skills).
- Gathering stops `GATHER_STOPS_AFTER_HOURS` after the last tokens arrived in that world.

## Items, chest, retirement

- An item has a slot (`weapon`, `outfit`, `tool`), for weapons a damage type, a tier 1 to 10
  and an upgrade level from 0 with no limit. Stats are computed from tier and level; no item
  carries hand-typed numbers.
- Upgrading an item costs `UPGRADE_COST_BASE * UPGRADE_COST_GROWTH ** effectiveGearLevel /
  (1 + WORKBENCH_DISCOUNT_PER_LEVEL * workbenchLevel)`, rounded and at least 1, of each of the
  two materials in the item's recipe. A higher tier costs more to upgrade, as much as the same
  power reached by levels.
- Each project has a chest. A new character takes, by itself, the best free item of each slot
  (highest effective gear level, then tier, then level, then id), with a weapon of its class's
  damage type.
- When a session closes its character retires: its items go back to the chest and a retiree
  record is kept (generated name id, class, level, tokens, main skill, time; the session title
  only when the setting allows it). Each retiree adds `RETIREE_BONUS` to the project's
  gathering, up to `RETIREE_BONUS_MAX = RETIREE_BONUS * RETIREES_KEPT`. The last `RETIREES_KEPT` are kept; older ones fold
  into a counter. A session that comes back with the same id leaves retirement with its level
  and takes its items back when they are free.

## Worlds

- Progress is kept per world. Each project belongs to one world or to none (out of the game).
  Skills, materials and group upgrades are per world; wave, chest and retirees per project.
- Characters on a host without session history are guests: they fight with newcomer power
  and keep no progress.

## Content

- `game/items.json` and `game/monsters.json` are data. An item entry is id, slot, damage type,
  tier, recipe and an optional list of themes. A monster entry is id, kind, loot table, sprite
  hints and an optional list of themes. No entry holds a balance number.
- A theme may later bring its own monster parts and names; until then the default set is split
  between the shipped themes, with a generic set for any other theme.
- A monster for a wave is picked by hash among the entries of that kind that match the room's
  theme, falling back to the generic ones.

## Save shape

One JSON value:

```
Save      { version, worlds: { [worldId]: World }, projectWorld: { [projectId]: worldId | null },
            settings: { keepTitles } }
World     { skills: { [skillId]: { level, xp, banked, stars } }, materials: { [id]: number },
            upgrades: { [id]: level }, projects: { [projectId]: Project }, lastTokenAt }
Project   { wave, monster, stamina, restingUntil, chest: Item[],
            characters: { [sessionId]: Character }, retirees: Retiree[], retiredCount }
Character { sessionId, class, level, xp, attributes, levelActivityXp, equipment, trade,
            tokens, bornAt, lastSeenAt }
```

## Simulation

`node scripts/simulate-game.mjs` plays usage scenarios through the engine and prints how
levels, waves, materials and upgrades progress over days, weeks and months. A balance change
is judged by its output, not by eye.
