"""The Brass Leviathan: a mechanical whale of riveted brass beached on a sandbar at sunset, its
flank torn open to the ribs, steam pouring from the cracks, porthole eyes still burning."""
import random, math
from engine import *

W, H = 192, 72
HZ = 42           # horizon
SAND = 57         # sandbar line under the wreck

PAL = {
    # sunset sky, top to horizon
    'K0': '#131a33', 'K1': '#22284b', 'K2': '#3c3158', 'K3': '#683c62', 'K4': '#a44f69',
    'K5': '#dd785c', 'K6': '#f5b46a', 'K7': '#ffe9ac',
    # sea, teal
    'A0': '#0a1822', 'A1': '#112c39', 'A2': '#1b4652', 'A3': '#2e6b70',
    # wet sand
    'D1': '#3b2f3c', 'D2': '#5e4648', 'D3': '#8f6a58',
    # brass
    'B0': '#1c120f', 'B1': '#3b2414', 'B2': '#6b421f', 'B3': '#a56a2a', 'B4': '#d8a148',
    'B5': '#fff6d2',
    # verdigris
    'V1': '#2a5650', 'V2': '#4f9783',
    # steam
    'S1': '#857a98', 'S2': '#c6bfd3', 'S3': '#efedf5',
    # furnace glow
    'F1': '#b83d1c', 'F2': '#ff8b2c',
}

BRASS = ('B5', 'B4', 'B3', 'B2', 'B1', 'B0')


def bez(p0, p1, p2, t):
    return ((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
            (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])


def body_samples():
    """Centreline of the hull with its radius: snout on the left, tail lifting on the right."""
    s = []
    n = 160
    for i in range(n + 1):
        t = i / n
        if t < 0.72:
            u = t / 0.72
            x = 88 + u * 82
            y = 44.0 - 1.5 * math.sin(u * math.pi) + u * 2.5
            r = 12.5 + 3.0 * math.sin(min(1, u * 1.6) * math.pi * 0.5) - 11.5 * max(0, u - 0.45) ** 1.4 * 1.9
        else:
            u = (t - 0.72) / 0.28
            x, y = bez((170, 46.5), (183, 46), (184, 25), u)
            r = 4.4 - 1.6 * u
        s.append((x, y, max(2.6, r), t))
    return s


def draw():
    cv = Cv(PAL, 'K0', W, H)
    nz = vnoise(71)
    rng = random.Random(23)

    # ------------------------------------------------------------ sky
    bands(cv, [(0, 'K0'), (8, 'K1'), (16, 'K2'), (24, 'K3'), (31, 'K4'), (36, 'K5'), (40, 'K6')],
          y1=HZ, tw=4, wave=lambda x: 2.5 * math.exp(-((x - 44) / 40.0) ** 2))
    SX, SY = 44, HZ + 1
    cv.disc(SX, SY, 8.5, 'K6')
    cv.disc(SX, SY, 6.5, 'K7')
    light(cv, SX, SY, 30, 14, {'K4': 'K5', 'K5': 'K6', 'K3': 'K4'}, power=1.4, steps=3)
    # long clouds, bellies lit by the low sun
    for (cx, cy, hl, th) in ((60, 30, 40, 2.4), (20, 21, 28, 1.6), (120, 12, 44, 2.6),
                             (160, 27, 30, 1.8), (96, 36, 22, 1.2), (180, 7, 24, 1.6),
                             (40, 9, 22, 1.4), (132, 33, 16, 1.0)):
        for x in range(int(cx - hl), int(cx + hl) + 1):
            u = (x - cx) / hl
            t = th * (1 - u * u) ** 0.5 + 0.5 * math.sin(x * 0.5 + cy) + 0.6 * nz(x / 5.0, cy)
            if t <= 0.5:
                continue
            top = int(round(cy - t * 0.7))
            bot = int(round(cy + t * 0.5))
            body = 'K1' if cy < 15 else ('K2' if cy < 26 else 'K3')
            lit = 'K3' if cy < 15 else ('K4' if cy < 26 else 'K5')
            if abs(x - SX) < 46 and cy > 25:
                lit = 'K6'
            for y in range(top, bot + 1):
                cv.set(x, y, body)
            cv.set(x, bot + 1, lit)
            if abs(u) < 0.6 and hashf(x, cy, 4) < 0.5:
                cv.set(x, bot + 2, lit)
    for i in range(22):                                             # first stars, high up
        x, y = rng.randrange(W), rng.randrange(12)
        if cv.get(x, y) == 'K0':
            cv.set(x, y, 'S1' if i % 3 else 'S2')

    # ------------------------------------------------------------ far isles on the horizon
    for (cx, hw, ht, k) in ((10, 14, 5, 'K2'), (82, 9, 3, 'K3'), (150, 26, 6, 'K2'), (186, 12, 8, 'K1')):
        for x in range(cx - hw, cx + hw + 1):
            u = (x - cx) / hw
            top = HZ - ht * (1 - u * u) ** 0.7 - 1.2 * nz(x / 3.0, 3.0)
            for y in range(int(round(top)), HZ):
                cv.set(x, y, k)
    # a lighthouse on the far right isle, its beam already lit
    cv.vline(183, HZ - 14, HZ - 8, 'K1'); cv.set(183, HZ - 15, 'K7'); cv.set(182, HZ - 15, 'K6')
    for i in range(1, 12):
        if i % 2:
            cv.set(183 - i, HZ - 15 - i // 4, 'K5' if i < 6 else 'K4')

    # ------------------------------------------------------------ sea
    bands(cv, [(HZ, 'A3'), (HZ + 2, 'A2'), (HZ + 8, 'A1'), (HZ + 20, 'A0')], y0=HZ, tw=4)
    for y in range(HZ, H):
        d = y - HZ
        for x in range(W):
            seg = hashf(x // (3 + d // 3), y, 9)
            if abs(x - SX) < 9 - d * 0.25 and seg < 0.7 - d * 0.03 and (y % 2 == 0 or d < 2):
                cv.set(x, y, 'K7' if d < 3 and seg < 0.35 else ('K6' if d < 8 else 'K5'))
            elif d < 16 and seg < 0.2 - d * 0.01 and y % 2 == 1:
                cv.set(x, y, 'K4' if d < 6 else 'A3')
    cv.hline(0, W - 1, HZ, 'A3')
    for x in range(SX - 10, SX + 11):
        cv.set(x, HZ, 'K7' if abs(x - SX) < 6 else 'K6')

    # ------------------------------------------------------------ the sandbar
    sbar = {}
    for x in range(58, W):
        u = (x - 58) / 30.0
        top = SAND - 2.5 * min(1, u) + 1.0 * math.sin(x / 9.0) + 0.6 * nz(x / 4.0, 2.0)
        top = min(top, SAND + 6 - min(6, u * 8))
        sbar[x] = int(round(top))
        for y in range(sbar[x], H):
            d = y - sbar[x]
            k = 'D2' if d < 2 else 'D1'
            if d >= 2 and (y + x // 4) % 5 == 0 and hashf(x // 3, y, 2) < 0.6:
                k = 'D2'
            cv.set(x, y, k)
        cv.set(x, sbar[x], 'D3')
    # the wet lower lip of the bar reflects the sky
    for x in range(58, W):
        for y in range(sbar[x] + 3, H):
            if (y - sbar[x]) > 8 and hashf(x // 4, y, 6) < 0.25 and y % 2 == 0:
                cv.set(x, y, 'A2')
    # tide pools holding the sunset
    for (px_, py_, rw) in ((92, 64, 7), (128, 67, 9), (106, 70, 6), (164, 62, 5), (74, 68, 5)):
        for x in range(px_ - rw, px_ + rw + 1):
            u = abs(x - px_) / rw
            for y in (py_, py_ + 1):
                if u < 1 - (y - py_) * 0.35:
                    k = 'K4' if y == py_ else 'K3'
                    if u < 0.3 and y == py_:
                        k = 'K5'
                    cv.set(x, y, k)
            if u < 0.9:
                cv.set(x, py_ - 1, 'D1')
    # foam where the swell meets the bar
    for x in range(54, 100):
        y = sbar.get(x, SAND + 6) + 1 if x >= 58 else SAND + 6
        if hashf(x, 3, 11) < 0.7:
            cv.set(x - 2, y + (x % 3 == 0), 'S2' if x % 4 else 'S3')

    # ------------------------------------------------------------ the leviathan's hull
    S = body_samples()
    hull = {}
    for (x0, y0, r, t) in S:
        for y in range(int(y0 - r) - 1, int(y0 + r) + 2):
            for x in range(int(x0 - r) - 1, int(x0 + r) + 2):
                d = math.hypot(x + 0.5 - x0, y + 0.5 - y0)
                if d <= r:
                    v = d / r
                    if (x, y) not in hull or v < hull[(x, y)][0]:
                        hull[(x, y)] = (v, (x + 0.5 - x0) / max(d, 0.01), (y + 0.5 - y0) / max(d, 0.01), t, r)
    # the blunt brow of the head: a squared forehead
    brow = m_poly([(84, 33), (100, 29), (104, 40), (85, 47)])
    for p in brow:
        if p not in hull:
            hull[p] = (0.8, -0.7, -0.7, 0.0, 12)
    # the hull sinks into the sand
    hull = {p: v for p, v in hull.items() if p[1] < sbar.get(p[0], SAND) + 1}
    L = (-0.55, -0.72, 0.42)
    for (x, y), (v, ux, uy, t, r) in hull.items():
        nzc = math.sqrt(max(0.0, 1 - v * v))
        b = ux * v * L[0] + uy * v * L[1] + nzc * L[2]
        b += 0.05 * (nz(x / 3.0, y / 3.0) - 0.5) - 0.25 * t
        lvl = (b + 0.1) * 3.3                      # 0 dark .. ~4 bright
        lvl = max(0.0, min(4.2, lvl))
        lo = int(lvl)
        f = lvl - lo
        if f > 0.68 or (f > 0.38 and (x + y) % 2 == 0):
            lo += 1
        k = ('B1', 'B2', 'B3', 'B4', 'B4', 'B5')[min(5, lo)]
        if v > 0.93 and uy > 0.3:
            k = 'B0'                                # belly in shadow
        cv.set(x, y, k)
    HM = set(hull)
    # riveted plates: rows round the hull, staggered joints, a rivet line on every seam
    DARK = {'B5': 'B4', 'B4': 'B3', 'B3': 'B2', 'B2': 'B1', 'B1': 'B0', 'B0': 'B0'}

    def prow(p):
        v, ux, uy, t, r = hull[p]
        return int((uy * v + 1) * 2.5)
    for (x, y), (v, ux, uy, t, r) in hull.items():
        if t < 0.13 or t > 0.74:
            continue
        k = cv.get(x, y)
        row = prow((x, y))
        below = (x, y + 1)
        if below in hull and prow(below) != row:
            cv.set(x, y, DARK[DARK.get(k, k)])
            cv.set(x, y + 1, {'B1': 'B2', 'B2': 'B3', 'B3': 'B4', 'B4': 'B5'}.get(cv.get(x, y + 1), 'B3'))
            if x % 4 == 0:
                cv.set(x, y - 1, 'B5' if k in ('B3', 'B4', 'B5') else 'B4')
        elif int(x + row * 7) % 14 == 0:
            cv.set(x, y, DARK[DARK.get(k, k)])
            if y % 3 == 0:
                cv.set(x + 1, y, 'B5' if k in ('B4', 'B5') else 'B4')
    # verdigris weeping down from the seams on the shaded lower side
    for (x, y), (v, ux, uy, t, r) in hull.items():
        if uy > 0.2 and v > 0.45 and nz(x / 2.0, y / 6.0) > 0.66 and cv.get(x, y) in ('B1', 'B2'):
            cv.set(x, y, 'V1' if (x + y) % 3 else 'V2')
    # top rim light from the sky
    for (x, y) in HM:
        if (x, y - 1) not in HM and y > 0:
            cv.set(x, y, 'B5' if x < 140 else 'B4')
            if (x, y + 1) in HM and x < 120:
                cv.set(x, y + 1, 'B4')

    # ------------------------------------------------------------ the torn flank: ribs and furnace
    hole = m_poly([(118, 36), (123, 31), (127, 34), (131, 30), (136, 33), (141, 31), (147, 35),
                   (150, 41), (147, 46), (149, 51), (141, 50), (134, 54), (127, 51), (121, 52),
                   (117, 46), (119, 41)])
    hole &= HM
    for (x, y) in hole:
        dx, dy = (x - 133) / 15.0, (y - 47) / 9.0
        g = 1 - math.hypot(dx, dy)
        k = 'B0'
        if g > 0.55:
            k = 'F2' if bay(x, y) < q4((g - 0.55) * 4) else 'F1'
        elif g > 0.25:
            k = 'F1' if bay(x, y) < q4((g - 0.25) * 3) else 'B0'
        cv.set(x, y, k)
    # the ribs, curved bands crossing the hole
    for rx in (121, 127, 133, 139, 145):
        for y in range(28, 56):
            bend = 2.2 * math.sin((y - 28) / 28.0 * math.pi)
            x = int(round(rx - bend))
            if (x, y) in hole:
                cv.set(x, y, 'B4' if y < 44 else 'B3')
                if (x + 1, y) in hole:
                    cv.set(x + 1, y, 'B2' if y < 44 else 'B1')
    # a great cog half-seen inside, lit by the fire
    for a in range(0, 360, 4):
        rr = 5 if (a // 20) % 2 else 6
        x = 136 + rr * math.cos(math.radians(a)); y = 47 + rr * math.sin(math.radians(a)) * 0.9
        if (int(x), int(y)) in hole:
            cv.set(x, y, 'B3' if a > 180 else 'B2')
    cv.set(136, 47, 'B4'); cv.set(135, 47, 'B3')
    # torn lips: bright bent plate edges peeled outward
    for (x, y) in hole:
        for (dx, dy) in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            q = (x + dx, y + dy)
            if q not in hole and q in HM:
                cv.set(q[0], q[1], 'B5' if dy < 0 or dx < 0 else 'B2')
    for (x0, y0, x1, y1) in ((123, 31, 121, 26), (131, 30, 132, 24), (141, 31, 144, 25),
                             (150, 41, 155, 38), (117, 46, 112, 49)):
        cv.line(x0, y0, x1, y1, 'B4')
        cv.line(x0 + 1, y0, x1 + 1, y1, 'B1')
    # furnace light spilling out over the sand below the breach
    light(cv, 134, SAND + 1, 20, 7, {'D1': 'D2', 'D2': 'D3', 'B1': 'B2', 'B0': 'B1', 'V1': 'B2'},
          power=1.3, steps=3, pred=lambda x, y: (x, y) not in hole)
    # a small golem standing in the breach, eye lit
    for (x, y) in ((128, 44), (129, 44), (128, 45), (129, 45), (127, 46), (128, 46), (129, 46),
                   (130, 46), (127, 47), (128, 47), (129, 47), (130, 47), (128, 48), (129, 48),
                   (128, 49), (130, 49), (127, 49), (129, 49)):
        cv.set(x, y, 'B0')
    cv.set(129, 44, 'K7')

    # ------------------------------------------------------------ the head: jaw, eye, smaller ports
    # the lower jaw lies slack on the sand with cog-teeth
    jaw = m_poly([(83, 49), (106, 50), (112, 55), (86, 56), (80, 54)])
    for (x, y) in jaw:
        if y < sbar.get(x, SAND) + 1:
            u = (y - 49) / 7.0
            cv.set(x, y, 'B4' if u < 0.2 else ('B3' if u < 0.5 else 'B2'))
    for x in range(84, 106, 3):
        cv.set(x, 48, 'B5'); cv.set(x + 1, 48, 'B3')
    cv.hline(84, 104, 49, 'B0')
    # the great porthole eye
    EX, EY = 99, 39
    cv.disc(EX, EY, 4.6, 'B1')
    cv.disc(EX - 0.3, EY - 0.3, 4.0, 'B4')
    cv.disc(EX, EY, 3.1, 'B2')
    cv.disc(EX, EY, 2.5, 'F1')
    cv.disc(EX + 0.2, EY + 0.2, 1.7, 'F2')
    cv.set(EX - 1, EY - 1, 'K7'); cv.set(EX, EY - 1, 'K7'); cv.set(EX - 1, EY, 'K6')
    for a in range(0, 360, 45):
        cv.set(EX + 4.0 * math.cos(math.radians(a)), EY + 4.0 * math.sin(math.radians(a)), 'B5')
    light(cv, EX, EY, 11, 9, {'B2': 'B3', 'B1': 'B2', 'B3': 'B4', 'V1': 'B3'}, power=1.6, steps=3,
          pred=lambda x, y: math.hypot(x - EX, y - EY) > 4.8)
    # a pectoral fin flopped on the sand
    fin = m_poly([(110, 50), (116, 49), (124, 56), (127, 60), (119, 60), (112, 56)])
    for (x, y) in fin:
        u = (y - 49) / 11.0
        k = 'B4' if (x, y - 1) not in fin else ('B3' if u < 0.5 else 'B2')
        if (x + 1, y) not in fin and (x, y + 1) not in fin:
            k = 'B0'
        cv.set(x, y, k)
    cv.line(113, 51, 122, 58, 'B2'); cv.line(115, 50, 125, 59, 'B5')
    cv.hline(118, 128, 61, 'D1')
    # a row of smaller ports along the flank, a few still glowing
    for i, (px_, py_) in enumerate(((108, 44), (113, 46), (154, 41), (159, 42), (164, 44))):
        cv.disc(px_, py_, 1.6, 'B1')
        lit = i in (0, 2, 4)
        cv.set(px_ - 1, py_ - 1, 'F2' if lit else 'B0'); cv.set(px_, py_ - 1, 'K6' if lit else 'B0')
        cv.set(px_ - 1, py_, 'F1' if lit else 'B0'); cv.set(px_, py_, 'F2' if lit else 'B1')
    # a broken blowhole stack on top of the head
    cv.rect(105, 26, 109, 31, 'B3'); cv.vline(105, 26, 30, 'B5'); cv.vline(108, 26, 30, 'B1')
    cv.hline(104, 109, 25, 'B4'); cv.hline(104, 109, 26, 'B2')

    # ------------------------------------------------------------ tail flukes rising, right edge
    fl = m_poly([(184, 27), (176, 20), (170, 13), (175, 14), (181, 19), (185, 23), (189, 16),
                 (192, 10), (192, 26), (187, 28)])
    for (x, y) in fl:
        u = (x - 170) / 22.0
        k = 'B4' if (x, y - 1) not in fl else ('B3' if u < 0.55 else 'B2')
        cv.set(x, y, k)
    cv.line(171, 14, 184, 25, 'B1')
    for (x, y) in ((176, 18), (179, 21), (190, 18)):
        cv.set(x, y, 'B5')
    # dripping water off the flukes
    for (x, y0, ln) in ((172, 15, 6), (175, 18, 4), (186, 28, 7)):
        for i in range(ln):
            if i % 2 == 0:
                cv.set(x, y0 + i, 'S2' if i < 3 else 'A3')

    # ------------------------------------------------------------ wet-sand reflection of the hull
    for (x, y) in list(HM):
        top = sbar.get(x, SAND)
        if y > top - 1:
            continue
        ry = 2 * top - y + 1
        if top + 1 < ry < H and ry - top < 11 and (ry % 2 == 0):
            k = cv.get(x, y)
            rk = {'B5': 'B3', 'B4': 'B3', 'B3': 'B2', 'F2': 'F1', 'F1': 'B2', 'K7': 'F2'}.get(k, 'B1')
            if ry - top > 5:
                rk = {'B3': 'B2', 'B2': 'B1', 'F1': 'B2', 'F2': 'F1'}.get(rk, 'D1')
            if hashf(x // 2, ry, 8) < 0.7:
                cv.set(x + (1 if hashf(ry, 1, 4) < 0.3 else 0), ry, rk)
    # the eye's long glint across the wet sand
    for y in range(SAND + 2, H, 2):
        if hashf(1, y, 3) < 0.8:
            cv.hline(EX - 1 + (y % 4 == 0), EX + (y < SAND + 8), y, 'F2' if y < SAND + 7 else 'F1')

    # ------------------------------------------------------------ steam venting from the cracks
    def plume(x0, y0, drift, rise, w0, seed):
        r2 = random.Random(seed)
        blobs = []
        for i in range(10):
            t = i / 9.0
            blobs.append((x0 + drift * t ** 1.3 + r2.uniform(-1, 1), y0 - rise * t, w0 + 4.5 * t))
        m = set()
        for (bx, by, br) in blobs:
            m |= m_ell(bx, by, br, br * 0.75)
        for (x, y) in m:
            t = (y0 - y) / rise
            if t > 0.5 and nz(x / 2.5, y / 2.5) < (t - 0.5) * 1.4:
                continue                                   # tears apart as it rises
            k = 'S2'
            if (x - 1, y - 1) not in m or (x, y - 1) not in m:
                k = 'S3'
            elif (x + 1, y + 1) not in m or (x + 2, y) not in m:
                k = 'S1'
            if t > 0.7 and k == 'S3':
                k = 'S2'
            cv.set(x, y, k)
    plume(131, 26, 18, 22, 1.8, 3)
    plume(146, 33, 22, 14, 1.2, 4)
    plume(108, 22, 10, 14, 1.0, 5)
    # jets: thin hissing streams from small cracks
    for (x0, y0, dx, ln) in ((160, 34, 1, 7), (115, 33, -1, 5)):
        for i in range(ln):
            cv.set(x0 + dx * i, y0 - i // 2, 'S3' if i < 3 else 'S2')

    # ------------------------------------------------------------ foreground debris and figures
    # a snapped brass rib-plate stuck in the sand, front right
    rib = m_bez((168, 72), (170, 56), (180, 52), 1.8, 0.8)
    cyl(cv, rib, ('B5', 'B4', 'B3', 'B1'), cuts=(0.25, 0.55, 0.85))
    rib2 = m_bez((182, 72), (184, 60), (191, 56), 1.4, 0.7)
    cyl(cv, rib2, ('B4', 'B3', 'B2', 'B1'), cuts=(0.3, 0.6, 0.85))
    # a half-buried gear
    for a in range(0, 360, 6):
        rr = 4 if (a // 30) % 2 else 5
        cv.set(150 + rr * math.cos(math.radians(a)), 66 + rr * math.sin(math.radians(a)) * 0.6,
               'B3' if a > 180 else 'B2')
    cv.hline(147, 153, 67, 'D1'); cv.hline(146, 154, 68, 'D2')
    # two wanderers with a lantern walking up the bar
    for (fx, fy, lamp) in ((76, SAND + 2, True), (71, SAND + 3, False)):
        for (dx, dy) in ((0, -5), (0, -4), (-1, -4), (1, -4), (0, -3), (-1, -3), (0, -2), (1, -2),
                         (-1, -1), (1, -1), (-1, 0), (1, 0)):
            cv.set(fx + dx, fy + dy, 'B0')
        if lamp:
            cv.set(fx + 2, fy - 3, 'K7'); cv.set(fx + 2, fy - 2, 'F2')
            light(cv, fx + 2.5, fy - 2, 6, 4, {'D2': 'D3', 'D1': 'D2', 'A1': 'A2'}, power=1.5, steps=2)
    for i in range(6):                                              # their footprints
        cv.set(79 + i * 3, SAND + 2 - (i // 3), 'D1')

    # ------------------------------------------------------------ gulls
    for (x, y, p, k) in ((94, 18, 0, 'B0'), (102, 14, 1, 'B0'), (114, 20, 2, 'B0'), (66, 24, 1, 'K1'),
                         (156, 10, 0, 'S3'), (165, 16, 1, 'S2'), (144, 22, 2, 'S3'), (122, 9, 0, 'K1')):
        crow_fly(cv, x, y, k, p)
    for (x, y) in ((107, 24), (176, 12)):                            # perched
        cv.set(x, y, 'S3'); cv.set(x + 1, y, 'S2'); cv.set(x, y - 1, 'S3'); cv.set(x + 1, y + 1, 'B0')
    return cv
