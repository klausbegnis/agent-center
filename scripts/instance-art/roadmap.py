"""World roadmap of instances: an illustrated parchment map, 256 x 144, in three progress states.
roadmap-1: only the first site reached; roadmap-3: three cleared, the fourth in progress;
roadmap-6: all cleared."""
import random, math
from engine import *

W, H = 256, 144

PAL = {
    # parchment, burnt edge to highlight
    'P0': '#2e1c12', 'P1': '#6a4527', 'P2': '#a47c4a', 'P3': '#cfac74', 'P4': '#e7cf9c',
    'P5': '#f6e7c0',
    # ink
    'I0': '#2b1b13', 'I1': '#6b4a30',
    # sea washes
    'S1': '#6f8f86', 'S2': '#9cb3a0', 'S3': '#bccab0',
    # forest
    'G0': '#3d5230', 'G1': '#5f7843', 'G2': '#8c9d5a',
    # site accents
    'W': '#3fae7c', 'F1': '#b6421f', 'F2': '#f0902c', 'A': '#f1ad34', 'C': '#93d0ec',
    'T': '#3f7a74', 'R1': '#a3352a', 'R2': '#d95b3c', 'B1': '#2a579a', 'B2': '#62a6ea',
}

SITES = [(82, 94), (126, 116), (163, 84), (110, 48), (172, 41), (222, 30)]
HOME = (44, 116)
# road control points between stops (so the road winds instead of running straight)
ROAD = [HOME, (58, 112), (70, 101), SITES[0], (96, 104), (110, 116), SITES[1], (140, 110),
        (150, 96), SITES[2], (146, 72), (128, 66), (118, 58), SITES[3], (128, 40), (150, 46),
        (160, 44), SITES[4], (190, 44), (204, 36), SITES[5]]
STOPS = [0, 3, 6, 9, 13, 17, 20]          # indices of HOME and the six sites in ROAD


def catmull(pts, per=14):
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


# ---------------------------------------------------------------- base map

def land_mask():
    nz = vnoise(71)
    land = set()
    for y in range(H):
        cl = 36 + 10 * math.sin(y / 23.0) + 6 * nz(1, y / 9.0) - 18 * math.exp(-((y - 12) / 22.0) ** 2) * 1.6
        cl += 8 * math.exp(-((y - 98) / 7.0) ** 2)          # a bay where the river meets the sea
        for x in range(W):
            if x > cl:
                land.add((x, y))
    # a small sea in the lower-right corner
    for y in range(H):
        for x in range(W):
            d = math.hypot((x - 262) / 30.0, (y - 150) / 26.0) + 0.12 * nz(x / 6.0, y / 6.0)
            if d < 1:
                land.discard((x, y))
    return land


def lake_mask():
    nz = vnoise(72)
    m = set()
    for y in range(28, 56):
        for x in range(150, 200):
            d = math.hypot((x - 175) / 17.0, (y - 42) / 8.0) + 0.18 * nz(x / 4.0, y / 4.0)
            if d < 1:
                m.add((x, y))
    return m


def parchment(cv):
    nz = vnoise(70)
    for y in range(H):
        for x in range(W):
            n = nz(x / 22.0, y / 16.0) * 0.7 + nz(x / 7.0, y / 7.0) * 0.3
            k = 'P4'
            if n > 0.8:
                k = 'P3' if bay(x, y) < 0.5 else 'P4'        # rare soft stains, a clean 50% mix
            cv.set(x, y, k)


def edges(cv):
    """Darkened, slightly burnt margins in dithered steps."""
    nz = vnoise(73)
    for y in range(H):
        for x in range(W):
            d = min(x, y, W - 1 - x, H - 1 - y) + 2.2 * nz(x / 5.0, y / 5.0)
            if d < 1.6:
                cv.set(x, y, 'P0')
            elif d < 3.0:
                cv.set(x, y, 'P1')
            elif d < 6.5:
                k = cv.get(x, y)
                lvl = q4((6.5 - d) / 3.5)
                if bay(x, y) < lvl:
                    darker = {'P5': 'P4', 'P4': 'P3', 'P3': 'P2', 'S3': 'S2', 'S2': 'S1', 'G2': 'G1',
                              'G1': 'G0'}
                    cv.set(x, y, darker.get(k, k))


def water(cv, land, lake):
    sea = {(x, y) for y in range(H) for x in range(W) if (x, y) not in land}
    allw = sea | lake
    # distance-from-shore rings: a darker wash and a hatched offset line hugging the coast
    dist = {}
    frontier = [p for p in allw if any((p[0] + dx, p[1] + dy) not in allw
                                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                                       if 0 <= p[0] + dx < W and 0 <= p[1] + dy < H)]
    for p in frontier:
        dist[p] = 0
    cur = frontier
    while cur:
        nxt = []
        for (x, y) in cur:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q in allw and q not in dist:
                    dist[q] = dist[(x, y)] + 1
                    nxt.append(q)
        cur = nxt
    for p in allw:
        d = dist.get(p, 99)
        k = 'S3'
        if d <= 1:
            k = 'S1'
        elif d <= 4:
            k = 'S2'
        if d == 3:
            k = 'S1'                                       # the classic offset coast line
        if d == 7 and p not in lake and (p[0] + p[1]) % 3:
            k = 'S2'
        cv.set(p[0], p[1], k)
    # coast ink
    for (x, y) in land:
        if (x, y) in lake:
            continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if (q not in land or q in lake) and 0 <= q[0] < W and 0 <= q[1] < H:
                cv.set(x, y, 'I0')
                break
    # little wave marks out at sea
    for (x, y) in ((10, 50), (18, 60), (8, 72), (24, 110), (12, 128), (30, 136), (240, 132), (226, 140),
                   (48, 6), (36, 14)):
        if (x, y) in sea and dist.get((x, y), 0) > 5:
            cv.set(x, y, 'I1'); cv.set(x + 1, y - 1, 'I1'); cv.set(x + 2, y, 'I1')
            cv.set(x + 3, y - 1, 'I1')
    return dist


def river(cv, land):
    pts = [(160, 48), (150, 60), (138, 66), (124, 74), (108, 82), (96, 88), (84, 86), (70, 92),
           (58, 96), (44, 98), (34, 99)]
    path = catmull(pts)
    for i, (x, y, _) in enumerate(path):
        w = 1 if i < len(path) * 0.5 else 2
        for dy in range(w):
            if (int(x), int(y) + dy) in land:
                cv.set(x, y + dy, 'S1')
        cv.set(x, y - 1, 'I1') if cv.get(x, y - 1) in ('P3', 'P4', 'P5') else None
        cv.set(x, y + w, 'I1') if cv.get(x, y + w) in ('P3', 'P4', 'P5') else None


def mountain(cv, x, y, w, h, snow=True, volcano=False):
    """A map-style peak: lit left face, hatched right face, ink outline."""
    for i in range(h + 1):
        yy = y - h + i
        hw = w * i / h
        for xx in range(int(x - hw), int(x + hw) + 1):
            left = xx <= x
            k = 'P5' if left else 'P2'
            if not left and (xx + yy) % 2 == 0:
                k = 'P3'
            if snow and i < h * 0.35 and not volcano:
                k = 'P5' if left else 'S3'
            if volcano and i < 2:
                k = 'F1'
            cv.set(xx, yy, k)
        cv.set(x - hw - 1, yy, 'I0'); cv.set(x + hw + 1, yy, 'I0')
    cv.set(x, y - h - 1, 'I0')
    for k in range(1, h // 2):                           # ridge line
        cv.set(x + k // 3, y - h + k * 2, 'I1')
    if volcano:
        cv.hline(x - 1, x + 1, y - h, 'F2')
        cv.set(x - 2, y - h + 2, 'F1'); cv.set(x - 3, y - h + 4, 'F1'); cv.set(x + 2, y - h + 3, 'F1')
        for j, (dx, dy) in enumerate(((0, -2), (1, -3), (1, -4), (2, -5), (2, -6), (3, -7), (4, -7),
                                      (5, -8), (1, -2), (2, -4), (3, -6))):
            cv.set(x + dx, y - h + dy, 'I1' if j < 8 else 'P2')


def tree(cv, x, y, big=False):
    if big:
        for (dx, dy) in ((0, -3), (-1, -2), (0, -2), (1, -2), (-1, -1), (0, -1), (1, -1)):
            cv.set(x + dx, y + dy, 'G1')
        cv.set(x - 1, y - 2, 'G2'); cv.set(x, y - 3, 'G2')
        cv.set(x + 2, y - 1, 'I0'); cv.set(x + 2, y - 2, 'G0'); cv.set(x - 2, y - 1, 'G0')
        cv.hline(x - 1, x + 1, y, 'G0'); cv.set(x, y + 1, 'I0')
    else:
        cv.set(x, y - 2, 'G2'); cv.set(x - 1, y - 1, 'G2'); cv.set(x, y - 1, 'G1')
        cv.set(x + 1, y - 1, 'G0'); cv.set(x, y, 'G0'); cv.set(x + 1, y, 'I0')


def reeds(cv, x, y):
    cv.set(x, y, 'I1'); cv.set(x - 1, y - 1, 'I1'); cv.set(x + 1, y - 1, 'I1'); cv.set(x, y - 2, 'I1')


def compass(cv, cx, cy):
    r = 11
    for i in range(8):
        a = i * math.pi / 4 - math.pi / 2
        ln = r if i % 2 == 0 else r * 0.55
        for t in range(int(ln * 4)):
            d = t / 4.0
            w = (ln - d) / ln * (2.6 if i % 2 == 0 else 1.6)
            for s in (-1, 1):
                for k in range(int(w) + 1):
                    px = cx + math.cos(a) * d + math.cos(a + math.pi / 2) * s * k * 0.9
                    py = cy + math.sin(a) * d + math.sin(a + math.pi / 2) * s * k * 0.9
                    cv.set(px, py, ('P5' if s < 0 else 'P2') if i % 2 == 0 else ('P4' if s < 0 else 'P3'))
    for i in range(8):
        a = i * math.pi / 4 - math.pi / 2
        ln = r if i % 2 == 0 else r * 0.55
        cv.line(cx, cy, cx + math.cos(a) * ln, cy + math.sin(a) * ln, 'I0' if i % 2 == 0 else 'I1')
    for t in range(64):
        a = t / 64 * 2 * math.pi
        cv.set(cx + math.cos(a) * 6.5, cy + math.sin(a) * 6.5, 'I1')
    cv.set(cx, cy, 'R1')
    # north mark
    cv.set(cx, cy - r - 2, 'R1'); cv.set(cx - 1, cy - r - 3, 'R1'); cv.set(cx + 1, cy - r - 3, 'R1')
    cv.set(cx, cy - r - 4, 'R2')


def serpent(cv, x, y):
    """A sea serpent: three dark coils breaking the water and a finned head."""
    for (hx, hr) in ((0, 3.0), (9, 3.8), (18, 3.0)):
        outer = {p for p in m_ell(x + hx, y, hr, hr * 1.3) if p[1] <= y}
        inner = {p for p in m_ell(x + hx, y + 0.5, hr - 1.9, (hr - 1.9) * 1.3)}
        m = outer - inner
        for (px, py) in m:
            k = 'S1'
            if (px, py - 1) not in m and px <= x + hx:
                k = 'S3'
            cv.set(px, py, k)
        for (px, py) in outer:
            for dx, dy in ((1, 0), (-1, 0), (0, -1)):
                if (px + dx, py + dy) not in outer:
                    cv.set(px + dx, py + dy, 'I0')
        for (px, py) in inner:
            if py <= y:
                cv.set(px, py, 'S2')
        cv.set(x + hx, y - hr * 1.3 - 1, 'R1')               # a fin spike per coil
        cv.set(x + hx - 1, y - hr * 1.3, 'R1')
    head = ["..0000....",
            ".0SSSS0...",
            "0SPSSSSS0.",
            "0SSSS00000",
            "0SSS0RRRR0",
            "0SSS0SSSS0",
            "0SS0.0000.",
            ".0SS0.....",
            ".0SS0....."]
    stamp(cv, x + 24, y - 8, head, {'0': 'I0', 'P': 'P5', 'S': 'S1', 'R': 'R2'})
    cv.set(x + 25, y - 7, 'S3'); cv.set(x + 26, y - 7, 'S3')
    for (dx, dy) in ((3, -8), (4, -9), (5, -8), (2, -9)):
        cv.set(x + 24 + dx, y + dy, 'R1')
    for i in range(-5, 32, 2):
        if cv.get(x + i, y + 1) in ('S1', 'S2', 'S3'):
            cv.set(x + i, y + 1, 'S1' if i % 4 else 'P5')


def cloud(cv, x, y, w, ink=True):
    """A curly map-cloud: parchment-white puffs with an ink rim underneath."""
    m = set()
    r = random.Random(x * 7 + y)
    n = max(3, w // 5)
    for i in range(n):
        cx = x + i * (w / n) + r.uniform(-1, 1)
        rr = 3 + 2.5 * math.sin(math.pi * (i + 0.5) / n) + r.uniform(-0.5, 0.8)
        m |= m_ell(cx, y - rr * 0.5, rr, rr * 0.8)
    m = {p for p in m if p[1] <= y + 1}
    for (px, py) in m:
        k = 'P5'
        if (px, py + 1) not in m or (px + 1, py + 1) not in m:
            k = 'P3'
        cv.set(px, py, k)
    if ink:
        for (px, py) in m:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (px + dx, py + dy) not in m:
                    cv.set(px + dx, py + dy, 'I1' if dy >= 0 else 'P2')
    return m


# ---------------------------------------------------------------- site landmarks (about 14 x 14)

def site_crypt(cv, x, y, dim):
    k = (lambda a, b: b) if dim else (lambda a, b: a)
    m = m_ell(x, y - 7, 4, 3.5)
    for (px, py) in m:
        if py <= y - 7:
            cv.set(px, py, k('P5', 'P3') if px < x else k('P3', 'P2'))
    cv.set(x, y - 11, 'I0')
    for i in range(5):
        cv.hline(x - i - 1, x + i + 1, y - 7 + i // 2 - 2 + 2, k('P4', 'P3')) if False else None
    for yy in range(y - 7, y - 4):
        hw = 1 + (yy - (y - 7)) * 2
        cv.hline(x - hw, x + hw, yy, k('P4', 'P3'))
    cv.rect(x - 4, y - 4, x + 5, y + 1, k('P3', 'P2'))
    for cx_ in (x - 4, x - 2, x + 2, x + 4):
        cv.vline(cx_, y - 4, y, k('P5', 'P3'))
    cv.rect(x - 1, y - 3, x + 2, y + 1, k('W', 'I1'))
    cv.set(x, y - 2, k('P5', 'I1'))
    cv.hline(x - 6, x + 6, y + 1, k('S1', 'P2'))
    cv.set(x - 6, y, 'I1'); cv.set(x + 6, y, 'I1')
    outline_box(cv, x - 7, y - 12, x + 7, y + 2, dim)


def site_foundry(cv, x, y, dim):
    k = (lambda a, b: b) if dim else (lambda a, b: a)
    cv.rect(x - 5, y - 8, x + 6, y + 1, k('P2', 'P2'))
    for yy in range(y - 8, y + 1, 3):
        cv.hline(x - 5, x + 5, yy, k('I1', 'P3'))
    cv.disc(x + 0.5, y - 3.5, 3.6, k('I1', 'P3'))
    cv.disc(x + 0.5, y - 3.5, 2.4, k('F1', 'P2'))
    cv.set(x, y - 4, k('F2', 'P3'))
    for s in (-1, 1):
        cv.set(x + s * 5 + (0 if s > 0 else 0), y - 9, 'I0'); cv.set(x + s * 7, y - 10, 'I0')
        cv.set(x + s * 7, y - 11, 'I0'); cv.set(x + s * 6, y - 12, 'I0')
    cv.hline(x - 2, x + 3, y + 1, k('F2', 'P3'))
    cv.set(x - 3, y - 9, k('F2', 'P3')); cv.set(x + 4, y - 9, k('F2', 'P3'))
    cv.set(x - 3, y - 10, k('F1', 'P2')); cv.set(x + 4, y - 10, k('F1', 'P2'))
    outline_box(cv, x - 8, y - 13, x + 8, y + 2, dim)


def site_hive(cv, x, y, dim):
    k = (lambda a, b: b) if dim else (lambda a, b: a)
    for yy in range(y - 12, y + 1):
        hw = 2.5 + max(0, yy - (y - 3)) * 1.2
        cv.hline(x - hw, x + hw, yy, k('I1', 'P2'))
        cv.set(x - hw, yy, k('P2', 'P3'))
    crown = m_ell(x, y - 13, 7, 4.5)
    for (px, py) in crown:
        cv.set(px, py, k('G1', 'P3') if (px + py) % 4 else k('G2', 'P4'))
        if py > y - 12 and px > x:
            cv.set(px, py, k('G0', 'P2'))
    for (dx, dy) in ((-1, -9), (1, -8), (0, -6), (-1, -4), (1, -3)):
        cv.set(x + dx, y + dy, k('A', 'P4'))
    cv.rect(x - 1, y - 2, x + 2, y + 1, k('A', 'P4'))
    cv.set(x, y - 2, k('P5', 'P4'))
    outline_box(cv, x - 8, y - 18, x + 8, y + 2, dim)


def site_frost(cv, x, y, dim):
    k = (lambda a, b: b) if dim else (lambda a, b: a)
    cv.rect(x - 6, y - 5, x + 7, y + 1, k('P3', 'P3'))
    for tx in (x - 6, x + 4):
        cv.rect(tx, y - 10, tx + 3, y + 1, k('P2', 'P2'))
        cv.hline(tx, tx + 2, y - 10, k('P5', 'P4'))
        cv.set(tx, y - 11, k('P5', 'P4')); cv.set(tx + 2, y - 11, k('P5', 'P4'))
    cv.hline(x - 6, x + 6, y - 5, k('P5', 'P4'))
    cv.rect(x - 1, y - 3, x + 2, y + 1, k('I0', 'I1'))
    cv.set(x - 1, y - 3, k('P3', 'P3')); cv.set(x + 1, y - 3, k('P3', 'P3'))
    cv.set(x, y - 1, k('F2', 'I1'))
    cv.vline(x + 5, y - 14, y - 11, 'I0'); cv.set(x + 6, y - 14, k('C', 'P2')); cv.set(x + 7, y - 13, k('C', 'P2'))
    for (dx, dy) in ((-3, -12), (0, -14), (3, -13), (-5, -15)):
        cv.set(x + dx, y + dy, k('C', 'P3'))
    outline_box(cv, x - 8, y - 15, x + 8, y + 2, dim)


def site_library(cv, x, y, dim):
    k = (lambda a, b: b) if dim else (lambda a, b: a)
    dome = m_ell(x, y - 6, 5, 4.5)
    for (px, py) in dome:
        if py <= y - 6:
            cv.set(px, py, k('T', 'P3') if px < x + 2 else k('S1', 'P2'))
    cv.vline(x, y - 12, y - 11, 'I0')
    cv.rect(x - 5, y - 6, x + 6, y + 1, k('P3', 'P3'))
    for wx in (x - 4, x - 1, x + 2):
        cv.rect(wx, y - 4, wx + 2, y, k('A', 'P2'))
    cv.hline(x - 5, x + 5, y - 6, k('P5', 'P4'))
    cv.hline(x - 7, x + 7, y + 1, k('S1', 'P2'))
    for i in range(-6, 8, 3):
        cv.set(x + i, y + 2, k('A', 'P2'))
    outline_box(cv, x - 8, y - 12, x + 8, y + 2, dim)


def site_spire(cv, x, y, dim):
    k = (lambda a, b: b) if dim else (lambda a, b: a)
    for yy in range(y - 18, y + 1):
        t = (yy - (y - 18)) / 18.0
        hw = 0.5 + 4 * t ** 1.3
        for xx in range(int(x - hw), int(x + hw) + 1):
            cv.set(xx, yy, k('P2', 'P2') if xx > x else k('P3', 'P3'))
    for i in range(6):                               # bone coil
        yy = y - 2 - i * 3
        cv.line(x - 4 + i // 2, yy, x + 3 - i // 3, yy - 2, k('P5', 'P4'))
    cv.rect(x - 1, y - 3, x + 1, y + 1, k('I0', 'I1'))
    cv.set(x, y - 1, k('F2', 'I1'))
    cv.set(x + 2, y - 17, k('P5', 'P4')); cv.set(x + 3, y - 17, k('P5', 'P4')); cv.set(x + 4, y - 16, k('P5', 'P4'))
    # a lightning stroke
    for (dx, dy) in ((8, -20), (7, -19), (8, -18), (7, -17), (6, -16), (7, -15)):
        cv.set(x + dx, y + dy, k('C', 'P3'))
    outline_box(cv, x - 6, y - 20, x + 8, y + 2, dim)


def outline_box(cv, x0, y0, x1, y1, dim):
    pass


def inked(cv, fn, ink):
    """Run a drawing function, then ink a 1 px outline around exactly what it drew."""
    before = [row[:] for row in cv.px]
    fn()
    drawn = {(x, y) for y in range(H) for x in range(W) if cv.px[y][x] != before[y][x]}
    for (x, y) in drawn:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in drawn and 0 <= q[0] < W and 0 <= q[1] < H:
                cv.set(q[0], q[1], ink)


def settlement(cv, x, y):
    for (hx, hy, roof) in ((x - 6, y - 1, 'R1'), (x, y - 3, 'R1'), (x + 5, y, 'R2')):
        cv.rect(hx, hy - 2, hx + 4, hy + 1, 'P5')
        cv.vline(hx + 3, hy - 2, hy, 'P3')
        cv.hline(hx - 1, hx + 4, hy - 3, roof); cv.hline(hx, hx + 3, hy - 4, roof)
        cv.hline(hx + 1, hx + 2, hy - 5, roof)
        cv.set(hx + 1, hy, 'I0')
        cv.hline(hx - 1, hx + 4, hy + 1, 'I0')
    cv.vline(x + 2, y - 11, y - 8, 'P2'); cv.set(x + 3, y - 12, 'P3'); cv.set(x + 4, y - 13, 'P3')
    for i in range(-9, 11, 2):                       # palisade
        cv.vline(x + i, y + 2, y + 3, 'I1')
        cv.set(x + i, y + 1, 'I0')


# ---------------------------------------------------------------- markers

def flag(cv, x, y, big=False):
    cv.vline(x, y - 9, y, 'I0')
    cloth = ((1, -9), (2, -9), (3, -9), (4, -9), (1, -8), (2, -8), (3, -8), (1, -7), (2, -7),
             (3, -7), (4, -7), (1, -6), (2, -6)) if not big else \
        ((1, -9), (2, -9), (3, -9), (4, -9), (5, -9), (1, -8), (2, -8), (3, -8), (4, -8), (1, -7),
         (2, -7), (3, -7), (1, -6), (2, -6), (3, -6), (4, -6), (5, -6), (1, -5), (2, -5))
    for (dx, dy) in cloth:
        cv.set(x + dx, y + dy, 'R2' if dy == -9 else 'R1')
    cv.set(x, y - 10, 'A')


def party(cv, x, y):
    """A blue map-pin with a gold star: the party is here."""
    m = m_ell(x + 0.5, y - 7, 3.6, 3.6) | m_poly([(x - 2.6, y - 6), (x + 3.6, y - 6), (x + 0.5, y + 0.5)])
    for (px, py) in m:
        cv.set(px, py, 'B2' if (px - 1, py) not in m or (px, py - 1) not in m else 'B1')
    for (dx, dy) in ((0, -8), (-1, -7), (0, -7), (1, -7), (0, -6)):
        cv.set(x + dx, y + dy, 'A')
    for (px, py) in m:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (px + dx, py + dy) not in m:
                cv.set(px + dx, py + dy, 'I0')


def fog(cv, cx, cy, rx, ry, seed):
    """Fog of war: a bank of map-clouds over unexplored land."""
    r = random.Random(seed)
    for i in range(7):
        x = cx - rx + r.uniform(0, 2 * rx) - 8
        y = cy - ry + r.uniform(0, 2 * ry) + 4
        cloud(cv, int(x), int(y), int(r.uniform(14, 24)))


# ---------------------------------------------------------------- compose

SITE_FN = [site_crypt, site_foundry, site_hive, site_frost, site_library, site_spire]


def draw(progress):
    """progress: number of sites cleared (0..6); the next site is the one in progress.
    roadmap-1 = first site reached (progress 0, party at site 1); roadmap-3 = progress 3;
    roadmap-6 = progress 6."""
    cv = Cv(PAL, 'P4', W, H)
    parchment(cv)
    land = land_mask()
    lake = lake_mask()
    water(cv, land, lake)
    river(cv, land)
    # marsh around the crypt
    for (x, y) in ((66, 100), (60, 92), (98, 92), (64, 108), (102, 98), (100, 106), (58, 104)):
        reeds(cv, x, y)
    # mountain ranges (back to front)
    peaks = [(70, 30, 6, 9), (80, 24, 7, 11), (92, 30, 6, 10), (130, 26, 7, 12), (142, 32, 6, 9),
             (100, 22, 6, 10), (120, 20, 6, 9), (86, 40, 5, 7), (134, 44, 5, 7), (66, 46, 5, 7),
             (150, 22, 5, 8), (196, 22, 6, 10), (206, 14, 6, 10), (238, 18, 7, 12), (246, 34, 5, 8),
             (234, 46, 5, 8), (200, 48, 5, 7), (212, 56, 4, 6), (246, 54, 4, 6)]
    for (x, y, w, h) in sorted(peaks, key=lambda p: p[1]):
        mountain(cv, x, y, w, h)
    # volcanic hills by the foundry
    for (x, y, w, h, v) in ((146, 112, 6, 9, True), (156, 118, 5, 6, False), (108, 128, 4, 5, False),
                            (140, 126, 4, 5, False)):
        mountain(cv, x, y, w, h, snow=False, volcano=v)
    # forest
    r = random.Random(5)
    trees = []
    for i in range(420):
        x = r.uniform(140, 214); y = r.uniform(62, 108)
        if math.hypot((x - 177) / 33.0, (y - 85) / 21.0) + 0.25 * r.random() > 1:
            continue
        if abs(x - SITES[2][0]) < 10 and -20 < y - SITES[2][1] < 12:
            continue
        if all(abs(x - tx) + abs(y - ty) > 3.6 for (tx, ty) in trees):
            trees.append((int(x), int(y)))
    for (x, y) in ((36, 128), (30, 132), (40, 134), (60, 128), (56, 134), (192, 118), (200, 112),
                   (206, 120), (94, 70), (88, 64), (100, 64), (70, 66), (78, 70)):
        trees.append((x, y))
    for (x, y) in sorted(set(trees), key=lambda p: p[1]):
        tree(cv, x, y, big=(x + y) % 4 != 0)

    # the road, drawn in dots: walked parts dark, ahead faint
    path = catmull(ROAD)
    reached = STOPS[min(6, progress + 1)] if progress < 6 else STOPS[6]
    for i, (x, y, seg) in enumerate(path):
        walked = seg < reached
        if i % 3 == 2:
            continue
        if walked:
            cv.set(x, y, 'R1')
        else:
            if i % 6 < 2:
                cv.set(x, y, 'P2')
    # a bridge where the road crosses the river
    cv.hline(127, 131, 69, 'I0'); cv.hline(127, 131, 72, 'I0')

    # decorative compass, serpent, corner clouds
    compass(cv, 24, 24)
    serpent(cv, -3, 82)
    cloud(cv, 200, 132, 22)
    cloud(cv, 6, 140, 18)

    # home and sites
    for i, (sx, sy) in enumerate(SITES):
        locked = i > progress
        inked(cv, lambda: SITE_FN[i](cv, sx, sy, locked), 'I1' if locked else 'I0')
    inked(cv, lambda: settlement(cv, *HOME), 'I0')
    # fog over everything not yet reached
    for i, (sx, sy) in enumerate(SITES):
        if i > progress:
            fog(cv, sx, sy - 6, 12, 7, 100 + i)
    # flags on cleared sites, party marker
    for i, (sx, sy) in enumerate(SITES):
        if i < progress:
            flag(cv, sx + 9, sy + 1, big=(progress == 6))
    if progress < 6:
        # the party stands on the road just short of the site in progress
        a, b = STOPS[progress], STOPS[progress + 1]
        pts = [p for p in path if a <= p[2] < b]
        px, py, _ = pts[int(len(pts) * 0.6)]
        if progress == 0:
            px, py = SITES[0][0] - 10, SITES[0][1] + 2
        party(cv, int(px), int(py))
    else:
        party(cv, SITES[5][0] - 10, SITES[5][1] + 2)
    edges(cv)
    return cv


VARIANTS = [('roadmap-1', 0), ('roadmap-3', 3), ('roadmap-6', 6)]
