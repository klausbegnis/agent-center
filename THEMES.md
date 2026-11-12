# Making a theme

A theme is a folder inside `themes/`. The plugin knows no theme in advance: it lists the folders
that have a `theme.json` and draws what the file describes. To add a theme, create the folder;
to remove one, delete it. There is no code to touch.

## Quick start

You need Node 22 or later and a clone of this repository. Nothing to install.

1. Copy the template. The folder name is the theme's id: lower case, words joined by hyphens.

   ```bash
   cp -R themes/_template themes/my-theme
   ```

2. Make it yours. In `themes/my-theme/theme.json`, change `name` to what the theme picker
   should show. Then replace the template's symbol prefix `tp-` with a short prefix of your
   own (say `mt-`) everywhere in `theme.json` and `actors.svg`. Themes share the page, so two
   themes may not use the same prefix.

3. Run the demo with your theme and open the address it prints.

   ```bash
   node scripts/demo.mjs my-theme
   ```

   Every room uses your theme, with fake agents that write, read, delegate, wait, get blocked
   and sleep in a loop. Reload the page after saving a theme file.

   Characters play an [emote](#emotes) only now and then. To preview yours without waiting,
   add `?emotes=fast` to the address (the demo prints it): every character then plays one
   every few seconds, and all of a theme's emotes take turns.

4. Draw. Replace `room.svg` with your scenery, move the points under `stations` in
   `theme.json` to where characters should stand in it, and redraw the symbols in
   `actors.svg`. The comments in both SVG files say what must stay as it is. Change one thing
   at a time and look at the demo.

5. Check the theme. The check names each problem and the file it is in.

   ```bash
   npm run check
   ```

6. Keep it. The theme is yours and works from your copy; it does not need to be in this
   repository. To propose it for the shipped set, open a theme proposal first, then a pull
   request from `theme/my-theme` titled `theme(themes): add the my-theme theme` with a
   screenshot taken from the demo. Read the art rules in [rules/themes.md](rules/themes.md):
   original art only.

The rest of this page is the reference for each file.

## The files

```
themes/
  my-theme/
    theme.json   describes the room, the characters and where each one stands
    room.svg     the scenery, without characters (.png or .webp also work)
    actors.svg   the characters, one <symbol> per pose
```

`themes/_template` is the reference theme: it is small, it works, and its `theme.json` uses
every field this page describes, with every pose and every station. `npm run check` fails if it
stops doing so, so it is always safe to copy. It is not offered in the theme pickers; to look at
it, run `node scripts/demo.mjs _template`.

## theme.json

Open [`themes/_template/theme.json`](themes/_template/theme.json) next to this section: it is
the complete example. A theme needs only `name`, the three `room` fields `width`, `height` and
`background`, the three `actors` fields `file`, `width` and `height`, an `idle` pose, a
`default` species and an `idle` station. Everything else is optional. A field this page does
not describe is refused by `npm run check`, so a typing mistake does not go unnoticed.

- `name`: what the theme pickers show.
- `version`: the version of your theme, a number you raise when you change it. The plugin
  does not read it.

### room

`width` and `height` are the room size in the units you drew the scenery in. Every coordinate in
the theme uses those units; the view scales everything together.

**Draw the scenery at 8:5** (for example 400×250 or 464×290). Every room is shown at that
shape so that rooms using different themes are the same size; a scenery with another shape is
stretched to fit.

Each project's room looks a little different, so rooms are easy to tell apart. The variation is
derived from the room itself, so the same project always looks the same.

- `backgrounds`: optional list of scenery files, such as `["room.svg", "room-b.svg"]`. One is
  picked per room. Without it, every room uses `background`.
- `variants.hues`: optional list of hue shifts in degrees applied to the scenery, one picked per
  room. Without it, a room gets any hue on the wheel in 15-degree steps. Use `[0]` to turn the
  colour shift off.
- `variants.flip`: `false` stops rooms from being mirrored. Mirroring flips the scenery and the
  stations together, so avoid readable text in a scenery that may be mirrored.

### actors

- `file`: the sprite sheet, an SVG file in the theme folder. See [actors.svg](#actorssvg).
- `width`, `height`: the size of one character, in room units.
- `subScale`: how much smaller a subagent is than an agent (0.72 = 72%). It is used when the
  theme draws no familiar.
- `familiar`: optional. The companion that stands for a subagent; see
  [Familiars](#familiars).
- `emotes`: optional. The short moves a character plays now and then; see [Emotes](#emotes).
- `poses`: for each activity, the `id` of the `<symbol>` in `actors.svg`. Only `idle` is
  required; an activity without a pose uses `idle`.
- `species`: the look per kind of agent. The key is searched inside the agent's name (`claude`,
  `codex`, ...); `default` covers the rest.
  - `parts`: symbols drawn on top of the pose (ears, antenna, hat).
  - `colors`: become CSS variables on the character. A symbol that uses `fill="var(--c1)"` gets
    the species colour, so one pose serves every species.

Every agent also gets its own look, picked from its id so it stays the same across reloads:

- `outfits`: optional list of outfits; each outfit is a list of symbol ids drawn on top of the
  character (scarf, cap, glasses). Include `[]` for "no outfit". Keep the head in the same place in every
  pose so outfits line up.
- `outfitColors`: optional palette. One colour is picked per agent and reaches the outfit
  symbols as `var(--o1)`.
- `hueShift`: degrees per step of the small colour shift applied to each character within its
  species (five steps, default 14). Use `0` to turn it off.

The activities are:

| Activity | When |
|---|---|
| `write` | the agent is editing files |
| `read` | reading or searching files |
| `run` | running a command |
| `think` | working with no tool in use |
| `delegate` | waiting on subagents it called |
| `wait` | waiting for you |
| `blocked` | blocked |
| `done` | finished, and you have not looked at it yet (Orca's bell is on). Without a pose or a station of its own the character uses `idle`; it shows a "✓" and keeps playing the theme's finishing emotes until you open its terminal |
| `sleep` | done and seen |

### Familiars

A subagent is not a character of its own: it is a **familiar** of the agent that called it, a
small companion that stays at that agent's side, follows it from station to station and wears
its colours. Draw one creature or gadget that belongs in your room: a pet, a drone, a wisp.

```json
"familiar": { "symbol": "mt-familiar", "width": 20, "height": 20, "lift": 10, "motion": "hover" }
```

| Key | What it does |
|---|---|
| `symbol` | the `id` of the familiar's `<symbol>` in `actors.svg`. Required. |
| `width`, `height` | its size in room units; about half a character works well. Without them: `subScale` times a character. |
| `lift` | how far above the floor it floats, in room units. Leave it out for one that walks. |
| `motion` | its idle motion: `bob` (the default, a small hop) or `hover` (a slow drift). |
| `emotes` | the [emote](#emotes) motions it may play now and then, as in `["hop", "spin"]`. Without it a familiar plays none. |

- Give the symbol a `viewBox` of its own, with the same proportions as `width` and `height`.
- Use `var(--c1)`, `var(--c2)` and the other species colours for its body: a familiar gets the
  colours and the tint of its parent, which is what shows whose it is. `var(--o1)` is the
  parent's outfit colour; give it a fallback, as in `var(--o1, #68C078)`, when your theme has
  no `outfitColors`.
- One symbol serves every activity. What the subagent is doing is shown by a small icon the
  plugin draws above it, so the familiar needs no poses.
- The plugin places familiars on either side of their parent, shows at most six and a "+N" for
  the rest, and shows a familiar's name only when it is hovered or selected.
- Make it your own. A familiar may be in the spirit of a genre; it may not be a creature or a
  companion from an existing game.

A theme without `familiar` still works: each subagent is drawn as a small character in its
parent's look, standing beside its parent.

### Emotes

Every now and then a character plays an **emote**: a short move that says something about what
it is doing, after which it is back as it was. A wizard who has run a command for a while casts
a spell; a character who just finished does a little dance. Each character plays one every 20 to
60 seconds, never two characters in step, and never while walking.

```json
"emotes": [
  { "id": "cheer", "on": ["sleep"], "when": "start", "motion": "hop", "pose": "mt-cheer",
    "effect": "mt-fx-sparks", "effectMotion": "pulse", "seconds": 1.6 },
  { "id": "stretch", "on": ["write", "read", "run"], "motion": "stretch" }
]
```

| Key | What it does |
|---|---|
| `id` | a name of your own for the emote, in kebab-case, different for each. Required. |
| `on` | the [activities](#actors) the emote may play at. Required. When several emotes fit, one is picked each time. |
| `when` | `sometimes` (the default): now and then while the character is at that activity. `start`: once, as soon as the character has taken the activity up, for a moment that matters, such as finishing (`"on": ["sleep"]`). |
| `motion` | how the plugin moves the character; see the list below. |
| `effect` | the `id` of a `<symbol>` in `actors.svg` shown over the character while the emote plays: sparks, notes, a pebble. |
| `effectMotion` | how the effect moves: `rise` (the default: fades in, drifts up, fades out), `pulse` (throbs in place) or `toss` (goes up and comes back down). |
| `pose` | the `id` of a `<symbol>` shown instead of the usual pose while the emote plays: arms up, a wand raised. |
| `seconds` | how long it lasts, from 0.5 to 4. Without it: 1.6. |

An emote needs at least one of `motion`, `effect` and `pose`, and may have all three.

The motions are the plugin's, so a theme needs no animation of its own:

| Motion | What the character does |
|---|---|
| `hop` | two small jumps |
| `spin` | turns round on the spot, twice |
| `flip` | lifts off and turns head over heels |
| `shake` | shakes from side to side |
| `sway` | rocks from foot to foot, as in a dance |
| `tilt` | leans one way, then the other, as if looking around |
| `float` | rises, hovers and comes down |
| `stretch` | stretches tall and settles |
| `wiggle` | a quick, small jitter |

- An effect is drawn on the same grid as a pose (the same `viewBox`), so you decide where it
  sits: over the head, at a hand, round the feet. Put `overflow="visible"` on its `<symbol>` to
  let it reach outside the grid. Leave the top right corner free; the bubbles sit there.
- An emote pose is a whole character, like any pose, with the head where it always is.
- The plugin shows the bubble and the name on top of an effect, and puts the character back
  exactly on its spot when the emote ends.
- A theme without `emotes` gets a small set of motions with no symbols: a hop on finishing, a
  stretch at work, a tilt while thinking, a sway while waiting, a shake when blocked. Use
  `"emotes": []` for a theme whose characters keep still.
- Familiars play only motions, more rarely than agents, and only when `familiar.emotes` lists
  some.
- Nobody emotes for a person who asked their system for reduced motion, or while the page is
  hidden.
- Make them your own. An emote may be in the spirit of a genre; it may not be a dance, a spell
  effect or a move recognisable from an existing game.

### stations

Where the characters stand for each activity. A station is a list of slots; the point is where
the character's **feet** go (bottom centre). Only agents take slots; their familiars gather
round them, so leave a little room beside a slot. When slots run out, extra characters queue to
the left of the last slot. An activity without a station falls back to another: `run` and `read` to
`write`, `delegate` to `think`, and everything to `idle` last. `enter` is a single point, not a
list: where a new character appears before walking to its slot.

### ui

- `pixelated`: `true` keeps hard pixels when scaled up. Use `false` for vector themes.
- `vars`: colours and font of the UI around the room.

| Variable | What it changes |
|---|---|
| `frame` | the room's border |
| `label`, `label-shadow` | the name under a character |
| `bubble-wait`, `bubble-blocked` | the background of the "?" and the "!" bubble |
| `bubble-sleep` | the background of the "zz" above a sleeper; leave it `transparent` for none |
| `bubble-ink` | the text of the "?" and "!" bubbles |
| `font` | font of the names and bubbles |

## actors.svg

One SVG file holding only `<symbol>` elements. Every one but the familiar has the same
`viewBox`, which has the same shape as the character size in `theme.json`. The bottom centre of the `viewBox` is the
character's feet. Use your own prefix on every `id` so they do not clash with another theme.
[`themes/_template/actors.svg`](themes/_template/actors.svg) has one commented symbol for every
pose, species part and outfit, and for the familiar.

```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <symbol id="mt-idle" viewBox="0 0 16 16">
    <rect x="3" y="4" width="10" height="8" fill="var(--c1)"/>
    <rect x="5" y="6" width="2" height="2" fill="#171A21"/>
    <rect x="9" y="6" width="2" height="2" fill="#171A21"/>
  </symbol>
</svg>
```

The bubbles ("?", "!", "zz"), the activity icons over familiars and the names are drawn by the
plugin, and so is every movement; the theme only draws the characters, the familiar and the
symbols its emotes use. An SVG comment may not contain two hyphens in a row, so do not write a CSS variable
name inside one.

## What `npm run check` checks

For every theme folder, the template included:

- the folder name is in kebab-case and is not `random`;
- `theme.json` has the required fields and no field this page does not describe;
- the room is 8:5, and so is the `viewBox` of an SVG scenery; every scenery file exists;
- every symbol id named in `theme.json` exists in the sprite sheet, and all symbol ids start
  with one prefix that no other theme uses;
- a declared familiar is no larger than a character, floats no higher than one and has a known
  `motion`;
- every emote has an `id` of its own, lists known activities, uses only the keys and motions
  this page lists, names symbols that are in the sprite sheet and lasts 0.5 to 4 seconds;
- every station point lies inside the room;
- no SVG comment contains two hyphens in a row.

It cannot see the art. Whether the head is in the same place in every pose, whether characters
stand where the scenery suggests and whether the theme reads well when small are for you to
check in the demo: look at every activity, List and Gallery view, and a narrow window.

## Changing the theme format

This is for people changing the plugin, not for theme authors. When the engine starts reading
a new field, pose, station or UI variable, the same pull request:

1. adds it to `THEME_FIELDS` in `scripts/theme-contract.mjs`, the one list of what a theme may
   contain;
2. uses it in `themes/_template`, with a comment in the SVG files where that helps;
3. describes it on this page.

`npm run check` enforces the last two once the first is done: it fails while the template does
not use a listed field or this page does not name it. A new field is optional and has a default
that leaves existing themes unchanged.

## Third-party art

A theme's sprite sheet is inserted into the page as markup. Scripts, event handlers and outside
links are stripped from it, but treat a theme like code all the same: only install themes you
trust (see `SECURITY.md`). If you
use someone else's art pack, check its licence before distributing the theme.
