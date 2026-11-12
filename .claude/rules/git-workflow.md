---
description: Branches, commits, pull requests and the rule about never restructuring a live checkout.
---

# Git workflow

This rule has no `paths`, so it always applies.

## Never restructure a checkout Orca has loaded

Orca runs a dev-loaded plugin straight from its folder and reloads it on change. Moving or
renaming files there passes through a state that does not load; Orca then marks the plugin as
errored and removes its panel.

- Do moves, renames, module splits and import-path changes in a separate git worktree:

```bash
git worktree add ../agent-center-work -b refactor/short-name
```

- Get `npm run verify` and the demo passing there, commit, and only then update the checkout
  Orca is running, in one step, followed by `orca plugin dev reload`.
- Small edits that leave every file loadable are fine in place.

## Branches

- `main` is always releasable. Nothing is committed to it directly.
- Branch names are `type/short-description` in kebab-case: `feat/pin-rooms`,
  `fix/duplicate-agents`, `theme/lighthouse`, `docs/contributing`.

## Commits

- Follow Conventional Commits: `type(scope): summary`.
  - Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `theme`, `chore`, `ci`.
  - Scopes: `worker`, `ui`, `themes`, `demo`, `rules`, `repo`. Leave it out when none fits.
- The summary is imperative, lower case, at most 72 characters, with no full stop:
  `fix(worker): keep agents whose terminal is still open`.
- The body says why, and what a reviewer should look at. Wrap at 72.
- A breaking change has `!` after the type and a `BREAKING CHANGE:` footer. Changing the theme
  format in a way that breaks existing themes, or asking for a new Orca capability, counts.
- One logical change per commit. Do not mix a refactor with a behaviour change.

## Pull requests

- Small enough to review in one sitting: aim for under 400 changed lines, not counting art and
  screenshots. Split larger work.
- Fill in the template: what changed, why, how it was checked, and screenshots for UI or theme
  changes.
- `npm run verify` passes before asking for review.
- Rebase on `main` instead of merging `main` in. Pull requests are squash-merged, so the pull
  request title must itself be a valid Conventional Commit.

## What never goes in a commit

- `node_modules/`, `.orca/`, editor folders, `.env` files, anything from a real Orca session.
- Real project, host or conversation names. See `rules/docs.md`.
