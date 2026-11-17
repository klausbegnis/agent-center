"""Render the five city banners, their fade variants, x1 originals and contact sheets.
Deterministic: every random source is seeded. Run: python3 cities.py"""
import os, sys, importlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from engine import *

CITIES = [('goldmill', 'Goldmill'), ('deepforge', 'Deepforge'), ('brinehaven', 'Brinehaven'),
          ('tallwood', 'Tallwood'), ('runespire', 'Runespire')]
BG = hexc('#12151B')


def fade(px):
    """Darken the lower-left corner toward the sidebar colour, in dithered steps."""
    out = [list(r) for r in px]
    for y in range(H):
        for x in range(W):
            u = x / (W * 0.62)
            v = (y - H * 0.38) / (H * 0.62)
            if u >= 1 or v <= 0:
                continue
            s = (1 - u) ** 1.2 * min(1.0, v) ** 1.1
            lvl = s * 4.0
            lo = int(lvl)
            if bay(x, y) < lvl - lo:
                lo += 1
            a = 0.17 * lo          # at most ~0.68 toward the background
            r, g, b = px[y][x]
            out[y][x] = (int(r + (BG[0] - r) * a), int(g + (BG[1] - g) * a), int(b + (BG[2] - b) * a))
    return out


def main(only=None):
    os.makedirs(os.path.join(HERE, 'x1'), exist_ok=True)
    arts = {}
    for mod, name in CITIES:
        if only and mod not in only:
            continue
        cv = importlib.import_module(mod).draw()
        px = cv.px
        n = len(cv.colors())
        arts[mod] = (px, fade(px))
        save(px, os.path.join(HERE, 'x1', f'{mod}.png'))
        save(fade(px), os.path.join(HERE, 'x1', f'{mod}-fade.png'))
        save(scale(px, 4), os.path.join(HERE, f'{mod}.png'))
        save(scale(arts[mod][1], 4), os.path.join(HERE, f'{mod}-fade.png'))
        print(f'{name:11s} {n} colours')
    if only:
        return
    # contact sheet: x3, name underneath
    sw, sh, lab = W * 3, H * 3, 34
    sheet = [[BG] * (sw + 24) for _ in range(5 * (sh + lab) + 12)]
    for i, (mod, name) in enumerate(CITIES):
        big = scale(arts[mod][0], 3)
        oy = 12 + i * (sh + lab)
        for y in range(sh):
            sheet[oy + y][12:12 + sw] = big[y]
        text(sheet, name, 12, oy + sh + 6, 3, (230, 232, 240))
    save(sheet, os.path.join(HERE, 'sheet.png'))
    # display-size sheet: x2 (384 px wide), fade variant with the name overlaid lower left
    gap = 10
    small = [[BG] * (W * 2 + 2 * gap) for _ in range(5 * (H * 2 + gap) + gap)]
    for i, (mod, name) in enumerate(CITIES):
        img = scale(arts[mod][1], 2)
        oy = gap + i * (H * 2 + gap)
        for y in range(H * 2):
            small[oy + y][gap:gap + W * 2] = img[y]
        text(small, name, gap + 10, oy + H * 2 - 24, 2, (255, 255, 255), shadow=(10, 12, 16))
    save(small, os.path.join(HERE, 'sheet-small.png'))
    for f in sorted(os.listdir(HERE)):
        if f.endswith('.png') and not f.startswith('_'):
            print(f, os.path.getsize(os.path.join(HERE, f)) // 1024, 'KB')


if __name__ == '__main__':
    main(sys.argv[1:] or None)
