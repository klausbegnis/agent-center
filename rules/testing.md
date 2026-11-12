---
description: What must be tested, how tests are written, and how to check what tests cannot.
paths:
  - "**/*.test.mjs"
  - "**/*.test.js"
  - "src/domain/**"
  - "ui/engine/**"
  - "scripts/check.mjs"
  - "scripts/theme-contract.mjs"
---

# Testing

## What needs a test

- Every module in `src/domain/` and every computing module in `ui/engine/` (`hash`, `variants`,
  `room-themes`, `stations`, `gallery`, `familiars`, `emotes`, `labels`). A change to their
  behaviour comes with a test that fails without it.
- A bug fix starts with a test that reproduces the bug.
- Modules that only do I/O or draw to the DOM are checked by hand in the demo and in Orca; say
  in the pull request what you looked at.

## How tests are written

- `node:test` and `node:assert/strict`. No test framework, no mocks library.
- A test file sits next to the module it covers: `rooms.mjs` and `rooms.test.mjs`.
- Test names are full sentences that state the behaviour: "a folder whose name merely starts
  the same is a different room".
- One behaviour per test. Build inputs inline or with a small local helper; do not share
  mutable fixtures between tests.
- Tests are deterministic: pass a clock (`now`) instead of reading the time, and never sleep.
- Assert on outcomes a user would notice, not on private structure.
- Fixtures use made-up names (`storefront`, `build-box`). Never a real project or host.

## Running

- `npm test` runs everything. `node --test path/to/file.test.mjs` runs one file.
- `npm run check` is not a test run: it checks that modules parse, the manifest is consistent
  and themes follow the contract. Extend it when you add a rule a machine can check.
- `npm run verify` runs both. It is what CI runs and what must pass before a merge.
