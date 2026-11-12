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
  network, who can read all of the above and change themes and hidden rooms. This is off by
  default and is a deliberate trade-off, not a bug. Do not turn it on on a network you do not
  trust.
- Whoever can reach that page can also keep it busy, for example by holding many connections
  open, so that it stops answering for a while. That is not treated as a vulnerability: it only
  affects the page, never Orca or the agents.
- It stores only its own preferences: the chosen themes and the hidden rooms.

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
- A website reading the local page or changing its settings, in either network setting.
- A crafted workspace, branch, host or conversation name causing script to run in the panel or
  the external view.
- The plugin exposing more of a prompt, message or tool input than described above.

## Supported versions

Only the latest release receives security fixes.
