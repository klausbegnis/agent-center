# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## Unreleased

Everything below is the first public version. It becomes 0.1.0, with its date, when the first
release is cut.

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
