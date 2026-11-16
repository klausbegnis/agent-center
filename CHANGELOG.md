# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- A small star at the right of the header's title opens the project's GitHub repository: in the
  browser from Orca's panel and tab (Orca may ask once before opening the site), in a new tab
  from the external view. The title, the counters and the header's icon buttons now always keep
  one row, with the other controls wrapping below it.

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
