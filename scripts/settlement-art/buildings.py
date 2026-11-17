"""The five key buildings as isolated sprites at three tiers (Village palette), for a building list UI.
Each sprite is the scene art itself, drawn on a small grass plinth on a transparent canvas."""
import os, math
from engine import *
from kit import *
import settlement as S

NAMES = [('hearth', 'Hearth'), ('workshop', 'Workshop'), ('rune-circle', 'Rune circle'),
         ('storehouse', 'Storehouse'), ('defences', 'Defences')]
ROMAN = {1: 'I', 2: 'II', 3: 'III'}
GR = {'G0', 'G1', 'G2'}


def plinth(cv, cx, cy, rx, ry):
    """Flat oval of grass with an earth lip: the tile every building stands on."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 4):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + 0.5 - cx) / rx
            d = math.hypot(dx, (y + 0.5 - cy) / ry)
            d2 = math.hypot(dx, (y + 0.5 - cy - 2) / ry)
            if d <= 1:
                s = dx * 0.7 + (y - cy) / ry * 0.5
                k = 'G2' if s < -0.25 else ('G1' if s < 0.45 else 'G0')
                if -0.45 < s < -0.2 and bay(x, y) < 0.5:
                    k = 'G1'
                if 0.35 < s < 0.6 and bay(x, y) < 0.5:
                    k = 'G0'
                cv.set(x, y, k)
            elif d2 <= 1:
                cv.set(x, y, 'E1' if dx < 0.2 else 'E0')
    # rim highlight on the lit edge
    for x in range(int(cx - rx), int(cx)):
        dx = (x + 0.5 - cx) / rx
        y = cy - ry * math.sqrt(max(0, 1 - dx * dx))
        cv.set(x, int(round(y)), 'G2')


def draw_one(key, tier):
    pal = S.stage_palette(4)
    w, h = 64, 64
    cv = Cv(pal, None, w, h)
    lv = tier + 2           # tiers I..III = the building at hamlet, village and town level
    lit = 0.3
    cx, gy = 30, 50
    if key == 'hearth':
        plinth(cv, cx - 1, gy, 24, 6)
        S.hearth(cv, lv, cx + 3, gy + 1, lit)
    elif key == 'workshop':
        plinth(cv, cx, gy, 23, 6)
        S.workshop(cv, lv, cx + 1, gy + 1, lit, GR)
    elif key == 'rune-circle':
        plinth(cv, cx, gy, 20, 6)
        S.rune(cv, lv, cx, gy + 2, lit, GR)
    elif key == 'storehouse':
        plinth(cv, cx, gy, 23, 6)
        S.store(cv, lv, cx + 2, gy - 1, lit)
    else:
        plinth(cv, cx, gy, 22, 6)
        if tier == 1:
            palisade(cv, [(cx - 20, gy + 2), (cx - 5, gy + 2)], 6)
            palisade(cv, [(cx + 5, gy + 2), (cx + 20, gy + 2)], 6)
            cv.vline(cx - 4, gy - 7, gy + 2, 'B2'); cv.vline(cx + 4, gy - 7, gy + 2, 'B1')
            cv.hline(cx - 5, cx + 5, gy - 7, 'B2'); cv.hline(cx - 5, cx + 5, gy - 6, 'K')
            flag(cv, cx - 4, gy - 14, 7, 'R1', 'R0', 5)
        elif tier == 2:
            palisade(cv, [(cx - 20, gy + 3), (cx - 5, gy + 3)], 6)
            palisade(cv, [(cx + 5, gy + 3), (cx + 20, gy + 3)], 6)
            cv.vline(cx - 4, gy - 6, gy + 3, 'B2'); cv.vline(cx + 4, gy - 6, gy + 3, 'B1')
            cv.hline(cx - 5, cx + 5, gy - 6, 'B2'); cv.hline(cx - 5, cx + 5, gy - 5, 'K')
            tower_wood(cv, cx + 8, gy + 1, 22, 7)
        else:
            wall_line(cv, [(cx - 21, gy + 3), (cx - 7, gy + 3)], 7)
            wall_line(cv, [(cx + 8, gy + 3), (cx + 21, gy + 3)], 7)
            gatehouse(cv, cx - 7, gy + 3, 15, 15, lit)
    # crop to the drawn pixels with a 1 px margin
    xs = [x for y in range(h) for x in range(w) if cv.px[y][x] is not None]
    ys = [y for y in range(h) for x in range(w) if cv.px[y][x] is not None]
    x0, x1, y0, y1 = max(0, min(xs) - 1), min(w, max(xs) + 2), max(0, min(ys) - 1), min(h, max(ys) + 2)
    return [row[x0:x1] for row in cv.px[y0:y1]], len(cv.colors())


def render(OUT, X1, HERE, report):
    sprites = {}
    for key, _ in NAMES:
        for t in (1, 2, 3):
            px, nc = draw_one(key, t)
            sprites[(key, t)] = px
            save(px, os.path.join(X1, f'building-{key}-{t}.png'))
            save(scale(px, 4), os.path.join(OUT, f'building-{key}-{t}.png'))
            report.append(f'building-{key}-{t}: {len(px[0])}x{len(px)} px, {nc} colours')
    # sheet: 5 columns (buildings) x 3 rows (tiers) at x4, labelled
    BG = hexc('#12151B')
    cw = max(len(p[0]) for p in sprites.values()) * 4 + 24
    chh = max(len(p) for p in sprites.values()) * 4
    lab = 26
    sheet = [[BG] * (5 * cw + 24) for _ in range(3 * (chh + lab + 12) + 12)]
    for c, (key, label) in enumerate(NAMES):
        for t in (1, 2, 3):
            px = scale(sprites[(key, t)], 4)
            ox = 12 + c * cw + (cw - len(px[0])) // 2
            oy = 12 + (t - 1) * (chh + lab + 12) + (chh - len(px))
            blit(sheet, px, ox, oy)
            s = f'{label} {ROMAN[t]}'
            tx = 12 + c * cw + (cw - len(s) * 12) // 2
            text(sheet, s, tx, 12 + (t - 1) * (chh + lab + 12) + chh + 8, 2, (230, 232, 240))
    save(sheet, os.path.join(HERE, 'sheet-buildings.png'))
