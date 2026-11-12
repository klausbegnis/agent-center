---
description: Rules for the scene engine and the three surfaces it runs in.
paths:
  - "ui/**"
---

# UI

## One engine, three surfaces

- `ui/engine/` draws the same thing in the Orca panel, the editor tab and the external view.
  What differs between them lives in a transport, built in `ui/boot/`.
- A feature that needs something from the plugin adds an optional method to the transport. The
  engine checks for it (`if (transport.setRoomHidden)`) and hides the control when it is absent.

## The engine knows no theme

- Never mention a theme id, a symbol id or a colour of a specific theme in `ui/engine/`.
  Everything theme-specific comes from `theme.json`.
- A new thing themes can customise is a new optional key in `theme.json` with a default that
  keeps existing themes unchanged. In the same pull request, list it in `THEME_FIELDS` in
  `scripts/theme-contract.mjs`, use it in `themes/_template` and document it in `THEMES.md`.
  See "Changing the contract" in `rules/themes.md`.

## Drawing

- Build DOM with the helpers in `dom.js` and set text with `textContent`. The only markup the
  engine parses is a theme's own sprite sheet, in `theme-library.js`, which keeps only what the
  allowlist in `sprite-markup.js` names, and the `<use>` elements
  built from its symbol ids in `actor-view.js`.
- Update what exists instead of rebuilding: characters keep their element so they can walk
  between stations.
- All wording lives in `labels.js`. All sizes and thresholds are named constants.

## Looks are derived, not stored

- A room's colour and an agent's outfit come from a hash of their id (`variants.js`). Do not
  store them and do not use `Math.random()`: the same room must look the same after a reload.
- The same goes for anything that happens now and then. Which emote a character plays, and
  when, comes from a hash of its id and the time it is given (`emotes.js`), so it can be tested.

## Motion

- Movement is CSS in `stage.css`: transforms and opacity only, played once or looped by the
  browser. The engine switches it on and off with a class; it never animates frame by frame.
- One clock in `stage.js` serves every character. Do not start a timer per character or per
  room.
- An emote moves the sprite, never the character's button, and ends where it began, so names,
  bubbles and stations are not disturbed. A new motion is a name in `EMOTE_MOTIONS` in
  `emotes.js`, a `@keyframes ac-emote-<name>` in `stage.css` and a row in `THEMES.md`;
  `npm run check` fails when one is missing.
- Emotes stop while the page is hidden.

## Accessibility

- Every control is a real `<button>` or `<select>` with a visible label or an `aria-label`.
- Characters are buttons with an `aria-label` of the form "name: activity". A subagent's adds
  the agent it works for.
- Never signal state by colour alone: waiting, blocked and done each have a bubble.
- Honour `prefers-reduced-motion`: every animation is switched off under it in `stage.css`, and
  the engine plays no emotes.

## Styling

- Colours come from Orca's theme variables (`--orca-*`) with a dark fallback, so the panel
  follows the person's Orca theme. A room's own colours come from `--ac-*` variables set by its
  theme.
- Class names start with `ac-`.

## Check your change

Run `npm run demo` and look at List, Gallery, a pinned room, a narrow window and all three
themes. A UI change that was only read, not looked at, is not done.
