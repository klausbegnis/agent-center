"""The Coral Labyrinth: a split view at a lagoon's waterline. Calm dusk above; below, walls of
coral lit by shafts of light, a gate arch made from a huge horned skull, bubbles and a slime."""
import random, math
from engine import *

W, H = 192, 72
WL = 19          # the waterline
GX = 140         # gate axis
FLOOR = 61       # where the sand begins in front

PAL = {
    # dusk sky over the lagoon
    'S0': '#1c1840', 'S1': '#2f3f78', 'S2': '#4f8ea6', 'S3': '#e8b07a', 'S4': '#fff0c8',
    'I0': '#141838',
    # water, surface to depth
    'U0': '#08122a', 'U1': '#0d2446', 'U2': '#12405e', 'U3': '#1a6a7c', 'U4': '#2fa0a0',
    'U5': '#9ae8d8',
    # coral, shadow to sunlit tips
    'C0': '#3c1636', 'C1': '#6e2448', 'C2': '#b03c5c', 'C3': '#ea6a62', 'C4': '#ffaa7a',
    # far coral seen through water
    'D1': '#2c3466', 'D2': '#4e4a82',
    # bone
    'B1': '#4a5068', 'B2': '#8a90a0', 'B3': '#d6d8c4',
    # the slime
    'J1': '#2a7a46', 'J2': '#76d860', 'J3': '#e6ffb0',
    # sand
    'N1': '#173048', 'N2': '#2c5468', 'N3': '#5a8c8a',
}

UP = {'U0': 'U1', 'U1': 'U2', 'U2': 'U3', 'U3': 'U4', 'U4': 'U5', 'D1': 'D2', 'N1': 'N2', 'N2': 'N3',
      'C1': 'C2', 'C0': 'C1', 'B1': 'B2'}
WATER = ('U0', 'U1', 'U2', 'U3', 'U4', 'U5')


def surf(x):
    return WL + 0.8 * math.sin(x * 0.21) + 0.6 * math.sin(x * 0.07 + 1.3)


def coral_wall(cv, nz, x0, x1, top, bot, keys, seed, branch=True):
    """A wall of coral: knobbly top, branching staghorn tips, polyp texture, lit from above.
    keys run dark to light (4 of them)."""
    r = random.Random(seed)
    edge = smooth(mpd(r, x1 - x0 + 2, 1.6, 0.7), 1)
    m = set()
    for x in range(x0, x1 + 1):
        t = top + edge[x - x0] + 1.5 * math.sin(x * 0.9 + seed) * 0.5
        for y in range(int(round(t)), bot):
            m.add((x, y))
    for (x, y) in m:
        d = y - min(yy for yy in range(y - 6, y + 1) if (x, yy) in m) if False else None
        tt = (y - top) / max(1.0, bot - top)
        i = 2 if tt < 0.18 else (1 if tt < 0.55 else 0)
        n = nz(x / 2.5, y / 2.5 + seed)
        if n > 0.62:
            i = min(3, i + 1)
        elif n < 0.3:
            i = max(0, i - 1)
        if (x, y - 1) not in m:
            i = 3
        elif (x, y - 2) not in m:
            i = max(i, 2)
        if (x + 2 * y) % 5 == 0 and (y * 3 + x) % 3 == 0 and i > 0:
            i -= 1                                    # polyp pits
        cv.set(x, y, keys[i])
    if branch:
        for i in range(int((x1 - x0) / 3.5)):
            bx = r.randint(x0 + 1, x1 - 1)
            by = int(round(top + edge[bx - x0]))
            h = r.randint(2, 6)
            lean = r.choice((-1, 0, 1))
            for j in range(h):
                xx = bx + (lean * j) // 3
                cv.set(xx, by - j, keys[2] if j < h - 1 else keys[3])
                if j == h // 2 and h > 3:
                    s = r.choice((-1, 1))
                    cv.set(xx + s, by - j - 1, keys[3]); cv.set(xx + s, by - j, keys[2])
    return m


def maze_wall(cv, nz, x0, x1, top, bot, keys, seed, tf=2, growth=True):
    """A block of the labyrinth: a lit top face, a front face of stacked coral courses with
    polyp texture, a lit left end and a shadowed right end, and growth along the top.
    keys run dark to light (5 of them)."""
    r = random.Random(seed)
    edge = smooth(mpd(r, x1 - x0 + 2, 0.9, 0.7), 1)
    for x in range(x0, x1 + 1):
        t0 = int(round(top + edge[x - x0]))
        for y in range(t0, bot):
            d = y - t0
            if d < tf:
                k = keys[4] if d == 0 else keys[3]
            else:
                tt = (y - t0 - tf) / max(1.0, bot - t0 - tf)
                i = 2 if tt < 0.2 else (1 if tt < 0.6 else 0)
                n = nz(x / 2.2, y / 1.6 + seed)
                if n > 0.66:
                    i = min(3, i + 1)
                elif n < 0.28:
                    i = max(0, i - 1)
                if (y - t0 - tf) % 4 == 3 and hashf(x // 3, y, seed) < 0.7:
                    i = max(0, i - 1)                     # courses
                if (x + 2 * y) % 5 == 0 and (y * 3 + x) % 3 == 0 and i > 0:
                    i -= 1                                # polyp pits
                if x - x0 < 2:
                    i = min(3, i + 1)
                if x1 - x < 2:
                    i = 0
                k = keys[i]
            cv.set(x, y, k)
    if growth:
        for i in range(int((x1 - x0) / 3.0)):
            bx = r.randint(x0 + 1, x1 - 1)
            by = int(round(top + edge[bx - x0])) - 1
            kind = r.random()
            h = r.randint(2, 5 + tf)
            if kind < 0.6:
                lean = r.choice((-1, 0, 1))
                for j in range(h):
                    xx = bx + (lean * j) // 3
                    cv.set(xx, by - j, keys[3] if j < h - 1 else keys[4])
                    if j == h // 2 and h > 3:
                        s = r.choice((-1, 1))
                        cv.set(xx + s, by - j - 1, keys[4]); cv.set(xx + s, by - j, keys[3])
            elif kind < 0.8:
                for j in range(min(h, 3)):
                    cv.hline(bx - j, bx + j + 1, by - 2 + j, keys[3] if j else keys[4])
            else:
                cv.set(bx, by, keys[2]); cv.set(bx, by - 1, keys[4]); cv.set(bx + 1, by, keys[1])


def brain(cv, cx, cy, rx, ry, keys):
    m = m_ell(cx, cy, rx, ry)
    for (x, y) in m:
        v = (y + 0.5 - cy) / ry
        groove = math.sin(x * 1.3 + 2.5 * math.sin(y * 0.9)) > 0.45
        i = 3 if v < -0.45 else (2 if v < 0.1 else (1 if v < 0.6 else 0))
        if groove:
            i = max(0, i - 1)
        if (x, y - 1) not in m:
            i = 3
        cv.set(x, y, keys[i])
    return m


def fan(cv, bx, by, h, keys, lean=0):
    """A sea fan: a stalk spreading into a lattice of fine branches."""
    for j in range(h):
        w = int(j * 0.6)
        y = by - j
        for i in range(-w, w + 1):
            if (i + j) % 2 == 0 or abs(i) == w or j % 3 == 0:
                cv.set(bx + i + (lean * j) // 4, y, keys[2] if j < h - 2 else keys[3])


def draw():
    cv = Cv(PAL, 'U0', W, H)
    nz = vnoise(19)
    rng = random.Random(31)

    # ------------------------------------------------------------ above: dusk over the lagoon
    bands(cv, [(0, 'S0'), (6, 'S1'), (12, 'S2'), (16, 'S3')], y1=WL + 2, tw=3)
    cv.disc(28, 15, 2.6, 'S4')                                       # sun touching the sea
    for (cx, cy, hl) in ((60, 5, 22), (150, 8, 30), (110, 3, 14)):    # thin warm clouds
        for x in range(cx - hl, cx + hl):
            u = (x - cx) / hl
            if 1 - u * u < 0.25:
                continue
            cv.set(x, cy, 'S1' if cy < 6 else 'S2')
            cv.set(x, cy + 1, 'S3' if abs(u) < 0.7 else 'S2')
    for (x, y) in ((176, 2), (14, 3), (96, 9), (128, 1)):
        cv.set(x, y, 'S4')
    # a low island on the horizon with leaning palms
    for x in range(150, 184):
        u = (x - 167) / 17.0
        top = 17 - int(3 * (1 - u * u) ** 0.6)
        for y in range(top, 19):
            cv.set(x, y, 'I0')
    for (px, py, h, lean) in ((162, 15, 7, -1), (170, 14, 9, 1), (176, 16, 5, 1)):
        for j in range(h):
            cv.set(px + (lean * j * j) // 18, py - j, 'I0')
        tx, ty = px + (lean * h * h) // 18, py - h
        for (dx, dy) in ((-3, 1), (-2, 0), (-1, 0), (1, 0), (2, 0), (3, 1), (-4, 2), (4, 2), (0, -1)):
            cv.set(tx + dx, ty + dy, 'I0')
    # distant sail
    cv.vline(92, 12, 18, 'I0'); cv.poly([(93, 12), (97, 17), (93, 17)], 'S3'); cv.hline(89, 96, 18, 'I0')

    # ------------------------------------------------------------ below: water, deepening
    for x in range(W):
        s = surf(x)
        for y in range(int(s), H):
            d = y - s
            k = 'U4' if d < 3 else ('U3' if d < 10 else ('U2' if d < 22 else ('U1' if d < 38 else 'U0')))
            for (b, a, c) in ((3, 'U4', 'U3'), (10, 'U3', 'U2'), (22, 'U2', 'U1'), (38, 'U1', 'U0')):
                if b - 3 <= d < b:
                    k = c if bay(x, y) < q4((d - b + 3) / 3.0) else a
            cv.set(x, y, k)
        # the waterline itself and the bright underside of the surface
        sy = int(round(s))
        cv.set(x, sy, 'U5')
        cv.set(x, sy - 1, 'S4' if hashf(x // 3, 0, 4) < 0.25 else 'S2')
        if hashf(x // 2, 1, 4) < 0.45:
            cv.set(x, sy + 1, 'U5')
        if hashf(x // 4, 2, 4) < 0.35 and x % 2 == 0:
            cv.set(x, sy + 2, 'U5')
    # the sun's ripple on the underside
    for x in range(14, 44):
        if hashf(x, 3, 1) < 0.6:
            cv.set(x, int(round(surf(x))) - 1, 'S4')

    # ------------------------------------------------------------ shafts of light from the surface
    shafts = ((30, 4, 0.35), (62, 6, 0.32), (96, 3, 0.36), (124, 7, 0.3), (172, 5, 0.34), (150, 3, 0.33))
    for (sx, sw, slope) in shafts:
        for y in range(WL + 2, H):
            d = y - WL
            cx = sx + d * slope
            hw = sw + d * 0.12
            fall = max(0.0, 1 - d / 52.0)
            for x in range(int(cx - hw), int(cx + hw) + 1):
                u = abs(x + 0.5 - cx) / hw
                if u >= 1:
                    continue
                t = (1 - u) ** 0.8 * fall
                k = cv.get(x, y)
                if k in WATER and k != 'U5' and bay(x, y) < q4(t * 1.1):
                    cv.set(x, y, UP[k])

    # ------------------------------------------------------------ the far maze: walls fading into blue
    FK = ('U1', 'D1', 'D1', 'D2', 'D2')
    for (x0, x1, top) in ((0, 38, 38), (46, 72, 37), (80, 104, 39), (172, 192, 38), (108, 118, 40)):
        maze_wall(cv, nz, x0, x1, top, 47, FK, x0 + 3, tf=1)
    # middle walls, closer and warmer, with gaps between them
    MK = ('U1', 'C0', 'D2', 'C1', 'C2')
    for (x0, x1, top, sd) in ((2, 28, 44, 3), (50, 84, 45, 5), (94, 110, 46, 6), (172, 192, 44, 8)):
        maze_wall(cv, nz, x0, x1, top, 56, MK, sd, tf=2)
    # a side wall running off into the dark, so the corridors read as a maze
    side = m_poly([(64, 52), (90, 46), (90, 56), (64, 66)])
    for (x, y) in side:
        u = (x - 64) / 26.0
        k = 'C1' if u < 0.4 else ('D2' if u < 0.75 else 'D1')
        n = nz(x / 2.0, y / 1.5 + 9)
        if n < 0.32:
            k = 'C0' if u < 0.5 else 'U1'
        elif n > 0.7 and u < 0.5:
            k = 'C2'
        cv.set(x, y, k)
    for x in range(64, 91):
        y = int(round(52 - (x - 64) * 6 / 26.0))
        cv.set(x, y, 'C3' if x < 76 else 'C2'); cv.set(x, y + 1, 'C2' if x < 76 else 'D2')
    # sand of the corridors
    for y in range(52, H):
        for x in range(W):
            if cv.get(x, y) in WATER:
                d = y - 52
                k = 'N1' if d < 4 else ('N2' if bay(x, y) < q4(d / 14.0) else 'N1')
                cv.set(x, y, k)
    # caustic web on the sand
    for y in range(54, H):
        for x in range(W):
            if cv.get(x, y) in ('N1', 'N2'):
                v = abs(math.sin(x * 0.45 + 2 * math.sin(y * 0.5)) * math.sin(y * 0.9 + 1.5 * math.sin(x * 0.3)))
                if v < 0.08:
                    cv.set(x, y, 'N3' if y > 60 else 'N2')

    # ------------------------------------------------------------ the skull gate
    # the passage behind: a dark corridor with a glow at its far end
    pas = set()
    for y in range(30, 62):
        for x in range(GX - 16, GX + 17):
            dx = x + 0.5 - GX
            if (y >= 42 and abs(dx) <= 13) or math.hypot(dx, (y + 0.5 - 42) * 1.1) <= 13:
                pas.add((x, y))
    for (x, y) in pas:
        dx = abs(x + 0.5 - GX)
        g = math.hypot(dx / 9.0, (y - 52) / 7.0)
        k = 'U0'
        if g < 1:
            k = 'U2' if bay(x, y) < q4(1 - g) else 'U1'
            if g < 0.45:
                k = 'U3' if bay(x, y) < q4((0.45 - g) * 3) else 'U2'
        cv.set(x, y, k)
    # something horned waiting in the corridor
    mino = m_ell(GX + 1, 53, 2.6, 3.2) | m_ell(GX + 1, 48.5, 1.6, 1.6) | m_seg(GX - 0.5, 56, GX - 0.5, 60, 0.6) \
        | m_seg(GX + 2.5, 56, GX + 2.5, 60, 0.6)
    for (x, y) in mino:
        cv.set(x, y, 'U0')
    for (x, y) in ((GX - 2, 47), (GX - 3, 46), (GX + 4, 47), (GX + 5, 46)):
        cv.set(x, y, 'U0')
    cv.set(GX, 48, 'C4'); cv.set(GX + 2, 48, 'C4')
    # floor of the passage, a lit path running out to the viewer
    for y in range(56, H):
        t = (y - 56) / (H - 56.0)
        hw = 6 + 14 * t
        cx = GX - 10 * t
        for x in range(int(cx - hw), int(cx + hw) + 1):
            k = cv.get(x, y)
            if k in ('N1', 'N2', 'U0', 'U1', 'U2', 'U3') and (x, y) not in mino:
                cv.set(x, y, 'N2' if bay(x, y) < q4(0.5 + t * 0.5) else 'N1')
    # the horns: the arch itself, ridged bone, tips sunk in coral
    HB = ((GX - 9, 29), (GX + 9, 29))
    horns = []
    for side, (hx, hy) in zip((-1, 1), HB):
        p1 = (GX + side * 36, 22)
        p2 = (GX + side * 24, 62)
        pts = []
        for i in range(61):
            t = i / 60
            x = (1 - t) ** 2 * hx + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
            y = (1 - t) ** 2 * hy + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
            pts.append((x, y, 3.6 - 2.2 * t))
        horns.append((side, pts))
    for side, pts in horns:
        m = set()
        for (x, y, r) in pts:
            m |= m_ell(x, y, r, r)
        for (x, y) in m:
            best, bi = 1e9, 0
            for i, (px_, py_, r) in enumerate(pts):
                d = (x + 0.5 - px_) ** 2 + (y + 0.5 - py_) ** 2
                if d < best:
                    best, bi = d, i
            px_, py_, r = pts[bi]
            ox, oy = (x + 0.5 - px_) / max(r, 0.8), (y + 0.5 - py_) / max(r, 0.8)
            lam = -0.35 * ox - 0.9 * oy                     # light from above, a little left
            k = 'B3' if lam > 0.45 else ('B2' if lam > -0.15 else ('B1' if lam > -0.7 else 'U1'))
            if bi % 6 == 0 and k != 'B3':
                k = 'B1' if k == 'B2' else 'U1'              # growth rings
            cv.set(x, y, k)
    # the skull, facing us, crowning the arch: broad brow, long tapering face
    def face_hw(y):
        if y < 34:
            return 10.5 - max(0, 27 - y) * 1.6
        return 10.5 - (y - 34) * 0.55
    skull = set()
    for y in range(23, 49):
        hw = face_hw(y)
        if y >= 46:
            hw = 4.5 - (y - 46) * 0.8
        for x in range(int(round(GX - hw)), int(round(GX + hw)) + 1):
            skull.add((x, y))
    SU = run_u(skull)
    for (x, y) in skull:
        u = SU[(x, y)]
        c = abs(u - 0.5) * 2                       # 0 on the muzzle ridge, 1 at the cheeks
        k = 'B3' if c < 0.25 else ('B2' if c < 0.75 else 'B1')
        if y > 40 and c > 0.5:
            k = 'B1'
        if (x, y - 1) not in skull:
            k = 'B3'
        if (x + 1, y) not in skull or (x, y + 1) not in skull:
            k = 'B1'
        cv.set(x, y, k)
    # brow ridge, deep sockets with a cold glow, the nasal pit, teeth
    for x in range(GX - 9, GX + 10):
        cv.set(x, 29, 'B3')
    for sx in (GX - 7, GX + 3):
        sock = m_ell(sx + 2, 32.5, 2.6, 2.2)
        for (x, y) in sock:
            cv.set(x, y, 'U0')
        cv.set(sx + 2, 32, 'U5'); cv.set(sx + 2, 33, 'U4'); cv.set(sx + 1, 32, 'U3')
        cv.hline(sx, sx + 4, 35, 'B1')
    for (x, y) in ((GX - 1, 38), (GX, 38), (GX - 2, 39), (GX - 1, 39), (GX, 39), (GX + 1, 39),
                   (GX - 2, 40), (GX - 1, 40), (GX + 1, 40), (GX, 40), (GX - 1, 41), (GX, 41)):
        cv.set(x, y, 'U0')
    for x in range(GX - 3, GX + 4):
        cv.set(x, 46, 'U0')
        if x % 2 == 0:
            cv.set(x, 47, 'B3')
    cv.line(GX + 2, 24, GX + 4, 28, 'B1'); cv.line(GX - 6, 37, GX - 4, 43, 'B1')
    cv.set(GX - 5, 40, 'U0'); cv.set(GX + 6, 38, 'B1')
    light(cv, GX + 0.5, 33, 16, 8, {'U1': 'U2', 'U2': 'U3', 'U0': 'U1'}, power=1.5, steps=2,
          pred=lambda x, y: (x, y) not in skull)
    # coral and weed growing over the skull and the horn roots
    for (x, y) in ((GX - 10, 26), (GX - 9, 25), (GX - 11, 27), (GX + 9, 26), (GX + 10, 25),
                   (GX + 6, 24), (GX - 3, 23), (GX - 2, 23), (GX + 7, 37), (GX + 8, 36)):
        cv.set(x, y, 'C3')
    cv.set(GX - 3, 22, 'C4'); cv.set(GX + 10, 24, 'C4'); cv.set(GX + 6, 23, 'C4')
    for side in (-1, 1):
        coral_wall(cv, nz, GX + side * 26 - 6, GX + side * 26 + 6, 55, 63,
                   ('C0', 'C1', 'C2', 'C3'), 40 + side)
    # light catching the top of the skull
    light(cv, GX, 22, 22, 10, {'B2': 'B3', 'B1': 'B2', 'U2': 'U3', 'U3': 'U4'}, power=1.6, steps=3)

    # ------------------------------------------------------------ foreground coral, both sides
    NK = ('C0', 'C1', 'C2', 'C3', 'C4')
    maze_wall(cv, nz, -2, 60, 53, H, NK, 7, tf=3)
    brain(cv, 22, 54, 8, 4, ('C0', 'C1', 'C2', 'C3'))
    brain(cv, 48, 58, 6, 4, ('C0', 'C1', 'C3', 'C4'))
    fan(cv, 8, 52, 12, ('C1', 'C1', 'C3', 'C4'), lean=-1)
    fan(cv, 36, 50, 9, ('C1', 'C1', 'C2', 'C3'), lean=1)
    maze_wall(cv, nz, 158, 194, 50, H, NK, 11, tf=3)
    brain(cv, 186, 51, 7, 4, ('C0', 'C1', 'C3', 'C4'))
    fan(cv, 168, 49, 11, ('C1', 'C1', 'C3', 'C4'), lean=-1)
    # tube sponges with dark mouths
    for (tx, ty, h) in ((58, 52, 7), (61, 53, 5), (64, 54, 4), (176, 50, 6), (179, 51, 4)):
        for j in range(h):
            cv.set(tx, ty - j, 'C2' if j < h - 1 else 'C4')
            cv.set(tx + 1, ty - j, 'C1')
        cv.set(tx, ty - h, 'C0')
    # sunlit tips where the shafts land
    for (sx, sw, slope) in shafts:
        for y in range(44, H):
            cx = sx + (y - WL) * slope
            for x in range(int(cx - 4), int(cx + 5)):
                k = cv.get(x, y)
                if k in ('C2', 'C3') and (cv.get(x, y - 1) not in ('C0', 'C1', 'C2', 'C3', 'C4')):
                    cv.set(x, y, 'C4')

    # ------------------------------------------------------------ the slime on the sand, glowing
    JX, JY = 108, 64
    blob = m_ell(JX, JY, 8.5, 6.5)
    blob = {p for p in blob if p[1] < JY + 3}
    light(cv, JX, JY + 1, 20, 9, {'N1': 'N2', 'N2': 'N3', 'C0': 'C1', 'C1': 'C2', 'U0': 'U1', 'U1': 'U2'},
          power=1.4, steps=3)
    for (x, y) in blob:
        u = (x + 0.5 - JX) / 8.5
        v = (y + 0.5 - JY) / 6.5
        d = u * u + v * v
        k = 'J2' if bay(x, y) < q4(1 - d) * 0.75 else 'J1'
        if d > 0.72:
            k = 'J1'
        if d < 0.3 and v > -0.2:
            k = 'J3' if bay(x, y) < 0.25 else 'J2'          # the glowing heart
        if (x, y - 1) not in blob:
            k = 'J2'
        cv.set(x, y, k)
    for i in range(9):                                     # specular arc
        a_ = math.pi * (1.15 + i * 0.05)
        cv.set(JX + math.cos(a_) * 6.6, JY + math.sin(a_) * 4.8, 'J3')
    for (x, y) in ((JX + 6, JY + 3), (JX + 6, JY + 4), (JX - 7, JY + 3)):   # drips
        cv.set(x, y, 'J1')
    # a swallowed bone floating inside, and two dim eyes
    cv.line(JX - 1, JY + 1, JX + 4, JY - 1, 'B2'); cv.set(JX - 1, JY, 'B3'); cv.set(JX + 4, JY - 2, 'B3')
    cv.set(JX - 2, JY - 2, 'U0'); cv.set(JX + 2, JY - 2, 'U0')
    for x in range(JX - 8, JX + 9):
        cv.set(x, JY + 3, 'J1' if abs(x - JX) < 7 else 'N2')
    # ------------------------------------------------------------ a water elemental swirling over the left wall
    EX, EY = 70, 36
    prev = None
    for i in range(90):
        t = i / 90.0
        a = t * 6 * math.pi
        rr = 1.5 + 5.5 * t
        x = EX + math.cos(a) * rr
        y = EY + 10 - t * 18 + math.sin(a) * rr * 0.3
        front = math.sin(a) > 0
        if prev:
            cv.line(prev[0], prev[1], x, y, 'U5' if front else 'U3')
        prev = (x, y)
    cv.set(EX - 1, EY - 7, 'S4'); cv.set(EX + 2, EY - 7, 'S4')

    # ------------------------------------------------------------ bubbles, fish
    br = random.Random(5)
    for (bx, by0, n) in ((GX - 3, 46, 6), (JX + 1, 58, 5), (114, 50, 4), (86, 44, 4), (182, 40, 5)):
        x, y = bx, by0
        for i in range(n):
            y -= br.randint(3, 6)
            x += br.choice((-1, 0, 1))
            if y < WL + 2:
                break
            if i % 2 == 0:
                for (dx, dy) in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                    cv.set(x + dx, y + dy, 'U5')
                cv.set(x - 1, y - 1, 'S4') if False else None
            else:
                cv.set(x, y, 'U5')
    for (fx, fy) in ((100, 28), (104, 30), (98, 31), (107, 27), (102, 33), (110, 31)):
        cv.set(fx, fy, 'U1'); cv.set(fx + 1, fy, 'U1'); cv.set(fx + 2, fy, 'U0'); cv.set(fx - 1, fy - 1, 'U1')
        cv.set(fx - 1, fy + 1, 'U1')
    return cv
