---
description: Rules for the plugin worker: Orca events and hooks, host calls, the CLI, the local server.
paths:
  - "src/**"
---

# Worker

## Hooks must return at once

- `agent.tool.before` makes Claude Code wait for the plugin's answer. Handlers only update the
  store and return nothing. No `await`, no I/O, no host call before returning.
- The plugin observes. It never returns `{ deny }` and never rewrites a tool's input.

## Host calls

- Wrap every `orca.host.call`, `orca.storage` and `orca.panels.post` in `safe()`. A capability
  the user has not granted is a normal condition, not a crash.
- Posts to panels are limited to 200 per 10 seconds and 256 KiB each. Publish through the
  batcher in `src/worker.mjs`, never directly from an event handler.
- A worker restart drops everything in memory. Anything the person expects to find again goes
  through `src/preferences.mjs`.

## The Orca CLI

- `src/orca/cli.mjs` is the only module that runs the `orca` executable. It reads
  (`worktree ps`, `terminal list`, `environment list`) and does one thing more: `terminal
  switch`, which shows a terminal tab when the person clicks "Open workspace". It never sends
  input to a terminal, creates or closes one.
- Keep only the fields the room needs. Prompts, messages and tool inputs are never stored,
  logged or sent to the UI, apart from the first 60 characters of a prompt used as a label.
- Every call has a timeout. A host that does not answer is reported once in the log, not on
  every round.

## The local server

- It binds to `127.0.0.1` unless the person turned on the local-network setting.
- It serves files from `ui/` and `themes/` only. Keep the path check in
  `src/server/static-files.mjs` when adding a route.
- Request bodies are capped. New POST routes go in the `postRoutes` table and call the
  controller.
- There is no authentication. Do not add a route that changes anything outside the plugin's own
  preferences, and do not expose anything the panel does not already show.

## State

- All agent logic belongs in `src/domain/agent-store.mjs`, behind events (`status`,
  `toolBefore`, `toolAfter`) and the snapshot (`sync`). The worker never edits agents itself.
- A new tool name goes in `src/domain/activities.mjs` with a test.

## The game bridge

- `src/game-mode.mjs` is the only place that drives the engine. It gets every Orca call as a
  function (`readHistory`, `readWorkMeters`, `readSettings`, ...), so the demo and the tests run
  it without Orca. The rules it applies live in `src/domain/game-*.mjs` and
  `src/domain/work-meter.mjs`, with tests; `src/orca/session-history.mjs` is the only module
  that calls `agent.listSessions`.
- The game runs only when the `gameMode` setting is on; otherwise nothing of the game is read or
  stored beyond forgetting the baselines, and the view state's `game.status` says why.
- It reads real totals (`tokenSource: 'history'`) only when `agent.listSessions` is offered and
  `history:read` is granted. Otherwise it runs on the estimate (`'estimated'`), from the work
  meters the store keeps, and never calls the history. The estimate's numbers live in
  `src/game/constants.mjs`; never present an estimate as measured.
- A session or meter seen for the first time earns nothing, a total or meter that goes down
  earns nothing, and every award, estimated or real, is bounded (`src/domain/game-tokens.mjs`).
  Never pay out history. A change of source forgets the baselines, so nothing is counted twice.
- The work meters start again with the worker and are never saved: the time the worker was down
  earns nothing on the estimate. The hooks only bump a counter; that keeps them instant.
- Keep from a session only what `docs/GAME.md` lists: id, token total, workspace, creation time,
  whether it runs, and its title, which reaches the save only through the engine and only while
  `gameKeepTitles` is on.
- The save goes through `src/game-save.mjs` alone: one storage key, loaded once, written after a
  change and on `deactivate`, never over a save from a newer version or one that could not be
  read, and never larger than Orca keeps under a key.
- A game action is validated twice: the controller checks the kind of each value, the game
  checks that every id names something that exists. Unknown ids are refused, never stored.
