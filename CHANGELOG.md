# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## Unreleased

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
- Arsenal and Skills are built around original pixel icons for skills, materials, classes, item
  slots, group upgrades and stars; the character marks in the rooms use the same icons.
- The view state's game part adds the monster's `hp` and `maxHp`, `tickSeconds`, and names and
  levels on kill, drop and purchase events.
- `GAME=1 node scripts/demo.mjs` runs the game with made-up tokens and `GAME=estimated` through
  the estimate; `FREEZE=1` shows a fixed save.

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
