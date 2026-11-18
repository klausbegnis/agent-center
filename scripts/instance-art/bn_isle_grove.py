"""Gloomroot Grove: a drowned mangrove forest at twilight, one huge gnarled tree whose roots arch
over black water, a face-like hollow glowing in its trunk, webs between the roots, fireflies, mist."""
import random, math
from engine import *

W, H = 192, 72
WL = 47          # water line
TX = 140         # trunk axis
TBASE = 38       # where the trunk splits into roots

PAL = {
    # twilight sky
    'V0': '#120c22', 'V1': '#22163a', 'V2': '#3a1f4e', 'V3': '#5e2c5e', 'V4': '#8c4a6a',
    'V5': '#c8806e',
    # far mangroves and mist
    'F1': '#1c1530', 'F2': '#2e2646', 'M1': '#4a4868', 'M2': '#7a7896',
    # the great tree
    'T0': '#0b090f', 'T1': '#1c1720', 'T2': '#2e2730', 'T3': '#4a3d46', 'T4': '#73605e',
    'O1': '#24301f', 'O2': '#475a35',
    # black water
    'A0': '#04060a', 'A1': '#0b1117', 'A2': '#151d27',
    # the glow in the hollow
    'Y1': '#5a2410', 'Y2': '#b85a1c', 'Y3': '#ffaa3c', 'Y4': '#fff0a6',
    # fireflies, silk
    'Q1': '#d2ff6e', 'E1': '#9ba6c4', 'E0': '#565a7a',
}

BARK = ('T4', 'T3', 'T2', 'T1', 'T0')
SKY = ('V0', 'V1', 'V2', 'V3', 'V4', 'V5')
GLOW = {'T0': 'T1', 'T1': 'Y1', 'T2': 'Y1', 'T3': 'Y2', 'T4': 'Y2', 'O1': 'Y1', 'O2': 'Y2',
        'A0': 'Y1', 'A1': 'Y1', 'A2': 'Y2', 'F1': 'Y1', 'M1': 'Y2', 'E1': 'Y3'}


def bez(p0, p1, p2, t):
    return ((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
            (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])


def shade_tube(cv, pts, lightdir=(-0.6, -0.8), keys=BARK, mask_out=None, nz=None):
    """Draw a tube along pts [(x, y, r)], shaded by the normal against a light direction."""
    m = set()
    for (x, y, r) in pts:
        m |= m_ell(x, y, r, r)
    for (x, y) in m:
        best, bi = 1e9, 0
        for i in range(0, len(pts), 2):
            px_, py_, r = pts[i]
            d = (x + 0.5 - px_) ** 2 + (y + 0.5 - py_) ** 2
            if d < best:
                best, bi = d, i
        px_, py_, r = pts[bi]
        ox, oy = (x + 0.5 - px_) / max(r, 0.8), (y + 0.5 - py_) / max(r, 0.8)
        lam = lightdir[0] * ox + lightdir[1] * oy
        if nz:
            lam += (nz(x / 1.5, y / 4.0) - 0.5) * 0.5
        i = 0 if lam > 0.6 else (1 if lam > 0.1 else (2 if lam > -0.4 else (3 if lam > -0.8 else 4)))
        if (x, y - 1) not in m and ((x - 1, y) not in m or (x - 1, y - 1) not in m):
            i = 0                                           # rim lit by the last of the sky
        elif (x, y - 1) not in m:
            i = min(i, 1)
        if mask_out and (x, y) in mask_out:
            continue
        cv.set(x, y, keys[i])
    return m


def web(cv, cx, cy, anchors, rings=4):
    for (ax, ay) in anchors:
        cv.line(cx, cy, ax, ay, 'E1')
    for k in range(1, rings + 1):
        f = k / (rings + 0.6)
        for j in range(len(anchors)):
            a = anchors[j]; b = anchors[(j + 1) % len(anchors)]
            p = (cx + (a[0] - cx) * f, cy + (a[1] - cy) * f)
            q = (cx + (b[0] - cx) * f, cy + (b[1] - cy) * f)
            n = int(max(abs(q[0] - p[0]), abs(q[1] - p[1]))) + 1
            for i in range(n + 1):
                t = i / n
                sag = 0.8 * math.sin(t * math.pi)
                x = p[0] + (q[0] - p[0]) * t
                y = p[1] + (q[1] - p[1]) * t + sag
                cv.set(x, y, 'E0' if k < rings else 'E1')
    cv.set(cx, cy, 'E1')


def draw():
    cv = Cv(PAL, 'V0', W, H)
    nz = vnoise(37)
    rng = random.Random(29)

    # ------------------------------------------------------------ twilight sky
    bands(cv, [(0, 'V0'), (8, 'V1'), (17, 'V2'), (26, 'V3'), (34, 'V4'), (40, 'V5')], y1=WL, tw=4)
    for (cx, cy, hl, k) in ((40, 22, 30, 'V3'), (90, 29, 22, 'V4'), (20, 33, 14, 'V4'), (70, 12, 26, 'V2')):
        for x in range(cx - hl, cx + hl):
            u = (x - cx) / hl
            if 1 - u * u < 0.2:
                continue
            cv.set(x, cy, k)
            if abs(u) < 0.6:
                cv.set(x + 2, cy - 1, k)
    for (x, y) in ((24, 6), (60, 3), (98, 9), (12, 14)):
        cv.set(x, y, 'M2')
    cv.set(52, 8, 'Y4'); cv.set(51, 8, 'V3'); cv.set(53, 8, 'V3'); cv.set(52, 7, 'V3'); cv.set(52, 9, 'V3')

    # ------------------------------------------------------------ far mangroves: two misty layers on stilts
    def grove_layer(seed, base, top_lo, top_hi, k, kr, step):
        r = random.Random(seed)
        x = -6
        while x < W + 6:
            w = r.randint(8, 16)
            top = r.randint(top_lo, top_hi)
            crown = base - 8
            m = set()
            for i in range(4):
                m |= m_ell(x + r.uniform(-w * 0.4, w * 0.4), r.uniform(top + 2, crown - 1), w * r.uniform(0.35, 0.6),
                           r.uniform(2.5, 4.5))
            rim = {'F2': 'M1', 'F1': 'F2'}[k]
            for (px_, py_) in m:
                top_ = (px_, py_ - 1) not in m
                cv.set(px_, py_, rim if top_ or ((px_, py_ - 2) not in m and (px_ + py_) % 2) else k)
            for j in range(r.randint(3, 5)):               # arching stilt roots
                a = (x + r.uniform(-w * 0.3, w * 0.3), crown - 2)
                spread = r.uniform(-w * 0.8, w * 0.8)
                b = (a[0] + spread * 0.7, crown - 1 + r.uniform(0, 2))
                c = (a[0] + spread, base)
                for i in range(13):
                    q = bez(a, b, c, i / 12.0)
                    cv.set(q[0], q[1], kr)
            x += w + r.randint(step - 4, step + 4)
    grove_layer(5, WL, 24, 32, 'F2', 'F2', 6)
    for y in range(36, WL):
        for x in range(W):
            if cv.get(x, y) == 'F2' and bay(x, y) < q4((y - 36) / 11.0) * 0.75:
                cv.set(x, y, 'M1')
    grove_layer(8, WL + 1, 14, 24, 'F1', 'F1', 10)
    for y in range(40, WL + 1):
        for x in range(W):
            if cv.get(x, y) == 'F1' and bay(x, y) < q4((y - 40) / 8.0) * 0.5:
                cv.set(x, y, 'F2')

    # ------------------------------------------------------------ black water and its mirror
    for y in range(WL, H):
        for x in range(W):
            d = y - WL
            ry = WL - 1 - d                                   # mirrored row
            k = cv.get(x, ry) if ry >= 0 else 'V0'
            rk = {'V5': 'V3', 'V4': 'V2', 'V3': 'V1', 'V2': 'A2', 'V1': 'A1', 'V0': 'A0',
                  'F2': 'A2', 'F1': 'A0', 'M1': 'A2', 'M2': 'V2'}.get(k, 'A1')
            if d > 12 and rk in ('V3', 'V2'):
                rk = 'V1' if rk == 'V3' else 'A2'
            if y % 2 == 1 and hashf(x // 3, y, 2) < 0.35 + d * 0.02:
                rk = 'A0' if d > 6 else 'A1'
            cv.set(x, y, rk)
    cv.hline(0, W - 1, WL, 'M1')
    for x in range(W):
        if hashf(x // 2, 0, 6) < 0.4:
            cv.set(x, WL, 'M2')
    # mist lying on the water
    for (cy, amp, hl, cx) in ((WL - 1, 3, 60, 50), (WL + 2, 2, 44, 120), (WL - 3, 2, 30, 180), (WL + 5, 2, 40, 24)):
        for x in range(cx - hl, cx + hl):
            u = (x - cx) / hl
            t = (1 - u * u)
            if t <= 0:
                continue
            for y in range(int(cy - amp * t), int(cy + amp * t) + 1):
                k = cv.get(x, y)
                if k in SKY + ('F1', 'F2', 'A0', 'A1', 'A2') and bay(x, y) < q4(t * 0.9) * 0.75:
                    cv.set(x, y, 'M1' if y < cy else ('M1' if k != 'A0' else 'F2'))

    # ------------------------------------------------------------ the great tree: canopy first
    can = set()
    r = random.Random(17)
    for i in range(16):
        cx = r.uniform(86, 196)
        cy = r.uniform(-4, 6 + (cx - 86) * 0.02)
        can |= m_ell(cx, cy, r.uniform(8, 16), r.uniform(4, 7))
    for (x, y) in can:
        if not (0 <= x < W and 0 <= y < H):
            continue
        k = 'T1'
        n = nz(x / 2.0, y / 2.0)
        if (x, y + 1) not in can:
            k = 'T0'
        elif n > 0.62:
            k = 'O1'
        if (x, y - 1) not in can or ((x - 1, y) not in can and x < TX):
            k = 'T2'
        cv.set(x, y, k)
    # hanging moss
    for x in range(86, W):
        bot = max([y for y in range(0, 20) if (x, y) in can], default=None)
        if bot is None or hashf(x, 0, 9) < 0.45:
            continue
        ln = 2 + int(hashf(x, 1, 9) * 9)
        for j in range(ln):
            cv.set(x + (j // 5), bot + 1 + j, 'O1' if j < ln - 2 else 'O2')

    # ------------------------------------------------------------ the roots: arches into the water
    # each root leaves the flared foot of the trunk, arches up and out, and plunges into the
    # water; nearer roots land lower in the frame. Some fork on the way down.
    rr = random.Random(44)
    specs = []
    for (side, y0, dist, land, r0) in ((-1, 30, 62, WL + 1, 3.0), (1, 28, 52, WL + 1, 2.8),
                                       (-1, 34, 40, WL + 6, 4.2), (1, 33, 38, WL + 8, 4.4),
                                       (-1, 38, 22, WL + 16, 5.2), (1, 37, 20, WL + 14, 5.0),
                                       (-1, 40, 9, H + 2, 5.0), (1, 41, 6, H + 2, 4.6),
                                       (-1, 26, 30, WL + 2, 2.6), (1, 31, 64, WL + 3, 2.4)):
        x0 = TX + side * (11 + (y0 - 26) * 0.4)
        x2 = TX + side * dist
        peak = min(y0, land) - rr.uniform(6, 14) - dist * 0.12
        x1 = x0 + (x2 - x0) * rr.uniform(0.45, 0.8)
        specs.append(((x0, y0), (x1, peak), (x2, land), r0, max(1.2, r0 * 0.35), land < WL + 5))
    tubes = []
    far = []
    for (p0, p1, p2, r0, r1, isfar) in specs:
        pts = []
        for i in range(41):
            t = i / 40.0
            x, y = bez(p0, p1, p2, t)
            pts.append((x, y, r0 + (r1 - r0) * t ** 0.7))
        tubes.append(pts)
        far.append(isfar)
        if r0 > 3.5:                                      # a fork dropping off the arch
            fx, fy, fr = pts[22]
            q2 = (fx + (p2[0] - p0[0]) * 0.25, min(H + 2, p2[1] + 4))
            pts2 = []
            for i in range(21):
                t = i / 20.0
                x, y = bez((fx, fy), (fx + (q2[0] - fx) * 0.8, fy - 3), q2, t)
                pts2.append((x, y, fr * 0.6 * (1 - t) + 1.0 * t))
            tubes.append(pts2)
            far.append(False)
    # reflections of the roots first (under everything)
    for pts in tubes:
        for (x, y, r) in pts:
            if y < WL:
                ry = 2 * WL - y
                if ry < H:
                    for dx in range(-int(r), int(r) + 1):
                        if int(ry) % 2 == 0 or hashf(int(x) + dx, int(ry), 3) < 0.5:
                            cv.set(x + dx, ry, 'A0')
    # far roots, then the trunk, then near roots
    for pts, f in zip(tubes, far):
        if f:
            shade_tube(cv, pts, keys=('T3', 'T2', 'T1', 'T1', 'T0'), nz=nz)
    # ------------------------------------------------------------ the trunk, gnarled and flaring
    trunk = set()
    for y in range(-2, TBASE + 6):
        t = max(0.0, (y - 8) / (TBASE - 8.0))
        hw = 10 + 11 * t ** 2.2 + 1.4 * math.sin(y * 0.45)
        off = 2.5 * math.sin(y / 9.0)
        for x in range(int(round(TX + off - hw)), int(round(TX + off + hw)) + 1):
            trunk.add((x, y))
    TU = run_u(trunk)
    for (x, y) in trunk:
        u = TU[(x, y)]
        ridge = math.sin(x * 0.9 + 3 * math.sin(y * 0.18) + u * 4)
        v = u + ridge * 0.08 + (nz(x / 1.5, y / 5.0) - 0.5) * 0.18
        i = 0 if v < 0.14 else (1 if v < 0.38 else (2 if v < 0.65 else (3 if v < 0.88 else 4)))
        if ridge > 0.75 and i < 4:
            i += 1                                          # deep grooves in the bark
        cv.set(x, y, BARK[i])
    # twilight rim on the left edge of the trunk
    for (x, y) in trunk:
        if (x - 1, y) not in trunk and y > 4:
            cv.set(x, y, 'V4' if y < 30 else 'T4')
    # two great limbs reaching up into the canopy
    for (p0, p1, p2, r0, r1) in (((TX - 4, 8), (TX - 14, 2), (TX - 40, 3), 5.0, 2.0),
                                 ((TX + 6, 6), (TX + 20, 4), (TX + 44, -3), 4.5, 2.0),
                                 ((TX - 20, 4), (TX - 30, -2), (TX - 52, 6), 2.4, 1.0)):
        pts = []
        for i in range(31):
            t = i / 30.0
            x, y = bez(p0, p1, p2, t)
            pts.append((x, y, r0 + (r1 - r0) * t))
        shade_tube(cv, pts, nz=nz)
        for i in range(6, 31, 4):
            x, y, r = pts[i]
            ln = 2 + int(hashf(i, int(x), 7) * 7)
            for j in range(ln):
                cv.set(x + j // 4, y + r + j, 'O1' if j < ln - 2 else 'O2')
    # ------------------------------------------------------------ the face in the hollow
    FX, FY = TX + 1, 22
    hollow = m_ell(FX, FY + 7, 5.5, 4.5) | m_poly([(FX - 5, FY + 7), (FX + 5, FY + 7), (FX + 2, FY + 13), (FX - 2, FY + 13)])
    for (x, y) in hollow:
        d = math.hypot((x + 0.5 - FX) / 5.5, (y + 0.5 - FY - 9) / 5.0)
        k = 'Y1'
        if d < 0.75:
            k = 'Y2' if bay(x, y) < q4((0.75 - d) * 3) else 'Y1'
        if d < 0.4:
            k = 'Y3' if bay(x, y) < q4((0.4 - d) * 4) else 'Y2'
        if (x, y - 1) not in hollow:
            k = 'T0'
        cv.set(x, y, k)
    # jagged teeth of splintered wood around the mouth
    for (x, y, h) in ((FX - 4, FY + 1, 3), (FX - 1, FY + 1, 2), (FX + 2, FY + 1, 3), (FX + 4, FY + 2, 2)):
        for j in range(h):
            cv.set(x, y + j, 'T2' if j < h - 1 else 'T3')
    for (x, y) in ((FX - 2, FY + 13), (FX + 1, FY + 12), (FX + 3, FY + 13)):
        cv.set(x, y - 1, 'T2'); cv.set(x, y - 2, 'T3')
    # eyes: two burning knot-holes under heavy brows
    for s_, ex in ((-1, FX - 6), (1, FX + 5)):
        eye = m_ell(ex + 0.5, FY - 1, 2.6, 1.6)
        for (x, y) in eye:
            cv.set(x, y, 'T0')
        for (x, y) in eye:
            if (x, y - 1) in eye and (x, y + 1) in eye or abs(x - ex) < 1:
                cv.set(x, y, 'Y2')
        cv.set(ex, FY - 1, 'Y4'); cv.set(ex + 1, FY - 1, 'Y3'); cv.set(ex - s_, FY - 1, 'Y3')
        # a heavy brow slanting down to the middle
        for i in range(6):
            x = ex - 3 + i
            y = FY - 4 + (i * s_ + (3 if s_ < 0 else -2)) // 3
            cv.set(x, y, 'T0'); cv.set(x, y - 1, 'T3')
    cv.line(FX, FY - 6, FX, FY + 1, 'T0')                 # a furrow down the brow
    light(cv, FX + 0.5, FY + 7, 13, 11, GLOW, power=2.2, steps=3,
          pred=lambda x, y: (x, y) not in hollow and cv.get(x, y) not in ('Y3', 'Y4'))
    # near roots over the trunk base
    for pts, f in zip(tubes, far):
        if not f:
            shade_tube(cv, pts, nz=nz)
    # glow catching the near roots' tops close to the trunk
    light(cv, FX + 0.5, FY + 14, 16, 8, {'T4': 'Y2', 'T3': 'Y1', 'T2': 'Y1'}, power=2.0, steps=2)
    # moss draped on the root arches
    for pts in tubes:
        for i in range(4, len(pts) - 6, 3):
            x, y, r = pts[i]
            if hashf(i, int(x), 4) < 0.5:
                ln = 1 + int(hashf(i, 2, 4) * 4)
                for j in range(ln):
                    cv.set(x, y + r + j, 'O1' if j < ln - 1 else 'O2')
    # thin prop roots dropping from the arches straight into the water
    for pts in tubes[:10]:
        for i in (14,):
            x, y, r = pts[i]
            if y > WL - 4:
                continue
            xx = x + (2 if hashf(i, int(x), 3) < 0.5 else -2)
            for yy in range(int(y + r), WL + 2):
                cv.set(xx, yy, 'T2' if yy < WL - 6 else 'T1')
                cv.set(xx + 1, yy, 'T0')
            cv.hline(xx - 2, xx + 3, WL + 1, 'M1')
    # rings where the roots meet the water
    for pts in tubes:
        for (x, y, r) in pts:
            if abs(y - (WL + 0.5)) < 0.6 or (y > WL and abs(y - (WL + 6)) < 0.6):
                cv.hline(x - r - 2, x + r + 2, int(y) + 1, 'M1')
                break

    # ------------------------------------------------------------ webs strung between the roots
    web(cv, TX - 26, 36, [(TX - 20, 30), (TX - 14, 40), (TX - 22, 46), (TX - 34, 44), (TX - 38, 34),
                           (TX - 30, 26)], rings=4)
    web(cv, TX + 26, 34, [(TX + 20, 28), (TX + 32, 25), (TX + 38, 34), (TX + 34, 44), (TX + 22, 46),
                           (TX + 15, 38)], rings=4)
    web(cv, TX - 50, 33, [(TX - 46, 27), (TX - 42, 36), (TX - 50, 42), (TX - 57, 36), (TX - 54, 28)], rings=3)
    for (x, y) in ((TX - 24, 33), (TX - 29, 40), (TX + 24, 31), (TX + 30, 38), (TX - 49, 31)):
        cv.set(x, y, 'Y3')                                 # dew catching the glow
    # a big spider dropping on its thread under the left arch
    SPX, SPY = TX + 26, 35
    body = m_ell(SPX, SPY, 2.0, 2.4) | m_ell(SPX, SPY - 3, 1.3, 1.2)
    for (x, y) in body:
        cv.set(x, y, 'T0')
    cv.set(SPX - 1, SPY - 2, 'T2')
    for s in (-1, 1):
        for (a, b, c) in (((SPX + s, SPY - 2), (SPX + s * 4, SPY - 5), (SPX + s * 6, SPY - 2)),
                          ((SPX + s, SPY - 1), (SPX + s * 5, SPY - 2), (SPX + s * 6, SPY + 1)),
                          ((SPX + s, SPY), (SPX + s * 4, SPY + 1), (SPX + s * 5, SPY + 4)),
                          ((SPX + s, SPY + 1), (SPX + s * 3, SPY + 3), (SPX + s * 3, SPY + 6))):
            for i in range(9):
                p = bez(a, b, c, i / 8.0)
                cv.set(p[0], p[1], 'T0')
    cv.set(SPX - 1, SPY - 3, 'Y3'); cv.set(SPX + 1, SPY - 3, 'Y3')
    # ------------------------------------------------------------ a great moth on the right root
    MX_, MY_ = TX + 41, 47
    for s in (-1, 1):
        wing = m_poly([(MX_, MY_ - 1), (MX_ + s * 8, MY_ - 8), (MX_ + s * 11, MY_ - 4), (MX_ + s * 8, MY_ + 1)])
        wing2 = m_poly([(MX_, MY_), (MX_ + s * 7, MY_ + 2), (MX_ + s * 6, MY_ + 6), (MX_ + s * 1, MY_ + 3)])
        ww = wing | wing2
        for (x, y) in ww:
            k = 'M1'
            if (x, y - 1) not in ww or (x + s, y) not in ww:
                k = 'M2'
            elif (x, y) in wing2 or abs(x - MX_) < 2:
                k = 'T3'
            if (x + 2 * y) % 5 == 0 and k == 'M1':
                k = 'T3'
            cv.set(x, y, k)
        ex = MX_ + s * 6
        cv.set(ex, MY_ - 4, 'Y3'); cv.set(ex + s, MY_ - 4, 'Y1'); cv.set(ex, MY_ - 3, 'Y1')
        cv.set(MX_ + s * 2, MY_ - 3, 'T1')
        cv.line(MX_, MY_ - 2, MX_ + s * 3, MY_ - 6, 'T4')      # feathered antennae
    cv.vline(MX_, MY_ - 2, MY_ + 4, 'T0')
    # ------------------------------------------------------------ fireflies
    for i in range(26):
        x = rng.uniform(60, 190)
        y = rng.uniform(14, 60)
        k = cv.get(x, y)
        if k in ('Y2', 'Y3', 'Y4'):
            continue
        cv.set(x, y, 'Q1')
        if i % 3 == 0:
            light(cv, x + 0.5, y + 0.5, 2.6, 2.6, {k2: 'O2' for k2 in ('T1', 'T0', 'A0', 'A1', 'F1', 'V1', 'V2', 'O1')},
                  power=1, steps=1)
            cv.set(x, y, 'Q1')
    for (x, y) in ((40, 40), (52, 36), (30, 44), (76, 30)):
        cv.set(x, y, 'Q1')
    # glow of the hollow in the water
    for y in range(WL + 1, H):
        if y % 2:
            continue
        d = y - WL
        for x in range(FX - 4 - d // 3, FX + 5 + d // 3):
            s = hashf(x // 2, y, 5)
            if s < 0.5 - d * 0.02 and cv.get(x, y) in ('A0', 'A1', 'A2', 'V1', 'V2', 'M1'):
                cv.set(x, y, 'Y2' if d < 8 else 'Y1')
    return cv
