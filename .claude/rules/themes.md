---
description: The theme contract: what every theme folder must contain and what art is acceptable.
paths:
  - "themes/**"
  - "THEMES.md"
  - "scripts/theme-contract.mjs"
---

# Themes

`THEMES.md` is the full guide and starts with a quick start. These are the rules a theme must
meet to be merged.

## Contract

- A theme is one folder under `themes/`, named in kebab-case, holding `theme.json`, a scenery
  and a sprite sheet. Nothing outside that folder changes when a theme is added. The name
  `random` is reserved for the Random default theme, and `_template` is the theme template.
- `theme.json` uses only the fields listed in `THEME_FIELDS` in `scripts/theme-contract.mjs`.
- The scenery is drawn at 8:5 (for example 400×250). Every room is shown at that shape.
- `actors.poses` has at least `idle`; `actors.species` has a `default`; `stations` has at least
  one `idle` slot. Every symbol id named in `theme.json` exists in the sprite sheet.
- Station points are where a character's feet go and lie inside the room.
- Symbol ids carry a prefix unique to the theme (`pd-`, `rp-`, `gd-`), because several themes
  can be on screen at once.
- The head is in the same place in every pose, so outfits line up.
- `actors.familiar` is optional. When present it names a symbol in the sprite sheet, is no
  larger than a character, and uses only the keys `THEMES.md` lists.
- `actors.emotes` is optional. Each emote has an `id` of its own, lists the activities it plays
  on, uses only the keys and motions `THEMES.md` lists, names symbols that are in the sprite
  sheet and lasts 0.5 to 4 seconds. A theme never animates anything itself: the engine moves
  the characters.
- SVG files are valid XML. In particular, no `--` inside a comment.

`npm run check` verifies all of the above except the head position, which only eyes can
check: look at every pose with an outfit in the demo. A theme that fails the check is not ready,
and a theme that passes it still has to be looked at.

## The template

- `themes/_template` is the theme people copy. It is a working theme that uses every field,
  every pose, every station and every UI variable the engine reads, with placeholder art and
  comments that say what each part is for.
- It follows the contract like any theme, and `npm run check` also fails when it leaves out a
  field from `THEME_FIELDS`.
- It is not a theme to pick: `listThemes` in `src/themes.mjs` leaves it out, so no picker and
  no Random choice offers it. Only the demo shows it: `node scripts/demo.mjs _template`.
- Keep it plain. It shows how a theme is built, not how good one looks.

## Changing the contract

The contract changes whenever the engine reads something new from a theme: a field in
`theme.json`, a pose, a station, a UI variable, a key of a familiar or of an emote, a new kind of symbol. The same pull request
must then:

1. add it to `THEME_FIELDS` (or the lists it is built from) in `scripts/theme-contract.mjs`;
2. use it in `themes/_template`;
3. describe it in `THEMES.md`;
4. extend the check if the new thing has a rule a machine can verify.

Step 1 is the one nothing enforces: the check cannot see what the engine reads. Once it is
done, the check fails until steps 2 and 3 are, because it requires the template to use every
listed field and `THEMES.md` to name it. A pull request that changes `ui/engine/` or
`ui/stage.css` to read something new from a theme without touching all three is not ready.

## Art

- Original art only. A theme may be in the spirit of a game or a genre; it may not copy a
  specific game's characters, creatures, maps, sprites, logos or names. That covers familiars
  and emotes too: no dance, spell effect or move recognisable from an existing game.
- Art from someone else needs a licence that allows redistribution, stated in the pull request
  and in a `LICENSE` or `CREDITS` file inside the theme folder.
- No readable text in a scenery that may be mirrored. Set `variants.flip` to `false` if the
  scenery needs text.
- Keep a theme small: prefer SVG, and keep the folder under 500 KB.

## Adding a theme

Follow the quick start in `THEMES.md`. In short:

1. Copy `themes/_template` to a new folder named for the theme, and replace the `tp-` symbol
   prefix with the theme's own in `theme.json` and `actors.svg`.
2. Look at it with `node scripts/demo.mjs <theme-id>`, which shows the theme in every room:
   every activity, an agent with familiars, List and Gallery, and a narrow window. Add
   `?emotes=fast` to the address to see the emotes without waiting.
3. Run `npm run check`.
4. Add a screenshot taken from the demo to the pull request.
