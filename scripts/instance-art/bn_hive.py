"""The Hollow Hive: a colossal hollow tree riddled with glowing amber cells, webs and wings."""
import random, math
from engine import *

W, H = 192, 72
TX = 148          # trunk axis

PAL = {
    # night sky and moon
    'K0': '#0a1117', 'K1': '#0f1d27', 'K2': '#162c3a', 'K3': '#213f52',
    'MO': '#dfeee4', 'MH': '#7fa4a6',
    # far forest, mist
    'F0': '#0c171c', 'F1': '#13252b', 'MI': '#2b4a52',
    # bark, moonlit from the left
    'B0': '#0c0b0f', 'B1': '#1d191e', 'B2': '#31292c', 'B3': '#4b403d', 'B4': '#727a70',
    # wax and honey light
    'X1': '#4f2810', 'X2': '#874616', 'H1': '#bb6a1c', 'H2': '#ec9d2c', 'H3': '#ffd463',
    'H4': '#fff6c0',
    # silk
    'WB': '#a5bfc0', 'WD': '#4c6b71',
    # forest floor
    'G0': '#0d1812', 'G1': '#1a2c21',
}


CELL = {0: (1, 3), 1: (0, 4), 2: (0, 4), 3: (1, 3)}     # pointy hex interior, 5 x 4


def cell_at(x, y):
    """(i, j, dx, dy) of the hex cell containing pixel (x, y), or None for a wax wall."""
    j = y // 4
    dy = y - j * 4
    off = 3 if j % 2 else 0
    i = (x - off) // 6
    dx = x - off - i * 6
    a, b = CELL[dy]
    if a <= dx <= b:
        return (i, j, dx, dy)
    return None


def honeycomb(cv, mask, glow, seed):
    """Fill mask with hex cells: 1px wax walls; cells glowing, capped or empty."""
    for (x, y) in mask:
        c = cell_at(x, y)
        g = glow(x, y)
        if c is None:
            cv.set(x, y, 'X1' if g > 0.45 else 'B0')
            continue
        i, j, dx, dy = c
        r = hashf(i, j, seed)
        core = dy in (1, 2) and 1 <= dx <= 3
        hi = dy == 1 and dx == 1
        if r < 0.16:
            k = 'X2' if core else 'X1'                      # capped cell
        elif r > 0.94:
            k = 'B0' if core else 'B1'                      # empty
        else:
            lvl = g * (0.7 + 0.5 * r)
            if lvl > 0.75:
                k = ('H4' if hi else 'H3') if core else 'H2'
            elif lvl > 0.45:
                k = ('H3' if hi else 'H2') if core else 'H1'
            elif lvl > 0.25:
                k = 'H1' if core else 'X2'
            else:
                k = 'X2' if core else 'X1'
        cv.set(x, y, k)


def draw():
    cv = Cv(PAL, 'K0', W, H)
    nz = vnoise(21)

    # ------------------------------------------------------------ sky, moon
    bands(cv, [(0, 'K0'), (12, 'K1'), (24, 'K2'), (34, 'K3')], y1=56, tw=4)
    MX, MY = 46, 15
    for y in range(MY - 12, MY + 13):
        for x in range(MX - 12, MX + 13):
            d = math.hypot(x + 0.5 - MX, y + 0.5 - MY)
            if 8 < d < 11.5 and cv.get(x, y) in ('K0', 'K1', 'K2') and bay(x, y) < q4((11.5 - d) / 3.5) * 0.5:
                cv.set(x, y, 'K3')
    cv.disc(MX, MY, 7, 'MH')
    cv.disc(MX - 0.6, MY - 0.6, 6.2, 'MO')
    for (x, y) in ((MX + 2, MY + 1), (MX + 3, MY + 1), (MX + 2, MY + 2), (MX - 3, MY + 3),
                   (MX + 4, MY - 3), (MX - 1, MY - 2)):
        cv.set(x, y, 'MH')
    # clouds crossing the moon
    for (cx, cy, hl) in ((40, 20, 22), (64, 9, 16), (20, 27, 14)):
        for x in range(cx - hl, cx + hl):
            u = (x - cx) / hl
            t = 1.6 * (1 - u * u) + 0.3 * math.sin(x * 0.9)
            if t < 0.4:
                continue
            for y in range(int(cy - t), int(cy + 1)):
                cv.set(x, y, 'K2')
            cv.set(x, cy - int(t), 'MI' if abs(x - MX) < 14 else 'K3')
    # ------------------------------------------------------------ far forest, two layers with mist
    for layer, (base, amp, k, seed) in enumerate(((40, 7, 'F1', 3), (48, 6, 'F0', 8))):
        r = random.Random(seed)
        crowns = []
        x = -4
        while x < W + 6:
            crowns.append((x, base - r.uniform(0, amp), r.uniform(3, 6)))
            x += r.uniform(4, 8)
        for y in range(0, 60):
            for x in range(W):
                inside = False
                for (cx, cy, rr) in crowns:
                    if abs(x - cx) <= rr and y >= cy + abs(x - cx) * 1.6 - rr * 0.4:
                        inside = True
                        break
                if inside:
                    cv.set(x, y, k)
        for y in range(base + 2, base + 8):
            for x in range(W):
                if cv.get(x, y) == k and bay(x, y) < q4((y - base - 2) / 6.0) * 0.5:
                    cv.set(x, y, 'MI' if layer == 0 else 'F1')
    # ------------------------------------------------------------ ground
    for y in range(54, H):
        for x in range(W):
            k = 'G0'
            if y < 56 and (x // 3 + y) % 2 == 0:
                k = 'F0'
            cv.set(x, y, k)
    for x in range(W):
        if hashf(x, 0, 2) < 0.4:
            cv.set(x, 54, 'G1')

    # ------------------------------------------------------------ a dead snag carrying one web corner
    for y in range(18, 60):
        x = 86 + int((y - 18) * 0.08)
        cv.set(x, y, 'B2'); cv.set(x + 1, y, 'B1')
        if y > 52:
            cv.set(x - 1, y, 'B1'); cv.set(x + 2, y, 'B0')
    for (a, b) in (((86, 26), (80, 21)), ((87, 34), (93, 29)), ((86, 18), (84, 13))):
        cv.line(a[0], a[1], b[0], b[1], 'B2')

    # ------------------------------------------------------------ the colossal tree
    trunk = set()
    edges = {}
    wl = smooth(mpd(random.Random(5), H + 1, 2.5, 0.6), 2)
    wr = smooth(mpd(random.Random(6), H + 1, 2.5, 0.6), 2)
    for y in range(0, H):
        flare = max(0, y - 52) ** 1.25 * 0.45
        xl = TX - 23 - flare * 1.1 + wl[y] - 2 * math.sin(y / 9.0)
        xr = TX + 23 + flare + wr[y] + 2 * math.sin(y / 11.0 + 1)
        edges[y] = (xl, xr)
        for x in range(int(xl), int(xr) + 1):
            trunk.add((x, y))
    # great limbs leaving the frame
    limbs = m_bez((TX - 10, 14), (TX - 26, 4), (TX - 44, -4), 7, 3.5) | \
        m_bez((TX + 12, 10), (TX + 30, 4), (TX + 48, -2), 6.5, 3)
    trunk |= limbs
    # roots
    for (x0, y0, x1, y1, r) in ((TX - 22, 60, TX - 44, 70, 3.2), (TX + 24, 60, TX + 44, 69, 3.0),
                                (TX - 12, 64, TX - 26, 73, 3.0), (TX + 14, 64, TX + 30, 74, 3.0)):
        trunk |= m_seg(x0, y0, x1, y1, r, 1.4)
    U = run_u(trunk)
    for (x, y) in trunk:
        u = U[(x, y)]
        groove = nz(x / 1.7, y / 14.0)
        k = 'B1'
        if u < 0.06:
            k = 'B4'
        elif u < 0.16:
            k = 'B3'
        elif u < 0.34:
            k = 'B2'
        elif u > 0.86:
            k = 'B0'
        if groove > 0.66:
            k = {'B4': 'B3', 'B3': 'B2', 'B2': 'B1', 'B1': 'B0', 'B0': 'B0'}[k]
        elif groove < 0.22 and k == 'B1':
            k = 'B2'
        cv.set(x, y, k)

    # ------------------------------------------------------------ honeycomb breaking through the bark
    patches = [m_ell(TX + 3, 48, 15, 12) | m_ell(TX - 7, 56, 9, 8),
               m_ell(TX + 9, 20, 9, 8) | m_ell(TX + 3, 27, 5, 4),
               m_ell(TX - 15, 33, 5, 6)]
    allp = set()
    for i, p in enumerate(patches):
        p = {q for q in p if q in trunk}
        nzp = vnoise(40 + i)
        p = {q for q in p if nzp(q[0] / 3.0, q[1] / 3.0) > 0.25 or
             math.hypot(q[0] - TX, q[1] - 52) < 12}
        allp |= p
    HXc, HYc = TX + 0.5, 54

    def glow(x, y):
        return max(0.38, 1 - math.hypot(x - HXc, (y - HYc) * 1.1) / 34.0)
    honeycomb(cv, allp, glow, 7)
    # broken bark lip around the patches
    for (x, y) in list(allp):
        for (dx, dy) in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            q = (x + dx, y + dy)
            if q in trunk and q not in allp:
                cv.set(q[0], q[1], 'B3' if dy < 0 or dx < 0 else 'B0')

    # ------------------------------------------------------------ the hollow: the way in
    for y in range(40, 68):
        for x in range(TX - 10, TX + 12):
            dx = (x + 0.5 - (TX + 1)) / 9.5
            dy = (y + 0.5 - 52) / 12.0
            if dy < 0 and dx * dx + dy * dy > 1:
                continue
            if abs(dx) > 1 or y > 65:
                continue
            t = (y - 40) / 26.0
            v = t * 0.9 + (1 - abs(dx)) * 0.4
            if v > 1.0:
                k = 'H4' if bay(x, y) < q4((v - 1.0) * 5) else 'H3'
            elif v > 0.75:
                k = 'H3' if bay(x, y) < q4((v - 0.75) * 4) else 'H2'
            elif v > 0.5:
                k = 'H2' if bay(x, y) < q4((v - 0.5) * 4) else 'H1'
            elif v > 0.25:
                k = 'H1' if bay(x, y) < q4((v - 0.25) * 4) else 'X1'
            else:
                k = 'X1' if bay(x, y) < q4(v * 4) else 'B0'
            cv.set(x, y, k)
    # receding arches of comb: a tunnel into the hive
    for (sc, k) in ((0.72, 'X2'), (0.46, 'H1')):
        rx, ry = 9.5 * sc, 12 * sc
        cy = 52 + (1 - sc) * 9
        for y in range(40, 66):
            for x in range(TX - 10, TX + 12):
                dx = (x + 0.5 - (TX + 1)) / rx
                dy = (y + 0.5 - cy) / ry
                e = (dy < 0 and 0.8 < dx * dx + dy * dy <= 1) or (dy >= 0 and 0.86 < abs(dx) <= 1 and y < 66)
                if e:
                    cv.set(x, y, k)
    # rim of the hollow and dripping honey
    for y in range(40, 66):
        for x in range(TX - 12, TX + 14):
            dx = (x + 0.5 - (TX + 1)) / 9.5
            dy = (y + 0.5 - 52) / 12.0
            inside = (dy >= 0 and abs(dx) <= 1) or dx * dx + dy * dy <= 1
            if inside:
                continue
            dx2 = (x + 0.5 - (TX + 1)) / 11.0
            dy2 = (y + 0.5 - 52) / 13.5
            if (dy >= 0 and abs(dx2) <= 1) or dx2 * dx2 + dy2 * dy2 <= 1:
                cv.set(x, y, 'B3' if x < TX else 'B0')
    for (x, ln) in ((TX - 6, 4), (TX - 3, 7), (TX + 1, 3), (TX + 4, 6), (TX + 7, 3), (TX - 8, 2)):
        top = 40 + int(12 * (1 - math.sqrt(max(0, 1 - ((x + 0.5 - TX - 1) / 9.5) ** 2))))
        for i in range(ln):
            cv.set(x, top + i, 'H3' if i < ln - 1 else 'H4')
        cv.set(x, top + ln, 'H2')
    # threshold of wax and roots
    for x in range(TX - 10, TX + 12):
        cv.set(x, 66, 'X2' if x % 3 else 'H1')
        cv.set(x, 67, 'X1')

    # warm spill on bark and ground
    warm = {'B1': 'X1', 'B2': 'X2', 'B3': 'H1', 'G0': 'X1', 'G1': 'X2', 'B0': 'B1', 'F0': 'X1'}
    light(cv, TX + 1, 64, 30, 10, warm, power=1.5, steps=4,
          pred=lambda x, y: (x, y) not in allp)

    # ------------------------------------------------------------ a giant moth asleep on the bark
    MX2, MY2 = TX + 24, 25
    wings = m_ell(MX2 - 6, MY2 - 4, 10, 4.5) | m_ell(MX2 + 7, MY2 - 4, 10, 4.5) | \
        m_ell(MX2 - 5, MY2 + 4, 6, 4) | m_ell(MX2 + 6, MY2 + 4, 6, 4)
    for (x, y) in wings:
        if abs(x - MX2) < 1.5:
            continue
        under = cv.get(x, y)
        k = 'MI' if under in ('K0', 'K1', 'K2', 'K3', 'F0', 'F1') else 'WD'
        if bay(x, y) < 0.5:
            k = 'WD' if k == 'MI' else 'B3'
        if (x, y - 1) not in wings or (x, y + 1) not in wings:
            k = 'WB' if y < MY2 else 'WD'
        cv.set(x, y, k)
    for (a, b) in (((MX2, MY2 - 1), (MX2 - 14, MY2 - 6)), ((MX2, MY2 - 1), (MX2 + 15, MY2 - 6)),
                   ((MX2, MY2), (MX2 - 9, MY2 + 6)), ((MX2, MY2), (MX2 + 9, MY2 + 6)),
                   ((MX2, MY2 - 1), (MX2 - 8, MY2 - 8)), ((MX2, MY2 - 1), (MX2 + 9, MY2 - 8))):
        cv.line(a[0], a[1], b[0], b[1], 'B0')
    for (x, y) in ((MX2 - 8, MY2 - 4), (MX2 + 9, MY2 - 4)):          # eye-spots
        cv.disc(x, y, 1.6, 'H1'); cv.set(x, y, 'H3')
    body = m_ell(MX2 + 0.5, MY2 + 1, 1.6, 6)
    cyl(cv, body, ('B3', 'B2', 'B1', 'B0'), cuts=(0.3, 0.6, 0.85))
    cv.set(MX2 - 1, MY2 - 6, 'B2'); cv.set(MX2 - 2, MY2 - 7, 'B2')
    cv.set(MX2 + 2, MY2 - 6, 'B2'); cv.set(MX2 + 3, MY2 - 7, 'B2')

    # ------------------------------------------------------------ the great web
    WX, WY = 104, 24
    anchors = [(86, 19), (87, 31), (90, 46), (100, 54), (116, 48), (128, 34), (TX - 18, 18),
               (122, 4), (106, 0), (92, 6)]
    spokes = []
    for (ax, ay) in anchors:
        spokes.append((ax, ay))
        cv.line(WX, WY, ax, ay, 'WD')
    angs = sorted(anchors, key=lambda p: math.atan2(p[1] - WY, p[0] - WX))
    for ring in (3, 6, 9, 12, 15, 18):
        pts = []
        for (ax, ay) in angs:
            L = math.hypot(ax - WX, ay - WY)
            f = min(1.0, ring / L)
            pts.append((WX + (ax - WX) * f, WY + (ay - WY) * f + 0.5))
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            if hashf(ring, i, 4) < 0.15:
                continue                                    # torn strands
            cv.line(a[0], a[1], b[0], b[1], 'WD' if ring > 6 else 'WB')
    # moon-glints on the silk nearest the moon
    for (x, y) in ((WX - 3, WY - 1), (WX - 7, WY - 5), (WX - 10, WY + 2), (WX + 2, WY - 9)):
        cv.set(x, y, 'WB')
    # a wrapped victim in the web
    cocoon = m_ell(WX + 7.5, WY + 9, 2.2, 3.6)
    cyl(cv, cocoon, ('WB', 'WB', 'WD', 'MI'), cuts=(0.4, 0.7, 0.9))
    cv.set(WX + 7, WY + 7, 'WD'); cv.set(WX + 8, WY + 10, 'WD')
    # a spider descending on a thread
    cv.vline(WX - 3, WY, WY + 14, 'WD')
    for (x, y) in ((WX - 3, WY + 15), (WX - 4, WY + 15), (WX - 2, WY + 15), (WX - 3, WY + 16),
                   (WX - 5, WY + 14), (WX - 1, WY + 14), (WX - 5, WY + 17), (WX - 1, WY + 17)):
        cv.set(x, y, 'B0')
    cv.set(WX - 3, WY + 15, 'H2')

    # ------------------------------------------------------------ webbing sheeted across the roots
    for (x0, y0, x1, y1) in ((TX + 22, 58, TX + 40, 68), (TX - 24, 60, TX - 40, 69)):
        for i in range(0, 14, 2):
            t = i / 14
            cv.line(x0 + (x1 - x0) * t, y0 - 6 + 8 * t, x1, y1 - 8 + 4 * t, 'WD')
    # ------------------------------------------------------------ wasps on the wing, motes
    for (x, y) in ((70, 26), (78, 31), (62, 33)):
        cv.set(x, y, 'B0'); cv.set(x + 1, y, 'H1'); cv.set(x + 2, y, 'B0'); cv.set(x - 1, y + 1, 'B0')
        cv.set(x, y - 1, 'WB'); cv.set(x + 1, y - 2, 'WD')
    for (x, y) in ((126, 58), (134, 50), (168, 52), (120, 44), (172, 62), (160, 70), (130, 66)):
        cv.set(x, y, 'H3')
    return cv
