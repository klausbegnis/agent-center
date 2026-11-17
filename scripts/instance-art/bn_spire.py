"""Wyrmrest Spire: a rock needle wrapped by a dragon's skeleton, nests, a cut stair, a storm."""
import random, math
from engine import *

W, H = 192, 72
SX = 142          # spire axis
GROUND = 62

PAL = {
    # storm sky
    'K0': '#0d0b17', 'K1': '#19162d', 'K2': '#2a2545', 'K3': '#40395f', 'K4': '#6b6592',
    'LW': '#f4fbff', 'LC': '#98d2ff',
    # far needles
    'F1': '#211d36', 'F2': '#322c4c',
    # rock, warm, lit by the lightning on the right
    'R0': '#100d12', 'R1': '#221b20', 'R2': '#382d30', 'R3': '#574641', 'R4': '#8a6e5a',
    # bone
    'B1': '#6c604f', 'B2': '#a6967a', 'B3': '#dcd1b2', 'B4': '#fff8e4',
    # nests, torches, eggs
    'N1': '#6a4826', 'T1': '#c4521c', 'T2': '#ffb444', 'E1': '#5c9c8a',
}

BONE = ('B4', 'B3', 'B2', 'B1')


def bezpt(p0, p1, p2, t):
    return ((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
            (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])


def halfw(y):
    """Half width of the needle at height y."""
    t = max(0.0, (y + 3) / (GROUND + 3))
    w = 2.0 + 9.0 * t ** 1.25 + 0.8 * math.sin(y * 0.7) * t
    for (ly, lw) in LEDGES:
        if 0 <= ly - y < 3:
            w += lw * (1 - (ly - y) / 3.0)
    if y > GROUND - 8:
        w += (y - (GROUND - 8)) ** 1.5 * 0.5
    return w


LEDGES = ((41, 7), (34, 6), (21, 5), (21, 0), (51, 4))


def draw():
    cv = Cv(PAL, 'K0', W, H)
    nz = vnoise(51)
    rng = random.Random(8)

    # ------------------------------------------------------------ storm sky: billowing cloud masses
    bands(cv, [(0, 'K0'), (16, 'K1'), (32, 'K2'), (46, 'K3')], y1=GROUND + 2, tw=4)
    BX, BY = 174, 6
    r3 = random.Random(17)
    masses = []
    for (cx, cy, n, spread, rr) in ((40, 8, 9, 34, 6), (110, 4, 10, 30, 7), (160, 18, 9, 30, 6),
                                    (70, 26, 7, 30, 4.5), (180, 34, 4, 14, 4), (14, 30, 5, 16, 4)):
        blobs = [(cx + r3.uniform(-spread, spread), cy + r3.uniform(-2.5, 2.5), rr * r3.uniform(0.7, 1.2))
                 for _ in range(n)]
        masses.append(blobs)
    for blobs in masses:
        m = set()
        for (bx, by, br) in blobs:
            m |= m_ell(bx, by, br * 1.3, br)
        for (x, y) in m:
            if not (0 <= x < W and 0 <= y < H):
                continue
            near = math.hypot(x - BX, (y - 14) * 1.4) < 46
            k = 'K2'
            if (x, y + 1) not in m or (x, y + 2) not in m:
                k = 'K1'                                       # dark bellies
            if (x, y - 1) not in m or (x + 1, y - 1) not in m:
                k = 'K4' if near else 'K3'                     # flash-lit tops
            elif near and ((x, y - 2) not in m or (x + 2, y - 1) not in m):
                k = 'K3'
            cv.set(x, y, k)
    # the sky behind the spire glows with the flash
    light(cv, 150, 12, 44, 22, {'K0': 'K1', 'K1': 'K2', 'K2': 'K3', 'K3': 'K4'}, power=1.5, steps=3)
    # ------------------------------------------------------------ far needles, misty
    for (x, top, w, k) in ((22, 30, 6, 'F1'), (60, 22, 8, 'F2'), (76, 32, 5, 'F1'), (100, 28, 6, 'F2'),
                           (186, 26, 7, 'F2')):
        for y in range(top, GROUND + 2):
            t = (y - top) / (GROUND - top)
            hw = 1 + w * t ** 1.4
            for xx in range(int(x - hw), int(x + hw) + 1):
                kk = k
                if xx > x + hw - 1.2 and k == 'F2':
                    kk = 'K3'
                cv.set(xx, y, kk)
    for y in range(44, GROUND + 2):
        for x in range(W):
            if cv.get(x, y) in ('F1', 'F2') and bay(x, y) < q4((y - 44) / 18.0) * 0.75:
                cv.set(x, y, 'K3' if cv.get(x, y) == 'F2' else 'K2')

    # ------------------------------------------------------------ the needle
    rock = set()
    for y in range(0, H):
        hw = halfw(min(y, GROUND))
        off = 1.5 * math.sin(y / 6.0)
        for x in range(int(SX + off - hw), int(SX + off + hw) + 1):
            rock.add((x, y))
    # peak tip
    U = run_u(rock)
    for (x, y) in rock:
        u = U[(x, y)]
        strata = nz(x / 2.0, y / 5.0)
        k = 'R1' if u < 0.35 else ('R2' if u < 0.62 else 'R3')
        if u > 0.82:
            k = 'R4'
        if (y + int(x * 0.4)) % 6 == 0 and strata > 0.45:
            k = {'R1': 'R0', 'R2': 'R1', 'R3': 'R2', 'R4': 'R3'}[k]
        cv.set(x, y, k)
    # ------------------------------------------------------------ the stair cut into the rock
    steps = []
    y = GROUND - 2
    side = 1
    while y > 12:
        hw = halfw(y)
        x0 = SX - hw * 0.8 if side > 0 else SX + hw * 0.8
        run = int(hw * 1.2)
        for i in range(run):
            xx = int(x0 + side * i)
            yy = int(y - i * 0.5)
            cv.set(xx, yy, 'R4' if xx > SX else 'R3')
            cv.set(xx, yy + 1, 'R0')
            steps.append((xx, yy))
        y -= run * 0.5 + 3
        side = -side
    # ------------------------------------------------------------ the dragon skeleton, spiralling up
    turns = 1.7
    verts = []
    n = 220
    for i in range(n + 1):
        s = i / n
        y = GROUND - 2 - s * 52
        th = s * turns * 2 * math.pi + 0.6
        r = halfw(y) + 3.0
        x = SX + 1.5 * math.sin(y / 6.0) + r * math.sin(th)
        front = math.cos(th) > 0.0
        verts.append((x, y, front, s, th))
    # back segments only where they show against the sky
    for (x, y, front, s, th) in verts:
        if not front:
            for (dx, dy) in ((0, 0), (1, 0)):
                p = (int(x) + dx, int(y) + dy)
                if p not in rock:
                    cv.set(p[0], p[1], 'B1')
    # ribs on the lower turn, curling down around the rock
    for (x, y, front, s, th) in verts[30:90:5]:
        if not front:
            continue
        d = 1 if math.sin(th) > 0 else -1
        for j in range(7):
            rx = int(x + d * (j * 0.5)) - (1 if d < 0 else 0)
            ry = int(y + j)
            cv.set(rx, ry, 'B2' if j < 4 else 'B1')
    # spine in front of the rock: a dark shadow line under it, then the vertebrae
    fr = [(int(x), int(y), s, th) for (x, y, front, s, th) in verts if front]
    for (x, y, s, th) in fr:
        cv.set(x, y + 2, 'R0'); cv.set(x + 1, y + 2, 'R0')
    for i, (x, y, s, th) in enumerate(fr):
        lit = math.sin(th) > 0.1
        seg = (int(s * n) // 2) % 2
        top = 'B4' if lit else 'B3'
        cv.set(x, y, top if seg == 0 else 'B3')
        cv.set(x + 1, y, 'B3' if lit else 'B2')
        cv.set(x, y + 1, 'B2')
        cv.set(x + 1, y + 1, 'B1' if seg else 'B2')
        if s < 0.85 and int(s * n) % 6 == 0:
            cv.set(x, y - 1, 'B3')                                     # spinous process
    # tail trailing over the ground to the left
    for i in range(22):
        x = SX - 18 - i * 1.4
        y = GROUND + 1 + 1.5 * math.sin(i * 0.5)
        cv.set(int(x), int(y), 'B2' if i % 2 else 'B3')
        cv.set(int(x) + 1, int(y), 'B1')
    # a wing: finger bones fanning off the shoulder, rags of membrane between
    SHX, SHY = SX - 7, 24
    WRX, WRY = SX - 20, 16                                         # the wrist
    tips = [(SX - 54, 10), (SX - 56, 24), (SX - 48, 36), (SX - 36, 44)]
    ctrl = [(SX - 38, 8), (SX - 40, 20), (SX - 36, 30), (SX - 28, 34)]
    # membrane remnants first, so the bones lie over them
    for i in range(len(tips) - 1):
        for t in [j / 20.0 for j in range(2, 20)]:
            a = bezpt((WRX, WRY), ctrl[i], tips[i], t)
            b = bezpt((WRX, WRY), ctrl[i + 1], tips[i + 1], t)
            sag = 3.0 * t
            for k in range(0, 13):
                u = k / 12.0
                mx = a[0] + (b[0] - a[0]) * u
                my = a[1] + (b[1] - a[1]) * u + sag * math.sin(u * math.pi)
                tear = hashf(int(mx) // 2, int(my) // 3, 5 + i)
                if t > 0.35 and tear < 0.4:
                    continue                                       # torn away
                if cv.get(mx, my) in ('K0', 'K1', 'K2', 'K3', 'K4', 'F1', 'F2'):
                    cv.set(mx, my, 'R1' if (int(mx) + int(my)) % 3 else 'R2')
    for (a0, a1) in (((SHX, SHY), (WRX, WRY)),):
        cv.line(a0[0], a0[1], a1[0], a1[1], 'B3')
        cv.line(a0[0], a0[1] + 1, a1[0], a1[1] + 1, 'B1')
    for (c, tp) in zip(ctrl, tips):
        prevp = None
        for j in range(0, 41):
            p = bezpt((WRX, WRY), c, tp, j / 40.0)
            cv.set(p[0], p[1], 'B3')
            if j < 30:
                cv.set(p[0], p[1] + 1, 'B1')
        cv.set(tp[0], tp[1], 'B4')
    cv.disc(WRX, WRY, 1.5, 'B3'); cv.set(WRX - 1, WRY - 1, 'B4')
    # the skull resting on a ledge near the top, facing the storm
    KX, KY = SX + 3, 10
    skull = ["....1111.....",
             "..11233331...",
             ".1233333331..",
             "1233303333311",
             "12333333333331",
             ".122222333331.",
             "..1..3.3.3.31.",
             "..1.........1.",
             "...1.3.3.3.1..",
             "....1222221..."]
    stamp(cv, KX, KY, skull, {'1': 'B1', '2': 'B2', '3': 'B3', '0': 'T2'})
    cv.set(KX + 5, KY + 3, 'T1')
    for (x, y) in ((KX + 2, KY - 1), (KX + 1, KY - 2), (KX, KY - 3), (KX + 4, KY - 1), (KX + 4, KY - 2),
                   (KX + 3, KY - 3)):
        cv.set(x, y, 'B3')                                          # swept horns
    for x in range(KX - 1, KX + 13):
        cv.set(x, KY + 10, 'R3')
        cv.set(x, KY + 11, 'R1')

    # ------------------------------------------------------------ nests on ledges
    for (nx, ny, eggs) in ((SX - 13, 40, 2), (SX + 12, 33, 3), (SX - 8, 20, 1)):
        for i in range(-5, 6):
            d = abs(i)
            cv.set(nx + i, ny, 'N1' if (i + ny) % 2 else 'R3')
            if d < 5:
                cv.set(nx + i, ny + 1, 'R2' if i % 2 else 'N1')
            if d < 3:
                cv.set(nx + i, ny + 2, 'R1')
        cv.set(nx - 6, ny - 1, 'N1'); cv.set(nx + 6, ny - 1, 'R3')
        for e in range(eggs):
            ex = nx - 2 + e * 2
            cv.set(ex, ny - 1, 'B3'); cv.set(ex + 1, ny - 1, 'E1'); cv.set(ex, ny - 2, 'B4')
            cv.set(ex + 1, ny - 2, 'B3')

    # ------------------------------------------------------------ ground and the gate at the base
    for y in range(GROUND, H):
        for x in range(W):
            if (x, y) in rock and y < GROUND + 3:
                continue
            k = 'R1' if (x + y * 3) % 7 else 'R2'
            if y == GROUND:
                k = 'R2'
            if y > GROUND + 5:
                k = 'R0' if bay(x, y) < q4((y - GROUND - 5) / 5.0) * 0.75 else 'R1'
            cv.set(x, y, k)
    GXc, GT = SX + 1, GROUND - 14
    for y in range(GT, GROUND + 1):
        for x in range(GXc - 7, GXc + 8):
            dx = x + 0.5 - GXc
            ins = (y >= GT + 5 and abs(dx) <= 4.5) or math.hypot(dx, y + 0.5 - (GT + 5)) <= 4.5
            ring = (y >= GT + 5 and abs(dx) <= 6.5) or math.hypot(dx, y + 0.5 - (GT + 5)) <= 6.5
            if ins:
                t = (y - GT) / 14.0
                k = 'R0' if t < 0.45 else ('T1' if bay(x, y) < q4((t - 0.45) * 2.5) else 'R0')
                if t > 0.85 and abs(dx) < 2.5:
                    k = 'T2'
                cv.set(x, y, k)
            elif ring:
                cv.set(x, y, 'B2' if dx > 0 else 'B1')                 # framed in bone
    for (x, y) in ((GXc - 7, GT + 3), (GXc + 7, GT + 3)):
        for (dx, dy, k) in ((0, 0, 'T2'), (0, 1, 'T1'), (0, -1, 'T1'), (0, 2, 'R0'), (0, 3, 'R0')):
            cv.set(x + dx, y + dy, k)
    light(cv, GXc, GROUND, 16, 6, {'R1': 'R2', 'R2': 'R3', 'R0': 'R1'}, power=1.5, steps=3)
    # the stair redrawn over the bones where it shows, with torches at every turn
    for i, (sx_, sy_) in enumerate(steps):
        if cv.get(sx_, sy_) in ('R1', 'R2', 'R3', 'R0'):
            cv.set(sx_, sy_, 'R4')
    for i in range(1, len(steps) - 1):
        a, b = steps[i - 1], steps[i + 1]
        if (b[0] - steps[i][0]) * (steps[i][0] - a[0]) < 0:          # a switchback
            cv.set(steps[i][0], steps[i][1] - 2, 'T2'); cv.set(steps[i][0], steps[i][1] - 1, 'T1')
    # lizardfolk climbing the stair with a torch
    for (fx, fy) in (steps[3], steps[10]):
        cv.set(fx, fy - 1, 'R0'); cv.set(fx, fy - 2, 'R0'); cv.set(fx, fy - 3, 'R0')
        cv.set(fx - 1, fy - 3, 'R0'); cv.set(fx + 1, fy - 1, 'R0')
        cv.set(fx + 1, fy - 4, 'T2'); cv.set(fx + 1, fy - 3, 'T1')
    # a great rib-bone arching out of the ground, right foreground
    rib = m_bez((168, 72), (176, 46), (190, 48), 2.2, 0.8)
    cyl(cv, rib, ('B3', 'B2', 'B2', 'B1'), cuts=(0.3, 0.6, 0.85))
    rib2 = m_bez((158, 72), (164, 54), (174, 54), 1.6, 0.6)
    cyl(cv, rib2, ('B2', 'B2', 'B1', 'B1'), cuts=(0.3, 0.6, 0.85))

    # ------------------------------------------------------------ the lightning bolt
    pts = [(BX, BY - 6)]
    x, y = BX, BY - 6
    r2 = random.Random(5)
    while y < 34:
        x += r2.choice((-2, -1, 0, 1, 1, 2))
        y += r2.randint(2, 4)
        pts.append((x, y))
    for a, b in zip(pts, pts[1:]):
        cv.line(a[0], a[1], b[0], b[1], 'LW')
        cv.line(a[0] + 1, a[1], b[0] + 1, b[1], 'LC')
    fork = pts[len(pts) // 2]
    cv.line(fork[0], fork[1], fork[0] + 6, fork[1] + 5, 'LC')
    cv.line(fork[0] + 6, fork[1] + 5, fork[0] + 8, fork[1] + 10, 'LC')
    # lightning rim on the needle's right side
    for y in range(4, GROUND):
        xs = [x for x in range(SX - 30, SX + 30) if (x, y) in rock]
        if xs and (y % 4 != 0 or y < 30):
            cv.set(max(xs), y, 'LC' if y < 36 else 'R4')
    # rain, slanting
    for i in range(60):
        x, y = rng.randrange(W), rng.randrange(GROUND)
        if cv.get(x, y) in ('K0', 'K1', 'K2', 'K3'):
            cv.set(x, y, 'K3' if cv.get(x, y) != 'K3' else 'K4')
            cv.set(x - 1, y + 1, 'K3' if cv.get(x - 1, y + 1) != 'K3' else 'K4')
    return cv
