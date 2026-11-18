"""The second region's map, "The Gloaming Isles": a navigator's night sea chart, 256 x 144, in
three progress states. Indigo chart paper with a worn graduated border, silver-cyan ink, rhumb
lines from a compass rose, soundings and shoals, eight island sites joined by a dotted sailing
route from the harbour.
isles-map-1: the first site reached; isles-map-4: four cleared, the fifth in progress;
isles-map-8: all cleared."""
import random, math
from engine import *

W, H = 256, 144

PAL = {
    # chart paper: border black to shoal teal
    'N0': '#060914', 'N1': '#0c1328', 'N2': '#121d3d', 'N3': '#172649', 'N4': '#1b3354',
    'N5': '#1f4462', 'N6': '#2a5f74',
    # ink: bright silver-cyan, mid, faint, rhumb-faint
    'K0': '#d6f0f4', 'K1': '#8fbccb', 'K2': '#55819a', 'K3': '#2c4670',
    # dark outline for landmarks
    'O': '#05070f',
    # land: sand, cliff, moss
    'D0': '#4a3f33', 'D1': '#7c6a4e', 'D2': '#ab9670', 'D3': '#d4c294',
    'M0': '#26382f', 'M1': '#3f5a41', 'M2': '#62804f', 'M3': '#8aa364',
    # stone
    'S0': '#3a3e52', 'S1': '#5f6680', 'S2': '#959cb4', 'S3': '#c9cedc',
    # accents
    'L1': '#2fbf6a', 'L2': '#8dffb4', 'LW': '#eafff0',              # green lamp
    'C1': '#b04a70', 'C2': '#e27a9c', 'C3': '#ffb8cc',               # coral
    'A1': '#c96a1c', 'A2': '#f1ad34', 'A3': '#ffe08a',               # lantern glow
    'B0': '#5a3a1a', 'B1': '#8a5e26', 'B2': '#c08a3a', 'B3': '#ecc46e',  # brass
    'G0': '#0f1916', 'G1': '#1c3328', 'G2': '#2d4c36', 'G3': '#4f7a4c',  # gloom tree
    'P1': '#7a5ca8', 'P2': '#b9a0e8',                                # gloom wisps / moon tint
    'Q0': '#454c78', 'Q1': '#6b74a2', 'Q2': '#a3abcf',               # storm cloud
    'Y': '#fff4a0',                                                  # lightning
    'V0': '#03050c', 'V1': '#16306a', 'V2': '#3a78b8', 'V3': '#7cc4e8',  # whirlpool
    'R1': '#a3352a', 'R2': '#e0604a',                                # pennants
    'H0': '#3a2416', 'H1': '#6b4a30', 'H2': '#9a7048',               # hulls
    'WS': '#eef4f2',                                                 # sail cloth
    'E0': '#163c3c', 'E1': '#2b6e66', 'E2': '#56a690', 'E3': '#9ad8bc',  # serpent
    'F0': '#4c5a7c', 'F1': '#7886a6', 'F2': '#a6b2cc', 'F3': '#d2dbea',  # fog
    'U1': '#2a579a', 'U2': '#62a6ea',                                # party sail blue
}

HOME = (30, 112)
SITES = [(58, 88), (96, 112), (120, 78), (88, 46), (150, 108), (160, 52), (200, 84), (226, 32)]

# sailing route control points; STOPS index HOME and the sites in ROUTE
ROUTE = [HOME, (46, 110), (50, 98), SITES[0],
         (68, 100), (80, 112), SITES[1],
         (110, 104), (110, 88), SITES[2],
         (108, 64), (100, 52), SITES[3],
         (110, 38), (132, 50), (138, 72), (142, 94), SITES[4],
         (164, 100), (176, 78), (172, 62), SITES[5],
         (178, 46), (196, 58), (204, 70), SITES[6],
         (216, 78), (226, 62), (234, 46), SITES[7]]
STOPS = [0, 3, 6, 9, 12, 17, 21, 25, 29]


def catmull(pts):
    out = []
    for i in range(len(pts) - 1):
        p0 = pts[max(0, i - 1)]; p1 = pts[i]; p2 = pts[i + 1]; p3 = pts[min(len(pts) - 1, i + 2)]
        n = max(2, int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 1.5))
        for j in range(n):
            t = j / n
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
                       (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
                       (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y, i))
    out.append((pts[-1][0], pts[-1][1], len(pts) - 2))
    return out


N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def ring(m):
    """Pixels just outside a mask (4-neighbour)."""
    out = set()
    for (x, y) in m:
        for dx, dy in N4:
            q = (x + dx, y + dy)
            if q not in m:
                out.add(q)
    return out


# ---------------------------------------------------------------- land

def blob(cx, cy, rx, ry, seed, rough=0.22):
    nz = vnoise(seed)
    m = set()
    for y in range(int(cy - ry * 1.5) - 2, int(cy + ry * 1.5) + 3):
        for x in range(int(cx - rx * 1.5) - 2, int(cx + rx * 1.5) + 3):
            d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
            d += rough * (nz(x / 3.5, y / 3.5) - 0.5) * 2
            if d < 1:
                m.add((x, y))
    return m


class Island:
    """A footprint at sea level and a top face lifted by h px; the gap shows as a cliff."""
    def __init__(self, cx, cy, rx, ry, h, seed, moss=True, rough=0.22):
        self.foot = blob(cx, cy, rx, ry, seed, rough)
        self.h = h
        self.top = {(x, y - h) for (x, y) in self.foot}
        self.all = self.foot | self.top
        self.moss = moss
        self.seed = seed


def mainland():
    nz = vnoise(31)
    m = set()
    for y in range(78, H):
        cl = 14 + (y - 78) * 0.42 + 12 * math.exp(-((y - 113) / 11.0) ** 2) + 5 * (nz(1, y / 6.0) - 0.5)
        cl -= 6 * math.exp(-((y - 96) / 4.0) ** 2)                  # a small cove
        for x in range(0, int(cl)):
            m.add((x, y))
    return m


def draw_island(cv, isl):
    nz = vnoise(isl.seed + 500)
    # cliff face: the footprint, hatched
    for (x, y) in isl.foot:
        if (x, y) in isl.top:
            continue
        k = 'D0'
        if x % 2 == 0:
            k = 'D1'
        if (x, y + 1) not in isl.foot:
            k = 'D0'
        cv.set(x, y, k)
    # top face: sand rim, moss heart
    edge = ring(isl.top)
    for (x, y) in isl.top:
        near = any((x + dx, y + dy) in edge for dx in (-1, 0, 1) for dy in (-1, 0, 1))
        if not isl.moss or near:
            k = 'D2'
            if (x, y - 1) in edge or (x - 1, y) in edge:
                k = 'D3'
        else:
            n = nz(x / 3.0, y / 3.0)
            k = 'M1' if n < 0.45 else ('M2' if n < 0.7 else 'M1')
            if n > 0.6 and bay(x, y) < 0.5:
                k = 'M3' if (x - 1, y) in edge or (x, y - 1) in edge else 'M2'
            if (x + 1, y) in edge or (x, y + 1) in edge:
                k = 'M0'
        cv.set(x, y, k)
    # a dark seam where the top face meets the cliff
    for (x, y) in isl.top:
        if (x, y + 1) not in isl.top and (x, y + 1) in isl.foot:
            cv.set(x, y + 1, 'D0' if isl.h > 1 else 'D1')
    # silver ink coast
    for (x, y) in ring(isl.all):
        cv.set(x, y, 'K1')


def draw_mainland(cv, land):
    nz = vnoise(32)
    edge = ring(land)
    for (x, y) in land:
        near = any((x + dx, y + dy) in edge for dx in (-2, -1, 0, 1, 2) for dy in (-1, 0, 1))
        n = nz(x / 4.0, y / 4.0)
        if near:
            k = 'D2' if (x + y) % 5 else 'D3'
        else:
            k = 'M1' if n < 0.5 else 'M2'
            if n > 0.66 and bay(x, y) < 0.5:
                k = 'M3'
            if n < 0.28:
                k = 'M0' if bay(x, y) < 0.5 else 'M1'
        cv.set(x, y, k)
    for (x, y) in edge:
        cv.set(x, y, 'K1')
    # hachured hills inland
    for (hx, hy) in ((5, 126), (12, 136), (4, 104), (16, 140)):
        for i in range(-3, 4):
            cv.set(hx + i, hy - (3 - abs(i)), 'M0')
            if i < 0:
                cv.set(hx + i, hy - (3 - abs(i)) + 1, 'M3')


# ---------------------------------------------------------------- sea

def sea(cv, landall):
    nz = vnoise(11)
    dist = {}
    frontier = []
    for (x, y) in landall:
        for dx, dy in N4:
            q = (x + dx, y + dy)
            if q not in landall and 0 <= q[0] < W and 0 <= q[1] < H and q not in dist:
                dist[q] = 1
                frontier.append(q)
    cur = frontier
    while cur:
        nxt = []
        for (x, y) in cur:
            for dx, dy in N4:
                q = (x + dx, y + dy)
                if 0 <= q[0] < W and 0 <= q[1] < H and q not in landall and q not in dist:
                    dist[q] = dist[(x, y)] + 1
                    nxt.append(q)
        cur = nxt
    for y in range(H):
        for x in range(W):
            if (x, y) in landall:
                continue
            d = dist.get((x, y), 99)
            n = nz(x / 18.0, y / 12.0)
            k = 'N2'
            if n > 0.62 and bay(x, y) < q4((n - 0.62) * 6):
                k = 'N3'
            if n < 0.3 and bay(x, y) < 0.5:
                k = 'N1'
            if d <= 3:
                k = 'N6' if d <= 1 else 'N5'
            elif d <= 7:
                k = 'N5' if bay(x, y) < q4((7.5 - d) / 4.5) else 'N4'
            elif d <= 11:
                k = 'N4' if bay(x, y) < q4((11.5 - d) / 4.5) else k
            if d == 5 and (x + y) % 2 == 0:
                k = 'K2'                                     # dotted depth contour
            if d == 10 and (x * 3 + y) % 5 == 0:
                k = 'K3'
            cv.set(x, y, k)
    return dist


def rhumbs(cv, cx, cy, landall):
    for i in range(32):
        a = i * math.pi / 16
        for t in range(14, 340):
            x = cx + math.cos(a) * t; y = cy + math.sin(a) * t
            if not (0 <= x < W and 0 <= y < H):
                break
            if (int(x), int(y)) in landall:
                continue
            if t % 2 == 0 and cv.get(x, y) in ('N1', 'N2', 'N3', 'N4'):
                cv.set(x, y, 'K3' if i % 2 == 0 else ('K3' if t % 4 == 0 else cv.get(x, y)))


DIG = {
    '0': ["###", "#.#", "#.#", "###"], '1': [".#.", "##.", ".#.", "###"],
    '2': ["##.", "..#", ".#.", "###"], '3': ["###", ".##", "..#", "###"],
    '4': ["#.#", "###", "..#", "..#"], '5': ["###", "##.", "..#", "##."],
    '6': ["#..", "###", "#.#", "###"], '7': ["###", "..#", ".#.", ".#."],
    '8': ["###", "###", "#.#", "###"], '9': ["###", "###", "..#", "..#"],
}


def numeral(cv, x, y, s, k):
    for ch in s:
        for gy, row in enumerate(DIG[ch]):
            for gx, b in enumerate(row):
                if b == '#':
                    cv.set(x + gx, y + gy, k)
        x += 4


def soundings(cv, dist, avoid):
    r = random.Random(17)
    placed = []
    tries = 0
    while len(placed) < 22 and tries < 4000:
        tries += 1
        x = r.randint(8, W - 16); y = r.randint(8, H - 12)
        ok = all(dist.get((x + dx, y + dy), 0) > 4 for dx in (-1, 8) for dy in (-1, 5))
        ok = ok and all(abs(x - px) > 14 or abs(y - py) > 10 for (px, py) in placed)
        ok = ok and all(math.hypot(x + 3 - ax, y + 2 - ay) > ar for (ax, ay, ar) in avoid)
        if not ok:
            continue
        d = min(dist.get((x, y), 99), 30)
        val = str(max(2, d * 2 + r.randint(-3, 9)))
        numeral(cv, x, y, val, 'K3' if len(placed) % 3 else 'K2')
        placed.append((x, y))


def shoal(cv, cx, cy, n, seed):
    r = random.Random(seed)
    for i in range(n):
        x = cx + r.gauss(0, 4); y = cy + r.gauss(0, 2.2)
        cv.set(x, y, 'K2' if i % 3 else 'K1')


def rock_mark(cv, x, y):
    """Chart symbol for a rock awash: a small plus with dots."""
    cv.set(x, y, 'K1'); cv.set(x - 1, y, 'K2'); cv.set(x + 1, y, 'K2'); cv.set(x, y - 1, 'K2'); cv.set(x, y + 1, 'K2')
    cv.set(x - 1, y - 1, 'K3'); cv.set(x + 1, y + 1, 'K3'); cv.set(x + 1, y - 1, 'K3'); cv.set(x - 1, y + 1, 'K3')


def wave(cv, x, y, k='K2'):
    cv.set(x, y, k); cv.set(x + 1, y - 1, k); cv.set(x + 2, y, k); cv.set(x + 3, y - 1, k)


# ---------------------------------------------------------------- chart decoration

def compass(cv, cx, cy):
    r = 12
    for t in range(90):
        a = t / 90 * 2 * math.pi
        cv.set(cx + math.cos(a) * 9.5, cy + math.sin(a) * 9.5, 'K2')
    for t in range(48):
        a = t / 48 * 2 * math.pi
        if t % 2 == 0:
            cv.set(cx + math.cos(a) * 11.5, cy + math.sin(a) * 11.5, 'K1')
    for i in range(16):
        a = i * math.pi / 8 - math.pi / 2
        cv.set(cx + math.cos(a) * 13, cy + math.sin(a) * 13, 'K2')
    for pass_ in (2, 1, 0):
        for i in range(16):
            lvl = 0 if i % 4 == 0 else (1 if i % 2 == 0 else 2)
            if lvl != pass_:
                continue
            a = i * math.pi / 8 - math.pi / 2
            ln = (r, r * 0.62, r * 0.4)[lvl]
            wd = (2.8, 1.8, 1.0)[lvl]
            for t in range(int(ln * 4)):
                d = t / 4.0
                w = (ln - d) / ln * wd
                for s in (-1, 1):
                    for k in range(int(w) + 1):
                        px = cx + math.cos(a) * d + math.cos(a + math.pi / 2) * s * k * 0.9
                        py = cy + math.sin(a) * d + math.sin(a + math.pi / 2) * s * k * 0.9
                        if lvl == 0:
                            c = 'K0' if s < 0 else 'K2'
                        elif lvl == 1:
                            c = 'K1' if s < 0 else 'K3'
                        else:
                            c = 'K2' if s < 0 else 'K3'
                        cv.set(px, py, c)
    for i in range(0, 16, 4):
        a = i * math.pi / 8 - math.pi / 2
        cv.line(cx, cy, cx + math.cos(a) * r, cy + math.sin(a) * r, 'K1')
    cv.disc(cx + 0.5, cy + 0.5, 1.6, 'N1')
    cv.set(cx, cy, 'A2')
    # north: a small gold fleur
    nx, ny = cx, cy - r - 3
    for (dx, dy) in ((0, 0), (0, -1), (0, -2), (-1, -1), (1, -1), (-2, -2), (2, -2), (-1, 1), (1, 1)):
        cv.set(nx + dx, ny + dy, 'A2' if dy < 0 else 'B2')
    cv.set(nx, ny - 3, 'A3')


def graduated_border(cv):
    """A worn chart frame: a black margin, a graduated latitude bar and a thin neatline, then
    the paper darkening toward the frame."""
    nz = vnoise(41)
    darker = {'N6': 'N5', 'N5': 'N4', 'N4': 'N3', 'N3': 'N2', 'N2': 'N1', 'N1': 'N0', 'K3': 'N1',
              'K2': 'K3', 'K1': 'K2', 'M2': 'M1', 'M1': 'M0', 'D2': 'D1', 'D3': 'D2', 'M3': 'M2'}
    for y in range(H):
        for x in range(W):
            d = min(x, y, W - 1 - x, H - 1 - y)
            if d >= 4 and d < 12:
                wn = 2.5 * nz(x / 6.0, y / 6.0)
                lvl = q4((12 - d - wn) / 8.0 * 0.75)
                if bay(x, y) < lvl:
                    k = cv.get(x, y)
                    cv.set(x, y, darker.get(k, k))
    for y in range(H):
        for x in range(W):
            d = min(x, y, W - 1 - x, H - 1 - y)
            if d <= 1:
                cv.set(x, y, 'N0')
            elif d == 2:
                along = x if (y <= 2 or y >= H - 3) else y
                cv.set(x, y, 'K1' if (along // 8) % 2 == 0 else 'N0')
            elif d == 3:
                cv.set(x, y, 'K2')
    # worn nicks in the frame
    r = random.Random(43)
    for _ in range(26):
        side = r.randint(0, 3)
        t = r.randint(4, (W if side < 2 else H) - 5)
        ln = r.randint(1, 4)
        for i in range(ln):
            if side == 0:
                cv.set(t + i, r.randint(0, 2), 'N1')
            elif side == 1:
                cv.set(t + i, H - 1 - r.randint(0, 2), 'N1')
            elif side == 2:
                cv.set(r.randint(0, 2), t + i, 'N1')
            else:
                cv.set(W - 1 - r.randint(0, 2), t + i, 'N1')
    for (x, y) in ((0, 0), (W - 4, 0), (0, H - 4), (W - 4, H - 4)):
        cv.rect(x, y, x + 4, y + 4, 'N0')
        cv.set(x + 1 + (0 if x == 0 else 1), y + 1 + (0 if y == 0 else 1), 'K2')


def scale_bar(cv, x, y, n=5, step=6):
    for i in range(n):
        cv.rect(x + i * step, y, x + (i + 1) * step, y + 2, 'K1' if i % 2 == 0 else 'N0')
    cv.hline(x - 1, x + n * step, y - 1, 'K2'); cv.hline(x - 1, x + n * step, y + 2, 'K2')
    cv.vline(x - 1, y - 1, y + 2, 'K2'); cv.vline(x + n * step, y - 1, y + 2, 'K2')
    for i in range(n + 1):
        cv.set(x + i * step, y - 2, 'K2')


def serpent(cv, x, y):
    """A sea serpent rising through the chart: three scaled coils and a crested head."""
    for (hx, hr) in ((-2, 3.6), (10, 4.6), (21, 3.8)):
        outer = {p for p in m_ell(x + hx, y, hr, hr * 1.25) if p[1] <= y}
        inner = m_ell(x + hx, y + 0.5, hr - 1.9, (hr - 1.9) * 1.25)
        m = outer - inner
        for (px, py) in m:
            k = 'E1'
            if (px, py - 1) not in m and px <= x + hx:
                k = 'E3'
            elif px > x + hx + 1:
                k = 'E0'
            elif (px + py) % 2 == 0 and px <= x + hx:
                k = 'E2'
            cv.set(px, py, k)
        for (px, py) in ring(outer):
            if py <= y:
                cv.set(px, py, 'O')
        for (px, py) in inner:
            if py <= y:
                cv.set(px, py, cv.get(px, py + 3) or 'N2')
        cv.set(x + hx, y - hr * 1.25 - 1, 'R2')
        cv.set(x + hx - 1, y - hr * 1.25, 'R1')
    head = ["...OOOO....",
            "..OEEEEO...",
            ".OEWEEEEO..",
            "OEEEEEEEEOO",
            "OEEEOORRRRO",
            "OEEEOOEEEEO",
            "OEEOO.OOOO.",
            ".OEEO......",
            ".OEEO......",
            ".OEEO......"]
    hx, hy = x + 27, y - 10
    stamp(cv, hx, hy, head, {'O': 'O', 'E': 'E1', 'W': 'Y', 'R': 'C3'})
    cv.set(hx + 3, hy + 1, 'E3'); cv.set(hx + 4, hy + 1, 'E3'); cv.set(hx + 2, hy + 3, 'E2')
    cv.set(hx + 2, hy + 7, 'E2'); cv.set(hx + 2, hy + 8, 'E2')
    for (dx, dy) in ((5, -1), (6, -2), (7, -1), (4, -2), (8, -1)):
        cv.set(hx + dx, hy + dy, 'R2' if dy == -2 else 'R1')
    for i in range(-5, 34, 2):
        if cv.get(x + i, y + 1) in ('N1', 'N2', 'N3', 'N4', 'N5', 'K3', 'K2'):
            cv.set(x + i, y + 1, 'K0' if i % 4 == 1 else 'K2')


def galleon(cv, x, y):
    """A small chart-ink galleon under full sail, x,y = waterline centre."""
    rows = ["......K..........",
            "......KR.........",
            "...KK.K..K.......",
            "..KWWKKWWKKW.....",
            "..KWWWKWWWKWW....",
            "..KWWWKWWWKWWW...",
            "...KWWKKWWKWW....",
            "....KKKKKKKK.....",
            "OHHHHHHHHHHHHHO..",
            ".OHAHHAHHAHHHO...",
            "..OOOOOOOOOOO...."]
    stamp(cv, x - 8, y - 10, rows, {'K': 'K1', 'W': 'WS', 'R': 'R2', 'O': 'O', 'H': 'H1', 'A': 'A2'})
    for (dx, dy) in ((-8, -2), (-7, -2)):
        cv.set(x + dx, y + dy, 'H2')
    for i in range(-10, 10):
        if i % 3 != 2:
            cv.set(x + i, y + 1, 'K0' if i % 3 == 0 else 'K2')
    cv.set(x + 9, y, 'K2'); cv.set(x + 11, y + 1, 'K2'); cv.set(x - 12, y + 1, 'K2')


# ---------------------------------------------------------------- harbour (HOME)

def harbour(cv, x, y):
    def town():
        # quay along the shore
        cv.rect(x - 8, y + 3, x + 7, y + 5, 'S1')
        cv.hline(x - 8, x + 6, y + 3, 'S2')
        for i in range(x - 7, x + 7, 3):
            cv.set(i, y + 4, 'S0')
        # chapel tower at the back
        cv.rect(x - 2, y - 13, x + 2, y - 4, 'S3')
        cv.vline(x + 1, y - 13, y - 4, 'S2')
        cv.hline(x - 2, x + 1, y - 14, 'S1'); cv.hline(x - 1, x, y - 15, 'S1'); cv.set(x - 1, y - 16, 'B3')
        cv.set(x - 1, y - 11, 'A3'); cv.set(x - 1, y - 10, 'A2')
        # houses with lit windows
        for (hx, hy, roof) in ((x - 10, y - 2, 'H1'), (x + 2, y - 3, 'R1'), (x - 7, y + 2, 'R1'),
                               (x - 2, y + 1, 'H1'), (x + 4, y + 2, 'R1')):
            cv.rect(hx, hy - 3, hx + 5, hy + 1, 'D3')
            cv.vline(hx + 4, hy - 3, hy, 'D2')
            cv.hline(hx - 1, hx + 5, hy - 4, roof); cv.hline(hx, hx + 4, hy - 5, roof)
            cv.hline(hx + 1, hx + 3, hy - 6, 'R2' if roof == 'R1' else 'H2')
            cv.set(hx + 1, hy - 2, 'A3'); cv.set(hx + 3, hy - 2, 'A2')
            cv.set(hx + 2, hy, 'H0')
    inked(cv, town, 'O')
    # pier into the water with a harbour light at its head
    cv.rect(x + 8, y + 3, x + 19, y + 5, 'H2')
    for i in range(x + 9, x + 19, 2):
        cv.set(i, y + 4, 'H1')
    cv.hline(x + 8, x + 19, y + 5, 'O')
    for i in range(x + 9, x + 19, 3):
        cv.set(i, y + 6, 'H0')
    cv.vline(x + 18, y - 1, y + 2, 'S2'); cv.set(x + 18, y - 2, 'A3'); cv.set(x + 17, y - 2, 'A2'); cv.set(x + 19, y - 2, 'A2')
    cv.set(x + 18, y - 3, 'A1')
    cv.set(x + 17, y - 1, 'O'); cv.set(x + 19, y - 1, 'O')
    # moored boats
    for (bx, by) in ((x + 12, y + 10), (x + 17, y + 9)):
        cv.hline(bx - 2, bx + 2, by, 'H1'); cv.hline(bx - 1, bx + 1, by + 1, 'H0')
        cv.vline(bx, by - 4, by - 1, 'H2'); cv.set(bx + 1, by - 3, 'WS'); cv.set(bx + 1, by - 2, 'WS')
        cv.set(bx + 2, by - 2, 'WS')


def inked(cv, fn, ink):
    """Run a drawing function, then ink a 1 px outline around exactly what it drew."""
    before = [row[:] for row in cv.px]
    fn()
    drawn = {(x, y) for y in range(H) for x in range(W) if cv.px[y][x] != before[y][x]}
    for (x, y) in ring(drawn):
        cv.set(x, y, ink)


# ---------------------------------------------------------------- site landmarks
# each is centred on its site coordinate (x, y), about 14-20 px across

def site_lighthouse(cv, x, y):
    # sea stack
    stack = m_poly([(x - 6, y + 8), (x - 4, y + 2), (x - 2, y + 1), (x + 3, y + 1), (x + 5, y + 3), (x + 7, y + 8)])
    for (px, py) in stack:
        k = 'S2' if px < x - 1 else ('S1' if px < x + 3 else 'S0')
        if (px + 2 * py) % 5 == 0 and px >= x - 1:
            k = 'S0'
        if (px, py - 1) not in stack:
            k = 'S3' if px < x + 2 else 'S2'
        cv.set(px, py, k)
    rows = ["...W...",
            "..ORO..",
            ".ORRRO.",
            "OLLWLLO",
            "OLWWWLO",
            "OLLWLLO",
            "OOOOOOO",
            ".OSSRO.",
            ".ORRRO.",
            ".ORRRO.",
            ".OSSSO.",
            ".OSSSO.",
            "OSSSSRO",
            "ORRRRRO",
            "ORRRRRO",
            "OSSDSSO"]
    stamp(cv, x - 3, y - 14, rows, {'O': 'O', 'R': 'R1', 'S': 'S3', 'L': 'L1', 'W': 'LW', 'D': 'O'})
    for yy in range(y - 7, y + 2):                         # shade the right side of the tower
        if cv.get(x + 2, yy) == 'S3':
            cv.set(x + 2, yy, 'S2')
    cv.set(x - 2, y - 12, 'R2'); cv.set(x - 1, y - 13, 'R2')
    cv.set(x - 2, y - 11, 'L2'); cv.set(x + 2, y - 11, 'L2'); cv.set(x - 2, y - 9, 'L2')
    # lamp beams
    for s in (-1, 1):
        for i in range(4, 14):
            for slope in (-0.36, 0.36):
                yy = y - 10 + slope * (i - 3)
                if i > 9 and (i + int(slope > 0)) % 2:
                    continue
                cv.set(x + s * i, yy, 'L2' if i < 8 else 'L1')
            if 6 <= i < 12 and i % 3 == 0:
                cv.set(x + s * i, y - 10, 'L1')
    # foam round the stack
    for i in range(-8, 10, 2):
        cv.set(x + i, y + 9, 'K0' if i % 4 == 0 else 'K1')


def site_atoll(cv, x, y):
    outer = m_ell(x, y, 11, 7.5)
    inner = m_ell(x, y, 8.4, 5.2)
    band = outer - inner
    # a channel through the reef on the west side
    chan = {p for p in band if p[0] < x - 5 and y - 1 <= p[1] <= y}
    band -= chan
    for (px, py) in inner | chan:
        cv.set(px, py, 'N6')
    for (px, py) in band:
        k = 'D2' if py < y else 'D1'
        if (px, py - 1) not in band and py < y:
            k = 'D3'
        if (px, py + 1) not in band and py >= y:
            k = 'D0'
        if (px * 5 + py * 3) % 9 == 0:
            k = 'C2' if py < y else 'C1'
        cv.set(px, py, k)
    # pink coral maze in the lagoon: two walled rings with offset gates, and a heart
    maze = ["..CCCCCCCCCCC..",
            ".C...........C.",
            "C..CCCC.CCCC..C",
            "C..C.......C..C",
            "...C..CCC..C..C",
            "C..C..C.C..C..C",
            "C..C.......C...",
            "C..CCCCC.CCC..C",
            ".C...........C.",
            "..CCCCC.CCCCC.."]
    for gy, row in enumerate(maze):
        for gx, ch in enumerate(row):
            px, py = x - 7 + gx, y - 4 + gy
            if ch == 'C' and (px, py) in inner:
                cv.set(px, py, 'C3' if gy < 3 else ('C2' if gy < 7 else 'C1'))
    cv.set(x, y, 'C3')
    for (px, py) in ring(outer):
        if (px + 1, py) not in chan:
            cv.set(px, py, 'K1')
    # a few palms on the reef
    for (tx, ty) in ((x + 5, y - 6), (x - 6, y - 5)):
        cv.set(tx, ty, 'H1'); cv.set(tx, ty - 1, 'H1')
        for (dx, dy) in ((-1, -2), (0, -2), (1, -2), (-2, -1), (2, -1), (0, -3)):
            cv.set(tx + dx, ty + dy, 'M2' if dx <= 0 else 'M1')


def site_warren(cv, x, y):
    """A sheer sea-cliff island, grass on its crown and a lantern-lit smugglers' cave at the
    waterline, a rowboat drawn up at its mouth."""
    rows = ["......OOOOOO..OOOOO.....",
            ".....OgggggGOOgggggO....",
            "...OOgGGmmmmGGmmmmmkO...",
            "..OgGmmmmmmmmmmmmmmmkO..",
            "..OlGmmkmmmmkmmmkmmkdO..",
            "..OlrkdmkrkmdkmkdkddDO..",
            ".OlrrrdrrrrdddrrdddDDDO.",
            ".OlrrdDDrrrdrrrdddrDDDO.",
            ".OlrrrrrddrrrrdddddDdDO.",
            ".OlDDrrrDDDdrrDDdddDDDO.",
            ".OllrrrdddOOOOddrrdDDDO.",
            "OlrrrrddOOcccOOdrddDdDDO",
            "OlDDdrrdOcaAacOddDDDDDDO",
            "OlrrrrdOccaAAacOdrdDdDDO",
            "OllrrddOcaAAAacOddDDDDDO",
            "OlDDrddOcaaAaacODdDDDDDO",
            ".OOOOOOOeaaaaaeOOOOOOOO.",
            "........eAaAaAae........"]
    km = {'O': 'O', 'g': 'M3', 'G': 'M2', 'm': 'M1', 'k': 'M0', 'l': 'D3', 'r': 'D2', 'd': 'D1',
          'D': 'D0', 'c': 'O', 'a': 'A2', 'A': 'A3', 'e': 'A1'}
    stamp(cv, x - 12, y - 10, rows, km)
    # foam along the foot, rowboat with a lantern
    for i in (-12, -10, -8, 10, 12, 14):
        cv.set(x + i, y + 7, 'K0' if i % 4 == 0 else 'K1')
    cv.hline(x - 8, x - 4, y + 8, 'H1'); cv.hline(x - 7, x - 5, y + 9, 'H0')
    cv.set(x - 9, y + 8, 'O'); cv.set(x - 3, y + 8, 'O'); cv.set(x - 6, y + 7, 'A3')


def site_grove(cv, x, y):
    # low mudflat island, mangrove roots arching into the water, one huge gloom tree
    mud = blob(x, y + 5, 11, 3.4, 71, 0.12)
    for (px, py) in mud:
        k = 'M0' if (px + py) % 3 else 'D0'
        if (px, py - 1) not in mud:
            k = 'M1'
        cv.set(px, py, k)
    for (px, py) in ring(mud):
        cv.set(px, py, 'K1')
    # stilt roots
    for i, dx in enumerate((-9, -6, -3, 3, 6, 9)):
        s = -1 if dx < 0 else 1
        bx = x + dx
        cv.set(bx, y + 3, 'G2'); cv.set(bx + s, y + 4, 'G2'); cv.set(bx + s, y + 5, 'G1')
        cv.set(bx - s, y + 4, 'G1'); cv.set(bx - s, y + 5, 'G1')
    # gnarled trunk on splayed prop roots
    def trunk():
        for yy in range(y - 4, y + 3):
            cv.hline(x - 1, x + 1, yy, 'G2')
            cv.set(x + 1, yy, 'G1')
        for s in (-1, 1):
            for i, (dx, dy) in enumerate(((2, 2), (3, 3), (4, 4), (5, 5), (1, 3), (2, 4), (2, 5))):
                cv.set(x + s * dx, y + dy, 'G2' if s < 0 else 'G1')
        cv.vline(x, y + 3, y + 5, 'G1')
    inked(cv, trunk, 'O')
    # vast dark canopy, lumpy and wide
    r = random.Random(74)
    can = m_ell(x, y - 8, 7, 3.6)
    for i in range(9):
        a = math.pi * (i / 8.0)
        can |= m_ell(x - math.cos(a) * 8, y - 6 - math.sin(a) * 4 + r.uniform(-0.6, 0.6),
                     r.uniform(2.6, 3.6), r.uniform(2.0, 2.8))
    nz = vnoise(73)
    for (px, py) in can:
        n = nz(px / 2.2, py / 2.2)
        k = 'G1' if n < 0.5 else 'G2'
        if (px, py - 1) not in can or (px, py - 2) not in can and n > 0.4:
            k = 'G3'
        if (px, py + 1) not in can:
            k = 'G0'
        cv.set(px, py, k)
    for (px, py) in ring(can):
        cv.set(px, py, 'O')
    # hanging aerial roots
    for dx in (-8, -5, 4, 7, 10, -10):
        bottom = max(py for (px, py) in can if px == x + dx) if any(px == x + dx for (px, py) in can) else y - 4
        ln = 2 + (abs(dx) % 3)
        cv.vline(x + dx, bottom + 1, bottom + ln, 'G2')
    # pale wisps and glowing eyes in the dark
    cv.set(x - 2, y - 6, 'L2'); cv.set(x + 1, y - 6, 'L2')
    for (dx, dy) in ((-8, -7), (8, -9), (-5, -11), (10, -4), (-11, -5)):
        cv.set(x + dx, y + dy, 'P2' if dx % 2 else 'P1')


def site_leviathan(cv, x, y):
    # sandbar
    bar = blob(x, y + 4, 12, 2.8, 81, 0.1)
    for (px, py) in bar:
        cv.set(px, py, 'D3' if (px, py - 1) not in bar else ('D2' if (px + py) % 4 else 'D1'))
    for (px, py) in ring(bar):
        cv.set(px, py, 'K1')
    # brass whale hull, head left, broken ribs mid, fluke up at the right
    body = m_ell(x - 2, y, 8.5, 4.2) | m_ell(x - 7, y + 0.5, 4, 3.6)
    body = {p for p in body if p[1] <= y + 3}
    ribs = {(px, py) for (px, py) in body if x <= px <= x + 6 and py < y + 1}
    for (px, py) in body:
        if (px, py) in ribs:
            continue
        k = 'B2'
        if (px, py - 1) not in body:
            k = 'B3'
        elif py > y + 1:
            k = 'B0'
        elif py > y - 1:
            k = 'B1'
        if (px * 3 + py) % 6 == 0 and k in ('B2', 'B1'):
            k = 'B3' if k == 'B2' else 'B2'                  # rivets
        cv.set(px, py, k)
    for rx in (x, x + 3, x + 6):                             # ribs standing proud
        for yy in range(y - 4, y + 1):
            if (rx, yy) in body or yy >= y - 3:
                cv.set(rx, yy, 'B2' if yy > y - 3 else 'B3')
    for (px, py) in ribs:
        if cv.get(px, py) not in ('B2', 'B3'):
            cv.set(px, py, 'O')
    # tail stock and raised fluke
    for i in range(5):
        cv.set(x + 6 + i, y + 1 - i // 2, 'B1'); cv.set(x + 6 + i, y + 2 - i // 2, 'B0')
    fl = [(x + 10, y - 2), (x + 11, y - 3), (x + 12, y - 4), (x + 13, y - 5), (x + 9, y - 3), (x + 9, y - 4),
          (x + 8, y - 5), (x + 11, y - 2), (x + 12, y - 3), (x + 10, y - 3), (x + 10, y - 4), (x + 12, y - 5)]
    for (px, py) in fl:
        cv.set(px, py, 'B2' if px < x + 11 else 'B1')
    cv.set(x + 13, y - 5, 'B3'); cv.set(x + 8, y - 5, 'B3')
    # porthole eye, jaw seam
    cv.set(x - 8, y - 1, 'A3'); cv.set(x - 9, y - 1, 'O'); cv.set(x - 7, y - 1, 'O')
    cv.set(x - 8, y - 2, 'O'); cv.set(x - 8, y, 'O')
    cv.hline(x - 11, x - 6, y + 2, 'B0')
    m = body | {(px, py) for (px, py) in fl} | {(x + 6 + i, y + 1 - i // 2) for i in range(5)}
    for (px, py) in ring(m):
        if cv.get(px, py) not in ('B0', 'B1', 'B2', 'B3', 'D1', 'D2', 'D3'):
            cv.set(px, py, 'O')


def site_abbey(cv, x, y):
    isl = m_poly([(x - 10, y + 3), (x - 8, y - 1), (x + 9, y - 1), (x + 11, y + 3), (x + 10, y + 8), (x - 9, y + 8)])
    for (px, py) in isl:
        if py <= y + 1:
            k = 'M1' if (px, py - 1) in isl else 'M3'
        else:
            k = 'S1' if px % 2 == 0 else 'S0'
            if px < x - 6:
                k = 'S2' if px % 2 == 0 else 'S1'
        cv.set(px, py, k)
    for (px, py) in ring(isl):
        cv.set(px, py, 'K1')
    # nave
    cv.rect(x - 3, y - 6, x + 8, y, 'S2')
    cv.rect(x + 6, y - 6, x + 8, y, 'S1')
    for i in range(6):                                       # pitched roof
        cv.hline(x - 3 + i // 2, x + 7 - i // 2, y - 7 - i // 2, 'S0' if i % 2 else 'Q1')
    for wx in (x - 1, x + 2, x + 5):                         # pointed lit windows
        cv.set(wx, y - 4, 'P2'); cv.set(wx, y - 3, 'A3'); cv.set(wx, y - 2, 'A2')
    # bell tower with spire
    cv.rect(x - 7, y - 11, x - 3, y, 'S3')
    cv.vline(x - 4, y - 11, y - 1, 'S2')
    cv.set(x - 6, y - 9, 'O'); cv.set(x - 5, y - 9, 'B3'); cv.set(x - 6, y - 8, 'O'); cv.set(x - 5, y - 8, 'O')
    for i in range(5):
        cv.hline(x - 7 + (i + 1) // 2, x - 4 - (i + 1) // 2 + (0 if i < 4 else 0), y - 12 - i, 'S1' if i % 2 else 'S0')
    cv.set(x - 5, y - 16, 'S1'); cv.set(x - 5, y - 17, 'B3')
    cv.set(x - 2, y - 1, 'O'); cv.set(x - 2, y - 2, 'O')
    # crescent moon above
    for (dx, dy) in ((5, -14), (6, -15), (7, -15), (4, -13), (4, -12), (5, -11), (6, -11)):
        cv.set(x + dx, y + dy, 'S3' if dy < -12 else 'P2')


def site_anvil(cv, x, y):
    # rocky base island
    base = blob(x, y + 5, 10, 3.2, 91, 0.12)
    for (px, py) in base:
        cv.set(px, py, 'S1' if (px, py - 1) in base else 'S2')
    for (px, py) in ring(base):
        cv.set(px, py, 'K1')
    # the anvil peak: waist, then a flat top with a long horn to the left
    peak = m_poly([(x - 3, y + 5), (x - 2, y - 1), (x - 9, y - 3), (x - 5, y - 6), (x + 6, y - 6),
                   (x + 6, y - 3), (x + 3, y - 1), (x + 5, y + 5)])
    for (px, py) in peak:
        k = 'S2' if px < x else 'S1'
        if px > x + 3:
            k = 'S0'
        if (px, py - 1) not in peak:
            k = 'S3'
        elif (px + py) % 4 == 0 and px >= x:
            k = 'S0'
        cv.set(px, py, k)
    for (px, py) in ring(peak):
        if cv.get(px, py) not in ('S1', 'S2'):
            cv.set(px, py, 'O')
    # storm cloud with lightning striking the anvil
    cl = m_ell(x - 1, y - 12, 4.5, 2.2) | m_ell(x + 3, y - 13, 4, 2.6) | m_ell(x + 6, y - 11.5, 3, 1.8)
    for (px, py) in cl:
        k = 'Q1'
        if (px, py - 1) not in cl:
            k = 'Q2'
        if (px, py + 1) not in cl:
            k = 'Q0'
        cv.set(px, py, k)
    for (px, py) in ring(cl):
        cv.set(px, py, 'O')
    for (dx, dy) in ((2, -10), (1, -9), (2, -8), (3, -8), (2, -7), (8, -10), (9, -9), (8, -8), (9, -7)):
        cv.set(x + dx, y + dy, 'Y')
    cv.set(x + 3, y - 9, 'A3'); cv.set(x + 1, y - 7, 'A3'); cv.set(x + 3, y - 7, 'A3')
    for (dx, dy) in ((-5, -9), (-3, -8), (-1, -9), (5, -9), (-4, -7)):
        cv.set(x + dx, y + dy, 'K1')                         # rain


def site_gate(cv, x, y):
    # whirlpool: a dark eye and spiral arms
    for yy in range(y - 7, y + 8):
        for xx in range(x - 11, x + 12):
            dx, dy = (xx + 0.5 - x) / 10.5, (yy + 0.5 - y) / 6.2
            d = math.hypot(dx, dy)
            if d > 1:
                continue
            a = math.atan2(dy, dx)
            s = (a + d * 6.5) % math.pi
            k = 'V1'
            if s < 0.42:
                k = 'V3' if d > 0.3 else 'V2'
                if d > 0.62 and s < 0.2:
                    k = 'K0'
            elif s < 0.95:
                k = 'V2' if bay(xx, yy) < (0.75 if s < 0.7 else 0.25) else 'V1'
            if d < 0.2:
                k = 'V0'
            elif d < 0.32 and k != 'V3':
                k = 'V0'
            if d > 0.9:
                k = 'K1' if (xx + yy) % 2 else 'V2'
            cv.set(xx, yy, k)
    # ring of standing stones
    for i in range(7):
        a = i / 7 * 2 * math.pi + 0.3
        px = int(round(x + math.cos(a) * 11.5)); py = int(round(y + math.sin(a) * 7.2))
        cv.rect(px - 1, py - 3, px + 1, py + 1, 'S2')
        cv.vline(px, py - 3, py, 'S1')
        cv.set(px - 1, py - 3, 'S3')
        cv.set(px - 1, py - 4, 'O'); cv.set(px, py - 4, 'O')
        cv.set(px - 2, py - 3, 'O'); cv.set(px + 1, py - 3, 'O')
        cv.vline(px - 2, py - 2, py, 'O'); cv.vline(px + 1, py - 2, py, 'O')
        cv.hline(px - 1, px, py + 1, 'K1')
        cv.set(px, py - 2, 'L2' if i % 2 == 0 else 'S1')    # faint runes


# ---------------------------------------------------------------- markers

def pennant(cv, x, y):
    cv.vline(x, y - 10, y, 'O')
    cv.set(x, y - 11, 'A3')
    cloth = [(1, -10), (2, -10), (3, -10), (4, -10), (5, -10), (6, -10),
             (1, -9), (2, -9), (3, -9), (4, -9),
             (1, -8), (2, -8), (3, -8), (4, -8), (5, -8), (6, -8)]
    for (dx, dy) in cloth:
        cv.set(x + dx, y + dy, 'R2' if dy == -10 else 'R1')
    cv.set(x + 2, y - 9, 'A2')
    for (dx, dy) in ((1, -11), (7, -10), (7, -8), (5, -9), (1, -7), (6, -11), (6, -7)):
        if cv.get(x + dx, y + dy) not in ('R1', 'R2'):
            cv.set(x + dx, y + dy, 'O')
    cv.set(x - 1, y + 1, 'O'); cv.set(x + 1, y + 1, 'O'); cv.set(x, y + 1, 'O')


def party_ship(cv, x, y):
    """The party: a little blue-sailed sloop with a gold star, x,y = waterline centre."""
    rows = ["....O.....",
            "...OUO....",
            "..OUUUO...",
            "..OUAUUO..",
            ".OUUUUUUO.",
            ".OUUUUUUO.",
            "..OOOOOOO.",
            "OHHHHHHHHO",
            ".OHHHHHHO.",
            "..OOOOOO.."]
    stamp(cv, x - 5, y - 8, rows, {'O': 'O', 'U': 'U1', 'A': 'A3', 'H': 'H2'})
    cv.set(x - 2, y - 6, 'U2'); cv.set(x - 2, y - 5, 'U2'); cv.set(x - 3, y - 4, 'U2'); cv.set(x - 1, y - 7, 'U2')
    cv.set(x - 3, y - 3, 'U2')
    cv.set(x - 1, y - 9, 'A2'); cv.set(x, y - 9, 'A2')       # masthead pennant
    cv.set(x - 4, y, 'H1'); cv.set(x + 3, y, 'H1')
    for i in (-7, -6, 5, 6, 8):
        cv.set(x + i, y + 2, 'K0' if i in (-7, 6) else 'K1')


def fog(cv, cx, cy, seed):
    """A drifting fog bank: long layered puffs with trailing wisps; hides the site under it."""
    r = random.Random(seed)
    puffs = []
    for i in range(5):
        py = cy - 9 + i * 4.6 + r.uniform(-0.8, 0.8)
        span = 15 - abs(i - 2) * 1.6
        px = cx + r.uniform(-3, 3) + (2 if i % 2 else -2)
        puffs.append((px, py, span + r.uniform(0, 3), r.uniform(3.4, 4.4)))
    allm = set()
    for i, (px, py, rx, ry) in enumerate(puffs):             # back (top) bank first
        m = {p for p in m_ell(px, py, rx, ry)}
        top = {}
        for (qx, qy) in m:
            top[qx] = min(top.get(qx, 9999), qy)
        for (qx, qy) in m:
            dy = qy - top[qx]
            k = 'F1'
            if dy == 0:
                k = 'F3'
            elif dy == 1:
                k = 'F2'
            elif (qx, qy + 1) not in m:
                k = 'F0'
            elif dy == 3 and (qx // 3 + i) % 3 == 0:
                k = 'F2'                                     # a soft streak along the bank
            cv.set(qx, qy, k)
        allm |= m
        # a thin wisp trailing off one end of the bank
        side = 1 if r.random() < 0.5 else -1
        ex = px + side * (rx + 1)
        for j in range(r.randint(4, 9)):
            if j % 3 != 2:
                cv.set(ex + side * j, py + 1 + (1 if j > 4 else 0), 'F1' if j < 3 else 'F0')
    for (qx, qy) in ring(allm):
        if bay(qx, qy) < 0.5 and cv.get(qx, qy) not in ('F0', 'F1', 'F2', 'F3'):
            cv.set(qx, qy, 'F0')


# ---------------------------------------------------------------- compose

SITE_FN = [site_lighthouse, site_atoll, site_warren, site_grove, site_leviathan, site_abbey,
           site_anvil, site_gate]

DIM = {'L1': 'S1', 'L2': 'S2', 'LW': 'S2', 'C1': 'S0', 'C2': 'S1', 'C3': 'S2', 'A1': 'D0', 'A2': 'D1',
       'A3': 'D2', 'B0': 'D0', 'B1': 'D1', 'B2': 'D1', 'B3': 'D2', 'Y': 'S2', 'R1': 'S0', 'R2': 'S1',
       'P1': 'S0', 'P2': 'S1'}


def landmark(cv, fn, x, y, dim):
    before = [row[:] for row in cv.px]
    fn(cv, x, y)
    if dim:
        for yy in range(H):
            for xx in range(W):
                if cv.px[yy][xx] != before[yy][xx]:
                    k = cv.get(xx, yy)
                    if k in DIM:
                        cv.set(xx, yy, DIM[k])


ISLANDS = [  # decorative islets with no site
    (70, 128, 5, 2.6, 2, 201), (126, 130, 7, 3.0, 2, 202), (60, 22, 5, 2.6, 2, 203),
    (186, 22, 6, 3.0, 3, 204), (240, 104, 5, 3.4, 2, 205), (178, 126, 4, 2.2, 1, 206),
    (138, 32, 3.5, 2.0, 1, 207), (36, 62, 4, 2.4, 2, 208),
]


def site_avoid():
    return [(sx, sy, 16) for (sx, sy) in SITES] + [(HOME[0], HOME[1], 14), (36, 30, 17), (124, 22, 12),
                                                    (214, 124, 20), (64, 136, 18)]


PENNANT = {4: (15, 2), 1: (11, -3), 7: (12, -4)}


def draw(progress):
    """progress: number of sites cleared (0..8); the next site is the one in progress.
    isles-map-1 = progress 0 (the ship at site 1); isles-map-4 = 4; isles-map-8 = 8."""
    cv = Cv(PAL, 'N2', W, H)
    land = mainland()
    isles = [Island(*a) for a in ISLANDS]
    # ground footprints of the sites, so the shallows ring them too
    ground = set()
    for i, (sx, sy) in enumerate(SITES):
        rx, ry = ((7, 5), (12, 8), (11, 7), (11, 5), (12, 4), (11, 6), (10, 5), (12, 8))[i]
        ground |= m_ell(sx, sy + (2 if i not in (1, 7) else 0), rx, ry)
    allland = set(land)
    for isl in isles:
        allland |= isl.all
    dist = sea(cv, allland | ground)
    rhumbs(cv, 36, 30, allland | ground)
    soundings(cv, dist, site_avoid())
    for (sx, sy, n, s) in ((80, 70, 14, 1), (176, 116, 12, 2), (214, 56, 10, 3), (138, 82, 10, 4),
                           (104, 22, 9, 5), (244, 72, 10, 6)):
        shoal(cv, sx, sy, n, s)
    for (rx_, ry_) in ((74, 84), (134, 120), (190, 100), (246, 58), (112, 136), (204, 18)):
        rock_mark(cv, rx_, ry_)
    for (wx, wy) in ((52, 44), (84, 128), (150, 132), (232, 86), (108, 60), (170, 34), (16, 44),
                     (196, 112), (246, 132)):
        wave(cv, wx, wy)
    draw_mainland(cv, land)
    for isl in isles:
        draw_island(cv, isl)
    for j, a in enumerate(ISLANDS):                       # a hillock or a palm on the islets
        ix, iy = int(a[0]), int(a[1] - a[4])
        if j % 2 == 0:
            for d in range(-2, 3):
                cv.set(ix + d, iy - 2 + abs(d), 'M0' if d >= 0 else 'M3')
        else:
            cv.vline(ix, iy - 3, iy, 'H1')
            for (dx, dy) in ((-1, -4), (0, -4), (1, -4), (-2, -3), (2, -3)):
                cv.set(ix + dx, iy + dy, 'M3' if dx <= 0 else 'M1')

    # decoration
    compass(cv, 36, 30)
    galleon(cv, 124, 24)
    serpent(cv, 200, 128)
    scale_bar(cv, 50, 136)

    # the sailing route: sailed legs as bright dashes, the leg ahead faint, nothing beyond
    path = catmull(ROUTE)
    reached = STOPS[min(8, progress + 1)]
    blocked = set()
    for isl in isles:
        blocked |= isl.all
    blocked |= land
    for i, (x, y, seg) in enumerate(path):
        if seg >= reached:
            break
        if (int(x), int(y)) in blocked:
            continue
        ahead = progress < 8 and seg >= STOPS[progress]
        if ahead:
            if i % 4 < 2:
                cv.set(x, y, 'K1')
        else:
            if i % 4 < 3:
                cv.set(x, y, 'A2' if i % 4 else 'A3')

    harbour(cv, *HOME)
    for i, (sx, sy) in enumerate(SITES):
        landmark(cv, SITE_FN[i], sx, sy, i > progress)
    for i, (sx, sy) in enumerate(SITES):
        if i > progress:
            fog(cv, sx, sy - 4, 300 + i)
    for i, (sx, sy) in enumerate(SITES):
        if i < progress:
            ox, oy = PENNANT.get(i, (9, -3))
            pennant(cv, sx + ox, sy + oy)
    if progress < 8:
        a, b = STOPS[progress], STOPS[progress + 1]
        pts = [p for p in path if a <= p[2] < b]
        sx, sy = SITES[progress]
        near = [p for p in pts if math.hypot(p[0] - sx, p[1] - sy) >= 15]
        px, py, _ = near[-1] if near else pts[0]
        party_ship(cv, int(px), int(py))
    else:
        party_ship(cv, SITES[7][0] - 15, SITES[7][1] + 9)
    graduated_border(cv)
    return cv


VARIANTS = [('isles-map-1', 0), ('isles-map-4', 4), ('isles-map-8', 8)]
