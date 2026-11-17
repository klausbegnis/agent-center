# Legendary art

`relics.py` paints the pixel art of the legendary loot in `game/legendary.json`: one 32×32
picture per item, the same with a glow, and the two frames the Arsenal draws them in (a slot and
the active relic). The plugin does not run it, `npm run verify` does not run it, and Python is not
something the plugin needs: the pictures it made are committed in `ui/art/legendary/`.

It is deterministic: no randomness, no network and nothing downloaded. The item pictures need only
Python 3's standard library; the contact sheets it also writes use Pillow when it is installed.

## Changing the art

```bash
python3 scripts/legendary-art/relics.py
```

It writes next to itself: `x1/` (the pictures at their real size), `png/` (six times larger, to
look at), four contact sheets and an `items.json` with the names and flavour lines it drew. Those
outputs are ignored by git. Copy what changed into the plugin:

```bash
cp scripts/legendary-art/x1/*.png ui/art/legendary/
```

A new item needs an entry in `game/legendary.json` with the same id and a drawing here, both in
the same pull request. `npm run check` checks the data; look at the pictures in the demo.

The art is original work made for this project, under the repository's licence.
