# Settlement art

The Camp tab's settlement is original pixel art made for this project, under the repository's
licence. The Python scripts in this folder draw it: `engine.py` is a small canvas with dithering,
shapes and PNG output, `kit.py` holds the palettes and the props every building is made of,
`settlement.py` draws the same valley at each of the seven stages (Camp, Outpost, Hamlet, Village,
Town, Stronghold, Citadel), `buildings.py` draws the five buildings alone on a patch of grass at
three tiers, and `build.py` renders them all.

The scripts use the Python standard library only and every random choice is seeded, so a run
always draws the same pixels. Neither the plugin nor `npm run verify` runs them; Python is not
needed to use or develop the plugin. The pictures they made are committed in `ui/settlement/`.

## Regenerating

From the repository folder:

```bash
python3 -I scripts/settlement-art/build.py
```

It writes into `scripts/settlement-art/`: `png/x1/` at the native size (a stage is 224 x 112, a
building about 42 to 51 pixels wide), `png/` three or four times larger to look at, and the
contact sheets `sheet-settlement.png`, `sheet-settlement-row.png` and `sheet-buildings.png`. Git
ignores all of them. Draw one part only by naming it: `settlement` or `buildings`.

The plugin uses each stage's fade variant, whose lower left is darkened for the stage's name drawn
over it, and every building sprite as it is:

```bash
for stage in 1-camp 2-outpost 3-hamlet 4-village 5-town 6-stronghold 7-citadel; do cp "scripts/settlement-art/png/x1/stage-$stage-fade.png" "ui/settlement/stage-$stage.png"; done
```

```bash
cp scripts/settlement-art/png/x1/building-*.png ui/settlement/
```

The file names are the ones `game/settlement.json` names; `npm run check` fails when one is
missing. A building keeps its spot in every stage: the hearth in front, the workshop on the left,
the rune circle on the knoll behind, the storehouse on the right by the river and the defences on
the hill and along the walls.
