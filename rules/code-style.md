---
description: How JavaScript in this repository is written: naming, functions, comments, errors.
paths:
  - "**/*.mjs"
  - "**/*.js"
---

# Code style

## Formatting

- Two spaces, single quotes, no semicolons, lines up to 110 characters. `.editorconfig` sets the
  basics; match the file you are in for the rest.
- English everywhere: identifiers, comments, UI text, test names, commit messages.

## Names

- Say what a thing is, in full words: `selectedAgentId`, not `sel` or `id2`.
- Functions are verbs (`groupRooms`, `placeActor`); factories start with `create`
  (`createAgentStore`); booleans read as a question (`isPinned`, `hasData`).
- No abbreviations that are not already common in the domain. `ws`, `cfg`, `tmp` are out.
- A number with a meaning gets a name and a comment saying why that value:

```js
/** Posts to panels are rate limited (200 per 10 s), so changes go out in bursts. */
const PUBLISH_DELAY_MS = 250
```

## Functions

- One job per function. If you need "and" to describe it, split it.
- Aim for functions that fit on a screen. A long function with section comments is several
  functions.
- Pass what a function needs; do not reach for module-level state. Modules that keep state
  expose a `create…` factory and return a small object.
- Return early instead of nesting.

## Comments

- Comment why, not what. The code already says what.
- Every module starts with one or two lines saying what it is for.
- Exported functions with non-obvious inputs get a JSDoc block with types. There is no type
  checker, so these are the only types a reader gets.
- Delete commented-out code. Git remembers it.

## Errors

- A failed host call must not take the worker down: wrap it with `safe()` and pick a fallback.
- Never swallow an error silently. Log it once with a label that says what was being done, or
  rethrow.
- Validate at the edges (HTTP bodies, panel requests, files from disk), then trust the data
  inside.

## Modules

- Named exports only, except the worker's `activate`, which Orca requires as the default export.
- Imports at the top, sorted by path. Node built-ins use the `node:` prefix.
- A file over about 250 lines is a hint that it holds two things.
