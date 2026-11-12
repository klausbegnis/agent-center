# Agent Center

An Orca plugin: one room per project, where each agent is a character acting out what it is
doing. Plain JavaScript, no build step, no runtime dependencies.

## Commands

- `npm run verify` runs the static checks and the tests. Run it before saying a change is done.
- `npm test` runs the unit tests only.
- `npm run check` checks that every module parses, the manifest is consistent and every theme
  follows the theme contract.
- `npm run demo` serves the UI with made-up agents at `http://127.0.0.1:47700/`. Use it to look
  at any UI or theme change.

## Layout

- `src/` is the worker (Node). `src/worker.mjs` only wires parts together.
- `ui/` is the scene engine (browser). `ui/engine/stage.js` only coordinates.
- `themes/<id>/` is one theme: `theme.json`, a scenery and a sprite sheet.
- `rules/` holds the project rules. Each file's frontmatter lists the paths it applies to.
  Claude Code loads the matching rule by itself. With any other tool, open `rules/README.md`,
  find the rules for the files you are about to change and read them first.
- This file is the one set of instructions for every coding agent. `CLAUDE.md` only imports
  it. `.claude/rules/` is a copy of `rules/` that Claude Code reads: edit `rules/` and run
  `npm run sync-rules`.

## Never

- Never move, rename or half-rewrite files in a checkout that Orca has loaded with
  `orca plugin dev load`. Do structural work in a separate git worktree and switch over once
  `npm run verify` passes. See `rules/git-workflow.md`.
- Never put a real project, host, branch or conversation name in a screenshot, test, fixture or
  doc. Use the made-up names from `scripts/demo.mjs`.
- Never add a runtime dependency or a build step. See `rules/architecture.md`.
