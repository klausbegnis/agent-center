# Instance art

The art of the instances in `ui/instances/` (six banners, the world roadmap in three states, the
Sunken Crypt's route in three states and the room icons) and the six signature relics in
`ui/art/legendary/` are original pixel art made for this project, licensed under the MIT licence
like the rest of the repository. They are drawn by the Python scripts in this folder:

- `engine.py` is a small canvas with palettes, dithering, shapes, text and PNG output;
- `banners.py` draws the six banners, one module each (`bn_crypt.py`, `bn_foundry.py`,
  `bn_hive.py`, `bn_frost.py`, `bn_library.py`, `bn_spire.py`);
- `roadmap.py` draws the roadmap (`SITES` there are the coordinates `game/instances.json` places
  its live markers at), `route.py` the Sunken Crypt's route, `icons.py` the 16 x 16 room icons;
- `rewards.py` and `sprite.py` draw the six relics at 32 x 32, with and without their glow;
- `build.py` renders all of it, and `crop.py` is a helper to look at a region closely.

The scripts use the Python standard library only and every random choice is seeded, so a run
always draws the same pixels. Neither the plugin nor `npm run verify` runs them; Python is not
needed to use or develop the plugin.

## Regenerating

From the repository folder:

```bash
python3 -I scripts/instance-art/build.py
```

It writes into `scripts/instance-art/`: `png/x1/` at the native sizes, 3x to 6x previews in
`png/`, four contact sheets and `rewards.json`. Git ignores all of them. Then copy what the plugin
uses:

```bash
cp scripts/instance-art/png/x1/{sunken-crypt,emberdeep-foundry,hollow-hive,frostwatch-keep,drowned-library,wyrmrest-spire}{,-fade}.png ui/instances/
```

```bash
cp scripts/instance-art/png/x1/{roadmap,route,icon}-*.png ui/instances/
```

```bash
for relic in tidewake-bell heart-of-the-last-pour amber-of-the-sleeping-queen rimebitten-horn drowned-concordance fang-of-the-coiled-wyrm; do cp "scripts/instance-art/png/x1/reward-$relic.png" "ui/art/legendary/$relic.png"; cp "scripts/instance-art/png/x1/reward-$relic-glow.png" "ui/art/legendary/$relic-glow.png"; done
```
