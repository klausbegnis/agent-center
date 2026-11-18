"""Room scenes of four Gloaming Isles instances (200 x 125, drawn by the game at 400 x 250).

Same layout as the Old Road's scenes (see scenes_road.py): a back wall band across the top
carries the instance's identity, the floor below stays calm and mid-dark so characters, speech
bubbles and a monster read anywhere on it, and props stand only along the back wall and tight
to the far left and right edges.
Deterministic: every random source is seeded."""
import random, math, os
from engine import *
from scenes_road import flags, vignette, wall_blocks, cracks, flame

W, H = 200, 125
WALL = 25          # first floor row


# ================================================================ shared helpers

def rivets(cv, keys, k, step=5, seed=0, under=None):
    """Rivet heads along the top joints of floor plates: the pixel below a joint row."""
    for y in range(WALL, cv.H - 1):
        for x in range(cv.W):
            if cv.get(x, y) in keys and cv.get(x - 1, y) in keys and cv.get(x + 1, y) in keys \
                    and cv.get(x, y - 1) not in keys and (x + int(hashf(y, 1, seed) * step)) % step == 0:
                if cv.get(x, y + 1) not in keys:
                    cv.set(x, y + 1, k)
                    if under:
                        cv.set(x + 1, y + 1, under)


def lancet(cx, top, w, bottom, sp=0.75):
    """A pointed (gothic) window opening as a mask."""
    m = set()
    hw = w / 2.0
    spring = top + w * sp
    for y in range(int(top), int(bottom)):
        if y + 0.5 < spring:
            t = (spring - (y + 0.5)) / (spring - top)
            h = hw * (1 - t ** 1.7)
        else:
            h = hw
        for x in range(int(cx - hw) - 1, int(cx + hw) + 2):
            if abs(x + 0.5 - cx) <= h:
                m.add((x, y))
    return m


def frame(cv, m, lit, dark, sill=None):
    """Rim around a mask: lit on the left/top, dark on the right."""
    for (x, y) in m:
        if (x - 1, y) not in m:
            cv.set(x - 1, y, lit)
        if (x + 1, y) not in m:
            cv.set(x + 1, y, dark)
        if (x, y - 1) not in m and cv.get(x, y - 1) not in (lit, dark):
            cv.set(x, y - 1, lit)
        if sill and (x, y + 1) not in m:
            cv.set(x, y + 1, sill)


def puff(cv, cx, cy, r, keys, seed):
    """A small steam/smoke puff: dithered blob, brighter in the core."""
    nz = vnoise(seed)
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r * 1.4) - 1, int(cx + r * 1.4) + 2):
            dx = (x + 0.5 - cx) / (r * 1.4); dy = (y + 0.5 - cy) / r
            d = math.sqrt(dx * dx + dy * dy) - (nz(x / 2.0, y / 2.0) - 0.5) * 0.6
            if d < 0.3:
                if bay(x, y) < 0.75:
                    cv.set(x, y, keys[1] if bay(x + 1, y) < 0.5 else keys[0])
            elif d < 0.65:
                if bay(x, y) < 0.5:
                    cv.set(x, y, keys[0])
            elif d < 1.0:
                if bay(x, y) < 0.25:
                    cv.set(x, y, keys[0])


def wisp(cv, x, y, r, keys, seed, n=3, drift=1):
    """Steam rising from a vent: puffs that grow, thin out and drift as they climb."""
    for i in range(n):
        puff(cv, x + drift * i * r * 0.6, y - i * r * 1.1, r * (0.7 + 0.25 * i), keys, seed + i)


def contact_shadow(cv, keys, dark, rows=4):
    for y in range(WALL, WALL + rows):
        for x in range(cv.W):
            if cv.get(x, y) in keys and bay(x, y) < q4(1 - (y - WALL) / float(rows)):
                cv.set(x, y, dark)


def plinth(cv, a, b, c, spot=None, seed=11):
    cv.hline(0, W - 1, WALL - 3, a)
    cv.hline(0, W - 1, WALL - 2, b)
    cv.hline(0, W - 1, WALL - 1, c)
    if spot:
        for x in range(W):
            if hashf(x, 2, seed) < 0.4:
                cv.set(x, WALL - 2, spot)


# ================================================================ 1. The Brass Leviathan

BRASS = {
    'K': '#0b090b',
    'H0': '#150f10', 'H1': '#221719', 'H2': '#31221f',
    'B1': '#4a2e18', 'B2': '#6e4622', 'B3': '#9a682c', 'B4': '#c99a45', 'B5': '#f0d48a',
    'D0': '#1a1512', 'D1': '#262019', 'D2': '#30281f', 'D3': '#3d3226',
    'L1': '#3d291c', 'L2': '#553823',
    'F1': '#8a2a14', 'F2': '#e0641f', 'F3': '#ffb04a', 'F4': '#fff0b8',
    'V1': '#2a5650', 'V2': '#4f9783',
    'S1': '#857a98', 'S2': '#c6bfd3',
}

BRASS_LIGHT = ('B4', 'B3', 'B3', 'B2', 'B1')


def pipe_h(cv, x0, x1, y, keys=('B4', 'B3', 'B2', 'B1'), flanges=()):
    for i, k in enumerate(keys):
        cv.hline(x0, x1, y + i, k)
    for fx in flanges:
        cv.vline(fx, y - 1, y + len(keys), 'B4')
        cv.vline(fx + 1, y - 1, y + len(keys), 'B1')


def pipe_v(cv, x, y0, y1, keys=('B4', 'B3', 'B2', 'B1'), flanges=()):
    for i, k in enumerate(keys):
        cv.vline(x + i, y0, y1, k)
    for fy in flanges:
        cv.hline(x - 1, x + len(keys), fy, 'B4')
        cv.hline(x - 1, x + len(keys), fy + 1, 'B1')


def gauge(cv, cx, cy, r=2.5, needle=1):
    cv.disc(cx, cy, r + 1, 'B1')
    cv.disc(cx, cy, r, 'S2')
    cv.set(cx - 1, cy - 1, 'S2')
    cv.set(cx, cy, 'K')
    cv.set(cx + needle, cy - 1, 'F1')
    cv.set(cx - r + 0.5, cy - r + 0.5, 'B5')


def valve(cv, cx, cy):
    """A valve wheel seen at 3/4."""
    for a in range(0, 360, 20):
        cv.set(cx + math.cos(math.radians(a)) * 3, cy + math.sin(math.radians(a)) * 2, 'B3' if a > 180 else 'B4')
    cv.hline(cx - 2, cx + 2, cy, 'B2'); cv.vline(cx, cy - 1, cy + 1, 'B2')
    cv.set(cx, cy, 'B5')


def scene_leviathan():
    rng = random.Random(211)
    cv = Cv(BRASS, 'H1', W, H)
    CX = 100
    # ------------------------------------------------ back wall: hull plates with rivet seams
    for y in range(0, WALL - 3):
        r = y // 6
        for x in range(W):
            off = 9 * (r % 2)
            k = 'H1' if hashf((x + off) // 18, r, 3) < 0.6 else 'H2'
            if y % 6 == 5 or (x + off) % 18 == 0:
                k = 'H0'
            elif y % 6 == 0 and (x + off) % 3 == 1:
                k = 'B1'                                    # rivet row under each seam
            cv.set(x, y, k)
    for y in range(0, 5):
        for x in range(W):
            if bay(x, y) < q4(1 - y / 5.0):
                cv.set(x, y, 'H0' if y > 1 else 'K')
    # horizontal steam mains along the wall, with flanges
    pipe_h(cv, 0, 74, 7, flanges=(12, 34, 56))
    pipe_h(cv, 126, W - 1, 7, flanges=(144, 166, 188))
    pipe_v(cv, 44, 11, WALL - 4, keys=('B3', 'B2', 'B1'), flanges=(13,))
    pipe_v(cv, 154, 11, WALL - 4, keys=('B3', 'B2', 'B1'), flanges=(13,))
    gauge(cv, 45, 17, r=2.5, needle=1); gauge(cv, 155, 17, r=2.5, needle=-1)
    # ribs: brass bands rising from the deck and arching inward toward the spine
    for rx in (6, 30, 58, 142, 170, 194):
        d = 1 if rx < CX else -1
        m = m_bez((rx, WALL - 3), (rx, 6), (rx + d * 10, -2), 2.6, 2.0, steps=50)
        keys = ('B4', 'B3', 'B3', 'B2', 'B1') if d > 0 else ('B1', 'B2', 'B3', 'B3', 'B4')
        cyl(cv, m, keys, cuts=(0.2, 0.4, 0.65, 0.85), top=False)
        ys = {}
        for (x, y) in m:
            ys.setdefault(y, []).append(x)
        for y, xs in ys.items():                         # rivets down the middle of the rib
            if y % 3 == 1:
                xm = sorted(xs)[len(xs) // 2]
                cv.set(xm, y, 'B5' if d > 0 else 'B4')
                cv.set(xm + 1, y, 'B1')
    # the spine beam along the ceiling
    cv.hline(0, W - 1, 0, 'B2'); cv.hline(0, W - 1, 1, 'B1')
    for x in range(2, W, 4):
        cv.set(x, 0, 'B4')
    # ------------------------------------------------ the boiler furnace in the centre
    BX0, BX1, BT = CX - 22, CX + 22, 3
    body = set()
    for y in range(BT, WALL - 2):
        for x in range(BX0, BX1):
            dx = (x + 0.5 - CX) / 22.0
            if y >= BT + 6 or (y + 0.5 - (BT + 6)) ** 2 / 36.0 + dx * dx <= 1.0:
                body.add((x, y))
    cyl(cv, body, ('B4', 'B3', 'B3', 'B2', 'B1'), cuts=(0.16, 0.38, 0.7, 0.88))
    for y in range(BT + 3, WALL - 2, 5):                 # riveted hoops around the drum
        for x in range(BX0, BX1):
            if (x, y) in body:
                cv.set(x, y, 'B1')
                if (x, y - 1) in body and x % 3 == 0:
                    cv.set(x, y - 1, 'B5' if x < CX + 6 else 'B4')
    # chimney up into the ceiling
    for y in range(0, BT + 1):
        for i, k in enumerate(('B4', 'B3', 'B3', 'B2', 'B2', 'B1')):
            cv.set(CX - 3 + i, y, k)
    cv.hline(CX - 4, CX + 3, BT, 'B5'); cv.hline(CX - 4, CX + 3, BT + 1, 'B1')
    # the fire mouth
    MX0, MX1, MT = CX - 11, CX + 11, 9
    mouth = set()
    for y in range(MT, WALL - 3):
        for x in range(MX0, MX1):
            dx = x + 0.5 - CX
            if y >= MT + 5 or dx * dx / 121.0 + ((y + 0.5 - (MT + 5)) / 5.0) ** 2 <= 1.0:
                mouth.add((x, y))
    for (x, y) in mouth:
        t = (y - MT) / float(WALL - 3 - MT)
        v = t * 1.1 - abs(x + 0.5 - CX) / 11.0 * 0.6
        if v > 0.7:
            k = 'F4' if bay(x, y) < q4((v - 0.7) * 4) else 'F3'
        elif v > 0.4:
            k = 'F3' if bay(x, y) < q4((v - 0.4) * 3.3) else 'F2'
        elif v > 0.1:
            k = 'F2' if bay(x, y) < q4((v - 0.1) * 3.3) else 'F1'
        else:
            k = 'F1' if bay(x, y) < q4(v * 4 + 0.6) else 'K'
        cv.set(x, y, k)
    frame(cv, mouth, 'B5', 'B1')
    for gx in range(MX0 + 2, MX1, 3):                    # grate bars
        for y in range(MT + 1, WALL - 3):
            if (gx, y) in mouth:
                cv.set(gx, y, 'K' if y < WALL - 6 else 'F1')
    cv.hline(MX0, MX1 - 1, WALL - 5, 'B1')
    gauge(cv, CX - 17, 12, needle=1)
    gauge(cv, CX + 17, 12, needle=-1)
    for (sx, sy) in ((CX - 17, 18), (CX + 17, 18)):
        cv.set(sx, sy, 'F3'); cv.set(sx, sy + 1, 'F1')     # little indicator lamps
    # furnace light on the wall around it
    light(cv, CX + 0.5, 15, 48, 18, {'H1': 'L1', 'H2': 'L2', 'H0': 'H2', 'B1': 'B2', 'B2': 'B3'},
          power=1.4, steps=4, pred=lambda x, y: (x, y) not in body)
    # verdigris on the old plates
    for x in range(W):
        if hashf(x, 5, 9) < 0.08 and cv.get(x, 20) in ('H1', 'H2', 'H0'):
            for y in range(20 - int(hashf(x, 6, 9) * 6), WALL - 3):
                if cv.get(x, y) in ('H1', 'H2', 'H0'):
                    cv.set(x, y, 'V1')
    plinth(cv, 'B3', 'B2', 'H0', spot='B1')
    for x in range(1, W, 4):
        cv.set(x, WALL - 3, 'B5')
    # ------------------------------------------------ deck: riveted plates
    flags(cv, {'a': 'D2', 'b': 'D1', 'j': 'D0', 'hi': 'D3'}, seed=17, tw=30, h0=8, dh=1)
    rivets(cv, ('D0',), 'B2', step=4, seed=2)
    for y in range(WALL + 2, H):                         # and down the plate seams
        for x in range(1, W - 1):
            if cv.get(x, y) == 'D0' and cv.get(x, y - 1) == 'D0' and cv.get(x + 1, y) != 'D0' \
                    and cv.get(x - 1, y) != 'D0' and y % 4 == 1:
                cv.set(x + 1, y, 'B2')
    cracks(cv, rng, 10, ('D1', 'D2'), 'D0')
    contact_shadow(cv, ('D1', 'D2', 'D3'), 'D0')
    # a brass grate in front of the furnace
    for y in range(WALL, WALL + 7):
        hw = 15 + (y - WALL) // 2
        for x in range(CX - hw, CX + hw + 1):
            k = 'B2'
            if (y - WALL) % 2 == 1 and abs(x - CX) < hw - 1:
                k = 'H0'
            if x in (CX - hw, CX + hw):
                k = 'B3' if x < CX else 'B1'
            cv.set(x, y, k)
    cv.hline(CX - 18, CX + 18, WALL + 7, 'B1')
    # oil stains
    for (px_, py_, rx, ry) in ((52, 70, 9, 2.6), (146, 94, 11, 3.0), (90, 112, 7, 2.0),
                               (126, 52, 6, 1.8)):
        for (x, y) in m_ell(px_, py_, rx, ry):
            if hashf(x // 2, y, 7) < 0.85 and cv.get(x, y) in ('D1', 'D2', 'D3'):
                cv.set(x, y, 'D0' if bay(x, y) < 0.75 else 'D1')
        cv.set(px_ - 2, py_, 'V1'); cv.set(px_ - 1, py_, 'V1')
    # the fire's glow down the deck
    glow = {'D1': 'L1', 'D2': 'L2', 'D3': 'L2', 'D0': 'D1', 'L1': 'L2'}
    light(cv, CX + 0.5, WALL, 74, 56, glow, power=1.0, steps=4)
    light(cv, CX + 0.5, WALL, 40, 26, {'L1': 'L2', 'D0': 'L1', 'B2': 'B3'}, power=1.2, steps=3)
    # ------------------------------------------------ vignette, then edge props on top
    vignette(cv, {'D1': 'D0', 'D2': 'D1', 'D3': 'D2', 'L2': 'L1', 'L1': 'D1', 'H1': 'H0',
                  'H2': 'H1', 'B3': 'B2', 'B2': 'B1', 'B4': 'B3', 'D0': 'H0', 'V1': 'D1',
                  'H0': 'K'},
             cy=66, rx=124, ry=80, inner=0.62, levels=2.0)
    # standpipes with gauges and valves at the far edges
    for (x, gy, flip) in ((2, 40, False), (194, 46, True)):
        top = WALL - 4
        bot = gy + 30
        pipe_v(cv, x, top, bot, keys=('B4', 'B3', 'B2', 'B1') if not flip else ('B1', 'B2', 'B3', 'B4'),
               flanges=(WALL + 2, gy + 10))
        for y in range(bot + 1, bot + 3):                # shadow at the foot
            for xx in range(x - 1, x + 6):
                if bay(xx, y) < 0.75:
                    cv.set(xx, y, 'D0')
        cv.hline(x - 1, x + 4, bot, 'B1')
        gauge(cv, x + 2 + (3 if not flip else -2), gy, r=2.5, needle=1 if not flip else -1)
        valve(cv, x + 2 + (4 if not flip else -3), gy + 18)
    # a coal heap and a shovel in the lower-left corner, a crate of spares lower right
    for (x, y, r) in ((4, 116, 6), (11, 120, 4), (1, 108, 3)):
        for (xx, yy) in m_ell(x, y, r, r * 0.6):
            cv.set(xx, yy, 'K' if hashf(xx, yy, 5) < 0.55 else 'H1')
        cv.set(x - 1, y - 1, 'H2'); cv.set(x + 1, y - 2, 'F1')
    cv.line(15, 106, 9, 115, 'B2'); cv.set(15, 105, 'B3'); cv.rect(7, 115, 10, 118, 'B1')
    cv.rect(189, 108, 200, 118, 'D3'); cv.rect(189, 108, 200, 110, 'B3')
    cv.hline(189, 199, 113, 'D1'); cv.vline(189, 108, 117, 'B4'); cv.hline(189, 199, 118, 'D0')
    cv.set(192, 111, 'B5'); cv.set(196, 111, 'B5')
    # wisps of steam from the joints
    for (x, y, r, s, d) in ((34, 9, 2.6, 1, 1), (166, 9, 2.8, 2, -1), (11, WALL + 9, 2.6, 5, 1),
                            (189, WALL + 13, 2.6, 6, -1), (122, 6, 2.0, 7, 1)):
        wisp(cv, x, y, r, ('S1', 'S2'), s, drift=d)
    return cv


# ================================================================ 2. Moonwake Abbey

ABBEY = {
    'K': '#08081a',
    'S0': '#111127', 'S1': '#1c1b37', 'S2': '#292748', 'S3': '#3b3860', 'S4': '#57537f',
    'F0': '#14152a', 'F1': '#1e2037', 'F2': '#272a44', 'F3': '#303450',
    'M1': '#40476e', 'M2': '#7c80b0', 'M3': '#cfd2ec',
    'G1': '#7d1d3c', 'G2': '#d4543f', 'G3': '#ffb95e', 'G4': '#3ea8a2', 'G5': '#4f6fc4',
    'C2': '#fff0bf', 'WX': '#cfc3a4',
    'P1': '#2a1a20', 'P2': '#4a2f2e',
}


def glass(cv, m, cx, seed, rose=None):
    """Fill a window mask with leaded panes, moonlit toward the top."""
    cols = ['G5', 'G4', 'G1', 'G5', 'G2', 'G4', 'G3', 'G5']
    ys = [y for (_, y) in m]
    y0, y1 = min(ys), max(ys)
    for (x, y) in m:
        cell = ((x - int(cx)) // 3, (y - y0) // 4)
        k = cols[int(hashf(cell[0] + 9, cell[1], seed) * len(cols))]
        t = (y - y0) / max(1.0, y1 - y0)
        if bay(x, y) < q4(0.75 - t * 0.8):
            k = 'M2' if bay(x + 2, y + 1) < 0.7 else 'M3'
        if (y - y0) % 4 == 3 or (x - int(cx)) % 3 == 2 or x == int(cx):
            k = 'K'
        cv.set(x, y, k)
    if rose:
        rx, ry, r = rose
        for (x, y) in m_ell(rx, ry, r, r):
            d = math.hypot(x + 0.5 - rx, y + 0.5 - ry)
            a = math.atan2(y + 0.5 - ry, x + 0.5 - rx)
            k = 'M3' if d < 1.2 else ('G3' if d < 2.4 else ('G1' if int((a + 3.2) * 1.3) % 2 else 'G5'))
            if 2.3 < d < 2.9 or abs(math.sin(a * 3)) < 0.18:
                k = 'K'
            if d > r - 0.7:
                k = 'S4'
            cv.set(x, y, k)


def candle(cv, x, y, h=3):
    cv.vline(x, y - h + 1, y, 'WX')
    cv.set(x, y - h, 'G3'); cv.set(x, y - h - 1, 'C2')


def pew(cv, x0, x1, y, end_right):
    """A pew seen 3/4 from above: back rail, seat, front face, end panel toward the aisle."""
    for x in range(x0, x1 + 1):
        cv.set(x, y, 'P2'); cv.set(x, y + 1, 'P1')
        cv.set(x, y + 3, 'P2'); cv.set(x, y + 4, 'P2'); cv.set(x, y + 5, 'P1')
        cv.set(x, y + 6, 'K')
    ex = x1 if end_right else x0
    cv.vline(ex, y - 1, y + 6, 'S3' if end_right else 'S2')
    cv.set(ex, y - 2, 'S4')
    for x in range(x0, x1 + 1):                          # shadow on the floor
        if bay(x, y + 7) < 0.75:
            cv.set(x, y + 7, 'F0')


def scene_abbey():
    rng = random.Random(307)
    cv = Cv(ABBEY, 'S1', W, H)
    CX = 100
    wall_blocks(cv, 0, W, 0, WALL - 3, {'a': 'S2', 'b': 'S1', 'j': 'S0', 'hi': 'S3', 'lo': 'S0'},
                bw=8, bh=3, seed=12)
    for y in range(0, 4):
        for x in range(W):
            if bay(x, y) < q4(1 - y / 4.0):
                cv.set(x, y, 'S0' if y > 1 else 'K')
    # clustered columns between the windows
    for px_ in (16, 50, 82, 118, 150, 184):
        lit_left = px_ < CX
        for y in range(0, WALL - 3):
            ks = ('S4', 'S3', 'S2', 'S3', 'S1') if lit_left else ('S1', 'S3', 'S2', 'S3', 'S4')
            for j, k in enumerate(ks):
                cv.set(px_ - 2 + j, y, k)
        cv.hline(px_ - 3, px_ + 3, 4, 'S4'); cv.hline(px_ - 3, px_ + 3, 5, 'S0')
    # tall lancet windows lit by the moon
    wins = [(CX, 1, 22, None), (66, 1, 10, None), (134, 1, 10, None), (33, 2, 9, None),
            (167, 2, 9, None)]
    masks = []
    for i, (cx, top, w, _) in enumerate(wins):
        m = lancet(cx + 0.5, top, w, WALL - (9 if i == 0 else 4), sp=0.4 if i == 0 else 0.75)
        masks.append(m)
        frame(cv, m, 'S4', 'S0', sill='M2')
        glass(cv, m, cx, 40 + i, rose=(cx + 0.5, top + 6.5, 5.2) if i == 0 else None)
        light(cv, cx + 0.5, top + 9, w * 1.2, 12, {'S1': 'S2', 'S2': 'S3', 'S0': 'S1'},
              power=1.6, steps=3, pred=lambda x, y, m=m: (x, y) not in m)
    # an altar under the great window, with candles
    cv.rect(CX - 12, WALL - 7, CX + 13, WALL - 3, 'S3')
    cv.hline(CX - 13, CX + 13, WALL - 8, 'M2'); cv.hline(CX - 12, CX + 12, WALL - 7, 'S4')
    cv.hline(CX - 12, CX + 12, WALL - 4, 'S1')
    for x in range(CX - 9, CX + 10, 4):
        cv.vline(x, WALL - 6, WALL - 5, 'S2')
    cv.rect(CX - 7, WALL - 9, CX + 8, WALL - 8, 'G1')       # altar cloth
    cv.vline(CX, WALL - 12, WALL - 9, 'G3'); cv.hline(CX - 1, CX + 1, WALL - 11, 'G3')
    for x in (CX - 10, CX - 6, CX + 6, CX + 10):
        candle(cv, x, WALL - 9, h=3 if abs(x - CX) > 8 else 2)
    # candelabra stands either side of the great window
    for sx in (50, 150):
        cv.vline(sx, 11, WALL - 3, 'S0'); cv.hline(sx - 2, sx + 2, WALL - 4, 'S0')
        cv.hline(sx - 3, sx + 3, 11, 'S0'); cv.set(sx - 3, 10, 'S0'); cv.set(sx + 3, 10, 'S0')
        for dx in (-3, 0, 3):
            candle(cv, sx + dx, 10 - (1 if dx == 0 else 0), h=2)
        light(cv, sx + 0.5, 8, 9, 7, {'S1': 'S2', 'S2': 'S3', 'S3': 'S4'}, power=1.4, steps=2)
    plinth(cv, 'S4', 'S3', 'S1', spot='S2')
    # ------------------------------------------------ floor: cold stone, a long moon patch
    flags(cv, {'a': 'F2', 'b': 'F1', 'j': 'F0', 'hi': 'F3'}, seed=8, tw=20, h0=6, dh=1)
    cracks(cv, rng, 22, ('F1', 'F2', 'F3'), 'F0')
    contact_shadow(cv, ('F1', 'F2', 'F3'), 'F0')
    # the steps of the chancel
    for i, (hw, y) in enumerate(((18, WALL - 2), (20, WALL), (22, WALL + 2))):
        cv.hline(CX - hw, CX + hw + 1, y, 'S3')
        cv.hline(CX - hw, CX + hw + 1, y + 1, 'S2' if i < 2 else 'S1')
        cv.set(CX - hw, y, 'S4'); cv.set(CX + hw + 1, y + 1, 'S1')
    # moonlight falling through the great window: a long pale patch slanting down the nave
    moon = {'F1': 'F3', 'F2': 'M1', 'F3': 'M1', 'F0': 'F2', 'S1': 'S2', 'S2': 'S3'}
    patch = m_poly([(CX - 10, WALL + 4), (CX + 11, WALL + 4), (CX + 30, 118), (CX - 2, 118)])
    for (x, y) in patch:
        t = 1 - (y - WALL) / 100.0
        u = 0
        # soften the long edges
        row = [xx for (xx, yy) in patch if yy == y]
        e = min(x - min(row), max(row) - x)
        tt = 1.0 if e >= 3 else (0.5 if e >= 1 else 0.25)
        if y > 100:
            tt *= max(0.0, (118 - y) / 18.0)
        tt = q4(tt)
        if bay(x, y) < tt and cv.get(x, y) in moon:
            cv.set(x, y, moon[cv.get(x, y)])
    # coloured specks thrown by the glass near the top of the patch
    for (x, y) in patch:
        if y < WALL + 16 and hashf(x // 2, y // 2, 5) < 0.05 and cv.get(x, y) == 'M1':
            cv.set(x, y, ('G5', 'G4', 'G1')[int(hashf(x, y, 6) * 3)])
    # smaller moon patches from the side windows
    for (cx, dx) in ((66, 6), (134, 6), (33, 4), (167, 4)):
        p = m_poly([(cx - 4, WALL + 2), (cx + 5, WALL + 2), (cx + 5 + dx, WALL + 20), (cx - 4 + dx, WALL + 20)])
        for (x, y) in p:
            tt = q4(0.5 * (1 - (y - WALL) / 22.0))
            if bay(x, y) < tt and cv.get(x, y) in moon:
                cv.set(x, y, moon[cv.get(x, y)])
    # vignette
    vignette(cv, {'F1': 'F0', 'F2': 'F1', 'F3': 'F2', 'M1': 'F3', 'S1': 'S0', 'S2': 'S1',
                  'S3': 'S2', 'S4': 'S3', 'F0': 'S0', 'S0': 'K'},
             cy=66, rx=124, ry=80, inner=0.62, levels=2.0)
    # pews tight to the edges
    for i, y in enumerate(range(32, 112, 13)):
        pew(cv, 0, 10, y, True)
        pew(cv, 189, 199, y + 3, False)
    # candle clusters in the corners and by the wall
    for (x, y) in ((14, 30), (17, 31), (185, 30), (182, 31), (5, 118), (8, 120), (3, 121),
                   (192, 119), (195, 117)):
        candle(cv, x, y, h=2 + (x + y) % 3)
        light(cv, x + 0.5, y - 1, 6, 4, {'F1': 'F2', 'F2': 'F3', 'F0': 'F1', 'S1': 'S2'},
              power=1.2, steps=2, pred=lambda xx, yy: abs(xx - x) > 0 or yy > y)
    for (x, y) in ((60, 28), (138, 28), (40, 121), (158, 122)):       # fallen petals of wax
        cv.set(x, y, 'WX')
    return cv


# ================================================================ 3. The Storm Anvil

ANVIL = {
    'K': '#0a0910',
    'R0': '#110f19', 'R1': '#1b1827', 'R2': '#282438', 'R3': '#3b3653', 'R4': '#5a5476',
    'D0': '#131117', 'D1': '#1c1920', 'D2': '#242029', 'D3': '#2e2933',
    'L1': '#33201f', 'L2': '#472a23',
    'F1': '#8e2615', 'F2': '#e2591c', 'F3': '#ffa63b', 'F4': '#ffe78e',
    'I1': '#2a2c39', 'I2': '#474d61', 'I3': '#7a8298',
    'A1': '#1a2e45', 'A2': '#2d4b63', 'LC': '#9fd0ff',
}


def chain(cv, x, y0, y1, hook=True):
    for y in range(y0, y1):
        if (y - y0) % 3 == 0:
            cv.set(x, y, 'I3'); cv.set(x + 1, y, 'I2')
        elif (y - y0) % 3 == 1:
            cv.set(x - 1 + ((y // 3) % 2) * 2, y, 'I2'); cv.set(x, y, 'K' if (y // 3) % 2 else 'I1')
        else:
            cv.set(x, y, 'I2')
    if hook:
        cv.set(x, y1, 'I3'); cv.set(x, y1 + 1, 'I2'); cv.set(x + 1, y1 + 2, 'I2')
        cv.set(x + 2, y1 + 1, 'I3')


def storm_gap(cv, pts, seed, bolt=None):
    m = m_poly(pts)
    rng = random.Random(seed)
    for (x, y) in m:
        k = 'A1'
        if vnoise(seed)(x / 4.0, y / 2.0) > 0.55:
            k = 'A2'
        cv.set(x, y, k)
    for i in range(14):                                   # slanted rain
        x = rng.uniform(min(p[0] for p in pts), max(p[0] for p in pts))
        y = rng.uniform(0, max(p[1] for p in pts))
        for j in range(3):
            if (int(x - j * 0.5), int(y + j)) in m:
                cv.set(x - j * 0.5, y + j, 'LC' if j == 0 else 'A2')
    if bolt:
        x, y = bolt
        for step in range(9):
            if (int(x), int(y)) in m:
                cv.set(x, y, 'LC')
            y += 1
            x += (1 if step % 3 == 0 else (-1 if step % 3 == 2 else 0))
    frame(cv, m, 'R4', 'R0', sill='R3')
    return m


def scene_anvil():
    rng = random.Random(409)
    cv = Cv(ANVIL, 'R1', W, H)
    CX = 100
    wall_blocks(cv, 0, W, 0, WALL - 3, {'a': 'R2', 'b': 'R1', 'j': 'R0', 'hi': 'R3', 'lo': 'R0'},
                bw=14, bh=5, seed=21)
    for y in range(0, 5):
        for x in range(W):
            if bay(x, y) < q4(1 - y / 5.0):
                cv.set(x, y, 'R0' if y > 1 else 'K')
    # rain through broken gaps in the wall
    gap1 = storm_gap(cv, [(14, 0), (46, 0), (43, 4), (44, 8), (38, 11), (37, 15), (31, 17),
                          (27, 13), (21, 13), (19, 8), (16, 6)], 5, bolt=(31, 1))
    gap2 = storm_gap(cv, [(158, 0), (184, 0), (181, 5), (177, 6), (174, 10), (168, 9), (163, 5)], 6)
    for (gm, x0, x1) in ((gap1, 20, 40), (gap2, 165, 180)):  # rain spilling in below the holes
        for x in range(x0, x1, 3):
            ys = [y for (xx, y) in gm if xx == x]
            if not ys:
                continue
            for y in range(max(ys) + 2, WALL - 3):
                if (y + x * 2) % 5 < 2:
                    cv.set(x - (y - max(ys)) // 6, y, 'A2')
    # the forge: a great hood and a glowing mouth
    hood = m_poly([(CX - 36, WALL - 3), (CX - 32, 6), (CX - 18, 0), (CX + 19, 0), (CX + 33, 6),
                   (CX + 37, WALL - 3)])
    for (x, y) in hood:
        u = (x - (CX - 36)) / 73.0
        k = 'R3' if u < 0.3 else ('R2' if u < 0.75 else 'R1')
        if (y - 1) % 5 == 0 or (x + (y // 5) * 4) % 10 == 0:
            k = 'R0' if u > 0.3 else 'R2'
        cv.set(x, y, k)
    frame(cv, hood, 'R4', 'K')
    MX0, MX1, MT = CX - 26, CX + 27, 4
    mouth = set()
    for y in range(MT, WALL - 3):
        for x in range(MX0, MX1):
            dx = x + 0.5 - (CX + 0.5)
            if y >= MT + 8 or dx * dx / 690.0 + ((y + 0.5 - (MT + 8)) / 8.0) ** 2 <= 1.0:
                mouth.add((x, y))
    for (x, y) in mouth:
        t = (y - MT) / float(WALL - 3 - MT)
        v = t * 1.05 - abs(x + 0.5 - CX - 0.5) / 26.0 * 0.55 + 0.1
        if v > 0.75:
            k = 'F4' if bay(x, y) < q4((v - 0.75) * 4) else 'F3'
        elif v > 0.45:
            k = 'F3' if bay(x, y) < q4((v - 0.45) * 3.3) else 'F2'
        elif v > 0.15:
            k = 'F2' if bay(x, y) < q4((v - 0.15) * 3.3) else 'F1'
        else:
            k = 'F1' if bay(x, y) < q4(v * 4 + 0.5) else 'K'
        cv.set(x, y, k)
    for (x, y) in list(mouth):                           # voussoir ring
        for (dx, dy) in ((-1, 0), (1, 0), (0, -1), (-2, 0), (2, 0), (0, -2)):
            p = (x + dx, y + dy)
            if p not in mouth and cv.get(*p) not in ('R4',):
                a = math.atan2(p[1] - MT - 8, p[0] - CX)
                k = 'R4' if p[0] < CX else 'R2'
                if int((a + 3.2) * 4) % 2 == 0:
                    k = 'R3' if p[0] < CX else 'R1'
                if abs(dx) == 2 or dy == -2:
                    k = 'R1' if p[0] > CX else 'R3'
                cv.set(*p, k)
    # the giants' anvil, black against the fire, rimmed with its light
    anvil = set()
    AY = 11                                              # the face
    anvil |= m_poly([(CX - 25, AY + 1.5), (CX - 16, AY), (CX + 16, AY), (CX + 16, AY + 4),
                     (CX - 10, AY + 4), (CX - 16, AY + 3)])              # face, horn to the left
    anvil |= m_poly([(CX - 9, AY + 4), (CX + 15, AY + 4), (CX + 9, AY + 7), (CX - 3, AY + 7)])
    anvil |= m_poly([(CX - 4, AY + 7), (CX + 10, AY + 7), (CX + 10, AY + 9), (CX - 4, AY + 9)])
    anvil |= m_poly([(CX - 6, AY + 9), (CX + 12, AY + 9), (CX + 18, WALL - 2),
                     (CX - 12, WALL - 2)])                                # flared foot
    for (x, y) in anvil:
        k = 'I1'
        if (x, y - 1) not in anvil:
            k = 'F3' if CX - 20 < x < CX + 18 else 'F2'
        elif (x, y - 2) not in anvil and y <= AY + 1:
            k = 'I2'
        elif (x - 1, y) not in anvil:
            k = 'F1'                                     # fire-lit rim on the left contour
        elif x > CX + 2 or y == AY + 4:
            k = 'K'
        cv.set(x, y, k)
    cv.set(CX + 11, AY + 1, 'K'); cv.set(CX + 12, AY + 1, 'K')   # hardy hole
    # a red-hot bar on the anvil face
    cv.hline(CX - 6, CX + 6, 10, 'F2'); cv.hline(CX - 3, CX + 3, 10, 'F4'); cv.set(CX + 7, 10, 'F1')
    cv.set(CX - 2, 9, 'F3'); cv.set(CX + 1, 8, 'F4'); cv.set(CX + 4, 7, 'F3')
    # forge light spilling over the wall
    glow = {'R1': 'L1', 'R2': 'L2', 'R0': 'L1', 'R3': 'L2'}
    light(cv, CX + 0.5, 12, 64, 20, glow, power=1.5, steps=4,
          pred=lambda x, y: (x, y) not in hood and (x, y) not in gap1 and (x, y) not in gap2)
    # hanging chains
    for (x, y1) in ((58, 17), (66, 12), (136, 15), (144, 19), (8, 10), (190, 13)):
        chain(cv, x, 0, y1)
    plinth(cv, 'R3', 'R2', 'R0', spot='R1')
    # ------------------------------------------------ floor: soot-dark flags, sparks
    flags(cv, {'a': 'D2', 'b': 'D1', 'j': 'D0', 'hi': 'D3'}, seed=31, tw=24, h0=7, dh=1)
    cracks(cv, rng, 24, ('D1', 'D2', 'D3'), 'D0')
    contact_shadow(cv, ('D1', 'D2', 'D3'), 'D0')
    # soot drifts
    nz = vnoise(77)
    for y in range(WALL, H):
        for x in range(W):
            if nz(x / 9.0, y / 5.0) > 0.68 and cv.get(x, y) in ('D2', 'D3') and bay(x, y) < 0.5:
                cv.set(x, y, 'D1')
    # rain pooling under the gaps
    for (px_, py_, rx) in ((30, WALL + 5, 10), (171, WALL + 4, 7)):
        for (x, y) in m_ell(px_, py_, rx, 2.2):
            if cv.get(x, y) in ('D1', 'D2', 'D3', 'D0'):
                cv.set(x, y, 'A1' if (x, y - 1) in m_ell(px_, py_, rx, 2.2) else 'D0')
        cv.set(px_ - 2, py_, 'A2'); cv.set(px_ - 1, py_, 'A2'); cv.set(px_ + 3, py_ + 1, 'LC')
    # forge glow on the floor
    pool = {'D1': 'L1', 'D2': 'L2', 'D3': 'L2', 'D0': 'D1', 'L1': 'L2'}
    light(cv, CX + 0.5, WALL, 64, 44, pool, power=1.6, steps=4)
    # sparks and embers spat from the forge
    for i in range(46):
        a = rng.uniform(0.15, math.pi - 0.15)
        r = rng.uniform(4, 70) ** 1.0
        x = CX + math.cos(a) * r * 1.4
        y = WALL + 1 + math.sin(a) * r * 0.75
        if not (14 < x < 186 and WALL < y < H - 4):
            continue
        k = 'F4' if r < 25 and rng.random() < 0.5 else ('F3' if r < 45 else 'F2')
        cv.set(x, y, k)
        if r < 30 and rng.random() < 0.4:
            cv.set(x - math.cos(a) * 1.5, y - 1, 'F1')
    for _ in range(60):                                   # cold embers in the joints
        x = rng.randint(0, W - 1); y = rng.randint(WALL + 2, H - 1)
        if cv.get(x, y) == 'D0' and hashf(x, y, 3) < 0.5:
            cv.set(x, y, 'L1')
    vignette(cv, {'D1': 'D0', 'D2': 'D1', 'D3': 'D2', 'L2': 'L1', 'L1': 'D1', 'R1': 'R0',
                  'R2': 'R1', 'R3': 'R2', 'R4': 'R3', 'D0': 'K', 'R0': 'K', 'A2': 'A1'},
             cy=66, rx=124, ry=80, inner=0.62, levels=2.0)
    # edge props: quench trough left, ingots and a giant hammer right, coal in the corners
    cv.rect(0, 36, 11, 50, 'R2'); cv.rect(0, 36, 11, 38, 'R4')
    cv.rect(0, 38, 9, 44, 'A1'); cv.hline(0, 9, 38, 'A2'); cv.set(4, 40, 'LC')
    cv.vline(10, 38, 49, 'R1'); cv.hline(0, 11, 50, 'K'); cv.hline(0, 11, 51, 'D0')
    cv.line(3, 30, 7, 41, 'I2'); cv.line(4, 30, 8, 41, 'I1')                    # tongs in the water
    for (x, y) in ((190, 42), (194, 42), (192, 39), (189, 46), (193, 46), (197, 46)):
        cv.rect(x, y, x + 4, y + 3, 'I1'); cv.hline(x, x + 3, y, 'I3'); cv.set(x, y + 2, 'I2')
    cv.hline(188, 199, 50, 'D0')
    for y in range(72, 98):                              # a giant's hammer lying on the edge
        cv.set(194, y, 'L2'); cv.set(195, y, 'L2'); cv.set(196, y, 'L1'); cv.set(197, y, 'K')
    cv.hline(194, 196, 80, 'I2'); cv.hline(194, 196, 90, 'I2')
    cv.rect(189, 62, 200, 72, 'I1')
    cv.rect(189, 62, 200, 65, 'I3'); cv.hline(189, 199, 65, 'I2'); cv.vline(189, 62, 71, 'I2')
    cv.hline(189, 199, 72, 'K'); cv.hline(189, 199, 73, 'D0')
    for (x, y, r) in ((5, 117, 6), (12, 121, 4), (194, 116, 6), (188, 121, 4)):
        for (xx, yy) in m_ell(x, y, r, r * 0.6):
            cv.set(xx, yy, 'K' if hashf(xx, yy, 5) < 0.6 else 'R1')
        cv.set(x, y - 1, 'F1'); cv.set(x + 1, y - 2, 'F2')
    return cv


# ================================================================ 4. The Abyssal Gate

ABYSS = {
    'K': '#05060b',
    'S0': '#0b0b12', 'S1': '#1a1a27', 'S2': '#2c2b3a', 'S3': '#47445a', 'S4': '#6f6a82',
    'N0': '#090e13', 'N1': '#10181e', 'N2': '#162128', 'N3': '#1e2c33',
    'R1': '#1b3d3d', 'R2': '#2f6a60',
    'P1': '#3a1f5e', 'P2': '#6b2f8f', 'P3': '#b555c6',
    'T1': '#1e8984', 'T2': '#58e2c9', 'WH': '#e8fcff',
    'E1': '#0f2a2b', 'E2': '#1c4a46', 'E3': '#33786a', 'EY': '#ffb348',
}


def runes_on(cv, x, y0, y1, seed):
    """A column of small carved glyphs, faintly lit."""
    g = ["101", "010", "111", "100", "001", "110", "011", "101"]
    yy = y0
    i = 0
    while yy + 3 <= y1:
        a = g[int(hashf(i, x, seed) * len(g))]
        b = g[int(hashf(x, i, seed) * len(g))]
        for j, ch in enumerate(a):
            if ch == '1':
                cv.set(x + j, yy, 'T2' if j == 1 else 'T1')
        for j, ch in enumerate(b):
            if ch == '1':
                cv.set(x + j, yy + 1, 'T1')
        yy += 4
        i += 1


def coil(cv, cx, cy, rx, ry, seed, fin=True):
    """A sea-serpent coil arching up out of the wet floor."""
    m = set()
    for (x, y) in m_ell(cx, cy, rx, ry):
        if y <= cy:
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
            if dx * dx + dy * dy >= 0.12:
                m.add((x, y))
    u = run_u(m)
    for (x, y) in m:
        dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
        r = math.sqrt(dx * dx + dy * dy)
        k = 'E2'
        if r > 0.88:
            k = 'E3' if x < cx else 'E1'
        elif r < 0.4:
            k = 'K' if r < 0.25 else 'E1'
        elif ((x + y) % 4 == 0 or (x - y) % 4 == 0) and r < 0.8:
            k = 'E1'                                     # scale lattice
        elif r > 0.75 and x < cx + rx * 0.3:
            k = 'E3' if bay(x, y) < 0.5 else 'E2'
        cv.set(x, y, k)
    if fin:
        for a in range(200, 341, 22):
            fx = cx + math.cos(math.radians(a)) * (rx + 1)
            fy = cy + math.sin(math.radians(a)) * (ry + 1)
            cv.set(fx, fy, 'R2'); cv.set(fx, fy - 1, 'T1')
    # ripples where it breaks the floor
    for x in range(int(cx - rx) - 3, int(cx + rx) + 4):
        if bay(x, cy) < 0.75 and (x, int(cy)) not in m:
            cv.set(x, cy + 1, 'R1')
    cv.hline(cx - rx - 2, cx - rx * 0.7, cy, 'T1'); cv.hline(cx + rx * 0.7, cx + rx + 2, cy, 'R1')


def scene_gate():
    rng = random.Random(503)
    cv = Cv(ABYSS, 'S0', W, H)
    CX = 100
    # ------------------------------------------------ back: a dark sea-cave lit by the gate
    nz = vnoise(61)
    for y in range(0, WALL - 3):
        for x in range(W):
            n = nz(x / 6.0, y / 3.0)
            k = 'S1' if n > 0.48 else 'S0'
            if n > 0.72:
                k = 'S2'
            if y < 4 and bay(x, y) < q4(1 - y / 4.0):
                k = 'K'
            cv.set(x, y, k)
    # the ring of rune-carved pillars, curving away behind the gate
    PIL = [(10, 0), (34, 3), (60, 6), (140, 6), (166, 3), (190, 0)]
    for (px_, top) in PIL:
        lit_left = px_ > CX
        for y in range(top, WALL - 3):
            ks = ('S4', 'S3', 'S3', 'S2', 'S2', 'S1', 'S0') if not lit_left else \
                 ('S0', 'S1', 'S2', 'S2', 'S3', 'S3', 'S4')
            for j, k in enumerate(ks):
                cv.set(px_ - 3 + j, y, k)
        cv.hline(px_ - 4, px_ + 4, top, 'S4'); cv.hline(px_ - 4, px_ + 4, top + 1, 'S2')
        cv.hline(px_ - 4, px_ + 4, top + 2, 'S0')
        cv.hline(px_ - 4, px_ + 4, WALL - 4, 'S3')
        runes_on(cv, px_ - 1, top + 4, WALL - 5, px_)
        light(cv, px_ + 0.5, 12, 7, 12, {'S0': 'P1', 'S1': 'P1'}, power=1.6, steps=2,
              pred=lambda x, y, p=px_: abs(x - p) > 3)
    # the gate: a heavy ring of stone around a purple-teal maelstrom
    GY = 12.5
    ring_o = m_ell(CX + 0.5, GY, 21, 14)
    ring_i = m_ell(CX + 0.5, GY, 15.5, 10.5)
    for (x, y) in ring_o - ring_i:
        if y > WALL - 4:
            continue
        a = math.atan2(y + 0.5 - GY, x + 0.5 - CX - 0.5)
        k = 'S3' if x < CX else 'S2'
        if int((a + 3.2) * 4.5) % 2 == 0:
            k = 'S4' if x < CX - 4 else ('S1' if x > CX + 4 else 'S3')
        cv.set(x, y, k)
    for a in range(0, 360, 30):                            # runes in the ring
        x = CX + 0.5 + math.cos(math.radians(a)) * 18.3
        y = GY + math.sin(math.radians(a)) * 12.2
        if y < WALL - 4:
            cv.set(x, y, 'T2'); cv.set(x + 1, y, 'T1')
    for (x, y) in ring_i:
        if y > WALL - 4:
            continue
        dx = (x + 0.5 - CX - 0.5) / 15.5; dy = (y + 0.5 - GY) / 10.5
        r = math.sqrt(dx * dx + dy * dy)
        a = math.atan2(dy, dx)
        s = math.sin(a * 2 + r * 9.0)
        if r < 0.16:
            k = 'WH'
        elif r < 0.3:
            k = 'T2' if bay(x, y) < 0.75 else 'WH'
        elif s > 0.55:
            k = 'T1' if r > 0.55 else 'T2'
        elif s > 0.0:
            k = 'P3' if r < 0.6 else 'P2'
        elif s > -0.5:
            k = 'P2' if r < 0.8 else 'P1'
        else:
            k = 'P1' if r < 0.85 else 'K'
        if r > 0.9 and bay(x, y) < 0.5:
            k = 'K'
        cv.set(x, y, k)
    light(cv, CX + 0.5, GY, 44, 16, {'S0': 'P1', 'S1': 'P1', 'S2': 'S3'}, power=1.5, steps=3,
          pred=lambda x, y: (x, y) not in ring_o)
    # a dais of stone under the gate
    plinth(cv, 'S3', 'S2', 'S0', spot='S1')
    for i, (hw, y) in enumerate(((24, WALL - 2), (26, WALL), (28, WALL + 2))):
        cv.hline(CX - hw, CX + hw + 1, y, 'S3')
        cv.hline(CX - hw, CX + hw + 1, y + 1, 'S2' if i < 2 else 'S1')
        cv.set(CX - hw, y, 'S4'); cv.set(CX + hw + 1, y + 1, 'S1')
    for x in range(CX - 20, CX + 22, 5):
        cv.set(x, WALL - 2, 'T1')
    # ------------------------------------------------ floor: wet black stone
    flags(cv, {'a': 'N2', 'b': 'N1', 'j': 'N0', 'hi': 'N3'}, seed=44, tw=26, h0=7, dh=1)
    cracks(cv, rng, 16, ('N1', 'N2', 'N3'), 'N0')
    for i in range(3):                                     # re-draw the steps over the flags
        hw, y = ((24, WALL - 2), (26, WALL), (28, WALL + 2))[i]
        cv.hline(CX - hw, CX + hw + 1, y, 'S3')
        cv.hline(CX - hw, CX + hw + 1, y + 1, 'S2' if i < 2 else 'S1')
        cv.set(CX - hw, y, 'S4'); cv.set(CX + hw + 1, y + 1, 'S1')
    for x in range(W):
        if not (CX - 24 <= x <= CX + 25):
            for y in range(WALL, WALL + 3):
                if bay(x, y) < q4(1 - (y - WALL) / 3.0):
                    cv.set(x, y, 'N0')
    # a sheen of standing water: the gate reflected down the middle
    for y in range(WALL + 5, 76, 2):                       # broken ripple strokes
        t = 1 - (y - WALL - 5) / 52.0
        hw = 4 + 12 * (1 - t)
        for x in range(int(CX - hw), int(CX + hw) + 2):
            if hashf(x // 3, y, 12) < 0.45 * t + 0.05 and cv.get(x, y) in ('N1', 'N2', 'N3', 'N0'):
                k = 'P2' if abs(x - CX) < 4 and y < 50 else 'P1'
                if abs(x - CX) < 2 and y < 36:
                    k = 'T1'
                cv.set(x, y, k)
    # the rune circle cut into the floor, faint
    RC = (CX + 0.5, 72, 78, 30)
    for a10 in range(0, 3600, 4):
        a = math.radians(a10 / 10.0)
        for (rr, k) in ((1.0, 'R1'), (0.86, 'R1')):
            x = RC[0] + math.cos(a) * RC[2] * rr
            y = RC[1] + math.sin(a) * RC[3] * rr
            if y > WALL + 6 and cv.get(x, y) in ('N0', 'N1', 'N2', 'N3', 'P1') and hashf(int(x), int(y), 9) < 0.85:
                cv.set(x, y, k)
    for i in range(16):                                    # glyphs between the two rings
        a = math.radians(i * 22.5 + 11)
        x = RC[0] + math.cos(a) * RC[2] * 0.93
        y = RC[1] + math.sin(a) * RC[3] * 0.93
        if y < WALL + 6:
            continue
        gl = ["101", "010", "111", "110", "011"][i % 5]
        for j, ch in enumerate(gl):
            if ch == '1':
                cv.set(x - 1 + j, y, 'R2' if i % 4 == 0 else 'R1')
    # puddles with a teal glint
    for (px_, py_, rx, ry) in ((40, 60, 10, 2.6), (156, 96, 12, 3.0), (70, 108, 8, 2.2),
                               (150, 48, 6, 1.6), (120, 112, 6, 1.6)):
        m = m_ell(px_, py_, rx, ry)
        for (x, y) in m:
            cv.set(x, y, 'N0' if (x, y - 1) not in m else 'N1')
        for x in range(int(px_ - rx * 0.4), int(px_ + rx * 0.2)):
            if hashf(x, 3, 7) < 0.6:
                cv.set(x, py_, 'R1')
        cv.set(px_ - 1, py_, 'T1')
    # wet sheen on stone tops
    for _ in range(140):
        x = rng.randint(0, W - 1); y = rng.randint(WALL + 3, H - 1)
        if cv.get(x, y) == 'N2' and cv.get(x - 1, y) == 'N2':
            cv.set(x, y, 'N3')
    vignette(cv, {'N1': 'N0', 'N2': 'N1', 'N3': 'N2', 'R1': 'N1', 'R2': 'R1', 'P1': 'N1',
                  'P2': 'P1', 'S1': 'S0', 'S2': 'S1', 'S3': 'S2', 'S4': 'S3', 'N0': 'K', 'S0': 'K'},
             cy=66, rx=124, ry=80, inner=0.62, levels=2.0)
    # serpent coils breaking the floor at the edges
    coil(cv, 1, 66, 11, 11, 1)
    coil(cv, 199, 90, 11, 12, 2)
    coil(cv, 194, 44, 5, 6, 3, fin=False)
    coil(cv, 4, 114, 7, 7, 4, fin=False)
    # an eye in the dark at the lower-right corner
    cv.set(197, 116, 'EY'); cv.set(198, 116, 'EY'); cv.set(197, 117, 'K')
    # broken pillar drums in the back corners
    for (x, flip) in ((1, False), (190, True)):
        cv.rect(x, WALL - 2, x + 9, WALL + 7, 'S2')
        for y in range(WALL - 2, WALL + 7):
            cv.set(x + (0 if not flip else 8), y, 'S4' if not flip else 'S1')
            cv.set(x + (8 if not flip else 0), y, 'S1' if not flip else 'S4')
        cv.hline(x, x + 8, WALL - 3, 'S3'); cv.hline(x + 1, x + 7, WALL - 4, 'S4')
        cv.hline(x, x + 8, WALL + 7, 'K')
        for y in range(WALL + 8, WALL + 10):
            for xx in range(x, x + 9):
                if bay(xx, y) < 0.5:
                    cv.set(xx, y, 'N0')
        runes_on(cv, x + 3, WALL, WALL + 6, x)
    return cv


SCENES = [
    ('brass-leviathan', scene_leviathan),
    ('moonwake-abbey', scene_abbey),
    ('storm-anvil', scene_anvil),
    ('abyssal-gate', scene_gate),
]


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'ui', 'instances')
    for sid, fn in SCENES:
        cv = fn()
        path = os.path.join(out, sid + '-scene.png')
        save(cv.px, path)
        print(sid, len(cv.colors()), 'colours', os.path.getsize(path), 'bytes')
