"""The Storm Anvil: an anvil-shaped sea peak in a thunderstorm, lightning striking its flat top,
a forge burning in a cave at its foot, great chains, sparks against the blue-violet rain."""
import random, math
from engine import *

W, H = 192, 72
HZ = 46           # horizon
SEA = 54          # foot of the peak
BX, BY = 154, 16  # where the bolt strikes the anvil's face
FX, FY = 152, 51  # forge mouth

PAL = {
    # storm sky
    'K0': '#0b0a1d', 'K1': '#171936', 'K2': '#252a53', 'K3': '#383f73', 'K4': '#58609b',
    'K5': '#8d96cf',
    # lightning
    'LW': '#f5f8ff', 'LC': '#9fd0ff',
    # rock
    'R0': '#09080f', 'R1': '#181628', 'R2': '#28253f', 'R3': '#3d3858', 'R4': '#5f587b',
    # rock warmed by the forge
    'W1': '#4a2a2e', 'W2': '#7c4231',
    # forge and sparks
    'F1': '#8e2615', 'F2': '#e2591c', 'F3': '#ffa63b', 'F4': '#ffe78e',
    # sea
    'A0': '#070b16', 'A1': '#0f1a2c', 'A2': '#1a2e45', 'A3': '#2d4b63', 'S1': '#90a8c2',
}


def anvil_rows():
    """Left and right edge of the peak for every row: flat top, horn to the left, waist, foot."""
    rows = {}
    for y in range(14, SEA + 1):
        if y < 17:                      # the striking face, slightly domed
            xl, xr = 104 + (17 - y) * 3, 184 - (17 - y) * 2
        elif y < 21:                    # the top slab
            xl, xr = 97 + (y - 17) * 1.2, 186
        elif y < 28:                    # horn underside sweeps in, heel cuts in
            t = (y - 21) / 7.0
            xl = 102 + 28 * t ** 0.7
            xr = 186 - 14 * t ** 0.8
        elif y < 37:                    # the waist
            t = (y - 28) / 9.0
            xl = 130 - 2 * math.sin(t * math.pi)
            xr = 172 + 2 * t
        else:                           # the foot flares out into the sea
            t = (y - 37) / float(SEA - 37)
            xl = 128 - 18 * t ** 1.6
            xr = 174 + 20 * t ** 1.3
        rows[y] = (xl, xr)
    return rows


def chain(cv, pts, k_hi, k_mid, k_lo):
    seq = []
    for a, b in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1])))
        for i in range(n):
            t = i / n
            seq.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    for i in range(0, len(seq), 2):
        x, y = int(round(seq[i][0])), int(round(seq[i][1]))
        if (i // 2) % 2 == 0:
            cv.set(x - 1, y, k_mid); cv.set(x + 1, y, k_lo); cv.set(x, y - 1, k_hi)
            cv.set(x, y + 1, k_lo); cv.set(x, y, 'R0')
        else:
            cv.set(x, y, k_mid)


def catenary(x0, y0, x1, y1, sag, n=30):
    return [(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n + sag * (1 - (2 * i / n - 1) ** 2))
            for i in range(n + 1)]


def draw():
    cv = Cv(PAL, 'K0', W, H)
    nz = vnoise(97)
    rng = random.Random(61)

    # ------------------------------------------------------------ sky and the thunderheads
    bands(cv, [(0, 'K0'), (12, 'K1'), (26, 'K2'), (38, 'K3')], y1=HZ, tw=4)
    r3 = random.Random(29)
    for (cx, cy, n, spread, rr) in ((30, 6, 9, 34, 6.5), (96, 3, 10, 32, 7), (168, 4, 8, 28, 6.5),
                                    (60, 22, 7, 30, 4.5), (120, 28, 5, 20, 3.5), (12, 30, 4, 14, 3.5),
                                    (184, 26, 4, 12, 4)):
        blobs = [(cx + r3.uniform(-spread, spread), cy + r3.uniform(-2.5, 2.5), rr * r3.uniform(0.7, 1.2))
                 for _ in range(n)]
        m = set()
        for (bx, by, br) in blobs:
            m |= m_ell(bx, by, br * 1.35, br)
        for (x, y) in m:
            if not (0 <= x < W and 0 <= y < HZ):
                continue
            near = math.hypot(x - BX, (y - 4) * 1.5) < 52
            k = 'K2'
            if (x, y + 1) not in m or (x, y + 2) not in m:
                k = 'K1'
            if (x, y - 1) not in m or (x - 1, y - 1) not in m:
                k = 'K4' if near else 'K3'
            elif near and ((x, y - 2) not in m or (x + 1, y - 2) not in m):
                k = 'K3'
            if near and ((x, y + 1) not in m) and y < 16:
                k = 'K5'                                    # bellies lit by the strike below
            cv.set(x, y, k)
    light(cv, BX, BY - 4, 60, 26, {'K0': 'K1', 'K1': 'K2', 'K2': 'K3', 'K3': 'K4', 'K4': 'K5'},
          power=1.8, steps=3)
    # far sheet lightning inside the clouds on the left
    light(cv, 34, 10, 16, 8, {'K1': 'K2', 'K2': 'K3', 'K3': 'K4'}, power=1.2, steps=2)
    # ------------------------------------------------------------ far isles in the rain haze
    for (cx, hw, ht) in ((24, 18, 9), (70, 12, 5), (98, 8, 3)):
        for x in range(cx - hw, cx + hw + 1):
            u = (x - cx) / hw
            top = HZ - ht * (1 - abs(u) ** 1.5) - 1.5 * nz(x / 3.0, 2.0)
            for y in range(int(round(top)), HZ):
                cv.set(x, y, 'K2' if (x + y) % 5 else 'K1')
    # ------------------------------------------------------------ the sea, heaving
    bands(cv, [(HZ, 'A2'), (HZ + 3, 'A1'), (HZ + 14, 'A0')], y0=HZ, tw=4)
    for y in range(HZ + 1, H):
        d = y - HZ
        for x in range(W):
            seg = hashf((x + y * 3) // (4 + d // 2), y, 3)
            if y % 2 == 0 and seg < 0.22:
                cv.set(x, y, 'A3' if d < 12 else 'A2')
                if d > 5 and seg < 0.05:
                    cv.set(x, y - 1, 'S1')                 # whitecaps
            elif y % 2 == 1 and seg < 0.1 and d > 3:
                cv.set(x, y, 'A2' if d < 14 else 'A1')
    cv.hline(0, W - 1, HZ, 'A3')

    # ------------------------------------------------------------ the anvil peak
    rows = anvil_rows()
    rock = set()
    for y, (xl, xr) in rows.items():
        for x in range(int(round(xl)), int(round(xr)) + 1):
            rock.add((x, y))
    for y in range(SEA + 1, SEA + 4):                          # rubble at the waterline
        xl, xr = rows[SEA]
        for x in range(int(xl) - 2, int(xr) + 1):
            if hashf(x // 2, y, 7) < 0.7 - (y - SEA) * 0.15:
                rock.add((x, y))
    U = run_u(rock)
    for (x, y) in rock:
        u = U[(x, y)]
        # lit from above and the right by the strike; shadowed under the horn and heel
        lvl = 0.9 + u * 2.0 + 0.35 * (nz(x / 4.0, y / 6.0) - 0.5)
        if 21 <= y < 30:
            lvl -= 0.8 + 0.4 * (1 - (y - 21) / 9.0)            # under the overhang
        elif y < 21:
            lvl += 0.5
        if y in (17, 18):
            lvl += 0.7                                      # the lit front edge of the slab
        lo = max(0, min(3, int(lvl)))
        f = lvl - int(lvl)
        if f > 0.7 or (f > 0.45 and (x + y) % 2 == 0):
            lo = min(3, lo + 1)
        cv.set(x, y, ('R0', 'R1', 'R2', 'R3')[lo])
    # long vertical cracks with a lit lip on their right, strata ledges on the foot
    for (cx, y0, y1) in ((136, 30, 50), (143, 22, 38), (161, 24, 44), (168, 29, 52), (178, 38, 53),
                         (124, 40, 53), (152, 19, 27), (117, 18, 20), (131, 18, 20)):
        for y in range(y0, y1):
            x = int(round(cx + 1.2 * math.sin(y * 0.5 + cx)))
            if (x, y) in rock and (x + 1, y) in rock:
                cv.set(x, y, 'R0')
                k2 = cv.get(x + 1, y)
                cv.set(x + 1, y, {'R0': 'R1', 'R1': 'R2', 'R2': 'R3', 'R3': 'R4'}.get(k2, k2))
    for (ly, lx0, lx1) in ((40, 126, 176), (46, 118, 184), (51, 112, 190), (33, 129, 172)):
        for x in range(lx0, lx1):
            y = ly + int(1.2 * math.sin(x * 0.3))
            if (x, y) in rock and hashf(x // 3, ly, 2) < 0.75:
                cv.set(x, y, 'R0')
                k2 = cv.get(x, y - 1)
                cv.set(x, y - 1, {'R0': 'R1', 'R1': 'R2', 'R2': 'R3', 'R3': 'R4'}.get(k2, k2))
    # the striking face: a flat lit top edge, and the horn tip
    for x in range(98, 187):
        for y in range(13, 22):
            if (x, y) in rock and (x, y - 1) not in rock:
                cv.set(x, y, 'R4')
                if (x, y + 1) in rock and y < 17:
                    cv.set(x, y + 1, 'R3')
                break
    for (x, y) in rock:                                        # right rim lit by the bolt
        if (x + 1, y) not in rock and y < 40:
            cv.set(x, y, 'LC' if y < 22 else 'R4')
    # an old hammer-scar on the face, and a crack running down from the strike
    pts = [(BX, BY + 1), (BX + 2, BY + 4), (BX + 1, BY + 7), (BX + 4, BY + 11), (BX + 3, BY + 15),
           (BX + 6, BY + 20)]
    for a, b in zip(pts, pts[1:]):
        cv.line(a[0], a[1], b[0], b[1], 'R0')
    for a, b in zip(pts[:3], pts[1:4]):
        cv.line(a[0] + 1, a[1], b[0] + 1, b[1], 'LC')

    # ------------------------------------------------------------ the forge cave at its foot
    cave = m_ell(FX, FY + 1, 12, 10)
    cave = {p for p in cave if p[1] <= SEA and p in rock}
    for (x, y) in cave:
        d = math.hypot((x + 0.5 - FX) / 12.0, (y + 0.5 - (FY + 2)) / 9.0)
        g = 1 - d
        if g > 0.6:
            k = 'F4' if bay(x, y) < q4((g - 0.6) * 4) else 'F3'
        elif g > 0.35:
            k = 'F3' if bay(x, y) < q4((g - 0.35) * 4) else 'F2'
        elif g > 0.12:
            k = 'F2' if bay(x, y) < q4((g - 0.12) * 4) else 'F1'
        else:
            k = 'F1' if bay(x, y) < 0.5 else 'R0'
        cv.set(x, y, k)
    for (x, y) in cave:                                        # rough lip
        for (dx, dy) in ((0, -1), (-1, 0), (1, 0)):
            q = (x + dx, y + dy)
            if q not in cave and q in rock:
                cv.set(q[0], q[1], 'W2' if dy < 0 else 'W1')
    # forge light warming the rock round the mouth
    light(cv, FX, FY + 2, 30, 18, {'R1': 'W1', 'R2': 'W1', 'R3': 'W2', 'R0': 'R1', 'R4': 'W2'},
          power=1.4, steps=3, pred=lambda x, y: (x, y) not in cave)
    # an ogre smith hammering a glowing bar on an anvil, in silhouette
    ogre = [".......111",
            ".......111",
            "..11....1.",
            ".1111...1.",
            ".11111.1..",
            "1111111...",
            "11111111..",
            "1111111...",
            ".111111...",
            ".11..11...",
            ".11..11...",
            "111..111.."]
    OX, OY = FX - 10, SEA - 12
    stamp(cv, OX, OY, ogre, {'1': 'R0'})
    cv.set(OX + 3, OY + 3, 'F3')                                  # an eye catching the light
    cv.set(OX + 1, OY + 2, 'S1'); cv.set(OX + 5, OY + 4, 'W2')    # tusk, rim on the shoulder
    cv.rect(FX + 1, SEA - 4, FX + 8, SEA - 2, 'R0'); cv.rect(FX + 3, SEA - 2, FX + 6, SEA + 1, 'R0')
    cv.hline(FX, FX + 5, SEA - 5, 'F4'); cv.set(FX + 6, SEA - 5, 'F3')
    for (dx, dy) in ((1, -7), (3, -8), (5, -7), (2, -10), (6, -9)):
        cv.set(FX + dx, SEA + dy, 'F4')
    # ------------------------------------------------------------ great chains off the horn and heel
    chain(cv, catenary(104, 21, 120, SEA - 1, 5), 'R4', 'R3', 'R1')
    chain(cv, catenary(112, 22, 132, 43, 3), 'R4', 'R3', 'R1')
    chain(cv, catenary(185, 22, 186, SEA - 1, -4), 'LC', 'R4', 'R2')
    for (x, y) in ((120, SEA - 1), (186, SEA - 1), (132, 43)):    # mooring rings
        cv.disc(x, y, 2.2, 'R3'); cv.disc(x, y, 1.0, 'R0'); cv.set(x - 1, y - 2, 'R4')
    for (x, y) in ((104, 21), (112, 22), (185, 22)):              # staples in the rock
        cv.set(x, y, 'R4'); cv.set(x + 1, y, 'R2')
    # ------------------------------------------------------------ the lightning bolt
    pts = [(141, 0)]
    x, y = 141.0, 0
    r2 = random.Random(13)
    while y < BY - 2:
        y += r2.randint(1, 3)
        x += r2.choice((-2, -1, 1, 2, 2, 3))
        pts.append((x, min(y, BY - 2)))
    pts[-1] = (BX, BY - 1)
    for a, b in zip(pts, pts[1:]):
        cv.line(a[0], a[1] + 1, b[0], b[1] + 1, 'LC')
        cv.line(a[0], a[1], b[0], b[1], 'LW')
    for (i, dx, dy) in ((2, -8, 5), (4, 6, 3), (7, -5, 4)):
        f = pts[min(i, len(pts) - 1)]
        cv.line(f[0], f[1], f[0] + dx, f[1] + dy, 'LC')
        cv.line(f[0] + dx, f[1] + dy, f[0] + dx * 1.4 + 1, f[1] + dy + 3, 'LC')
    # the flash where it lands, sparks thrown off the face
    light(cv, BX, BY, 18, 9, {'R2': 'R3', 'R3': 'R4', 'R4': 'LC', 'K2': 'K3', 'K3': 'K4', 'K4': 'K5',
                              'K1': 'K2'}, power=1.6, steps=3)
    for x in range(BX - 7, BX + 8):
        cv.set(x, BY + 1, 'F2' if abs(x - BX) < 5 else 'F1')
        if abs(x - BX) < 3:
            cv.set(x, BY + 1, 'F3')
    cv.disc(BX, BY - 0.5, 2.2, 'LC'); cv.disc(BX, BY - 0.5, 1.3, 'LW')
    for i in range(26):
        a = rng.uniform(math.pi * 1.05, math.pi * 1.95)
        r = rng.uniform(3, 15)
        x = BX + math.cos(a) * r * 1.3; y = BY + math.sin(a) * r * 0.6
        cv.set(x, y, 'LW' if r < 7 else ('F4' if i % 3 else 'F3'))
        if r > 9 and i % 2:
            cv.set(x - math.cos(a), y - math.sin(a) * 0.5, 'F2')
    # ------------------------------------------------------------ embers rising from the forge
    for i in range(34):
        t = rng.random()
        x = FX + rng.uniform(-6, 6) + t * 26 * (0.6 + rng.random())
        y = FY - 2 - t * 40
        k = 'F4' if t < 0.25 else ('F3' if t < 0.6 else 'F2')
        cv.set(x, y, k)
        if i % 4 == 0:
            cv.set(x - 1, y + 1, 'F1')
    # ------------------------------------------------------------ the forge on the water
    for y in range(SEA + 2, H):
        d = y - SEA
        if y % 2:
            continue
        for x in range(FX - 9 - d, FX + 10 + d):
            if hashf(x // 2, y, 5) < 0.55 - d * 0.03 and cv.get(x, y) in ('A0', 'A1', 'A2', 'A3', 'S1'):
                cv.set(x, y, 'F3' if d < 5 and abs(x - FX) < 4 else ('F2' if d < 10 else 'F1'))
    # surf breaking on the rubble
    xl, xr = rows[SEA]
    for x in range(int(xl) - 4, W):
        y = SEA + 3 + int(1.5 * math.sin(x * 0.4))
        if hashf(x, 1, 2) < 0.65 and (x, y) not in cave:
            cv.set(x, y, 'S1')
            if hashf(x, 2, 2) < 0.3:
                cv.set(x, y - 1, 'LW')
    # ------------------------------------------------------------ a longship of raiders beaching
    SX, SY = 92, 62
    for x in range(SX - 11, SX + 12):
        u = abs(x - SX) / 11.0
        top = SY - int(round(u ** 3 * 4))
        for y in range(top, SY + 2):
            if y == SY + 1 and u > 0.8:
                continue
            cv.set(x, y, 'R1' if y == top else 'R0')
    cv.set(SX - 12, SY - 5, 'R0'); cv.set(SX - 12, SY - 6, 'R0'); cv.set(SX - 11, SY - 7, 'R0')   # prow
    cv.set(SX + 12, SY - 5, 'R0'); cv.set(SX + 12, SY - 6, 'R0')
    cv.vline(SX, SY - 14, SY - 1, 'R0')
    for y in range(SY - 13, SY - 4):
        w = 2 + (y - (SY - 13)) // 3
        for x in range(SX - w, SX + w + 1):
            k = 'F1' if (x - SX) % 3 == 0 else 'W1'
            if x == SX - w:
                k = 'W2'
            cv.set(x, y, k)
    cv.hline(SX - 6, SX + 6, SY - 13, 'R0')
    for i in range(6):
        cv.set(SX - 8 + i * 3, SY - 1, 'R3'); cv.set(SX - 8 + i * 3, SY, 'R2')    # shields
    for x in range(SX - 12, SX + 13, 2):
        cv.set(x, SY + 2, 'S1')
    for i in range(4):                                                         # oars
        cv.line(SX - 7 + i * 4, SY + 1, SX - 9 + i * 4, SY + 4, 'R0')

    # ------------------------------------------------------------ rain over everything
    for i in range(240):
        x, y = rng.randrange(W + 20), rng.randrange(-4, H)
        ln = 3 + (i % 3)
        for j in range(ln):
            xx, yy = x - j // 2 - 6, y + j
            k = cv.get(xx, yy)
            if k in ('K0', 'K1', 'K2'):
                cv.set(xx, yy, 'K3')
            elif k in ('K3', 'K4'):
                cv.set(xx, yy, 'K5' if k == 'K4' else 'K4')
            elif k in ('A0', 'A1') and i % 3 == 0:
                cv.set(xx, yy, 'A2')
            elif k in ('R1', 'R0') and i % 3 == 0:
                cv.set(xx, yy, 'R2')
    return cv
