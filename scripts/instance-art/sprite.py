"""32 x 32 item-sprite engine (shape masks, bevel/sphere lighting, selective outline, pixel halo,
slot frames). Copied from the legendary-relics batch so the instance rewards match that look."""
import colorsys
import json
import math
import os
import struct
import zlib
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
N = 32
SCALE = 6
D4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
D8 = D4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))
LIGHT = (-0.62, -0.72, 0.62)
LN = math.sqrt(sum(v * v for v in LIGHT))
LIGHT = tuple(v / LN for v in LIGHT)
INK = (22, 14, 30)
WHITE = (255, 255, 255)


# ---------------------------------------------------------------- colour

def hx(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def toh(c):
    return '#%02x%02x%02x' % tuple(c[:3])


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def _toward(h, target, step):
    d = ((target - h + 180) % 360) - 180
    return (h + max(-step, min(step, d))) % 360


def ramp(base, n=5, mid=None, dark=0.16, light=0.14, hd=11, hl=8, sd=0.07, sl=0.13):
    """A hue-shifted ramp around `base`: shadows lean to blue-violet, lights to warm yellow."""
    mid = n // 2 if mid is None else mid
    r, g, b = [v / 255 for v in hx(base)]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    h *= 360
    out = []
    for i in range(n):
        k = i - mid
        if k < 0:
            hh = _toward(h if s > 0.04 else 235, 250, hd * -k)
            ss = min(1, max(s, 0.08) + sd * -k) if s > 0.04 else 0.06 * -k
            vv = max(0.05, v - dark * -k)
        elif k > 0:
            hh = _toward(h if s > 0.04 else 50, 55, hl * k)
            over = max(0, v + light * k - 1)
            ss = max(0, s - sl * k - over * 1.2)
            vv = min(1, v + light * k)
        else:
            hh, ss, vv = h, s, v
        c = colorsys.hsv_to_rgb(hh / 360, ss, vv)
        out.append(tuple(int(round(x * 255)) for x in c))
    return out


def R(*hexes):
    return [hx(h) for h in hexes]


GOLD = R('#4a2410', '#8c5016', '#cc8a22', '#f2c443', '#fff2a8')
STEEL = R('#23263a', '#465170', '#7b8aa8', '#b9c8de', '#f6faff')
IRON = R('#17151f', '#2c2b3a', '#474a5c', '#6c7386', '#a4adbd')
WOOD = R('#2b1610', '#542d1a', '#83502a', '#b07c40', '#d8aa62')
BONE = R('#463634', '#80695a', '#bba487', '#e4d5b2', '#fff9e8')
LEATHER = R('#26140f', '#4a2a1c', '#74452c', '#9e6a44', '#c69466')
STONE = R('#24232c', '#424250', '#676a74', '#92969a', '#c4c6c0')


# ---------------------------------------------------------------- shapes (sets of pixels)

def _grid():
    for y in range(N):
        for x in range(N):
            yield x, y


def ell(cx, cy, rx, ry, a=0.0):
    ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
    m = set()
    for x, y in _grid():
        px, py = x + .5 - cx, y + .5 - cy
        u, v = px * ca + py * sa, -px * sa + py * ca
        if (u / rx) ** 2 + (v / ry) ** 2 <= 1.0:
            m.add((x, y))
    return m


def disc(cx, cy, r):
    return ell(cx, cy, r, r)


def poly(pts):
    m = set()
    n = len(pts)
    for x, y in _grid():
        px, py = x + .5, y + .5
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = pts[i]
            xj, yj = pts[j]
            if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
                inside = not inside
            j = i
        if inside:
            m.add((x, y))
    return m


def _segd(px, py, x0, y0, x1, y1):
    dx, dy = x1 - x0, y1 - y0
    L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, ((px - x0) * dx + (py - y0) * dy) / L))
    return math.hypot(px - x0 - t * dx, py - y0 - t * dy), t


def seg(x0, y0, x1, y1, r, r1=None):
    """Capsule from (x0,y0) to (x1,y1); radius r, tapering to r1."""
    r1 = r if r1 is None else r1
    m = set()
    for x, y in _grid():
        d, t = _segd(x + .5, y + .5, x0, y0, x1, y1)
        if d <= r + (r1 - r) * t:
            m.add((x, y))
    return m


def rect(x0, y0, x1, y1):
    return {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}


def bez(p0, p1, p2, r0, r1, steps=60):
    m = set()
    pts = []
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        pts.append((x, y, r0 + (r1 - r0) * t))
    for x, y in _grid():
        for (bx, by, r) in pts:
            if math.hypot(x + .5 - bx, y + .5 - by) <= r:
                m.add((x, y))
                break
    return m


def bezpt(p0, p1, p2, t):
    return ((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
            (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])


def where(m, f):
    return {p for p in m if f(*p)}


def grow(m, n=1, d=D8):
    out = set(m)
    for _ in range(n):
        out |= {(x + dx, y + dy) for (x, y) in out for dx, dy in d}
    return {p for p in out if 0 <= p[0] < N and 0 <= p[1] < N}


def edge(m):
    return {p for p in m if any((p[0] + dx, p[1] + dy) not in m for dx, dy in D4)}


def bres(x0, y0, x1, y1):
    pts = []
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        pts.append((x0, y0))
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    return pts


# ---------------------------------------------------------------- sprite

class Sprite:
    def __init__(self):
        self.col = {}      # (x,y) -> rgb
        self.rp = {}       # (x,y) -> ramp
        self.ix = {}       # (x,y) -> index in ramp
        self.nol = set()   # pixels that get no outline
        self.glints = []

    def put(self, x, y, rp, i, noline=False):
        if 0 <= x < N and 0 <= y < N:
            i = max(0, min(len(rp) - 1, i))
            self.col[(x, y)] = rp[i]
            self.rp[(x, y)] = rp
            self.ix[(x, y)] = i
            if noline:
                self.nol.add((x, y))
            else:
                self.nol.discard((x, y))

    def putc(self, x, y, c, noline=True):
        self.put(x, y, [c], 0, noline)

    def shade(self, p, d):
        if p in self.col:
            self.put(p[0], p[1], self.rp[p], self.ix[p] + d, p in self.nol)

    def erase(self, m):
        for p in m:
            self.col.pop(p, None)
            self.rp.pop(p, None)
            self.ix.pop(p, None)
            self.nol.discard(p)

    def paint(self, m, rp, mode='bevel', cap=2, k=2.6, grad=0.5, base=None, lo=1, hi=None,
              zf=0.9, shadow=True, noline=False, sph=None, spec=0.0, flat=None, inv=False):
        """Fill mask `m` with ramp `rp`, lit from the top left.
        bevel: normals from a distance field (cap = how round); sphere: analytic dome over
        sph=(cx,cy,rx,ry); flat: one index. inv lights it as a hollow (cell, socket)."""
        m = {p for p in m if 0 <= p[0] < N and 0 <= p[1] < N}
        if not m:
            return m
        n = len(rp)
        base = n // 2 if base is None else base
        hi = n - 2 if hi is None else hi
        xs = [p[0] for p in m]
        ys = [p[1] for p in m]
        cx, cy = (min(xs) + max(xs) + 1) / 2, (min(ys) + max(ys) + 1) / 2
        sw, sh = max(2, max(xs) - min(xs) + 1), max(2, max(ys) - min(ys) + 1)
        if shadow:
            sh_px = set()
            for (x, y) in m:
                for dx, dy in ((1, 1), (0, 1), (1, 0)):
                    q = (x + dx, y + dy)
                    if q not in m and q in self.col:
                        sh_px.add(q)
        if mode == 'bevel':
            d = {}
            q = deque()
            for p in m:
                if any((p[0] + dx, p[1] + dy) not in m for dx, dy in D4):
                    d[p] = 1
                    q.append(p)
            while q:
                p = q.popleft()
                for dx, dy in D4:
                    nb = (p[0] + dx, p[1] + dy)
                    if nb in m and nb not in d:
                        d[nb] = d[p] + 1
                        q.append(nb)

            def h(p):
                return min(d.get(p, 0), cap)
        for (x, y) in m:
            if flat is not None:
                i = flat
            else:
                if mode == 'sphere':
                    scx, scy, srx, sry = sph
                    nx, ny = (x + .5 - scx) / srx, (y + .5 - scy) / sry
                    nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
                else:
                    nx = (h((x - 1, y)) - h((x + 1, y))) / 2
                    ny = (h((x, y - 1)) - h((x, y + 1))) / 2
                    nz = zf
                L = math.sqrt(nx * nx + ny * ny + nz * nz) or 1
                v = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / L
                if inv:
                    v = 2 * LIGHT[2] - v
                g = -(((x + .5 - cx) / sw) + ((y + .5 - cy) / sh)) * grad
                val = (v - LIGHT[2]) * k + g
                i = base + int(math.floor(val + 0.5))
                i = max(lo, min(hi, i))
                if spec and v > spec:
                    i = n - 1
            self.put(x, y, rp, i, noline)
        if shadow:
            for p in sh_px:
                self.shade(p, -1)
        return m

    def line(self, pts, rp, i, noline=False):
        for (x, y) in pts:
            self.put(x, y, rp, i, noline)

    def glint(self, x, y, big=False):
        self.glints.append((x, y, big))

    def gem(self, cx, cy, rx, ry, rp, glint=True):
        m = self.paint(ell(cx, cy, rx, ry), rp, mode='sphere', sph=(cx, cy, rx, ry), k=2.8,
                       spec=0.97, lo=0, hi=len(rp) - 2)
        if glint:
            hx_, hy_ = int(math.floor(cx - rx * 0.45)), int(math.floor(cy - ry * 0.45))
            if (hx_, hy_) in m:
                self.putc(hx_, hy_, WHITE, noline=False)
        return m

    # -- finishing
    def finish(self):
        """Selective outline: lit side gets the material's darkest tone, shadow side ink."""
        add = {}
        for x, y in _grid():
            if (x, y) in self.col:
                continue
            dark = None
            lit = None
            for dx, dy in D4:
                q = (x + dx, y + dy)
                if q in self.col and q not in self.nol:
                    rp = self.rp[q]
                    if dx == -1 or dy == -1:     # shape is up/left of us: we are its shadow side
                        dark = mix(rp[0], INK, 0.55)
                    else:
                        lit = lit or rp[0]
            c = dark or lit
            if c is not None:
                add[(x, y)] = c
        for p, c in add.items():
            self.col[p] = c
            self.rp[p] = [c]
            self.ix[p] = 0
        for (x, y, big) in self.glints:
            arm = (255, 244, 176)
            self.col[(x, y)] = WHITE
            for dx, dy in D4:
                self.col[(x + dx, y + dy)] = arm
                if big:
                    self.col[(x + 2 * dx, y + 2 * dy)] = (242, 196, 67)
        self.col = {p: c for p, c in self.col.items() if 0 <= p[0] < N and 0 <= p[1] < N}
        return self

    def rgba(self):
        return [[(self.col[(x, y)] + (255,)) if (x, y) in self.col else (0, 0, 0, 0)
                 for x in range(N)] for y in range(N)]


def glow_rgba(rgba, colour):
    """Pixel halo behind the item: three stepped rings in the signature colour."""
    c = hx(colour)
    solid = {(x, y) for y in range(N) for x in range(N) if rgba[y][x][3]}
    r1 = grow(solid, 1) - solid
    r2 = grow(solid, 2) - solid - r1
    r3 = grow(solid, 3, D4) - solid - r1 - r2
    out = [row[:] for row in rgba]
    light = mix(c, WHITE, 0.25)
    for (x, y) in r1:
        out[y][x] = light + (170,)
    for (x, y) in r2:
        out[y][x] = c + (96,)
    for (x, y) in r3:
        if (x + y) % 2 == 0:
            out[y][x] = c + (48,)
    return out


# ---------------------------------------------------------------- png

def write_png(path, rows):
    h = len(rows)
    w = len(rows[0])
    raw = b''.join(b'\x00' + bytes(v for px in row for v in px) for row in rows)

    def chunk(t, data):
        c = struct.pack('>I', len(data)) + t + data
        return c + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def upscale(rows, k):
    return [[px for px in row for _ in range(k)] for row in rows for _ in range(k)]



# ---------------------------------------------------------------- frames

def frame(active=False):
    W = 40
    px = [[(0, 0, 0, 0)] * W for _ in range(W)]
    g = GOLD
    inset = (20, 23, 31)
    for y in range(W):
        for x in range(W):
            if x in (0, W - 1) or y in (0, W - 1):
                c = (10, 8, 14)
            elif x in (1, W - 2) or y in (1, W - 2):
                c = g[3] if (x == 1 or y == 1) and not (x == W - 2 or y == W - 2) else g[1]
            elif x in (2, W - 3) or y in (2, W - 3):
                c = g[2] if (x == 2 or y == 2) and not (x == W - 3 or y == W - 3) else g[0]
            elif x == 3 or y == 3:
                c = (10, 11, 16)
            else:
                c = inset
                if x == W - 4 or y == W - 4:
                    c = (34, 38, 50)
                elif x == 4 or y == 4:
                    c = (14, 16, 22)
            px[y][x] = c + (255,)
    if active:
        # inner second gold line and a lit dais
        for i in range(5, W - 5):
            for (x, y) in ((i, 5), (5, i), (i, W - 6), (W - 6, i)):
                lit = x == 5 or y == 5
                px[y][x] = (g[2] if lit else g[1]) + (255,)
        for y in range(6, W - 6):
            for x in range(6, W - 6):
                d = ((x + .5 - 20) / 13) ** 2 + ((y + .5 - 32) / 4.2) ** 2
                if d <= 1:
                    px[y][x] = ((52, 46, 40) if d > 0.55 else (78, 66, 48)) + (255,)
                else:
                    t = max(0, 1 - math.hypot(x + .5 - 20, y + .5 - 20) / 18)
                    base = (26, 28, 38)
                    px[y][x] = mix(base, (60, 52, 40), t * 0.6) + (255,)
        for y in range(28, W - 6):
            for x in range(6, W - 6):
                d = ((x + .5 - 20) / 13) ** 2 + ((y + .5 - 32) / 4.2) ** 2
                if 0.78 < d <= 1 and y >= 32:
                    px[y][x] = (g[2] if x < 20 else g[1]) + (255,)
        for x in (19, 20):
            px[2][x] = (255, 255, 255, 255)
            px[1][x] = g[4] + (255,)
    for (cx, cy) in ((2, 2), (W - 3, 2), (2, W - 3), (W - 3, W - 3)):
        stud = R('#3a1a08', '#8c5016', '#cc8a22', '#f2c443', '#fff2a8')
        gemr = R('#4a0a20', '#9a1a48', '#e04070', '#ff9ab8', '#ffffff') if active else stud
        for dy in (-2, -1, 0, 1, 2):
            for dx in (-2, -1, 0, 1, 2):
                if abs(dx) + abs(dy) > 3:
                    continue
                x, y = cx + dx, cy + dy
                if not (0 <= x < W and 0 <= y < W):
                    continue
                if abs(dx) == 2 or abs(dy) == 2 or abs(dx) + abs(dy) == 3:
                    c = (10, 8, 14)
                else:
                    v = -dx - dy
                    rr = gemr if active and abs(dx) + abs(dy) <= 1 else stud
                    c = rr[2 + max(-2, min(2, v))]
                    if dx == -1 and dy == -1:
                        c = rr[4]
                px[y][x] = c + (255,)
    return px


def composite(dst, src, ox, oy):
    for y, row in enumerate(src):
        for x, s in enumerate(row):
            if not s[3]:
                continue
            X, Y = ox + x, oy + y
            if 0 <= Y < len(dst) and 0 <= X < len(dst[0]):
                d = dst[Y][X]
                a = s[3] / 255
                dst[Y][X] = tuple(int(round(s[i] * a + d[i] * (1 - a))) for i in range(3)) + (255,)


