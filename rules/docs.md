---
description: Rules for documentation and screenshots, including what must never appear in them.
paths:
  - "**/*.md"
  - "docs/**"
---

# Documentation

## Privacy comes first

- No real project, repository, host, branch, person or conversation name in any doc,
  screenshot, test or example. Use the made-up set from `scripts/demo.mjs`: `rumble-banana`,
  `turbo-waffle`, `cosmic-llama`, `quantum-pickle`, `sneaky-pancake`, `fuzzy-anvil`, on the
  hosts `build-box` and `gpu-rig`.
- Screenshots are taken from the demo, never from a real Orca window.

## Keep docs true

- A change in behaviour updates the doc that describes it in the same pull request:
  `README.md` for what people see, `THEMES.md` for the theme format, `rules/` for how the code
  is written, `CHANGELOG.md` for what changed.
- Do not document what does not exist yet. "Planned" sections rot.
- State limits plainly in the README's "Known limits" rather than hiding them.

## Writing

- English, plain words, short sentences. Say what something does before how.
- Lead with what the reader came for. Put background after it.
- Commands go in fenced `bash` blocks, one command per block, with no prompt character.
- Refer to files and settings by their exact name in backticks.
- No emoji in headings.

## Screenshots

- They live in `docs/screenshots/` as PNG, named for what they show.
- Retake them when the UI they show changes. The commands are in `CONTRIBUTING.md`.
- Every image has alt text that says what is in it.
