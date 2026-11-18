# Instance art

The art of the instances in `ui/instances/` (the banners of both regions, the Old Road's roadmap and
the Gloaming Isles' sea chart in three states each, the Sunken Crypt's route in three states and the
room icons) and the first region's six signature relics in `ui/art/legendary/` are original pixel art made for this project, licensed under the MIT licence
like the rest of the repository. They are drawn by the Python scripts in this folder:

- `engine.py` is a small canvas with palettes, dithering, shapes, text and PNG output;
- `banners.py` draws the banners, one module each: the Old Road's (`bn_crypt.py`, `bn_foundry.py`,
  `bn_hive.py`, `bn_frost.py`, `bn_library.py`, `bn_spire.py`) and the Gloaming Isles' (`bn_isle_*.py`);
- `isles_map.py` draws the second region's night sea chart (`SITES` there are its live markers'
  coordinates in `game/instances.json`);
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
cp scripts/instance-art/png/x1/{saltreach-lighthouse,coral-labyrinth,smugglers-warren,gloomroot-grove,brass-leviathan,moonwake-abbey,storm-anvil,abyssal-gate}{,-fade}.png ui/instances/
```

```bash
cp scripts/instance-art/png/x1/{roadmap,isles-map,route,icon}-*.png ui/instances/
```

```bash
for relic in tidewake-bell heart-of-the-last-pour amber-of-the-sleeping-queen rimebitten-horn drowned-concordance fang-of-the-coiled-wyrm; do cp "scripts/instance-art/png/x1/reward-$relic.png" "ui/art/legendary/$relic.png"; cp "scripts/instance-art/png/x1/reward-$relic-glow.png" "ui/art/legendary/$relic-glow.png"; done
```

The second region's sixteen legendary items (its eight instance relics and its bosses' own items) are
drawn by `scripts/legendary-art/relics.py` with the rest of the legendary loot.
