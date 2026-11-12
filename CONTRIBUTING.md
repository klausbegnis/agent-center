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

## Retaking the listing images

The images in `assets/` are what Orca's plugin directory shows. They come from the demo too,
with `--window-size=1280,800` and `?view=gallery` for all rooms, or `?view=gallery&only=rumble`,
`only=cosmic` and `only=turbo` for one room each. The cover is the gallery shot scaled to
1600×1000. `assets/icon.png` is `assets/icon.svg` drawn at 256×256. The size limits are in
[docs/MAINTAINING.md](docs/MAINTAINING.md).

## Reporting a security problem

Please do not open a public issue. See [SECURITY.md](SECURITY.md).

## Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By taking part you agree to it.

## Licence

By contributing you agree that your contribution is licensed under the [MIT licence](LICENSE).
Art you did not make yourself needs a licence that allows redistribution; say which in the pull
request.
