# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- Game mode: traits. Every character is born with a trait, a small named perk rolled from its
  session, and earns more trait slots at levels 10, 20 and 30. Trait scrolls drop now and then from
  elites, champions and bosses, sit in the room's chest (the Chest tab's Trait scrolls card, which
  sends them to another room), teach their trait into a free slot from the Party tab, and trade at
  each open city's Trait broker in the Market tab, which also takes a trait back as a scroll in a
  swap for a fee. 48 traits in four tiers, a few of them double-edged; the world keeps a collection.
  Old saves keep everything and get every character's trait at once. A scroll found is told in its
  room and kept in the journal's highlights, and a Traits group of seven achievements follows the
  collection.

## 0.3.0 - 2026-11-17

### Changed

- Game mode: the room picker above the tabs is now a row of room chips, so switching rooms is one
  click and every room is in sight. A chip shows the room's name (cut when long; the whole name
  and host are its tooltip), its host when it is a paired machine, how many characters it has, a
  dot while its party fights and a triangle when one of its items can be upgraded now. The row
  never wraps, so the tabs under it never move: it scrolls sideways (wheel, trackpad or the
  arrows at its ends) and keeps the picked room in view, and from eight rooms a **More…** list
  reaches any of them. It is a radio group: Left and Right, Home and End move along it, and `[`
  and `]` pick the room before or after from anywhere in the game except while typing. The saved
  room, `?room=` and the older `arsenalRoom` preference still choose the room.

- Game mode's tabs are now Rooms, Party, Chest, Camp, Skills, Market and Bestiary: the Arsenal tab and
  its Items, Party and Camp row are gone, Items is called Chest. Above the tabs, on every tab,
  are the room picker with its world and level and one strip with the world's coins and
  materials, which no longer move when another tab opens. The picker chooses the room of Party
  and Chest and the world of Camp, Skills and Market; on Rooms it can show one room only, or all
  of them (the default). Each tab has a small pixel icon; in a narrow panel only the icons show,
  with the name as the tooltip. A saved Arsenal tab and links with `?tab=arsenal` (and
  `section=items|party|camp`) open the tab they became.

### Added

- Game mode: **instances**, a road of six dungeons a room can be sent into (the Sunken Crypt,
  Emberdeep Foundry, the Hollow Hive, Frostwatch Keep, the Drowned Library and Wyrmrest Spire),
  each with its races, a boss and an elite from the roster, original pixel-art banners and a
  roadmap. They open one after another with the world's level. A run plays with the room's
  working time through six rooms (entrance, hall, trap or puzzle, elite, vault with a choice of
  two boons, boss) while the room's wave waits; failing ends the run softly, with a cooldown. The
  first clear gives a signature relic (six new relics), every clear a purse and a better chance at
  the boss's own item, and repeat runs climb endless tiers with a rotating modifier. The Bestiary
  tab is now **World**, with Creatures, Bosses and the **Roadmap**; old links and saved tabs open
  it. A room inside an instance shows its banner as its backdrop and the instance on its band.
  New local-only routes `/api/game/enter-instance`, `/choose-boon` and `/recall-party`.
- Game settings: **Rebalance work skills** shares a world's work-skill experience again by its
  mix, keeping the world level, for worlds that grew lopsided under the old attribution. It asks
  first and shows each skill's level before and after; it is never done on its own.
- The Skills tab says under the work skills where their split comes from: the agents' tools, or
  an estimated mix when tools are not visible for some agents.
- Game mode: the Camp tab is now the world's settlement, which grows like a base in a strategy
  game. The campfire, the workbench and the rune circle are its Hearth, Workshop and Sanctum, with
  the same effects, prices and save; two new buildings join them: the **Storehouse** (opens at the
  Outpost; lowers the market's fee, never below 6%) and the **Defences** (opens at the Hamlet;
  monsters drain a little less stamina). Every building grows through three tiers with its own
  pixel-art sprite, and the total of all building levels takes the settlement through seven
  stages (Camp, Outpost, Hamlet, Village, Town, Stronghold, Citadel), each with its own picture,
  shown across the top of the tab with the way to the next stage, and a small bonus for the whole
  world (a few percent in all at the Citadel). A new tier or stage is celebrated over the world's
  rooms. From a building's second tier, half of its price can be paid in coins at the materials'
  base value; the price in materials alone always stays, and auto-spend never spends coins. Past
  the Citadel, renovation stars keep counting. A badge with the stage sits above the tabs. Saves
  from before load unchanged; `SETTLEMENT=n` shows stage n in the demo.

- Game mode: each character card on the Party tab shows its agent's sprite, the same one its room
  draws (the room's theme, its scene while it travels, and the agent's own outfit and tint),
  standing idle, so a card is easy to match with its figure. A click on it opens the Rooms tab
  with that agent selected and its card open. An agent not on screen (its room hidden) shows an
  empty frame that says why.
- Game mode: send an item or a relic to another room of the same world. In the Chest tab, every
  item's detail has **Send to [room]**, always shown, and disabled with the reason when it cannot
  be used (no other room plays in the world yet, the page only watches, every other room owns that
  legendary item). An item a character holds can go too: the page asks once ("Search filters will
  take the next best weapon"), and that slot goes back to Auto and takes the best free item at once,
  which the message names. **Move items** on the chest's lid picks several slots (click or Space,
  Escape to leave) and sends them together; a slot can also be dragged onto a room's chip. The
  chest's hint says sending exists. The item leaves this chest and arrives in that one, whose copies
  limit works as when a chest left behind is moved (the lowest copy past it is salvaged into the
  world's materials, and the message says so). Legendary equipment is never salvaged or doubled:
  a room that owns it already is refused. The Relics card sends any relic but the active one, and
  its row is always shown, with the reason when it cannot be used. New
  local-only routes `/api/game/send-item` and `/api/game/send-relic` (panel requests
  `game.sendItem`, `game.sendRelic`; `send-item` takes `itemIds` and `confirmHeld`); a page opened
  from another machine does not offer them and says so.
  `npm run simulate` now also plays a player who funnels every spare piece into one room: it buys
  nothing, so sending stays free.
- Game mode: a **Bestiary** tab, the seventh. Each world counts the creatures it kills: every
  race by rank, every named boss beaten (and how often as legendary), the rooms' own themed
  monsters as "others", and the day of each first kill. A race or boss never killed shows as a
  silhouette and "???". A kill is worth points by its rank (plain 1 up to legendary 60), and
  points raise a race's mastery on a long ladder: the first level comes with its first couple of
  kills, new ones every hour or so at first, then every few days. Its first 25 levels each add
  0.2% damage against that race, with its small themed perk every fifth (slimes: a little more
  materials from kills; goblins: a little more item drops; and so on); past them it goes on for
  ever as prestige titles ("Goblin-bane II") that add no power. A world-wide hunter rank, from
  every point, gives a little more materials from kills, never over 2%; beating 1, 5, 15, 30 and
  all 55 different bosses levels a boss hunter track with a little damage against bosses and
  faster legendary pity. Every bonus is data in `game/bestiary.json`, an effect of the set
  legendary loot uses, summed with the relic and the equipment under the same caps; the damage
  cap is now 0.15. A first kill, a new level, a title and a new rank are celebrated in the room.
  The counters are kept in the save and in save files; a world reset clears them. A world that
  played before its bestiary counted gets its rooms' earlier kills once, spread over the races as
  plain kills (never bosses), so it does not start from nothing.
- Choose what a character holds. On the Party tab each of a character's three slots opens, in
  place, the room's chest items that fit it, best first, with what each changes and whether it
  is free or a swap with the character holding it (refused, with the reason, when that one
  could not use what it gets back). A slot chosen by hand, item or nothing, keeps that choice
  until it is set back to Auto; **Best gear for everyone here** re-picks every other slot and
  says how many changed. The choices are kept in the save and in save files; older saves load
  with none. New game routes `/api/game/equip` and `/api/game/best-gear` (panel requests
  `game.equip` and `game.bestGear`) answer this computer only; a page that only watches shows
  the slots without the picker.
- Game mode's **Market** tab: each world has coins and five cities (Goldmill, Deepforge,
  Brinehaven, Tallwood, Runespire) that open as the world level grows. Sell materials for
  coins, trade one material for another a city produces, and buy gear at a city's stall, one
  tier above what monsters drop, new every game day. Prices move with what is sold and bought
  and recover over game time; a fee on every trade keeps any loop of trades from making money.
  Coins and prices are kept in the save and in exported files; files exported before still
  import. Nothing is traded by itself, and auto-spend does not trade. Amounts are chosen with a
  slider (and a number box beside it), the trade reads "You give" → "You get" with what the
  amount brings and at what rate, and every button states the deal: "Sell 300 for 708 coins",
  "Trade 555 Bars for 260 Crops".
- Generic gear at every tier from 1 to 10 in every slot. Drops used to stay at tier 1 until
  monsters reached level 32, as there was no tier 2.
- A small star at the right of the header's title opens the project's GitHub repository: in the
  browser from Orca's panel and tab (Orca may ask once before opening the site), in a new tab
  from the external view. The title, the counters and the header's icon buttons now always keep
  one row, with the other controls wrapping below it.
- Choose what idle characters gather. The Party tab has a trade picker on each
  character and one for the whole room ("Everyone here gathers"); a character's own choice wins
  over the room's, and the room's over Auto, the trade the game picks, which stays the default.
  The choices are kept in the save and in save files, a session that comes back from retirement
  keeps its own, and older saves load with Auto everywhere. New game routes
  `/api/game/character-trade` and `/api/game/room-trade` (panel requests `game.characterTrade`
  and `game.roomTrade`) answer this computer only; a page that only watches shows the trades
  without the pickers.
- Game mode: legendary loot. 34 items with their own pixel art: ten relics, twelve relics owned
  by a named boss, and twelve pieces of legendary equipment. A room owns relics and makes one
  active for its whole party (the Chest tab's Relics card, or `/api/game/active-relic`);
  legendary equipment sits in the chest and helps the character that holds it. Bosses drop them
  by hash like every other drop, a room's first relic and first boss-owned item are certain, and
  bad luck is bounded by pity. Every buff is data in `game/legendary.json` and its text is
  derived from it. Saves from before load unchanged; exported saves carry the loot.
- Game mode: a city's stall sells one of that city's two relics now and then (one day in four),
  the one the room in "Goes to" lacks, at a steep price in coins that grows with the world. It is
  bought through the stall's usual Buy (`/api/game/buy-offer` with the offer after the gear);
  boss relics are never sold.
- Game mode: choosing equipment knows legendary items. Auto, "Best gear for everyone" and the
  Party tab's picker follow the same rule as a new character: a legendary item goes only to the
  class (or, for a tool, the trade) it is made for, and the picker shows its buff and says who it
  is made for.

### Fixed

- Subagents that Orca's snapshot lists on their agent (`subagents`, in newer Orca releases) now
  show as familiars in the room, and their agent counts as delegating for game mode, even when no
  tool hook arrives. A subagent a hook already shows, or one also listed as a child entry, is not
  shown twice.
- Game mode on the estimate: the five work skills now grow in sensible proportions. Before, a
  round's tokens all went to the one activity the agent showed at that moment, so agents whose
  tools the plugin cannot see (sessions Orca stopped tracking after a restart, agents on paired
  machines) trained Arcana alone, and Command grew only if a round came while a subagent call
  was open. Now the working time is shared by the tool calls around it (a quarter for thinking),
  each tool call counts for its own skill, half the time of an agent with working subagents counts
  as delegating, and time no tool explains follows the mix the world's agents were seen using, or
  a default mix for coding work before any was seen. The total estimated per working minute is
  unchanged: only the split between skills moved. See docs/GAME.md, "The estimate".

## 0.2.0 - 2026-11-16

### Added

- Game mode, off by default (the **Game mode** setting): the tokens sessions on this computer
  spend become levels, fights, materials and upgrades for each room's party, with progress kept
  per world across restarts. **Game mode: keep conversation titles** keeps a finished session's
  title on its retired character.
- On Orca releases without session token totals (every release so far), game mode runs on an
  estimate: progress comes from each agent's working time and tool calls, not from measured
  tokens, and each agent is one character while its terminal is open. Agents on paired machines
  are characters too, and their rooms join the game: their work is estimated from the paired
  machine's snapshots (working time and the tool named, no tool calls), and a machine that
  cannot be reached earns nothing meanwhile. No new permission is asked for. The game uses real totals from Orca's Agent Session History by
  itself once Orca provides them and the `history:read` permission is granted; this release
  does not ask for that permission yet. The view state's `game.tokenSource` says which.
- The view state carries a `game` part for a UI to draw (see `docs/GAME.md`), and the panel and
  the local page take the game's actions.
- The monster stands in the room with the characters, at a theme's optional `monster` station
  or at a free spot the engine picks, with its own health bar; an elite glows and wears its
  affix, a boss is larger. Working characters fight it, each class in its own way, in a rhythm
  taken from the fight's tick; nothing moves under reduced motion.
- The game settings have a **Save file** card: **Export** downloads the saved game as
  `agent-center-save-YYYY-MM-DD.json` and shows it as text to copy (a download may be blocked in
  Orca's panel); **Import** takes a chosen or pasted file and, after a confirmation, replaces the
  whole game with it. Token counts are not in the file: after an import, counting starts again.
- **New scene after each monster**, a game setting off by default: every room that plays and
  has no theme of its own moves to another theme each time its monster dies, as if its party
  travelled on. Each room walks through every theme before repeating one, in an order of its
  own, so the panel, the tab and the external view agree and a restart keeps the scene. The
  monsters come from the scene the room is in, under Random too. The old scene fades into the
  new one while the party walks in; under reduced motion the change is immediate. The setting
  is kept with the save and in an exported save file. Each room now counts all its kills
  (`kills` in the save and the view state); older saves start the count at 0. The demo shows it
  with `TRAVEL=1`.
- A room that is no longer on screen (its folder moved or its worktree removed) keeps its chest
  and retirees in the save. The Arsenal's Items section lists them under **Chests left behind**,
  and **Move here** moves them into the room chosen there, in the same world, after asking;
  copies of an item past what a chest keeps are salvaged into materials.
- While the game runs, the selected agent's card also shows its character: class and level with
  the progress to the next one, its seven attributes, its equipment with upgrade levels, and the
  trade it gathers while its agent is done. A guest's card says it keeps no progress; over a
  small Gallery cell the card keeps only the class and level.
- Arsenal and Skills are built around original pixel icons for skills, materials, classes, item
  slots, group upgrades and stars; the character marks in the rooms use the same icons.
- The view state's game part adds the monster's `hp` and `maxHp`, `tickSeconds`, and names and
  levels on kill, drop and purchase events.
- Monsters climb a rank ladder: normal, veteran, elite, champion, boss and legendary (a boss
  with an affix). Rarer ranks have more health and pay more per minute; the odds and factors are
  in `MONSTER_RANKS` and keep kills and rewards per hour where they were. Kill events and the
  view state's monster carry the `rank`; monsters saved before keep working. In a room each rank
  reads by its glow (a faint outline, a pulsing halo in the affix's colour, a double outline, a
  red aura, a turning ring of light) and its word over the health bar; the glows stay still
  under reduced motion.
- Monsters come from 20 races (orc, goblin, troll, ogre, human, skeleton, zombie, vampire,
  werewolf, demon, lizard, minotaur, dragon, giant spider, giant insect, slime, elemental, golem,
  ghost, tree warden), each in thousands of looks put together from parts, outfits, gear and
  colours, with a name that says what is drawn ("Bog Troll Brute"). Boss waves bring a fixed
  roster of 55 named bosses ("Morvash, the Bog Tyrant") that a project meets one by one. The
  hand-made monsters of the shipped themes still turn up in their rooms. Looks and names only:
  health, reward and loot are as before.
- The demo serves a monster contact sheet (`/monsters.html` on the next port) for reviewing
  the monster art.
- `GAME=1 node scripts/demo.mjs` runs the game with made-up tokens and `GAME=estimated` through
  the estimate; `FREEZE=1` shows a fixed save.

### Changed

- The listing name is now **Agent Center: Tavern & Auto-Battler**. The panel, the tab, the
  status bar item and the commands keep the name **Agent Center**, and the plugin's id
  (`agent-center`) does not change.
- The listing has a new description, saying the plugin can be watched or played as an idle
  auto-battler, a new cover (the game-mode gallery) and two new screenshots: game mode on
  Gothic Dungeon and the roster of named bosses.
- The README is rewritten around the two ways to use the plugin: watching the rooms, or
  turning on game mode.

### Security

- With **Open to the local network** on, a page opened from another machine can watch the game
  but not play it: the server refuses every game route (spending, prestige, worlds, reset,
  auto-spend, travel, keeping titles, export and import) to a connection that does not come
  from this machine, and that page gets the game without session ids or retirees' titles and
  shows **View only**. `LAN=1` opens the demo to the network to try it.
- An imported save file is checked as strictly as the actions check what they are given: it is
  refused with more than eight worlds, with a world id the game would not create, with a
  project kept in another world than its own, or with `__proto__`, `constructor` or `prototype`
  as an id. Its titles and monster names are cleaned like live titles (no control or bidi
  characters, at most 80 characters).
- The game's **Save file** card, the README and SECURITY.md say that an exported save is
  private (folder paths, paired machines' names, session ids, and kept titles) and must not be
  attached to a public bug report; so does the bug report form.
- The session history is read only when Orca says the `history:read` permission was granted;
  an Orca that does not say what was granted counts as not granting it. The **Game mode**
  setting no longer promises real token totals, which this version cannot read.

## 0.1.0 - 2026-11-12

First public version.

### Added

- One room per project, on this machine and on paired ones, where each agent is a character
  that goes to the station of what it is doing: writing, reading, running a command, thinking,
  delegating, waiting for you, blocked or done.
- A finished agent that you have not looked at yet (Orca's bell) stays up with a "✓" and keeps
  playing its theme's finishing emotes; it goes to sleep once seen.
- Subagents as familiars: small companions drawn by the room's theme that stay at their agent's
  side, each with an icon for what it is doing.
- Emotes: now and then a character plays a short move that fits its activity and its theme.
  They stop under reduced motion and while the page is hidden.
- Three themes: Pixel Dark, Guild Hall and Gothic Dungeon. Each room can pick its own, and a
  **Random** default gives every room that has not picked one a different theme.
- A theme template in `themes/_template`, a quick start in `THEMES.md`, and `npm run check`,
  which holds every theme and the template to the same contract.
- List and Gallery views, pinning a room in Gallery view, and hiding rooms.
- Sessions that were running when Orca restarted, which Orca stops listing, are still shown:
  recognised by their terminal title, as working or done.
- "Open workspace" on an agent's card, which shows the terminal tab the agent runs in.
- A sidebar panel, an editor tab, a status bar summary, and an external view for a detached
  window, fullscreen on another screen or a small always-on-top window.
- Project rules under `rules/`, contributing and maintaining guides, issue and pull request
  templates, and CI on Node 22, 24 and 26, on Linux, macOS and Windows.
