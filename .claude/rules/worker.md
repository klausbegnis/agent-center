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
