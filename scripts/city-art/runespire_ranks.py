"""Runespire in five ranks: the same violet island under a green aurora, mirrored in a still
lake, growing from a lone scribes' tower into an arcane capital whose great spire throws a
beam into the sky. Same palette and drawing code as the original Runespire banner (its
helpers are copied here), canvas 192x72."""
import random, math
from rank_engine import *

W, H = 192, 72

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
    # banners (city ranks)
    'RM': '#d2508e',
}

SPX = 128      # spire x
LAKE = 57


def draw(rank):
    T = rank
    rng = random.Random(23)
    cv = Cv(PAL, 'N0', W, H)
    CRY = {1: (SPX, 13), 2: (SPX, 7), 3: (SPX, 7), 4: (SPX, 7), 5: (SPX, 6)}[T]
    cs = {1: 0.5, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.2}[T]

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
            inten *= 0.6 if T < 5 else 0.3
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

    # ---------------------------------------------------------------- crystal glow halo
    def halo(cx, cy, s):
        for y in range(max(0, int(cy - 16 * s)), int(cy + 16 * s)):
            for x in range(int(cx - 25 * s), int(cx + 26 * s)):
                d = math.hypot((x - cx) * 0.85, y - cy) / s
                k = cv.get(x, y)
                if k in ('N0', 'N1', 'N2', 'S2', 'AV', 'A0', 'A1', 'T0', 'M0') and (k not in ('T0', 'M0') or d < 8):
                    if d < 5.5:
                        cv.set(x, y, 'N4')
                    elif d < 8:
                        cv.set(x, y, 'N4' if bay(x, y) < 0.25 else 'N3')
                    elif d < 11:
                        cv.set(x, y, 'N3' if bay(x, y) < 0.5 else 'N2')
                    elif d < 15 and bay(x, y) < 0.25:
                        cv.set(x, y, 'N3' if k == 'N2' else 'N2')
    halo(CRY[0], CRY[1], {1: 0.55, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.35}[T])
    if T >= 4:
        halo(172, 19, 0.45)

    # ---------------------------------------------------------------- the beam (V): straight up from the crystal
    if T == 5:
        bx = CRY[0]
        for y in range(0, CRY[1]):
            for dx in range(-6, 7):
                a = abs(dx)
                k = cv.get(bx + dx, y)
                if a == 0:
                    cv.set(bx, y, 'C2')
                elif a == 1:
                    cv.set(bx + dx, y, 'C1')
                elif a == 2:
                    cv.set(bx + dx, y, 'C1' if bay(bx + dx, y) < 0.5 else 'C0')
                elif a == 3:
                    cv.set(bx + dx, y, 'C0')
                elif a == 4 and bay(bx + dx, y) < 0.5:
                    cv.set(bx + dx, y, 'C0')
                elif a == 6 and bay(bx + dx, y) < 0.25:
                    cv.set(bx + dx, y, 'N4')
                elif a == 5:
                    cv.set(bx + dx, y, 'C0' if k in ('N4', 'N3') else 'N4')
        # rays fanning up from the crystal to the top edge, so the light reads as a beam although the
        # crystal stands near the top: two pairs of faint shafts either side of the column
        for spread, keep in ((9, 0.6), (18, 0.35), (28, 0.2)):
            for side in (-1, 1):
                for y in range(0, CRY[1] + 1):
                    t = 1 - y / max(1, CRY[1])
                    x = bx + side * (3 + spread * (1 - t))
                    for w in (0, 1):
                        if cv.get(x + w * side, y) in ('N0', 'N1', 'N2', 'N3', 'AV', 'A0', 'A1') and bay(int(x) + w, y) < keep:
                            cv.set(x + w * side, y, 'C0' if w == 0 else 'N4')
        # rune circle in the sky around the crystal
        for i in range(120):
            a = i / 120 * 2 * math.pi
            x = CRY[0] + math.cos(a) * 17
            y = CRY[1] + 1 + math.sin(a) * 5.5
            if i % 8 < 5:
                cv.set(x, y, 'C1' if math.sin(a) > 0 else 'C0')
            elif i % 8 == 6:
                cv.set(x, y, 'C2')

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

    def tower(x, top, base, hw, roof_h, lit_side, windows=1, flag=None):
        """Round tower with a violet cone roof, gold windows, rim lit on the side facing the crystal."""
        for y in range(top, base + 1):
            for xx in range(x - hw, x + hw + 1):
                k = 'T1'
                if (lit_side < 0 and xx == x - hw) or (lit_side > 0 and xx == x + hw):
                    k = 'T2'
                if (lit_side < 0 and xx == x + hw) or (lit_side > 0 and xx == x - hw):
                    k = 'T0'
                cv.set(xx, y, k)
            if (y - top) % 6 == 5:
                cv.hline(x - hw, x + hw, y, 'T0')
        for wy in range(top + 2, base - 2, 5):
            if windows == 1 or hw < 3:
                cv.set(x, wy, 'G1'); cv.set(x, wy + 1, 'G0')
            else:
                for wx in (x - hw + 1, x + hw - 1):
                    cv.set(wx, wy, 'G1'); cv.set(wx, wy + 1, 'G0')
                if windows > 2:
                    cv.set(x, wy + 2, 'G2')
        for i in range(roof_h):
            y = top - 1 - i
            hw2 = (hw + 1.5) * (1 - i / roof_h)
            x0, x1 = int(round(x - hw2)), int(round(x + hw2))
            for xx in range(x0, x1 + 1):
                k = 'AV' if (xx - x) * lit_side > 0 else 'N3'
                cv.set(xx, y, k)
            if i == 0:
                cv.hline(x0, x1, y, 'T0')
        cv.set(x, top - roof_h - 1, 'G1')
        cv.hline(x - hw - 1, x + hw + 1, top, 'T3' if lit_side else 'T2')
        if flag:
            ft = top - roof_h - 6
            cv.vline(x, ft, top - roof_h - 2, 'T0')
            for i in range(4):
                dy = 1 if i in (1, 2) else 0
                cv.set(x + 1 + i, ft + dy, flag)
                if i < 2:
                    cv.set(x + 1 + i, ft + 1 + dy, 'AV' if flag == 'RM' else 'G0')

    def house(hx, hy, w, lit=1):
        cv.rect(hx, hy - 4, hx + w, hy + 1, 'T1')
        cv.vline(hx + w - 1, hy - 4, hy, 'T0')
        for i in range(3):
            cv.hline(hx - 1 + i, hx + w - i, hy - 5 - i, 'N3' if i else 'T0')
            cv.set(hx - 1 + i, hy - 5 - i, 'AV')
        cv.set(hx + 2, hy - 2, 'G1')
        if w > 6 or lit > 1:
            cv.set(hx + w - 2, hy - 2, 'G1')
        if lit > 1:
            cv.set(hx + 2, hy - 1, 'G0'); cv.set(hx + w - 2, hy - 1, 'G0')

    def arc(x1, y1, x2, y2, lift):
        for x in range(min(x1, x2), max(x1, x2) + 1):
            t = (x - x1) / (x2 - x1)
            y = int(round(y1 + (y2 - y1) * t - lift * 4 * t * (1 - t)))
            cv.set(x, y, 'T3'); cv.set(x, y + 1, 'T1'); cv.set(x, y + 2, 'T0')
            if x % 3 == 0:
                cv.set(x, y - 1, 'C1')

    def spire(sx, top, sc, tiers, needle=True):
        """The rune spire: a tapering needle with ledges that catch the crystal light,
        a tiered base, a glowing door and a spiral of runes."""
        b0 = 44

        def hw_at(y):
            if y >= 50:
                return 8 * sc
            if y >= 47:
                return 6.5 * sc
            if y >= b0:
                return 5 * sc
            t = (y - top) / (b0 - top)
            hw = (1.2 + 2.6 * t ** 1.6) * sc
            for by in tiers:
                if 0 <= y - by <= 1:
                    hw += (2 - (y - by)) * min(1.0, sc)
            return hw
        for y in range(top, 54):
            hw = hw_at(y)
            x0, x1 = int(round(sx - hw)), int(round(sx + hw))
            for x in range(x0, x1 + 1):
                u = (x - x0) / max(1, x1 - x0)
                k = 'T3' if u < 0.34 else ('T2' if u < 0.67 else 'T1')
                if x == x0:
                    k = 'C1' if y < b0 else 'T3'
                if x == x1:
                    k = 'T0'
                cv.set(x, y, k)
            if y in tuple(tiers) + (44, 47, 50):
                cv.hline(x0, x1 - 1, y, 'C1' if y < b0 else 'T3')
                cv.set(x1, y, 'C0')
        if sc >= 1:
            cv.rect(sx - 1, 49, sx + 2, 54, 'G1'); cv.set(sx - 1, 49, 'T1'); cv.set(sx + 1, 49, 'T1')
            cv.set(sx, 53, 'G2')
            for wx in (sx - int(5 * sc), sx + int(5 * sc)):
                cv.set(wx, 51, 'G1'); cv.set(wx, 52, 'G0')
            cv.set(sx - 3, 45, 'G1'); cv.set(sx + 3, 45, 'G1')
            if sc > 1:
                for wx in (sx - 8, sx + 8):
                    cv.set(wx, 51, 'G1'); cv.set(wx, 52, 'G0')
                cv.set(sx - 5, 48, 'G1'); cv.set(sx + 5, 48, 'G1')
        else:
            cv.rect(sx, 50, sx + 2, 54, 'G1'); cv.set(sx, 50, 'T1')
            cv.set(sx - 3, 51, 'G1'); cv.set(sx + 3, 51, 'G1')
        rg = [top + 3, top + 11] if sc >= 1 else [top + 4]
        for gy in rg:
            w = int(3 * sc)
            cv.hline(sx - w, sx + w, gy, 'N4')
            cv.set(sx - w + 1, gy, 'C0'); cv.set(sx + w - 1, gy, 'C0')
        for y in range(top + 2, b0):
            if y in rg:
                continue
            hw = hw_at(y)
            ph = math.sin(y * 0.55) * (hw - 0.5)
            if y % 2 == 0:
                cv.set(int(round(sx + ph)), y, 'C1' if y % 6 else 'C2')
        if sc >= 1:
            for y in (top + 12, top + 21):
                cv.set(sx, y, 'G1')
        if needle:
            cv.vline(sx, top - 2, top, 'C2')
            cv.set(sx, top - 3, 'C1')

    def crystal(cx, cy, s, rays=True):
        for y in range(int(cy - 8 * s), int(cy + 7 * s)):
            dy = y + 0.5 - cy
            hw = 4.6 * s * (1 - abs(dy) / ((8.0 if dy < 0 else 6.0) * s))
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
            if abs(dy) < 4 * s:
                cv.set(x0 - 1, y, 'C0')
        cv.set(cx, int(cy - 9 * s), 'C2')
        if rays:
            for d in range(int(5 * s), int(15 * s)):
                if d < 9 * s or bay(cx + d, cy) < 0.5:
                    cv.set(cx + d, cy, 'C1' if d < 8 * s else 'C0')
                    cv.set(cx - d, cy, 'C1' if d < 8 * s else 'C0')
            for d in (2, 3):
                cv.set(cx - int(3 * s) - d, cy - 2, 'C1' if d == 2 else 'C0')
                cv.set(cx + int(3 * s) + d, cy - 2, 'C1' if d == 2 else 'C0')

    def shard(x, y, s=2):
        for i in range(-s, s + 1):
            w = s - abs(i)
            for j in range(-w // 2, w // 2 + 1):
                cv.set(x + j, y + i, 'C1' if j <= 0 and i <= 0 else 'C0')
        cv.set(x, y - s, 'C2')

    def islet(ix, iy, size, lamp=True, shards=True):
        """A floating rock: a lit top, a tapering underside, motes falling from it."""
        n = size - 1
        for i in range(n):
            w = size - i
            cv.hline(ix - w, ix + w - 1, iy + i, 'T1' if i < 2 else 'T0')
            if i >= 2 and w > 2:
                cv.set(ix - w, iy + i, 'T1')
        cv.hline(ix - size, ix - 1, iy, 'T3')
        cv.hline(ix, ix + size - 1, iy, 'T2')
        if shards:
            shard(ix - 2, iy - 3, 2 if size > 6 else 1); shard(ix + 3, iy - 2, 1)
        if lamp:
            cv.vline(ix + size - 3, iy - 4, iy - 1, 'T1'); cv.set(ix + size - 3, iy - 5, 'G1')
        for j, (dx, dy) in enumerate(((-1, 1), (1, 3), (0, 5))):
            cv.set(ix + dx, iy + n + dy, 'C0')

    # ---------------------------------------------------------------- the city on the island
    if T == 1:
        # a lone scribes' tower among a few huts
        for (hx, hy, w) in ((106, 52, 5), (140, 51, 6), (152, 52, 5)):
            house(hx, hy, w)
        tower(SPX, 28, 52, 4, 9, -1)
        cv.rect(SPX - 1, 49, SPX + 2, 53, 'G1'); cv.set(SPX, 49, 'T1')
        # the scriptorium balcony, lamplit
        cv.hline(SPX - 6, SPX + 6, 40, 'T3'); cv.hline(SPX - 6, SPX + 6, 41, 'T0')
        for x in range(SPX - 6, SPX + 7, 2):
            cv.set(x, 39, 'T2')
        cv.set(SPX - 6, 38, 'G1'); cv.set(SPX + 6, 38, 'G1')
        cv.set(SPX - 2, 36, 'G2'); cv.set(SPX - 1, 36, 'G1'); cv.set(SPX + 2, 36, 'G1')
        # rune stones on the shore, the start of the circle the capital will have
        for (x, h) in ((114, 3), (118, 4), (138, 4), (142, 3)):
            cv.vline(x, 52 - h, 51, 'T2'); cv.set(x, 52 - h, 'T3'); cv.set(x, 53 - h, 'C1')
        # lectern lamp and a scribe on the step
        cv.set(SPX + 6, 51, 'G2'); cv.vline(SPX + 6, 52, 53, 'T0')
        cv.set(SPX - 6, 50, 'S2'); cv.set(SPX - 6, 51, 'AV'); cv.set(SPX - 6, 52, 'AV'); cv.set(SPX - 6, 53, 'T0')
        crystal(CRY[0], CRY[1], cs, rays=True)
        for (x, y, s) in ((117, 12, 1), (140, 16, 1)):
            shard(x, y, s)
    else:
        wall = T >= 3
        if not wall:
            for x in range(86, 190):
                y = 50 if x % 4 else 49
                cv.set(x, y, 'T2' if x < SPX else 'T1'); cv.vline(x, 51, 53, 'T1')
        houses = [(92, 52, 6), (102, 51, 7), (146, 50, 6), (168, 50, 8), (180, 51, 6), (112, 50, 5)]
        if T >= 4:
            houses += [(96, 47, 5), (138, 46, 5), (184, 46, 5), (108, 46, 5), (150, 46, 6)]
        for (hx, hy, w) in houses:
            house(hx, hy, w, 2 if T >= 4 else 1)

        lit = 3 if T >= 4 else 1
        tower(88, 38, 52, 2, 5, +1, lit)
        if T <= 3:
            tower(178, 33, 50, 3, 7, -1, lit, 'G1' if T >= 3 else None)
        tower(104, 31, 50, 4, 8, +1, lit, 'RM' if T >= 3 else None)
        tower(157, 28, 49, 4, 9, -1, lit, 'G1' if T >= 3 else None)
        tower(116, 41, 50, 2, 5, +1, lit)
        tower(142, 39, 50, 2, 5, -1, lit)
        if T >= 3:
            tower(96, 36, 51, 2, 6, +1, lit, 'A1')
            tower(188, 34, 51, 2, 6, -1, lit, 'RM')
            if T == 3:
                tower(168, 36, 50, 2, 6, -1, lit)
        if T >= 4:
            spire(172, 26, 0.6, (33, 39))
            crystal(172, 19, 0.38, rays=False)
            tower(184, 30, 50, 3, 7, -1, lit, 'G1')
            tower(112, 26, 49, 2, 6, +1, lit, 'RM')

        # bridges
        arc(108, 35, SPX - 3, 33, 6)
        arc(SPX + 2, 29, 153, 31, 5)
        if T <= 3:
            arc(161, 35, 175, 37, 3)
        if T >= 4:
            arc(161, 34, 169, 34, 2)
            arc(175, 36, 181, 34, 1)
            arc(90, 40, 100, 37, 3)
            arc(120, 42, SPX - 6, 41, 1)
            arc(SPX + 6, 41, 139, 42, 1)

        # the wall with glowing rune gates
        if wall:
            gates = (100, 154) if T == 3 else (98, 150, 184)
            wy = 50
            for x in range(85, 191):
                g = any(abs(x - gx) <= 2 for gx in gates)
                for y in range(wy, 55):
                    if g and y > wy:
                        k = 'C0' if abs(x - min(gates, key=lambda q: abs(q - x))) == 2 else ('C1' if y > wy + 1 else 'C2')
                    else:
                        k = 'T1' if y > wy else 'T2'
                        if y == wy + 2 and x % 6 == 0:
                            k = 'C0'       # runes cut into the wall
                    cv.set(x, y, k)
                if x % 3 != 0 and not g:
                    cv.set(x, wy - 1, 'T2' if x < SPX else 'T1')
                cv.set(x, 55, 'T0')
            for gx in gates:
                cv.hline(gx - 3, gx + 3, wy - 1, 'T3'); cv.set(gx, wy - 2, 'C1')
                cv.set(gx - 3, wy - 2, 'T3'); cv.set(gx + 3, wy - 2, 'T3')

        # the spire
        if T == 5:
            spire(SPX, 13, 1.45, (21, 29, 37))
        else:
            spire(SPX, 16, 1.0, (23, 32, 40))

        if T == 5:
            # crown of crystals round the spire's top
            for (dx, dy, s) in ((-6, 15, 2), (6, 15, 2), (-10, 18, 1), (10, 18, 1), (-3, 12, 1), (3, 12, 1)):
                shard(SPX + dx, dy, s)
            # banners down the tiers
            for (x, y, n, c) in ((SPX - 7, 30, 5, 'RM'), (SPX + 6, 30, 5, 'G1'), (SPX - 9, 38, 4, 'G1'), (SPX + 8, 38, 4, 'RM')):
                cv.hline(x - 1, x + 2, y, 'T0')
                for i in range(n):
                    cv.set(x, y + 1 + i, c); cv.set(x + 1, y + 1 + i, 'AV' if c == 'RM' else 'G0')
                cv.set(x, y + n + 1, c)
        crystal(CRY[0], CRY[1], cs)

        # floating shards and islets
        sh = [(117, 12, 2), (140, 15, 2), (112, 22, 1), (146, 9, 1), (136, 24, 1), (120, 3, 1), (168, 18, 1)]
        if T == 5:
            sh = [(112, 13, 2), (144, 13, 2), (108, 23, 1), (150, 22, 1), (168, 10, 1), (88, 8, 1)]
        for (x, y, s) in sh:
            shard(x, y, s)
        if T >= 4:
            islet(60, 31, 12, lamp=False, shards=False)
            # ring of rune stones on the islet
            for i, sx in enumerate((50, 54, 58, 63, 67, 71)):
                h = 3 if i in (0, 5) else 4
                cv.vline(sx, 31 - h, 30, 'T2'); cv.vline(sx + 1, 31 - h, 30, 'T1')
                cv.set(sx, 31 - h, 'T3'); cv.set(sx, 31 - h + 1, 'C1')
            for x in range(52, 70):
                if x % 2 == 0:
                    cv.set(x, 31, 'C1')
            shard(60, 26, 2)
        else:
            islet(62, 32, 9)
        if T >= 3:
            islet(32, 15, 8)
            islet(86, 11, 6, lamp=False)
        if T == 5:
            # floating towers on rocks of their own
            for (fx, fy, fs) in ((12, 25, 6), (182, 12, 6)):
                islet(fx, fy, fs, lamp=False, shards=False)
                tower(fx - 1, fy - 12, fy - 1, 2, 5, +1 if fx > SPX else -1, 3, 'RM')
            # starlike floating lights over the city
            rs = random.Random(5)
            for _ in range(26):
                x, y = rs.randrange(86, 192), rs.randrange(2, 44)
                if cv.get(x, y) in ('N0', 'N1', 'N2', 'N3', 'N4'):
                    cv.set(x, y, 'G2' if rs.random() < 0.5 else 'G1')
            for (x, y) in ((100, 10), (160, 4), (186, 28), (94, 30)):
                cv.set(x, y, 'S1')
                for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    cv.set(x + d[0], y + d[1], 'C1')

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
                 'AV': 'N3', 'N3': 'N2', 'N4': 'N3', 'T0': 'M0', 'M0': 'M0', 'A1': 'A0', 'RM': 'AV'}.get(src)
            if m:
                cv.set(x, y, m)
    bw = 1 if T == 1 else (2 if T == 5 else 1)
    for y in range(LAKE + 1, H):
        if y % 2 == 0:
            w = (1 + (y - LAKE) // 5) * bw
            j = int(round(math.sin(y * 1.1) * 1.5))
            cv.hline(SPX - w + j, SPX + w + j, y, 'C0')
            cv.set(SPX + j, y, 'C1')
            if T == 5:
                cv.set(SPX + j - 1, y, 'C1'); cv.set(SPX + j + 1, y, 'C2' if y < 64 else 'C1')
    for x in range(84, 192, 2):
        if cv.get(x, LAKE) not in ('M0',):
            cv.set(x, LAKE, 'T1')

    # glowing rune circle on the water round the spire (V)
    if T == 5:
        for i in range(220):
            a = i / 220 * 2 * math.pi
            x = SPX + math.cos(a) * 44
            y = 63 + math.sin(a) * 4.5
            if y < LAKE + 1:
                continue
            if i % 10 < 6:
                cv.set(x, y, 'C1' if math.sin(a) > 0 else 'C0')
            elif i % 10 == 8:
                cv.set(x, y, 'C2' if math.sin(a) > 0 else 'C1')
        for i in range(140):
            a = i / 140 * 2 * math.pi
            x = SPX + math.cos(a) * 30
            y = 63 + math.sin(a) * 3
            if y >= LAKE + 1 and i % 6 < 3:
                cv.set(x, y, 'C0')

    # little boat with a lantern
    bx, by = 82, 63
    cv.hline(bx - 3, bx + 3, by, 'T0'); cv.hline(bx - 2, bx + 2, by + 1, 'M0')
    cv.set(bx + 2, by - 1, 'T1'); cv.set(bx + 2, by - 2, 'G1'); cv.set(bx - 1, by - 1, 'T2'); cv.set(bx - 1, by - 2, 'T2')
    cv.set(bx + 2, by + 2, 'G0'); cv.set(bx + 2, by + 4, 'G0')
    if T >= 4:
        for (b2x, b2y) in ((168, 66), (104, 69)):
            cv.hline(b2x - 3, b2x + 3, b2y, 'T0'); cv.hline(b2x - 2, b2x + 2, b2y + 1, 'M0')
            cv.set(b2x - 2, b2y - 1, 'T1'); cv.set(b2x - 2, b2y - 2, 'G1'); cv.set(b2x + 1, b2y - 1, 'RM')
            cv.set(b2x - 2, b2y + 2, 'G0')
    for (x, y, l) in ((20, 62, 6), (44, 66, 8), (150, 64, 7), (176, 69, 6), (8, 69, 5)):
        cv.hline(x, x + l, y, 'N3')
    return cv
