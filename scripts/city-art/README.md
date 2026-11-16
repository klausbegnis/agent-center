# City banners

The market's five city banners in `ui/cities/` are original pixel art made for this project,
licensed under the MIT licence like the rest of the repository. They are drawn by the Python
scripts in this folder: `engine.py` is a small canvas with dithering, shapes and PNG output,
`cities.py` renders every banner, and each city has a module of its own (`goldmill.py`,
`deepforge.py`, `brinehaven.py`, `tallwood.py`, `runespire.py`).

The scripts use the Python standard library only and every random choice is seeded, so a run
always draws the same pixels. Neither the plugin nor `npm run verify` runs them; Python is not
needed to use or develop the plugin.

## Regenerating

From the repository folder:

```bash
python3 -I scripts/city-art/cities.py
```

It writes into `scripts/city-art/`: `x1/<city>.png` and `x1/<city>-fade.png` at the native 192 x 72,
4x previews and two contact sheets. Git ignores all of them. The plugin uses the fade variant,
whose lower left is darkened for the city's name drawn over it:

```bash
for city in goldmill deepforge brinehaven tallwood runespire; do cp "scripts/city-art/x1/$city-fade.png" "ui/cities/$city.png"; done
```

To draw one city only, name it: `python3 -I scripts/city-art/cities.py tallwood`.
