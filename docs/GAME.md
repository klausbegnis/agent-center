# Game mode: engine

An optional layer on top of the rooms. The tokens a session spends become progress. This page
is the contract for the engine in `src/game/`, for the bridge that feeds it from the worker
("The bridge") and for what a UI receives ("View state"). The engine is pure: no I/O, no
timers, no Orca API, no DOM. The UI does not draw the game yet.

## The engine

`createEngine({ content: { monsters, items } })` takes the parsed `game/monsters.json` and
`game/items.json` and returns functions that each take a save and return a new one. None of
them mutates its input, reads the clock or draws a random number; `now`, `from` and `to` are
milliseconds the caller passes.

| Function | What it does |
|---|---|
| `applyTokens(save, { projectId, sessionId, tokens, activity, now, themeId?, title?, guest? })` | Counts the tokens a session spent since the last reading. Creates the world, the project (wave at the world level, starter chest) and the character when missing; a session found among the project's retirees comes back instead. Grants experience to the activity's work skill and to the character, and records `lastTokenAt`. A guest or an excluded project changes nothing. |
| `advance(save, { from, to, sessions })` | Moves time forward. `sessions` lists `{ projectId, sessionId, state, activity?, tokensPerMinute?, themeId?, guest? }` with `state` one of `working`, `waiting`, `blocked`, `idle`. See "Time". |
| `advanceWithEvents(save, interval)` | The same, returning `{ save, events }`: one `kill` event per kill with its wave, kind, affix, ticks, whether the party rested, materials and dropped item. |
| `prepareFights(save, { sessions })` | Moves no time. Records each reported character's state, and gives a project whose party has a working member (a character or a guest) and no monster its monster now, measured against that party. |
| `closeSession(save, { projectId, sessionId, now, title? })` | Retires the session's character. |
| `prestige(save, { worldId, skillId })` | Prestiges a skill at the cap; otherwise returns the save unchanged. |
| `upgradeItem(save, { projectId, itemId })` | Upgrades a chest item with the world's materials; unchanged when it cannot pay. |
| `buyGroupUpgrade(save, { worldId, upgradeId })` | Buys the next level of a group upgrade; unchanged when it cannot pay. |
| `setKeepTitles(save, value)` | Turns keeping session titles on or off; off forgets every title kept. |
| `autoSpend(save)` / `autoSpendWithPurchases(save)` | Buys the best affordable purchase again and again (see "Spending"). |
| `cleanSave(save)` | Checks a save that comes from outside the plugin (an imported file) part by part and rebuilds it from the fields the engine writes: `{ ok: true, save }`, or `{ ok: false, problem }` naming the first part that is not what the engine writes (an unknown id, a number out of range, an item held by nobody, a project in two worlds). Unlike `migrate`, which repairs what the plugin's own storage holds, it refuses. |
| `view(save)` | A plain summary for a UI: per world the level, the attack speed from Engineering, work and gathering skills with level, stars, effective level and progress, materials and group upgrades with their next cost; per project the wave, kills on it and kills it takes, the monster with its health share, stamina, the party with class, level, attributes, equipment, trade and state, the chest, retirees and retiree bonus. |

The engine lives in `engine.mjs` (composition and purchases), `sessions.mjs` (tokens and
retirement), `advance.mjs` (time), `fight.mjs` (a project's fight), `spending.mjs` (group
upgrades and `autoSpend`), `drops.mjs` (item drops) and `view.mjs`, over the rule modules
described below.

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
- Materials, named after the skills in the same order: `bars`, `pages`, `gears`, `crystals`,
  `seals` for the work skills, which only kills give; `ore`, `fish`, `crops`, `logs`, `hides`,
  `runes` for the gathering skills, which gathering and kills give. Work skills never yield
  materials themselves.
- Classes: `physical`, `magical`, `defense`, `support`. Their skill: `forge`, `arcana`,
  `lore`, `command`. Their attribute: `strength`, `arcane`, `resilience`, `medicine`.
- Attributes: `strength`, `arcane`, `agility`, `precision`, `resilience`, `medicine`, `luck`.
- Activities that give an attribute point: write `strength`, run `agility`, read
  `resilience`, think `arcane`, delegate `medicine`. Others: `precision`.

## Experience and levels

- `xp = tokens / TOKENS_PER_XP`. Each grant goes in full to the work skill of the activity and
  to the character.
- `xpToNext(n) = round(LEVEL_BASE * n ** LEVEL_EXPONENT)`. With `LEVEL_EXPONENT = 1` the total to
  reach a level grows with its square, so the late levels are not a wall.
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
- Starting attributes: 1 each, plus `floor(worldLevel / 2)` in the class attribute ("trained
  by those who came before"). Luck starts at `1 + hash(sessionId) mod
  STARTING_LUCK_SPREAD`.
- Each character level gives `CLASS_POINTS_PER_LEVEL` to the class attribute,
  `ACTIVITY_POINTS_PER_LEVEL` to the attribute of the activity that earned most experience
  during that level, and `FORTUNE_POINTS_PER_LEVEL` to precision on even levels and luck on odd
  ones. So every attribute has a source that needs no input.
- Gathering trade: `hash(sessionId) mod 6` over the gathering skills.

## Power

Per tick, one working character deals:

```
hit = BASE_HIT * POWER_GROWTH ** worldLevel
    * (E / worldLevel) ** CLASS_SKILL_WEIGHT * (1 + STAR_EFFECT_BONUS * stars)
    * (1 + ATTRIBUTE_HIT_BONUS * classAttribute)
    * itemFactor(weapon)
    * seasoning(characterLevel)
    * CLASS_HIT[class]
    * pace
    * (1 + critChance * (CRIT_DAMAGE - 1))
    * (1 + HASTE_PER_AGILITY * agility)
    * speed
```

- `E` is the effective level of the class skill and `stars` its prestige stars. A character
  fights at its world's level, like the monsters; its class skill adds a bounded factor. The
  five skills drift apart in proportion (one can be twice another), so a class skill used as a
  level of its own would make one class many times too strong.
- `speed` is the party's attack speed from the world's Engineering, the one work skill no class
  draws on: `clamp((Eng / worldLevel) ** ENGINEERING_SPEED_WEIGHT * (1 + STAR_EFFECT_BONUS *
  engStars), ENGINEERING_SPEED_MIN, ENGINEERING_SPEED_MAX)` with `Eng` the effective level of
  `engineering`. It is 1 when Engineering is at the world level, more when it is ahead, less
  when it lags; it applies to every working character alike, guests included, so it is
  bounded more tightly than a class skill. The reference party always attacks at speed 1.
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

- A project's wave starts at the world level when the project first joins. A wave at or below
  the world level passes with one kill; above it, a wave takes
  `ceil(WAVE_KILLS_GROWTH ** (wave - worldLevel))` kills. The wave never goes down. Every
  monster's level is its wave.
- Why: the world level grows by about one level a working day while a party kills several
  monsters an hour. With one kill per wave the wave would run far ahead of the world; with
  this rule it settles a few levels above it and fights keep coming.
- `referencePartyHit(level)` is the total hit of four reference characters, one per class,
  in a world whose five work skills all have effective level `level` (with as many stars as
  that needs), character level `SEASONED_LEVEL`, the attributes a real character has at that
  level (starting attributes plus the class and fortune points of every level, and its
  activity points spread evenly over the five activities), gear worth
  `REFERENCE_GEAR_PER_LEVEL * level` upgrade levels, pace 1, attack speed 1, with aura and full
  party bonus.
- `monsterHp = HITS_TO_KILL * referencePartyHit(level) * min(n, REFERENCE_PARTY_SIZE) /
  REFERENCE_PARTY_SIZE * kind.hp * (elite ? ELITE.hp : 1)`, with `n` the working characters
  when the monster appears. Most projects have one or two sessions at a time; they still kill
  in about `HITS_TO_KILL` ticks, and the class mix and the support's aura still matter.
- Damage taken is multiplied by `kind.physical` or `kind.magical` by type.
- Kind: the first monster of every `BOSS_EVERY`-th wave is a `boss`; otherwise a hash of
  world, project, wave and kill picks `common` (`COMMON_SHARE`), `armored` (`ARMORED_SHARE`) or
  `ethereal`. One monster in `ELITE_ONE_IN`, by the same hash and never a boss, is an
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
  the monster's loot table, times `ELITE.reward` for an elite.
- Item drop: chance `min(ITEM_DROP_MAX, ITEM_DROP_BASE + ITEM_DROP_PER_LUCK * luck)` with the
  working party's summed luck, times `ELITE_ITEM_DROP_FACTOR` for an elite (same cap). The slot
  is picked by hash with `DROP_SLOT_WEIGHTS`, a weapon's damage type by a class picked by hash.
  The entry is the highest tier up to `dropTier(level) = 1 + floor(REFERENCE_GEAR_PER_LEVEL *
  level / TIER_LEVELS)` (at most `ITEM_MAX_TIER`) among the generic and the room theme's
  entries: a drop helps a project catch up with the reference gear, never jumps past it. The
  chest keeps `COPIES_PER_ITEM` copies of an entry; a further drop of it is salvaged into the
  materials one upgrade of a fresh copy costs, so a drop never adds power for free.

## Time

`advance(save, { from, to, sessions })` handles each project that has a reading, in order of
project id:

- Each reported character's `state` is recorded.
- Idle characters gather (see "Gathering").
- If any of the project's sessions is `waiting` or `blocked`, the whole party waits with it:
  no fight.
- Otherwise the `working` characters fight, guests included, for the interval plus the time
  left over from earlier readings, in whole ticks of `TICK_SECONDS`. More than
  `MAX_FIGHT_TICKS_PER_ADVANCE` ticks in one reading are not counted, so a long gap is cheap.
  Many short readings fight exactly as far as one long one.
- One tick: a resting party counts down its rest (`REST_SECONDS`) and is back to full stamina
  at the end of it. Otherwise the party strikes and the monster strikes back (see "Monsters
  and waves"). On a kill the reward is added to the world, a drop goes into the chest, the
  campfire restores stamina, the wave's kill count goes up (and the wave when it is passed),
  and the next monster appears with the rune circle's cut taken off its health.
- The party's stamina pool is `referenceStamina(level) * (outfit factor / GEAR_GROWTH **
  referenceGearLevel(level)) ** OUTFIT_STAMINA_WEIGHT`, with the mean outfit factor of the
  working characters. The save keeps stamina as a share of the pool.
- Sessions that are not reported, and projects without a reading, do nothing.

## Gathering

- An idle character gathers its trade:
  `GATHER_PER_HOUR * REWARD_GROWTH ** worldLevel * (1 + GATHER_SKILL_BONUS *
  effectiveLevel(trade)) * (1 + STAR_EFFECT_BONUS * stars(trade)) * toolFactor * seasoning *
  (1 + retireeBonus)` units per hour, with `toolFactor = itemFactor(tool) / GEAR_GROWTH **
  referenceGearLevel(worldLevel)` (1 for a tool at the reference). The world level term keeps
  gathering a steady share of income as kill rewards grow.
- Each hour gathered gives `GATHER_XP_PER_HOUR` experience to that gathering skill (gathering
  skills are the one exception to "experience from tokens only", and they never feed work
  skills). Fractions of a unit are carried by the character to the next reading.
- Gathering stops `GATHER_STOPS_AFTER_HOURS` after the last tokens arrived in that world.

## Spending

- Prices follow the world. An item whose effective gear level is at the reference gear of the
  world level costs `UPGRADE_COST_BASE * REWARD_GROWTH ** worldLevel` of each recipe material,
  which grows like kill rewards; each level above the reference multiplies that by
  `UPGRADE_COST_GROWTH`, each level below divides it. Why: rewards come per kill and a strong
  party kills faster, so with prices fixed by item level alone gear ran away from the
  monsters. Priced this way gear stays near the reference however fast a party kills, and a
  project that lags catches up cheaply.
- Group upgrades, per world, each with a two-material recipe in `GROUP_UPGRADES`. Level L
  costs `round(GROUP_COST_BASE * REWARD_GROWTH ** worldLevel * GROUP_COST_GROWTH ** (L -
  GROUP_LEVELS_PER_WORLD_LEVEL * worldLevel))` of each material, at least 1. No level cap; the
  campfire and the rune circle approach a ceiling (`MAX * L / (L + HALF)`) so they never make
  fights trivial:
  - `campfire`: after each kill the party gets back `CAMPFIRE_MAX * L / (L + CAMPFIRE_HALF)`
    of its missing stamina (healing between fights).
  - `workbench`: item upgrades cost `1 / (1 + WORKBENCH_DISCOUNT_PER_LEVEL * L)`.
  - `runeCircle`: every new monster starts with `RUNE_CIRCLE_MAX * L / (L + RUNE_CIRCLE_HALF)`
    less health.
- `autoSpend` looks at every item a living character holds and the three group upgrades.
  Among the affordable ones it buys the one with the lowest total cost divided by
  `SPEND_WEIGHTS` of its kind, and repeats, at most `SPEND_MAX_PURCHASES` times a call.

## Items, chest, retirement

- An item has a slot (`weapon`, `outfit`, `tool`), for weapons a damage type, a tier 1 to 10
  and an upgrade level from 0 with no limit. Stats are computed from tier and level; no item
  carries hand-typed numbers.
- Upgrading an item costs `UPGRADE_COST_BASE * REWARD_GROWTH ** worldLevel *
  UPGRADE_COST_GROWTH ** (effectiveGearLevel - referenceGearLevel(worldLevel)) / (1 +
  WORKBENCH_DISCOUNT_PER_LEVEL * workbenchLevel)`, rounded and at least 1, of each of the two
  materials in the item's recipe (see "Spending"). A higher tier costs more to upgrade, as
  much as the same power reached by levels.
- Each project has a chest. A new character takes, by itself, the best free item of each slot
  (highest effective gear level, then tier, then level, then id), with a weapon of its class's
  damage type.
- A new project's chest holds the lowest generic tier of a weapon for each class (three
  physical, one magical), an outfit and a tool.
- When a session closes its character retires: its items go back to the chest and a retiree
  record is kept (generated name id, class, level, tokens, main skill, time; the session title
  only when the setting allows it). Each retiree adds `RETIREE_BONUS` to the project's
  gathering, up to `RETIREE_BONUS_MAX = RETIREE_BONUS * RETIREES_KEPT`. The last
  `RETIREES_KEPT` are kept; older ones fold into a counter. A session that comes back with the
  same id leaves retirement with its level and attributes and takes the best free items.

## Worlds

- Progress is kept per world. Each project belongs to one world or to none (out of the game).
  Skills, materials and group upgrades are per world; wave, chest and retirees per project.
- A guest (an agent on a paired machine while the game reads real totals, which cover this
  computer only) fights as a level 1 character of the world with no gear, and leaves nothing
  behind: no character, retiree or experience. Kills it helps with still pay the project.

## Content

- `game/items.json` and `game/monsters.json` are data. An item entry is id, slot, damage type,
  tier, recipe and an optional list of themes. A monster entry is id, kind, loot table, sprite
  hints and an optional list of themes. No entry holds a balance number.
- A theme may later bring its own monster parts and names; until then the default set is split
  between the shipped themes, with a generic set for any other theme.
- A monster is picked by hash among the entries of its kind that match the room's theme,
  falling back to the generic ones. The room's theme is the last `themeId` a reading gave.

## Save shape

One JSON value:

```
Save      { version, worlds: { [worldId]: World }, projectWorld: { [projectId]: worldId | null },
            settings: { keepTitles } }
World     { skills: { [skillId]: { level, xp, banked, stars } }, materials: { [id]: number },
            upgrades: { [id]: level }, projects: { [projectId]: Project }, lastTokenAt }
Project   { wave, waveKills, monster, stamina, restTicks, fightMs, fightTicks, fightRested,
            themeId, chest: Item[], characters: { [sessionId]: Character },
            retirees: Retiree[], retiredCount }
Character { sessionId, class, level, xp, attributes, levelActivityXp, equipment, trade,
            tokens, bornAt, lastSeenAt, skillXp, gatherCarry, title, state }
Item      { id, entryId, slot, damageType?, tier, recipe, level, heldBy }
```

`stamina` is a share of the party's pool; `restTicks` the rest left; `fightMs` fight time not
yet worth a tick; `fightTicks` and `fightRested` describe the fight under way. `skillXp` tallies
a character's experience by work skill, for the retiree's main skill.

## The bridge

`src/game-mode.mjs` connects the engine to the plugin. The rules it follows are pure modules in
`src/domain/` (`game-tokens.mjs`, `game-sessions.mjs`, `game-estimate.mjs`, `work-meter.mjs`,
`game-view.mjs`) and the estimate in `src/game/estimate.mjs`; `src/game-sources.mjs` turns
either source into one reading; the Orca calls are in `src/orca/session-history.mjs`; the save
is `src/game-save.mjs`; the actions are `src/game-actions.mjs`.

### When it runs

The game runs when the `gameMode` setting is on; otherwise the plugin behaves as without it and
the view state's `game.status` says why:

| `status` | Meaning |
|---|---|
| `off` | The `gameMode` setting is off (the default). |
| `loading-save` | The stored save has not been read yet; the read is tried again each round and nothing is written until it works. |
| `newer-save` | The stored save was written by a newer plugin; it is left untouched. |
| `unsupported` | The game cannot run here at all: its content files did not load. |
| `running` | Playing. |

While it runs, `game.tokenSource` says where the tokens come from:

| `tokenSource` | When | What it is |
|---|---|---|
| `history` | This Orca offers `agent.listSessions` to the worker (`orca.host.has`) and the `history:read` capability is granted (`orca.grantedCapabilities`). | Real token totals from Orca's Agent Session History. |
| `estimated` | Any other case: the method is missing (every Orca release at host API 1.6, such as 1.4.258), the capability is not granted, or a read was refused with `capability_denied` or `consent_required`. | An estimate from each agent's working time and tool calls (see "The estimate"). It is not a measurement. |

The plugin does not ask for `history:read` yet, so today the game runs on the estimate.
It switches to real totals by itself once Orca offers them and the permission is granted; the
history is never read while the source is `estimated`. The settings and the source are read
every round, so turning `gameMode` or `gameKeepTitles` on or off takes effect within one
round, without a restart.

### A round

Every 30 seconds (`GAME_ROUND_MS` in `src/worker.mjs`, twice the snapshot interval). With real
totals:

1. Read `agent.listSessions` (the 200 newest sessions) and `workspace.list`.
2. Turn each session's `totalTokens` into the tokens spent since its baseline (below).
3. Place each session in a room: its `workspaceId` is looked up among the workspaces the store
   knows, then by folder through `workspace.list` when the history names the workspace in
   another form of id. The room's id is the engine's `projectId`; the room's theme (its own, or
   the default; none under Random, where the UI picks) is the engine's `themeId`.
4. Match sessions to the agents on screen (below) and build the readings.
5. `advance` the engine from the last round to now with the sessions' states, then
   `applyTokens` for the tokens read, then `prepareFights` with the same states, then
   `closeSession` for the sessions that are over, then `autoSpend` when it is on.
6. Keep the baselines and the time of this reading with the save.

On the estimate, steps 1 to 4 are instead: read every agent's work meter from the store, make
each agent, on this computer or a paired one, a session in its own room, and turn what its meter
counted since the last round into tokens (see "The estimate"). Steps 5 and 6 are the same, except that the
meters' baselines stay in memory.

Why advance before counting: the tokens read now were spent during the interval that just
passed, while the party fought with the power it had at its start. Counting first would let a
character born from those tokens, or a level they paid for, fight time that was already over.
A new session's character therefore joins the fight from the next round. `prepareFights` still
records its state and, in a room that has just joined, brings out the first monster at once:
otherwise the room would show its wave with no foe and its new characters idle until the next
round.

One round moves the engine at most `MAX_ROUND_GAP_MS` (five minutes): a round that comes late
does not fight through time nobody saw with the states read now. The first round after the
worker starts only counts tokens; it does not fight the time the worker was down.

### Tokens, baselines and restarts

This section is about real totals; the estimate follows the same rules with its work meters in
place of totals, except across restarts (below).

- A session read for the first time sets its baseline to its current total and earns nothing,
  so turning the game on never pays out a session's history. The exception is a session that
  started after the last reading (`createdAt` later than the stored `watchedUntil`): it is new,
  and everything it spent counts.
- A known session earns `total - baseline`, at most `MAX_TOKENS_PER_MINUTE` (2,000,000) per
  minute since the baseline was read, that time itself counted for at most `MAX_CATCH_UP_MS`
  (eight hours, like the engine's fight time). The baseline then moves to the total.
- A total that goes down (a session compacted or cleared) moves the baseline and earns nothing.
- Baselines and `watchedUntil` are saved with the game. After a restart a known session earns
  what it spent while the worker was down, once, within the bound above; the same tokens are
  never counted twice because the baseline moved when they were counted.
- Turning the game off forgets the baselines and `watchedUntil`: when it is turned on again,
  the time it was off is not paid.
- At most `BASELINES_KEPT` (1000) baselines are kept, the sessions just read and the newest
  others.
- On the estimate the meters start again with the worker and their baselines are never saved,
  so the time the worker was down earns nothing. The saved `watchedUntil` still marks the last
  reading: an agent the restarted worker sees counts from when it saw it, and the same agent in
  the same terminal continues its character.
- The source a baseline belongs to is saved with it (`tokenSource`). When the source changes,
  the baselines and `watchedUntil` are forgotten, so the first reading of the new source earns
  nothing and no token is counted by both. Characters of the other source retire at once; a
  history session's character comes back with its level when it is read again. Estimated
  characters are not moved to the real sessions.

### The estimate

Without real totals, the store's work meter (`src/domain/work-meter.mjs`) counts for every
agent the time it spent working at each activity and the tool calls it started (from the
`agent.tool.before` hook; a subagent's calls count for its agent). Time spent waiting, blocked
or done is not working time. Over one round, an agent on this computer is estimated to have
spent:

```
tokens = sum over activities (working minutes × ESTIMATE_ACTIVITY_WEIGHTS[activity])
           × ESTIMATE_TOKENS_PER_MINUTE_WORKED
       + min(tool calls, ESTIMATE_MAX_TOOL_CALLS_PER_MINUTE × minutes of the round)
           × ESTIMATE_TOKENS_PER_TOOL_CALL
```

| Constant (`src/game/constants.mjs`) | Value | Why |
|---|---|---|
| `ESTIMATE_TOKENS_PER_WORKING_MINUTE` | 25,000 | What the simulator assumes an agent spends per working minute, so the balance it measures still holds. |
| `ESTIMATE_TOOL_CALLS_PER_MINUTE` | 3.75 | The assumed pace of tool calls of a working agent. |
| `ESTIMATE_TOKENS_PER_MINUTE_WORKED` | 10,000 | The share of a working minute that comes from time: the model writing. |
| `ESTIMATE_TOKENS_PER_TOOL_CALL` | 4,000 | The rest, per call: each call is a model turn that reads the conversation back and takes in the tool's result, which is where most tokens go. |
| `ESTIMATE_ACTIVITY_WEIGHTS` | think 1, write 1.3, read 0.9, run 0.6, delegate 0.8 | Writing generates text; a read's tokens are in its result, already counted per call; a command or a subagent leaves the agent mostly waiting. Any other activity counts as think. Over the simulator's three activity mixes the weights average 0.92 to 1.03. |
| `ESTIMATE_MAX_TOOL_CALLS_PER_MINUTE` | 30 | A burst of parallel calls is real, a flood is not. |

An agent thinking for a minute at 3.75 calls is estimated at exactly 25,000 tokens. The tokens
are then bounded like real ones (`MAX_TOKENS_PER_MINUTE` over at most `MAX_CATCH_UP_MS`) and
feed `applyTokens` and the pace exactly like real ones.

An agent on a paired machine is known only from the snapshot of that machine (`orca worktree
ps --environment <name>`, every 15 seconds): no event or hook reaches the plugin from there.
Its meter counts the time between two snapshots as working when the earlier one saw it
working, at the activity of the tool the snapshot names (`toolName`), or thinking when it names
none. Its tool calls cannot be counted: a snapshot names the tool running at that moment, and
two snapshots 15 seconds apart cannot tell one call from ten. So it has no tool-call part, and
each working minute is worth the whole assumed working minute instead
(`estimateTokensFromTime` in `src/game/estimate.mjs`):

```
tokens = sum over activities (working minutes × ESTIMATE_ACTIVITY_WEIGHTS[activity])
           × ESTIMATE_TOKENS_PER_WORKING_MINUTE
```

That pays a paired agent as a local one working at the assumed pace of 3.75 calls a minute,
whatever pace it really keeps. It is coarser than the local estimate: state changes shorter
than a snapshot apart are missed or stretched to the next snapshot, the activity is sampled
four times a minute rather than followed call by call, and the pace of calls is assumed.

While a paired machine cannot be read (its last read failed, or the machines could not be
listed), its agents count no working time, whatever state they were last seen in: an
unreachable machine earns nothing. Its rooms and agents stay as long as the room shows them
(three failed reads in a row, then two snapshots without them), and its characters retire like
any other once their agent has left the room for `ESTIMATED_ABSENCE_MS`.

Who is a character: each agent, by the agent id the store knows (its terminal pane), under the
session id `estimated:<agent id>` on this computer and `estimated:<machine>/<agent id>` on a
paired machine, so two machines never share one. It lives as long as that agent is in the
room. When the agent leaves the room (its terminal closed), its character retires once it has
been missing for `ESTIMATED_ABSENCE_MS` (a minute, two rounds; this also covers a first round
that comes before the first snapshot after a restart). Rooms on paired machines join the game
like the others. Limits of this mode:

- A conversation cleared or replaced in the same terminal is not seen: the character goes on.
- An agent first seen only through a tool hook, before its pane is known, can start a second
  character that retires a minute later. The work counted under the hook's entry since the
  last round is usually not paid: merging the two meters reads as a new meter, which earns
  nothing in its first round.
- The numbers are assumptions, not measurements: a terminal that sits in "working" without
  spending (a long command) is overpaid, and a model that reads a large context in few calls is
  underpaid.
- An agent on a paired machine is paid at the assumed pace of tool calls, since its calls cannot
  be counted, and its working time is sampled every 15 seconds: it is coarser than a local
  agent's estimate, in both directions.

### Matching a session to a character

With real totals, a session's agent on screen gives its state (`working`, `waiting`, `blocked`; a `done` agent
is `idle`), its activity (write, read, run, think, delegate; any other counts as think) and
its pace (tokens per minute over the round). The match is tried in this order, among agents
on this computer only:

1. the session id an `agent.status.changed` event (`sessionId`, host API 1.8) or the snapshot
   gave the agent;
2. the conversation title, in the same workspace, when exactly one session has it (a running
   one first);
3. the only agent of the workspace, when exactly one running session there is left.

A running session with no agent still counts: its tokens count as `think`, it works while it
spends and is idle otherwise, and `game.debug.unmatched` counts it. A session with no room is
not counted, and `game.debug.unplaced` counts it. With real totals, agents on paired machines
have no history: they fight in their room as guests at a normal pace while working, and leave
nothing behind. A room whose only agents are guests does not join the game: guests never
create a project. (On the estimate they are characters; see "The estimate".)

### Closing

A character's session is over when it is listed as not running and no agent on screen runs it,
or when it is gone from a history that was not truncated (from a truncated one, after a day
without tokens). Its character retires with the session's title, which the engine keeps only
while `gameKeepTitles` is on. Turning `gameKeepTitles` off calls `setKeepTitles(false)`, which
forgets every title kept.

### Saving

One storage key, `game`, holds `{ version, save, bridge }`: the engine's save and
`{ baselines, watchedUntil, autoSpend, tokenSource }`. A stored bridge without `tokenSource`
that has a `watchedUntil` was watched through the history. It is loaded once with the engine's `migrate`, written
at most every 30 seconds after a change and when the plugin stops. It is never written when the
stored value comes from a newer plugin (a newer wrapper `version` or a newer save `version`), or
when it could not be read at all; then the game plays without saving. A failed write is logged
once and tried again. Orca keeps at most 256 KiB under one key: a larger value first loses the
baselines of old sessions, then folds old retiree records into each room's retiree count (the
bonus is computed from that count, so it does not change); a value that still does not fit is
not written, and the older stored one stays.

### Actions

Through the controller, the panel requests `game.*` and the HTTP routes `/api/game/*`:

| Panel request | HTTP route | Input |
|---|---|---|
| `game.prestige` | `/api/game/prestige` | `{ worldId, skillId }` |
| `game.upgradeItem` | `/api/game/upgrade-item` | `{ roomId, itemId }` |
| `game.buyUpgrade` | `/api/game/buy-upgrade` | `{ worldId, upgradeId }` |
| `game.assignRoom` | `/api/game/assign-room` | `{ roomId, worldId }`, `worldId` null for out of the game |
| `game.resetWorld` | `/api/game/reset-world` | `{ worldId }` |
| `game.autoSpend` | `/api/game/auto-spend` | `{ on }` |
| `game.keepTitles` | `/api/game/keep-titles` | `{ on }` |
| `game.exportSave` | `/api/game/export-save` | none |
| `game.importSave` | `/api/game/import-save` | `{ file }`, a save file as `exportSave` answers it |

Each answers `{ changed }`, except `exportSave`, which answers the save file. Ids must name something that exists: a world of the save, a room on
screen or in the save, an item of that room's chest, a skill, a group upgrade. A new world is a
kebab-case name of at most 32 characters, and there are at most eight worlds. Anything else is
refused with an error, and nothing is stored. Every action but `keepTitles` needs the game to be
running; `keepTitles` writes the setting, and the save follows. A refusal carries its reason:
the HTTP routes answer `{ ok: false, error }` with status 400.

### Save file

`exportSave` answers `{ format: 'agent-center-game', version, exportedAt, save, autoSpend }`:
`version` is the stored wrapper's (`STORED_VERSION`), `exportedAt` an ISO time, `save` the
engine's save as it is in memory, written or not. It never holds the baselines or
`watchedUntil`: they describe this computer's sessions at the moment of the export. It works
whenever the stored save has been read, even with the game off, and is refused while the stored
save is from a newer plugin.

`importSave` replaces the whole game, in every world, with a file. It is refused, and nothing
changes, when the game is not running or the stored save is from a newer plugin, when the value
is not an object with that `format`, when its `version` or its save's `version` is newer than
this plugin reads (the rule the storage uses), when its JSON is larger than the 240 KiB the
storage keeps, or when its save, brought up to this version by `migrate`, does not pass
`cleanSave`. Otherwise the save and `autoSpend` are taken from the file, the baselines and
`watchedUntil` are forgotten as when the game is turned off, and the bridge forgets the last
round, its links and the meters it read, so the next round counts from then and fights nothing,
and nothing read before the import counts again. A round that was reading the sessions when the
import came writes nothing. The settings keep their own value: `gameKeepTitles` off forgets the
file's titles on the next round. Characters of the file whose sessions are not open here retire
by the usual closing rules.

## View state

`controller.getState().game`. While the game is not running it is only
`{ status, tokenSource: null, autoSpend, keepTitles }`. While it runs:

```
{
  status: 'running', tokenSource: 'estimated', autoSpend: false, keepTitles: false,
  tickSeconds: 10,                  // the length of one tick of every fight, in game time
  worlds: [{
    id: 'main', level: 11, attackSpeed: 1.12,
    workSkills: [{ id: 'forge', level, stars, effectiveLevel, progress, canPrestige }, ...],
    gatheringSkills: [...same shape],
    materials: { bars: 98, ... },
    upgrades: [{ id: 'campfire', level, cost: { fish: 520, crops: 520 }, affordable, effect }],
    roomIds: ['local:/work/sneaky-pancake']
  }],
  rooms: {
    'local:/work/sneaky-pancake': {
      worldId: 'main', joined: true, wave: 15, waveKills: 0, killsToPass: 16,
      monster: { id, name, kind, affix, level, healthShare: 0.12, hp: 412, maxHp: 3430,
        sprite: { body, accent } }, // hp rounded up, so a monster still standing never reads 0
      party: 'fighting',            // fighting | resting | paused | idle
      pausedBy: null,               // blocked | waiting while paused, otherwise null
      stamina: 0.8,                 // share of the party's pool
      chest: [{ id, name, slot, damageType, tier, level, power, heldBy, upgradeCost, affordable }],
      chestSize: 6,
      retirees: [{ nameId, class, level, mainSkill, retiredAt, title }],
      retiredCount: 9, bonus: 0.045
    },
    'build-box:/srv/turbo-waffle': { worldId: 'main', joined: false }
  },
  characters: {
    'pane-13': { sessionId, link: 'title', guest: false, class: 'physical', level: 6,
      levelProgress: 0.4, attributes: {...}, equipment: { weapon: { id, name, tier, level },
      outfit, tool }, trade: 'mining', state: 'working' },
    'pane-5': { sessionId: null, link: 'guest', guest: true, level: 1 }
  },
  recent: [{ id: 570, at, type: 'level', roomId, sessionId, agentId, level: 9 }],
  debug: { tokenSource, readAt, sessionsRead, truncated, resets, unmatched, unplaced, guests }
}
```

- `rooms` has every room the store shows (except "No project"); `worldId` is null for a room
  out of the game, and `joined` is false until its first tokens.
- `tokenSource` is `history` or `estimated` (see "When it runs"). A UI should say plainly when
  progress is estimated.
- `characters` is keyed by the agent id the rooms use, so a UI puts a class and a level on the
  right character. `link` is how it was matched: `session`, `title`, `only`, `agent` (the
  estimate: one character per agent, on this computer or a paired one) or `guest` (a paired
  machine's agent while the game reads real totals).
- `recent` keeps the last 20 events, newest last, each with an increasing `id`: `kill` (wave,
  kind, affix, ticks, rested, materials, item, and `level`, the monster's, which is its wave),
  `drop` (item, with its `name` and `tier`), `level` (agentId, level), `retire` (sessionId,
  nameId, level) and `purchase` (worldId, kind and what was bought, with `roomId` for an item
  upgrade and null for a group upgrade, the item's `name`, and the `level` it reached). A
  purchase's level is worked back from the level now and the purchases of the same thing kept
  after it; an upgrade bought by hand is not an event and is not counted. A kill does not name
  its monster: the bridge's kill events do not carry the name, so a UI names it from the monster
  it showed last. There is no `arrive` event and no gain per hour: the bridge does not record
  who joined a party, and materials come from kills and gathering at rates that change with every
  state, so no honest hourly figure exists. A UI sees a new character in `characters`, with the
  items it holds.
- Lists are capped so the state stays far below the 256 KiB a panel post may carry: a room's
  chest shows the items in use and the strongest free ones, 12 at most (`chestSize` is the
  whole count); retirees show the newest 8 (`retiredCount` counts all).
- A character's `state` and its room's `party` and `pausedBy` come from the store's agents at
  the moment the view is built, not from the last round, so they always match the room drawn
  next to them: `working`, `waiting` and `blocked` as the agent is, `idle` for one that is done.
  A paused party says why: `blocked` when an agent is blocked, otherwise `waiting`. Sessions no
  agent on screen runs keep the state their last round read. A character whose agent left the
  room is not sent.
- The game part is rebuilt only after a round, an action, or a change in the state of an agent
  that has a character; between them every publish sends the same object.

## Simulation

```bash
npm run simulate
```

`scripts/simulate-game.mjs` plays 365 days of three made-up scenarios through the engine:
working hours 9 to 12 and 13 to 18 on weekdays, sessions that open and close, three activity
profiles (mostly writing, mostly reading and thinking, mostly delegating), waiting and idle
time, `autoSpend` every evening and prestige whenever it is offered. An agent spends 25,000
tokens per minute while it works; a lighter user works fewer minutes. Every choice is a hash,
so the output only changes with the code. It prints the progression at day 1, 3, 7, 14, 30,
60, 90, 180 and 365 and a balance check (`scripts/game-balance.mjs`) with PASS or FAIL
against the targets below, in about two seconds. A balance change is judged by its output,
not by eye.

## Balance

The design targets: power is accumulated (about 70% of a hit from the world, 20% from the
project's gear, 10% from the character; a newcomer does three quarters of a seasoned
character's work and is seasoned within hours); the most used skill of a 20 million tokens a
day world reaches 10 in about a day, 30 in about three weeks and its first prestige in four to
six months; a party at par kills a common monster in about four minutes and its wave settles a
little above the world level; a balanced party rarely rests, one missing a defender or a
supporter rests more, one missing a damage type is twice as slow against the matching
resistance; a meaningful upgrade every one to two working days; gathering 15 to 30% of
materials.

What the simulator measures now:

| | light | medium | heavy |
|---|---|---|---|
| Tokens a working day, sessions at a time, projects | 3M, 1, 1 | 20M, 3, 2 | 100M, 6, 3 |
| Most used skill reaches 10, 30, first prestige | day 5, 93, after a year | day 1, 11, 166 | day 1, 2, 32 |
| World level at day 1, 7, 30, 90, 180, 365 | 2, 6, 14, 24, 34, 49 | 8, 18, 36, 62, 98, 191 | 16, 38, 80, 219, 445, 980 |
| Wave above the world level (day 30 on) | 6 to 8 | 6 to 7 | 3 to 6 |
| Median common fight | 23 ticks, 3.8 min | 26 ticks, 4.3 min | 19 ticks, 3.2 min |
| Kills per hour of fighting | 9 to 11 | 8 to 11 | 12 to 16 |
| Character level at retirement | 37 to 45 | 24 to 33 | 24 to 26 |
| Purchases per working day (day 30 on) | 0.2 to 0.8 | 1.0 to 2.1 | 7.3 to 12.1 |
| Gathering share of materials | 30% | 25% | 16% |
| Hit from world, gear, character (day 90 on) | 55%, 20%, 24% | 71%, 22%, 7% | 77%, 22%, 1% |

At levels 10, 60 and 150 a balanced party rests in 1 to 12% of its fights, one without a
defender or a supporter in 52 to 100%; a party without magic takes 1.9 to 2.1 times as long
against armored monsters; a boss takes about three times a common monster and an elite 1.7 to
1.9 times; every fight ends. A newcomer does 73% of a seasoned character's work and is
seasoned after about an hour of an agent working. Engineering trails the other skills in all
three scenarios (agents run commands less than they write or read), so their parties attack
at 0.88 to 0.98 of the reference speed; the wave and the monster's health follow the
world level, not the party, so that shows as a slightly longer fight.

Targets the numbers do not meet, and why:

- The hit split is right only in the middle. A character's own share is bounded (seasoning
  and its own attribute points, the "three quarters" rule), while the world's grows without
  end, so the character's share falls from about a quarter in a young world to almost nothing
  in a world of level 1000. Keeping both targets everywhere is impossible; the newcomer rule
  wins because it keeps every new session useful.
- Upgrades follow the world's growth. Gear must keep up with the world to stay a fifth of a
  hit, and the heavy world grows twenty times faster than the light one while it has six
  characters' items to the light one's single character. Medium gets one or two upgrades a
  working day, light one every one to five days, heavy about ten a day.
- Most projects have one or two sessions at a time, so most parties are not balanced and a
  fight with a rest is the usual case: 60 to 90% of fights early, 25 to 60% after a year as
  the campfire grows.