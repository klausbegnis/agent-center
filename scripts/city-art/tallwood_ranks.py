"""Tallwood in five ranks: the same sunlit forest with its waterfall, river and giant trees,
growing from a hunters' camp into a canopy city crowned by a palace. Same palette and drawing
code as the original Tallwood banner (its helpers are copied here), canvas 192x72."""
import random, math
from rank_engine import *

W, H = 192, 72

PAL = {
    # haze between the trees (lightest = far)
    'H0': '#a9c48f', 'H1': '#77a083', 'H2': '#4f7c6e', 'H3': '#35605a',
    # foliage, dark to sunlit
    'G0': '#0d1d1d', 'G1': '#163129', 'G2': '#234a37', 'G3': '#3a6b40', 'G4': '#719a43', 'G5': '#bccb5c',
    # bark and timber
    'B0': '#1e1519', 'B1': '#3a2829', 'B2': '#5f4234', 'B3': '#8d6447',
    # light
    'L0': '#f0cc72', 'L1': '#fff0b3', 'L2': '#c98a3c',
    # water
    'W0': '#1c3c48', 'W1': '#3d7480', 'W2': '#93c6bf', 'WH': '#ecf4dc',
    # roofs
    'RF': '#8b432f',
    # banners (town ranks)
    'BR': '#c9533c', 'BV': '#3f5f9a',
}


def shaft_mask(x, y):
    """0..1 strength of the golden light shafts slanting down to the right."""
    v = 0.0
    for (x0, w) in ((18, 7), (52, 4), (88, 9), (118, 3), (150, 6)):
        d = abs((x - x0) - y * 0.55)
        if d < w:
            v = max(v, 1 - d / w)
    return v


def conifer_row(cv, base, amp, seed, col, rim=None, spacing=(5, 9), hrange=(10, 20)):
    r = random.Random(seed)
    x = -4
    while x < W + 4:
        h = r.randint(*hrange)
        top = base - h
        wid = h * 0.32
        for y in range(top, H):
            t = (y - top) / max(1, h)
            hw = wid * min(1, t) + (0.6 if (y - top) % 3 == 2 else 0)
            for xx in range(int(round(x - hw)), int(round(x + hw)) + 1):
                k = col
                if rim and xx == int(round(x - hw)) and y < base:
                    k = rim
                cv.set(xx, y, k)
        x += r.randint(*spacing)


def trunk(cv, cx, w, top, bottom, seed, haze=False):
    """Giant trunk with root flare. Lit edge left, grooves wiggle down the bark."""
    r = random.Random(seed)
    wig = smooth(mpd(r, H + 1, 1.5, 0.5), 2)
    for y in range(top, bottom + 1):
        flare = 9 * math.exp((y - bottom) / 3.5)
        c = cx + wig[y] * 0.6
        x0, x1 = int(round(c - w / 2 - flare)), int(round(c + w / 2 + flare * 0.8))
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            if haze:
                k = 'H3' if u < 0.3 else 'G2'
                if (x - int(c + wig[(y * 3) % H])) % 3 == 0 and 0.1 < u < 0.9:
                    k = 'G2' if u < 0.3 else 'G1'
                if x == x0:
                    k = 'H2'
            else:
                k = 'B2'
                if u < 0.2:
                    k = 'B3'
                elif u > 0.72:
                    k = 'B1'
                if u > 0.9 or x == x1:
                    k = 'B0'
                groove = (x - int(c + wig[(y * 3) % H])) % 4 == 0
                if groove and 0.1 < u < 0.9:
                    k = 'B1' if u < 0.72 else 'B0'
                if x == x0:
                    k = 'L0' if shaft_mask(x, y) > 0.2 else 'B3'
                if u > 0.55 and ((x * 5 + y * 7) % 17 == 0):
                    k = 'G2'
            cv.set(x, y, k)


def platform_house(cv, cx, hw, y, roof='RF', big=True, lantern=True):
    """A round house wrapped around a trunk on a timber ring."""
    R = hw + (7 if big else 5)
    h = 6 if big else 4
    for yy in range(y - h, y + 1):
        for x in range(cx - R + 1, cx + R):
            u = (x - (cx - R)) / (2 * R)
            k = 'B3' if u < 0.35 else ('B2' if u < 0.75 else 'B1')
            if (x - cx) % 3 == 0:
                k = 'B1' if u > 0.3 else 'B2'
            cv.set(x, yy, k)
    for wx in range(cx - R + 3, cx + R - 2, 5):
        cv.set(wx, y - h + 2, 'L1'); cv.set(wx + 1, y - h + 2, 'L0')
        cv.set(wx, y - h + 3, 'L0'); cv.set(wx + 1, y - h + 3, 'L2')
    cv.set(cx - 1, y - 1, 'B0'); cv.set(cx - 1, y - 2, 'B0'); cv.set(cx, y - 1, 'B0'); cv.set(cx, y - 2, 'B0')
    for x in range(cx - R - 2, cx + R + 3):
        cv.set(x, y + 1, 'B3' if x < cx else 'B2')
        cv.set(x, y + 2, 'B0')
    for x in range(cx - R - 2, cx + R + 3, 3):
        cv.vline(x, y + 3, y + 4, 'B1')
    rh = 5 if big else 4
    for i in range(rh + 1):
        yy = y - h - 1 - i
        a = R + 2 - i * (R + 2 - hw + 1) / rh
        x0, x1 = int(round(cx - a)), int(round(cx + a))
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            if roof == 'RF':
                k = 'L2' if u < 0.25 else ('RF' if u < 0.7 else 'B1')
            elif roof == 'GOLD':
                k = 'L1' if u < 0.25 else ('L0' if u < 0.7 else 'L2')
            else:
                k = 'G4' if u < 0.3 else ('G3' if u < 0.7 else 'G2')
            if i == 0:
                k = 'B0' if u > 0.5 else 'B1'
            cv.set(x, yy, k)
        cv.set(x0, yy, 'L0' if i > 0 else 'B2')
    if lantern:
        cv.set(cx + R + 1, y + 3, 'B1'); cv.set(cx + R + 1, y + 4, 'L1'); cv.set(cx + R + 1, y + 5, 'L2')
    return R


def bridge(cv, x1, y1, x2, y2, sag, lanterns=0, haze=False, lamps=None):
    deck, deck2, under, rope = ('B3', 'B2', 'B0', 'B1') if not haze else ('H2', 'H3', 'G2', 'H3')
    for x in range(x1, x2 + 1):
        t = (x - x1) / max(1, x2 - x1)
        y = int(round(y1 + (y2 - y1) * t + sag * 4 * t * (1 - t)))
        cv.set(x, y, deck if x % 2 else deck2)
        cv.set(x, y + 1, under)
        ry = int(round(y1 + (y2 - y1) * t + sag * 0.6 * 4 * t * (1 - t))) - 4
        cv.set(x, ry, rope)
        if x % 3 == 0:
            cv.vline(x, ry + 1, y - 1, rope)
        if lanterns and (x - x1) % lanterns == lanterns // 2 and 1 < x - x1 < x2 - x1 - 1:
            cv.set(x, ry + 1, 'L1'); cv.set(x, ry + 2, 'L2')
            if lamps is not None:
                lamps.append((x, ry + 1))


def deer(cv, x, y, flip=False, antlers=True):
    d = -1 if flip else 1
    body = [(0, 0), (1, 0), (2, 0), (3, 0), (0, -1), (1, -1), (2, -1), (3, -1)]
    for bx, by in body:
        cv.set(x + bx * d, y + by, 'B2')
    for bx in (0, 1, 2, 3):
        cv.set(x + bx * d, y - 2 if bx in (1, 2) else y - 1, 'B2')
    cv.set(x + 3 * d, y - 2, 'B2')
    cv.set(x + 4 * d, y - 3, 'B2'); cv.set(x + 4 * d, y - 4, 'B2'); cv.set(x + 5 * d, y - 4, 'B2')
    cv.set(x + 6 * d, y - 3, 'B1')
    for lx in (0, 3):
        cv.vline(x + lx * d, y + 1, y + 2, 'B1')
    cv.set(x - d, y - 1, 'L1')
    if antlers:
        cv.set(x + 4 * d, y - 5, 'B1'); cv.set(x + 3 * d, y - 6, 'B1'); cv.set(x + 5 * d, y - 6, 'B1')
        cv.set(x + 2 * d, y - 6, 'B1')
    cv.set(x + (0 if not flip else 3) * 1, y - 1, 'L0')
    if not flip:
        cv.set(x + 4 * d, y - 4, 'L0')


# ====================================================================== rank additions

def figure(cv, x, yb, body='RF'):
    cv.set(x, yb - 3, 'B3'); cv.set(x, yb - 2, body); cv.set(x, yb - 1, body); cv.set(x, yb, 'B0')


def hazy_house(cv, cx, y, lit=False):
    """A platform house on a distant tree, drawn in haze tones."""
    cv.hline(cx - 10, cx + 10, y, 'H3'); cv.hline(cx - 9, cx + 9, y + 1, 'G2')
    cv.rect(cx - 7, y - 5, cx + 8, y, 'H2')
    for x in range(cx - 7, cx + 8, 3):
        cv.vline(x, y - 5, y - 1, 'H3')
    wk = 'L1' if lit else 'L0'
    cv.set(cx - 4, y - 3, wk); cv.set(cx + 1, y - 3, wk); cv.set(cx + 5, y - 4, wk)
    if lit:
        cv.set(cx - 4, y - 2, 'L0'); cv.set(cx + 1, y - 2, 'L0'); cv.set(cx + 5, y - 3, 'L0')
    for i in range(5):
        cv.hline(cx - 9 + i * 2, cx + 10 - i * 2, y - 6 - i, 'H3')
        cv.set(cx - 9 + i * 2, y - 6 - i, 'H1')


def banner(cv, x, y, n, col='BR'):
    """A cloth banner hanging from a short rod, with a gold emblem."""
    cv.hline(x - 1, x + 2, y, 'B0')
    for i in range(n):
        cv.set(x, y + 1 + i, col)
        cv.set(x + 1, y + 1 + i, 'RF' if col == 'BR' else 'B1')
    cv.set(x, y + 2, 'L0')
    cv.set(x, y + n + 1, col)


def pennant(cv, x, ytop, h, col='BR', n=4):
    cv.vline(x, ytop, ytop + h, 'B0')
    for i in range(n):
        dy = 1 if i in (1, 2) else 0
        cv.set(x + 1 + i, ytop + dy, col)
        if i < n - 2:
            cv.set(x + 1 + i, ytop + 1 + dy, 'RF' if col == 'BR' else 'B1')


def lantern_string(cv, x0, y0, x1, y1, sag, every, lamps):
    n = max(1, int(abs(x1 - x0)))
    cols = ('L1', 'BR', 'L1', 'L0')
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)
        cv.set(x, y, 'B1')
        if i % every == every // 2:
            c = cols[(i // every) % len(cols)]
            cv.set(x, y + 1, c)
            if c != 'BR':
                lamps.append((int(x), int(y + 1)))


def glow(cv, lamps, r=3.0, strength=1.3, only=None):
    """Warm halo around every lamp: lighten the pixels around it in dithered steps."""
    up = {'H0': 'L0', 'H1': 'H0', 'H2': 'H1', 'H3': 'H2', 'G0': 'G1', 'G1': 'G2', 'G2': 'G3', 'G3': 'G4',
          'B0': 'B1', 'B1': 'B2', 'B2': 'B3', 'W0': 'W1', 'W1': 'W2'}
    hit = {}
    for (lx, ly) in lamps:
        for y in range(int(ly - r) - 1, int(ly + r) + 2):
            for x in range(int(lx - r) - 1, int(lx + r) + 2):
                d = math.hypot(x - lx, (y - ly) * 1.2)
                if d < r:
                    hit[(x, y)] = max(hit.get((x, y), 0), 1 - d / r)
    for (x, y), s in hit.items():
        k = cv.get(x, y)
        if k in up and (only is None or k[0] in only) and bay(x, y) < q4(s * strength):
            cv.set(x, y, up[k])


def great_hall(cv, cx, y, R, h, gold=False, lamps=None):
    """The tree town's great hall: two storeys of timber wrapped round the giant trunk."""
    for yy in range(y - h, y + 1):
        for x in range(cx - R + 1, cx + R):
            u = (x - (cx - R)) / (2 * R)
            k = 'B3' if u < 0.3 else ('B2' if u < 0.75 else 'B1')
            if (x - cx) % 4 == 0:
                k = 'B1' if u > 0.3 else 'B2'
            cv.set(x, yy, k)
    mid = y - h // 2
    cv.hline(cx - R + 1, cx + R - 1, mid, 'B0')
    cv.hline(cx - R + 1, cx - R + 6, mid - 1, 'B3')
    for row in (y - h + 2, mid + 2):
        for wx in range(cx - R + 3, cx + R - 2, 4):
            if abs(wx - cx) <= 2:
                continue
            cv.set(wx, row, 'L1'); cv.set(wx + 1, row, 'L0')
            cv.set(wx, row + 1, 'L0'); cv.set(wx + 1, row + 1, 'L2')
    # big open doors with warm light
    cv.rect(cx - 2, y - 3, cx + 2, y + 1, 'L2'); cv.rect(cx - 1, y - 3, cx + 1, y + 1, 'L0')
    cv.set(cx - 1, y - 2, 'L1'); cv.hline(cx - 2, cx + 2, y - 4, 'B0')
    # ring and joists
    for x in range(cx - R - 3, cx + R + 4):
        cv.set(x, y + 1, 'B3' if x < cx else 'B2')
        cv.set(x, y + 2, 'B0')
    for x in range(cx - R - 3, cx + R + 4, 3):
        cv.vline(x, y + 3, y + 4, 'B1')
        cv.set(x, y + 5, 'B1') if (x - cx) % 6 == 0 else None
    # tiered roof: wide lower skirt, then a steep cap
    for i in range(7):
        yy = y - h - 1 - i
        a = R + 3 - i * (1.2 if i < 3 else 2.4)
        x0, x1 = int(round(cx - a)), int(round(cx + a))
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            if gold:
                k = 'L1' if u < 0.22 else ('L0' if u < 0.68 else 'L2')
            else:
                k = 'L2' if u < 0.22 else ('RF' if u < 0.68 else 'B1')
            if i in (0, 3):
                k = 'B0' if u > 0.5 else 'B1'
            cv.set(x, yy, k)
        cv.set(x0, yy, 'L1' if gold else 'L0')
    # hanging lanterns at the ends of the ring
    for lx in (cx - R - 2, cx + R + 2):
        cv.set(lx, y + 3, 'B1'); cv.set(lx, y + 4, 'L1'); cv.set(lx, y + 5, 'L2')
        if lamps is not None:
            lamps.append((lx, y + 4))
    # banners down the front
    banner(cv, cx - R + 4, y - h + 1, 5, 'BR')
    banner(cv, cx + R - 6, y - h + 1, 5, 'BV')


def turret(cv, x0, x1, ytop, ybot, roof_h, flagc=None):
    """A timber turret with a gold cone roof."""
    for y in range(ytop, ybot + 1):
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            k = 'B3' if u < 0.3 else ('B2' if u < 0.75 else 'B1')
            if x == x1:
                k = 'B0'
            cv.set(x, y, k)
    cx = (x0 + x1) / 2
    for wy in range(ytop + 2, ybot - 1, 4):
        cv.set(int(cx), wy, 'L1'); cv.set(int(cx), wy + 1, 'L2')
    hw0 = (x1 - x0) / 2 + 1.5
    for i in range(roof_h):
        yy = ytop - 1 - i
        hw = hw0 * (1 - i / roof_h)
        a, b = int(round(cx - hw)), int(round(cx + hw))
        for x in range(a, b + 1):
            k = 'L1' if x < cx - hw * 0.4 else ('L0' if x < cx + hw * 0.3 else 'L2')
            if i == 0:
                k = 'B1'
            cv.set(x, yy, k)
    tip = ytop - roof_h - 1
    cv.set(int(round(cx)), tip, 'L1')
    if flagc:
        pennant(cv, int(round(cx)), tip - 5, 4, flagc, 4)


def lift(cv, x, ytop, ybot, basket_y):
    """A rope lift: twin ropes, a pulley and a basket."""
    cv.vline(x, ytop, ybot, 'B1'); cv.vline(x + 3, ytop, ybot, 'B1')
    cv.hline(x, x + 3, ytop, 'B0'); cv.set(x + 1, ytop + 1, 'B3')
    cv.rect(x - 1, basket_y, x + 5, basket_y + 3, 'B2')
    cv.hline(x - 1, x + 4, basket_y, 'B3'); cv.vline(x + 4, basket_y, basket_y + 2, 'B1')
    cv.hline(x - 1, x + 4, basket_y + 3, 'B0')
    cv.set(x + 1, basket_y - 1, 'B3'); cv.set(x + 2, basket_y - 1, 'BV')


def logs(cv, x, y, rows):
    """A pyramid of stacked logs, end grain facing us."""
    for r in range(rows):
        n = rows - r
        for i in range(n):
            lx = x + i * 3 + r * 1.5
            ly = y - r * 2
            cv.set(lx, ly, 'L0'); cv.set(lx + 1, ly, 'B3'); cv.set(lx, ly + 1, 'B3'); cv.set(lx + 1, ly + 1, 'B1')
            cv.set(lx + 2, ly + 1, 'B0')


def water_wheel(cv, wx, wy, wr):
    for y in range(wy - wr - 1, wy + wr + 2):
        for x in range(wx - wr - 1, wx + wr + 2):
            d = math.hypot(x - wx, y - wy)
            a = math.atan2(y - wy, x - wx)
            if wr - 1.2 <= d <= wr + 0.3:
                cv.set(x, y, 'B3' if (x < wx) else 'B1')
            elif d < wr - 1.2 and (abs(math.sin(a * 4)) < 0.25 or d < 1.2):
                cv.set(x, y, 'B2')
            elif wr + 0.3 < d <= wr + 1.3 and int((a + 3.2) * 8 / 6.4 * 2) % 2 == 0:
                cv.set(x, y, 'B0')
    for (x, y) in ((wx - 6, wy + 4), (wx - 7, wy + 5), (wx - 5, wy + 6), (wx + 3, wy + 6), (wx - 8, wy + 6)):
        if wr >= 5 or y <= wy + 5:
            cv.set(x + (6 - wr), y - (6 - wr), 'WH')


def smoke(cv, x, y, n=9):
    sx, sy = x, y
    for j in range(n):
        sx += 0.5 + j * 0.06
        sy -= 1
        k = 'H1' if j < 4 else 'H0'
        cv.set(sx, sy, k)
        if 2 < j < n - 2:
            cv.set(sx + 1, sy, k)


def sawmill(cv, mx, my, big=False):
    if big:
        # a second, longer wing with a saw shed open to the river
        cv.rect(mx + 14, my - 6, mx + 26, my + 1, 'B2')
        for x in range(mx + 14, mx + 26):
            if (x - mx) % 2 == 0:
                cv.vline(x, my - 6, my, 'B1')
        cv.vline(mx + 25, my - 6, my, 'B0')
        for i in range(4):
            cv.hline(mx + 13 + i, mx + 27 - i, my - 7 - i, 'RF')
            cv.set(mx + 27 - i, my - 7 - i, 'B1')
        cv.hline(mx + 13, mx + 27, my - 7, 'B1')
        cv.rect(mx + 16, my - 4, mx + 24, my + 1, 'B0')
        cv.hline(mx + 16, mx + 23, my - 1, 'B3')      # a log on the saw bench
        cv.set(mx + 16, my - 1, 'L0')
        cv.set(mx + 20, my - 3, 'L1'); cv.set(mx + 20, my - 2, 'B3')   # blade glint
        cv.set(mx + 22, my - 4, 'L1')
    cv.rect(mx, my - 9, mx + 14, my + 1, 'B2')
    for x in range(mx, mx + 14):
        for y in range(my - 9, my + 1):
            if (x - mx) % 2 == 0:
                cv.set(x, y, 'B3' if x < mx + 6 else 'B1')
    cv.vline(mx + 13, my - 9, my, 'B0')
    for i in range(6):
        cv.hline(mx - 2 + i, mx + 15 - i, my - 10 - i, 'RF')
        cv.set(mx - 2 + i, my - 10 - i, 'L2'); cv.set(mx + 15 - i, my - 10 - i, 'B1')
    cv.hline(mx - 2, mx + 15, my - 10, 'B1')
    cv.rect(mx + 3, my - 6, mx + 6, my - 3, 'L1'); cv.set(mx + 5, my - 4, 'L0')
    cv.rect(mx + 8, my - 5, mx + 11, my + 1, 'B0')
    cv.vline(mx + 7, my - 13, my - 10, 'B1'); cv.set(mx + 7, my - 14, 'B2')
    for j in range(8):
        cv.set(mx + 8 + j // 2, my - 15 - j, 'H1' if j < 5 else 'H0')
    water_wheel(cv, mx - 4, my - 1, 6 if not big else 7)


def draw(rank):
    T = rank
    rng = random.Random(3)
    cv = Cv(PAL, 'H0', W, H)
    lamps = []

    # ---------------------------------------------------------------- deep haze
    for y in range(H):
        for x in range(W):
            k = 'H0' if y < 26 else ('H1' if bay(x, y) < q4((y - 26) / 10) else 'H0')
            if y >= 36:
                k = 'H1'
            cv.set(x, y, k)
    conifer_row(cv, 40, 0, 11, 'H1', spacing=(4, 7), hrange=(10, 22))
    conifer_row(cv, 46, 0, 12, 'H2', rim='H1', spacing=(5, 9), hrange=(12, 26))

    # ---------------------------------------------------------------- cliff and waterfall
    cliff = smooth(mpd(random.Random(6), W, 3, 0.55), 1)

    def ctop(x):
        e = max(0, abs(x - 64) - 22)
        return int(round(22 + cliff[x] * 0.5 + e * 0.9))
    for x in range(34, 96):
        top = ctop(x)
        for y in range(top, 52):
            d = y - top
            off = [0, 2, 1, 3, 1, 0, 2, 3, 1, 2, 0, 3, 2, 1][(x // 4 + (y // 7)) % 14]
            ledge = (y + off) % 7
            k = 'H3'
            if ledge == 0:
                k = 'H2'
            elif ledge == 1:
                k = 'G2'
            if (x * 13 + (y // 3) * 7) % 23 == 0:
                k = 'G2'
            if x > 72:
                k = 'G2' if k != 'H2' else 'H3'
            if d < 2:
                k = 'G4' if d == 0 else 'G3'
            elif d < 4 and (x + y) % 3 == 0:
                k = 'G3'
            cv.set(x, y, k)
    WF0, WF1 = 58, 69
    for x in range(WF0, WF1 + 1):
        top = ctop(x) - 1
        for y in range(top, 50):
            u = (x - WF0) / (WF1 - WF0)
            stripe = (x * 7) % 5
            k = 'W2' if stripe in (0, 2) else ('WH' if stripe == 1 else 'W1')
            if (y + x * 3) % 7 == 0:
                k = 'WH'
            if u > 0.8:
                k = 'W1' if stripe else 'W2'
            if x == WF0 or x == WF0 + 1:
                k = 'WH'
            cv.set(x, y, k)
        cv.set(x, top - 1, 'W2')
    for (sx, sy, r_) in ((58, 49, 3), (64, 48, 4), (70, 49, 3), (62, 51, 3)):
        for y in range(sy - r_, sy + r_ + 1):
            for x in range(sx - r_ - 1, sx + r_ + 2):
                if (x - sx) ** 2 * 0.6 + (y - sy) ** 2 <= r_ * r_:
                    cv.set(x, y, 'WH' if (x + y) % 2 == 0 or y < sy else 'W2')

    # ---------------------------------------------------------------- light shafts
    lighten = {'H0': 'L1', 'H1': 'H0', 'H2': 'H1', 'H3': 'H2', 'G2': 'G3', 'G1': 'G2', 'G3': 'G4', 'W1': 'W2'}
    for y in range(H):
        for x in range(W):
            m = shaft_mask(x, y) * (1 - y / 120)
            k = cv.get(x, y)
            if k in lighten and (m > 0.55 or bay(x, y) < q4(m * 1.6)):
                nk = lighten[k]
                if nk == 'L1' and m < 0.75:
                    nk = 'L0' if bay(x, y) < 0.5 else 'H0'
                cv.set(x, y, nk)

    # ---------------------------------------------------------------- distant giants, hazy
    trunk(cv, 98, 9, 0, 54, 21, haze=True)
    if T >= 3:
        trunk(cv, 24, 8, 0, 46, 23, haze=True)

    # ---------------------------------------------------------------- ridge with deer
    ridge = smooth(mpd(random.Random(15), W, 2.5, 0.5), 2)

    def rtop(x):
        return int(round(42 - 2.5 * math.sin(x / 60 * math.pi) + ridge[x] * 0.5))
    for x in range(0, 60):
        top = rtop(x)
        for y in range(top, H):
            d = y - top
            k = 'G2' if d < 3 else ('G1' if d < 10 else 'G0')
            if d == 0:
                k = 'G4' if shaft_mask(x, y) > 0.2 else 'G3'
            cv.set(x, y, k)
        if x % 3 == 0:
            cv.set(x, top - 1, 'G3')
    deer(cv, 20, rtop(20) - 3)
    deer(cv, 30, rtop(30) - 3, antlers=False)
    deer(cv, 12, rtop(12) - 3, flip=True, antlers=False)
    if T == 1:
        deer(cv, 40, rtop(40) - 3, flip=True)

    # ---------------------------------------------------------------- river
    for y in range(50, H):
        for x in range(44, W):
            top_bank = 50 + max(0, (x - 70)) * 0.06
            bot_bank = 56 + max(0, (x - 60)) * 0.1 + (x - 60) ** 2 * 0.0006
            if top_bank <= y <= bot_bank and x >= 46 + (y - 50) * 0.5:
                k = 'W1'
                if y > bot_bank - 2:
                    k = 'W0'
                elif y > bot_bank - 4 and bay(x, y) < 0.5:
                    k = 'W0'
                cv.set(x, y, k)
    r_ = random.Random(77)
    for y in range(50, H):
        for _ in range(6):
            x = r_.randrange(46, W)
            if cv.get(x, y) in ('W1', 'W0') and y % 2 == 1:
                ln = r_.randint(2, 5)
                for xx in range(x, x + ln):
                    if cv.get(xx, y) in ('W1', 'W0'):
                        cv.set(xx, y, 'W2' if shaft_mask(xx, y) > 0.25 or r_.random() < 0.3 else ('W1' if cv.get(xx, y) == 'W0' else 'W2'))
    for x in range(46, W):
        tb = int(round(50 + max(0, (x - 70)) * 0.06)) - 1
        cv.set(x, tb, 'G3' if x % 4 else 'G4')
    for x in range(44, W):
        bb = int(round(56 + max(0, (x - 60)) * 0.1 + (x - 60) ** 2 * 0.0006)) + 1
        for y in range(bb, H):
            d = y - bb
            k = 'G2' if d < 2 else ('G1' if d < 6 else 'G0')
            cv.set(x, y, k)
        cv.set(x, bb, 'G3')

    # ---------------------------------------------------------------- the mill by the river
    mx, my = 104, 52
    if T == 1:
        # hunters' camp: a lean-to of poles and boughs, a fire and a little wheel
        cv.poly([(104, 44), (104, 53), (117, 53)], 'B0')
        cv.hline(106, 112, 52, 'BR'); cv.hline(107, 111, 51, 'RF'); cv.set(106, 51, 'B3')   # bedroll
        cv.poly([(100, 44.5), (104, 40.5), (121, 52.5), (117, 54.5)], 'B2')
        for i in range(19):
            x = 101 + i
            y = 41.5 + i * 0.66
            cv.set(x, y, 'G4' if i % 3 else 'G5')
            cv.set(x + 1, y + 1, 'G3' if i % 2 else 'B3')
            cv.set(x - 1, y + 3, 'B1')
        cv.vline(104, 44, 53, 'B1'); cv.set(104, 43, 'B3')
        water_wheel(cv, 97, my, 4)
        cv.hline(97, 103, my - 1, 'B1')
        # fire with smoke
        fx = mx + 20
        cv.set(fx, my, 'L2'); cv.set(fx + 1, my, 'L0'); cv.set(fx, my - 1, 'L1'); cv.set(fx + 1, my - 2, 'L0')
        cv.set(fx - 1, my + 1, 'B1'); cv.set(fx + 2, my + 1, 'B1'); cv.hline(fx - 1, fx + 2, my + 1, 'B2')
        smoke(cv, fx + 1, my - 3, 12)
        lamps.append((fx, my - 1))
        figure(cv, fx + 4, my + 1, 'RF')
        figure(cv, fx - 3, my + 1, 'G3')
        # drying rack with a hide
        cv.vline(mx + 27, my - 5, my + 1, 'B1'); cv.vline(mx + 32, my - 5, my + 1, 'B1')
        cv.hline(mx + 26, mx + 33, my - 5, 'B2')
        cv.rect(mx + 28, my - 4, mx + 32, my - 1, 'B3'); cv.set(mx + 31, my - 2, 'B2'); cv.set(mx + 28, my - 4, 'L2')
    else:
        sawmill(cv, mx, my, big=T >= 4)
        if T >= 4:
            figure(cv, 120, 54, 'BV')
            for (x, y) in ((86, 56), (90, 57)):      # logs floating down to the mill
                cv.hline(x, x + 4, y, 'B3'); cv.set(x, y, 'L0'); cv.hline(x + 1, x + 4, y + 1, 'B1')
        else:
            for (lx, ly) in ((122, 55), (125, 55), (128, 55), (123.5, 53), (126.5, 53), (125, 51)):
                cv.set(lx, ly, 'B3'); cv.set(lx + 1, ly, 'B2'); cv.set(lx, ly + 1, 'B2'); cv.set(lx + 1, ly + 1, 'B1')
                cv.set(lx, ly, 'L0')
            cv.set(131, 51, 'B3'); cv.set(131, 52, 'RF'); cv.set(131, 53, 'RF'); cv.set(131, 54, 'B0'); cv.set(132, 52, 'B1'); cv.set(133, 51, 'B2')

    # log raft on the stream
    if T >= 3:
        rx, ry = 78, 54
        for x in range(rx, rx + 10):
            cv.set(x, ry, 'B3' if x % 3 else 'L0'); cv.set(x, ry + 1, 'B1')
        cv.hline(rx + 1, rx + 9, ry + 2, 'W0')
        figure(cv, rx + 6, ry - 1, 'BV' if T >= 4 else 'RF')
        cv.line(rx + 8, ry - 6, rx + 3, ry + 2, 'B2')
        if T >= 4:
            cv.set(rx + 2, ry - 1, 'B2'); cv.set(rx + 3, ry - 1, 'B3'); cv.set(rx + 2, ry - 2, 'L0')   # cargo

    # ---------------------------------------------------------------- the great trees
    trunk(cv, 146, 16, 0, 62, 31)
    trunk(cv, 186, 12, 0, 60, 32)

    if T >= 4:
        logs(cv, 123, 57, 4)
    if T == 1:
        # one bare platform with a hide tent, reached by a ladder
        y = 38
        for x in range(133, 160):
            cv.set(x, y + 1, 'B3' if x < 146 else 'B2'); cv.set(x, y + 2, 'B0')
        for x in range(133, 160, 3):
            cv.vline(x, y + 3, y + 4, 'B1')
        for x in range(133, 160, 4):
            cv.vline(x, y - 2, y, 'B1')
        cv.hline(133, 159, y - 3, 'B2')
        for i in range(6):          # hide tent leaning on the trunk
            cv.hline(134 + i, 140 + i // 2, y - i, 'B3' if i % 2 else 'L2')
            cv.set(140 + i // 2, y - i, 'B1')
        cv.set(136, y, 'B0'); cv.set(137, y, 'B0')
        for y_ in range(y + 3, 61):
            cv.set(158, y_, 'B1'); cv.set(160, y_, 'B1')
            if y_ % 2 == 0:
                cv.set(159, y_, 'B2')
        figure(cv, 153, y, 'G3')
        cv.line(154, y - 3, 157, y - 6, 'B2')     # a bow held up
        cv.set(155, y - 6, 'B1')
    else:
        hall = T >= 4
        if T == 5:
            great_hall(cv, 146, 27, 19, 9, gold=True, lamps=lamps)
        elif T == 4:
            great_hall(cv, 146, 25, 19, 9, lamps=lamps)
        else:
            platform_house(cv, 146, 9, 22, roof='RF')
        platform_house(cv, 146, 9, 42 if not hall else (44 if T == 4 else 45), roof='G', big=True)
        platform_house(cv, 186, 7, 32, roof='RF', big=False)
        if T >= 4:
            platform_house(cv, 186, 7, 52, roof='G', big=False)
        if T >= 2:
            if hall:
                bridge(cv, 103, 18, 125, 22, 4, lanterns=6, lamps=lamps)
            else:
                bridge(cv, 103, 18, 129, 21, 4, lanterns=6 if T >= 3 else 0, lamps=lamps)
            bridge(cv, 165, 41 if hall else 39, 175, 34, 2, lanterns=5 if T >= 3 else 0, lamps=lamps)
        # distant platforms on the hazy tree
        hazy_house(cv, 98, 19, lit=T >= 4)
        if T >= 3:
            hazy_house(cv, 98, 36, lit=T >= 4)
            hazy_house(cv, 24, 22, lit=T >= 4)
            bridge(cv, 35, 22, 87, 19, 5, haze=True)
            if T >= 4:
                for x in range(38, 86, 6):
                    t = (x - 35) / 52
                    yy = int(round(22 - 3 * t + 0.6 * 20 * t * (1 - t))) - 3
                    cv.set(x, yy, 'L1')
                    lamps.append((x, yy))
        if T >= 4:
            hazy_house(cv, 24, 36, lit=True)
        # ladder
        ly0 = 46 if hall else 44
        for y in range(ly0, 61):
            cv.set(160, y, 'B1'); cv.set(158, y, 'B1')
            if y % 2 == 0:
                cv.set(159, y, 'B2')
        if T >= 3:
            figure(cv, 159, 52, 'BV')

    # ---------------------------------------------------------------- canopy overhead
    can = smooth(mpd(random.Random(44), W, 4, 0.6), 1)
    for x in range(W):
        bot = int(round(5 + can[x] + 3 * math.sin(x / 9.0)))
        if 70 < x < 125:
            bot -= 3
        for y in range(0, max(0, bot) + 1):
            d = bot - y
            k = 'G1' if d > 2 else ('G2' if d > 0 else 'G3')
            cv.set(x, y, k)
    r = random.Random(8)
    for i in range(26):
        cx, cy, rr = r.randrange(W), r.randint(4, 10), r.randint(2, 4)
        if 74 < cx < 122:
            continue
        if T == 5 and 124 < cx < 170:
            continue
        for y in range(cy - rr, cy + rr + 1):
            for x in range(cx - rr - 1, cx + rr + 2):
                dx, dy = (x - cx) / (rr + 1), (y - cy) / rr
                if dx * dx + dy * dy <= 1:
                    k = 'G2'
                    if dx + dy < -0.6:
                        k = 'G4'
                    elif dx + dy < 0:
                        k = 'G3'
                    elif dx + dy > 0.8:
                        k = 'G1'
                    cv.set(x, y, k)
    for vx in (38, 83, 133, 171):
        ln = r.randint(8, 16)
        if vx == 133 and T >= 4:
            continue
        for y in range(4, 4 + ln):
            cv.set(vx + (1 if (y // 4) % 2 else 0), y, 'G3')
        cv.set(vx, 4 + ln, 'G4')

    # ---------------------------------------------------------------- crowns of the giant tree
    if T == 3 or T == 4:
        # lookout above the top house, flag in the canopy
        top = 9 if T == 3 else 7
        cv.vline(146, top - 6, top + 2, 'B0')
        cv.rect(142, top, 151, top + 3, 'B2'); cv.hline(142, 150, top, 'B3'); cv.vline(150, top, top + 2, 'B1')
        cv.hline(141, 151, top + 3, 'B0')
        figure(cv, 144, top - 1, 'G3')
        pennant(cv, 146, top - 6, 2, 'BR', 5)
    if T == 5:
        # the palace crowning the giant tree: corner towers and a gold-crowned keep on the hall
        turret(cv, 123, 129, 9, 27, 7, 'BV')
        turret(cv, 163, 169, 9, 27, 7, 'BR')
        for y in range(5, 13):      # central keep rising from the hall roof
            for x in range(140, 153):
                u = (x - 140) / 12
                k = 'B3' if u < 0.3 else ('B2' if u < 0.75 else 'B1')
                if x == 152:
                    k = 'B0'
                cv.set(x, y, k)
        for wx in (142, 146, 150):
            cv.set(wx, 7, 'L1'); cv.set(wx, 8, 'L0'); cv.set(wx, 9, 'L2')
        cv.hline(139, 153, 12, 'B0'); cv.hline(139, 153, 11, 'B3')
        for i in range(5):
            a_ = 8.5 - i * 1.9
            for x in range(int(round(146 - a_)), int(round(146 + a_)) + 1):
                u = (x - (146 - a_)) / (2 * a_)
                k = 'L1' if u < 0.25 else ('L0' if u < 0.7 else 'L2')
                if i == 0:
                    k = 'B1'
                cv.set(x, 4 - i, k)
        cv.set(146, 0, 'L1')
        for x in (129, 163):
            lamps.append((x, 30))
        # rope lifts from the platforms to the forest floor
        lift(cv, 127, 47, 60, 53)
        lift(cv, 167, 37, 62, 46)
        # banners on the giant trunks
        banner(cv, 180, 38, 6, 'BV')
        banner(cv, 190, 38, 6, 'BR')

    # ---------------------------------------------------------------- lantern strings and banners
    if T == 5:
        lantern_string(cv, 104, 22, 125, 30, 3, 3, lamps)
        lantern_string(cv, 170, 25, 178, 24, 1, 3, lamps)
        lantern_string(cv, 102, 41, 128, 49, 3, 3, lamps)
        lantern_string(cv, 164, 48, 178, 47, 2, 3, lamps)
        lantern_string(cv, 89, 26, 108, 25, 2, 3, lamps)
        for (x, y) in ((88, 41), (108, 42), (98, 30)):
            cv.set(x, y, 'B1'); cv.set(x, y + 1, 'L1'); lamps.append((x, y + 1))

    # ---------------------------------------------------------------- foreground ferns
    for (fx, fy, s) in ((170, 72, 9), (180, 72, 8), (160, 72, 6), (6, 72, 5), (90, 72, 5)):
        for a in (-1.2, -0.7, -0.25, 0.25, 0.7, 1.2):
            for t in range(s):
                x = fx + math.sin(a) * t
                y = fy - math.cos(a) * t + (t * t) * 0.03 * abs(a) * 2
                cv.set(x, y, 'G1')
                if t % 2 == 0 and t > 1:
                    cv.set(x + (1 if a > 0 else -1), y + 1, 'G2' if a < 0 else 'G1')

    # ---------------------------------------------------------------- light: pollen, lanterns, fireflies
    if T >= 3:
        glow(cv, lamps, 2.6 if T < 5 else 3.4)
    if T == 5:
        glow(cv, [(146, 16)], 30, 0.8, only='HG')       # festival glow around the palace
    for i in range(12):
        x, y = r.randrange(40, 180), r.randrange(14, 48)
        if shaft_mask(x, y) > 0.3 and cv.get(x, y) in ('H0', 'H1', 'H2'):
            cv.set(x, y, 'L1')
    if T == 5:
        rf = random.Random(41)
        n = 0
        while n < 34:
            x, y = rf.randrange(78, 192), rf.randrange(10, 64)
            if cv.get(x, y) in ('H0', 'H1', 'H2', 'H3', 'G1', 'G2'):
                cv.set(x, y, 'L1')
                if n % 3 == 0:
                    cv.set(x + 1, y, 'L0')
                n += 1
    return cv
