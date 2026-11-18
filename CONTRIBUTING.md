# Contributing to Agent Center

Thanks for wanting to help. This page gets you from a clone to a merged pull request. For how
issues are triaged and pull requests are merged, see [docs/MAINTAINING.md](docs/MAINTAINING.md).

## Ways to contribute

- **Report a bug** with the bug report form. A screenshot from the demo helps a lot.
- **Propose a feature** with the feature request form before writing code for anything large.
- **Fix something** labelled `good first issue` or `help wanted`.
- **Improve the docs.**
- **Improve what themes can do.** If you change what the engine reads from a theme, update the
  template, `THEMES.md` and `scripts/theme-contract.mjs` in the same pull request.

A theme of your own does not need a pull request. Themes are personal: make one for yourself
from `themes/_template` with the quick start in [THEMES.md](THEMES.md#quick-start) and keep it
in your copy. This repository ships a small set and adds to it rarely; to propose one, open a
theme proposal before drawing, and see [rules/themes.md](rules/themes.md) for what it must meet.

## Set up

You need Node 22 or later. There is nothing to install: the project has no dependencies and no
build step.

```bash
git clone https://github.com/klausbegnis/agent-center.git
cd agent-center
```

```bash
npm run verify
```

`verify` runs the static checks and the unit tests. If it passes on a fresh clone, you are set.

## See your change

```bash
npm run demo
```

This serves the UI at `http://127.0.0.1:47700/` with made-up projects and agents that keep
working, delegating and finishing. It needs no Orca. With no argument the rooms use a mix of
themes; add a theme id (`npm run demo guild-hall`) to show every room on that theme,
`random` to let each room get its own, or `_template` to see the theme template. Set `FREEZE=1` to hold the scene still.

Useful address options: `?view=gallery`, `?view=list`, and `?only=<text>` to show only matching
rooms.

The demo also serves the monster contact sheet on the next port,
`http://127.0.0.1:47701/monsters.html`: every race of game mode in a row of generated variants
(an elite, a champion and one of its bosses among them), the rank ladder with its glows,
chimeras and the whole boss roster, each at room size and at three times that, on light and dark
grounds. Look at it after changing monster parts, races or bosses.

To try it inside Orca (1.4.248 or later):

```bash
orca plugin dev load .
```

Orca asks you to approve what the plugin can do. Read the warning in
[rules/git-workflow.md](rules/git-workflow.md) first: **never move or rename files in a folder
Orca has loaded**. Do structural work in a separate git worktree.

## The rules

The [rules/](rules/) folder holds short, concrete rules for each area of the code. Read the one
for the area you are changing; each says at the top which files it covers. If you use Claude
Code, they load on their own when you open a matching file.

The ones that surprise people most:

- No runtime dependencies and no build step.
- `src/domain/` and the computing modules in `ui/engine/` are pure and fully tested.
- The engine knows no theme; everything theme-specific comes from `theme.json`.
- No real project, host or conversation name anywhere: use the made-up names from the demo.

## Making a change

1. Open an issue first for anything beyond a small fix, so nobody builds the same thing twice.
2. Branch from `main`: `feat/pin-rooms`, `fix/duplicate-agents`, `theme/lighthouse`.
3. Write the change with its tests. A bug fix starts with a test that fails.
4. Run `npm run verify`.
5. Look at it: run the demo and check List, Gallery, a pinned room, a narrow window and each
   theme your change touches.
6. Update the docs your change makes untrue, and add a line to `CHANGELOG.md` under
   "Unreleased".

## Commits and pull requests

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
  `fix(worker): keep agents whose terminal is still open`. Types and scopes are listed in
  [rules/git-workflow.md](rules/git-workflow.md).
- Keep a pull request to one change, small enough to review in one sitting.
- Pull requests are squash-merged, so the **title** must be a valid Conventional Commit.
- Fill in the template. For UI and theme changes, attach a screenshot taken from the demo.
- A maintainer reviews within a few days. Expect questions; they are about the change, not you.

## Retaking the README screenshots

The screenshots in `docs/screenshots/` come from the demo, so they never show real names. With
the demo running with `FREEZE=1`, capture a page with headless Chrome:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-prefers-reduced-motion --force-device-scale-factor=2 --window-size=1440,900 --timeout=5000 --screenshot=docs/screenshots/gallery.png "http://127.0.0.1:47700/?view=gallery"
```

`--force-prefers-reduced-motion` puts every character at its place at once; without it the shot
catches them walking in. Chrome keeps running because the page holds a live connection: once the file appears, stop it
with Ctrl+C. The other shots use `--window-size=500,1180` with `?view=list`, and
`--window-size=900,640` with `?view=list&only=rumble`, `only=cosmic` and `only=turbo`.

The game tabs `game-rooms.png`, `game-chest.png`, `game-skills.png` and `game-market.png` are
`GAME=1 FREEZE=1` on Guild Hall with `?view=list&tab=rooms` (`chest`, `skills`, `market`) at a
500 × 900 window and scale 2; the Chest one adds `&room=local:/work/rumble-banana` and has its free
Whittled Cudgel chosen, so the item detail and its **Send to** show. Look at each before committing it: `--screenshot` can fire before
the city banners are painted, and then the Market shot shows empty cards. Taking the picture
through Chrome's DevTools protocol once every image has loaded avoids that; `scripts/capture.mjs`
does it at scale 2 with reduced motion:

```bash
node scripts/capture.mjs shot "http://127.0.0.1:47700/?view=list&tab=market" docs/screenshots/game-market.png 500 900
```

The same goes for `game-settlement.png` (`tab=camp`), `game-bestiary.png` (`tab=world`),
`game-roadmap.png` (`?tab=roadmap&room=local:/work/rumble-banana`), `game-party.png`
(`tab=party&room=local:/work/rumble-banana`) and `game-achievements.png`
(`?tab=world&view=achievements&room=local:/work/rumble-banana`, without `view=list`, which would
take the place of the World tab's view). For the Chest, `--eval` clicks the cudgel first:
`--eval "[...document.querySelectorAll('button')].find((b) => /Whittled Cudgel/.test(b.getAttribute('aria-label') ?? ''))?.click()"`.
The demo for all of them is `GAME=1 FREEZE=1 node scripts/demo.mjs guild-hall`.

### The game-mode GIF

`docs/screenshots/game-mode.gif` is the live demo, not the frozen one, so fights play: start
`GAME=1 node scripts/demo.mjs guild-hall`, wait about twenty seconds, then take frames of one
lively room through Chrome's DevTools protocol, without reduced motion (`scripts/capture.mjs`,
Node alone):

```bash
node scripts/capture.mjs frames "http://127.0.0.1:47700/?view=gallery&tab=rooms&only=sneaky" /tmp/ac-frames 720 640 45 10
```

Look through the frames for an 11-second stretch where a monster's health falls, it dies and the
next one comes in (a contact sheet: `ffmpeg -i /tmp/ac-frames/frame-%04d.png -vf "select='not(mod(n\,20))',scale=360:-1,tile=4x6" -frames:v 1 sheet.png`),
then assemble it at half size with nearest-neighbour scaling and a palette of its own, from its
first frame (here 230):

```bash
ffmpeg -framerate 10 -start_number 230 -i /tmp/ac-frames/frame-%04d.png -frames:v 110 -vf "scale=720:-1:flags=neighbor,palettegen=max_colors=96:stats_mode=diff" palette.png
```

```bash
ffmpeg -framerate 10 -start_number 230 -i /tmp/ac-frames/frame-%04d.png -i palette.png -frames:v 110 -lavfi "scale=720:-1:flags=neighbor[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" -loop 0 docs/screenshots/game-mode.gif
```

Every file in the repository is part of the plugin Orca installs, `docs/` included, so keep the
GIF under about 800 KB. Extract a few frames back (`ffmpeg -i docs/screenshots/game-mode.gif
-vf "select='not(mod(n\,15))',tile=4x2" -frames:v 1 check.png`) and look at them before
committing it.

## Retaking the listing images

The images in `assets/` are what Orca's plugin directory shows. They come from the demo too,
with `--window-size=1280,800` and `?view=gallery` for all rooms, or `?view=gallery&only=rumble`,
`only=cosmic` and `only=turbo` for one room each. The cover is the game-mode gallery
(`GAME=1 FREEZE=1`, `?view=gallery`) on Guild Hall at 1280×800 (`--scale 1`, and the README's
`game-gallery.png` is the same picture), and `assets/screenshot-game.png` the settlement on the
Camp tab (`?view=gallery&tab=camp`) at the same size, so the listing never shows one
picture twice. The bestiary
(`assets/screenshot-bestiary.png`, exactly 1280×800) and the README's `game-bosses.png` and
`game-ranks.png` come from the contact sheet (`?part=bosses`, `?part=races`) with everything but
the cards shown removed, so no heading or half row is cut at an edge; crop and pad with `sips`
(`sips -c`, `sips -p … --padColor 1D2027`). `assets/icon.png` is `assets/icon.svg` drawn at 256×256. The size limits are in
[docs/MAINTAINING.md](docs/MAINTAINING.md).

## Reporting a security problem

Please do not open a public issue. See [SECURITY.md](SECURITY.md).

## Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By taking part you agree to it.

## Licence

By contributing you agree that your contribution is licensed under the [MIT licence](LICENSE).
Art you did not make yourself needs a licence that allows redistribution; say which in the pull
request. The city banners in `ui/cities/` are original pixel art made for this project, drawn by the
scripts in `scripts/city-art/`.
