# Game mode: engine

An optional layer on top of the rooms. The tokens a session spends become progress. This page
is the contract for the engine in `src/game/`, for the bridge that feeds it from the worker
("The bridge") and for what a UI receives ("View state"). The engine is pure: no I/O, no
timers, no Orca API, no DOM. The UI does not draw the game yet.

## The engine

`createEngine({ content: { monsters, items, races, bosses, cities, legendary, bestiary, settlement, instances } })` takes
the parsed `game/monsters.json`, `game/items.json`, `game/races.json`, `game/bosses.json`,
`game/cities.json`, `game/legendary.json` (optional: without it there is no legendary loot) and
`game/bestiary.json` (optional: without it nothing is counted and no bestiary bonus is given) and
`game/settlement.json` (optional: without it there are no stages and only the campfire, the
workbench and the rune circle can be built; see "Settlement") and `game/instances.json` (optional:
without it there are no instances; see "Instances") and `game/traits.json` (optional: without it
there are no traits; see "Traits") and returns
functions that each take a save and return a new one. None of
them mutates its input, reads the clock or draws a random number; `now`, `from` and `to` are
milliseconds the caller passes.

| Function | What it does |
|---|---|
| `applyTokens(save, { projectId, sessionId, tokens, activity, now, themeId?, title?, guest? })` | Counts the tokens a session spent since the last reading. Creates the world, the project (wave at the world level, starter chest) and the character when missing; a session found among the project's retirees comes back instead. Grants experience to the activity's work skill and to the character, and records `lastTokenAt`. A guest or an excluded project changes nothing. |
| `advance(save, { from, to, sessions })` | Moves time forward. `sessions` lists `{ projectId, sessionId, state, activity?, tokensPerMinute?, themeId?, guest?, scenes? }` with `state` one of `working`, `waiting`, `blocked`, `idle`; `scenes` lists the themes a travelling project moves through (see "Scenes"). See "Time". |
| `advanceWithEvents(save, interval)` | The same, returning `{ save, events }`: one `kill` event per kill with its wave, kind, rank, affix, ticks, whether the party rested, materials and dropped item, and `bestiary` news when there is some (see "Bestiary"). |
| `prepareFights(save, { sessions })` | Moves no time. Records each reported character's state, and gives a project whose party has a working member (a character or a guest) and no monster its monster now, measured against that party. |
| `closeSession(save, { projectId, sessionId, now, title? })` | Retires the session's character. |
| `prestige(save, { worldId, skillId })` | Prestiges a skill at the cap; otherwise returns the save unchanged. |
| `upgradeItem(save, { projectId, itemId })` | Upgrades a chest item with the world's materials; unchanged when it cannot pay. |
| `buyGroupUpgrade(save, { worldId, upgradeId, useCoins? })` | Buys the next level of a group upgrade (a building of the settlement), in materials alone or, with `useCoins`, half in coins from the tier that allows it; unchanged when it cannot pay, the building is not open at the settlement's stage, or coins were asked of a tier that takes none. `buildingProblem(save, which)` says why the last two refuse, or null. |
| `settlementNews(before, after)` | The tiers, stages and renovation stars a change reached, per world (see "Settlement"). |
| `setCharacterTrade(save, { projectId, sessionId, trade })` | Sets the trade a living character gathers, a gathering skill, `'scarcest'` or null for none (see "Gathering"); unchanged when there is no such character, the trade is unknown or nothing would change. |
| `equipItem(save, { projectId, sessionId, slot, itemId })` | Sets what a living character holds in a slot: an item of the room's chest, `null` for nothing, or `'auto'` (see "Choosing equipment"); unchanged when the choice is refused or changes nothing. `equipProblem(project, { sessionId, slot, itemId })` says why a choice is refused, or null. |
| `bestGearForRoom(save, { projectId })` | Re-runs the automatic pick for every slot of a room nobody pinned; unchanged when nothing would change. |
| `setRoomTrade(save, { projectId, trade })` | Sets the trade of a project's characters that have none of their own, a gathering skill, `'scarcest'` or null for Auto; unchanged when the project is not in the save, is out of the game, the trade is unknown or nothing would change. |
| `setActiveRelic(save, { projectId, relicId })` | Makes one of a room's relics the active one, or none with null; unchanged when the room does not own it. See "Legendary loot". |
| `setKeepTitles(save, value)` | Turns keeping session titles on or off; off forgets every title kept. |
| `autoSpend(save)` / `autoSpendWithPurchases(save)` | Buys the best affordable purchase again and again (see "Spending"). |
| `moveProjectItems(save, { fromProjectId, toProjectId, now? })` | Moves a project's chest and retirees into another project of the same world, then removes the first from the world and from `projectWorld`. Its characters retire first (dated `now`, or when last seen), so no item stays held. Every item goes into the target's chest, free, through the chest's own numbering of copies, but an entry never ends above `COPIES_PER_ITEM` copies there: items the target's characters hold always stay, the best of the rest fill the copies left, and the lowest are salvaged into the world's materials as a drop would be (one upgrade of a fresh copy at the world level). Its retirees, kept records and folded ones alike, are added to the target's `retiredCount`. The same save when the two are not projects of one world. |
| `sendItem(save, { fromProjectId, toProjectId, itemId \| itemIds, confirmHeld? })` | Sends items of a project's chest to another project of the same world, one a character holds only with `confirmHeld` (see "Sending to another room"); `sendItemWithSalvage` answers `{ save, salvaged, sentSalvaged, repicks }`: the copies the target's cap salvaged, which of them were sent ones, and what each holder took instead. The same save when refused; `sendItemProblem(save, sending)` says why, or null. `itemName(entryId)` names an item's entry. |
| `enterInstance(save, { projectId, instanceId, tier, rematch? })` | Sends a room's party into an open instance at a tier, or into a rematch of its boss (see "Rematches"), freezing its wave (see "Instances"); the same save when refused, and `enterProblem(save, entry)` says why. |
| `chooseBoon(save, { projectId, boonId })` | Takes one of the two boons a room's run is offered in the vault; the same save when refused, and `boonProblem(save, choice)` says why. |
| `recallParty(save, { projectId })` | Ends a room's run by hand, as a failed run ends: what it found is kept, its wave comes back, and the instance waits on a cooldown for that room. |
| `forecastSend(save, sending)` | What `sendItem` would do, changing nothing: `{ problem, salvaged: { item, isSent }[], materials }`. Held items are assumed confirmed. |
| `sendRelic(save, { fromProjectId, toProjectId, relicId })` | Sends a relic a project owns to another project of the same world; sending its active one leaves it with none active. The same save when refused, and `sendRelicProblem(save, sending)` says why. |
| `cleanSave(save)` | Checks a save that comes from outside the plugin (an imported file) part by part and rebuilds it from the fields the engine writes: `{ ok: true, save }`, or `{ ok: false, problem }` naming the first part that is not what the engine writes (an unknown id, a number out of range, an item held by nobody, a project in two worlds or in another world than its own, more than `MAX_WORLDS` worlds, a world id the actions would not accept, `__proto__`, `constructor` or `prototype` as a key, coins that are not whole or out of range, a market that names a city not in the content, an unknown material, a pressure out of range or an offer sold twice). A file from before the market reads with no coins and a market at rest. Worlds and world ids follow `src/game/world-ids.mjs`, which the actions use too. Unlike `migrate`, which repairs what the plugin's own storage holds, it refuses. |
| `sellMaterial(save, { worldId, cityId, materialId, amount })` | Sells a whole amount of a material the world holds to an open city for coins (see "Market"); unchanged when it cannot. |
| `tradeMaterial(save, { worldId, cityId, fromId, toId, amount })` | Sells `amount` of one material and buys as many whole units of another, which the city produces, as the sale paid for; the coins left over go to the world. Unchanged when it gives nothing. |
| `buyMaterial(save, { worldId, cityId, materialId, amount })` | Buys a material an open city produces with the world's coins. The engine's own (the simulator uses it); no surface offers it in this version. |
| `buyStallOffer(save, { worldId, cityId, offerIndex, entryId, projectId })` | Buys an offer of a city's stall into a project's chest; unchanged when it cannot (see "The stall" and "City ranks"). Every sale, purchase, trade and stall purchase adds to the world's standing in that city. |
| `teachTrait(save, { projectId, sessionId, traitId })` / `swapTrait(save, { projectId, sessionId, oldTraitId, traitId })` | Teaches a scroll's trait into a free slot, or swaps a carried trait for a scroll (the old one back as a scroll, for a fee); `teachProblem` / `swapProblem` say why one is refused. See "Traits". |
| `buyTraitScroll(save, { worldId, cityId, offerIndex, traitId, projectId })` / `sellTraitScroll(save, { worldId, cityId, projectId, traitId })` / `sendScroll(save, { fromProjectId, toProjectId, traitId })` | The trait broker and sending a scroll to another room; each has its `…Problem`. |
| `buyCharter(save, { worldId, cityId })` | Buys a city's next charter: its rank rises by one (see "City ranks"); unchanged when it cannot, and `charterProblem(save, which)` says why. |
| `view(save)` | A plain summary for a UI: per world the level, the attack speed from Engineering, work and gathering skills with level, stars, effective level and progress, materials and group upgrades with their next cost, coins and the market (see "View state"); per project the wave, kills on it and kills it takes, the monster with its health share, stamina, the party with class, level, attributes, equipment, trade and state, the chest, retirees and retiree bonus. |

The engine lives in `engine.mjs` (composition and purchases), `sessions.mjs` (tokens and
retirement), `advance.mjs` (time), `fight.mjs` (a project's fight), `spending.mjs` (group
upgrades and `autoSpend`), `drops.mjs` (item drops), `market.mjs`, `market-prices.mjs` and
`stall.mjs` (the market), `city-ranks*.mjs` and `city-stall-legendary.mjs` (its cities' ranks), `transfer.mjs` (sending to another room), `settlement*.mjs` and
`buildings.mjs` (the settlement), `world-effects.mjs` (what a world gives every party in it), and
`view.mjs` with `market-view.mjs` and `settlement-view.mjs`, over the rule modules described
below.

Every number lives in `src/game/constants.mjs`. Formulas below name those constants.

## Principles

- Experience comes from tokens only. Kills and gathering give materials, never experience
  for work skills.
- Nothing is ever lost: no death, no stolen materials, no decay. The market only trades what a
  person chooses to trade, at a loss in base value every time (see "Market").
- No input is needed. Prestige is the one choice the game offers by itself; a person may also
  choose what idle characters gather (see "Gathering") and trade at the market, and Auto plays
  as well.
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
- Gathering trade: `hash(sessionId) mod 6` over the gathering skills (`trade`, the engine's own
  pick, called Auto). What it gathers can be chosen (see "Gathering").

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
  REFERENCE_PARTY_SIZE * kind.hp * rank.hp`, with `n` the working characters
  when the monster appears. Most projects have one or two sessions at a time; they still kill
  in about `HITS_TO_KILL` ticks, and the class mix and the support's aura still matter.
- Damage taken is multiplied by `kind.physical` or `kind.magical` by type.
- Kind: the first monster of every `BOSS_EVERY`-th wave is a `boss`; otherwise a hash of
  world, project, wave and kill picks `common` (`COMMON_SHARE`), `armored` (`ARMORED_SHARE`) or
  `ethereal`. The kind sets the resistances; the rank says how strong the monster is.
- Rank: a ladder, each step told apart in a room by its glow (see "Ranks" below). Off boss
  waves the same kind of hash picks `normal`, `veteran`, `elite` or `champion` by the shares in
  `MONSTER_RANKS`; a boss wave's boss is `legendary` one time in `LEGENDARY_ONE_IN`, otherwise
  `boss`. An elite, a champion and a legendary boss carry one affix: `regenerating`, `enraged`,
  `thorny`, `swift`, or one of the two resistances. Each affix has one clear counter among the
  classes.
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
- A regenerating monster heals `REGENERATING_SHARE` of its health a tick, never more than
  `REGENERATING_DAMAGE_SHARE` of the damage it took that tick, so every fight can be won.
- Reward for a kill: `REWARD_BASE * REWARD_GROWTH ** level * kind.reward * rank.reward`
  materials, split by the monster's loot table.
- Item drop: chance `min(ITEM_DROP_MAX, ITEM_DROP_BASE + ITEM_DROP_PER_LUCK * luck)` with the
  working party's summed luck, times the rank's `drop` factor (same cap). The slot
  is picked by hash with `DROP_SLOT_WEIGHTS`, a weapon's damage type by a class picked by hash.
  The entry is the highest tier up to `dropTier(level) = 1 + floor(REFERENCE_GEAR_PER_LEVEL *
  level / TIER_LEVELS)` (at most `ITEM_MAX_TIER`) among the generic and the room theme's
  entries: a drop helps a project catch up with the reference gear, never jumps past it. The
  chest keeps `COPIES_PER_ITEM` copies of an entry; a further drop of it is salvaged into the
  materials one upgrade of a fresh copy costs, so a drop never adds power for free.

### Ranks

| Rank | Odds | Health | Reward | Item drop | Affix | In the room |
|---|---|---|---|---|---|---|
| normal | 75% off boss waves | x1 | x1 | x1 | no | no glow |
| veteran | 15% | x1.15 | x1.25 | x1.5 | no | a faint pale outline, still |
| elite | 8% | x1.5 | x3 | x3 | yes | an outline and a slow pulsing halo in the affix's colour |
| champion | 2% | x2 | x5 | x4 | yes | a double outline (affix colour inside, gold outside) and a quicker, larger halo |
| boss | 4 in 5 boss waves | the `boss` kind's x4 | x5 | x1 | no | a deep red halo and outline, slow |
| legendary | 1 in 5 boss waves | x4 x1.3 | x5 x1.6 | x3 | yes | a gold outline, an affix-coloured halo and a turning ring of light |

- The numbers live in `MONSTER_RANKS` (`src/game/constants.mjs`) and multiply the kind's. The
  item drop chance is multiplied by `drop`, under the same cap.
- Why these numbers: before the ladder one monster in eight was an elite (health x1.5, reward
  x3), so the average monster had health 1.0625 and paid 1.25. The ladder averages health
  1.0825 and pay 1.28: kills per hour drop by about 2% and the reward per hour of fighting stays
  the same. Rarer ranks take longer and pay more per minute.
- A rank's word is on the monster's name plate: `Veteran`, the affix for an elite, `Champion`,
  `Boss`, `Legendary`. Without motion (reduced motion) the glows stay and only stop moving.
- A monster saved before ranks has no `rank`: a boss is a `boss`, one with an affix an `elite`,
  any other `normal`, with that rank's item drop factor.

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
  so does the project's `kills`, a travelling project moves to its next scene (see "Scenes"),
  and the next monster appears with the rune circle's cut taken off its health.
- The party's stamina pool is `referenceStamina(level) * (outfit factor / GEAR_GROWTH **
  referenceGearLevel(level)) ** OUTFIT_STAMINA_WEIGHT`, with the mean outfit factor of the
  working characters. The save keeps stamina as a share of the pool.
- Sessions that are not reported, and projects without a reading, do nothing.

## Gathering

- The trade a character gathers (`effectiveTrade` in `trades.mjs`) is decided in this order:
  1. the character's own `tradeChoice`, when it has one;
  2. otherwise its project's `tradeChoice`, when the room has one;
  3. otherwise its `trade`, the engine's pick (Auto).
  So the room's choice reaches every character without one of its own, those that join later
  included, and changing it leaves characters with their own choice alone. Null, missing or
  unknown values are no choice.
- Either choice may be `'scarcest'` ("Auto: what is scarcest", `scarcest.mjs`): the character
  then gathers what its room picked for it, toward the materials the world has least of. The room
  picks for all its followers at once (`withScarcestPicks`, at the start of each advance):
  - it orders the six gathering trades by `stock / (need + mean need + 1)`, where `need` is
    what the next level of every building asks of that material (`gatheredNeed`, open or not, so
    no content is needed): a material wanted soon counts as scarcer, one no building wants is
    still gathered once its stock is low, and a material no trade yields (bars, crystals...) is
    never picked. Ties keep the order of the trades;
  - the followers, in session order, take the `SCARCEST_SPREAD` (3) scarcest in turn, the
    scarcest first: one character takes the scarcest, two the two scarcest, five go 2/2/1;
  - the picks are kept in `project.scarcest` (`{ at, picks: { [sessionId]: trade } }`) and made
    again `SCARCEST_REVIEW_MS` (an hour) of game time later, or at once for a new follower, so they
    do not flap with every unit gathered. A follower the room has not picked for yet gathers its
    Auto trade. A room nobody in follows the choice keeps no `scarcest`.
  The view gives each character a `tradeReason` (`own`, `room`, `scarcest` or `auto`), and the
  Party tab says what a follower gathers now and why. `npm run simulate` compares every room on
  it with the trades the game gives ("Gathering" table): it narrows the spread of the gathered
  stocks and does not lower gathering. A character keeps its choice in its retiree record and has it
  again when its session comes back. A world reset forgets the room's choice with the rest of
  the project.
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
- Group upgrades, per world, each with a two-material recipe in `GROUP_UPGRADES`: the buildings
  of the settlement (see "Settlement" for the two that need one, the Storehouse and the
  Defences, and for paying half in coins). Level L
  costs `round(GROUP_COST_BASE * REWARD_GROWTH ** worldLevel * GROUP_COST_GROWTH ** (L -
  GROUP_LEVELS_PER_WORLD_LEVEL * worldLevel))` of each material, at least 1. No level cap; the
  campfire and the rune circle approach a ceiling (`MAX * L / (L + HALF)`) so they never make
  fights trivial:
  - `campfire`: after each kill the party gets back `CAMPFIRE_MAX * L / (L + CAMPFIRE_HALF)`
    of its missing stamina (healing between fights).
  - `workbench`: item upgrades cost `1 / (1 + WORKBENCH_DISCOUNT_PER_LEVEL * L)`.
  - `runeCircle`: every new monster starts with `RUNE_CIRCLE_MAX * L / (L + RUNE_CIRCLE_HALF)`
    less health.
- `autoSpend` looks at every item a living character holds and every building the settlement
  has opened. Among the affordable ones it buys the one with the lowest total cost divided by
  `SPEND_WEIGHTS` of its kind (a group upgrade's own `spendWeight` when it has one: 0.75 for the
  Storehouse, which pays off only for a world that trades), and repeats, at most
  `SPEND_MAX_PURCHASES` times a call. It pays in materials only and never spends coins.

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

### Choosing equipment

The automatic pick above (`equipFromChest` in `chest.mjs`) runs only when a character arrives or
comes back from retirement, and when a person asks for it. A person can also choose by hand
(`equip.mjs`), from the Party tab:

- **A free item** of the room's chest that fits the slot (a weapon of the class's damage type; a
  legendary item only for who it is made, see "Who holds equipment" under "Legendary loot") is
  taken; what the character held there goes back to the chest, free.
- **An item another character holds** is swapped: the two exchange that slot's items (the other
  gets what the character held there, or nothing). The swap is refused, with the reason, when
  the other could not use what it would get, so no character ever holds a weapon of the wrong
  type. The one who chose is pinned; the other keeps its own pin or none.
- **Nothing** empties the slot; the item goes back to the chest.
- A slot chosen by hand, item or nothing, is **pinned** (`pinned: { weapon: true }` on the
  character), and the automatic pick leaves it alone. **Auto** unpins it and takes the best free
  item of that slot at once, which may be the one it held.
- **Best gear for everyone** puts every unpinned item of the room's living characters back in the
  chest, then lets each character, in order of session id, take the best free item of each of
  its unpinned slots, as on arrival. It answers how many slots changed.
- Pins belong to a living character. A character that retires gives its items back and its pins
  are forgotten (the retiree record has none), so one that comes back starts on Auto. An item a
  character holds never leaves the chest (moving a left-behind room's chest and salvage only
  touch free items), so a pin never points at a missing item; the save check refuses one that
  does.

### Sending to another room

Gear is per room on purpose: a room's chest serves its own characters. A person can still move
any item to another room of the same world (`transfer.mjs`), from the Chest tab: one at a time
from an item's detail, several at once with **Move items**, or by dragging a slot onto a room's
chip above the tabs.

- **An item** leaves the chest and arrives free in the other room's, numbered as its copies
  are. Up to `MAX_ITEMS_SENT` (60) go in one sending, in the order given; one id twice is refused.
- **An item a character holds** goes only when the person confirmed it (`confirmHeld`), so gear is
  never taken from a working character by accident. It is taken first: that slot goes back to
  Auto (its pin, if any, is dropped) and takes at once the best free item the character may hold
  there, by the same rule as every automatic pick (`autoPick` in `equip.mjs`: the class's damage
  type, a legendary item only for who it is made for), or nothing. The answer lists what each
  holder took (`repicks`). The target keeps at most `COPIES_PER_ITEM` copies of an entry, exactly as when a chest left
  behind is moved (`mergeChests` in `orphans.mjs`): items held there always stay, the best of the
  rest stay, and the lowest is salvaged into the world's materials as a drop past the cap would be.
  That may be an item sent; the answer says which.
- **Nothing turns into materials unannounced.** Before a sending, the Chest tab asks the worker
  what it would do (`forecastSend` in `transfer.mjs`, which runs the sending on a copy and changes
  nothing): when the target's cap would salvage any item, sent or kept, it names each one and the
  materials the world would get, and asks "Send anyway?"; a sending the rules would refuse is
  refused where the person sent it, with the reason. After it, the notice names where the items
  went and every item salvaged.
- **Legendary equipment** is never salvaged and never doubled: one the target already owns is
  refused, and so are two copies of one entry in a single sending.
- **A relic** the room owns moves to the target's relics, after its own; the target keeps its
  active relic, and a target with no relic makes it active, as a first drop does. One the target
  owns is refused. The active relic can be sent too: the sending room is then left with no active
  relic (another is never picked for it, so the person chooses), and the Relics card asks before
  sending it and says so after. Pity counters stay with their room.
- Both rooms must play in the same world, and the target must be on screen. Each refusal names
  its reason (`TRANSFER_REFUSALS`).

Sending is free: it only moves where the power sits. The simulator checks that funnelling every
spare piece into one room does not let that room run away (see "Sending gear" under "Balance").

## Legendary loot

Four kinds, in `game/legendary.json` (checked by `src/game/legendary-content.mjs`), each with a
name, a flavour line, a colour and a picture in `ui/art/legendary/`:

- **Relics** (`relic`, ten, two per city): a room owns any number and has one **active**; only the
  active one acts, on the whole party. Each names the city of `game/cities.json` that sells it
  (`city`, checked). They drop from bosses, and a city's stall sells one now and then (see "The
  stall"); `relicsCityCanOffer(index, { cityId, ownedIds })` gives that city's relics a room does
  not own.
- **Boss relics** (`boss-relic`, seventeen): relics too, but each is the signature of one named boss
  of `game/bosses.json` (`boss`, its id), drops only from that boss and is never sold.
- **Legendary equipment** (`equipment`, fifteen): a weapon, outfit or tool dropped only by its boss,
  made for a class (`class`) or, for a tool, a trade (`trade`), with a recipe. It lives in the
  chest like other gear (`legendary: true` on the item, its id its entry's id), is upgraded the
  same way, goes back to the chest on retirement and moves with a chest left behind. It is never
  salvaged or capped away, and a room never holds two of one.
- **Instance relics** (`instance-relic`, fourteen): relics too, each the reward of an instance's first
  clear (`instance`, its id; see "Instances"), never sold and never dropped.

### Effects

A buff is data: `{ effect, scope, amount, ...qualifiers }`, one of a closed set of types the
engine interprets (`src/game/legendary-effects.mjs`). A relic's scope is `party`; equipment's is
`holder`: it acts on the living character holding it, or, for a party quantity, on its party while
that character fights. The bestiary's is `world`: it acts on every party of the world as a relic
acts on its room's (see "Bestiary"). The UI words the text from the same data (`ui/engine/legendary-labels.js`),
and a test checks every shipped item's text against its effect.

| Type | Scopes | What it changes |
|---|---|---|
| `attackSpeed` | party, holder | hits × (1 + a), after Engineering's limits |
| `damage` | party, holder | hits × (1 + a); `damageType` limits it to one type, `ranks` to monsters of those ranks |
| `critChance` | holder | the crit chance + a, under `CRIT_MAX` |
| `critDamage` | party | `CRIT_DAMAGE` × (1 + a) |
| `staminaDrain` | party, holder | each monster strike × (1 − a) |
| `staminaPool` | party | the stamina pool × (1 + a) |
| `outfitStamina` | holder | the holder's outfit factor × (1 + a) in the pool's mean |
| `restTime` | party | a rest is a seconds shorter (in whole ticks) |
| `staminaPerKill` | party | + a of the pool after each kill, after the campfire |
| `healing` | holder | the holder's medicine × (1 + a) for healing |
| `supportAura` | holder | the aura the holder gives × (1 + a); a member gets the strongest |
| `affixWeakening` | party | each affix's addition × (1 − a): swift's and enraged's attack, thorny's and regenerating's shares, and a resistance's missing damage brought a of the way back |
| `thorns` | party | each strike takes a × (stamina drained ÷ pool) of the monster's max health |
| `runeCircle` | party | the rune circle's cut × (1 + a) |
| `itemDrop` | party | the item drop chance × (1 + a), same cap |
| `killMaterials` | party | a kill's materials × (1 + a), only `materials` when listed |
| `gatherYield` | party, holder | units gathered × (1 + a), only `materials` when listed |
| `gatherHours` | party | gathering stops a hours later after the last tokens |
| `gatherXp` | party | gathering skill experience × (1 + a) |
| `characterXp` | party | the room's characters' experience from tokens × (1 + a) |
| `skillXp` | party, holder | the holder's tokens (with an instance relic, every character's) give the named work skill × (1 + a) |
| `upgradeCost` | party | the room's item upgrades cost × (1 − a), after the workbench |
| `raceDamage` | party, world | hits × (1 + damage + a) against a monster of one of `races` |
| `legendaryPity` | world | each step of a boss's legendary pity counts × (1 + a) |
| `marketFee` | world | the market's fee − a (the Storehouse's; see "Settlement") |

The bestiary may also give, with the scope `world`, `damage`, `critDamage`, `staminaDrain`,
`staminaPool`, `restTime`, `staminaPerKill`, `affixWeakening`, `thorns`, `runeCircle`, `itemDrop`,
`killMaterials`, `gatherHours`, `gatherXp`, `characterXp` and `upgradeCost`.

Stacking: effects of different sources (the active relic, the equipment held, the world's
bestiary and the world's settlement) add, and each type's sum is capped by `LEGENDARY_EFFECT_CAPS` (`restTime` in seconds,
`gatherHours` in hours). Only one relic is active and a room holds one of each item. With the
strongest relic of each type, every piece of legendary equipment and a whole bestiary at its top,
no type passes its cap (a test checks it), save `gatherYield`, where the Sheaf of the Long Summer
and the Blightmoon Sickle already reach 0.15 together without the bestiary. The `damage` cap is
0.15: the Crown of the Ossuary and the Labyrinth Cleaver alone reached the 0.12 it was, and the
bestiary's points against bosses, elites and a damage type sit on top.

### Who holds equipment

One rule says who may hold an item (`mayHold` in `legendary-equip.mjs`, over `weaponTypeOf` in
`chest.mjs`): a weapon of the class's damage type, any outfit or tool, and a legendary item only
when it is made for the character, its class or, for a tool, the trade it gathers now (its own
choice, the room's, or Auto's). Every pick follows it:

- **The automatic pick** (a new or returning character, **Auto** on a slot, **Best gear for
  everyone**) takes, for each slot, the best free legendary item made for the character over the
  plain item it would have taken, unless that one is more than `LEGENDARY_PICK_MARGIN` (2) upgrade
  levels ahead, and never one made for someone else. Best gear only frees items and picks again,
  so a legendary item is never lost or copied.
- **By hand**, the Party tab's picker shows a legendary item to every character of its damage type,
  with its buff beside the power it adds, but only one it is made for can take it; the others see
  who it is made for. A swap is refused when either side would end up with an item it may not
  hold. A legendary item chosen by hand is pinned like any other.

### Drops

Only a boss wave's boss (rank `boss` or `legendary`) rolls, by hash of the kill's seed (the one
its item drop uses), so the same room, wave and kill always drop the same thing:

1. A pool relic the room does not own: chance `RELIC_CHANCE[rank]` (boss 8%, legendary 50%) plus
   `RELIC_PITY_STEP` (8%) for each such kill since the room's last pool relic. A room that owns no
   relic at all gets one for certain. Picked by hash among the missing ones; none once it owns all.
2. For a boss of the roster whose own item the room lacks: chance `BOSS_ITEM_CHANCE[rank]` (boss 5%,
   legendary 15%) plus `BOSS_ITEM_PITY_STEP` (5%) for each kill of such a boss without it. A
   room's first boss-owned item is certain. A boss comes back only after the whole roster (550
   waves), so pity counts kills of any boss with an item, not of the same one.

Equipment drops at the reference gear of the boss's level (the drop tier, with the upgrade levels
that tier lacks). The first relic a room obtains becomes active. A kill event carries
`legendary: [{ id, kind }]` when something dropped.

### In the save

A room keeps `legendary: { relics, active, relicPity, bossPity }` (relics in the order obtained)
only when it has something to keep, so a save from before loads unchanged. `migrate` repairs it;
`cleanSave` refuses a relic the content does not have, one owned twice, an active relic not owned,
pity out of range, a legendary item that is not content equipment made as its entry, a second
copy, and a plain item that uses a legendary id. Moving a chest left behind adds its relics after
the target's (the target keeps its active relic, or takes the source's when it had none, and its
own pity) and keeps the better of two copies of an item, salvaging the other, unless the target's
is held. A world reset forgets them with the room.

## Bestiary

Each world keeps a book of what it has fought (`src/game/bestiary*.mjs`), with its numbers in
`game/bestiary.json` (checked by `src/game/bestiary-content.mjs`; `npm run check` and the worker
refuse a file that misses a race of `game/races.json`).

### Counters

Counted where a kill is settled (`noteKill` in `bestiary.mjs`, from `fight.mjs`), so they follow
the same hash and order as everything else:

- **A race**: every monster with a race of `game/races.json`, generated or a boss of the roster,
  counts for its race under its rank (normal, veteran, elite, champion, boss, legendary), with the
  game day of the first kill (`floor(ms / MARKET_DAY_MS)`, the day of the advance it fell in).
- **A boss**: a boss wave's boss (rank `boss` or `legendary`) of the roster also counts as beaten
  once, and as beaten as legendary when its rank was; first day as above.
- **Others**: a hand-made themed monster (`game/monsters.json`, shown as itself) has no race and
  counts under one counter of its own, by rank. They are a theme's local flavour, not creatures to
  master, so they have no entry, no mastery and no bonus.
- **Points**: a kill is worth points by its rank (`points`): plain 1, veteran 2, elite 5,
  champion 10, boss 25, legendary 60. They are worked out from the counters, never stored, so a
  strong monster is an event for its race.
- A world reset forgets the bestiary with the world. Content without `game/bestiary.json` counts
  nothing.

### Back-fill

The rooms counted every kill (`kills`) long before the bestiary did. Once per world, at the start
of its first advance with this version (`backfillSave` in `src/game/bestiary-backfill.mjs`, run by
`advanceWithEvents`, where the races are known; `migrate` does not know the content), the kills its
rooms counted and its bestiary lacks are given to its races as plain kills: each race gets a share
weighted by `1 + chanceOf(worldId|bestiary-fill|raceId)` (between 1 and 2), whole kills, the
remainder to the largest leftover parts, so every kill is given and the same world always gets the
same spread. A race first given kills this way is first seen that day. Bosses are never
back-filled (who was beaten is not known), nor are the others. Back-filled kills are no news, so
no room celebrates them. The number given is kept as `bestiary.filled`, which is also the mark that
it is done: it is kept on an otherwise empty bestiary, and the back-fill never runs again however
the rooms' counts change later. A new world gets `filled: 0` on its first advance.

A race or a boss with no kill is undiscovered: the UI shows its silhouette and "???".

### Mastery

A race's mastery runs on a ladder of points with no top (`src/game/bestiary-ladder.mjs`): level n
needs `firstCost × (growth^n − 1) / (growth − 1)` points in all, rounded, times the race's `scale`.
The first step is cheap and each costs `growth` times the one before. The four races a theme
prefers (they come up three times as often in Gothic Dungeon rooms) have `scale` 1.5.

| Level | 1 | 2 | 3 | 4 | 5 | 10 | 15 | 20 | 25 | 26 | 27 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Points (`firstCost` 2, `growth` 1.35) | 2 | 5 | 8 | 13 | 20 | 109 | 509 | 2,304 | 10,353 | 13,979 | 18,873 |

Its first `levels` (25) are powered: each gives `raceDamage` 0.002 against that race (5% at level
25), and every `perkEvery` (5th) level also the race's perk, once each time (five times at 25).
Past level 25 mastery goes on without end as prestige ranks that give no more power: the race's
card carries its title (`title`: "Slime-scourer", then "Slime-scourer II", III, ...) and a border
that deepens with the rank.

| Race | Perk, each time | Race | Perk, each time |
|---|---|---|---|
| Goblins | `itemDrop` +0.8% | Minotaurs | `upgradeCost` −0.4% |
| Orcs | `damage` +0.2%, physical | Dragons | `damage` +0.2%, magical |
| Trolls | `affixWeakening` 0.2% | Spiders | `affixWeakening` 0.8% |
| Ogres | `staminaPool` +0.4% | Insects | `gatherHours` +2.4 min |
| Humans | `characterXp` +0.2% | Slimes | `killMaterials` +0.4% |
| Skeletons | `staminaDrain` −0.2% | Elementals | `gatherXp` +0.4% |
| Zombies | `gatherHours` +2.4 min | Golems | `thorns` 0.2% |
| Vampires | `staminaPerKill` +0.2% | Ghosts | `runeCircle` +0.4% |
| Werewolves | `critDamage` +0.8% | Treants | `upgradeCost` −0.4% |
| Demons | `damage` +0.4% against elites and champions | Lizardfolk | `gatherXp` +0.4% |

### Hunter rank

The world's hunter rank is the level all its points (every race's and the others') reach on a
ladder of their own (`rank`: `firstCost` 20, `growth` 1.25: rank 1 at 20 points, 5 at 164, 10 at
665, 20 at 6,859, 30 at 64,543), with no end. It gives `killMaterials` `0.02 × r / (r + 20)`
(`half` 20): 1% at rank 20, always under 2%. It is the bar that always moves.

### Boss hunter

Every boss of the roster beaten at least once counts one; beating the same boss again counts only
for that boss. The first boss already gives a level.

| Level | Distinct bosses | Adds |
|---|---|---|
| 1 | 1 | `damage` +0.5% against bosses and legendary bosses |
| 2 | 5 | `legendaryPity` +15% |
| 3 | 15 | `damage` +0.5% against bosses and legendary bosses |
| 4 | 30 | `legendaryPity` +15% |
| 5 | 55 | `damage` +0.5% against bosses and legendary bosses, `legendaryPity` +20% |

### As effects

`bestiaryEffects` turns a world's counters into effects with the scope `world`; `worldEffectsOf`
works them out once per state of the counters. They join the room's relic effects wherever those
are read (the fight, the rune circle, gathering, a character's experience, upgrade prices and the
legendary drop's pity), so every bonus is summed with the relic and the equipment under the same
caps. A level reached during an advance counts from the next one, as a relic that drops does.

### In the save

A world keeps `bestiary: { races, bosses, others?, filled? }` from its first advance: a race's (and
the others') counter is `[normal, veteran, elite, champion, boss, legendary, firstDay]`, a boss's
`[beaten, legendary, firstDay]`, `filled` the kills given by the back-fill. Points, levels and ranks
are worked out from them and never stored. Twenty races and 71 bosses fit in under 2 KB. `migrate`
drops counters of another shape and keeps `filled`; `cleanSave` refuses a race or boss the content
does not have, a list of the wrong length or with a number that is not a whole count, a counter
with no kill (or no win), more legendary wins than wins, a `filled` that is not a whole count, an
empty bestiary without `filled`, and any bestiary when the content has none.
Export and import carry it with the world.

### Kill news

A kill event carries `bestiary: [...]` when it made something new: `{ kind: 'race', id,
discovered: true }` for a race's first kill, `{ kind: 'race', id, level }` for a mastery level,
`{ kind: 'boss', id, discovered: true }` for a boss's first win, `{ kind: 'hunter', level }` for a
boss hunter level and `{ kind: 'rank', level }` for a hunter rank. A kill that lifts a race several
levels at once (a champion, a boss) tells only the last. A race level past the powered ones is a
prestige rank; the bridge adds its `title` and `prestige`.
The bridge turns each into a `bestiary` event of `recent` (see "View state").

## Instances

A road of dungeons, six in its first region and eight in the second (`game/instances.json`, checked
by `src/game/instance-content.mjs`, `instance-regions.mjs` and `instance-boons.mjs`; the run is `instance-run.mjs`, `instance-fight.mjs`, `instance-monsters.mjs`
and `instance-rewards.mjs`, its numbers `instance-constants.mjs`). A room sends its party into an
open instance at a tier; while inside, its wave, wave kills and standing monster are frozen, and its
working time, in the same rounds and ticks as the waves, plays the instance's six rooms. The other
rooms keep fighting their waves; one room is inside an instance at a time, and an instance holds
one room at a time.

### The road

| | Instance | Races | Opens at World Lv | Boss | Elite (mini-boss) | Third room | Relic |
|---|---|---|---|---|---|---|---|
| 1 | The Sunken Crypt | skeletons, zombies, ghosts | 5 | Ossric, the Ossuary Lord | Old Mattock, the Gravedigger | trap, agility | The Tidewake Bell |
| 2 | Emberdeep Foundry | demons, golems, elementals | 10 | Vorzhaal, the Ember Prince | Warden Seventeen, the Last Sentry | puzzle, Engineering | Heart of the Last Pour |
| 3 | The Hollow Hive | insects, spiders | 16 | Queen Zarra, of the Golden Hive | Mother Skein, the Silk Widow | trap, precision | Amber of the Sleeping Queen |
| 4 | Frostwatch Keep | trolls, ogres, werewolves | 24 | Old Hessa, the Frost Crone | Grumlaw, the Bridge Warden | trap, strength | The Rimebitten Horn |
| 5 | The Drowned Library | vampires, humans, ghosts | 34 | Count Varesh, the Velvet Thirst | Brother Hollis, the Lantern Monk | puzzle, Lore | The Drowned Concordance |
| 6 | Wyrmrest Spire | dragons, lizardfolk | 46 | Azhrenn, the Storm Wing | Tethra Coldscale, the Reed Hunter | puzzle, Arcana | Fang of the Coiled Wyrm |

- The first instance opens when the world reaches its level; each next one when the one before it
  has been cleared once and the world reaches its level (`openness` in `instance-run.mjs`). Opened
  is worked out from the world's progress and level, never stored. Clearing all six gives the world
  the region's title (**Roadwarden**) and leaves the map complete.
- Bosses and elites come from the existing roster, of the instance's races, each in at most one
  instance; all twelve guard an item of their own (`game/legendary.json`), which is what a clear
  rolls for. The vault's pool lists other bosses' equipment (its elite's among them), never an
  instance boss's item and never a relic: a boss's own relic comes only from that boss.
- Each instance has a room-size scene (`scene`, a 200×125 PNG under `ui/instances/`, drawn at the
  room's size): while a room is inside, the UI hides its theme's scenery and draws that scene behind
  its characters and monster, and a travelling room keeps the theme it entered in until it leaves
  (its kills inside do not move it on).
- The site of each instance on the 256×144 roadmap is `map: { x, y }`; the three roadmap pictures
  (0, 3 and 6 cleared) are enough because the UI places live markers over them.

### Rooms

| Room | What happens |
|---|---|
| 1 entrance | one fight: a plain monster of the instance's races (common, armored or ethereal by hash) |
| 2 hall | three fights in a row, one in three a veteran |
| 3 trap or puzzle | no fight: a check (below), at once |
| 4 elite's chamber | the instance's elite, a roster boss, as a champion with an affix |
| 5 vault | no fight: loot now and a choice of one of two boons |
| 6 boss | the instance's boss, rank `boss`, with `INSTANCE_BOSS_HP` (×1.5) the health of a wave's boss |

- Monsters are made like a wave's (`instance-monsters.mjs`): health `HITS_TO_KILL ×
  referencePartyHit(level) × party share × kind.hp × rank.hp`, the kind's attack and resistances,
  rewards `kind.reward × rank.reward`, the instance's loot table, at the run's level `world level
  + INSTANCE_FIRST_LEVELS (3) + INSTANCE_TIER_LEVELS (2) × (tier − 1)`. They fight in
  `combat.mjs`'s `fightTick` with the party `fight.mjs` builds, so the active relic, legendary gear,
  the bestiary and the settlement act inside as on waves.
- A kill pays the waves' materials and item drop, counts for the room's kills and the world's
  bestiary (the elite as a champion of its race, the boss as a beaten roster boss), and the
  campfire gives stamina back after it, as on waves.
- **Failing is soft.** A party out of stamina rests as on waves; each room allows a try of
  `INSTANCE_TRY_SLACK` (4) times the ticks a reference party needs for its monsters' health, rests
  included. A party that runs out of that time (it rests too often, or hits too softly for the
  tier) has failed a try: it rests and starts the room over. After `INSTANCE_TRIES` (3) failed
  tries on one room the run ends. Why a time and not "out of stamina": a lone character has no
  defender or healer and runs out of stamina in every fight on waves too (`STAMINA_TICKS` <
  `HITS_TO_KILL`), so that rule would shut it out; a time limit lets it clear tier 1 with its rests
  and makes the tiers above a real wall.
- A run that ends without a clear, or a party recalled by hand, keeps what it found; the room goes
  back to its frozen wave and waits `INSTANCE_COOLDOWN_MS` (two hours) of working time on its waves
  before it may enter that instance again.
- A run moves only with working time: a waiting or blocked party pauses it, idle characters gather
  as usual, characters keep levelling from their tokens, and a run whose characters all retired
  waits for the next one (it never fails for that). A room moved to another world or out of the
  game leaves its instance with no cooldown.

### Checks

The third room checks the party against an attribute (its best living character's, divided by the
mean of the four reference characters' at the world level) or a work skill (the world's effective
level of it divided by the world level), so 1 is the reference. It passes when the score is at least
`INSTANCE_CHECK_DIFFICULTY` (0.8) × (1 + 0.1 × (tier − 1)) × the modifier's factor × a roll between
0.6 and 1.4 (by hash of the run, the room and the try): 4 times in 5 for a score of 1 at tier 1.

| Result | Trap | Puzzle |
|---|---|---|
| passed | materials worth two plain kills, then on | the same |
| failed | the party loses 35% of its stamina pool and moves on | a failed try; it tries again after one minute of working time |

### Boons

The vault offers two different boons of the pool (by hash of the run). The person picks one on the
run's card; with **Auto** on, or after `INSTANCE_VAULT_WAIT_TICKS` (five minutes) of working time,
the first is taken, so the game never stalls. A boon lasts the rest of the run: the boss's room and
the rewards. Boons have a closed set of types of their own (`BOON_TYPES` in `instance-boons.mjs`),
never a capped legendary effect type, so they cannot push those sums past their caps.

| Boon | Effect | Type |
|---|---|---|
| Whetted Blades | +15% damage against the boss | `bossDamage` 0.15 |
| Second Wind | stamina back to full now | `staminaNow` 1 |
| Gambler's Coin | a second roll at the boss's own item | `rewardRoll` 1 |
| Seeker's Candle | the boss is twice as likely to leave its own item | `bossItem` 1 |
| Hoarder's Map | the boss's purse holds 50% more | `purse` 0.5 |
| Spare Torch | one more try in every room left | `tries` 1 |
| Sand Glass | 30% more time in every room left | `timeLimit` 0.3 |
| Warding Salt | the boss strikes 20% softer | `bossAttack` 0.2 |
| Smelling Salts | rests take 50% less time | `restShort` 0.5 |
| Binding Chalk | the boss comes without an affix | `noBossAffix` 1 |

### Tiers

A world may enter an instance at any tier up to one above the best it has cleared there; there is no
last tier. Each tier above the first puts the monsters two levels higher (health, drain and rewards
grow with the level), makes the check 10% harder, adds 5% to the purse and 1% to the boss's item
chance, and brings the instance's modifier for that tier: its rotation (`modifiers` in the
instance's entry) in turn, tier 2 the first, round and round.

| Modifier | Effect | Rotations it is in |
|---|---|---|
| Enraged rooms | every monster is enraged | crypt (2nd), keep (1st) |
| No rest between rooms | the campfire gives no stamina back after a kill | crypt (3rd), library (3rd) |
| Armored boss | the boss is armored | foundry (1st), keep (2nd) |
| Ethereal boss | the boss is ethereal | library (1st) |
| Regenerating boss | the boss regenerates | crypt (1st), spire (2nd) |
| Swift hall | the hall's monsters are swift | hive (1st), spire (1st) |
| Thorny elite | the elite is thorny | hive (2nd), spire (4th) |
| Long rests | rests take twice as long | foundry (2nd), keep (3rd) |
| Cunning traps | the trap or puzzle is 30% harder | hive (3rd), library (2nd) |
| Crowded hall | the hall holds five fights | foundry (3rd), spire (3rd) |

An affix modifier replaces the monster's own affix (a monster carries one); Binding Chalk takes the
boss's away.

### Rewards

| When | What | Numbers |
|---|---|---|
| every kill | the waves' materials and item drop | as on waves, at the run's level |
| a check passed | materials | two plain kills of the run's level |
| the vault | materials, and rarely a piece of its pool the room lacks | three plain kills; `INSTANCE_VAULT_ITEM_CHANCE` 0.3% + 0.05% a tier, at most 1% |
| every clear | the purse: materials of the instance's loot table and coins | `INSTANCE_PURSE_KILLS` 16 plain kills and `INSTANCE_PURSE_COINS` 40 × `REWARD_GROWTH ** level` coins, × (1 + 5% a tier) × (1 + the Hoarder's Map) |
| every clear | each of the instance's races counted as `tier` champion kills | 10 bestiary points each |
| every clear | the boss's own item, when the room lacks it | `INSTANCE_BOSS_ITEM_CHANCE` 0.4% + 0.08% a tier, at most 1.2%, without the waves' pity (neither read nor raised); the Seeker's Candle doubles it, the Gambler's Coin rolls again |
| the world's first clear | the instance's relic, to the clearing room (active when it is its first) | a room that owns it already gets `INSTANCE_RELIC_COINS` 3000 × `REWARD_GROWTH ** level` coins, a city relic's price |

A clear's boss does not roll for a city's relic as a wave's boss does: a run meets its boss about once
a working day, and with the waves' pity that roll handed a light user every city relic within weeks.
No roll ever gives a second copy (`rollBossItem` and the vault pick only what the room lacks).
Materials and coins go to the world as they are found, so a run that fails keeps them.

### Regions

The road goes on past the first region (`src/game/instance-regions.mjs`). `region` in
`game/instances.json` is the first one, the Old Road, and holds the instances without a `region` key;
each entry of `regions` comes `after` a region before it and holds the instances that name it, listed
together after the region before. A region has its own name, title, map size and pictures, and may
raise its rooms' plain monsters by `rankStep` ranks (normal to veteran, veteran to elite; the elite's
chamber and the boss keep theirs). A third region is only data and art: a `regions` entry, its
instances, its bosses in `game/bosses.json`, its relics and items in `game/legendary.json` and its
pictures.

- **Unlock.** A later region opens when every instance of the region it comes after has been cleared
  once; until then its instances are under fog and refuse a room (`its region is not open yet`).
  Inside, its instances open one after another as on the first road, each at its World Lv.
- **The Roadmap** is a tab of its own (`roadmap`, with a dungeon-gate icon), beside World, which keeps
  the bestiary; an old link to `?tab=world&view=roadmap` opens it. It has a switch between regions
  above the map. It opens on the furthest open region;
  a locked one shows its map dimmed with what opens it ("It opens when The Old Road is complete: 4 of 6
  cleared there"). Clearing a whole region gives its title.

The second region, **The Gloaming Isles** (title **Islewarden**, `rankStep` 1), a night sea chart:

| | Instance | Races | Opens at World Lv | Boss | Elite | Third room | Relic |
|---|---|---|---|---|---|---|---|
| 7 | Saltreach Lighthouse | skeletons, ghosts, lizardfolk | 60 | Keeper Ondrel, the Drowned Lamp | Grisk Saltjaw, the Wrecker | trap, resilience | Lens of the Last Keeper |
| 8 | The Coral Labyrinth | minotaurs, slimes, elementals | 72 | Hathra, the Coral Horn | Murkle, the Tidepool Glutton | puzzle, Lore | The Coral Compass |
| 9 | The Smugglers' Warren | goblins, humans, orcs | 86 | Corvina Vale, the Tide Broker | Snatchgut, the Bilge King | trap, luck | The Smugglers' Doubloon |
| 10 | Gloomroot Grove | treants, spiders, insects | 100 | Old Brackenmere, the Drowned Oak | Lacewire, the Reed Weaver | trap, medicine | Seed of the Drowned Oak |
| 11 | The Brass Leviathan | golems, elementals | 116 | Hullgrind, the Boiler Heart | Sparkwhirl, the Steam Wraith | puzzle, Engineering | The Boiler-Heart Governor |
| 12 | Moonwake Abbey | werewolves, vampires, ghosts | 134 | Abbess Morwen, the Silver Fang | Cantor Lisle, the Night Choir | puzzle, Arcana | The Silver Moon Rosary |
| 13 | The Storm Anvil | ogres, orcs, trolls | 154 | Thundergut, the Storm Smith | Varka Ironjaw, the Spark Bearer | trap, strength | The Thunderhead Ingot |
| 14 | The Abyssal Gate | dragons, demons, lizardfolk | 176 | Nhalazor, the Deep Tide | Vashtiel, the Gate Warden | puzzle, Command | Tidecrown of the Deep |

Its sixteen bosses and elites are new named bosses with fixed looks. Each instance has its relic
(first clear), and each boss guards an item of its own that drops only from it, in its instance, at the
usual instance odds (10% + 1% a tier, plus pity and rematches):

| Item | Kind | Boss | Effect |
|---|---|---|---|
| Lens of the Last Keeper | instance relic | (Saltreach Lighthouse) | `runeCircle` +8% |
| The Coral Compass | instance relic | (The Coral Labyrinth) | `restTime` 8 s |
| The Smugglers' Doubloon | instance relic | (The Smugglers' Warren) | `killMaterials` +5% |
| Seed of the Drowned Oak | instance relic | (Gloomroot Grove) | `gatherXp` +5% |
| The Boiler-Heart Governor | instance relic | (The Brass Leviathan) | `skillXp` +5% Engineering, every character |
| The Silver Moon Rosary | instance relic | (Moonwake Abbey) | `raceDamage` +5% against werewolves, vampires and ghosts |
| The Thunderhead Ingot | instance relic | (The Storm Anvil) | `critDamage` +20% |
| Tidecrown of the Deep | instance relic | (The Abyssal Gate) | `damage` +6% against bosses and legendary bosses |
| Ondrel's Storm Lantern | boss relic | Keeper Ondrel | `gatherHours` +15 min |
| The Coralhorn | boss relic | Hathra | `affixWeakening` 15% |
| The Tide Broker's Ledger | boss relic | Corvina Vale | `upgradeCost` 4% |
| Brackenmere's Bough-Axe | tool, woodcutting | Old Brackenmere | `gatherYield` +12% logs |
| The Boiler-Rune Chisel | tool, runecraft | Hullgrind | `gatherYield` +12% runes |
| Morwen's Moon-Bell | boss relic | Abbess Morwen | `staminaPerKill` 3% |
| The Stormsmith's Hammer | weapon, physical | Thundergut | `skillXp` +10% Forge, the holder's |
| The Abyssal Pearl | boss relic | Nhalazor | `itemDrop` +12% |

Every relic stays at or under the strongest relic of its type that was already there, so the caps
tests hold as they were; the three pieces of equipment follow the first tools (12% of one material)
and the Moonwane Scepter (10% of one work skill's experience), in work skills and materials nothing
else held.

### Rematches

Once a world has beaten an instance's boss, it may go back for **Rematch I** to **X**
(`src/game/instance-rematch.mjs`), entered beside the normal run with `rematch` on the entry. A
rematch is a run of the same instance with the same rooms, rules, boons and cooldown; only its numbers
change.

| | Rule | Numbers |
|---|---|---|
| Tier | rematch n plays at a fixed tier: its levels, check and tier modifier as that tier's | `REMATCH_FIRST_TIER` 3 + `REMATCH_TIER_STEP` 2 × (n − 1): I at tier 3, X at tier 21 |
| Boss | the boss has more health (its room's time does not grow with it) | × (1 + `REMATCH_BOSS_HP_STEP` 0.1 × n): X's boss twice as much |
| Opens | the boss beaten once, rematch n − 1 cleared, and the world's level | World Lv ≥ the instance's level × (1 + `REMATCH_LEVEL_SHARE` 0.3 × n): the crypt's X at 20, the spire's at 184 |
| Every clear | the purse of its tier, and the boss's own item at better odds | the tier's chance (0.4% + 0.08% a tier, at most 1.2%) × (1 + `REMATCH_ITEM_STEP` 0.15 × n), at most `REMATCH_ITEM_MAX` 3%: Rematch I rolls about 0.6%, X 3%; no pity, as for any run |
| First clear of rematch n | a tier-clear reward, once per world | materials worth `REMATCH_FIRST_KILLS` 12 × n plain kills, `REMATCH_FIRST_COINS` 300 × n × `REWARD_GROWTH ** level` coins and `REMATCH_CHAMPIONS` 2 × n champions of each of its races for the bestiary |

- **Gated by real progress.** Only tokens raise the world's level, so the ladder opens as the world
  grows; repeating a rematch opens nothing and pays only the purse after its first clear. A loss costs
  time only: the run ends as any failed run, keeps what it found, and the room waits the usual
  cooldown.
- **Within the caps.** A rematch pays materials, coins, bestiary points and the boss's own item at
  better odds: kinds the game already has, under the same caps. It never gives a second copy.
- A rematch's clear counts as a clear (`clears`) and records the best rematch (`rematch`), not a best
  tier. The Roadmap shows the best one as a roman tier badge on the instance's card and beside its
  marker, and the next one as **Rematch IV** beside **Enter**, with the level it opens at and why a
  room cannot go.

Achievements follow both (metrics `bestRematch`, `regionsOpened`, `regionsComplete` in
`achievement-metrics.mjs`): Old Grudges (a first rematch won), Grudge Match (Rematch V, title "the
Unforgiving"), Undisputed (Rematch X, title "the Undisputed"), Beyond the Old Road (the second region
opened) and Islewarden (every instance of the Gloaming Isles cleared, title "Islewarden"). The day
journal keeps a rematch won (`rematch`, with its number) and a region opened (`region`) as highlights.

### The relics

Six relics of a new legendary kind, `instance-relic` (`instance` names its instance): never sold and
never dropped. Two existing effect types gained the `party` scope for them (`raceDamage` and
`skillXp`), with words for it; no new type was needed.

| Relic | Instance | Effect | Why |
|---|---|---|---|
| The Tidewake Bell | Sunken Crypt | `raceDamage` +5% against skeletons, zombies and ghosts | It rings for the dead who stayed: the undead answer it and falter. No relic gave race damage; it helps most in the crypt and the library and in Gothic rooms, where those races come up three times as often. With a whole bestiary (+5% against a race) it reaches the 10% cap exactly. |
| Heart of the Last Pour | Emberdeep Foundry | `damage` +5% magical | Forge heat in every spell: the fire the owner asked for. The Jawbone Lyre gives physical damage; nothing gave magical. Magical damage is one class of four, so it stays modest. |
| Amber of the Sleeping Queen | Hollow Hive | `gatherHours` +30 min | The queen sleeps and the hive works: idle characters keep gathering half an hour longer. The Millwind Vane gives 15 minutes; with the bestiary and the settlement's Outpost it reaches 1 h 9 min of the 2 h cap. |
| The Rimebitten Horn | Frostwatch Keep | `damage` +6% against champions and legendary bosses | Blown to warn the pass of what is coming: the strongest monsters. The Stagcall Horn covers elites and champions, the Crown of the Ossuary bosses; this one meets every elite's chamber and every legendary boss. It does not raise the strongest damage relic (the Crown's 6%). |
| The Drowned Concordance | Drowned Library | `skillXp` +5% Lore, for every character of the room | Read it anyway: reading trains Lore. It is the only relic that moves a work skill, so a room with it nudges its world's level (Lore is one fifth of it): about +1% world experience from that room. |
| Fang of the Coiled Wyrm | Wyrmrest Spire | `attackSpeed` +4% | It hums when storms gather: strikes come like lightning. The last instance's relic is the broadest: every hit, every fight. With the Pale Duelist's Coat it reaches the 8% cap exactly. |

The caps tests (`bestiary-effects.test.mjs`, `settlement-effects.test.mjs`) include them: the
strongest relic of each type, all the legendary equipment, a whole bestiary and a whole settlement
stay within every cap, now checked per work skill for `skillXp` as for races and ranks.

### In the save

A world keeps `instances: { [instanceId]: { runs, clears, bestTier, rematch? } }` once a room entered
one (`rematch`, the best rematch cleared, only once one is); a room inside keeps `run: { instance,
tier, rematch?, attempt, room, fight, tries, tryTicks, waitTicks, ticks,
boon, offered, found: { materials, coins, legendary, kills }, frozen: { wave, waveKills, monster,
fightTicks, fightRested } }` (about 700 bytes with its frozen monster), and a room after a failed
run `instanceCooldowns: { [instanceId]: ms }`. None of them exists in a save from before, which loads
unchanged. `migrate` drops a run it cannot play (the room back on the monster it left) and
cooldowns without time left; `cleanSave` refuses an instance or boon the content does not have, a
room index, tier or count out of range, found loot that is not content, progress with more clears
than runs or a best tier without a clear, a best rematch out of I to X or above the clears, a
rematch run whose tier is not its rematch's, a cooldown longer than a whole one, two rooms inside one
instance, and any of it when the content has no instances. A world reset forgets it all; a chest
left behind moves as before, and a room left behind inside an instance frees it when its chest
moves (or can be recalled).

### Actions and view

Entering, choosing a boon and recalling are actions (see "Actions"). The view state gains the
instances' content once (`game.instances`), each world's roadmap (`worlds[].instances`) and each
room's `run` and `instanceCooldowns` (see "View state"). A run's steps are `instance` events of
`recent`; the items a run gives are `legendary` events as well, so the rooms celebrate them like a
boss's drop.

## Settlement

Each world's group upgrades are the buildings of its settlement (`src/game/settlement*.mjs`,
`buildings.mjs`), with its names, tiers, stages and art in `game/settlement.json` (checked by
`src/game/settlement-content.mjs`: every group upgrade is exactly one building, stages and tiers
rise, art is a PNG under `ui/settlement/`, which `npm run check` also finds, and every stage
bonus is a world effect whose sum fits each cap; the worker refuses a file with problems).
Nothing of it is stored: tiers, the stage and renovation stars are worked out from the building
levels the world already keeps.

### Buildings

| Building | Group upgrade | Recipe | Opens at | What a level L does |
|---|---|---|---|---|
| Hearth | `campfire` | fish, crops | Camp | the party gets back `0.6 × L / (L + 5)` of its missing stamina after each kill |
| Workshop | `workbench` | ore, gears | Camp | item upgrades cost `1 / (1 + 0.05 × L)` |
| Sanctum | `runeCircle` | runes, crystals | Camp | every new monster has `0.2 × L / (L + 10)` less health |
| Storehouse | `storehouse` | logs, seals | Outpost | `marketFee` `0.04 × L / (L + 10)`: the fee falls towards 6% |
| Defences | `defences` | bars, hides | Hamlet | `staminaDrain` `0.03 × L / (L + 10)`: monsters drain less |

The first three are the group upgrades every world always had, with the same effects, prices and
save fields; the last two exist only with a settlement in the content (`settlementOnly` in
`GROUP_UPGRADES`). Every building is priced like the others (see "Spending") and levels without
end: the price keeps doubling a level and every effect only nears its ceiling. The Storehouse's
and the Defences' effects are effects of the world (`buildingEffects` in
`settlement-effects.mjs`), summed with the relic, the equipment and the bestiary under
`LEGENDARY_EFFECT_CAPS`: `marketFee` is capped at 0.04, and the `staminaDrain` cap went from 0.1
to 0.13 so that, with the strongest relic, all the legendary equipment, a whole bestiary and the
Defences at their top, no type passes its cap (`settlement-effects.test.mjs` checks it).

### Tiers

| Building | Tier I (level 1) | Tier II (level 5) | Tier III (level 15) |
|---|---|---|---|
| Hearth | Hearth | Cooking hearth | Hearth hall |
| Workshop | Workbench | Smithy | Great forge |
| Sanctum | Rune circle | Rune shrine | Sanctum |
| Storehouse | Supply shed | Storehouse | Trading house |
| Defences | Palisade | Watchtower | Gatehouse |

Each tier has its sprite (`ui/settlement/building-<art>-<tier>.png`). A building at level 0 is not
built and is drawn as its first tier, faded.

### Stages

The stage follows the total of all building levels:

| Stage | From (levels in all) | Bonus to every party of the world, kept from then on |
|---|---|---|
| 1 Camp | 0 | none |
| 2 Outpost | 1 | `gatherHours` +0.25: idle characters gather 15 minutes longer |
| 3 Hamlet | 5 | `staminaPool` +1% |
| 4 Village | 30 | `runeCircle` +2%: the Sanctum's cut is 2% larger |
| 5 Town | 60 | `thorns` 1% |
| 6 Stronghold | 200 | `staminaPool` +1% (2% in all) |
| 7 Citadel | 500 | `restTime` 5 s shorter rests |

At the Citadel all of it is: rests 5 s shorter, gathering a quarter hour longer, a 2% larger
stamina pool, 1% thorns and a 2% stronger Sanctum, each well under its cap with every other source
at its top. Past the Citadel, every `renovation.every` (50) building levels earn a renovation star:
a count and a banner on the picture, nothing more, so the settlement never simply ends.

### Paying in coins

From the tier `coinsFromTier` names (II), a level can also be paid half in coins: of each material
`floor(amount × SETTLEMENT_COIN_SHARE)` (0.5) is paid instead at its base value
(`MATERIAL_BASE_VALUES`) in coins (`coinPrice` in `spending.mjs`). Buying those materials at a
market always costs more than their base value, so this is the cheaper way to turn coins into a
building. It is optional: the price in materials alone stays, so a world that never trades is
never stuck, and `autoSpend` never spends coins. Coins go nowhere back from a building, so this
opens no loop that makes money.

### In the save, on import, and as news

- The two new buildings live in `World.upgrades` with the others. A save from before them reads
  with both at 0 (`migrate` keeps the levels as they are); export and import carry them with the
  world, and a world reset clears them.
- `cleanSave` refuses a level of a building the settlement has not opened at the stage the
  world's levels reach (a Defences level with fewer than 5 levels in all), or one that needs a
  settlement the content lacks, as well as unknown ids and levels that are not whole.
- The bridge compares the settlement before and after every change it keeps (a round, autoSpend,
  a purchase by hand): a building's new tier (the highest, when one change lifts it several), a
  new stage and new renovation stars become `settlement` events in `recent` (see "View state"),
  which every room of the world celebrates, a stage most. An imported game is no news.

### Pace

Tuned with the simulator (see "Balance"): with the thresholds above, a light user reaches the
Outpost on day 15 (the target is the first three weeks: the Outpost needs one building level, and
a light user can pay for no purchase at all before about its third week; making first levels
cheaper would change the old upgrades' prices, which the settlement keeps exactly) and the Hamlet on day 30, a medium one the Village on day 53 and the Town on day
186, and a heavy one the Stronghold on day 169 and the Citadel a little after its first year
(491 levels at day 365).

## Achievements

Long-term goals over every part of the game (`game/achievements.json`, checked by
`src/game/achievement-content.mjs`; granted by `achievements.mjs`, measured by
`achievement-metrics.mjs`, bound to the content in `chronicle.mjs`). 161 achievements in fifteen
groups (Battle, Bosses, Bestiary, Growth, Legacy, Treasure, Market, Settlement, Instances, Journal,
Collector, Traits, Weekly events, Daily quests, City ranks), most of them ladders (defeat 1, 100, 1,000, 10,000, 100,000 and 1,000,000 monsters).
Each has a name, a description, points (1 to 100) and a condition; some are `hidden` until earned,
and 37 grant a `title`.

### Conditions

A condition is data: `{ "metric": "kills", "atLeast": 1000 }`, with the metric's one parameter when
it takes one (`{ "metric": "raceKills", "race": "troll", "atLeast": 500 }`), or
`{ "all": [conditions] }`, met when every part is. A metric is one number read from the save over
every world: a sum (`kills`, `bossWins`, `rankKills` by rank, `raceKills` by race, `retirements`,
`instanceClears`), a count of distinct things (`distinctBosses`, `racesDiscovered`, `relics`,
`legendaryItems`, `instancesCleared`), or the best of the worlds (`wave`, `worldLevel`,
`skillLevel` by skill, `bestWorkSkill`, `prestigeStars`, `characterLevel`, `hunterRank`,
`bestMastery`, `itemTier`, `itemLevel`, `coins`, `citiesOpen`, `buildingLevels`, `stage`,
`buildingTier` by building, `renovationStars`, `instanceTier`, and for traits `traitsCollected`,
`mythicTraits` and `traitsCarried`, the most traits one living character carries), and `traitSwaps`
counts the swaps at the trait brokers (see "Traits"), and `weeklyGoals` the weeks whose goal a world
reached (see "Weekly events"); `questsDone`, `questDays` and `questStreak` the daily quests done, the
days all three were done and the best streak (see "Daily quests"). `coinsEarned`, `materialsEarned`,
`notableLoot` and `activeDays` read the journal's lifetime totals (see "The day's journal"), and
`achievements` and `achievementPoints` the achievements themselves. The content check refuses a
metric that does not exist and a parameter the content does not have, so an achievement for a new
feature is a metric in `achievement-metrics.mjs` and a line of data.

### Granting

After every change the bridge keeps (a round, an action, an import), `chronicle` grants every
achievement whose condition the save now meets, with the time. One earned is kept for good, through
a world reset too. An achievement for earning achievements is checked again in the same change.
Each one earned becomes an `achievement` event of `recent`, which every room that plays celebrates
in gold.

### Back-fill

A save from before achievements has none. The first time it is checked (its first round, or an
import), everything it already meets is granted quietly and counted as `filled`; the bridge then
adds one `achievement` event of kind `backfill` with the count, which plays as one line in the first
room, not one per achievement. A brand-new save is back-filled with nothing, so its first
achievements are news.

### Titles

An achievement with a `title` lets a room's party wear it: one title per room, chosen in the World
tab's Achievements view. It shows beside each character's name in the Party tab and on the agent
card. It is cosmetic only. A title must be earned; a room that leaves the save takes its title
along.

### In the save

`achievements: { earned: { [id]: ms }, titles: { [projectId]: id }, filled }`, present once the save
was first checked. `migrate` keeps the entries that are well formed; `cleanSave` refuses an
achievement the content does not have, a time that is not one, a title for a room that does not
play or that was not earned, and a `filled` larger than what was earned.

## The day's journal

A rolling log for the "While you worked" summary (`src/game/journal.mjs`, counted by
`journal-gains.mjs`). Each change the bridge keeps adds what it gained to the local calendar day
(the bridge passes `localDayOf(now)`, so a day rolls over at the person's midnight):

| Counter | From |
|---|---|
| `kills`, `bosses` | kill events; a boss is a kill of rank `boss` or `legendary` |
| `levels` | character `level` events |
| `skillLevels` | the effective levels the world's skills gained |
| `loot` | legendary finds, and a drop of a higher tier than its room held |
| `coins` | the coins the worlds gained |
| `materials` | the materials a round gained before anything was spent |
| `achievements` | achievements earned |
| `buildings` | building levels the settlements gained |
| `cleared`, `failed` | instance results |

A short list of highlights names what was notable: legendary finds, new best gear, a boss's first
win, achievements, a building's new tier, a new stage, an instance cleared, a trait scroll a kill
dropped (`scroll`) and a week's goal reached (`weekly`, the event), each as a content id.
An imported game is no news and adds nothing.

`journal: { days: [[day, ...counts]], totals, since, seenAt, activeDays, highlights }`: at most
14 days (oldest first, a day going backwards is added to the newest), the same counters over all
time and since the summary was last opened (`seenAt`), the number of days with something counted,
and at most 24 highlights `{ at, kind, ref, value? }`. Nothing in it names a session or a room.
`cleanSave` refuses more days or highlights than that, days out of order, a row of the wrong length,
a count that is not whole and a highlight of a kind it does not know. Opening the summary on this
computer marks it read (`markSummarySeen`), which clears `since`.

The summary is a card behind the scroll button beside the settings cog, which carries a gold dot
while a highlight is newer than `seenAt`. It shows Today, Since you last looked (as it was when the
card opened), a strip of the last 14 days (monsters defeated, today in gold) and the days played.
A page on another machine shows it but never marks it read.

## Traits

A trait is a small named perk a character carries (`src/game/trait*.mjs`), from the catalogue in
`game/traits.json` (checked by `src/game/trait-content.mjs`; `npm run check` and the worker refuse
a file with problems): 48 traits in four tiers (common, rare, epic, mythic), each with a name, a
flavour line, a family (for its icon) and one effect, and for four double-edged ones a small
drawback. Every number lives in `src/game/trait-constants.mjs`.

### Slots

- A character is born with one trait: a tier by `BORN_TIER_WEIGHTS` (common 88, rare 11, epic 1,
  never mythic), then a trait of it, both by hash of the session id (`bornTrait`). The same session
  always has the same one.
- It earns a slot at each of `TRAIT_SLOT_LEVELS` (levels 10, 20 and 30), four in all. Retired
  characters reach level 26 to 45 in the simulator, so most end with three.
- `character.traits` is kept only once a person changed what it carries. Without it the character
  carries its born trait, and its slots follow its level, so a save from before traits needs no
  migration and every character in it has its trait at once.

### Effects

A trait's effect uses the effect types of legendary loot (see "Effects" under "Legendary loot")
and acts on the character carrying it as its legendary equipment does (`withTraitEffects` joins
them wherever the held effects are read: the fight, gathering and tokens). The types a trait may
have are `damage`, `attackSpeed`, `critChance`, `staminaDrain`, `outfitStamina`, `healing`,
`supportAura`, `gatherYield`, `skillXp`, and two the holder now reads as well, `characterXp` and
`raceDamage`; and three of its own: `raceDrop` (items drop more often against some races, for the
party while the character fights), `scrollFind` (trait scrolls drop more often, the same way) and
`brokerDiscount` (the world's trait brokers charge less, while the character lives).

Stacking: one character's traits are summed by type and the positive sum is brought down to
`TRAIT_EFFECT_CAPS` (about a third to a half of each `LEGENDARY_EFFECT_CAPS`; `damage` 5%,
`critChance` 2%), every bonus of that type shrunk by the same share. Then they join the relic,
the equipment, the bestiary and the settlement under `LEGENDARY_EFFECT_CAPS` as before. A
drawback (`staminaDrain`, `gatherYield`, `attackSpeed` ... below 0, at most half a cap) is not
capped and simply takes its share away. A guest carries no trait.

### Scrolls

- A room keeps scrolls in its chest (`project.scrolls`, by trait), at most `SCROLL_COPIES` (5) of
  one trait. A scroll teaches its trait into a free slot (`teachTrait`) and is used up; a trait
  carried already is refused.
- Elites, champions and bosses drop one now and then (`rollScrollDrop`, from the kill's seed):
  chance `SCROLL_DROP_CHANCE` by rank (elite 0.4%, champion 1%, boss 5%, legendary 15%) times
  (1 + `scrollFind`), a tier by `SCROLL_TIER_WEIGHTS` (bosses are the source of mythic ones), and a
  trait of that tier the room does not keep five of. A kill event carries `scroll` when one dropped.
- A scroll goes to another room of the same world (`sendScroll`), as an item does.
- A retiring character gives the traits a person taught it back to the chest as scrolls, as its
  items go back; its born trait stays its own, and a session that comes back is born with it again.
  A room left behind that is moved brings its scrolls and its characters' taught traits along. A
  scroll that finds no room is sold at the broker's price.

### The trait broker

Every open city has one (`src/game/trait-broker.mjs`):

- **Buy**: `BROKER_OFFERS` (3) scrolls a game day of the city's own traits (each trait names its
  `city`; mythic ones none, and are never sold), a tier by `BROKER_TIER_WEIGHTS`, by hash of world,
  city and day. A scroll costs `BROKER_PRICES[tier] × REWARD_GROWTH ** worldLevel × (1 −
  brokerDiscount)` coins and goes into a room's chest; each offer sells once a day. A city of a higher rank
  offers a fourth scroll and, at rank V, more epic ones (see "City ranks").
- **Sell**: any open city buys a scroll back for `BROKER_SELL_SHARE` (a quarter) of its price. The
  tier prices (150, 700, 3,000 and 14,000) are set so a scroll always sells for more than a scroll of
  the tier below costs, so the two never read as the same number on the broker's card (a test checks it).
- **Swap**: a character swaps a trait it carries for a scroll of its room's chest in the same slot
  (`swapTrait`); the old trait goes back to the chest as a scroll, for a fee of `SWAP_FEE_SHARE`
  (a quarter) of its price. The design left open whether a swapped trait is lost; it comes back.

### In the save

- `Character.traits` (optional): distinct traits of the catalogue, no more than the level's slots.
- `Project.scrolls` (optional): whole counts from 1 to 5, by trait of the catalogue.
- `World.traits` (optional): `{ known, sold?, swaps? }`, the traits the world ever had (its
  collection; written after every advance and trait action, and worked out for a save from before
  traits from its characters, kept retirees and scrolls), the brokers' sales of the day by city, and
  the swaps the world ever made.
- `migrate` keeps a world's record and repairs a broken one; `cleanSave` refuses a trait or a city
  the content does not have, a trait twice, more traits than slots, a count out of range, an offer
  the broker never has, and any trait field when the content has no traits. A save from before
  traits loads unchanged.

### View and actions

The engine's view gives `traits` (the catalogue: tiers with their colours, every trait, the slot
levels), each world's `traits` (`known`, `discount`, `brokers` by open city with the day's offers,
`salePrices` and `swapFees` by tier), each project's `scrolls` and each party member's `traits`
(`carried`, `slots`, `nextSlotAt`, `born`). The view state passes them to rooms and characters. One
action, `traitAction({ action, ... })` (`/api/game/trait`, local only like every game route, and
the panel request `game.trait`), teaches, swaps, buys, sells or sends (`src/game-trait-actions.mjs`).

A kill that drops a scroll carries `scroll` on its `kill` event; its room shows "Trait scroll: Name!"
and the journal keeps it as a highlight. Seven achievements of the Traits group follow the
collection (5, 15, 30 and 45 traits), a first mythic trait, a character with four traits and a
first swap.

### Pace

Tuned with the simulator (`npm run simulate`, its "Traits" table; `scripts/trait-balance.mjs`). The
world's collection, of 48, at day 30 / 90 / 180 / 365:

| User | Day 30 | 90 | 180 | 365 | With a daily broker visit, 365 | Sessions | Scroll drops a year |
|---|---|---|---|---|---|---|---|
| light | 3 | 8 | 15 | 21 | 25 | 35 | 2 |
| medium | 23 | 32 | 37 | 39 | 39 | 413 | 19 |
| heavy | 35 | 39 | 41 | 42 | 42 | 2,420 | 45 |

Commons come with new sessions; the epics and the five mythic traits, which only bosses drop, keep
the whole catalogue a goal past the first year for every user. Traits move no other balance check:
the four that fail fail as before them.

## Weekly events

Each calendar week the whole game has one event (`game/events.json`, checked by
`src/game/weekly-content.mjs`; the rules are `weekly*.mjs`). It is a nudge so the routine varies,
not a multiplier: it needs no network and no server, and is the same on every machine.

- **The week.** An ISO week in UTC, Monday 00:00 to Monday 00:00 (`weekly-calendar.mjs`): 2026 has
  a week 53, and 2027-W01 starts on the 4th of January.
- **Which event.** Weeks are numbered from the one of 1970-01-01, so a year's end changes nothing.
  Each run of as many weeks as there are events (20) plays every event once, in an order of
  `hashOf` the run's number; when a run would open with the event the last one closed on, its first
  two swap. So the same event never comes two weeks in a row, and next week's event is known.
- **When it changes.** Every advance first checks its end time against the week each world keeps
  (`withWeek`): a new week switches the event and starts its goal over, in the round that crosses
  midnight, with no reload.
- **What it does.** Its `effects` are effects of the closed set legendary loot uses, scope `world`
  (`raceDamage`, `damage` against ranks, `legendaryPity`, `itemDrop`, `killMaterials`, `gatherYield`
  of materials, `gatherHours`, `gatherXp`, `characterXp`, `skillXp`, `restTime`, `staminaPool`).
  They join the bestiary's and the settlement's in `worldEffectsOf`, so they act wherever those do
  and are summed under the same `LEGENDARY_EFFECT_CAPS`; no cap was raised. Each effect is at most
  half its cap (the content check refuses more), so a world far from a cap gets the whole nudge and
  one at a cap gets nothing past it.
- **Kinds.** A **race week** (six: werewolves, skeletons, goblins, insects, slimes, dragons) brings
  its race twice as often (`FEATURED_RACE_WEIGHT`, in the race pick of `races.mjs`; bosses and
  instances are unchanged), counts a kill of it once more in the bestiary half the time (by hash of
  the kill: every kill twice took a medium user's bestiary to +12.6% kills per hour at a year, past
  its 10% target), and adds 3% damage against it. A **festival** (Goldmill, Deepforge, Runespire, Brinehaven) gives more of its city's goods from
  gathering (+6%) and kills (+5%); it does not touch market prices. A **bloom** gives 7.5% more of
  one gathered material. The **boss hunt** gives 5% damage against bosses and legendary bosses and
  20% faster legendary pity on the waves; the **bounties** 5% damage against elites and champions
  and 5% more item drops. The **training** weeks give experience (+2.5% characters and +5%
  gathering, or +4% Lore and Arcana), the **gold rush** 5% more materials from kills, and the
  **season** weeks gatherers' half hour or shorter rests and a slightly larger stamina pool.
- **The goal.** Each event has one: defeat 9 of its race, 80 or 100 monsters, a boss, or 10 elites
  or champions, counted per world from the advance's kill events (a kill event now carries the
  monster's `race`). Reached, it pays at once, once a week, materials worth `rewardKills` (30) plain
  kills at the world's level split over the event's two reward materials. Sized with the simulator
  (`npm run simulate` prints the share of weeks whose goal was reached): a light user reaches 51%
  of them (a third of the boss hunts: it meets a boss every few weeks), a medium and a heavy one 98%
  (one boss hunt missed). With the events in play every balance target that passed still passes; kills per hour
  and the other numbers move by a few percent at most.
- **In the save.** A world keeps `weekly: { week, event, progress, done, seenAt, goals? }` from its
  first advance with events: the ISO key, the event's id (a changed catalogue starts the week over),
  the goal's count so far, whether it paid, the last advance's time, so the time left is told on the
  game's own clock, and how many weeks' goals it ever reached (kept from week to week). A save from before has none and loads unchanged. `migrate` drops a malformed
  one (the next advance starts the week again); `cleanSave` refuses an unknown event, a week a year
  does not have, a `seenAt` outside its week, progress past the goal, `done` that disagrees with the
  progress, and any of it when the content has no events.
- **View and UI.** `worlds[].weekly` (see "View state"), with the next `UPCOMING_WEEKS` (5) weeks in
  short: the choice is the calendar's, so they are known now. The header has a calendar button
  beside the summary's scroll and the settings cog (`ui/engine/event-calendar.js`): a pixel calendar
  with the event's kind as a badge and a thin bar for the goal (gold in progress, teal reached), the
  event's name beside it on a wide window, and a label such as "This week: Bone Tide, goal 2 of 9, 4
  days 9 hours left". It opens a card in the panels' place, as the summary does (Escape or Close
  bring the focus back; a page on another machine may open it too): this week's event in full (its
  dates, kind, time left, what it does, the goal with its bar, the reward and its flavour) and the
  coming weeks, each with its event's icon, name, kind and dates, next week's with what it does.
  Each room's header shows the event's icon with the same in its label. Nothing of it takes a row
  above the tabs. The icons are drawn by
  `scripts/event-art/events.py` into `ui/art/events/<kind>.png`.
- **Achievements and journal.** The `weeklyGoals` metric counts goals reached over every world; the
  Weekly events group has three (1, 10 and 52 goals, the last with a title). A goal reached is a
  `weekly` highlight in the day's journal ("Weekly goal reached: The Howling Moon").
- **Demo.** `EVENT=<id>` with `GAME=1` plays that event every week (`pinned` in the events data).

## Daily quests

Each local day every world that plays gets three quests, one easy, one medium and one hard
(`game/quests.json`, checked by `src/game/quest-content.mjs`; the rules are `quests.mjs`, the save
`quest-save.mjs` and the view `quest-view.mjs`). They give a working day something small to aim at.

- **The day.** The journal's local day (`localDayOf` in `src/game-chronicle.mjs`): the bridge passes
  it with every change it keeps, and nothing in the engine reads the clock. The first change of a new
  day rolls the day's quests and drops yesterday's, in the round that crosses midnight, with no reload;
  the card's time left is measured to the first moment of the next local day, so a day of 23 or 25
  hours when the clocks change is right.
- **Which quests.** By hash of the world and the day (`rollQuests`), so a reload shows the same ones,
  from the kinds of the file that can fill each slot and that the world can finish today. Each kind
  says, per slot, the share of a day's pace it asks:

  | Kind | Asks | Offered when |
  |---|---|---|
  | `kills` | defeat N monsters | always |
  | `race` | defeat N of a race | the race is one the world meets at least as often as the average (its bestiary says, once it counts 200 kills), or this week's featured race (half the time in a race week) |
  | `elites` | defeat N elites or champions | always |
  | `boss` | defeat a boss | the world meets five bosses or more on a played day |
  | `collect` | collect N of a material, by kills or gathering | the world holds a plentiful one |
  | `coins` | earn N coins | the world earned coins on every recent played day |
  | `trade` | sell or trade at a market city | a city is open and the world has materials |
  | `instance` | clear an instance on the roadmap | a room can enter an open instance now (cooldowns and a room inside considered), or is inside one |
  | `rematch` | win a boss rematch | the next rematch is open and the world cleared that instance at the rematch's tier before |
  | `weekly` | bring this week's goal N closer | the goal is not reached; N is what a day brings it |
  | `levels` | level up characters N times | the world's characters level up most days |
  | `skills` | gain N skill levels | the world's skills gain a level a day |

  A slot no kind can fill falls back to defeating monsters (or levelling, or elites, whichever the day
  has not used). The pace is the mean of the journal's last seven played days (days with kills). A
  journal with fewer is blended with the world's history in proportion (one day counts a seventh): the
  kills its bestiary counted since its first, over a played day of that time (five a week), or for a
  young world the file's defaults (`kills` 40, growing a twentieth with each level, `levels` 3,
  `skillLevels` 1); materials are those kills at the world's level. So a long-played world whose journal
  began yesterday, or had one short day, gets quests of its real size. Coins and bosses are read from
  the journal alone, three played days at least. Kills ask at least 10, a race and elites 3, a supply
  run 10, and a kind is asked only when a day brings twice its least; the journal counts every world
  together, and most saves have one.
- **Counting.** After every change the bridge keeps, `noteQuests` (from `chronicle`) moves each quest
  by what the change gained: kill events by rank and race (`roomId` in the world), the material up to
  the change's `midway` (before spending, so a trade is not counted as collecting), coins the world
  gained, a market pressure pushed away from rest (a trade: the market only eases back by itself),
  instance runs cleared (a rematch's for `rematch`), the weekly goal's progress, the living characters'
  levels and the world's effective skill levels.
- **Rewards.** Measured against the weekly goal's reward (`rewardKills`, 30 plain kills of the
  world's level, so they grow with it): a quest done pays at once, once, a fifth of it, and the day's
  bonus half of it, times 1 + `streakStep` (0.1) for each day of the streak up to `streakCap` (7). A
  world whose days bring few kills gets less, `quest` (2.5%) and `bonus` (5%) of a day's kills, but
  never under 4.5% and 10% of the weekly reward. At World Lv 19 a busy world's quest pays about 90
  materials and its bonus about 180 (the weekly reward 526); a slow one's 24 and 53. A quest pays in
  its material for a supply run, else in the two materials the world holds least of, and the bonus
  `scrollChance` (10%) a common trait scroll into the world's first room. No claim is needed; the card
  shows them paid.
- **Resizing.** A record keeps the sizing it was rolled with (`sizing`, 2 now): a day rolled before
  this sizing rolls again once, at the next change, unless one of its quests has moved.
- **Streak.** A day with all three done adds one. A played day left unfinished (the journal saw kills
  or levels on it) breaks it; a day nobody worked, or days the game did not run, do not.
- **In the save.** A world keeps `daily: { day, quests: [{ kind, slot, target, progress, done, race?,
  material?, reward }], bonus, bonusReward?, streak, best, totals: [quests, days], sizing? }` from its first
  change of a day; a save from before has none and loads unchanged. `migrate` drops a malformed one;
  `cleanSave` refuses a kind the content does not have, a progress past its target, `done` that
  disagrees with it, a kind twice, a bonus before all three are done, a streak past the best, and any
  of it when the content has no quests.
- **View and UI.** The view state's `game.quests` is `{ worlds: { [worldId]: { quests, bonus: { paid,
  reward }, streak, best } }, msLeft }`, only today's (about 0.4 KiB a world). A "?" button in the
  header, beside the calendar, the summary and the settings (`ui/engine/quest-view.js`), shows how
  many are done (`2/3`, hidden in a narrow header) and a dot when something changed since the card was
  last opened; its label says the count and the time until new quests. Its card, in the panels' place
  like the summary's (Escape and Close bring the focus back; a page on another machine may open it),
  lists each quest with its icon, slot, words ("Defeat 40 goblins"), progress bar and reward, then the
  bonus, the streak and the time left. A quest done is a short line in the rooms of its world, the day
  done a larger one, and both are highlights of the journal (`quest`, `quests`).
- **Achievements.** The Daily quests group: 1, 25, 100 and 500 quests, 1, 10 and 50 whole days, and a
  seven-day streak with the title "the Dependable".
- **Pace.** `npm run simulate` plays the scenarios once more with a player who also does the errands
  quests ask (a sale of a tenth of its most plentiful material, a run into an open instance at tier 1
  or the next rematch; `scripts/quest-balance.mjs`). All three quests are done on 69% of the light
  user's working days, 94% of the medium's and 96% of the heavy's (88%, 98% and 99% of the quests),
  the best streaks 16, 24 and 24 days, and they pay 6%, 5% and 4% of the materials each world earns
  (the check's bound is 6%). The light user's rewards sit on their floors: a fifth of the weekly
  reward a quest would be about a quarter of its daily income. Its coin quests are seldom done (10 of
  38): the simulated player earns coins only from the runs other quests send it on.
- **Demo.** The frozen demo shows the first quest done, the second half way and the third not begun;
  the live one plays them from the made-up day. `QUESTS=done` with `GAME=1` shows all three done with
  the bonus paid and a four-day streak.

## Scenes

A project counts every monster it ever killed in `kills`. It only goes up; a world reset starts
it over with the rest of the world, and a save from before it existed starts at 0.

With "new scene after each monster" on, the bridge gives a travelling room's readings `scenes`:
the theme ids the surfaces can draw. The engine then sets the project's `themeId` to
`sceneThemeOf(projectId, scenes, kills)` (`src/game/scenes.mjs`) whenever it reads the project,
in `advance` and `prepareFights`, and again right after each kill, before the next monster
appears, so that monster comes from the scene the room moves to, even when several kills happen
in one advance. The drop of the monster just killed is rolled before the move, in the scene it
died in. `themeId` given in a reading is ignored while `scenes` is there.

`sceneOrder(projectId, themeIds)` sorts the theme ids and shuffles them by hash of the project's
id; `sceneThemeOf` steps through that order with the kill count. So the scene depends only on the
room, its kills and the themes loaded: it is the same on every surface and after a restart, two
kills in a row never share a scene while there are two themes or more, and every theme comes once
before any comes again. Adding or removing a theme reshuffles the order.

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
- The generic items have an entry of every slot and damage type at every tier from 1 to 10, so
  a drop always has the tier `dropTier` allows (a test checks it). Before tier 2 existed, drops
  stayed at tier 1 until monsters reached level 32.
- A monster entry is picked by hash among the entries of its kind that match the room's theme,
  falling back to the generic ones. The room's theme is the last `themeId` a reading gave. The
  entry gives the monster its loot table, whatever it looks like.
- `game/cities.json` describes the market's cities (see "Market").
- `game/legendary.json` is the legendary loot (see "Legendary loot"); its buffs are data the
  engine interprets, with amounts bounded by `LEGENDARY_EFFECT_CAPS`.
- `game/races.json` describes 20 races of generated monsters, `game/bosses.json` the fixed
  roster of named bosses. Both are looks and names only: health, attack, reward and loot never
  depend on them, and `npm run simulate` gives the same result with or without them. They are
  checked by `src/game/content-races.mjs`; the part ids they name are the UI's, and a test
  (`ui/engine/monster-content.test.js`) checks every one exists.

### Races

A race is `{ id, noun, rig, build, descriptor?, themes?, palettes, parts, always?, roles, marks }`:

- `rig` is the skeleton it is drawn on: `humanoid` (shared by orc, goblin, troll, ogre, human,
  skeleton, zombie, vampire, werewolf, demon, lizard and minotaur) or a rig of its own
  (`dragon`, `spider`, `insect`, `slime`, `elemental`, `golem`, `ghost`, `treant`). `build`
  (`small`, `medium`, `large`) picks the humanoid build; for the others it only says the size.
- `parts` lists, for every slot of the rig, the part ids the race may pick: a humanoid's
  `head`, `torso`, `legs`, `outfit`, `headgear` and `held`; a dragon's `body`, `head`, `wings`
  and `tail`; and so on (`RIG_SLOTS` in `src/game/races.mjs`), plus `extras` (horns, wings,
  tails, markings, glows). `none` draws nothing; listing an id twice makes it likelier. `always`
  lists extras every monster of the race has (a lizard's tail).
- `palettes.skin` (and any other colour role the race wants its own of) lists colours with an
  `id` and, for the role that names it, a `word`. The other roles come from the shared
  `palettes` at the top of the file: `cloth`, `metal`, `leather`, `accent`, `bone`, `hair`,
  `eye`. `descriptor` says which role's word leads the name (`skin` unless said otherwise).
- `roles` are what the monster does, each `{ id, word, noun?, descriptor?, palettes?, <slot>? }`.
  A role narrows the race's lists so the name agrees with the drawing: an archer holds a bow, a
  shaman a staff, a wasp has a stinger, a fire elemental burns.
- `marks` are words a champion's name leads with ("Elder", "Dread").

A generated monster is made from a hash of world, project, wave and kill (`generateMonster`):
the race (a race whose `themes` list the room's theme is `PREFERRED_RACE_WEIGHT` times as
likely), the role, a part for every slot within the role's choices, up to `EXTRAS_MAX` extras
besides `always`, and a colour for every role. One humanoid in `CHIMERA_ONE_IN` is a chimera:
its head or its legs come from another race of the same build, and its name says
`Chimeric`. The name is the champion's mark, the descriptor word, the noun and the role word,
the empty ones left out: "Bog Troll Brute", "Ashen Skeleton Archer", "Elder Ember Elemental",
"Chimeric Orc Raider".

### Bosses

A boss is `{ id, name, epithet, race, parts, colours }`: a fixed look (a part for every slot of
its race's rig, its extras, and all eight colours, boss-only parts allowed) that never varies,
shown as "Morvash, the Bog Tyrant". Each project meets the roster in an order of its own (the
bosses sorted by a hash of world, project and boss id); the boss of a boss wave is the
`wave / BOSS_EVERY`-th of that order, wrapping round. Waves never go down, so a project meets
every boss once before any comes back: with 55 bosses, after 550 waves. The sixteen bosses and
elites of the second region (see "Regions") are in the roster too, so the bestiary counts them, but
the waves never bring them (`waveRosterOf` in `instance-regions.mjs`): they and their items are met
only in their instances.

### Which look a monster gets

1. A themed entry (one with `themes`) picked for the room shows as itself `HANDMADE_SHARE` (30%)
   of the time, with its own name and sprite, so a room keeps its local flavour.
2. Otherwise a boss wave brings the project's next boss of the roster, and any other wave a
   generated monster.
3. Generic entries never show as themselves while races are loaded; they lend their loot.
   Content without races (older tests) shows every entry as itself.

## Market

Coins and five cities, per world. Materials pile up unevenly (one kind runs short while another
is in the thousands); the market turns the surplus into coins, the coins into gear, and one
material into another, always at a loss in what they are worth.

### Cities

`game/cities.json` lists them, checked by `src/game/content-cities.mjs` (`npm run check` and
the worker refuse a file with problems; every city's banner must exist). An entry is
`{ id, name, tagline, opensAt, produces, wants, banner, bannerAlt }`: a city trades with a world
from world level `opensAt`, sells only what it `produces`, pays most for what it `wants` (never
something it produces), and its `banner` is a PNG under `ui/cities/`, where the panel, the tab
and the external view all reach it, with `bannerAlt` describing it.

| City | Tagline | Opens at | Produces | Wants |
|---|---|---|---|---|
| Goldmill | Wheat fields and windmills | 1 | crops, fish | ore, bars |
| Deepforge | The dwarven mine and foundry | 5 | ore, bars, gears | crops, logs |
| Brinehaven | Harbour of fishers and traders | 10 | fish, hides | runes, seals |
| Tallwood | Tree houses, sawmill and hunters | 15 | logs, hides | gears, pages |
| Runespire | City of scribes, crystals and seals | 25 | runes, crystals, pages, seals | ore, fish |

Every material is produced somewhere, so each can be had by trade once its city is open.

### Base values

A material's base value (`MATERIAL_BASE_VALUES`) is what it is worth in coins. It is the
inverse of the material's share of what the three simulated players earn in a year from kills
and gathering (`npm run simulate`, before the market), scaled to a mean of 10 and rounded: the
recipes ask for every material in equal amounts, so what comes in rarely is worth more.

| Material | Share of income | Base value |
|---|---|---|
| bars | 10.1% | 9 |
| pages | 7.9% | 12 |
| gears | 7.5% | 12 |
| crystals | 14.1% | 6 |
| seals | 5.0% | 18 |
| ore | 12.2% | 7 |
| fish | 5.5% | 17 |
| crops | 7.3% | 13 |
| logs | 11.8% | 8 |
| hides | 10.1% | 9 |
| runes | 8.6% | 11 |

### Prices

For a material of base value `b` in a city, with the world at level `L`:

```
usual    = b * MARKET_CITY_FACTORS[stance]       stance: wanted 1, neutral 0.8, produced 0.6
price(p) = usual * e ** -p                        p: the pressure on it in that city
sell(p)  = min(price(p), b) * (1 - MARKET_FEE)    what one more unit sold is paid
buy(p)   = max(price(p), b) * (1 + MARKET_FEE)    what one more unit bought costs
depth    = MARKET_DEPTH_BASE * REWARD_GROWTH ** L
```

- A sale of `q` units moves the pressure from `p` to `p + q / depth` and pays every unit at the
  price it meets on the way: `floor(depth * ∫ sell(y) dy)` over that span. A purchase moves it
  from `p` down to `p - q / depth` and costs `ceil(depth * ∫ buy(y) dy)`. Selling in two steps
  pays what selling at once does, within a coin of rounding.
- The pressure stays between `MARKET_PRESSURE_MIN` (-2: a city sells nothing that would push
  its price past `e ** 2` times the usual) and `MARKET_PRESSURE_MAX` (10), so a huge sale is paid
  at most about `b * depth` however large it is: a stock of 1e17 seals sells for a bounded sum.
- A trade is a sale of `amount` units of one material followed by the purchase of as many whole
  units of another (one the city produces) as the sale paid for, both with the fee; the coins
  the purchase leaves go to the world's coins. It is refused when it would give nothing.
- Amounts are whole numbers from 1 to `MARKET_MAX_AMOUNT` and never more than the world holds;
  coins are whole, at least 0 and at most `MARKET_MAX_COINS`. Both bounds (1e100) are far past
  anything played and keep every number finite. Like materials, coins past 2 ** 53 are not
  counted to the unit.
- Prices recover: whenever the world is advanced (`advance`, every round, for every world),
  every pressure is multiplied by `0.5 ** (elapsed / MARKET_RECOVERY_HALF_LIFE_MS)` (six hours),
  and one smaller than `MARKET_PRESSURE_FORGOTTEN` is dropped. The elapsed time is game time:
  what `advance` covers, which the bridge caps per round, so prices recover while the game
  plays, not while the computer sleeps. Many short advances recover exactly as far as one long
  one.

| Constant | Value | Why |
|---|---|---|
| `MARKET_CITY_FACTORS` | wanted 1, neutral 0.8, produced 0.6 | A city pays most for what it wants; none pays more than the base value. |
| `MARKET_FEE` | 0.1 | Every sale pays 10% less, every purchase costs 10% more: the spread that keeps trading from paying. A world's Storehouse lowers it, never below `MARKET_FEE_FLOOR` (0.06); the formulas below use the world's fee. |
| `MARKET_DEPTH_BASE` | 1000 | The units that move a price by a factor of e at level 0: about two and a half reference upgrades at every level. |
| `MARKET_PRESSURE_MIN`, `MARKET_PRESSURE_MAX` | -2, 10 | The ceiling on a city's price when bought out, and the floor of a dumped one. |
| `MARKET_RECOVERY_HALF_LIFE_MS` | 6 hours | A price pushed in the morning is mostly back the next day of play. |

### Why no trade can make money

Value every holding at its base value: `wealth = coins + Σ materials × b`. A sale of `q` units
pays at most `q * b * (1 - MARKET_FEE)` (no city's price is above `b` for a sale, and the coins
are rounded down), so wealth falls by at least the fee. A purchase costs at least
`q * b * (1 + MARKET_FEE)` (no price is below `b` for a purchase, rounded up), so wealth falls
again. A trade is one of each, a stall offer turns coins into gear, and the recovery of prices
changes no holding. Every step lowers wealth or leaves it, so no sequence of them, in any
cities, in any order, with any wait between them, ends with more: the best price any city pays
for a material is always below the best price any city asks for it. "Buy where it is produced,
sell where it is wanted" loses at least the two fees.

`src/game/market.test.mjs` checks it: from 150 random price states (every city and material at
a random pressure in range, random stocks and coins, world levels 25 to 99) it plays 60 random
steps each (sales, purchases and trades of random sizes in random cities, and waits for
recovery) and asserts wealth never rises, coins and stocks stay whole and at least 0, and
pressures stay in range; that the best sell price is below the best buy price for every
material in every state; that every buy-here-sell-there round trip loses coins for amounts
from 1 to 40,000, with or without waiting for prices to recover; and that a sale of 1e17 units
is bounded. The random walk and the round trips run again with the fee at its floor (a
Storehouse at level 1e12), and the property holds: any fee above 0 keeps every sale below base
value and every purchase above it.

### The stall

Each open city offers `STALL_OFFERS` (3) pieces of generic gear a game day, each of a different
kind (a physical weapon, a magical weapon, an outfit or a tool, in an order hashed from world,
city and day), at `stallTier(L) = min(ITEM_MAX_TIER, dropTier(L) + 1)`: one tier above what the
world's monsters drop. The game day is `floor(clock / MARKET_DAY_MS)`, the clock being the time
the world was last advanced to, so offers change at midnight UTC of the time the rounds read.

A piece costs `round(STALL_MARKUP * Σ upgradeCost(level l) * (b1 + b2))` coins, at least 1: the
base value of the two recipe materials that would upgrade a fresh tier 1 copy level by level up
to the piece's gear level in that world (at least one upgrade's worth), times `STALL_MARKUP`
(1.5). It follows the tier (each gear level doubles it) and the world level (like upgrade
costs), so a piece ahead of the world's reference gear is dear and one behind it cheap.

`buyStallOffer` puts the piece into the chosen project's chest at level 0, as a drop would, and
records the offer as sold for that day. It is refused when the city is closed, the offer is not
today's (the caller names the entry it saw), it was sold already, the coins do not cover it, or
the chest already keeps `COPIES_PER_ITEM` copies of that entry: a purchase is never salvaged.
Offers have a `kind`: `item` for gear, `relic` for a relic.

**A relic now and then** (`src/game/stall-relic.mjs`). On a game day an open city's stall also
offers a relic with chance `STALL_RELIC_CHANCE` (25%), by hash of world, city and day: one of that
city's two relics (never a boss relic) that the room it would go to does not own, picked by hash,
so each room sees one relic all day and none once it owns both. It is the offer after the gear,
index `STALL_OFFERS` (3), and is bought through the same `buyStallOffer` with that index and the
relic's id as `entryId`: the relic joins the project's relics (`withRelic`: a room's first relic
becomes active), the coins are paid and the offer is sold for the day, for every room. It costs
`round(STALL_RELIC_PRICE_BASE * REWARD_GROWTH ** L)` coins (base 3,000), steep and growing like
kill rewards: 4,814 coins at level 16, 13,000 at 50, 57,000 at 100. With the simulator's trading
player that is three a year for a light user and twelve for a medium one, a burst in the first
month while the world is young and its stock of starter surplus sells, then one every three to
five weeks; a heavy user buys every relic its cities have as soon as each is offered.

### City ranks

Each city grows through five ranks, I to V, per world (`src/game/city-ranks*.mjs`,
`city-rank-constants.mjs`, `city-stall-legendary.mjs`), the way the settlement grows: a long axis
to invest in, with a banner of its own at every rank. A world earns **standing** with a city by
trading there, and once it has enough it buys the city's **charter** for the next rank, which
raises the rank by one.

- **Standing.** Every sale, purchase and trade made in a city adds the base value of every unit it
  moved (a trade counts both sides); a stall piece, relic or legendary piece adds its price. Each
  is divided by `REWARD_GROWTH ** worldLevel` at the time, so standing grows at the same pace at
  every level, as prices do. It only grows, and buying a charter does not spend it.
- **Charters.** The charter for rank r needs `CITY_STANDING[r - 1]` standing in all (3,000,
  25,000, 120,000 and 500,000 for ranks II to V) and costs `CHARTER_COINS[r - 1]` coins (500,
  2,000, 6,000, 15,000) and `CHARTER_UNITS[r - 1]` units (100, 400, 1,200, 3,000) of each material
  the city wants, both times `REWARD_GROWTH ** worldLevel`, rounded. It is bought in the city, from
  the rank card on its page; `charterProblem` says why it cannot be (the city closed, its last rank,
  too little standing, coins or materials). The charters' names are flavour in `game/cities.json`.

| Rank | Title | The city's fee | Its stall | Its perk (one per city) |
|---|---|---|---|---|
| I | Hamlet | the world's | as before | none |
| II | Town | 0.5 points lower | a fourth piece of gear a day (offer index 4) | the first charter's |
| III | City | 1 point lower | its gear one tier higher | the second's |
| IV | Capital | 1.5 points lower | a relic on 40% of days instead of 25% | the third's |
| V | Golden age | 2 points lower | on 20% of days, one of the city's two legendary pieces (offer index 5) | the fourth's |

- **The fee** in a city is the world's (`MARKET_FEE` less the Storehouse's cut) less
  `CITY_RANK_FEE_CUT` (0.005) a rank above the first: 4% at its lowest, with a Storehouse far up and
  a city at rank V. It is still above 0, so every sale pays less than base value and every
  purchase costs more, and no trade can make money (`city-ranks.test.mjs` checks it with the fee
  at its lowest). The view gives each open city its own `fee`; the UI quotes with it.
- **A festival week.** When the world's weekly event is a city's festival (see "Weekly events"),
  that city takes `FESTIVAL_FEE_CUT` (0.01) less fee for the week, on top of its rank's cut
  (`city-festival.mjs` marks the city `festival: true` in the list the market functions and the view
  get). At its lowest, rank V, a festival and a Storehouse far up, the fee is 3%: still above 0, and
  `city-ranks-week.test.mjs` checks that no city then pays more for a material than any city asks.
  The city's card and banner say "Festival this week".
- **The trait broker** (see "Traits") of a city at rank III or above offers a fourth scroll a day
  (index 3); at rank V it draws its tiers by `RANKED_BROKER_TIER_WEIGHTS` (common 64, rare 27, epic
  9 instead of 70, 27, 3), so an epic scroll comes three times as often. A broker never sells a
  mythic one.
- **News.** A charter bought is told in every room of the world, with the city's new banner
  (`{ type: 'city', worldId, cityId, rank, name, title, banner }` in `recent`, from
  `cityRankNews`), and kept as a highlight of the day journal (`kind: 'city'`, `ref` the city,
  `value` the rank). Four achievements of the City ranks group follow it: a first charter
  (metric `charters`), a city at rank III and at rank V (`cityRank`, the best rank), and every city
  of a world at rank V (`citiesAtTopRank`), which gives the title "Patron of the Five Cities".
- **The legendary piece** is one of the city's own list (`ranks.legendary`, two pieces of legendary
  equipment each, ten in all, none sold by two cities) that the room it would go to lacks, at
  `STALL_LEGENDARY_PRICE_BASE` (6,000) × `REWARD_GROWTH ** worldLevel` coins, twice a stall relic.
  It arrives as a boss would drop it, at the reference gear of the world. It adds no power the
  boss's drop could not give, since every piece already counts towards the caps.
- **The perks** are effects of the world (scope `world`), summed with the relics, the equipment,
  the bestiary and the settlement under `LEGENDARY_EFFECT_CAPS`. They are kept small so that, with
  every city at rank V and every other source at its top, no type passes its cap
  (`city-ranks-save.test.mjs` checks it, and `npm run check` refuses a file whose perks add up past
  a cap):

| City | II | III | IV | V |
|---|---|---|---|---|
| Goldmill | Millers' Bread: `gatherHours` +0.15 | Harvest Lore: `gatherXp` +0.5% | Full Granaries: `staminaPool` +0.5% | Golden Sheaf: `killMaterials` +0.2% |
| Deepforge | Dwarven Whetstones: `upgradeCost` −0.5% | Foundry Edges: `critDamage` +0.5% | Spiked Plate: `thorns` 1.5% | Kings' Anvil: `upgradeCost` −0.5% |
| Brinehaven | Tide Tables: `gatherHours` +0.15 | Salvage Rights: `itemDrop` +0.5% | Ship's Biscuit: `staminaPool` +0.5% | Merchant Fleet: `itemDrop` +0.5% |
| Tallwood | Hunters' Lodge: `gatherHours` +0.15 | Woodcraft Lessons: `gatherXp` +0.5% | Long Summer Days: `gatherHours` +0.15 | Canopy Wardens: `thorns` 1.5% |
| Runespire | Scribed Wards: `runeCircle` +0.5% | Lamplight Archive: `gatherHours` +0.15 | Seers' Insight: `critDamage` +0.5% | Spire Light: `runeCircle` +0.5% |

- **Content.** A city of `game/cities.json` may have `ranks: { banners, charters, legendary }`: five
  `{ banner, alt }` (PNGs under `ui/cities/`, `<city>-<rank>.png`), four `{ name, perk, effect }`
  for ranks II to V, and the legendary equipment its last rank sells; the file's `rankTitles` names
  the five ranks. A city without `ranks` stays at rank I. The banners are drawn by
  `scripts/city-art/ranks.py` (see its README).
- **In the save.** A world keeps `cityRanks: { [cityId]: { rank, standing } }` once it has traded
  with a city. A save from before has none: every city is at rank I with no standing, and nothing
  else changes. `migrate` drops an entry that is not a rank from 1 to 5 and a standing from 0 to
  1e15; `cleanSave` refuses one, a city without ranks in the content, and a sold offer past index 5.
  A world reset forgets the ranks with the world.
- **Pace.** Tuned with the simulator's trading player, which buys every charter it can on its daily
  visit and keeps the next charter's coins aside from buildings paid in coins (see "Market" under
  "Balance"): a light user reaches rank II in a first city on day 17 and holds three cities at II
  after a year; a medium one has a city at II on day 3, III on day 113 and IV on day 239, and no
  city at V after a year (ten charters); a heavy one has every city at II within ten days and four
  at III by day 113, coins being what holds it back. Rank V of every city is a goal of years, not months.

## Save shape

One JSON value:

```
Save      { version, worlds: { [worldId]: World }, projectWorld: { [projectId]: worldId | null },
            settings: { keepTitles }, achievements?, journal? }
World     { skills: { [skillId]: { level, xp, banked, stars } }, materials: { [id]: number },
            upgrades: { [id]: level }, projects: { [projectId]: Project }, lastTokenAt,
            coins, market: Market, bestiary?, instances?, traits?: TraitRecord, weekly?, cityRanks? }
Market    { clock: number | null, pressure: { [cityId]: { [materialId]: number } },
            sold: { [cityId]: { day, offers: number[] } } }
Project   { wave, waveKills, kills, monster, stamina, restTicks, fightMs, fightTicks, fightRested,
            themeId, tradeChoice, chest: Item[], characters: { [sessionId]: Character },
            retirees: Retiree[], retiredCount, legendary?, run?, instanceCooldowns?,
            scrolls?: { [traitId]: count }, scarcest?: { at, picks: { [sessionId]: trade } } }
Legendary { relics: string[], active: string | null, relicPity, bossPity }
Character { sessionId, class, level, xp, attributes, levelActivityXp, equipment, trade,
            tradeChoice, tokens, bornAt, lastSeenAt, skillXp, gatherCarry, title, state,
            pinned?, traits?: string[] }
TraitRecord { known: string[], sold?: { [cityId]: { day, offers: number[] } }, swaps? }
Item      { id, entryId, slot, damageType?, tier, recipe, level, heldBy, legendary?: true }
Monster   { id, name, kind, rank, affix, level, maxHp, hp, physical, magical, attack, reward,
            dropFactor, loot, race?, look?: { rig, parts, colours }, sprite? }
```

`upgrades` holds the level of each building of the settlement by its group upgrade id
(`campfire`, `workbench`, `runeCircle`, `storehouse`, `defences`), a missing one at 0 (see
"Settlement"). `coins` are the world's, whole; a save from before the market has none and reads as 0, with a
market at rest (`{ clock: null, pressure: {}, sold: {} }`). `market.pressure` keeps only prices
that moved; `sold` the offers bought on the day it names.

A monster keeps the part ids and colours it was given, not a seed, so it never changes looks
when parts or races are added later; a look is about 300 bytes. A monster saved before ranks and
looks has neither `rank` nor `look`: it keeps its `sprite` and is drawn and fought as before.

`tradeChoice`, on a project and on a character (and kept on a retiree record), is a gathering
skill, `'scarcest'` or null (see "Gathering"); a save from before it existed has null everywhere.
`scarcest` holds a room's picks of what is scarcest, optional: a gathering skill by session id,
and the time they were made. `kills`
counts every kill of the project (see "Scenes"); `stamina` is a share of the party's
pool; `restTicks` the rest left; `fightMs` fight time not
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
| `history` | This Orca offers `agent.listSessions` to the worker (`orca.host.has`) and the `history:read` capability is granted (`orca.grantedCapabilities` lists it; an Orca that does not say what was granted counts as not granting it). | Real token totals from Orca's Agent Session History. |
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
   the default; none under Random, where the UI picks) is the engine's `themeId`. A room that
   travels (below) gets no `themeId` but `scenes`.
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

A room travels when `travel` ("new scene after each monster") is on, more than one theme is
loaded (`listThemeIds`, the themes in `themes/`) and the room has no theme of its own; with any
default theme, Random included. Its readings carry `scenes`, the loaded theme ids, so its
monsters come from the scene it is in, which also gives it themed monsters under Random. A room
that has not joined has no project to move. A monster standing when the setting is turned on
keeps the look it was given; the next one fits the scene.

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
agent the time it spent working and the tool calls it started (from the `agent.tool.before`
hook; a subagent's calls count for its agent). Time spent waiting, blocked or done is not
working time. The estimate has two separate parts: **how many tokens** a round is worth, and
**which work skills** they train.

#### How many tokens

The total is computed from the working time by the activity the agent showed while it passed
(`workedMs`), exactly as it always was. Over one round, an agent on this computer is estimated
to have spent:

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
feed the pace exactly like real ones.

#### Which skills they train

The same working time is also shared between the five work activities by what the tools show
(`attributedMs`), and the round's tokens are split by that share (`attributeEstimate` in
`src/game-sources.mjs`, `estimateWeights` and `splitTokens` in `src/game/estimate.mjs`). The
split only decides which skills grow: the parts always add up to the total above, so progression
speed, character levels and the simulator's targets do not change. Each part goes to
`applyTokens` with its own activity.

The rules (`src/domain/skill-mix.mjs`):

- **Each tool call** counts for its tool's activity (`activityForTool`; `Agent` and `Task` are
  delegate, unknown tools think). Its share of the tokens (`ESTIMATE_TOKENS_PER_TOOL_CALL`) goes
  to that activity.
- **Time between tool calls follows the tools.** Every agent keeps a recent tool mix, an
  exponentially weighted mix of its calls (`RECENT_CALL_WEIGHT` 0.25, about the last eight
  calls). Working time after a tool signal goes `THINK_SHARE` (a quarter) to think and the rest
  by that mix: a model does reason between calls, but the text of an edit or a command is written
  before its call starts.
- **Unknown is not thinking.** Working time that no tool signal explains is `unknown`: an agent
  never seen using a tool (a session Orca stopped tracking after a restart, an agent on a paired
  machine whose snapshot names no tool), or one whose last signal is older than
  `TOOL_SIGNAL_FRESH_MS` (ten minutes). Unknown time is spread by its world's mix.
- **Delegation.** While an agent has subagents working (from its hooks or from the snapshot),
  `DELEGATE_SHARE` (half) of its working time counts as delegate, and the other half follows the
  rules above. The subagents' own tool calls count on their agent's meter by their own tool, so
  their reads and edits train Lore and Forge. Subagents are not characters and have no meter of
  their own, so nothing is counted twice; parallel subagents do not multiply the agent's time,
  because the total must not change.
- A snapshot that names the running tool (`toolName`) is a tool signal without a call: it keeps
  the agent's mix and freshness up to date but adds no call.

**The world's mix** (`worldWorkMix`) is what unknown time and a rebalance follow. Each round, the
tool calls of the world's agents are added to its observed counts (`foldObservedCalls`), which
keep about the latest `OBSERVED_CALLS_KEPT` (500) calls and are saved with the bridge as
`workMix`. Once there are `MIN_OBSERVED_CALLS` (30), the world's mix is their time mix (a quarter
think, the rest by the calls) with every activity raised to `MIX_FLOOR` (5 %) and normalised
again. Before that it is `DEFAULT_WORK_MIX`:

| write | read | run | think | delegate |
|---|---|---|---|---|
| 0.20 | 0.25 | 0.20 | 0.25 | 0.10 |

It sits between two references. A typical coding session's tool calls are mostly reads and
searches, then commands, then edits, with a few subagents; with a quarter of the time for
thinking that gives roughly write 0.15, read 0.30, run 0.22, think 0.29, delegate 0.04. The
simulator's balance was tuned on its three profiles, which average about write 0.25, read 0.27,
run 0.15, think 0.2, delegate 0.13. Delegation keeps a tenth because it is the one activity no
snapshot of an untracked agent shows, and a skill left at level 1 cripples its class.

Before this attribution, a round's tokens all went to the one activity the agent showed at the
moment of the round. An agent with no tool signal shows think, so untracked sessions and paired
machines trained Arcana alone; and delegate showed only while an `Agent` or `Task` call seen by a
hook was open on the parent, at the moment the round came.

The Skills tab says under the work skills where the split comes from: "Split from your agents'
tools" when tools explain nearly all the recent working time (less than a tenth unknown), and
"Estimated mix: tools are not visible for some agents…" otherwise, naming what their time
follows. With real totals the split is still the agent's activity when the tokens are counted.

#### Rebalancing a lopsided world

**Rebalance work skills** in the game settings shares a world's work-skill experience again by
the world's mix (`rebalanceWorkSkills` in `src/game/rebalance.mjs`). It is only ever done when
asked, after a question that shows each skill's level before and after. The rule:

- the experience is shared between the five work skills by the mix;
- its total is the largest for which the five levels add up to no more than they did, which,
  since levels rise one at a time, is the same sum: **the world level does not change**;
- levels and the progress inside them are recomputed from level 1; stars and experience banked
  at the cap stay with their skill; gathering skills, characters and retirees are left alone.

Experience beyond what the same world level holds is not kept. The level curve is linear
(`LEVEL_BASE × level` per level), so a lopsided world holds far more experience than a balanced
one of the same world level: keeping the total instead would raise the world level, and with it
every hit and price, for nothing. A world at Forge 4, Lore 2, Engineering 13, Arcana 52 and
Command 1 (world level 14) becomes, with the default mix, Forge 15, Lore 16, Engineering 15,
Arcana 16 and Command 10 (still world level 14).

#### Agents on paired machines

An agent on a paired machine is known only from the snapshot of that machine (`orca worktree
ps --environment <name>`, every 15 seconds): no event or hook reaches the plugin from there.
Its meter counts the time between two snapshots as working when the earlier one saw it
working, at the activity of the tool the snapshot names (`toolName`), or thinking when it names
none. That activity only sizes the total; for the skills, a named tool is a tool signal
and time with none is unknown, spread by the world's mix. Its tool calls cannot be counted: a snapshot names the tool running at that moment, and
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
`{ baselines, watchedUntil, autoSpend, travel, tokenSource, workMix }`. A stored bridge without
`tokenSource` that has a `watchedUntil` was watched through the history; one without `travel`
has it off; one without `workMix` has observed no tool calls yet. `workMix` (the tool calls
observed in each world, by activity) is kept when the source changes or the game stops. It is loaded once with the engine's `migrate`, written
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
| `game.buyUpgrade` | `/api/game/buy-upgrade` | `{ worldId, upgradeId, useCoins }`: `useCoins` optional, a boolean, to pay half in coins; a building not open yet, or coins asked of a tier that takes none, is refused with the reason |
| `game.assignRoom` | `/api/game/assign-room` | `{ roomId, worldId }`, `worldId` null for out of the game |
| `game.resetWorld` | `/api/game/reset-world` | `{ worldId }` |
| `game.rebalanceSkills` | `/api/game/rebalance-skills` | `{ worldId }`: shares the world's work-skill experience again by its mix, keeping its world level (see "Rebalancing a lopsided world") |
| `game.setActiveRelic` | `/api/game/active-relic` | `{ roomId, relicId }`, `relicId` null for none; a relic the room owns |
| `game.autoSpend` | `/api/game/auto-spend` | `{ on }` |
| `game.travel` | `/api/game/travel` | `{ on }`: "new scene after each monster" |
| `game.characterTrade` | `/api/game/character-trade` | `{ roomId, sessionId, trade }`: a living character of a room that plays; `trade` a gathering skill, `'scarcest'`, or null to follow the room |
| `game.equip` | `/api/game/equip` | `{ roomId, sessionId, slot, itemId }`: a living character of a room that plays, `weapon`, `outfit` or `tool`, and an item of that room's chest, null for nothing or `'auto'`; a choice the rules refuse says why. |
| `game.bestGear` | `/api/game/best-gear` | `{ roomId }`; answers `{ changed, slotsChanged }` |
| `game.roomTrade` | `/api/game/room-trade` | `{ roomId, trade }`: a room that plays; `trade` a gathering skill, `'scarcest'`, or null for Auto |
| `game.keepTitles` | `/api/game/keep-titles` | `{ on }` |
| `game.exportSave` | `/api/game/export-save` | none |
| `game.importSave` | `/api/game/import-save` | `{ file }`, a save file as `exportSave` answers it |
| `game.moveOrphanItems` | `/api/game/move-orphan-items` | `{ fromRoomId, toRoomId }`: a project of the save that is not on screen, and a room on screen that plays in the same world |
| `game.sendItem` | `/api/game/send-item` | `{ roomId, toRoomId, itemIds, confirmHeld }` (or a single `itemId`): two rooms that play in the same world, the target on screen, items of the first's chest, and `confirmHeld` true when a character holds one of them; answers `{ changed, sent, salvaged, sentSalvaged, salvagedItems, repicks }`: how many items went, how many copies past the target's cap were salvaged and how many of those were sent ones, each salvaged item as `{ name, level, isSent }`, and `{ sessionId, slot, itemName }` for each holder's new pick (`itemName` null for nothing). A sending the rules refuse says why. |
| `game.previewSendItem` | `/api/game/preview-send-item` | `{ roomId, toRoomId, itemIds }`, checked as `send-item`: what the sending would do, changing nothing. Answers `{ problem, salvaged, materials }`: the reason it would be refused (or null), each item the target's cap would salvage as `{ name, level, isSent }`, and the materials the world would get in all. Held items are assumed confirmed. |
| `game.sendRelic` | `/api/game/send-relic` | `{ roomId, toRoomId, relicId }`: as above, and a relic the first owns, its active one included; answers `{ changed, wasActive }` (`wasActive`: the room now has no active relic). A sending the rules refuse says why. |
| `game.sell` | `/api/game/sell` | `{ worldId, cityId, materialId, amount }` |
| `game.trade` | `/api/game/trade` | `{ worldId, cityId, fromId, toId, amount }` |
| `game.enterInstance` | `/api/game/enter-instance` | `{ roomId, instanceId, tier, rematch? }`: a room that plays, an instance of `game/instances.json` and a whole tier, or a rematch (1 to 10) of a beaten boss, which plays at its own tier; a choice the rules refuse says why (closed, level, tier, another room inside, no characters, cooldown) |
| `game.chooseBoon` | `/api/game/choose-boon` | `{ roomId, boonId }`: a room whose run is at the vault and one of the two boons it offers |
| `game.recallParty` | `/api/game/recall-party` | `{ roomId }`: a room inside an instance (one left behind too, so it frees its instance) |
| `game.partyTitle` | `/api/game/party-title` | `{ roomId, achievementId }`: a room that plays and an achievement it earned that grants a title, or null for none |
| `game.summarySeen` | `/api/game/summary-seen` | none: marks the "While you worked" summary read |
| `game.buyOffer` | `/api/game/buy-offer` | `{ worldId, cityId, offerIndex, entryId, roomId }`: `entryId` is the piece the person saw; `roomId` a room that plays in that world |
| `game.buyCharter` | `/api/game/buy-charter` | `{ worldId, cityId }`: a world of the save and a city of `game/cities.json`; a charter the rules refuse says why (see "City ranks") |

Each answers `{ changed }`, except `exportSave`, which answers the save file, and `bestGear` and
`sendItem`, which add what they changed. Ids must name something that exists: a world of the save, a room on
screen or in the save, an item of that room's chest, a skill, a group upgrade, a living
character of the room, a gathering skill, a city of `game/cities.json`, a material, an offer
index from 0 to 5 (the gear's, the relic's at 3, a ranked city's extra piece at 4 and legendary piece at 5); an amount is a whole number from 1 to `MARKET_MAX_AMOUNT`. A sale, a
trade or a purchase the market cannot make (a city not open yet, more than the world holds, an
offer sold or changed) answers `{ changed: false }`. A new world is a
kebab-case name of at most 32 characters, and there are at most eight worlds. Anything else is
refused with an error, and nothing is stored. Every action but `keepTitles` needs the game to be
running; `keepTitles` writes the setting, and the save follows. A refusal carries its reason:
the HTTP routes answer `{ ok: false, error }` with status 400.

The HTTP routes are for this computer only. With the plugin's **Open to the local network**
setting on, a request whose connection does not come from a loopback address is refused with
status 403 and that reason, for every route above, before the controller is called: they all
change the saved game or, for `exportSave`, give it away. Such a page can still watch the game
(see "View state").

### Save file

`exportSave` answers `{ format: 'agent-center-game', version, exportedAt, save, autoSpend,
travel }`:
`version` is the stored wrapper's (`STORED_VERSION`), `exportedAt` an ISO time, `save` the
engine's save as it is in memory, written or not, with each world's coins and market. A file
exported before the market existed still imports, with no coins and a market at rest. It never holds the baselines or
`watchedUntil`: they describe this computer's sessions at the moment of the export. It works
whenever the stored save has been read, even with the game off, and is refused while the stored
save is from a newer plugin.

`importSave` replaces the whole game, in every world, with a file. It is refused, and nothing
changes, when the game is not running or the stored save is from a newer plugin, when the value
is not an object with that `format`, when its `version` or its save's `version` is newer than
this plugin reads (the rule the storage uses), when its JSON is larger than the 240 KiB the
storage keeps, or when its save, brought up to this version by `migrate`, does not pass
`cleanSave`. A world a room names in `projectWorld` that the save does not hold yet is not a
problem: the engine writes that when a room is put in a new world before its first tokens. The
titles and monster names of a save that passes are then cleaned like live titles
(`displayText` in `src/domain/display-text.mjs`: control and bidi characters removed, at most
`TITLE_LIMIT`, 80, characters); a monster whose name has nothing left is dropped, and the next
round brings another. What the plugin exported is already clean and comes back unchanged.
Otherwise the save, `autoSpend` and `travel` are taken from the file (a file
without `travel` turns it off), the baselines and
`watchedUntil` are forgotten as when the game is turned off, and the bridge forgets the last
round, its links and the meters it read, so the next round counts from then and fights nothing,
and nothing read before the import counts again. A round that was reading the sessions when the
import came writes nothing. The settings keep their own value: `gameKeepTitles` off forgets the
file's titles on the next round. Characters of the file whose sessions are not open here retire
by the usual closing rules.

## View state

`controller.getState().game`. While the game is not running it is only
`{ status, tokenSource: null, autoSpend, travel, keepTitles }`. While it runs:

```
{
  status: 'running', tokenSource: 'estimated', autoSpend: false, travel: true, keepTitles: false,
  tickSeconds: 10,                  // the length of one tick of every fight, in game time
  worlds: [{
    id: 'main', level: 11, attackSpeed: 1.12,
    workSkills: [{ id: 'forge', level, stars, effectiveLevel, progress, canPrestige }, ...],
    gatheringSkills: [...same shape],
    // Where the split between work skills comes from now: 'tools', 'mixed', 'mix', 'none' (no
    // work seen yet) or 'activity' (real totals); the world's mix ('observed' or 'default'), and
    // each work skill's level before and after a rebalance.
    skillSplit: { from: 'mixed', mix: 'default', rebalance: [{ skillId: 'forge', from: 4, to: 15 }, ...] },
    materials: { bars: 98, ... },
    upgrades: [{ id: 'campfire', level, cost: { fish: 520, crops: 520 }, affordable, effect }],
                                    // the buildings open now, by group upgrade id
    settlement: {                   // null without game/settlement.json; about 4 KB
      total: 31,                    // building levels in all
      stage: { index: 3, number: 4, count: 7, id: 'village', name: 'Village', from: 30,
        art: 'ui/settlement/stage-4-village.png', alt, bonus: [effects] },
      next: { kind: 'stage', ...the next stage, have: 1, need: 30 },
                                    // past the last: { kind: 'star', stars, from, have, need }
      stars: 0, renovationEvery: 50,
      bonuses: [effects],           // every stage's bonus reached so far
      stages: [{ id, name, from, art, reached }],
      buildings: [{ id: 'hearth', upgradeId: 'campfire', name: 'Hearth', level: 9, tier: 2,
        tierCount: 3, current: { tier: 2, name: 'Cooking hearth', from: 5, art },
        nextTier: { tier: 3, name: 'Hearth hall', from: 15, art },   // null at the top
        open: true, opensAt: null,  // { index, id, name, from } while it is not
        cost: { fish, crops }, affordable,
        coinPrice: { cost: { fish, crops }, coins, affordable },     // null before tier II
        coinsFromTier: 2, effect: { staminaAfterKill }, nextEffect: { staminaAfterKill } }]
                                    // effect: staminaAfterKill, upgradeCostFactor, monsterHealthCut,
                                    // marketFee (the fee itself) or staminaDrainCut
    },
    coins: 48210,
    market: {
      day: 20408,                     // the game day: the stall's offers change with it
      fee: 0.1, depth: 1384.2,        // the world's fee (its Storehouse lowers it), and the depth
      pressureRange: [-2, 10],
      baseValues: { bars: 9, ... }, cityFactors: { wanted: 1, neutral: 0.8, produced: 0.6 },
      cities: [{
        id: 'goldmill', name: 'Goldmill', tagline, banner: 'ui/cities/goldmill.png', bannerAlt,
        opensAt: 1, open: true, produces: ['crops', 'fish'], wants: ['ore', 'bars'],
        pressure: { ore: 0.31 },      // only the prices that moved; open cities only
        stall: [{ index: 0, kind: 'item', entryId, name, slot, damageType, tier, power, price,
          sold: false, affordable: true, fullIn: [] }],  // open cities only
        relic: { index: 3, kind: 'relic', price: 4814, sold: false, affordable: true,
          byRoom: { 'local:/work/sneaky-pancake': 'millwind-vane' } },  // or null: none today;
                                    // a room's relic is null once it owns the city's two
        legendary: null,            // at rank V now and then, shaped as `relic`, at index 5
        fee: 0.095,                 // the fee in this city (lower at a higher rank); open cities only
        rank: { rank: 2, max: 5, title: 'Town', banner, bannerAlt, standing: 4120.5, fee: 0.095,
          perks: [{ name, perk, effect }], legendary: [{ id, name }],
          next: { rank: 3, title: 'City', standing: 25000, coins, materials: { ore, bars },
            charter: { name, perk, effect }, feeCut: 0.005, extraOffer, tierBonus, relicMoreOften,
            legendary, block: 'standing' } }   // block: standing | coins | materials | null;
                                    // next: null at rank V; rank: null for a city without ranks,
                                    // and banner is the rank's banner
      }, { id: 'runespire', ..., opensAt: 25, open: false }]
    },
    weekly: {                       // this week's event (see "Weekly events"), null before the first round
      week: '2026-W47', startsAt, endsAt, msLeft,  // msLeft from the last round, on the game's clock
      id: 'howling-moon', name, kind: 'race', flavour, race: 'werewolf', raceName: 'Werewolves',
      city: null, cityName: null, effects: [{ effect, scope: 'world', amount, ...qualifiers }],
      goal: { kind: 'race', count: 9, progress: 4, done: false },
      reward: { hides: 155, seals: 154 },  // what the goal pays at the world's level now
      next: { week: '2026-W48', id, name, kind, flavour, race, raceName, city, cityName, effects, goal },
      upcoming: [{ week: '2026-W48', startsAt, id, name, kind }, ...]  // the next five weeks, for the calendar
    },
    instances: {                    // the world's road; under 2 KB
      map: { cleared: 0, art: 'ui/instances/roadmap-1.png', alt },  // the picture for its progress
      cleared: 1, total: 6, complete: false,   // the first region's, as before regions
      regions: [{ id: 'old-road', unlocked: true, map, cleared: 1, total: 6, complete: false },
        { id: 'gloaming-isles', unlocked: false, map, cleared: 0, total: 8, complete: false }],
      list: [{ id: 'sunken-crypt', region: 'old-road', state: 'open',  // hidden | locked | open | inside;
                                    // a hidden one sends only { id, region, state, clears }
        runs: 3, clears: 2, bestTier: 1, highestTier: 2, relic: 'tidewake-bell', relicFound: true,
        rematch: 1,                 // the best rematch cleared, 0 for none
        nextRematch: { rematch: 2, tier: 5, opensAt: 8,  // null before its boss is beaten or past X
          entry: { 'local:/work/sneaky-pancake': null } },  // why each room cannot go, or null
        roomInside: null, roomIndex: null,          // the room inside and the room of the run it is in
        entry: { 'local:/work/sneaky-pancake': null, 'local:/work/rumble-banana': 'the room is already inside an instance' } }]
    },
    bestiary: {                     // about 9 KB a world
      discovered: 12, raceCount: 20, beaten: 12, bossCount: 55,
      rank: { rank: 22, points: 11_819, from: 10_762, to: 13_473, now: [effects], next: [effects] },
      hunter: { count: 12, level: 2, maxLevel: 5, from: 5, to: 15, now: [effects], next: [effects] },
      bonuses: [effects],           // the whole bestiary's, one per kind
      races: [{ id: 'orc', discovered: true, kills: 187, points: 346, ranks: [140, 28, 14, 3, 2, 0],
        eliteKills: 19, firstDay: 20_399, level: 13, maxLevel: 25, prestige: 0, from: 277, to: 376,
        now: [effects], next: [effects] },   // next: [] past the powered levels
        { id: 'ogre', discovered: false, kills: 0, points: 0, level: 0, maxLevel: 25, prestige: 0, from: 0, to: 2 }],
      bosses: [{ id: 'skrix', discovered: true, beaten: 3, legendary: 1, firstDay: 20_400,
        item: 'pilfered-lantern', found: false }],  // found: a room of the world owns the item
      others: { kills: 84, firstDay: 20_399 }       // or null
    },
    roomIds: ['local:/work/sneaky-pancake'],
    orphans: [{ roomId: 'local:/work/fuzzy-anvil', name: 'fuzzy-anvil', chestSize: 4, retiredCount: 7 }]
  }],
  rooms: {
    'local:/work/sneaky-pancake': {
      worldId: 'main', joined: true, wave: 15, waveKills: 0, killsToPass: 16,
      kills: 212,                   // every kill of the room; only a world reset lowers it
      sceneTheme: 'guild-hall',     // only while the room travels: the theme to draw it in
      monster: { id, name, kind, rank, affix, level, healthShare: 0.12, hp: 412, maxHp: 3430,
        race, look: { rig, parts, colours } }, // hp rounded up, so a standing monster never reads 0
                                    // a hand-made entry, or a monster saved before looks, sends
                                    // sprite: { body, accent } instead of race and look
      party: 'fighting',            // fighting | resting | paused | idle
      pausedBy: null,               // blocked | waiting while paused, otherwise null
      stamina: 0.8,                 // share of the party's pool
      tradeChoice: null,            // what characters without their own choice gather; null: Auto
      chest: [{ id, name, slot, damageType, tier, level, power, heldBy, upgradeCost, affordable }],
                                    // a legendary item adds legendary: true and entryId
      relics: { owned: ['tidecall-conch', 'rimeheart'], active: 'rimeheart' },
      run: null,                    // inside an instance: { instance, name, tier, level, room, roomName,
                                    // roomKind, fight, fights, progress, triesLeft, timeShare, workedMs,
                                    // boon, offered, vaultWaitMs, modifier, found }; boon, offered and
                                    // modifier as { id, name, effect }
      instanceCooldowns: null,      // or { [instanceId]: ms of working time left }
      chestSize: 6,
      retirees: [{ nameId, class, level, mainSkill, retiredAt, title }],
      retiredCount: 9, bonus: 0.045
    },
    'build-box:/srv/turbo-waffle': { worldId: 'main', joined: false }
  },
  characters: {
    'pane-13': { sessionId, link: 'title', guest: false, class: 'physical', level: 6,
      levelProgress: 0.4, attributes: {...}, equipment: { weapon: { id, name, tier, level },
      outfit, tool }, pinned: { weapon: true }, trade: 'mining', tradeChoice: null,
      autoTrade: 'mining', state: 'working' },
    'pane-5': { sessionId: null, link: 'guest', guest: true, level: 1 }
  },
  recent: [{ id: 570, at, type: 'level', roomId, sessionId, agentId, level: 9 }],
  legendary: { relicCount: 22, equipmentCount: 12,
    entries: { rimeheart: { id, name, kind, effect, flavour, colour, boss?: { id, name }, city?,
      slot?, damageType?, class?, trade? } } },   // only the entries the state refers to
  bestiary: {                       // the content's, the same for every world; about 32 KB
    races: [{ id: 'orc', name: 'Orcs', title: 'Orc-bane', look }],
    bosses: [{ id: 'skrix', name: 'Skrix', epithet: 'the Lantern Thief', race: 'goblin', look,
      item: 'pilfered-lantern' }],  // item: null for a boss that guards none
    points: { normal: 1, veteran: 2, elite: 5, champion: 10, boss: 25, legendary: 60 },
    levels: 25, perkEvery: 5, hunterThresholds: [1, 5, 15, 30, 55]
  },
  achievements: {                   // about 19 KB; the same for every world
    points: 125, totalPoints: 3845, earned: 14, total: 134, filled: 8,
    groups: [{ id: 'battle', name: 'Battle', earned: 1, list: [
      { id: 'monsters-2', points: 10, name, description, title: 'the Eager', share: 0.45, value: 45, target: 100 },
      { id: 'monsters-1', points: 5, name, description, earnedAt: 1767600000000, share: 1 },
      { id: 'monsters-6', points: 100, hidden: true, share: 0 }]}],   // hidden and not earned: nothing more
    titles: [{ id: 'relics-1', title: 'the Curious' }],              // the titles earned
    partyTitles: { 'local:/work/rumble-banana': { id: 'relics-1', title: 'the Curious' } }
  },
  journal: {                        // about 3 KB
    today: { day: 20458, kills, bosses, levels, skillLevels, loot, coins, materials, achievements,
      buildings, cleared, failed },
    since: { seenAt, ...the same counters, highlights: [...] },     // since the summary was opened
    days: [{ day, ...counters }],     // the last 14 days, today last, an empty day all zeros
    highlights: [{ at, kind, ref, value?, name }], activeDays: 41,
    unread: true                      // a highlight came after seenAt
  },
  instances: {                      // the content's, the same for every world; about 14 KB
    region: { id: 'old-road', name: 'The Old Road', title: 'Roadwarden', width: 256, height: 144, after: null },
    regions: [{ id: 'old-road', ... }, { id: 'gloaming-isles', name: 'The Gloaming Isles', title: 'Islewarden',
      width: 256, height: 144, after: 'old-road' }],
    instances: [{ id: 'sunken-crypt', region: 'old-road', scene, name, races, opensAt: 5, map: { x: 82, y: 94 }, banner, card,
      alt, route?: { start, mid, boss, alt }, relic: 'tidewake-bell', boss: 'ossric', elite: 'old-mattock',
      rooms: [{ kind: 'entrance', name }, ..., { kind: 'trap', name, check: { attribute: 'agility' } }, ...],
      rotation: ['regenerating-boss', ...] }],
    modifiers: { 'regenerating-boss': { name, effect } }
  },
  debug: { tokenSource, readAt, sessionsRead, truncated, resets, unmatched, unplaced, guests }
}
```

- A page opened from another machine (the local-network setting) gets this object through
  `src/server/network-view.mjs`, with `viewOnly: true`, every `sessionId` (on characters, in
  `recent`) and every chest item's `heldBy` replaced by an alias that is the same for the same
  session, and retirees' `title` null. Its web page then offers none of the actions and shows a
  "View only" marker. The panel and pages on this computer never get `viewOnly`.
- A world's `market` carries the numbers a UI needs to quote any amount exactly as the engine
  will (see "Market", "Prices"); the Market tab does so as a slider moves, before anything is
  sent, and `ui/engine/market-quote.test.js` holds its quote to the engine's for many amounts and
  price states: a city's usual price is `baseValues[m] * cityFactors[stance]`,
  with the stance from `wants` and `produces`, and its pressure is `pressure[m]` or 0. A stall
  offer's `fullIn` lists the rooms whose chest already keeps `COPIES_PER_ITEM` copies of it.
  Nothing in it names a session, so a page on another machine gets it unchanged.
- `achievements` and `journal` name no session and no conversation, so a page on another machine
  gets them unchanged; it shows them but offers neither the title picker nor marking the summary
  read.
- `rooms` has every room the store shows (except "No project"); `worldId` is null for a room
  out of the game, and `joined` is false until its first tokens.
- `sceneTheme` is there only for a joined room that travels (see "A round"). The surfaces draw
  the room in it instead of its usual theme; the next kill moves it on. The worker computes it,
  so the panel, the tab and the external view agree.
- A world's `orphans` are its projects left behind: in the save but not among the rooms the
  store shows now, with at least one chest item or retiree (`retiredCount` counts kept records
  and folded ones). `name` is the last segment of the room's folder, never its path. A room out
  of the game that is still on screen is not one. Nothing moves by itself: `moveOrphanItems`
  moves one into a room on screen of the same world (see `moveProjectItems`). A world no room on
  screen plays in still lists its orphans, though nothing can take them.
- `tokenSource` is `history` or `estimated` (see "When it runs"). A UI should say plainly when
  progress is estimated.
- A character's `trade` is the one it gathers now (see "Gathering"), `tradeChoice` its own
  choice or null, `autoTrade` the engine's pick, so a UI can say what "no choice" falls back
  to, and `tradeReason` why it gathers `trade`: `own`, `room`, `scarcest` or `auto`.
- A character's `pinned` names the slots chosen by hand (see "Choosing equipment"); a page that
  only watches shows them without the choice.
- `characters` is keyed by the agent id the rooms use, so a UI puts a class and a level on the
  right character. `link` is how it was matched: `session`, `title`, `only`, `agent` (the
  estimate: one character per agent, on this computer or a paired one) or `guest` (a paired
  machine's agent while the game reads real totals).
- `recent` keeps the last 20 events, newest last, each with an increasing `id`: `kill` (wave,
  kind, rank, affix, ticks, rested, materials, item, and `level`, the monster's, which is its wave),
  `drop` (item, with its `name` and `tier`), `legendary` (item, `kind`, `name`: a legendary
  drop, which a UI celebrates), `bestiary` (`kind` race, boss, hunter or rank, `id`, `discovered`
  or `level`, the race's or boss's `name`, and for a prestige rank the race's `title` and
  `prestige`: a first kill or a new level, which a UI celebrates),
  `settlement` (`worldId`, `kind` tier, stage or stars; a tier's `buildingId`, `upgradeId`,
  `building` and its `tier` and `name`; a stage's `stage`, `stageId` and `name`; `stars`: a new
  tier, stage or renovation star of the world's settlement, which a UI celebrates in every room of
  the world, a stage most),
  `instance` (`kind` enter, room, check, vault, boon, cleared, failed or recalled, `instance`,
  `tier`, `room`, and as the kind has them `passed` and `check`, `offered`, `boon` and `chosenBy`
  (person, auto or wait), `found` and `ticks`, `drops`: a step of a room's run, which its room
  tells; entering and the clear are celebrated like a legendary drop; a kill inside an instance
  carries `instance` too),
  `achievement` (`kind` earned, with `achievement`, its `name`, `points` and `title`, or backfill,
  with the `count` granted quietly: see "Achievements"; a UI celebrates one earned in every room),
  `level` (agentId, level), `retire` (sessionId,
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
  chest shows the items in use and every legendary item, then the strongest free ones up to 12
  in all (`chestSize` is the whole count). A legendary item is never left out, however weak: one
  sent to a room must show there at once, and the send control must see that the room owns it;
  retirees show the newest 8 (`retiredCount` counts all).
- A character's `state` and its room's `party` and `pausedBy` come from the store's agents at
  the moment the view is built, not from the last round, so they always match the room drawn
  next to them: `working`, `waiting` and `blocked` as the agent is, `idle` for one that is done.
  A paused party says why: `blocked` when an agent is blocked, otherwise `waiting`. Sessions no
  agent on screen runs keep the state their last round read. A character whose agent left the
  room is not sent.
- The game part is rebuilt only after a round, an action, a change in the state of an agent
  that has a character, or, while rooms travel, a change in the themes loaded or the rooms' own
  themes; between them every publish sends the same object.

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
against the targets below. A balance change is judged by its output, not by eye.

It then plays the same three scenarios again with a second policy
(`scripts/market-policy.mjs`): after the evening's `autoSpend`, a player who visits the market
once a working day. It trades surplus for what the three cheapest purchases out of reach lack
(surplus being what is left above three times the most any one purchase needs), buys each stall
piece that beats what a room keeps of that slot, sells what is still surplus where it pays best
until the price there has fallen 30% below the usual, buys a stall's relic whenever its coins
cover it (for the first room that lacks it), builds the cheapest building level it can pay half
in coins while it keeps a relic's price in coins (at most 20 a visit), and runs `autoSpend`
again. It uses only what the Market and Camp tabs offer. The first policy's output does not change with the market: its
player never trades.

Last, it plays the scenarios with more than one room (medium and heavy) with a third policy
(`scripts/funnel-policy.mjs`): once a working day, after `autoSpend`, the player sends every free
item and every relic that is not active from the other rooms into the first one, then presses
**Best gear for everyone** there. It prints both runs side by side. It also prints the day each
scenario's settlement reached each stage, with and without the market, and its building levels at
day 365.

Then it plays the three scenarios with a fourth policy (`scripts/instance-policy.mjs`, reported by
`scripts/instance-balance.mjs`): at every working step, the first room that may enter the highest
open instance goes in, one tier above its last clear there and one below after a failure, with Auto
taking the vault's first boon. It prints the day each instance is first cleared, the runs, clears
and failures, the best tier of each, the share of fighting time spent inside, what an hour inside
pays against an hour on the waves, and the legendary items owned and kills per hour against the
plain scenarios. The whole run takes under a minute.

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

What the simulator measures now, legendary loot, the bestiary and the settlement included:

| | light | medium | heavy |
|---|---|---|---|
| Tokens a working day, sessions at a time, projects | 3M, 1, 1 | 20M, 3, 2 | 100M, 6, 3 |
| Most used skill reaches 10, 30, first prestige | day 5, 93, after a year | day 1, 11, 166 | day 1, 2, 32 |
| World level at day 1, 7, 30, 90, 180, 365 | 2, 6, 14, 24, 34, 49 | 8, 18, 36, 62, 98, 191 | 16, 38, 80, 219, 445, 980 |
| Wave above the world level (day 30 on) | 6 to 8 | 6 to 7 | 3 to 6 |
| Median common fight (normal rank) | 22 ticks, 3.7 min | 25 ticks, 4.2 min | 18 ticks, 3.0 min |
| Kills per hour of fighting | 9.7 to 12.7 | 8.1 to 11.4 | 12.0 to 17.4 |
| Character level at retirement | 37 to 45 | 24 to 33 | 24 to 26 |
| Purchases per working day (day 30 on) | 0.2 to 0.8 | 1.2 to 2.3 | 7.6 to 14.8 |
| Gathering share of materials | 25% | 23% | 16% |
| Hit from world, gear, character (day 90 on) | 54%, 22%, 24% | 72%, 22%, 7% | 77%, 22%, 1% |
| Settlement stage reached (day): Outpost, Hamlet, Village, Town, Stronghold, Citadel | 15, 30, 200, -, -, - | 2, 4, 53, 186, -, - | 1, 3, 18, 46, 169, after a year |

At levels 10, 60 and 150 a balanced party rests in 1 to 10% of its fights, one without a
defender or a supporter in 50 to 100%; a party without magic takes 1.9 to 2.1 times as long
against armored monsters; a boss takes about three times a common monster and an elite 1.7 to
1.9 times; every fight ends. The eight hours at level 10 meet a legendary boss rather than a
plain one: 238 ticks, 6.5 times a common monster with its legendary health taken off. A newcomer does 73% of a seasoned character's work and is
seasoned after about an hour of an agent working. Engineering trails the other skills in all
three scenarios (agents run commands less than they write or read), so their parties attack
at 0.88 to 0.98 of the reference speed; the wave and the monster's health follow the
world level, not the party, so that shows as a slightly longer fight.

Targets the numbers do not meet, and why (four of 63: the light and heavy hit split, and the light
and heavy upgrade pace):

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

### Choosing equipment by hand

The automatic pick is greedy, one character at a time in the order they arrive, and blind to
class: a Healer that arrives first takes the strongest physical weapon although a Fighter hits
harder with it. That costs little. Over a simulated year, re-running "Best gear for everyone"
every evening, or giving each damage type's strongest weapons to the hardest-hitting classes
(Fighter and Mage before Guardian before Healer) every evening, changed the mean weapon gear
level by -0.5 to +0.6 and kills per hour by -2% to +2% against the automatic pick alone, in
both directions, and not at all for the light player's single character. Gear is about a fifth
of a hit and auto-spend upgrades whatever is held, so who holds the one good item matters only
until the next upgrades. A better automatic assignment exists (the strongest weapons of each
damage type to the classes with the highest `CLASS_HIT`, outfits and tools by power) but would
not change these numbers noticeably. The simulator never chooses by hand, so its numbers do not
change.

### Choosing a trade

Choosing a trade gives no material more worth than another in the recipes: every material is
gathered at the same rate and costs the same in each recipe it is in. Putting a whole world on
one trade gathers more units (1.4 to 1.6 times Auto's over a year in light, 2.8 to 3.0 in
medium, 4.3 to 4.4 in heavy), because that trade's skill takes all the gathering experience
(level 183, 478 and 744 after a year, against 40 to 130 for each of six under Auto). Without the
market the six materials are needed in pairs, so that surplus waits in the store: forcing one
trade on every room gives, at a year, a mean weapon gear level of 8.0 to 10.0 in light against
10.0 under Auto, 25.3 to 26.3 in medium against 25.7, and 124.5 to 125.5 in heavy against 125.5.
Steering every room each working day to the material the world has least of did a little better
than Auto: 5% more purchases in light, 2% in medium, under 1% in heavy (measured before the
generic tier 2 items existed). The simulator plays Auto, so its numbers above do not change.

With the market a surplus is no longer worthless: it can be sold, or traded for what is short.
Forcing one trade on every room and letting the trading player of "Market" below turn the
surplus into what is lacking does not dominate Auto with the same trader. At a year, over the
six trades, the gear level is 10.0 in light (10.0 for Auto with the market), 27.0 to 27.3 in
medium (26.7) and 125.3 to 125.5 in heavy (125.3): at most 2% more. Kills per hour come out
higher by up to 8% in light (12.8 to 13.8 against 12.8), 5% in medium (11.3 to 12.0 against
11.4) and 3% in heavy (15.2 to 15.8 against 15.3), purchases per day are the same. The fee and
the falling price of a big sale take back most of what the faster-levelled trade gathers, so
neither choice is a trap and none needs a fix.

### Market

`npm run simulate`, no market against the daily visit above (the gear is the mean effective
level of the weapons in use):

| | day | kills/h | with market | gear | with market | purchases/day | with market |
|---|---|---|---|---|---|---|---|
| light | 90 | 9.4 | 9.8 | 5.0 | 5.0 | 0.5 | 0.4 |
| light | 365 | 12.2 | 13.0 | 10.0 | 10.0 | 0.2 | 0.1 |
| medium | 90 | 9.0 | 9.7 | 9.7 | 10.3 (+7%) | 1.1 | 1.2 |
| medium | 365 | 10.7 | 11.3 | 26.3 | 26.7 (+1%) | 1.2 | 1.2 |
| heavy | 90 | 12.4 | 12.6 | 28.3 | 28.5 (+1%) | 10.0 | 9.9 |
| heavy | 365 | 15.4 | 15.7 | 125.3 | 125.5 | 13.8 | 13.7 |

With legendary loot in play (measured with it). In a year the trader makes 300 to 800 trades,
buys no stall pieces but 3 (light), 12 (medium) and 18 (heavy) stall relics (see "Legendary
loot" below), and sells for 22 k (light), 2 M (medium) and 5e15 (heavy) coins.

- The market helps modestly, as intended: at a year gear is at most 4% higher and kills per
  hour up to 9% (medium), within the "at most about +25%" target. Gear grows little because
  each level above the reference doubles the price whatever pays for it, and the fee and the
  falling price of a big sale cost a fifth or more of what is traded.
- A player who never opens the market plays exactly as before: nothing of the market runs
  without an action, and the first policy's numbers are unchanged.
- The simple trader is not always better: heavy's kills per hour are 1% lower with it, and
  light buys slightly fewer upgrades, as trading spends materials on the purchases it picks
  rather than on those `autoSpend` would have made later. A person who trades with thought does
  at least as well as one who does not trade.
- The stall rarely beats a room's own gear: its pieces sit one tier above the drops, about the
  reference gear, while auto-spend keeps gear in use a little above it. It helps a room that
  lags or a slot nobody has upgraded (a new mage's weapon). A piece is dear on purpose: in the
  demo's world at level 16 they cost 54 k to 83 k coins, two to three times its whole stock of
  materials at base value, so the light player, who has little surplus, seldom affords one,
  while medium and heavy could buy one every day or two and mostly do not need to.

### Legendary loot

`npm run simulate` plays with legendary loot (the active relic is the first obtained, as by
default) and prints, per scenario, what each room owns at day 30, 90 and 365 and the day of its
first relic and first boss-owned item. Its balance check adds one target per level: a trained
party of four with the strongest legendary equipment for each class and the best relic for a fight
kills at most about 15% more in a day than without any.

| | light | medium | heavy |
|---|---|---|---|
| Legendary items owned per room at day 30, 90, 365 (of 34) | 3, 3, 4 | 3, 3 to 4, 7 to 9 | 2 to 5, 8 to 10, 16 to 19 |
| The same with the trading player's market visits | 3, 4, 7 | 5 to 7, 6 to 10, 11 to 12 | 8 to 10, 11 to 12, 16 to 19 |
| Relics bought at stalls in a year (whole world) | 3 | 12 | 18 |
| First relic, first boss-owned item | day 8, day 8 | day 1, day 1 to 12 | day 1, day 1 to 46 |

| Level | Kills a day without, with the set and best relic | Gain | Best relic |
|---|---|---|---|
| 10 | 244, 267 | +9% | Ember Prince's Grasp |
| 60 | 237, 267 | +13% | Bramble Queen's Rose |
| 150 | 409, 450 | +10% | Ember Prince's Grasp |

Equipment alone adds 6 to 8%. A light user meets a boss every few weeks (five in a year), which
is why a room's first relic and first boss-owned item are certain: the light room sees both at its
first boss, on day 8. Its first boss has an item of its own only when that boss is one of the 24
that do (44%); otherwise its first boss-owned item waits for the next boss with one. Collections
stay long-term goals: a light room owns 4 of 34 after a year, a heavy one about half. The Millwind
Vane gives 15 minutes, not hours: when it was set, the light scenario's gathering share sat at the
30% top of its target and every quarter of an hour of gathering moved it by about half a point.
With the trade choice and the market it is 26% now, so there is room to give it more later.

Stalls give relics a second source that coins pay for. The trading player buys three a year as a
light user and twelve as a medium one; a heavy one buys every city relic its rooms lack within the
first month, so stalls change its pace early and not at all by the end of the year, when its rooms
own every city relic either way. The full-set gain is measured with relics alone and is the same
with or without the market. The trading player spends coins on relics it would otherwise have
kept, so it buys fewer stall pieces (none in a year, against two before); no balance target
changes.

Legendary equipment drops at the reference gear of the boss's level: the drop tier, with the
upgrade levels that tier lacks. With the generic items of every tier the stall now sells one tier
above the drops at level 0, which is at most two upgrade levels ahead of a fresh legendary item
(level 16: tier 2 +0 against the stall's tier 3, gear level 2 against 4; level 100: tier 7 +1
against tier 8, 13 against 14). That is within `LEGENDARY_PICK_MARGIN`, so a new character still
takes the legendary item it fits, and auto-spend keeps it level from then on. The rule needs no
change.

### Bestiary

`npm run simulate` plays with the bestiary and plays the three scenarios a second time without it
(legendary loot in both). Per scenario and day: races met, mastery levels in all, the lowest and
highest race, races with a perk, the hunter rank, bosses beaten, the boss hunter's level, the damage
bonus against a race averaged over all twenty, and kills per hour without and with the bestiary.

| | day | races | levels (lowest to highest) | perks | rank | bosses | boss hunter | race damage | kills/h without, with |
|---|---|---|---|---|---|---|---|---|---|
| light | 7 | 16 | 20 (0 to 4) | 0 | 2 | 0 | 0 | 0% | 3.7, 3.7 (0%) |
| light | 30 | 20 | 116 (3 to 9) | 18 | 10 | 2 | 1 | 1% | 10.9, 11.0 (+1%) |
| light | 90 | 20 | 180 (7 to 11) | 20 | 14 | 3 | 1 | 2% | 9.4, 9.7 (+3%) |
| light | 365 | 20 | 283 (13 to 15) | 20 | 21 | 5 | 2 | 3% | 12.2, 12.8 (+5%) |
| medium | 7 | 20 | 121 (4 to 8) | 18 | 11 | 2 | 1 | 1% | 7.8, 8.2 (+4%) |
| medium | 30 | 20 | 199 (9 to 11) | 20 | 16 | 5 | 2 | 2% | 7.9, 8.3 (+6%) |
| medium | 90 | 20 | 274 (12 to 14) | 20 | 21 | 9 | 2 | 3% | 9.0, 9.9 (+10%) |
| medium | 365 | 20 | 376 (18 to 19) | 20 | 28 | 29 | 3 | 4% | 10.7, 11.1 (+4%) |
| heavy | 7 | 20 | 163 (7 to 10) | 20 | 14 | 6 | 2 | 2% | 9.4, 9.7 (+3%) |
| heavy | 30 | 20 | 260 (12 to 14) | 20 | 21 | 14 | 2 | 3% | 11.5, 12.0 (+4%) |
| heavy | 90 | 20 | 338 (16 to 18) | 20 | 26 | 37 | 4 | 3% | 12.4, 13.4 (+8%) |
| heavy | 365 | 20 | 439 (21 to 23) | 20 | 33 | 55 | 5 | 4% | 15.4, 16.6 (+8%) |

And its pace: when the first level comes, and mastery levels anywhere in the bestiary per working
day.

| | first level | levels a working day: week 1 | month 1 | month 6 | a common race's level 25 |
|---|---|---|---|---|---|
| light | day 1, after 50 min of fighting | 3.2 | 4.5 | 0.6 | after a year (13 to 15 then) |
| medium | day 1, after 30 min | 21.6 | 8.5 | 0.6 | after a year (18 to 19) |
| heavy | day 1, after 30 min | 28.8 | 11.0 | 0.7 | after a year (21 to 23) |

Its balance check adds two kinds of target: in each scenario the bestiary adds at most about 10%
kills per hour at a year (+5%, +4%, +8%), and a whole bestiary at its top (every race past its
powered levels, the rank far up, every boss beaten) adds at most about 10% to a trained party of
four that already has the full legendary set and the best relic for a fight (+8% at level 10, +7%
at 60 and 150).

- The first ladder (5 levels at 10, 50, 200, 800 and 3,000 kills) looked dead in real use: after
  14 hours a medium user had 69 kills over twenty races, 6 at most, and no level anywhere. On
  points and the long ladder the same 69 kills (about 1.6 points each) and the 191 the rooms had
  counted before, back-filled, put every race at level 3 to 5 at once, and new levels come about
  twice an hour of fighting in the first week, then slow to one every day or two by month six.
- Growth 1.31 took the heavy user's races to level 23 to 25 in a year, nearly every perk, and +13%
  kills per hour; 1.35 brings it to +8%. The light user gains more than its kills would say (+5%):
  the ladder is geometric, so a tenth of the kills is only a few levels fewer.
- No target that passed before fails with it; the four that failed before still fail, for the
  same reasons. The world levels do not change.

### Sending gear

Sending items and relics between the rooms of a world is free. It does not need a cost, because
it only moves power around, and the simulator shows that piling everything into one room buys
nothing: the waves follow the world level, not the party, so the first room's wave stays where it
was, while the rooms that gave everything away fight their monsters with what their characters
hold and new characters there find an empty chest.

| | day | world level | waves as usual | waves funnelled | kills per hour as usual | funnelled |
|---|---|---|---|---|---|---|
| medium | 90 | 62 | 69/69 | 69/69 | 9.3 | 8.1 |
| medium | 365 | 191 | 198/197 | 198/194 | 11.3 | 7.3 |
| heavy | 90 | 219 | 222/222/222 | 222/218/218 | 13.4 | 6.1 |
| heavy | 365 | 980 | 983/983/983 | 983/982/982 | 16.4 | 8.4 |

Kills per hour of fighting are the world's, over every room. The world levels are the same in both runs:
tokens alone make them.

### Instances

The fourth policy, against the scenarios as usual (the world levels are the same: tokens alone
make them). Instances change no balance target (59 of 63 pass; the four that fail are the
hit splits and the upgrade pace under "Balance"), and a player who never enters an instance plays exactly as before.
The best tiers and best rematches below are the first region's instances; the runs, time inside and
what it pays count every run, the second region's included.

| | crypt | foundry | hive | keep | library | spire (and the title) |
|---|---|---|---|---|---|---|
| First clear: light | day 5 | 15 | 38 | 87 | 180 | 319 |
| medium | day 1 | 2 | 4 | 12 | 25 | 47 |
| heavy | day 1 | 1 | 2 | 3 | 5 | 10 |

| | runs a year | clears | failed | best tiers | time inside | materials/h inside | on waves (plain) | coins/h inside |
|---|---|---|---|---|---|---|---|---|
| light | 255 | 144 | 44% | 13/7/12/12/8/9 | 87% | 664 | 809 | 117 |
| medium | 1,189 | 629 | 47% | 13/8/14/13/11/10 | 93% | 12.7 k | 10.9 k | 3.6 k |
| heavy | 2,736 | 1,323 | 52% | 17/5/17/15/12/10 | 94% | 44.4 T | 43.9 T | 6.8 T |

| | day | legendary owned per room, plain | with instances | kills/h plain | with instances |
|---|---|---|---|---|---|
| light | 30, 90, 365 | 3, 3, 4 | 4, 7, 11 | 11.2, 9.6, 12.8 | 4.7, 4.1, 3.9 |
| medium | 30, 90, 365 | 3/3, 5/3, 9/7 | 6/4, 8/7, 25/19 | 8.2, 9.4, 11.5 | 2.7, 3.2, 3.3 |
| heavy | 30, 90, 365 | 2/5/5, 8/11/10, 16/18/20 | 4/8/7, 13/17/14, 25/26/26 | 12.2, 13.6, 17.4 | 3.1, 3.3, 3.8 |

The policy also goes for the next rematch of a beaten boss (after any road instance not cleared yet,
before climbing tiers), and tries a lost one again once the world's level is a tenth higher:

| | rematches won | lost | best rematch, road order | first I won | first V | first X |
|---|---|---|---|---|---|---|
| light | 10 | 23 | 4/1/3/2/-/- | day 10 | - | - |
| medium | 50 | 85 | 8/3/7/6/3/4 | day 2 | day 53 | - |
| heavy | 79 | 267 | 8/3/8/8/6/5 | day 1 | day 11 | - |

- **Rematches are the long ladder.** Nobody reaches Rematch X in a year: the world's level opens the
  ladder quickly for a heavy user, but a rematch's fixed tier and tougher boss make each step above V
  a wall the party's own gear and relics must climb. The policy's best tiers and the tables above moved
  a little because rematch runs share the time inside; the balance targets that pass are unchanged.
- **The surest way to one boss's item, not a faucet.** A rematch makes the run's own odds at its
  boss's item larger by 15% a rematch, at most 3% (Rematch X at tier 21, where the plain run's
  chance stops at 1.2%). The first tuning, +2% a rematch up to 45%, was set against the old 10%
  base; against the retuned base (0.4% + 0.08% a tier) it gave the heavy world 21 boss items a
  year from runs. Now it gives 10, and the whole collection stays a goal of years.

The second region, with the same policy (a road instance not cleared yet comes first, so it pushes
into the Gloaming Isles as soon as each opens):

| | opens | lighthouse | labyrinth | warren | grove | leviathan | abbey | anvil | gate | cleared in the year |
|---|---|---|---|---|---|---|---|---|---|---|
| light | day 319 | - | - | - | - | - | - | - | - | 0 of 8 |
| medium | day 47 | day 82 | 121 | 166 | 185 | 222 | 262 | 310 | 340 | 8 of 8 |
| heavy | day 10 | day 17 | 24 | 33 | 38 | 46 | 54 | 64 | 73 | 8 of 8 |

- **A long-term goal.** A medium user reaches the second region in its third month and finishes it in
  the last weeks of the year; a light user completes the first road near the end of the year and,
  at World Lv 49, waits for the Saltreach Lighthouse's 60 in its second; a heavy one crosses it in two
  months. Its levels (60 to 176) were set against the simulator's world levels: a medium world is at
  62 on day 90 and 191 on day 365.
- **Collection.** With the second region's sixteen items (56 in all), a medium room owns 25 and 19
  after a year (17 and 9 with the first region alone), mostly the region's eight relics; a heavy one
  25 to 26 (22 to 25 before); a light one 11, as it never reaches the region in its first year. Its
  bosses never come on the waves, so a heavy user cannot collect their items before it gets there.

- **A light user gets there in the first week**: the Sunken Crypt opens at World Lv 5 and its first
  clear comes on day 5; the road is complete near the end of the first year (heavy: in two weeks).
- **A real trade, not strictly better.** An hour inside pays 88% (light) to 117% (medium) of the
  materials an hour on the waves pays, plus coins (the waves give none) and the rare rewards. The
  purse (16 plain kills a clear, +5% a tier) was set to that; at 8 kills an hour inside paid 73% for
  a light user, and with +15% a tier it paid 120% for a medium one. Kills per hour fall to about a
  third: instance monsters stand above the world, the elite and the boss are long fights, and the
  purse pays for the time instead of kills.
- **Failures** are 43 to 49% of runs because the policy climbs a tier after every clear until it
  fails, then steps back: it lives at the edge of what its party can do. A run that fails keeps what
  it found and costs two hours of working time on the waves before that room may try again.
- **Collection** is a goal of several years. With instances (and the weekly events and traits) a
  light room owns 11 of 56 legendary items after a year, a medium one 25 and 19, a heavy one 25 to 26
  (with the first region alone, of 40: 12, 17 and 9, and 22 to 25); before
  the events, 28 to 32 after two years for a heavy room (a one-off run with 730 days), while the
  first still comes on day 5. In a year the light world gains 3 from the waves' bosses, 6 instance
  relics (each instance's first clear), 2 from a run's boss and 1 from a vault; the heavy world 46,
  6, 13 and 6 (with the second region, medium 15, 14, 9 and 6, heavy 47, 14, 10 and 6). The
  simulator prints that split and checks the pace for 56 items (light 8 to 12, medium a mean of 14
  to 22 per room, heavy holding at most three fifths of the collection at a year, so not complete
  before about two years, the first item within three weeks): light 11.0, medium 22.0, heavy 25.7
  with its best room at 26 of 56, the first item on day 5.
  Before this tuning a light room owned 18 and a heavy one 31 to 33 in a year: the run's boss rolled
  at 10% + 1% a tier (at most 30%) with the waves' pity on top, which every miss raised by 5%, so a
  daily run soon made its item and every wave boss's item near certain; the vault rolled at 1% +
  0.25% a tier and could hold boss relics. Now a run's boss rolls at 0.4% + 0.08% a tier (at most
  1.2%, under a wave boss's 5%: a run meets its boss about once a working day, a light room meets a
  wave boss a few times a year) and leaves the waves' pity alone, and a vault holds only
  equipment (0.3% + 0.05% a tier, at most 1%), so a boss's own relic comes only from that boss.
  The first tuning, 36 items, also rolled for a city's relic in every clear; that roll is gone.
- **The caps.** The six relics' buffs are summed with the strongest relic of each type, all the
  legendary equipment, a whole bestiary and a whole settlement in the caps tests, and stay within
  every cap (the Tidewake Bell and the Fang reach theirs exactly). Boons and tier modifiers use types
  of their own, outside those sums.
