<!-- The title becomes the commit on main. Make it a Conventional Commit:
     fix(worker): keep agents whose terminal is still open -->

## What changed

<!-- One or two sentences. -->

## Why

<!-- The problem this solves. Link the issue: Closes #123 -->

## How it was checked

- [ ] `npm run verify` passes
- [ ] Looked at it in the demo (`npm run demo`): List, Gallery, a pinned room, a narrow window
- [ ] Tried it in Orca (say which version), or explain why that was not needed

<!-- What did you look at, and what did you not get to? -->

## Screenshots

<!-- Required for UI and theme changes. Take them from the demo so no real names appear. -->

## Checklist

- [ ] One change only; unrelated cleanups are in their own pull request
- [ ] Tests added or updated for behaviour in `src/domain/` or the computing modules in `ui/engine/`
- [ ] Docs made untrue by this change are updated (`README.md`, `THEMES.md`, `rules/`)
- [ ] A line added to `CHANGELOG.md` under "Unreleased"
- [ ] No real project, host, branch or conversation name in code, tests, docs or images
- [ ] New art is my own, or its licence allows redistribution and is stated below
- [ ] If the engine reads something new from a theme: `scripts/theme-contract.mjs`,
      `themes/_template` and `THEMES.md` are updated
- [ ] No new Orca capability, manifest command or theme-format break — or it is called out below

## Notes for the reviewer

<!-- Anything risky, anything you are unsure about, breaking changes, art licences. -->
