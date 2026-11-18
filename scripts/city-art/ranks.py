"""Render every city through its five ranks: x1/<city>-<rank>.png and x1/<city>-<rank>-fade.png at
the native 192 x 72, 4x previews and a contact sheet per city (sheet-ranks-<city>.png) plus one of
every city side by side (sheet-ranks.png). Each city has a module `<city>_ranks.py` whose
`draw(rank)` returns a canvas. Deterministic: every random source is seeded.
Run: python3 -I scripts/city-art/ranks.py [city ...]"""
import os, sys, importlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from rank_engine import *

CITIES = [('goldmill', 'Goldmill'), ('deepforge', 'Deepforge'), ('brinehaven', 'Brinehaven'),
          ('tallwood', 'Tallwood'), ('runespire', 'Runespire')]
NUMERALS = ['I', 'II', 'III', 'IV', 'V']
BG = hexc('#12151B')
WHITE = (230, 232, 240)
W, H = 192, 72


def sheet_of(rows, sc):
    """Stacks named images at a scale, the name under each."""
    w = len(rows[0][1][0]) * sc
    h = len(rows[0][1]) * sc
    lab = 30
    sheet = [[BG] * (w + 24) for _ in range(len(rows) * (h + lab) + 12)]
    for i, (name, px) in enumerate(rows):
        oy = 12 + i * (h + lab)
        blit(sheet, scale(px, sc), 12, oy)
        text(sheet, name, 12, oy + h + 6, 2, WHITE)
    return sheet


def main(only):
    x1 = os.path.join(HERE, 'x1')
    os.makedirs(x1, exist_ok=True)
    grid = []
    for mod, name in CITIES:
        if only and mod not in only:
            continue
        module = importlib.import_module(f'{mod}_ranks')
        rows = []
        for rank in range(1, 6):
            cv = module.draw(rank)
            px = cv.px
            faded = fade(px)
            save(px, os.path.join(x1, f'{mod}-{rank}.png'))
            save(faded, os.path.join(x1, f'{mod}-{rank}-fade.png'))
            save(scale(px, 4), os.path.join(HERE, f'{mod}-{rank}.png'))
            rows.append((f'{name} {NUMERALS[rank - 1]}', px))
            print(f'{mod}-{rank}: {len(cv.colors())} colours')
        save(sheet_of(rows, 3), os.path.join(HERE, f'sheet-ranks-{mod}.png'))
        grid.append(rows)
    if len(grid) > 1:
        # every city side by side at 2x: one column per city, one row per rank
        sc, g = 2, 8
        w, h = W * sc, H * sc
        sheet = [[BG] * (len(grid) * (w + g) + g) for _ in range(5 * (h + g + 22) + g)]
        for col, rows in enumerate(grid):
            for row, (name, px) in enumerate(rows):
                ox, oy = g + col * (w + g), g + row * (h + g + 22)
                blit(sheet, scale(px, sc), ox, oy)
                text(sheet, name, ox, oy + h + 4, 2, WHITE)
        save(sheet, os.path.join(HERE, 'sheet-ranks.png'))


if __name__ == '__main__':
    main(sys.argv[1:])
