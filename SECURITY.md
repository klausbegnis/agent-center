# Security

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Use GitHub's private vulnerability reporting on this repository: open the **Security** tab and
choose **Report a vulnerability**. Only the maintainers see the report.

If that form is not there, open an issue titled "Security contact wanted" that says nothing
about the problem itself. A maintainer will answer with a private way to send the details.

Include what you found, how to reproduce it, and what an attacker could do with it. You will
get a first answer within a week. Please give us a reasonable time to fix it before disclosing.

## What the plugin can do

Knowing this helps judge whether something is a vulnerability.

- It runs its own code in Orca's plugin worker, with the access of the user's account.
- It reads workspace and agent information from Orca, including through the `orca` CLI
  commands `worktree ps`, `terminal list` (titles and the time of the last output, never the
  output itself) and `environment list`. When you click "Open
  workspace" it also runs `terminal switch`, which only changes the tab shown in Orca.
- It serves a local page on `127.0.0.1` (port 47600 by default, or the next free port) with no
  login. Any program and any user account on this machine can read it and change its settings. It
  shows, for every open workspace and agent:
  - project and folder names, and the full path of each project folder (it is part of a room's
    id);
  - host names of paired machines, branch names, Orca's workspace and terminal pane ids;
  - conversation titles, what each agent is doing (the kind of tool, not what it was given or
    what it returned), and how its last turn ended;
  - the name of each subagent: its type, or else the first 40 characters of the task
    description its agent wrote for it;
  - for an agent with no conversation title, the first 60 characters of its last prompt. That
    is the usual case on paired machines and can happen on this one;
  - for an agent session Orca has lost track of (one still running after Orca restarted), the
    title of its terminal. Any program can set its terminal's title, so this name is only a
    label.

  Every name and title is shown as text, with control and bidi characters removed, and is at
  most 80 characters long.
- A website cannot read that page or change its settings: the server only answers requests
  whose `Host` is this machine, and refuses requests to its API that come from another origin.
  A website can still send a request to the port; it gets a refusal, or a file of the plugin's
  own UI that the browser will not let it read.
- With **Open to the local network** turned on, that page is reachable by anyone on the same
  network, who can read all of the above and change themes and hidden rooms. In game mode they
  can watch the game but not play it: the server refuses every game route to a connection that
  does not come from this machine's loopback address (see "Game mode" below). This is off by
  default and is a deliberate trade-off, not a bug. Do not turn it on on a network you do not
  trust.
- Whoever can reach that page can also keep it busy, for example by holding many connections
  open, so that it stops answering for a while. That is not treated as a vulnerability: it only
  affects the page, never Orca or the agents.
- It stores its own preferences (the chosen themes and the hidden rooms) and, with game mode
  on, the game's save. See below.

## Game mode

Game mode is off by default. It asks for no permission of its own.

- **On Orca releases without session token totals** (every release today), progress is
  estimated, not measured: from how long each agent works and how many tool calls it starts,
  which the plugin already sees through the events and hooks above, and for agents on paired
  machines from the state and tool name the snapshot of that machine already gives. The tool
  name is used only to count the call and pick its activity; its input and result are never
  read. Nothing new is read from Orca, and the session history is never called.
- **Once Orca provides them**, and only when Orca offers the Agent Session History to plugins
  and you granted the session history permission (`history:read`), the game uses the real
  totals: the worker calls `agent.listSessions` every 30 seconds. It makes that call only when
  Orca lists the permission among those granted; an Orca that does not say counts as not
  granting it. This version of the plugin does not ask for that permission, so the call is
  never made.

The rest of this section is about what happens once real totals are read, except where it says
otherwise.

- **What it reads:** for the 200 newest sessions, each session's id, token total, workspace id,
  creation time, whether it runs, and its title. It never reads a conversation; Orca does not
  give one. Titles can be the start of a session's first message.
- **What the permission covers:** every agent session in Orca's history on this computer, not
  only the projects shown. The game counts only sessions whose workspace is a room on screen,
  and none in a room you put out of the game (a project with no world); it still reads them.
- **What it stores**, in the plugin's own storage under the key `game`: the game's progress
  (worlds, rooms by their id, which contains the project's folder path, characters by session
  id), and per session its id, its last token total and when it was read. On the estimate a
  character's id is `estimated:` followed by Orca's pane id for the agent's terminal, with the
  paired machine's name in front of the pane id (`estimated:build-box/…`) for an agent on a
  paired machine, so the save holds the names of paired machines whose agents played. No
  per-session totals are stored; the working time and tool call counts stay in memory. Titles are stored
  only while **Game mode: keep conversation titles** is on, on the characters of finished
  sessions; turning that setting off deletes them.
- **What it shows:** the view state, served on the local page like everything else, gains the
  game: where its tokens come from, session ids of the characters on screen, levels, the room's
  fight, and the stored titles when kept. A page opened from another machine (with **Open to the
  local network** on) gets the same game with every session id replaced by an alias that cannot
  be turned back into it, and without the retirees' titles.
- **What the local page's API can do with it**, from this machine only. With **Open to the
  local network** on, a request whose connection does not come from a loopback address is
  refused for every one of these routes, before anything is read or changed:

  | Route | What it does |
  |---|---|
  | `/api/game/prestige` | prestiges a skill (cannot be undone) |
  | `/api/game/upgrade-item` | spends materials on an item |
  | `/api/game/buy-upgrade` | spends materials on a group upgrade |
  | `/api/game/assign-room` | moves a room to another world, a new one, or out of the game |
  | `/api/game/reset-world` | starts a world over (cannot be undone) |
  | `/api/game/auto-spend` | turns auto-spend on or off |
  | `/api/game/travel` | turns "new scene after each monster" on or off |
  | `/api/game/character-trade` | sets what one character gathers while idle |
  | `/api/game/room-trade` | sets what a room's characters gather while idle |
  | `/api/game/keep-titles` | turns keeping conversation titles on or off |
  | `/api/game/export-save` | answers the whole save file (see "The save file" below) |
  | `/api/game/import-save` | replaces the whole game with a file (cannot be undone) |
  | `/api/game/move-orphan-items` | moves a room left behind's chest and retirees into another room |

  Any program or user account on this machine can still use them, like the other settings.

### The save file

**Export** gives the whole save as a file, and that file is private: it holds the full folder
path of every project that played, the names of paired machines whose agents played (in their
characters' ids), session ids and, when **Game mode: keep conversation titles** is on, the
titles of finished conversations. Keep it like any other private file, and do not attach it to
a public issue or bug report. **Import** checks a file part by part before it replaces the
game, and cleans its titles and monster names like the labels above.

It does not send anything to the internet, does not type into terminals, does not start
agents, and does not block or rewrite tool calls.

## Themes are code

A theme's sprite sheet is inserted into the page as markup. The plugin keeps only plain drawing
from it first (an allowlist of SVG elements and attributes, with links only inside the sheet),
`npm run check` refuses a theme that has anything else, and the external view adds a content
security policy. None of that is a promise that a hostile theme can do nothing. Themes are trusted like the
plugin's own code: the ones in this repository are reviewed, and installing someone else's
theme is installing their code. A theme doing something harmful is a problem with that theme,
not a vulnerability in the plugin.

## In scope

- Reading files outside `ui/` and `themes/` through the local server.
- The local page being reachable from another machine while the network setting is off.
- A page on another machine playing the game, reading the save, or reading session ids or kept
  titles, while the network setting is on.
- A website reading the local page or changing its settings, in either network setting.
- A crafted workspace, branch, host or conversation name causing script to run in the panel or
  the external view.
- The plugin exposing more of a prompt, message or tool input than described above.

## Supported versions

Only the latest release receives security fixes.
