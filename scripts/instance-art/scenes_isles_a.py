"""Room scenes of the Gloaming Isles, first half (200 x 125, drawn by the game at 400 x 250).

Same layout as the Old Road scenes in scenes_road.py: a back wall band across the top carries the
instance's identity, the floor below stays calm and mid-dark so characters and speech bubbles read
anywhere on it, and props stand only along the back wall and tight to the far left and right edges.
Deterministic: every random source is seeded."""
import random, math
from engine import *
from scenes_road import flags, vignette, cracks, flame, W, H, WALL


# ================================================================ shared helpers

def masked(cv, m, k):
    for (x, y) in m:
        cv.set(x, y, k)


def shade(cv, m, keys, cuts=(0.18, 0.42, 0.72, 0.9), top=True):
    """cyl() without the ink pass, kept local so masks off-canvas are harmless."""
    cyl(cv, {(x, y) for (x, y) in m if 0 <= x < cv.W and 0 <= y < cv.H}, keys, cuts=cuts, top=top)


def darken(cv, x0, y0, x1, y1, remap, t=0.75):
    """A dithered contact shadow over a rectangle."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            k = cv.get(x, y)
            if k in remap and bay(x, y) < t:
                cv.set(x, y, remap[k])


def contact(cv, y0, rows, remap, ybase=None):
    """Shadow under the back wall: strongest at the wall foot, fading over rows."""
    for x in range(cv.W):
        b = y0 if ybase is None else int(math.ceil(ybase(x)))
        for i in range(rows):
            y = b + i
            k = cv.get(x, y)
            if k in remap and bay(x, y) < q4(1 - i / float(rows)):
                cv.set(x, y, remap[k])


def firefly(cv, x, y, core, halo):
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        if bay(x + dx, y + dy) < 0.6:
            cv.set(x + dx, y + dy, halo)
    cv.set(x, y, core)


def web(cv, cx, cy, a0, a1, rad, rings, k, hi, seed):
    """A corner web: radial threads from (cx, cy) between angles a0..a1, sagging rings."""
    n = 6
    angs = [math.radians(a0 + (a1 - a0) * i / (n - 1)) for i in range(n)]
    for a in angs:
        cv.line(cx, cy, cx + math.cos(a) * rad, cy + math.sin(a) * rad, k)
    for r in rings:
        pts = [(cx + math.cos(a) * r, cy + math.sin(a) * r) for a in angs]
        for i in range(n - 1):
            (xa, ya), (xb, yb) = pts[i], pts[i + 1]
            mx, my = (xa + xb) / 2.0, (ya + yb) / 2.0
            # sag toward the corner a little
            mx += (cx - mx) * 0.12; my += (cy - my) * 0.12
            cv.line(xa, ya, mx, my, k); cv.line(mx, my, xb, yb, k)
        for (x, y) in pts:
            if hashf(x, y, seed) < 0.5:
                cv.set(x, y, hi)


def barrel(cv, x0, y0, w, h, K):
    """An upright barrel at 3/4: K = (lit, mid, dark, hoop, top, rim)."""
    lit, mid, dark, hoop, top, rim = K
    body = set()
    for y in range(y0 + 2, y0 + h):
        bulge = 1 if (y - y0) > 3 and (y - y0) < h - 2 else 0
        for x in range(x0 - bulge, x0 + w + bulge):
            body.add((x, y))
    shade(cv, body, (lit, mid, mid, dark, dark), top=False)
    for hy in (y0 + 4, y0 + h - 3):
        for x in range(x0 - 1, x0 + w + 1):
            if (x, hy) in body:
                cv.set(x, hy, hoop)
    cv.ellipse(x0 + w / 2.0, y0 + 2, w / 2.0, 2, rim)
    cv.ellipse(x0 + w / 2.0, y0 + 2, w / 2.0 - 1, 1.2, top)


def crate(cv, x0, y0, w, hf, ht, K):
    """A crate at 3/4: top face ht tall, front face hf tall. K = (top, front, edge, dark)."""
    top, front, edge, dark = K
    cv.rect(x0, y0, x0 + w, y0 + ht, top)
    cv.hline(x0, x0 + w - 1, y0, edge)
    cv.rect(x0, y0 + ht, x0 + w, y0 + ht + hf, front)
    cv.hline(x0, x0 + w - 1, y0 + ht, edge)
    for y in range(y0 + ht + 2, y0 + ht + hf, 3):
        cv.hline(x0 + 1, x0 + w - 2, y, dark)
    cv.line(x0 + 1, y0 + ht + 1, x0 + w - 2, y0 + ht + hf - 2, edge)
    cv.vline(x0, y0, y0 + ht + hf - 1, edge)
    cv.vline(x0 + w - 1, y0 + ht, y0 + ht + hf - 1, dark)
    cv.hline(x0, x0 + w - 1, y0 + ht + hf - 1, dark)


def lantern(cv, x, y, K):
    """A hanging storm lantern 3 x 5: K = (frame, glass, core, white)."""
    fr, gl, co, wh = K
    cv.set(x, y - 1, fr)
    cv.hline(x - 1, x + 1, y, fr)
    cv.set(x - 1, y + 1, gl); cv.set(x, y + 1, wh); cv.set(x + 1, y + 1, gl)
    cv.set(x - 1, y + 2, gl); cv.set(x, y + 2, co); cv.set(x + 1, y + 2, gl)
    cv.hline(x - 1, x + 1, y + 3, fr)


def planks(cv, K, y0, tw=14, vx=100, vy=-95, seed=1, seg=4.5):
    """Boards running toward the viewer: each board keeps one tone between staggered butt
    joints, the joints converge on a vanishing point above the room. K: a, b, j, hi."""
    nz = vnoise(seed + 3)

    def col(x, y):
        s = (y + 0.5 - vy) / (cv.H - vy)
        return int(math.floor((x + 0.5 - vx) / s / tw))

    def segi(c, y):
        u = 4000.0 / (y + 0.5 - vy)
        return int(math.floor((u + hashf(c, 0, seed) * seg * 3) / (seg * (1.6 + hashf(c, 1, seed)))))

    for y in range(y0, cv.H):
        for x in range(cv.W):
            c = col(x, y)
            sg = segi(c, y)
            v = hashf(c * 5 + 1, sg * 3 + 2, seed)
            k = K['a'] if v < 0.5 else K['b']
            if nz(x / 1.2, y / 10.0) > 0.74:
                k = K['b'] if k == K['a'] else K['a']
            if c != col(x - 1, y):
                k = K['j']
            elif sg != segi(c, y - 1):
                k = K['j']
            elif sg != segi(c, y - 2) and bay(x, y) < 0.5:
                k = K['hi']
            cv.set(x, y, k)


# ================================================================ 1. Saltreach Lighthouse

LH = {
    'K': '#07080d',
    'S0': '#0e0f18', 'S1': '#1b1b28', 'S2': '#2a2938', 'S3': '#3e3a4c', 'S4': '#5f5668',
    'V1': '#1b3536', 'V2': '#285046',
    'G1': '#1a5448', 'G2': '#38b483', 'G3': '#9cf7c6', 'G4': '#effff3',
    'F0': '#18151c', 'F1': '#2c2428', 'F2': '#362d2e', 'F3': '#45392f',
    'H1': '#2a3533', 'H2': '#33423c', 'H3': '#3f5246',
    'P1': '#172530', 'P2': '#1f3840',
    'W1': '#2b1f1e', 'W2': '#4b3429', 'W3': '#7a573a',
    'N1': '#5e5848', 'N2': '#a39780',
    'D1': '#4a3d68', 'D2': '#c47a5e', 'Y': '#f4c27a',
}


def scene_lighthouse():
    rng = random.Random(201)
    cv = Cv(LH, 'S0', W, H)
    CX = 100

    def yb(x):                                          # the foot of the round wall
        return 22 + 5.0 * ((x + 0.5 - CX) / 100.0) ** 2

    # ------------------------------------------------ floor first: wet planks
    planks(cv, {'a': 'F2', 'b': 'F1', 'j': 'F0', 'hi': 'F3'}, 20, tw=12, seed=21)
    # ------------------------------------------------ the round wall
    def colw(x, r):
        u = max(-0.99, min(0.99, (x + 0.5 - CX) / 106.0))
        return int(math.floor(math.asin(u) * 22 + 0.5 * (r % 2) + hashf(r, 2, 21) * 0.4))

    for y in range(0, 28):
        for x in range(W):
            base = yb(x)
            if y >= base:
                continue
            u = (x + 0.5 - CX) / 106.0
            yy = y - (base - 22) + 1
            r = int(math.floor(yy / 5.0))
            ry = yy - r * 5
            c = colw(x, r)
            v = hashf(c, r, 22)
            k = 'S2' if v < 0.7 else 'S3'
            if ry == 4 or c != colw(x - 1, r):
                k = 'S1'
            elif ry == 0:
                k = 'S3' if k == 'S2' else 'S4'
            elif ry == 3 and c != colw(x + 1, r):
                k = 'S1'
            side = abs(u)
            if side > 0.5 and bay(x, y) < q4((side - 0.5) * 2.0):
                k = {'S4': 'S3', 'S3': 'S2', 'S2': 'S1', 'S1': 'S0'}[k]
            cv.set(x, y, k)
    for x in range(W):                                  # tide line along the foot
        b = int(math.ceil(yb(x)))
        cv.set(x, b - 1, 'S0')
        cv.set(x, b - 2, 'S1')
        if hashf(x // 2, 4, 3) < 0.45:
            cv.set(x, b - 2, 'P2')
        if hashf(x // 3, 5, 3) < 0.25:
            cv.set(x, b - 3, 'P1')
    for y in range(0, 4):                               # vault shadow
        for x in range(W):
            if bay(x, y) < q4(1 - y / 4.0):
                cv.set(x, y, 'S0' if y > 1 else 'K')
    # arrow slits with the dusk outside
    for (sx, sy, sh) in ((146, 5, 10), (176, 6, 9)):
        cv.rect(sx - 2, sy - 1, sx + 3, sy + sh + 1, 'S0')
        for i in range(sh):
            t = i / float(sh - 1)
            k = 'D1' if t < 0.4 else ('D2' if t < 0.7 else ('Y' if t < 0.85 else 'P2'))
            for x in range(sx - 1, sx + 2):
                cv.set(x, sy + i, k)
        cv.vline(sx - 2, sy, sy + sh - 1, 'S1'); cv.vline(sx + 2, sy, sy + sh - 1, 'S3')
        cv.hline(sx - 2, sx + 2, sy + sh, 'S4'); cv.hline(sx - 2, sx + 2, sy + sh + 1, 'S1')
        light(cv, sx + 0.5, sy + sh + 2, 7, 4, {'S1': 'S2', 'S2': 'S3'}, steps=2)
    # the sea door, iron-banded, under the stairwell
    DX0, DX1, DT, DR = CX - 7, CX + 8, 14, 7.5
    for y in range(2, 24):
        for x in range(DX0 - 3, DX1 + 3):
            if y >= yb(x) - 1:
                continue
            dx = x + 0.5 - (CX + 0.5)
            inside = (y >= DT and DX0 <= x < DX1) or (dx * dx + (y + 0.5 - DT) ** 2 <= DR ** 2)
            ring = (y >= DT and DX0 - 2 <= x < DX1 + 2) or (dx * dx + (y + 0.5 - DT) ** 2 <= (DR + 2) ** 2)
            if inside:
                k = 'W2'
                if (x - DX0) % 4 == 0:
                    k = 'W1'
                elif (x - DX0) % 4 == 1:
                    k = 'W3' if (y * 3 + x) % 7 else 'W2'
                if y in (DT - 3, DT + 5):
                    k = 'K'
                cv.set(x, y, k)
            elif ring:
                ang = math.atan2(y + 0.5 - DT, dx)
                k = 'S4' if dx < 0 else 'S2'
                if y < DT and int((ang + 3.2) * 3.4) % 2 == 0:
                    k = 'S3' if dx < 0 else 'S1'
                if y >= DT and (y - DT) % 4 == 3:
                    k = 'S1'
                cv.set(x, y, k)
    cv.set(CX + 5, DT + 2, 'N2'); cv.set(CX + 5, DT + 3, 'K'); cv.set(CX + 6, DT + 2, 'K')
    cv.set(CX + 4, DT + 2, 'K')
    # the spiral stair climbing the wall from the left up into the lamp room
    steps = []
    i = 0
    while True:
        x0 = 6 + i * 9
        t = int(round(yb(x0 + 4) - 6 - i * 2.0))
        if t < -5:
            break
        steps.append((x0, t))
        i += 1
    for i, (x0, t) in enumerate(steps):                 # shadow under the flight
        for x in range(x0, x0 + 9):
            for j, k in ((5, 'S0'), (6, 'S0'), (7, 'S1')):
                yy = t + j - int((x - x0) * 2 / 9.0)
                if k == 'S1' and bay(x, yy) >= 0.5:
                    continue
                if cv.get(x, yy) in ('S1', 'S2', 'S3', 'S4', 'P1', 'P2'):
                    cv.set(x, yy, k)
    for i, (x0, t) in enumerate(steps):
        cv.hline(x0, x0 + 9, t, 'S4')
        cv.hline(x0, x0 + 9, t + 1, 'S3')
        cv.hline(x0, x0 + 9, t + 2, 'S2'); cv.hline(x0, x0 + 9, t + 3, 'S2')
        cv.hline(x0, x0 + 9, t + 4, 'S1')
        cv.vline(x0, t, t + 4, 'S3')
        if i % 3 == 1:
            cv.set(x0 + 6, t + 2, 'P1'); cv.set(x0 + 6, t + 3, 'P2')
    for i, (x0, t) in enumerate(steps):                 # iron rail
        cv.vline(x0 + 3, t - 6, t - 1, 'K')
        if i + 1 < len(steps):
            nx, nt = steps[i + 1]
            cv.line(x0 + 3, t - 6, nx + 3, nt - 6, 'K')
    # the lamp room opening in the vault: ghost-light pouring down
    HX = CX + 4
    hole = m_ell(HX + 0.5, -2, 18, 6)
    for (x, y) in hole:
        dx = abs(x + 0.5 - HX - 0.5) / 18.0
        k = 'G4' if dx < 0.25 else ('G3' if dx < 0.55 else 'G2')
        if y >= 2:
            k = 'G3' if k == 'G4' else 'G2'
        cv.set(x, y, k)
    for x in range(HX - 20, HX + 21):
        for y in range(0, 6):
            if (x, y) not in hole and ((x, y - 1) in hole or (x - 1, y) in hole or (x + 1, y) in hole):
                cv.set(x, y, 'S4' if x < HX else 'S3')
                cv.set(x, y + 1, 'S1')
    wallkeys = {'S0': 'V1', 'S1': 'V1', 'S2': 'V2', 'S3': 'V2', 'S4': 'G1', 'W1': 'W2',
                'W2': 'W3', 'P1': 'V1', 'P2': 'V2', 'K': 'S0'}
    light(cv, HX + 0.5, 2, 56, 26, wallkeys, power=1.2, steps=4,
          pred=lambda x, y: (x, y) not in hole)
    for (x, y) in ((96, 9), (117, 12), (109, 6), (124, 8), (88, 13)):
        cv.set(x, y, 'G3' if hashf(x, y, 5) < 0.5 else 'G2')
    # an amber storm lantern on a hook beside the stair foot
    cv.hline(8, 11, 4, 'K'); cv.vline(11, 4, 6, 'K')
    light(cv, 11.5, 10, 12, 8, {'S2': 'S3', 'S1': 'S2', 'S3': 'S4'}, power=1.2, steps=3)
    lantern(cv, 11, 7, ('K', 'D2', 'Y', 'Y'))
    cv.hline(160, 163, 6, 'K'); cv.vline(160, 6, 8, 'K')
    light(cv, 160.5, 12, 12, 8, {'S2': 'S3', 'S1': 'S2', 'S3': 'S4'}, power=1.2, steps=3)
    lantern(cv, 160, 9, ('K', 'D2', 'Y', 'Y'))
    for (x, ln) in ((140, 12), (62, 7)):                # hanging chains with hooks
        for y in range(0, ln):
            cv.set(x, y, 'S4' if y % 2 else 'K')
        cv.set(x + 1, ln, 'S4'); cv.set(x + 1, ln - 1, 'K')
    # ------------------------------------------------ floor details
    contact(cv, 0, 4, {'F1': 'F0', 'F2': 'F1', 'F3': 'F2', 'P1': 'F0', 'P2': 'P1'}, ybase=yb)
    for (px_, py_, rx, ry) in ((50, 70, 10, 2.6), (140, 62, 12, 3.0), (96, 100, 11, 2.6),
                               (162, 104, 7, 2.0), (32, 100, 6, 1.8), (118, 42, 7, 1.8),
                               (70, 50, 5, 1.4)):
        m = set()
        for (x, y) in m_ell(px_, py_, rx, ry):
            if hashf(x // 2, y, 31) < 0.88 or abs(x - px_) < rx * 0.7:
                m.add((x, y))
        for (x, y) in m:
            cv.set(x, y, 'P1' if (x, y - 1) not in m else 'P2')
        for (x, y) in m:
            if (x, y + 1) not in m and cv.get(x, y + 1) in ('F1', 'F2') and bay(x, y + 1) < 0.5:
                cv.set(x, y + 1, 'F3')
        gy = int(py_)
        for x in range(int(px_ - rx * 0.5), int(px_ + rx * 0.3)):
            if (x, gy) in m and hashf(x, gy, 4) < 0.6:
                cv.set(x, gy, 'V2')
        if rx > 9:
            cv.set(int(px_ - 1), gy, 'G1'); cv.set(int(px_), gy, 'G2')
    pool = {'F1': 'H1', 'F2': 'H2', 'F3': 'H3', 'F0': 'F1', 'P1': 'P2', 'P2': 'V2'}
    light(cv, HX + 0.5, 20, 64, 54, pool, power=1.25, steps=4)
    # a gull feather, a fish's bones, a few spilled nails
    stamp(cv, 74, 112, ["2.2.2.2.", "22222222", "2.2.2.2."], {'2': 'N1'})
    cv.set(73, 113, 'N2'); cv.set(82, 113, 'N1'); cv.set(83, 112, 'N1'); cv.set(83, 114, 'N1')
    for (x, y) in ((128, 88), (131, 90), (60, 35), (150, 34)):
        cv.set(x, y, 'N1'); cv.set(x + 1, y, 'F0')
    # ------------------------------------------------ vignette, then the edge props
    vignette(cv, {'F1': 'F0', 'F2': 'F1', 'F3': 'F2', 'H1': 'F1', 'H2': 'H1', 'H3': 'H2',
                  'V2': 'V1', 'V1': 'S1', 'P2': 'P1', 'P1': 'F0', 'S1': 'S0', 'S2': 'S1',
                  'S3': 'S2', 'S4': 'S3', 'F0': 'K', 'N1': 'F2', 'G1': 'V2'},
             cy=64, rx=124, ry=80, inner=0.62, levels=2.0, pred=lambda x, y: y >= yb(x) - 2)
    # wreckage leaning on the left wall: a stove-in hull section, ribs and a broken spar
    hull = m_poly([(0, 30), (4, 27), (8, 31), (11, 36), (11, 60), (6, 63), (0, 65)])
    for (x, y) in hull:
        k = 'W2' if (y // 3 + x // 6) % 2 == 0 else 'W1'
        if y % 3 == 0:
            k = 'K' if x > 8 else 'W1'
        if (x + 1, y) not in hull:
            k = 'K'
        cv.set(x, y, k)
    for y in range(30, 64):                             # ribs
        for rx_ in (2, 7):
            xx = rx_ + int(round(math.sin((y - 30) / 12.0) * 1.5))
            if (xx, y) in hull:
                cv.set(xx, y, 'W3' if y % 5 else 'W2')
    for (x, y) in ((4, 26), (8, 30), (1, 29)):           # splinters
        cv.set(x, y - 1, 'W3'); cv.set(x, y - 2, 'W2')
    for (x, y) in ((1, 42), (5, 49), (9, 53), (3, 58), (9, 44)):
        cv.set(x, y, 'N1'); cv.set(x + 1, y, 'N2')
    darken(cv, 12, 40, 18, 66, {'F1': 'F0', 'F2': 'F1', 'F3': 'F2', 'H1': 'F1', 'H2': 'H1',
                                 'P1': 'F0', 'P2': 'P1'}, t=0.5)
    shade(cv, m_seg(0, 96, 11, 108, 1.3), ('W3', 'W2', 'W2', 'W1', 'W1'))
    cv.set(11, 109, 'W3'); cv.set(12, 108, 'W2'); cv.set(12, 107, 'W3')
    crate(cv, 0, 111, 9, 7, 3, ('W2', 'W1', 'W3', 'K'))
    # nets hung on the right wall with glass floats, spilling into a heap
    net = set()
    for y in range(6, 58):
        for x in range(188, W):
            if y > 30 + (W - x) * 2.2 and y > 30:
                continue
            net.add((x, y))
    for (x, y) in net:
        if (x + y) % 4 == 0 or (x - y) % 4 == 0:
            cv.set(x, y, 'N2' if (x + y) % 8 == 0 and (x - y) % 8 == 0 else 'N1')
    cv.hline(186, 199, 5, 'W2'); cv.hline(186, 199, 6, 'W1')
    for (x, y, k) in ((192, 15, 'G2'), (196, 25, 'D2'), (191, 30, 'G2'), (196, 39, 'G2')):
        cv.disc(x, y, 1.6, k); cv.set(x - 1, y - 1, 'G3' if k == 'G2' else 'Y')
    heap = m_ell(194, 58, 7, 3.5)
    for (x, y) in heap:
        k = 'N1' if (x * 3 + y * 5) % 7 < 3 else 'F0'
        if (x, y - 1) not in heap:
            k = 'N1'
        cv.set(x, y, k)
    cv.disc(191, 57, 1.5, 'G2'); cv.set(190, 56, 'G3')
    # an anchor against the right wall, low down
    cv.vline(194, 84, 102, 'S3'); cv.vline(195, 84, 102, 'S1')
    cv.ellipse(194.5, 82, 2, 2, 'S3'); cv.set(194, 82, 'F0'); cv.set(195, 82, 'F0')
    cv.hline(191, 198, 87, 'S3'); cv.hline(191, 198, 88, 'S1')
    for (x, y) in ((189, 98), (190, 100), (191, 101), (192, 102), (193, 103), (196, 103),
                   (197, 102), (198, 101), (199, 100)):
        cv.set(x, y, 'S3'); cv.set(x, y + 1, 'S1')
    cv.set(188, 97, 'S4')
    # a coil of rope in the bottom-right corner
    for r in (6.5, 5, 3.5, 2):
        for a in range(0, 360, 6):
            x = 191 + math.cos(math.radians(a)) * r
            y = 117 + math.sin(math.radians(a)) * r * 0.5
            cv.set(x, y, 'N1' if math.sin(math.radians(a)) < 0 else 'F0')
    return cv


# ================================================================ 2. The Coral Labyrinth

CO = {
    'K': '#050a18',
    'U0': '#08122a', 'U1': '#0d2446', 'U2': '#12405e', 'U3': '#1a6a7c', 'U4': '#2fa0a0',
    'U5': '#9ae8d8',
    'C0': '#3c1636', 'C1': '#6e2448', 'C2': '#b03c5c', 'C3': '#ea6a62', 'C4': '#ffaa7a',
    'B1': '#4a5068', 'B2': '#8a90a0', 'B3': '#d6d8c4',
    'N0': '#132638', 'N1': '#1a3244', 'N2': '#223c4e', 'N3': '#2d4c5a',
    'E1': '#1d4438', 'E2': '#2e6a4c',
}


def branch(cv, rng, x, y, ang, ln, depth, K):
    """A branching coral grown upward: K = (stem, tip, hi)."""
    stem, tip, hi = K
    x1 = x + math.cos(ang) * ln; y1 = y - math.sin(ang) * ln
    cv.line(x, y, x1, y1, stem)
    if depth == 0 or ln < 2:
        cv.set(x1, y1, tip)
        if hashf(x1, y1, 3) < 0.5:
            cv.set(x1, y1 - 1, hi)
        return
    for d in (-0.45, 0.45):
        branch(cv, rng, x1, y1, ang + d + rng.uniform(-0.15, 0.15), ln * rng.uniform(0.6, 0.8),
               depth - 1, K)


def brain(cv, cx, cy, rx, ry, seed):
    m = m_ell(cx, cy, rx, ry)
    for (x, y) in m:
        g = math.sin((x - cx) * 1.3 + math.sin((y - cy) * 1.1 + seed) * 2.2)
        k = 'C2' if g > -0.2 else 'C1'
        if (x - 1, y - 1) not in m or (x, y - 1) not in m:
            k = 'C3' if g > -0.2 else 'C2'
        if (x + 1, y) not in m or (x, y + 1) not in m:
            k = 'C0' if k == 'C1' else 'C1'
        cv.set(x, y, k)
    if rx > 3:
        cv.set(cx - rx * 0.4, cy - ry * 0.6, 'C4')


def scene_coral():
    rng = random.Random(301)
    cv = Cv(CO, 'U1', W, H)
    CX = 100
    # ------------------------------------------------ open water above the reef wall
    bands(cv, [(0, 'U2'), (9, 'U1'), (18, 'U0')], y0=0, y1=WALL, tw=5)
    # far coral heads, blue with depth
    far = mpd(random.Random(7), 256, 3.0, 0.6)
    for x in range(W):
        top = int(7 + far[x] + 2 * math.sin(x * 0.11))
        for y in range(top, WALL):
            cv.set(x, y, 'U1' if y > top else 'U2')
    for _ in range(14):
        bx = rng.uniform(4, 196)
        branch(cv, rng, bx, 9, math.pi / 2 + rng.uniform(-0.3, 0.3), rng.uniform(3, 5), 2,
               ('U1', 'U2', 'U2'))
    # the reef wall itself
    edge = smooth(mpd(random.Random(9), 256, 3.5, 0.62), 1)
    nz = vnoise(31)
    tops = []
    for x in range(W):
        top = int(13 + edge[x])
        tops.append(top)
        for y in range(top, WALL - 1):
            n = nz(x / 4.0, y / 3.0)
            k = 'C1' if n > 0.45 else 'C0'
            if y == top:
                k = 'C2'
            elif y == top + 1 and n > 0.3:
                k = 'C1'
            cv.set(x, y, k)
    for _ in range(46):                                  # brain corals and tube clusters
        x = rng.uniform(4, 196); y = rng.uniform(14, 21)
        if 66 < x < 134:
            continue
        brain(cv, x, y, rng.uniform(2.5, 4.5), rng.uniform(2.0, 3.0), rng.random() * 6)
    for _ in range(10):
        x = rng.randint(6, 194)
        if 62 < x < 138:
            continue
        y = tops[x]
        for j in range(3):
            tx = x + j * 2
            h = 3 + (j * 7 + x) % 3
            cv.vline(tx, y - h, y, 'C3'); cv.set(tx, y - h, 'C4'); cv.set(tx + 1, y - h + 1, 'C1')
    for _ in range(26):                                  # branching coral over the top edge
        x = rng.uniform(3, 197)
        if 62 < x < 138:
            continue
        branch(cv, rng, x, tops[int(x)] + 1, math.pi / 2 + rng.uniform(-0.25, 0.25),
               rng.uniform(4, 7), 2, ('C2', 'C4', 'C3'))
    for x in range(W):                                  # foot of the wall
        cv.set(x, WALL - 1, 'C0')
        cv.set(x, WALL - 2, 'C0' if hashf(x, 2, 7) < 0.5 else cv.get(x, WALL - 2))
    # ------------------------------------------------ the horned skull arch
    DX0, DX1 = CX - 13, CX + 14
    # the passage under the jaw
    for y in range(13, WALL):
        for x in range(DX0, DX1):
            dx = abs(x + 0.5 - CX - 0.5) / 13.0
            v = (y - 13) / 12.0
            g = (1 - dx) * 0.9 - abs(v - 0.55) * 0.6
            if g > 0.55:
                k = 'U4' if bay(x, y) < q4((g - 0.55) * 4) else 'U3'
            elif g > 0.3:
                k = 'U3' if bay(x, y) < q4((g - 0.3) * 4) else 'U2'
            elif g > 0.05:
                k = 'U2' if bay(x, y) < q4((g - 0.05) * 4) else 'U0'
            else:
                k = 'U0' if bay(x, y) < 0.5 else 'K'
            cv.set(x, y, k)
    # an eel's silhouette drifting in the passage
    for i in range(14):
        x = CX - 6 + i
        y = 20 + math.sin(i * 0.6) * 1.2
        cv.set(x, y, 'U0'); cv.set(x, y + 1, 'U0' if i < 11 else 'U1')
    cv.set(CX - 6, 19, 'U5')
    # horns sweeping out and down to the floor like the arch's jambs
    for s in (-1, 1):
        hm = m_bez((CX + 0.5 + s * 13, 6), (CX + 0.5 + s * 38, -6), (CX + 0.5 + s * 31, WALL),
                   4.4, 2.0, steps=70)
        shade(cv, hm, ('B3', 'B2', 'B2', 'B1', 'C0') if s < 0 else ('B2', 'B2', 'B1', 'B1', 'C0'))
        for (x, y) in hm:
            if (y * 2 + int(abs(x - CX) * 0.4)) % 5 == 0 and cv.get(x, y) in ('B2', 'B3'):
                cv.set(x, y, 'B1')
        # crust of coral at the horn feet
        brain(cv, CX + 0.5 + s * 30, WALL - 3, 4, 2.5, 2 + s)
    # the cranium
    cr = m_ell(CX + 0.5, 7, 15, 9)
    shade(cv, cr, ('B3', 'B3', 'B2', 'B2', 'B1'), cuts=(0.15, 0.4, 0.7, 0.88))
    for (x, y) in cr:                                    # crack and growth
        if y < 0:
            continue
    cv.line(CX + 4, 0, CX + 7, 4, 'B1'); cv.line(CX + 7, 4, CX + 6, 6, 'B1')
    for (ex, s) in ((CX - 5, -1), (CX + 6, 1)):          # eye sockets
        sock = m_ell(ex + 0.5, 8.5, 3.8, 2.8)
        for (x, y) in sock:
            cv.set(x, y, 'K' if (x, y - 1) in sock else 'U0')
        cv.set(ex + (0 if s < 0 else 1), 9, 'U5'); cv.set(ex + (1 if s < 0 else 0), 9, 'U4')
        cv.set(ex - 3 * s, 6, 'B1')
    stamp(cv, CX - 1, 11, [".00.", "0000"], {'0': 'K'})
    cv.hline(CX - 11, CX + 12, 13, 'B1')               # upper jaw and fangs
    cv.hline(CX - 11, CX + 12, 14, 'B2')
    for x in range(CX - 11, CX + 13, 2):
        cv.set(x, 15, 'B3'); cv.set(x, 16, 'B2' if (x // 2) % 3 else 'B3')
        if (x // 2) % 3 == 0:
            cv.set(x, 17, 'B2')
    for x in (CX - 10, CX + 11):
        cv.vline(x, 15, 20, 'B3'); cv.set(x, 21, 'B2')
    # anemone on the brow
    for i in range(-2, 3):
        cv.vline(CX + 9 + i, 0 + abs(i), 2 + abs(i), 'C3')
        cv.set(CX + 9 + i, 0 + abs(i), 'C4')
    # ------------------------------------------------ light shafts from the surface
    shafts = [(16, 12), (58, 8), (122, 14), (170, 10), (204, 8)]

    def shaft_t(x, y):
        s = x + y * 0.42
        best = 0.0
        for (c, w) in shafts:
            d = abs(s - c - 0.42 * 0) / (w / 2.0)
            if d < 1:
                best = max(best, 1 - d)
        return best

    for y in range(0, WALL):
        for x in range(W):
            t = shaft_t(x, y) * (0.95 - y / 40.0)
            k = cv.get(x, y)
            rm = {'U0': 'U1', 'U1': 'U2', 'U2': 'U3', 'C0': 'C1', 'C1': 'C2'}
            if k in rm and t > 0 and bay(x, y) < q4(t):
                cv.set(x, y, rm[k])
    # ------------------------------------------------ the sand floor with ripples
    fz = vnoise(37)
    for y in range(WALL, H):
        ph0 = 80 * math.log(y + 60)
        for x in range(W):
            n = fz(x / 14.0, y / 6.0)
            k = 'N2' if n > 0.5 else 'N1'
            ph = ph0 + fz(x / 9.0, y / 9.0) * 6 + math.sin(x * 0.06) * 1.6
            s = math.sin(ph)
            if s > 0.9:
                k = 'N3' if k == 'N2' and bay(x, y) < 0.75 else 'N2'
            elif s < -0.9 and k == 'N2' and bay(x, y) < 0.75:
                k = 'N1'
            cv.set(x, y, k)
    contact(cv, WALL, 4, {'N1': 'N0', 'N2': 'N1', 'N3': 'N2'})
    # the shafts land on the sand as soft dappled bands
    for y in range(WALL, H):
        for x in range(W):
            t = shaft_t(x, y) * (0.45 - (y - WALL) / 330.0)
            k = cv.get(x, y)
            rm = {'N0': 'N1', 'N1': 'N2', 'N2': 'N3'}
            if k in rm and t > 0 and bay(x, y) < q4(t):
                cv.set(x, y, rm[k])
    # a glow spilling out of the passage onto the sand
    light(cv, CX + 0.5, WALL, 30, 16, {'N0': 'N1', 'N1': 'N2', 'N2': 'N3', 'N3': 'U3'},
          power=1.4, steps=3)
    # small things on the sand: shells, a starfish, pebbles, a fish bone
    for (x, y) in ((48, 48), (152, 56), (84, 92), (126, 110), (38, 82), (170, 88), (110, 66)):
        k = 'B2' if hashf(x, y, 1) < 0.5 else 'B1'
        cv.set(x, y, k); cv.set(x + 1, y, 'B3' if k == 'B2' else 'B2'); cv.set(x, y + 1, 'N0')
    stamp(cv, 140, 92, ["..3..", "33433", ".3.3."], {'3': 'C2', '4': 'C3'})
    stamp(cv, 58, 112, ["2.2.2.", "222222", "2.2.2."], {'2': 'B1'})
    cv.set(64, 113, 'B2')
    # ------------------------------------------------ vignette, then the edge props
    vignette(cv, {'N3': 'N2', 'N2': 'N1', 'N1': 'N0', 'N0': 'K', 'U3': 'U2', 'U2': 'U1',
                  'U1': 'U0', 'C1': 'C0', 'C2': 'C1', 'C3': 'C2', 'B1': 'N0', 'U4': 'U3'},
             cy=64, rx=124, ry=80, inner=0.62, levels=2.0)
    # coral banks along both edges
    for (x0, s) in ((0, 1), (199, -1)):
        for y in range(24, 64, 1):
            w = int(6 + 3 * math.sin(y * 0.19 + x0) + hashf(y, x0, 3) * 2)
            for i in range(w):
                x = x0 + s * i
                k = 'C1' if nz(x / 3.0, y / 3.0) > 0.45 else 'C0'
                if i == w - 1:
                    k = 'C2'
                cv.set(x, y, k)
        for (yy, r) in ((30, 3.5), (44, 4), (56, 3)):
            brain(cv, x0 + s * 4, yy, r + 1, r * 0.7, yy)
        for yy in (28, 38, 50, 62):
            branch(cv, rng, x0 + s * 7, yy, math.pi / 2 - s * 0.35, rng.uniform(4, 6), 2,
                   ('C2', 'C4', 'C3'))
        # a sea fan
        fx = x0 + s * 4
        fan = set()
        for (x, y) in m_ell(fx, 78, 8, 9):
            if y <= 78 and 0 <= x < W:
                fan.add((x, y))
        for (x, y) in fan:
            if (x + y) % 2 == 0 or (x, y - 1) not in fan:
                cv.set(x, y, 'C2' if (x, y - 1) not in fan or (x + y) % 6 == 0 else 'C1')
        for a in range(20, 161, 28):
            ang = math.radians(a)
            cv.line(fx, 78, fx + math.cos(ang) * 7, 78 - math.sin(ang) * 8, 'C1')
        cv.vline(fx, 78, 82, 'C0')
        # kelp low in the corners
        for kx in (x0 + s * 2, x0 + s * 6):
            for y in range(H - 1, 88, -1):
                xx = kx + math.sin(y * 0.25 + kx) * 1.5
                cv.set(xx, y, 'E2' if y % 4 else 'E1')
                if y % 5 == 0:
                    cv.set(xx + s, y - 1, 'E1')
        brain(cv, x0 + s * 6, 116, 6, 4, 4 + s)
    # bubbles rising along the edges
    for (x, y) in ((14, 40), (16, 33), (15, 26), (185, 52), (184, 44), (186, 36), (13, 96),
                   (186, 104), (187, 96)):
        cv.set(x, y, 'U4'); cv.set(x, y - 1, 'U5')
    return cv


# ================================================================ 3. The Smugglers' Warren

SM = {
    'R0': '#07060a', 'R1': '#151117', 'R2': '#241d23', 'R3': '#372d31', 'R4': '#574749',
    'A0': '#040811', 'A1': '#091222', 'A2': '#111d36', 'A3': '#253859',
    'L0': '#2a140e', 'L1': '#5a2a14', 'L2': '#a8501c', 'L3': '#ec9a3c', 'L4': '#ffe09a',
    'W1': '#21150e', 'W2': '#3d2818', 'W3': '#6b4a2b', 'P1': '#33221a', 'P2': '#4a3222',
    'CL': '#a89c84', 'GH': '#6fe0b0', 'M1': '#e4ecff',
}


def scene_warren():
    rng = random.Random(401)
    cv = Cv(SM, 'R1', W, H)
    CX = 100
    WL = 15          # waterline of the back channel
    # ------------------------------------------------ rough rock wall: faceted cells
    pts = []
    for gy in range(-1, 4):
        for gx in range(-1, 27):
            pts.append((gx * 8 + rng.uniform(0, 7), gy * 6 + rng.uniform(0, 5)))

    def cell(x, y):
        best, bi, second = 1e9, 0, 1e9
        for i, (px_, py_) in enumerate(pts):
            if abs(px_ - x) > 14:
                continue
            d = (px_ - x) ** 2 + ((py_ - y) * 1.3) ** 2
            if d < best:
                second, best, bi = best, d, i
            elif d < second:
                second = d
        return bi, math.sqrt(second) - math.sqrt(best)

    cells = {}
    for y in range(0, WL):
        for x in range(W):
            cells[(x, y)] = cell(x + 0.5, y + 0.5)
    for y in range(0, WL):
        for x in range(W):
            ci, gap = cells[(x, y)]
            v = hashf(ci, 3, 41)
            k = 'R2' if v < 0.6 else 'R3'
            up = cells.get((x, y - 1), (ci, 9))[0]
            lf = cells.get((x - 1, y), (ci, 9))[0]
            if gap < 0.9:
                k = 'R1'
            elif up != ci or lf != ci:
                k = 'R4' if k == 'R3' else 'R3'
            cv.set(x, y, k)
    # stalactites
    for x0 in range(2, W, 7):
        if 74 < x0 < 126:
            continue
        ln = 2 + int(hashf(x0, 1, 41) * 6)
        for i in range(ln):
            w = max(0, 2 - i * 2 // ln)
            for dx in range(-w, w + 1):
                cv.set(x0 + dx, i, 'R3' if dx < 0 else 'R1')
    for y in range(0, 3):
        for x in range(W):
            if bay(x, y) < q4(1 - y / 3.0):
                cv.set(x, y, 'R0')
    # the cave mouth opening on the night sea
    MX0, MX1, MT = CX - 24, CX + 25, 2
    mouth = set()
    for y in range(0, WL + 1):
        for x in range(MX0 - 6, MX1 + 6):
            dx = (x + 0.5 - CX - 0.5) / 24.5
            top = MT + 10 * (1 - math.sqrt(max(0.0, 1 - dx * dx))) + hashf(x // 2, 3, 4) * 1.6
            if abs(dx) < 1 and y >= top:
                mouth.add((x, y))
    for (x, y) in mouth:
        k = 'A1' if y < 5 else ('A2' if y < 9 else 'A3')
        if y in (4, 8) and bay(x, y) < 0.5:
            k = 'A2' if y == 4 else 'A3'
        if y >= 11:
            k = 'A1' if y > 12 else 'A2'
        cv.set(x, y, k)
    for y in range(11, WL + 1):                          # the moon's path on the far sea
        for x in range(108, 120):
            if (x, y) in mouth and hashf(x, y, 6) < 0.45:
                cv.set(x, y, 'M1' if abs(x - 114) < 2 else 'A3')
    for (x, y) in ((84, 7), (91, 5), (107, 6), (116, 8), (97, 9), (88, 10)):
        if (x, y) in mouth:
            cv.set(x, y, 'M1' if hashf(x, y, 1) < 0.5 else 'A3')
    stamp(cv, 111, 3, [".11", "1..", "1..", ".11"], {'1': 'M1'})
    for (x, y) in ((84, 9), (122, 9), (79, 11)):        # far skerries on the horizon
        cv.set(x, y, 'R1'); cv.set(x + 1, y, 'R1'); cv.set(x, y + 1, 'R1')
    rim = set()
    for (x, y) in mouth:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (-2, 0), (2, 0), (0, -2)):
            if (x + dx, y + dy) not in mouth:
                rim.add((x + dx, y + dy))
    for (x, y) in rim:                                   # a dark lip, lit on its inner edge
        inner = any((x + dx, y + dy) in mouth for dx, dy in ((-1, 0), (1, 0), (0, 1)))
        cv.set(x, y, ('R4' if x > CX else 'R3') if inner and y > 3 else 'R0')
    cv.set(150, 7, 'GH')                                 # a ghost-light far out, through a crack
    # ------------------------------------------------ the water channel along the back
    for y in range(WL, WALL - 2):
        for x in range(W):
            k = 'A1' if y < WL + 3 else 'A0'
            if (x * 3 + y * 7) % 11 == 0 and hashf(x // 3, y, 2) < 0.5:
                k = 'A2'
            if y == WL:
                k = 'A2'
            cv.set(x, y, k)
    # the jetty running out through the mouth
    for y in range(WL - 1, WALL):
        t = (y - (WL - 1)) / float(WALL - (WL - 1))
        hw = 5 + t * 5
        for x in range(int(CX - hw), int(CX + hw) + 1):
            k = 'W2' if (y % 3) else 'W1'
            if (y % 3) == 1:
                k = 'P2'
            cv.set(x, y, k)
        cv.set(int(CX - hw) - 1, y, 'W1'); cv.set(int(CX + hw) + 1, y, 'W1')
    for (x, y, h) in ((CX - 6, WL, 4), (CX + 6, WL, 4), (CX - 9, WL + 5, 5),
                      (CX + 9, WL + 5, 5)):
        cv.vline(x, y - h, y, 'W2'); cv.set(x, y - h, 'W3')
    # a moored sloop to the right of the jetty
    hull = m_poly([(114, WL - 1), (154, WL - 2), (151, WL + 4), (146, WL + 6), (120, WL + 6),
                   (116, WL + 3)])
    for (x, y) in hull:
        k = 'W2'
        if (x, y - 1) not in hull:
            k = 'W3'
        elif y == WL + 1:
            k = 'W1'
        elif (x, y + 1) not in hull:
            k = 'W1'
        cv.set(x, y, k)
    for x in range(118, 150, 6):
        cv.set(x, WL + 2, 'W3')
    cv.hline(117, 151, WL + 7, 'A0')                    # shadow in the water
    cv.vline(134, 0, WL - 2, 'W2'); cv.vline(135, 2, WL - 2, 'W1')
    cv.line(125, WL - 4, 150, 3, 'W1')
    for i in range(18):                                  # furled sail along the boom
        x = 128 + i
        y = WL - 5 - i * 0.4
        cv.set(x, y, 'CL'); cv.set(x, y + 1, 'P2' if i % 3 else 'CL')
    cv.line(134, 2, 154, WL - 2, 'W1'); cv.line(134, 2, 115, WL - 2, 'W1')
    cv.line(105, WL + 1, 116, WL + 1, 'CL')             # mooring line
    # a rowboat to the left, half in the dark
    boat = m_poly([(52, WL + 1), (76, WL), (74, WL + 4), (56, WL + 5)])
    for (x, y) in boat:
        cv.set(x, y, 'W3' if (x, y - 1) not in boat else ('W1' if (x, y + 1) not in boat else 'W2'))
    cv.line(60, WL - 1, 70, WL + 1, 'W3')
    # lanterns: one on the jetty post, one on the mast, two on wall brackets
    lamps = [(CX + 6, WL - 4), (134, 6), (22, 6), (180, 7)]
    warm = {'R1': 'L0', 'R2': 'L0', 'R3': 'L1', 'R4': 'L1', 'A1': 'A2', 'A0': 'A1', 'A2': 'A3',
            'W1': 'W2', 'W2': 'W3', 'P2': 'W3'}
    for (lx, ly) in lamps:
        light(cv, lx + 0.5, ly + 2, 20, 12, warm, power=1.1, steps=3,
              pred=lambda x, y: (x, y) not in mouth)
    for (lx, ly) in lamps[2:]:
        cv.hline(lx - 3, lx, ly - 1, 'R0'); cv.vline(lx - 3, ly - 1, ly + 2, 'R0')
    for (lx, ly) in lamps:
        lantern(cv, lx, ly, ('R0', 'L2', 'L3', 'L4'))
    # reflections in the channel
    for (lx, _) in lamps:
        for y in range(WL + 1, WALL - 2):
            for dx in (-1, 0, 1):
                x = lx + dx + int(math.sin(y * 1.7 + lx) * 1.4)
                if cv.get(x, y) in ('A0', 'A1', 'A2', 'A3') and hashf(x, y, 5) < 0.45 - abs(dx) * 0.2:
                    cv.set(x, y, 'L2' if dx == 0 and y < WL + 5 else 'L1')
    # ------------------------------------------------ the boardwalk floor
    planks(cv, {'a': 'W2', 'b': 'P1', 'j': 'W1', 'hi': 'P2'}, WALL, tw=13, seed=44)
    cv.hline(0, W - 1, WALL - 2, 'W3')                  # the front beam at the water's edge
    cv.hline(0, W - 1, WALL - 1, 'W1')
    for x in range(0, W, 16):                            # bollards on the beam
        if abs(x - CX) < 14:
            continue
        cv.rect(x, WALL - 5, x + 2, WALL - 1, 'W2'); cv.set(x, WALL - 5, 'W3')
        cv.set(x + 1, WALL - 5, 'W3')
    contact(cv, WALL, 3, {'W2': 'W1', 'P1': 'W1', 'P2': 'P1'})
    for px_ in (40, 160):                                # lantern posts on the beam
        cv.vline(px_, WALL - 12, WALL - 1, 'W2'); cv.vline(px_ + 1, WALL - 12, WALL - 1, 'W1')
        cv.hline(px_ - 3, px_ + 1, WALL - 12, 'W3')
        light(cv, px_ - 2.5, WALL - 7, 16, 9, warm, power=1.1, steps=3)
        lantern(cv, px_ - 3, WALL - 10, ('R0', 'L2', 'L3', 'L4'))
    cracks(cv, rng, 10, ('W2', 'P1'), 'W1', area=(20, 34, 180, 122), ln=(2, 4))
    # nail heads and knots
    for _ in range(60):
        x = rng.randint(14, 186); y = rng.randint(WALL + 3, H - 2)
        if cv.get(x, y) in ('W2', 'P1') and cv.get(x - 1, y) == 'W1':
            cv.set(x + 1, y, 'R2')
    # warm pools from the jetty and the edge lanterns
    floorwarm = {'W1': 'P1', 'P1': 'W2', 'W2': 'P2', 'P2': 'L1'}
    light(cv, CX + 0.5, WALL, 50, 30, floorwarm, power=1.3, steps=3)
    for (x, y) in ((40, WALL), (160, WALL)):
        light(cv, x + 0.5, y, 30, 18, floorwarm, power=1.3, steps=3)
    for (x, y) in ((8, 28), (194, 104)):
        light(cv, x, y, 26, 16, floorwarm, power=1.4, steps=3)
    # a dropped coin, a cork, rope ends
    cv.set(72, 84, 'L3'); cv.set(73, 84, 'L2')
    cv.set(132, 70, 'L3')
    cv.set(118, 100, 'CL'); cv.set(119, 100, 'P2')
    for i in range(7):
        cv.set(46 + i, 60 + (1 if i in (2, 3, 4) else 0), 'CL' if i % 2 else 'P2')
    # ------------------------------------------------ vignette, then the edge props
    vignette(cv, {'W2': 'W1', 'P1': 'W1', 'P2': 'W2', 'L1': 'P2', 'W1': 'R0', 'R1': 'R0',
                  'R2': 'R1', 'R3': 'R2', 'R4': 'R3', 'A2': 'A1', 'A1': 'A0', 'L0': 'R1',
                  'W3': 'W2'},
             cy=64, rx=124, ry=80, inner=0.62, levels=2.0, pred=lambda x, y: y >= WALL - 2)
    CK = ('W3', 'W2', 'P2', 'W1')
    # left: crates stacked against the wall, a lantern on top, a barrel in the corner
    crate(cv, 0, 27, 11, 8, 3, CK)
    crate(cv, 0, 38, 12, 9, 3, CK)
    crate(cv, 1, 50, 10, 8, 3, CK)
    darken(cv, 12, 40, 17, 62, {'W2': 'W1', 'P1': 'W1', 'P2': 'P1'}, t=0.5)
    lantern(cv, 6, 23, ('R0', 'L2', 'L3', 'L4'))
    barrel(cv, 1, 102, 8, 12, ('W3', 'W2', 'W2', 'R1', 'P1', 'W3'))
    for (x, y) in ((0, 116), (4, 118)):                  # sacks
        cv.ellipse(x + 3, y + 2, 3.5, 2.5, 'CL'); cv.set(x + 4, y + 3, 'P2'); cv.set(x + 3, y, 'P2')
    # right: barrels in a row, a crate with a sack, rope coil
    barrel(cv, 190, 26, 8, 11, ('W3', 'W2', 'W2', 'R1', 'P1', 'W3'))
    barrel(cv, 189, 38, 9, 12, ('W3', 'W2', 'W2', 'R1', 'P1', 'W3'))
    barrel(cv, 191, 51, 8, 11, ('W3', 'W2', 'W2', 'R1', 'P1', 'W3'))
    darken(cv, 184, 40, 189, 64, {'W2': 'W1', 'P1': 'W1', 'P2': 'P1'}, t=0.5)
    crate(cv, 188, 106, 12, 9, 3, CK)
    cv.ellipse(194, 106, 4, 2.4, 'CL'); cv.set(193, 105, 'P2'); cv.set(196, 107, 'P2')
    for r in (5, 3.5, 2):
        for a in range(0, 360, 8):
            x = 192 + math.cos(math.radians(a)) * r
            y = 120 + math.sin(math.radians(a)) * r * 0.5
            cv.set(x, y, 'CL' if math.sin(math.radians(a)) < 0 else 'P2')
    lantern(cv, 194, 101, ('R0', 'L2', 'L3', 'L4'))
    return cv


# ================================================================ 4. The Gloomroot Grove

GR = {
    'V0': '#120c22', 'V1': '#22163a', 'V2': '#3a1f4e', 'M1': '#4a4868', 'M2': '#7a7896',
    'T0': '#0b090f', 'T1': '#1c1720', 'T2': '#2e2730', 'T3': '#4a3d46', 'T4': '#73605e',
    'O1': '#24301f', 'O2': '#475a35',
    'D0': '#17131a', 'D1': '#221d23', 'D2': '#2c262b', 'D3': '#3a3134',
    'A1': '#0b1117', 'A2': '#182230',
    'Y1': '#5a2410', 'Y2': '#b85a1c', 'Y3': '#ffaa3c', 'Y4': '#fff0a6',
    'Q1': '#d2ff6e', 'E0': '#3e3f5a', 'E1': '#9ba6c4',
}


def scene_grove():
    rng = random.Random(501)
    cv = Cv(GR, 'V1', W, H)
    CX = 100
    # ------------------------------------------------ twilight through the roots, mist low
    bands(cv, [(0, 'V0'), (6, 'V1'), (13, 'V2'), (19, 'M1')], y0=0, y1=WALL, tw=4)
    # far roots, flat silhouettes in the mist
    for i in range(9):
        a = 6 + i * 23 + rng.uniform(-4, 4)
        b = a + rng.uniform(14, 22)
        m = m_bez((a, WALL), ((a + b) / 2, -6 + rng.uniform(0, 6)), (b, WALL), 1.3, 1.3, steps=40)
        for (x, y) in m:
            if 0 <= y < WALL:
                cv.set(x, y, 'V1' if y < 16 else 'V2')
    # near arching roots, shaded
    arches = [(-8, 26, -18, 2.6), (14, 50, -10, 2.2), (34, 72, -16, 2.8), (128, 166, -16, 2.8),
              (150, 186, -10, 2.2), (172, 210, -18, 2.6), (58, 84, -2, 1.8), (116, 142, -2, 1.8)]
    for (a, b, cy_, r) in arches:
        m = m_bez((a, WALL + 1), ((a + b) / 2.0, cy_), (b, WALL + 1), r, r * 0.8, steps=60)
        shade(cv, m, ('T3', 'T2', 'T2', 'T1', 'T0'))
        for (x, y) in m:
            if (x, y - 1) not in m and hashf(x, y, 7) < 0.35 and 0 <= y < WALL:
                cv.set(x, y, 'O2')
            elif hashf(x // 2, y, 8) < 0.06:
                cv.set(x, y, 'O1')
    # moss hanging off the roots
    for x in range(W):
        if hashf(x, 4, 51) < 0.12:
            for y in range(WALL):
                if cv.get(x, y) in ('T2', 'T3', 'T1') and cv.get(x, y + 1) in ('V0', 'V1', 'V2', 'M1'):
                    ln = 2 + int(hashf(x, y, 9) * 5)
                    for j in range(1, ln):
                        if cv.get(x, y + j) in ('V0', 'V1', 'V2', 'M1'):
                            cv.set(x, y + j, 'O1' if j < ln - 1 else 'O2')
                    break
    # ------------------------------------------------ the great trunk and its glowing face
    tz = vnoise(53)
    trunk = set()
    for y in range(0, WALL + 2):
        flare = max(0.0, (y - 12) / 12.0) ** 2 * 10
        hw = 18 + flare + math.sin(y * 0.5) * 0.6
        for x in range(int(CX - hw), int(CX + hw) + 2):
            trunk.add((x, y))
    for (x, y) in trunk:
        u = (x + 0.5 - (CX - 17)) / 36.0
        n = tz(x / 1.6, y / 7.0)
        k = 'T2' if n > 0.42 else 'T1'
        if n > 0.7:
            k = 'T3'
        if u < 0.12 or (x - 1, y) not in trunk:
            k = 'T3' if n > 0.3 else 'T2'
        if u > 0.85:
            k = 'T1' if n > 0.5 else 'T0'
        cv.set(x, y, k)
    for (x, y) in trunk:
        if (x + 1, y) not in trunk or (x - 1, y) not in trunk:
            cv.set(x, y, 'T0' if (x + 1, y) not in trunk else 'T3')
    # the face: two slanted eye hollows and a gaping mouth, lit from within
    def hollow(cx, cy, rx, ry, slant):
        m = set()
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx = (x + 0.5 - cx) / rx
                dy = (y + 0.5 - cy - dx * slant) / ry
                if dx * dx + dy * dy <= 1:
                    m.add((x, y))
        return m
    eyes = [hollow(CX - 6.5, 8, 4, 2.2, 1.0), hollow(CX + 7.5, 8, 4, 2.2, -1.0)]
    mouth = hollow(CX + 0.5, 18, 9, 4.2, 0.0)
    mouth = {(x, y) for (x, y) in mouth if not (y < 17 and hashf(x // 2, 0, 3) < 0.4)}
    glowsrc = []
    for m, cy_ in ((eyes[0], 8), (eyes[1], 8), (mouth, 18)):
        ys = [y for (_, y) in m]; xs = [x for (x, _) in m]
        mx = (min(xs) + max(xs)) / 2.0
        for (x, y) in m:
            d = math.hypot((x + 0.5 - mx) / ((max(xs) - min(xs)) / 2.0 + 1),
                           (y + 0.5 - cy_) / ((max(ys) - min(ys)) / 2.0 + 1))
            k = 'Y4' if d < 0.3 else ('Y3' if d < 0.6 else 'Y2')
            if (x, y - 1) not in m:
                k = 'Y1'
            cv.set(x, y, k)
        glowsrc.append((mx, cy_))
    for x in range(CX - 8, CX + 10, 3):                  # splintered teeth in the mouth
        cv.set(x, 15, 'T0'); cv.set(x, 16, 'T1')
        cv.set(x + 1, 21, 'T0'); cv.set(x + 1, 20, 'T1')
    glow = {'T1': 'Y1', 'T2': 'Y1', 'T3': 'Y2', 'T0': 'T1'}
    for (gx, gy) in glowsrc:
        light(cv, gx, gy, 16, 9, glow, power=1.6, steps=3,
              pred=lambda x, y: (x, y) in trunk and (x, y) not in mouth
              and (x, y) not in eyes[0] and (x, y) not in eyes[1])
    # roots spilling from the trunk base onto the floor
    # ------------------------------------------------ the floor: mud, roots and moss
    fz = vnoise(57)
    fz2 = vnoise(58)
    for y in range(WALL, H):
        for x in range(W):
            n = fz(x / 11.0, y / 4.5)
            k = 'D2' if n > 0.5 else 'D1'
            if fz2(x / 3.0, y / 1.5) > 0.78:
                k = 'D3' if k == 'D2' else 'D2'
            m = fz2(x / 16.0 + 7, y / 7.0)
            if m > 0.64 and bay(x, y) < q4((m - 0.64) * 12):
                k = 'O1'
            cv.set(x, y, k)
    # the wall's root feet meet the floor; the trunk's roots crawl out over it
    froots = [((CX - 22, WALL + 1), (CX - 44, WALL + 6), (CX - 70, WALL + 4), 2.2, 0.8),
              ((CX + 24, WALL + 1), (CX + 48, WALL + 7), (CX + 76, WALL + 3), 2.2, 0.8),
              ((CX - 14, WALL + 2), (CX - 22, WALL + 12), (CX - 38, WALL + 16), 1.8, 0.6),
              ((CX + 16, WALL + 2), (CX + 26, WALL + 11), (CX + 44, WALL + 14), 1.8, 0.6),
              ((-2, 60), (14, 70), (8, 92), 2.0, 0.8),
              ((202, 52), (186, 66), (194, 88), 2.0, 0.8),
              ((-2, 108), (16, 112), (30, 124), 1.8, 0.8),
              ((202, 104), (184, 112), (172, 126), 1.8, 0.8)]
    for (p0, p1, p2, r0, r1) in froots:
        m = m_bez(p0, p1, p2, r0, r1, steps=60)
        for (x, y) in m:
            if not (0 <= x < W and WALL <= y < H):
                continue
            k = 'T2'
            if (x, y - 1) not in m:
                k = 'T3' if hashf(x, y, 13) < 0.5 else 'D3'
            elif (x, y + 1) not in m:
                k = 'T1'
            cv.set(x, y, k)
        for (x, y) in m:                                 # little shadow below
            if (x, y + 1) not in m and cv.get(x, y + 1) in ('D1', 'D2', 'D3', 'O1'):
                cv.set(x, y + 1, 'D0')
    contact(cv, WALL, 4, {'D1': 'D0', 'D2': 'D1', 'D3': 'D2', 'O1': 'D0'})
    # black water pools with a violet sky in them
    for (px_, py_, rx, ry) in ((48, 64, 12, 3.0), (144, 76, 13, 3.2), (92, 106, 11, 2.8),
                               (30, 98, 6, 1.8), (166, 104, 7, 2.0), (120, 46, 7, 1.8)):
        m = set()
        for (x, y) in m_ell(px_, py_, rx, ry):
            if hashf(x // 2, y, 37) < 0.88 or abs(x - px_) < rx * 0.7:
                m.add((x, y))
        for (x, y) in m:
            cv.set(x, y, 'A1' if (x, y - 1) not in m else 'A2')
        for (x, y) in m:
            if (x, y + 1) not in m and bay(x, y + 1) < 0.5:
                cv.set(x, y + 1, 'D3')
        gy = int(py_)
        for x in range(int(px_ - rx * 0.5), int(px_ + rx * 0.2)):
            if (x, gy) in m and hashf(x, gy, 4) < 0.5:
                cv.set(x, gy, 'V2')
        if rx > 10:
            cv.set(int(px_ + 2), gy, 'Y2')
    # warm glow from the face spilling over the mud
    light(cv, CX + 0.5, WALL - 2, 58, 36, {'D0': 'D1', 'D1': 'D2', 'D2': 'D3', 'D3': 'Y1',
                                            'O1': 'O2', 'T2': 'T3'}, power=1.3, steps=3)
    # tiny mushrooms and twigs
    for (x, y) in ((60, 40), (140, 38), (36, 52), (168, 58), (76, 80)):
        cv.set(x, y, 'Y2'); cv.set(x + 1, y, 'Y1'); cv.set(x, y + 1, 'T3')
    for (x, y) in ((110, 92), (64, 116), (150, 120)):
        cv.line(x, y, x + 4, y + 1, 'T3'); cv.set(x + 2, y - 1, 'T3')
    # ------------------------------------------------ vignette, then the corners
    vignette(cv, {'D1': 'D0', 'D2': 'D1', 'D3': 'D2', 'O1': 'D0', 'O2': 'O1', 'T2': 'T1',
                  'T3': 'T2', 'T1': 'T0', 'A2': 'A1', 'V2': 'V1', 'V1': 'V0', 'M1': 'V2',
                  'Y1': 'D3', 'D0': 'T0'},
             cy=64, rx=124, ry=80, inner=0.62, levels=2.0)
    # webs in the corners
    web(cv, 0, 0, 0, 90, 22, (7, 15), 'E0', 'E1', 1)
    web(cv, 199, 0, 90, 180, 20, (6, 13), 'E0', 'E1', 2)
    web(cv, 0, 124, -90, 0, 14, (5, 10), 'E0', 'E1', 3)
    web(cv, 199, 124, 180, 270, 13, (5, 10), 'E0', 'E1', 4)
    cv.set(9, 9, 'T0'); cv.set(10, 9, 'T0'); cv.set(9, 10, 'T0'); cv.set(10, 10, 'T1')
    cv.set(189, 8, 'T0'); cv.set(190, 8, 'T0'); cv.set(189, 7, 'T1')
    # root knots tight to the side edges
    for (x0, s) in ((0, 1), (199, -1)):
        for (yy, r) in ((32, 4), (46, 5)):
            m = m_ell(x0 + s * 3, yy, r, r * 0.8)
            shade(cv, m, ('T3', 'T2', 'T2', 'T1', 'T0'))
            for (x, y) in m:
                if hashf(x, y, 12) < 0.2:
                    cv.set(x, y, 'O2')
    # fireflies
    for (x, y) in ((22, 14), (48, 6), (64, 20), (138, 12), (158, 5), (176, 19), (12, 44),
                   (188, 38), (8, 78), (192, 84), (30, 30), (170, 30), (116, 4)):
        firefly(cv, x, y, 'Q1', 'O2')
    return cv


SCENES = [
    ('saltreach-lighthouse', scene_lighthouse),
    ('coral-labyrinth', scene_coral),
    ('smugglers-warren', scene_warren),
    ('gloomroot-grove', scene_grove),
]
