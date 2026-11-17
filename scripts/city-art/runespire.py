import random, math
from engine import *

PAL = {
    # night sky, indigo to violet at the horizon
    'N0': '#0a0a22', 'N1': '#15143d', 'N2': '#241d5a', 'N3': '#382a72', 'N4': '#55378a',
    # aurora
    'A0': '#1d7f86', 'A1': '#3fd3b2', 'A2': '#b5ffe2', 'AV': '#8b57d2',
    # stars
    'S1': '#e9e6ff', 'S2': '#8a86c6',
    # mountains / stone
    'M0': '#110e2a', 'T0': '#1d1840', 'T1': '#2f2865', 'T2': '#4c4494', 'T3': '#7d74c8',
    # gold light
    'G0': '#b2702f', 'G1': '#f2b84b', 'G2': '#ffe6a3',
    # crystal cyan
    'C0': '#2b78c2', 'C1': '#5be1ff', 'C2': '#dcfbff',
}

SPX = 128      # spire x
CRY = (SPX, 7)  # crystal centre
LAKE = 57


def draw():
    rng = random.Random(23)
    cv = Cv(PAL, 'N0')

    # ---------------------------------------------------------------- sky
    bands = [(0, 'N0'), (12, 'N1'), (26, 'N2'), (38, 'N3'), (48, 'N4')]
    for y in range(LAKE):
        for x in range(W):
            k = 'N0'
            for i, (y0, c) in enumerate(bands):
                if y >= y0:
                    k = c
                    if i + 1 < len(bands):
                        y1, c1 = bands[i + 1]
                        if y >= y1 - 4:
                            k = c1 if bay(x, y) < q4((y - (y1 - 4)) / 4) else c
            cv.set(x, y, k)
    for i in range(90):
        x, y = rng.randrange(W), rng.randrange(44)
        cv.set(x, y, 'S1' if i % 5 == 0 else 'S2')
    for (x, y) in ((14, 6), (60, 3), (176, 12), (96, 40), (30, 34)):
        cv.set(x, y, 'S1')
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            cv.set(x + d[0], y + d[1], 'S2')

    # ---------------------------------------------------------------- aurora curtains
    fold = smooth(mpd(random.Random(4), W, 1.0, 0.7), 2)
    for x in range(W):
        base = 22 + 6 * math.sin(x / 23.0 + 0.6) + 3 * math.sin(x / 9.0)
        inten = 0.5 + 0.5 * math.sin(x / 7.0 + fold[x] * 3) * math.cos(x / 31.0)
        inten = max(0.0, min(1.0, inten + fold[x] * 0.4))
        if 112 < x < 144:
            inten *= 0.6
        ln = int(6 + inten * 14 + ((x * 7) % 5) - 2 + (3 if (x // 3) % 4 == 0 else 0))
        for j in range(ln):
            y = int(round(base - j))
            t = j / ln
            if y < 0:
                continue
            if t < 0.12:
                k = 'A2' if inten > 0.65 and j == 0 else 'A1'
            elif t < 0.4:
                k = 'A1'
            elif t < 0.48:
                k = 'A1' if bay(x, y) < 0.5 else 'A0'
            elif t < 0.7:
                k = 'A0'
            elif t < 0.78:
                k = 'A0' if bay(x, y) < 0.5 else 'AV'
            elif t < 0.9:
                k = 'AV'
            else:
                if bay(x, y) < 0.5:
                    k = 'AV'
                else:
                    continue
            if inten < 0.22:
                k = {'A1': 'A0', 'A2': 'A1', 'A0': 'AV', 'AV': 'N3'}[k]
            cv.set(x, y, k)
        # a soft glow just under the curtain
        yb = int(round(base)) + 1
        if bay(x, yb) < inten * 0.6:
            cv.set(x, yb, 'A0')

    # ---------------------------------------------------------------- far mountains
    for (seed, base, amp, col, rim) in ((5, 44, 7, 'T0', 'T1'), (6, 50, 5, 'M0', 'T0')):
        m = mpd(random.Random(seed), W, amp, 0.55)
        for x in range(W):
            top = int(round(base + m[x] - 4 * math.exp(-((x - 30) / 20.0) ** 2)))
            for y in range(top, LAKE):
                cv.set(x, y, rim if y == top else col)

    # ---------------------------------------------------------------- crystal glow halo (behind everything on the island)
    cx, cy = CRY
    for y in range(0, 30):
        for x in range(cx - 24, cx + 25):
            d = math.hypot((x + 0.5 - cx - 0.5) * 0.85, y + 0.5 - cy - 0.5)
            k = cv.get(x, y)
            if k in ('N0', 'N1', 'N2', 'S2', 'AV', 'A0', 'A1'):
                if d < 5.5:
                    cv.set(x, y, 'N4')
                elif d < 8:
                    cv.set(x, y, 'N4' if bay(x, y) < 0.25 else 'N3')
                elif d < 11:
                    cv.set(x, y, 'N3' if bay(x, y) < 0.5 else 'N2')
                elif d < 15 and bay(x, y) < 0.25:
                    cv.set(x, y, 'N3' if k == 'N2' else 'N2')
    # ---------------------------------------------------------------- island rock
    rk = mpd(random.Random(9), W, 2.5, 0.6)
    for x in range(84, 192):
        u = (x - 84) / 108.0
        top = int(round(52 - 4 * math.sin(u * math.pi) + rk[x] * 0.7))
        for y in range(top, LAKE):
            d = y - top
            k = 'T1' if d < 2 else 'T0'
            if d == 0:
                k = 'T3' if abs(x - SPX) < 22 else 'T2'
            cv.set(x, y, k)
        cv.set(x, LAKE - 1, 'M0')

    def tower(x, top, base, hw, roof_h, lit_side):
        """Round tower with a violet cone roof, gold windows, rim lit on the side facing the crystal."""
        for y in range(top, base + 1):
            for xx in range(x - hw, x + hw + 1):
                u = (xx - (x - hw)) / max(1, 2 * hw)
                k = 'T1'
                if (u < 0.35 and lit_side < 0) or (u > 0.65 and lit_side > 0):
                    k = 'T1'
                if (lit_side < 0 and xx == x - hw) or (lit_side > 0 and xx == x + hw):
                    k = 'T2'
                if (lit_side < 0 and xx == x + hw) or (lit_side > 0 and xx == x - hw):
                    k = 'T0'
                cv.set(xx, y, k)
            if (y - top) % 6 == 5:
                cv.hline(x - hw, x + hw, y, 'T0')
        for wy in range(top + 2, base - 2, 5):
            cv.set(x, wy, 'G1'); cv.set(x, wy + 1, 'G0')
        # cone roof
        for i in range(roof_h):
            y = top - 1 - i
            hw2 = (hw + 1.5) * (1 - i / roof_h)
            x0, x1 = int(round(x - hw2)), int(round(x + hw2))
            for xx in range(x0, x1 + 1):
                k = 'AV' if (xx - x) * lit_side > 0 else 'N3'
                cv.set(xx, y, k)
            if i == 0:
                cv.hline(x0, x1, y, 'T0')
        cv.set(x, top - roof_h - 1, 'G1')   # finial light
        cv.hline(x - hw - 1, x + hw + 1, top, 'T3' if lit_side else 'T2')

    for x in range(86, 190):
        y = 50 if x % 4 else 49
        cv.set(x, y, 'T2' if x < SPX else 'T1'); cv.vline(x, 51, 53, 'T1')
    # houses at the foot of the towers
    for (hx, hy, w) in ((92, 52, 6), (102, 51, 7), (146, 50, 6), (168, 50, 8), (180, 51, 6), (112, 50, 5)):
        cv.rect(hx, hy - 4, hx + w, hy + 1, 'T1')
        cv.vline(hx + w - 1, hy - 4, hy, 'T0')
        for i in range(3):
            cv.hline(hx - 1 + i, hx + w - i, hy - 5 - i, 'N3' if i else 'T0')
            cv.set(hx - 1 + i, hy - 5 - i, 'AV')
        cv.set(hx + 2, hy - 2, 'G1')
        if w > 6:
            cv.set(hx + 5, hy - 2, 'G1')

    # smaller towers
    tower(88, 38, 52, 2, 5, +1)
    tower(178, 33, 50, 3, 7, -1)
    tower(104, 31, 50, 4, 8, +1)
    tower(157, 28, 49, 4, 9, -1)
    tower(116, 41, 50, 2, 5, +1)
    tower(142, 39, 50, 2, 5, -1)

    # ---------------------------------------------------------------- arcing bridges to the spire
    def arc(x1, y1, x2, y2, lift):
        for x in range(min(x1, x2), max(x1, x2) + 1):
            t = (x - x1) / (x2 - x1)
            y = int(round(y1 + (y2 - y1) * t - lift * 4 * t * (1 - t)))
            cv.set(x, y, 'T3'); cv.set(x, y + 1, 'T1'); cv.set(x, y + 2, 'T0')
            if x % 3 == 0:
                cv.set(x, y - 1, 'C1')   # rune lights along the parapet
    arc(108, 35, SPX - 3, 33, 6)
    arc(SPX + 2, 29, 153, 31, 5)
    arc(161, 35, 175, 37, 3)

    # ---------------------------------------------------------------- the spire
    top, base = 16, 53

    def spire_hw(y):
        if y >= 50:
            return 8
        if y >= 47:
            return 6.5
        if y >= 44:
            return 5
        t = (y - top) / (44 - top)
        hw = 1.2 + 2.6 * t ** 1.6
        for by in (23, 32, 40):
            if 0 <= y - by <= 1:
                hw += 2 - (y - by)
        return hw
    for y in range(top, base + 1):
        hw = spire_hw(y)
        x0, x1 = int(round(SPX - hw)), int(round(SPX + hw))
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            k = 'T3' if u < 0.34 else ('T2' if u < 0.67 else 'T1')
            if x == x0:
                k = 'C1' if y < 44 else 'T3'
            if x == x1:
                k = 'T0'
            cv.set(x, y, k)
        if y in (23, 32, 40, 44, 47, 50):
            cv.hline(x0, x1 - 1, y, 'C1' if y < 44 else 'T3')   # ledges catch the crystal light
            cv.set(x1, y, 'C0')
    # arched door glowing gold, and windows in the tiered base
    cv.rect(SPX - 1, 49, SPX + 2, 54, 'G1'); cv.set(SPX - 1, 49, 'T1'); cv.set(SPX + 1, 49, 'T1')
    cv.set(SPX, 53, 'G2')
    for wx in (SPX - 5, SPX + 5):
        cv.set(wx, 51, 'G1'); cv.set(wx, 52, 'G0')
    cv.set(SPX - 3, 45, 'G1'); cv.set(SPX + 3, 45, 'G1')
    # spiralling runes up the spire
    for gy in (19, 27):
        cv.hline(SPX - 3, SPX + 3, gy, 'N4')
        cv.set(SPX - 2, gy, 'C0'); cv.set(SPX + 2, gy, 'C0')
    for y in range(top + 2, base - 1):
        if y in (19, 27):
            continue
        if y >= 44:
            continue
        hw = spire_hw(y)
        ph = math.sin(y * 0.55) * (hw - 0.5)
        if y % 2 == 0:
            cv.set(int(round(SPX + ph)), y, 'C1' if y % 6 else 'C2')
    for y in (28, 37):
        cv.set(SPX, y, 'G1')
    # the pinnacle needle
    cv.vline(SPX, top - 2, top, 'C2')
    cv.set(SPX, top - 3, 'C1')

    # ---------------------------------------------------------------- floating crystal
    for y in range(cy - 8, cy + 7):
        dy = y + 0.5 - cy
        hw = 4.6 * (1 - abs(dy) / (8.0 if dy < 0 else 6.0))
        if hw <= 0:
            continue
        x0, x1 = int(round(cx - hw)), int(round(cx + hw))
        for x in range(x0, x1 + 1):
            if x < cx:
                k = 'C2' if (dy < 0 and x >= cx - 1) or x == x0 and dy < -1 else 'C1'
            elif x == cx:
                k = 'C2' if dy < 0 else 'C1'
            else:
                k = 'C1' if dy < 0 else 'C0'
            if dy > 0 and x < cx:
                k = 'C1' if x > x0 else 'C0'
            cv.set(x, y, k)
        cv.set(x0 - 1, y, 'C0') if abs(dy) < 4 else None
    cv.set(cx, cy - 9, 'C2')
    # sparkle cross: thin rays fading out
    for d in range(5, 15):
        if d < 9 or bay(cx + d, cy) < 0.5:
            cv.set(cx + d, cy, 'C1' if d < 8 else 'C0')
            cv.set(cx - d, cy, 'C1' if d < 8 else 'C0')
    # sparkle cross
    for d in (2, 3):
        cv.set(cx - 3 - d, cy - 2, 'C1' if d == 2 else 'C0')
        cv.set(cx + 3 + d, cy - 2, 'C1' if d == 2 else 'C0')

    # ---------------------------------------------------------------- floating shards and a floating islet
    def shard(x, y, s=2):
        for i in range(-s, s + 1):
            w = s - abs(i)
            for j in range(-w // 2 - (w % 2 and 0), w // 2 + 1):
                cv.set(x + j, y + i, 'C1' if j <= 0 and i <= 0 else 'C0')
        cv.set(x, y - s, 'C2')
    for (x, y, s) in ((117, 12, 2), (140, 15, 2), (112, 22, 1), (146, 9, 1), (136, 24, 1), (120, 3, 1), (168, 18, 1)):
        shard(x, y, s)
    # islet hovering left of the city
    ix, iy = 62, 32
    for i in range(8):
        w = 9 - i
        cv.hline(ix - w, ix + w - 1, iy + i, 'T1' if i < 2 else 'T0')
    cv.hline(ix - 9, ix + 8, iy, 'T3')
    cv.hline(ix - 9, ix - 1, iy, 'T3')
    cv.hline(ix, ix + 8, iy, 'T2')
    shard(ix - 2, iy - 3, 2); shard(ix + 3, iy - 2, 1)
    cv.vline(ix + 6, iy - 4, iy - 1, 'T1'); cv.set(ix + 6, iy - 5, 'G1')  # tiny lamp post
    for (x, y) in ((ix - 1, iy + 9), (ix + 1, iy + 11), (ix, iy + 13)):
        cv.set(x, y, 'C0')   # falling motes

    # ---------------------------------------------------------------- lake with reflections
    for y in range(LAKE, H):
        for x in range(W):
            k = 'N1' if bay(x, y) < q4((y - LAKE) / 14) else 'N2'
            cv.set(x, y, k)
    for y in range(LAKE, H):
        off = int(round(1.5 * math.sin(y * 1.3)))
        for x in range(W):
            sy = 2 * LAKE - 1 - y
            src = cv.get(x + off, sy)
            if y % 2 == 1:
                continue
            if src in ('G1', 'G2'):
                cv.hline(x - 1, x + 1, y, 'G0')
                continue
            m = {'C2': 'C1', 'C1': 'C0', 'G1': 'G0', 'G2': 'G1', 'T3': 'T1', 'T2': 'T1', 'T1': 'T0',
                 'AV': 'N3', 'N3': 'N2', 'N4': 'N3', 'T0': 'M0', 'M0': 'M0', 'A1': 'A0'}.get(src)
            if m:
                cv.set(x, y, m)
    for y in range(LAKE + 1, H):
        if y % 2 == 0:
            w = 1 + (y - LAKE) // 5
            j = int(round(math.sin(y * 1.1) * 1.5))
            cv.hline(SPX - w + j, SPX + w + j, y, 'C0')
            cv.set(SPX + j, y, 'C1')
    # the shore line glints
    for x in range(84, 192, 2):
        if cv.get(x, LAKE) not in ('M0',):
            cv.set(x, LAKE, 'T1')
    # little boat with a lantern, right of the text corner
    bx, by = 82, 63
    cv.hline(bx - 3, bx + 3, by, 'T0'); cv.hline(bx - 2, bx + 2, by + 1, 'M0')
    cv.set(bx + 2, by - 1, 'T1'); cv.set(bx + 2, by - 2, 'G1'); cv.set(bx - 1, by - 1, 'T2'); cv.set(bx - 1, by - 2, 'T2')
    cv.set(bx + 2, by + 2, 'G0'); cv.set(bx + 2, by + 4, 'G0')
    # ripple lines
    for (x, y, l) in ((20, 62, 6), (44, 66, 8), (150, 64, 7), (176, 69, 6), (8, 69, 5)):
        cv.hline(x, x + l, y, 'N3')
    return cv
