#!/usr/bin/env python3
"""Legendary items for the idle auto-battler: concept models.

Paints every item on a 32 x 32 pixel grid with a small shape-and-light engine, then writes:
  x1/<id>.png, x1/<id>-glow.png      native 32 x 32
  png/<id>.png, png/<id>-glow.png    x6 nearest neighbour (192 x 192)
  frames (slot and active relic), four contact sheets and items.json.

Deterministic: no randomness, no network, no downloaded assets. PNGs are written with zlib, so
the items need nothing but Python 3. Pillow, when present, is used only for the contact sheets
(their text uses Pillow's built-in bitmap font).
"""
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


# ================================================================ items
# Coordinates: pixel (x, y) covers [x, x+1). Shapes stay inside 3..28 so the outline and the
# halo fit in the tile.

def sheaf(s):
    stalk = ramp('#b98a34')
    head = ramp('#e0b14a', light=0.12)
    rib = ramp('#b52a3c')
    tie = (16.0, 19.5)
    tops = [(6.0, 11.5), (9.0, 7.5), (12.5, 5.0), (16.5, 4.0), (20.5, 5.0), (24.0, 7.5),
            (27.0, 11.5)]
    lower = poly([(13, 19), (20, 19), (24, 29), (9, 29)])
    s.paint(lower, stalk, cap=3, grad=0.8)
    for (x, y) in lower:
        if y > 21 and (x % 2 == 0):
            s.shade((x, y), -1)
    for x in range(9, 25):
        if (x, 28) in lower:
            s.put(x, 28, stalk, 3 if x % 2 else 2)
    for t in tops:
        ux, uy = t[0] - tie[0], t[1] - tie[1]
        L = math.hypot(ux, uy)
        ux, uy = ux / L, uy / L
        s.paint(seg(tie[0], tie[1], t[0] - ux * 3, t[1] - uy * 3, 0.55), stalk, flat=2,
                shadow=False)
    for t in tops:
        ux, uy = t[0] - tie[0], t[1] - tie[1]
        L = math.hypot(ux, uy)
        ux, uy = ux / L, uy / L
        m = seg(t[0] - ux * 4.2, t[1] - uy * 4.2, t[0], t[1], 1.35, 0.8)
        s.paint(m, head, cap=2, k=2.4, grad=0.2)
        for (x, y) in m:
            if (x + y) % 2 == 0 and s.ix.get((x, y), 0) >= 2:
                s.shade((x, y), -1)
        ax, ay = int(t[0] + ux * 1.8), int(t[1] + uy * 1.8)
        s.put(ax, ay, head, 4, noline=True)
    s.paint(rect(12, 18, 20, 20), rib, cap=1, k=2)
    s.paint(poly([(14.5, 20), (11, 26), (13.5, 26.5), (16, 21)]), rib, cap=1)
    s.paint(poly([(17.5, 20), (21, 25.5), (19, 26.5), (16, 21)]), rib, cap=1)
    s.gem(16.5, 19.5, 2.2, 2.2, GOLD)
    s.glint(20, 4)


def vane(s):
    plaster = ramp('#d9cdb4')
    roof = ramp('#35629e')
    sail = ramp('#a9daf0', light=0.1)
    s.paint(poly([(11.5, 17), (20.5, 17), (23, 29), (9, 29)]), plaster, cap=3, grad=0.9)
    s.paint(rect(15, 24, 17, 28), WOOD, cap=1, base=1)
    s.put(16, 24, WOOD, 0)
    s.gem(16.0, 20.5, 1.2, 1.4, ramp('#5ab8e8'), glint=False)
    s.paint(poly([(9, 18), (16, 10.5), (23, 18)]), roof, cap=2, grad=0.7)
    s.line(bres(9, 17, 22, 17), GOLD, 3)
    hub = (16.0, 13.0)
    for ang in (45, 135, 225, 315):
        a = math.radians(ang)
        ux, uy = math.cos(a), -math.sin(a)
        px_, py_ = -uy, ux                       # perpendicular, sail side
        p0 = (hub[0] + ux * 2.5, hub[1] + uy * 2.5)
        p1 = (hub[0] + ux * 12.5, hub[1] + uy * 12.5)
        cloth = poly([p0, p1, (p1[0] + px_ * 3.6, p1[1] + py_ * 3.6),
                      (p0[0] + px_ * 3.0, p0[1] + py_ * 3.0)])
        s.paint(cloth, sail, cap=1, k=1.6, grad=0.6, shadow=False)
        for t in (5.0, 8.0, 11.0):
            for j in range(0, 4):
                x, y = hub[0] + ux * t + px_ * j, hub[1] + uy * t + py_ * j
                p = (int(x), int(y))
                if p in cloth:
                    s.shade(p, -1)
        s.paint(seg(hub[0], hub[1], p1[0], p1[1], 0.6), WOOD, flat=3, shadow=False)
    s.gem(16.0, 13.0, 2.0, 2.0, GOLD)
    s.glint(23, 9)


def anvil(s):
    hot = ramp('#ff7a26', light=0.13)
    body = poly([(3, 12.5), (8, 10), (28, 10), (28, 15), (23, 15), (21, 17), (11, 17),
                 (9, 15), (6, 14)])
    s.paint(body, IRON, cap=2, grad=0.6, base=2)
    s.paint(rect(12, 17, 20, 21), IRON, cap=2, base=2)
    s.paint(poly([(10, 22), (22, 22), (25, 26), (25, 28), (7, 28), (7, 26)]), IRON, cap=2,
            base=2, grad=0.6)
    for x in range(4, 28):
        if (x, 10) in body:
            s.put(x, 10, hot, 3 if x < 18 else 2)
        if (x, 11) in body:
            s.put(x, 11, hot, 2 if x < 16 else 1)
    for (x, y) in ((5, 12), (6, 12), (7, 11)):
        s.put(x, y, hot, 2)
    s.paint(rect(12, 19, 20, 19), GOLD, flat=3, shadow=False)
    s.put(12, 19, GOLD, 2)
    s.put(20, 19, GOLD, 1)
    s.paint(rect(8, 26, 24, 26), GOLD, flat=2, shadow=False)
    for (x, y) in ((14, 23), (15, 24), (16, 23), (17, 24), (18, 23)):
        s.put(x, y, hot, 3, noline=False)
    for (x, y, i) in ((12, 7, 3), (18, 5, 4), (22, 7, 3), (15, 3, 2), (25, 4, 2), (9, 6, 2)):
        s.put(x, y, hot, i, noline=True)
    s.glint(26, 10)


def cog(s):
    brass = ramp('#c09a3c')
    em = ramp('#2fd08a', light=0.12)
    teeth = set()
    for i in range(8):
        a = math.radians(i * 45 + 22.5)
        ux, uy = math.cos(a), math.sin(a)
        teeth |= seg(16 + ux * 9, 16 + uy * 9, 16 + ux * 12.2, 16 + uy * 12.2, 1.9)
    s.paint(teeth | disc(16, 16, 10.2), brass, cap=3, grad=0.7)
    inner = disc(16, 16, 7.2)
    s.paint(inner, brass, cap=2, inv=True, base=1, grad=0.4)
    for i in range(4):
        a = math.radians(i * 90 + 45)
        spoke = seg(16 + math.cos(a) * 3, 16 + math.sin(a) * 3,
                    16 + math.cos(a) * 7, 16 + math.sin(a) * 7, 1.1)
        s.paint(spoke, GOLD, cap=1, k=2)
    s.paint(disc(16, 16, 4.6), GOLD, cap=2, k=2.4)
    s.gem(16.0, 16.0, 3.0, 3.0, em)
    for i in range(4):
        a = math.radians(i * 90)
        s.put(int(16 + math.cos(a) * 8.6), int(16 + math.sin(a) * 8.6), STEEL, 3)
    s.glint(9, 7)


def conch(s):
    shell = ramp('#eaa47e', light=0.1)
    band = ramp('#b85a3a')
    pink = R('#7a1a3a', '#c8486a', '#ff8fa6', '#ffc4cc', '#fff0f0')
    spire = poly([(14, 10), (27.5, 3.5), (22, 15)])
    body = ell(14.5, 16.5, 9.0, 8.2, -30) | spire | seg(10, 22, 4.5, 28.5, 2.0, 0.8)
    s.paint(body, shell, cap=3, grad=0.9)
    # whorl lines on the spire and bands on the body
    for (a, b) in (((18, 8), (21, 13)), ((21, 6), (24, 10)), ((24, 5), (25.5, 7))):
        for p in bres(int(a[0]), int(a[1]), int(b[0]), int(b[1])):
            if p in body:
                s.put(p[0], p[1], shell, 1)
                if (p[0] - 1, p[1]) in body:
                    s.put(p[0] - 1, p[1], shell, 3)
    for (x, y) in body:
        if (x - y) % 7 == 0 and 12 < x + y < 36 and s.ix[(x, y)] >= 2:
            s.put(x, y, band, 2 if s.ix[(x, y)] >= 3 else 1)
    # knobs on the shoulder, gold tipped
    for (x, y, dx, dy) in ((9, 9, -2, -2), (13, 7, -1, -3), (17.5, 6, 0, -3)):
        s.paint(poly([(x - 1.2, y + 1.5), (x + dx, y + dy), (x + 1.8, y + 1)]), shell, cap=1,
                base=3, k=2)
        s.put(int(x + dx * 0.7), int(y + dy * 0.7), GOLD, 3)
    # aperture with a flared lip
    lip = ell(10.5, 19.5, 7.6, 4.4, -50) | poly([(4, 13), (7, 11.5), (9, 16), (5, 19)])
    s.paint(lip, pink, cap=2, k=2.2, base=3, grad=0.6)
    s.paint(ell(11.5, 18.5, 4.2, 1.9, -50), pink, cap=2, inv=True, base=1, lo=0, hi=2)
    for (x, y) in edge(lip):
        if x + y < 26:
            s.put(x, y, GOLD, 3)
    s.putc(7, 15, WHITE, noline=False)
    s.glint(26, 4)


def stormglass(s):
    sea = ramp('#2f86d0', light=0.12)
    air = ramp('#36435e')
    glass = ell(16, 19.5, 8.5, 8.5) | rect(13, 8, 18, 12)
    s.paint(glass, air, cap=2, grad=0.5, base=2)
    water = where(glass, lambda x, y: y >= 19 + (1 if x % 6 < 3 else 0))
    s.paint(water, sea, cap=3, grad=0.7, k=2.2)
    for x in range(8, 25):
        y = 19 + (1 if x % 6 < 3 else 0)
        if (x, y) in water:
            s.put(x, y, sea, 4)
    cloud = disc(13, 14.5, 2.4) | disc(16.5, 13.5, 2.8) | disc(19.5, 15, 2.2)
    s.paint(cloud, STONE, cap=1, base=3, k=1.5, shadow=False)
    for (x, y) in ((16, 16), (15, 17), (16, 17), (17, 17), (16, 18)):
        s.putc(x, y, (255, 236, 120), noline=False)
    for y in range(12, 25):
        if (10, y) in glass:
            s.putc(10, y, (220, 240, 255), noline=False)
    s.putc(11, 13, WHITE, noline=False)
    s.paint(rect(12, 4, 19, 7), GOLD, cap=2, k=2.2)
    s.paint(rect(14, 2, 17, 3), GOLD, cap=1)
    s.paint(poly([(9, 26.5), (23, 26.5), (25, 29), (7, 29)]), GOLD, cap=2, k=2.2)
    for y in range(13, 27):
        for x in (12, 20):
            if (x, y) in glass and (x, y + 1) in glass:
                s.put(x, y, GOLD, 2 if x == 12 else 1)
    s.glint(21, 4)


def acorn(s):
    nut = ramp('#b8822e', light=0.13)
    cap = ramp('#6a4426')
    leaf = ramp('#5ab040', light=0.12)
    s.paint(bez((21, 10), (25, 4), (28.5, 9), 2.6, 0.6) | ell(24, 9, 4.2, 2.6, -35), leaf, cap=2,
            grad=0.8)
    for p in bres(19, 11, 27, 8):
        if p in s.col:
            s.put(p[0], p[1], leaf, 1)
    m = ell(15.5, 19.5, 8.2, 9.2)
    s.paint(m, nut, mode='sphere', sph=(15.5, 19.5, 8.2, 9.2), k=3.0, spec=0.95)
    s.paint(poly([(14.5, 27), (16.5, 27), (15.5, 30)]), nut, cap=1, base=1)
    cm = ell(15.5, 12.0, 10.2, 5.4) - rect(0, 15, 31, 31)
    cm |= ell(15.5, 14.0, 10.2, 1.6)
    s.paint(cm, cap, cap=3, grad=0.6, k=2.2)
    for (x, y) in cm:
        if (x + 2 * y) % 4 == 0 and s.ix[(x, y)] >= 1:
            s.shade((x, y), -1)
        elif (x + 2 * y) % 4 == 2 and y < 13:
            s.shade((x, y), +1)
    for x in range(6, 26):
        if (x, 15) in cm and (x, 16) in m:
            s.put(x, 15, GOLD, 3 if x < 15 else 2)
    s.paint(seg(15.5, 7.5, 17.5, 3.5, 0.9), WOOD, cap=1)
    s.putc(11, 17, WHITE, noline=False)
    s.glint(7, 9)


def horn(s):
    ivory = ramp('#d9c491', light=0.11)
    strap = ramp('#3f7a3a')
    p0, p1, p2 = (8.5, 9.5), (7.5, 27.0), (27.0, 24.0)
    body = bez(p0, p1, p2, 5.2, 1.0)
    s.paint(body, ivory, cap=3, grad=0.5)
    samples = [(bezpt(p0, p1, p2, i / 200), i / 200) for i in range(201)]
    for (x, y) in body:
        t = min(samples, key=lambda q: (q[0][0] - x - .5) ** 2 + (q[0][1] - y - .5) ** 2)[1]
        f = (t * 9) % 1
        if t > 0.12 and f < 0.13:
            s.shade((x, y), -1)
        elif t > 0.12 and f < 0.26 and s.ix[(x, y)] < 3:
            s.shade((x, y), 1)
    mouth = ell(8.5, 7.5, 5.6, 2.6, -8)
    s.paint(mouth, GOLD, cap=2, k=2.2)
    s.paint(ell(8.6, 7.4, 3.8, 1.3, -8), R('#140c14', '#2a1622', '#4a2830'), inv=True, base=1,
            cap=1, lo=0, hi=2)
    tip = bez(bezpt(p0, p1, p2, 0.9), (26, 24), (28.0, 23.5), 1.6, 1.1)
    s.paint(tip, GOLD, cap=1, k=2)
    band = set()
    for t in (0.47,):
        x, y = bezpt(p0, p1, p2, t)
        band = disc(x, y, 3.6) & body
    s.paint(band, GOLD, cap=2, k=2.2)
    sp = bez((10.5, 15), (19, 13), (22, 21.5), 0.75, 0.75)
    s.paint(sp - body, strap, cap=1, k=1.5)
    s.glint(4, 5)


def codex(s):
    page = ramp('#e8dcc0', light=0.08)
    cover = ramp('#4e3a9e')
    rune = R('#5a3ad0', '#8a6aff', '#b9a6ff', '#e6dcff')
    cv = poly([(3, 14), (15.5, 18), (28, 14), (28.5, 25), (16, 29.5), (3.5, 25)])
    s.paint(cv, cover, cap=2, base=2, grad=0.6)
    lp = poly([(4, 12.5), (9, 11), (15.5, 14.5), (15.5, 26.5), (9, 23.5), (4.5, 24)])
    rp_ = poly([(16.5, 14.5), (23, 11), (28, 12.5), (27.5, 24), (23, 23.5), (16.5, 26.5)])
    s.paint(lp, page, cap=2, k=1.8, grad=0.7, base=3, hi=4)
    s.paint(rp_, page, cap=2, k=1.8, grad=0.7, base=2)
    for (x, y) in lp | rp_:
        if 15 <= x <= 16:
            s.shade((x, y), -1)
    rows = [(6, 15, 13), (6, 17, 13), (6, 19, 12), (6, 21, 12), (18, 16, 26), (18, 18, 26),
            (18, 20, 25), (18, 22, 25)]
    for (x0, y0, x1) in rows:
        for x in range(x0, x1 + 1):
            yy = y0 + (1 if (x0 < 15 and x > 10) or (x0 > 15 and x < 21) else 0)
            if (x * 7 + y0) % 5 != 0 and (x, yy) in (lp | rp_):
                s.put(x, yy, rune, 1)
    for (x, y) in ((3, 25), (28, 25), (16, 29)):
        s.paint(disc(x + .5, y + .5, 1.6), GOLD, cap=1)
    glyphs = [((9, 4), [(0, 0), (1, 0), (2, 0), (1, 1), (1, 2), (0, 3), (2, 3)]),
              ((15, 2), [(1, 0), (0, 1), (2, 1), (1, 2), (1, 3)]),
              ((21, 5), [(0, 0), (0, 1), (1, 1), (2, 1), (2, 2), (2, 3)])]
    for (ox, oy), pts in glyphs:
        for (dx, dy) in pts:
            s.put(ox + dx, oy + dy, rune, 2, noline=True)
    s.glint(26, 10)


def prism(s):
    mg = ramp('#e050c8', light=0.12)
    ring_back = where(ell(16, 17, 13, 4) - ell(16, 17, 11.2, 2.6), lambda x, y: y < 17)
    ring_front = where(ell(16, 17, 13, 4) - ell(16, 17, 11.2, 2.6), lambda x, y: y >= 17)
    s.paint(ring_back, GOLD, cap=1, base=1, k=1.6)
    top, ul, ur, ll, lr, bot = (16, 2.5), (9.5, 10), (22.5, 10), (9.5, 22), (22.5, 22), (16, 29)
    s.paint(poly([top, ul, (16, 12)]), mg, flat=4)
    s.paint(poly([top, (16, 12), ur]), mg, flat=2)
    s.paint(poly([ul, (16, 12), (16, 23), ll]), mg, flat=3)
    s.paint(poly([(16, 12), ur, lr, (16, 23)]), mg, flat=1)
    s.paint(poly([ll, (16, 23), bot]), mg, flat=2)
    s.paint(poly([(16, 23), lr, bot]), mg, flat=0)
    for p in bres(12, 9, 12, 19):
        s.putc(p[0], p[1], mix(mg[4], WHITE, 0.5), noline=False)
    s.putc(13, 6, WHITE, noline=False)
    s.paint(ring_front, GOLD, cap=1, k=2)
    for x in (5, 27):
        s.gem(x + .5, 17.5, 1.3, 1.3, ramp('#62e0f0'), glint=False)
    s.glint(19, 5)


# ---- boss relics

def skrix(s):
    flame = R('#0b6a68', '#1fb8a0', '#50f0d0', '#b8fff0', '#ffffff')
    rag = ramp('#3b4a8c')
    ring = ell(16, 5, 4.2, 3.2) - ell(16, 5, 2.4, 1.6)
    s.paint(ring, IRON, cap=1, base=3)
    s.paint(poly([(10, 10), (22, 10), (19.5, 6.8), (12.5, 6.8)]), IRON, cap=2, base=2)
    s.paint(rect(11, 9, 21, 9), GOLD, flat=3, shadow=False)
    s.paint(rect(11, 11, 21, 24), flame, cap=3, base=1, lo=0, hi=2, k=1.8, grad=0.4)
    s.paint(ell(16.5, 18.5, 3.2, 4.6) | poly([(15, 15), (18.5, 11.5), (18, 16)]), flame, cap=2,
            base=3, lo=2, hi=4, k=2)
    s.putc(16, 19, WHITE, noline=False)
    s.putc(16, 20, WHITE, noline=False)
    for x in (10, 16, 22):
        s.paint(rect(x, 10, x, 25) if x != 16 else rect(16, 10, 16, 13), IRON, flat=3 if x == 10
                else 2, shadow=False)
    s.paint(rect(10, 24, 22, 25), IRON, cap=1, base=2)
    s.paint(poly([(9, 26), (23, 26), (21.5, 29), (10.5, 29)]), GOLD, cap=2, k=2.2)
    for (x, y) in ((22, 14), (21, 15)):
        s.put(x, y, IRON, 1)
    s.paint(poly([(19, 5), (24, 5.5), (27, 12), (25, 13.5), (23.5, 9), (21, 7.5)]), rag, cap=1,
            k=2)
    s.put(26, 13, rag, 1)
    s.paint(disc(25.5, 16.5, 1.8), GOLD, cap=1)
    s.put(25, 15, IRON, 2)
    s.glint(9, 8)


def thruska(s):
    purple = R('#3a1458', '#6a2c98', '#a45ad8', '#c47cf4', '#f0d8ff')
    paint = ramp('#5f8a35')
    jaw = seg(8.5, 9, 10, 21, 2.2) | seg(23.5, 9, 22, 21, 2.2)
    jaw |= (ell(16, 20.5, 8.6, 7.5) - ell(16, 19, 5.6, 5.0)) - rect(0, 0, 31, 18)
    s.paint(jaw, BONE, cap=2, grad=0.6)
    for (x, y) in ((12, 22), (14, 23), (16, 24), (18, 23), (20, 22)):
        s.paint(poly([(x - .2, y + 1.6), (x + 1.2, y + 1.6), (x + .5, y - .6)]), BONE, flat=4,
                shadow=False)
        s.put(x, y + 1, BONE, 3)
    for (x, y) in ((8, 15), (9, 16), (23, 15), (22, 16), (8, 18), (23, 18)):
        s.put(x, y, paint, 2)
    for x in (12, 14, 16, 18, 20):
        for y in range(9, 22):
            if (x, y) not in s.col or s.rp.get((x, y)) is purple:
                if y < 22 - (2 if x in (12, 20) else 0):
                    s.put(x, y, purple, 3 if y % 4 else 4, noline=True)
    hole = ell(16, 19, 5.6, 5.0)
    for (x, y) in sorted(jaw):
        if y >= 18 and any((x + dx, y + dy) in hole for dx, dy in D4):
            s.put(x, y, BONE, 4 if (x + y) % 2 == 0 else 1)
    s.paint(seg(5.5, 7.5, 26.5, 7.5, 1.2), GOLD, cap=2, k=2)
    s.gem(5.5, 7.5, 2.0, 2.0, purple)
    s.gem(26.5, 7.5, 2.0, 2.0, purple)
    s.paint(seg(16, 27, 16, 29.2, 0.6), LEATHER, flat=2)
    s.paint(seg(10, 25.5, 9, 28.5, 0.6), LEATHER, flat=2)
    s.gem(9.0, 28.5, 1.4, 1.4, purple, glint=False)
    s.paint(ell(16, 29.0, 1.4, 1.2), BONE, flat=3)
    s.glint(23, 4)


def hessa(s):
    ice = R('#1c3a6a', '#3a78b0', '#6ab8e0', '#a8ecff', '#f0ffff')
    heart = disc(11, 13, 6.0) | disc(21, 13, 6.0) | poly([(5.2, 14.5), (26.8, 14.5), (16, 28)])
    heart -= poly([(14.5, 6), (17.5, 6), (16, 10)])
    s.paint(heart, ice, cap=4, grad=1.0, k=2.6)
    for (a, b) in (((9, 9), (16, 17)), ((16, 17), (16, 26)), ((6, 15), (16, 17)),
                   ((16, 17), (24, 9)), ((26, 15), (16, 17))):
        for p in bres(a[0], a[1], b[0], b[1]):
            if p in heart and p not in edge(heart):
                s.put(p[0], p[1], ice, 4 if p[0] < 16 and p[1] < 17 else 1)
    for (x, y) in ((8, 10), (9, 10), (8, 11), (12, 9)):
        s.put(x, y, ice, 4)
    s.paint(disc(16, 17.2, 2.0), R('#c8f4ff', '#ffffff', '#ffffff'), flat=1, shadow=False)
    for m in (poly([(21.5, 8), (23.5, 3.5), (24.5, 8.5)]), poly([(25.5, 11), (28.5, 8.5),
                                                               (27, 13)]),
              poly([(6, 17), (3, 18.5), (6.5, 19.5)])):
        s.paint(m, ice, cap=1, base=3, hi=4, k=2)
    bail = disc(16, 6.5, 2.4) - disc(16, 6.5, 1.0)
    s.paint(bail, GOLD, cap=1, k=2)
    s.paint(seg(16, 9, 16, 10.5, 1.0), GOLD, cap=1)
    s.paint(ell(16, 2.4, 1.8, 1.4), BONE, cap=1, base=3)
    s.glint(10, 10)


def ilse(s):
    wax = ramp('#7a3f86', light=0.12)
    fl = R('#c04010', '#f08a20', '#ffd040', '#fff6b0', '#ffffff')
    s.paint(ell(16, 28.5, 6, 1.6) | rect(14, 25, 18, 28), GOLD, cap=2, k=2)
    s.paint(ell(16, 25, 9.5, 2.4), GOLD, cap=2, k=2.2)
    ringm = disc(26.5, 25, 2.6) - disc(26.5, 25, 1.2)
    s.paint(ringm, GOLD, cap=1)
    candle = rect(12, 10, 19, 24)
    s.paint(candle, wax, cap=3, grad=0.3, k=2.4)
    s.paint(ell(15.5, 10.5, 4.2, 1.4), wax, flat=3, shadow=False)
    s.paint(ell(15.5, 10.6, 2.4, 0.8), wax, flat=1, shadow=False)
    for (x, y0, y1) in ((12, 10, 15), (14, 11, 13), (17, 11, 18), (19, 10, 13)):
        for y in range(y0, y1 + 1):
            s.put(x, y, wax, 4 if x < 16 else 3)
    s.put(11, 14, wax, 3)
    s.put(11, 15, wax, 3)
    s.put(20, 12, wax, 2)
    s.put(20, 13, wax, 2)
    s.put(15, 8, IRON, 0)
    s.put(15, 9, IRON, 1)
    s.paint(ell(15.5, 5.5, 2.6, 3.8) | poly([(14, 4), (16.5, -0.5), (17.5, 4)]), fl, cap=2, base=2,
            k=2, hi=3, noline=False)
    s.paint(ell(15.5, 6.0, 1.2, 2.0), fl, flat=4, shadow=False)
    for i, (x, y) in enumerate(((8, 27), (8, 28), (9, 29), (23, 27), (24, 28), (24, 29))):
        s.put(x, y, STEEL, 3 if i % 2 == 0 else 1)
    s.glint(20, 8)


def ossric(s):
    soul = R('#183a7a', '#2a6ac0', '#4aa0f0', '#8ad8ff', '#e8fbff')
    horns = bez((7, 19), (3, 13), (6, 6.5), 2.0, 0.7) | bez((25, 19), (29, 13), (26, 6.5), 2.0, 0.7)
    s.paint(horns, BONE, cap=2, grad=0.6)
    spikes = set()
    for (x, h) in ((10.5, 10.5), (16, 4.5), (21.5, 10.5)):
        spikes |= poly([(x - 2.2, 18), (x, h), (x + 2.2, 18)])
    s.paint(spikes, BONE, cap=2, grad=0.5)
    for (x, h) in ((10.5, 10.5), (16, 4.5), (21.5, 10.5)):
        s.paint(disc(x, h + 1.0, 1.0), BONE, flat=4, shadow=False)
    band = poly([(6, 18), (26, 18), (26.5, 24), (16, 26), (5.5, 24)])
    s.paint(band, GOLD, cap=2, grad=0.6)
    for x in range(7, 26, 3):
        s.paint(ell(x + .5, 21.3, 1.2, 1.5), BONE, cap=1, base=3)
    s.gem(16.0, 21.5, 2.4, 2.6, soul)
    s.paint(ell(16, 13.5, 2.6, 2.8), BONE, cap=1, base=3)
    s.put(15, 13, soul, 3, noline=True)
    s.put(17, 13, soul, 3, noline=True)
    s.put(16, 15, BONE, 1)
    s.glint(23, 8)


def varesh(s):
    blood = R('#3a0610', '#781426', '#b8322f', '#e8463c', '#ff9a8a')
    bowl = ell(16, 7, 9.2, 9.5) - rect(0, 0, 31, 5)
    s.paint(bowl, STEEL, cap=3, grad=0.6)
    s.paint(ell(16, 6.5, 9.0, 2.2), STEEL, cap=1, base=3, shadow=False)
    s.paint(ell(16, 6.6, 7.4, 1.4), blood, cap=1, base=2, k=1.5, shadow=False)
    s.put(13, 6, blood, 4)
    s.paint(rect(7, 10, 25, 10), GOLD, flat=3, shadow=False)
    for (x, y) in ((7, 10), (25, 10)):
        s.put(x, y, GOLD, 1)
    s.gem(16.0, 12.5, 1.8, 1.8, blood)
    s.paint(rect(15, 16, 17, 25), STEEL, cap=2, grad=0.2)
    s.paint(ell(16, 20, 3.0, 1.8), GOLD, cap=1, k=2)
    s.paint(ell(16, 27.5, 8.2, 2.4) | poly([(13, 25), (19, 25), (22, 27), (10, 27)]), STEEL,
            cap=2, k=2.4)
    s.paint(rect(9, 28, 23, 28) & ell(16, 27.5, 8.2, 2.4), GOLD, flat=2, shadow=False)
    for (x, y, i) in ((23, 8, 2), (23, 9, 2), (24, 10, 3), (23, 11, 2), (23, 12, 1),
                      (23, 13, 2)):
        s.put(x, y, blood, i)
    s.put(23, 14, blood, 3)
    s.glint(9, 4)


def vorzhaal(s):
    magma = R('#5a0a10', '#b02818', '#f0601c', '#ffaa30', '#fff0a0')
    crust = R('#1a0c10', '#3a1a18', '#5a2a1c')
    claw = IRON
    back = bez((11.5, 23), (5, 18), (7, 7.5), 2.4, 0.6) | bez((20.5, 23), (27, 18),
                                                              (25, 7.5), 2.4, 0.6)
    s.paint(back, claw, cap=2, base=2, k=2.6)
    orb = disc(16, 13.5, 7.4)
    s.paint(orb, magma, mode='sphere', sph=(16, 13.5, 7.4, 7.4), k=3.0, spec=0.96, lo=0)
    for pts in ([(11, 12), (13, 13), (14, 15), (13, 18)], [(17, 8), (18, 10), (20, 11),
                                                          (22, 10)],
                [(18, 16), (20, 18), (19, 20)]):
        for a, b in zip(pts, pts[1:]):
            for p in bres(a[0], a[1], b[0], b[1]):
                if p in orb and s.ix[p] < 3:
                    s.put(p[0], p[1], crust, 1)
    front = bez((14, 24.5), (10, 20), (12, 15), 2.0, 0.6) | bez((18, 24.5), (22.5, 20),
                                                                  (20.5, 15), 2.0, 0.6)
    s.paint(front, claw, cap=2, base=3, k=2.6)
    for (x, y) in ((11, 19), (21, 19), (7, 15), (25, 15)):
        s.paint(disc(x + .5, y + .5, 1.1), GOLD, cap=1, k=2)
    for (x, y) in ((12, 15), (20, 15), (7, 8), (25, 8)):
        s.put(x, y, BONE, 4)
    s.paint(poly([(11, 22), (21, 22), (20, 29), (12, 29)]), claw, cap=2, base=2, grad=0.6)
    s.paint(rect(11, 24, 21, 25), GOLD, cap=1, k=2)
    s.gem(16.0, 24.5, 1.6, 1.6, magma, glint=False)
    for (x, y, i) in ((9, 4, 3), (23, 3, 2), (14, 4, 3), (28, 12, 2), (4, 13, 2)):
        s.put(x, y, magma, i, noline=True)
    s.glint(12, 9)


def glimmerdeep(s):
    eggr = R('#3a1e10', '#7a4a14', '#b8862a', '#e8bc4a', '#fff0a8')
    teal = R('#0c3a3c', '#1a6a66', '#3aa8a0', '#6adcc8', '#d0fff0')
    egg = ell(16, 15, 8.4, 11)
    s.paint(egg, eggr, mode='sphere', sph=(16, 15, 8.4, 11), k=2.8, spec=0.95)
    for row, y in enumerate(range(8, 26, 3)):
        off = 0 if row % 2 == 0 else 2
        for x in range(4 + off, 29, 4):
            for (dx, dy) in ((0, 0), (1, 1), (2, 1), (3, 0)):
                p = (x + dx, y + dy)
                if p in egg and p not in edge(egg):
                    s.shade(p, -1)
                    q = (p[0], p[1] - 1)
                    if q in egg and dx in (1, 2) and s.ix[q] < 3:
                        s.shade(q, 1)
    crack = bres(18, 5, 20, 8) + bres(20, 8, 18, 11) + bres(18, 11, 21, 14) + bres(21, 14, 20, 17)
    for p in crack:
        if p in egg:
            s.put(p[0], p[1], teal, 3, noline=False)
            if (p[0] + 1, p[1]) in egg:
                s.put(p[0] + 1, p[1], teal, 1, noline=False)
    s.put(20, 8, teal, 4)
    s.put(18, 11, teal, 4)
    for (x, y) in ((10, 20), (14, 23), (22, 20)):
        s.gem(x + .5, y + .5, 1.0, 1.0, teal, glint=False)
    coins = [(7.5, 26.5), (11.5, 27.5), (16, 27.8), (20.5, 27.5), (24.5, 26.5), (9.5, 24.5),
             (22.5, 24.5)]
    for (x, y) in coins:
        s.paint(ell(x, y, 2.4, 1.4), GOLD, cap=1, k=2.2)
        s.put(int(x) - 1, int(y) - 1, GOLD, 4)
    s.glint(11, 7)


def skein(s):
    silk = R('#5a5070', '#9a90b0', '#d4ccdf', '#f2eef8', '#ffffff')
    red = R('#5a0a14', '#a01c28', '#e0303c', '#ff7a7a', '#ffd0d0')
    s.paint(seg(6.5, 27.5, 25.5, 5.5, 0.9), WOOD, cap=1, base=2)
    s.paint(ell(8.5, 25.0, 4.4, 1.8, -49), GOLD, cap=1, k=2.2)
    s.paint(seg(25.0, 6.0, 27.0, 3.8, 1.0), GOLD, cap=1)
    bundle = ell(16.5, 15.5, 8.6, 6.4, -49)
    s.paint(bundle, silk, cap=4, grad=0.7, k=2.2)
    for i in range(-12, 14, 3):
        for p in bres(10 + i, 10, 22 + i, 22):
            if p in bundle and p not in edge(bundle):
                s.shade(p, -1)
                q = (p[0] - 1, p[1])
                if q in bundle and q not in edge(bundle) and s.ix[q] >= 2:
                    s.shade(q, 1)
    hour = [(15, 12), (16, 12), (17, 12), (18, 12), (16, 13), (17, 13), (16, 14), (17, 14),
            (15, 15), (16, 15), (17, 15), (18, 15)]
    for (x, y) in hour:
        s.put(x, y, red, 2, noline=False)
    s.put(15, 12, red, 3)
    s.put(16, 13, red, 3)
    for p in bres(22, 20, 24, 24) + bres(24, 24, 24, 26):
        s.put(p[0], p[1], silk, 3, noline=True)
    s.paint(disc(24.5, 28.0, 1.6), IRON, cap=1, base=1)
    s.put(24, 28, red, 3)
    for (x, y) in ((22, 27), (22, 29), (27, 27), (27, 29)):
        s.put(x, y, IRON, 1, noline=True)
    s.glint(10, 9)


def zarra(s):
    wax = R('#4a2208', '#8a4a10', '#c88020', '#f0b030', '#fff0a0')
    honey = R('#6a2a04', '#b85a08', '#ffa818', '#ffd860', '#fffbe0')

    def hexm(cx, cy, r):
        return poly([(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
                     for a in range(30, 390, 60)])
    cells = [(16, 16.5)] + [(16 + 8.2 * math.cos(math.radians(a)),
                             16.5 + 8.2 * math.sin(math.radians(a))) for a in range(0, 360, 60)]
    cells = [c for c in cells if not (c[1] < 10 and c[0] < 12)]
    for (cx, cy) in cells:
        s.paint(hexm(cx, cy, 4.9), wax, cap=2, k=2.4, grad=0.5)
        s.paint(hexm(cx, cy, 3.1), honey, cap=2, inv=True, base=2, k=2.2, hi=3)
        s.put(int(cx) + 1, int(cy) + 1, honey, 4)
    s.paint(seg(20.5, 25, 20.5, 29.5, 1.0, 0.7) | disc(20.5, 29.2, 1.2), honey, cap=1, base=3)
    crown = poly([(6, 9), (6, 4), (7.5, 6), (9, 3), (10.5, 6), (12, 4), (12, 9)])
    s.paint(crown, GOLD, cap=1, k=2)
    s.put(9, 7, ramp('#d0303c'), 3)
    s.glint(25, 8)


def warden(s):
    eye = R('#0a4a5a', '#1a90a8', '#40d0e8', '#a0f8ff', '#ffffff')
    bow = disc(10, 10, 7) - disc(10, 10, 4.2)
    s.paint(bow, STEEL, cap=2, grad=0.6)
    for a in range(0, 360, 45):
        x, y = 10 + math.cos(math.radians(a)) * 5.6, 10 + math.sin(math.radians(a)) * 5.6
        s.put(int(x), int(y), GOLD, 3)
    s.paint(disc(10, 10, 3.4), IRON, cap=2, inv=True, base=1)
    s.gem(10.0, 10.0, 2.2, 2.2, eye)
    s.paint(seg(14.5, 14.5, 26, 26, 1.6), STEEL, cap=2)
    s.paint(seg(14.0, 14.0, 16.5, 16.5, 2.4), GOLD, cap=2, k=2.2)
    bit = poly([(20, 25), (24, 21), (28.5, 25.5), (24.5, 29.5)])
    s.paint(bit, STEEL, cap=2)
    s.erase({(25, 26), (26, 27), (24, 27)} | {(23, 26)})
    for (x, y) in ((22, 25), (25, 24), (26, 25)):
        s.put(x, y, eye, 3, noline=False)
    s.glint(4, 4)


def thistle(s):
    rose = R('#4a0a28', '#9a1a48', '#e04070', '#ff7aa0', '#ffd8e4')
    leaf = ramp('#3a7a34')
    stem = bez((7, 28.5), (11, 19), (17.5, 15), 1.1, 1.0)
    s.paint(stem, leaf, cap=1, base=1, k=1.5)
    for (x, y, dx, dy) in ((8, 25, -2, -1), (10, 21, 2, 0), (12, 18, -2, -1), (14, 17, 1, 2)):
        s.put(x + dx, y + dy, BONE, 2)
    s.paint(ell(6.5, 19.5, 4.2, 2.0, -50), leaf, cap=2, k=2.2)
    s.paint(ell(16, 22.5, 4.4, 2.0, 30), leaf, cap=2, k=2.2)
    for p in bres(4, 22, 9, 17) + bres(13, 21, 19, 24):
        if p in s.col and s.rp[p] is leaf:
            s.put(p[0], p[1], leaf, 1)
    s.paint(seg(9.5, 23, 11.5, 24.5, 1.2), GOLD, cap=1)
    cx, cy = 19.5, 10.5
    bloom = ell(cx, cy, 7.6, 7.0) | poly([(13, 12), (12, 16), (16, 16.5)])
    s.paint(bloom, rose, mode='sphere', sph=(cx, cy, 7.6, 7.6), k=2.0, base=2, lo=1)
    # spiral of petal edges: dark fold with a lit lip just outside it
    th = 0.0
    while th < 6 * math.pi:
        r = 0.6 + th * 0.36
        x, y = cx + math.cos(th) * r, cy + math.sin(th) * r * 0.92
        p = (int(math.floor(x)), int(math.floor(y)))
        if p in bloom and p not in edge(bloom):
            s.put(p[0], p[1], rose, 0 if r < 3 else 1)
            ox, oy = math.cos(th), math.sin(th)
            q = (int(math.floor(x + ox * 1.0)), int(math.floor(y + oy * 1.0)))
            if q in bloom and s.ix.get(q, 0) >= 1 and s.rp.get(q) is rose and s.ix[q] != 0:
                if ox + oy < 0.4:
                    s.put(q[0], q[1], rose, 4 if ox + oy < -0.8 else 3)
        th += 0.12
    for (x, y) in ((14, 6), (15, 5)):
        s.put(x, y, rose, 4)
    s.putc(24, 14, (220, 255, 250), noline=False)
    s.glint(26, 4)


def oathbreaker(s):
    rift = R('#1a2a8a', '#3a6ae0', '#8ab8ff', '#d8ecff', '#ffffff')
    blade = seg(12.5, 19.5, 24.5, 7.5, 2.3, 1.9) | poly([(23, 6), (28.5, 3.5), (26, 9)])
    s.paint(blade, STEEL, cap=2, grad=0.4, k=2.6)
    for p in bres(14, 18, 24, 8):
        if p in blade:
            s.put(p[0], p[1], STEEL, 1)
    for p in bres(13, 18, 23, 8):
        if p in blade:
            s.put(p[0], p[1], STEEL, 4 if p[0] % 3 else 3)
    crack = [(17, 12), (18, 13), (19, 13), (19, 14), (20, 15)]
    for (x, y) in crack:
        if (x, y) in blade:
            s.put(x, y, rift, 3)
    s.put(18, 13, rift, 4)
    s.paint(seg(8.5, 16.0, 16.0, 23.5, 1.25), GOLD, cap=2, k=2.2)
    s.gem(12.0, 20.0, 1.5, 1.5, rift, glint=False)
    s.paint(seg(10.5, 21.5, 6.5, 25.5, 1.25), LEATHER, cap=1)
    for p in ((9, 22), (8, 23), (7, 24)):
        s.shade(p, -1)
    s.gem(5.0, 27.0, 2.1, 2.1, rift)
    s.paint(disc(8.5, 16, 1.2) | disc(16, 23.5, 1.2), GOLD, cap=1)
    s.glint(27, 9)


def cleaver(s):
    bronze = R('#3a1c12', '#7a3a1c', '#c06a34', '#e8a060', '#fff0c8')
    wrap = ramp('#9a2a2a')
    s.paint(seg(16, 4, 16, 29.5, 1.3), WOOD, cap=2, grad=0.2)
    left = poly([(15, 8), (10, 6.5), (5.5, 3), (3.5, 6.5), (2.8, 12), (3.5, 17), (5.5, 20.5),
                 (10, 17), (15, 15.5)])
    right = poly([(17, 8), (22, 6.5), (26.5, 3), (28.5, 6.5), (29.2, 12), (28.5, 17),
                  (26.5, 20.5), (22, 17), (17, 15.5)])
    for m, sgn in ((left, -1), (right, 1)):
        s.paint(m, bronze, cap=3, grad=0.8, k=2.4)
        for (x, y) in edge(m):
            if (sgn < 0 and x <= 5) or (sgn > 0 and x >= 27):
                s.put(x, y, bronze, 4 if sgn < 0 else 3)
    maze = [(8, 9), (9, 9), (10, 9), (10, 10), (10, 11), (8, 11), (8, 12), (8, 13), (9, 13),
            (10, 13), (11, 13), (6, 9), (6, 10), (6, 11), (6, 12), (6, 13), (6, 14), (7, 15),
            (8, 15), (9, 15)]
    for (x, y) in maze:
        s.put(x, y, bronze, 1)
        s.put(31 - x, y, bronze, 1)
    s.paint(rect(14, 6, 18, 17), GOLD, cap=2, k=2.2)
    s.gem(16.0, 11.5, 1.6, 2.4, ramp('#d03a30'), glint=False)
    s.paint(rect(14, 21, 18, 25), wrap, cap=1, k=2)
    for y in (22, 24):
        s.paint(rect(14, y, 18, y), wrap, flat=1, shadow=False)
    s.paint(disc(16, 29, 1.8), GOLD, cap=1)
    for (x, y, i) in ((19, 19, 3), (20, 20, 2), (20, 21, 3), (21, 22, 2), (21, 23, 3)):
        s.put(x, y, STEEL, i)
    s.glint(5, 4)


def stormstaff(s):
    bolt = R('#2a4aa0', '#5a9ae8', '#b0e8ff', '#e8faff', '#ffffff')
    dbone = ramp('#8ea2b4')
    s.paint(seg(5.5, 28.5, 20.5, 11.5, 1.3, 1.1), dbone, cap=2, grad=0.4)
    for t in (0.25, 0.5, 0.75):
        x, y = 5.5 + 15 * t, 28.5 - 17 * t
        s.paint(disc(x, y, 1.6), GOLD if t == 0.5 else dbone, cap=1, base=3 if t != 0.5 else 2)
    s.paint(seg(8, 25.5, 11, 22.5, 1.5), LEATHER, cap=1)
    prongs = bez((19, 13), (15, 8), (18.5, 4.5), 1.1, 0.5) | bez((20.5, 13), (28, 13),
                                                                    (27.5, 7), 1.1, 0.5)
    s.paint(prongs, GOLD, cap=1, k=2.2)
    s.gem(22.5, 8.5, 3.6, 3.6, bolt)
    s.paint(bez((21, 12.5), (21, 6), (23, 4), 0.8, 0.4), GOLD, cap=1, k=2)
    for p in ((27, 3), (28, 4), (27, 5), (28, 6), (13, 6), (12, 7), (13, 8), (12, 9),
              (25, 15), (26, 16), (25, 17)):
        s.put(p[0], p[1], bolt, 3, noline=True)
    for (x, y) in ((14, 19), (13, 20), (12, 21)):
        s.put(x, y, bolt, 2)
    s.paint(seg(4.5, 29.5, 6.0, 28.0, 1.3), GOLD, cap=1)
    s.glint(19, 6)


def scepter(s):
    moon = R('#3a3070', '#6a60a8', '#a8a0d8', '#dcd8f4', '#ffffff')
    wing = ramp('#4a2a5a')
    s.paint(seg(16, 18, 16, 29, 1.2), STEEL, cap=2, grad=0.2)
    for y in (21, 25):
        s.paint(ell(16, y + .5, 2.0, 1.0), GOLD, cap=1, k=2)
    s.paint(disc(16, 29.3, 1.5), GOLD, cap=1)
    for side in (-1, 1):
        w = poly([(16, 17), (16 + side * 11, 14), (16 + side * 10, 17), (16 + side * 8, 16.5),
                  (16 + side * 7.5, 19), (16 + side * 5, 18), (16, 20.5)])
        s.paint(w, wing, cap=1, k=2, grad=0.6)
        for p in bres(16, 18, 16 + side * 11, 14):
            if p in w:
                s.put(p[0], p[1], wing, 3 if side < 0 else 2)
    cres = disc(15, 9.5, 8.2) - disc(19.2, 6.8, 6.6)
    s.paint(cres, moon, cap=3, k=2.6, grad=0.7)
    for p in edge(cres):
        if p[0] + p[1] < 20 and (p[0] - 15) ** 2 + (p[1] - 9) ** 2 > 40:
            s.put(p[0], p[1], moon, 4)
    s.paint(disc(16, 17.5, 2.2), GOLD, cap=1, k=2)
    s.gem(16.0, 17.5, 1.1, 1.1, ramp('#9a5ae0'), glint=False)
    star = ramp('#f0e4ff')
    for (x, y) in ((20, 7), (19, 8), (20, 8), (21, 8), (20, 9)):
        s.put(x, y, star, 3, noline=False)
    s.putc(20, 8, WHITE, noline=False)
    for (x, y) in ((25, 4), (26, 10), (23, 2)):
        s.put(x, y, star, 3, noline=True)
    s.glint(8, 5)


def maul(s):
    moss = ramp('#5f8e3c')
    head = poly([(13.5, 9), (22, 1.5), (30, 9.5), (21.5, 17)])
    s.paint(seg(9, 24, 18, 13, 1.6), WOOD, cap=2, grad=0.3)
    s.paint(seg(4.5, 28.5, 10, 22.5, 1.6), LEATHER, cap=1)
    s.paint(head, STONE, cap=3, grad=0.7)
    for p in bres(17, 13, 25, 5):
        if p in head:
            s.put(p[0], p[1], STONE, 1)
    for p in bres(16, 12, 24, 4):
        if p in head:
            s.put(p[0], p[1], GOLD, 3)
    for (x, y) in ((22, 3), (23, 3), (24, 4), (21, 4), (27, 7), (28, 8), (27, 8)):
        s.put(x, y, moss, 3 if y < 5 else 2)
    for (x, y) in ((16, 14), (15, 13), (17, 15), (19, 15)):
        s.put(x, y, moss, 2)
    s.paint(seg(16.5, 14, 19.5, 16.8, 1.3), GOLD, cap=1)
    for (x, y) in ((24, 11), (25, 11), (25, 12), (24, 13), (25, 13)):
        s.put(x, y, ramp('#a0f070'), 3, noline=False)
    s.paint(disc(4.5, 28.5, 1.6), GOLD, cap=1)
    s.paint(seg(9, 25, 10, 29, 0.6), LEATHER, flat=2)
    s.paint(ell(10.5, 29.0, 1.3, 1.6), BONE, cap=1, base=3)
    s.glint(14, 5)


def censer(s):
    ghost = R('#1a5a3a', '#3aa060', '#80e098', '#c8ffd0', '#ffffff')
    for y in range(2, 9):
        s.put(16, y, STEEL, 3 if y % 2 else 1)
    for y in range(4, 9):
        s.put(16 + (y - 3), y + 2, STEEL, 2)
        s.put(16 - (y - 3), y + 2, STEEL, 2)
    s.paint(disc(16, 2, 1.3) - {(16, 2)}, GOLD, cap=1)
    body = disc(16, 18, 7.6)
    s.paint(body, GOLD, mode='sphere', sph=(16, 18, 7.6, 7.6), k=2.6, spec=0.97)
    holes = [(13, 15), (16, 14), (19, 15), (12, 18), (15, 18), (18, 18), (21, 18), (13, 21),
             (16, 21), (19, 21)]
    for (x, y) in holes:
        for (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1)):
            if (dx, dy) == (1, 1):
                continue
            s.put(x + dx, y + dy, ghost, 3 if (dx, dy) == (0, 0) else 2)
    s.paint(ell(16, 11, 4.5, 1.4) | rect(14, 9, 18, 10), GOLD, cap=1, k=2)
    s.paint(poly([(13.5, 25), (18.5, 25), (17, 28.5), (15, 28.5)]), GOLD, cap=1, k=2)
    s.gem(16.0, 29.2, 1.2, 1.2, ghost, glint=False)
    for (x, y, i) in ((24, 13, 3), (25, 12, 2), (25, 11, 3), (26, 10, 2), (7, 14, 3), (6, 13, 2),
                      (6, 12, 3), (7, 11, 2), (8, 10, 1), (26, 8, 1)):
        s.put(x, y, ghost, i, noline=True)
    s.glint(11, 13)


def coat(s):
    wine = ramp('#7c1f34', dark=0.15)
    body = poly([(9, 6), (23, 6), (25, 9), (23.5, 18), (26.5, 29), (17.5, 29), (16, 22),
                 (14.5, 29), (5.5, 29), (8.5, 18), (7, 9)])
    s.paint(seg(8, 8, 4.5, 21, 2.3, 2.0), wine, cap=2, base=1, grad=0.5)
    s.paint(seg(24, 8, 27.5, 21, 2.3, 2.0), wine, cap=2, base=1, grad=0.5)
    s.paint(rect(3, 20, 6, 22) & seg(8, 8, 4.5, 21, 2.6), GOLD, flat=2)
    s.paint(rect(26, 20, 29, 22) & seg(24, 8, 27.5, 21, 2.6), GOLD, flat=2)
    s.paint(body, wine, cap=3, grad=0.7)
    for p in bres(16, 22, 16, 28):
        s.put(p[0], p[1], wine, 0)
    for y in range(9, 22):
        s.put(15, y, wine, 1)
    for (x, y) in ((6, 28), (26, 28)):
        pass
    for x in range(6, 27):
        if (x, 28) in body:
            s.put(x, 28, GOLD, 3 if x < 16 else 2)
    s.paint(poly([(11, 3), (15, 8), (13, 11)]), wine, cap=1, base=3)
    s.paint(poly([(21, 3), (17, 8), (19, 11)]), wine, cap=1, base=2)
    s.paint(poly([(14, 6.5), (18, 6.5), (17.5, 13), (16, 15), (14.5, 13)]), BONE, cap=1, base=3,
            hi=4)
    for y in (8, 10, 12):
        s.put(15, y, BONE, 2)
        s.put(17, y + 1, BONE, 2)
    for y in (12, 15, 18):
        s.paint(disc(12.5, y + .5, 0.8), GOLD, flat=3)
        s.paint(disc(20.5, y + .5, 0.8), GOLD, flat=2)
    for p in bres(13, 10, 9, 18) + bres(19, 10, 23, 18):
        s.put(p[0], p[1], GOLD, 2)
    s.glint(23, 4)


def hauberk(s):
    scale = R('#0c2a24', '#1a5a46', '#2f9a72', '#58d09a', '#c8ffe0')
    body = poly([(8, 7), (24, 7), (25, 12), (24, 25), (26, 28), (6, 28), (8, 25), (7, 12)])
    s.paint(seg(8.5, 9, 4.5, 17, 2.4) | seg(23.5, 9, 27.5, 17, 2.4), scale, cap=2, base=1)
    s.paint(body, scale, cap=2, grad=0.7, base=2)
    for (x, y) in body:
        if 8 <= y <= 27:
            row = (y - 8) // 2
            ox = 0 if row % 2 == 0 else 2
            u = (x - ox) % 4
            if (y - 8) % 2 == 1 and u in (0, 3):
                s.shade((x, y), -1)
            elif (y - 8) % 2 == 0 and u == 1:
                s.shade((x, y), +1)
    for x in range(7, 26):
        if (x, 27) in body:
            s.put(x, 27, scale, 3 if x % 2 else 1)
    s.paint(rect(7, 20, 25, 21), LEATHER, cap=1, k=2)
    s.paint(rect(14, 19, 18, 22) - rect(15, 20, 17, 21), GOLD, cap=1)
    s.paint(ell(9, 8.5, 4, 2.6) | ell(23, 8.5, 4, 2.6), GOLD, cap=2, k=2.2)
    s.paint(poly([(12, 6), (20, 6), (18, 10), (14, 10)]), ramp('#2a2430'), cap=1, base=1,
            inv=True)
    for (x, y, c) in ((4, 19, '#e04a30'), (4, 20, '#f0d060'), (5, 21, '#e04a30'),
                      (28, 19, '#3a8ad0'), (28, 20, '#f0d060'), (27, 21, '#3a8ad0')):
        s.put(x, y, ramp(c), 2)
    s.glint(10, 6)


def veil(s):
    gh = R('#3a3060', '#6a62a0', '#a8a0d8', '#d8d4f4', '#ffffff')
    body = poly([(16, 4), (21, 8), (22, 14), (26, 22), (28, 27), (25, 25.5), (23, 29),
                 (20.5, 26.5), (18, 29.5), (16, 27), (13.5, 29.5), (11, 26.5), (8.5, 29),
                 (6.5, 25.5), (4, 27), (6, 22), (10, 14), (11, 8)])
    s.paint(body, gh, cap=3, grad=0.8)
    for (a, b) in (((13, 12), (9, 26)), ((17, 13), (18, 27)), ((20, 14), (24, 25))):
        for p in bres(a[0], a[1], b[0], b[1]):
            if p in body and p not in edge(body):
                s.shade(p, -1)
    for (a, b) in (((12, 12), (8, 25)), ((16, 13), (16, 26))):
        for p in bres(a[0], a[1], b[0], b[1]):
            if p in body and p not in edge(body):
                s.shade(p, 1)
    face = ell(16, 10, 3.2, 3.6)
    s.paint(face, R('#0e0a1a', '#1c1630', '#2c2446'), cap=1, base=1, inv=True, lo=0, hi=2)
    s.put(15, 10, gh, 3, noline=True)
    s.put(17, 10, gh, 3, noline=True)
    crown = poly([(12, 6), (12, 2.5), (13.5, 4), (16, 1.5), (18.5, 4), (20, 2.5), (20, 6)])
    s.paint(crown, GOLD, cap=1, k=2)
    s.put(16, 4, ramp('#c04ad0'), 3)
    s.paint(seg(10.5, 17.5, 21.5, 17.5, 0.6) & body, GOLD, flat=3, shadow=False)
    for (x, y) in ((5, 12), (27, 15), (3, 20), (28, 6)):
        s.put(x, y, gh, 4, noline=True)
    s.glint(23, 6)


def mattock(s):
    glow = R('#1a4a1a', '#3a8a2a', '#7ad04a', '#c8ff9a', '#ffffff')
    s.paint(seg(8, 28.5, 18.5, 11.5, 1.6), WOOD, cap=2, grad=0.3)
    s.paint(seg(9.0, 26.8, 12.0, 21.8, 1.8), LEATHER, cap=1)
    for p in ((10, 24), (11, 23)):
        s.put(p[0], p[1], LEATHER, 1)
    adze = poly([(19.5, 10.5), (10, 5.5), (6.5, 3.5), (3.5, 8), (5, 11), (8.5, 10.5),
                 (17.5, 16)])
    pick = poly([(18, 9), (24, 8.5), (29.5, 13.5), (23.5, 14), (19.5, 15.5)])
    s.paint(adze | pick, IRON, cap=2, grad=0.6, base=2, k=2.6)
    for p in bres(5, 5, 4, 8):
        s.put(p[0], p[1], IRON, 4)
    for p in bres(22, 9, 28, 13):
        s.put(p[0], p[1], IRON, 4)
    for (x, y) in ((11, 8), (12, 8), (12, 9), (13, 10), (14, 10), (23, 11), (24, 11),
                   (25, 12)):
        s.put(x, y, glow, 3, noline=False)
    for (x, y) in ((8, 8), (9, 9), (27, 13)):
        s.put(x, y, ramp('#9a5a2a'), 1)
    s.paint(disc(18.5, 12.5, 2.9), GOLD, cap=2, k=2.2)
    s.gem(18.5, 12.5, 1.4, 1.4, glow, glint=False)
    s.paint(disc(8, 28.5, 1.8), GOLD, cap=1)
    s.glint(28, 9)


def harpoon(s):
    verd = R('#0c3a38', '#1a6a60', '#2fb0a8', '#7ae8d0', '#e0fff8')
    rope = ramp('#b09868')
    s.paint(seg(4.5, 28.5, 18.5, 14.5, 1.3), WOOD, cap=2, grad=0.3)
    for t in (0.18, 0.26, 0.34, 0.42):
        x, y = 4.5 + 14 * t, 28.5 - 14 * t
        s.paint(seg(x - 1.2, y - 1.2, x + 1.2, y + 1.2, 0.6) & grow(seg(4.5, 28.5, 18.5, 14.5,
                                                                         1.3), 1),
                rope, cap=1, base=3 if t != 0.26 else 2)
    shaft_head = seg(17, 16, 25.5, 7.5, 1.4)
    s.paint(shaft_head, verd, cap=2, k=2.4, base=2)
    tip = poly([(23, 6.5), (29, 2.5), (26, 9.5)])
    s.paint(tip, verd, cap=2, k=2.4, base=3)
    b1 = poly([(22, 10), (17.5, 7), (20, 11.5)])
    b2 = poly([(22.5, 11.5), (26.5, 15.5), (21.5, 13)])
    s.paint(b1 | b2, verd, cap=1, base=3, k=2)
    for p in bres(18, 14, 24, 8):
        s.put(p[0], p[1], verd, 3)
    s.paint(disc(17.5, 15.5, 2.3), GOLD, cap=1, k=2.2)
    for (x, y) in ((21, 12), (24, 9)):
        s.paint(disc(x + .5, y + .5, 0.9), STONE, flat=3)
        s.put(x, y, STONE, 4)
    loop = ell(5.5, 24.0, 2.6, 1.8, -45) - ell(5.5, 24.0, 1.2, 0.6, -45)
    s.paint(loop - s.col.keys(), rope, cap=1, base=2, k=1.5)
    s.paint(poly([(2.5, 27), (6.5, 25.5), (8, 29.5), (4.5, 30)]), ramp('#b8322f'), cap=1, k=2)
    s.glint(27, 7)


def sickle(s):
    blight = R('#2a3a10', '#5a7020', '#a0b83a', '#d8ec80', '#fbffe0')
    shroom = ramp('#e07a3a')
    s.paint(seg(9, 29, 10.5, 19, 1.5), WOOD, cap=2, grad=0.3)
    for y in (21, 24, 27):
        s.paint(rect(8, y, 11, y), GOLD, flat=2, shadow=False)
    blade = (disc(16.5, 14.5, 11.6) - disc(19.5, 16.5, 9.4)) & poly([(0, 0), (31, 0), (31, 19),
                                                                     (20, 20), (9, 18),
                                                                     (0, 20)])
    blade -= rect(0, 15, 9, 31)
    blade |= seg(10.5, 18.5, 8.5, 14, 1.6)
    s.paint(blade, IRON, cap=2, grad=0.6, base=3, k=2.4)
    inner = edge(blade) & disc(19.5, 16.5, 10.6)
    for p in inner:
        s.put(p[0], p[1], blight, 3)
    for a in range(200, 330, 9):
        p = (int(16.5 + math.cos(math.radians(a)) * 10.3), int(14.5 + math.sin(math.radians(a))
                                                              * 10.3))
        if p in blade:
            s.put(p[0], p[1], GOLD, 3 if a < 260 else 2)
    s.paint(disc(10, 18.5, 2.0), GOLD, cap=1, k=2)
    for (cx, cy, r) in ((14.0, 25.5, 3.2), (5.5, 22.5, 2.4)):
        s.paint(rect(int(cx) - 1, int(cy), int(cx), int(cy + r * 0.9)), BONE, cap=1, base=2)
        s.paint(ell(cx, cy, r, r * 0.75) - rect(0, int(cy) + 1, 31, 31), shroom, cap=2, k=2.2)
        s.put(int(cx - r * 0.4), int(cy - r * 0.3), BONE, 4)
        s.put(int(cx + r * 0.4), int(cy - r * 0.1), BONE, 3)
    s.glint(27, 13)


# ---------------------------------------------------------------- data

def city(cid, city, name, flavour, buff, colour, fn):
    return dict(id=cid, name=name, kind='relic', city=city,
                source='Sold now and then at the %s market stall, at a steep price' % city,
                flavour=flavour, buff=buff, colour=colour, draw=fn)


def bossrel(cid, boss, name, flavour, buff, colour, fn):
    return dict(id=cid, name=name, kind='boss-relic', boss=boss,
                source='Only from %s, at a low drop rate; never sold' % boss.split(',')[0].split(' (')[0],
                flavour=flavour, buff=buff, colour=colour, draw=fn)


def equip(cid, boss, slot, cls, name, flavour, buff, colour, fn):
    return dict(id=cid, name=name, kind='equipment', boss=boss, slot=slot, **{'class': cls},
                source='Dropped by %s' % boss.split(',')[0].split(' (')[0], flavour=flavour, buff=buff,
                colour=colour, draw=fn)


ITEMS = [
    city('sheaf-of-the-long-summer', 'Goldmill', 'Sheaf of the Long Summer',
         'Bound on the last warm evening of a year that never turned cold.',
         '+6% crops and fish from gathering', '#f2d26a', sheaf),
    city('millwind-vane', 'Goldmill', 'Millwind Vane',
         "Goldmill's oldest sails. They turn even when the air stands still.",
         'Idle characters keep gathering 2 h longer after the last tokens', '#9fd8f0', vane),
    city('everwarm-anvil', 'Deepforge', 'Everwarm Anvil',
         'Its face has not cooled since the first bar was struck on it.',
         'Item upgrades cost 5% fewer materials', '#ff8a3a', anvil),
    city('cogheart-of-the-ninth-shaft', 'Deepforge', 'Cogheart of the Ninth Shaft',
         'Wound once by a dwarf long buried. It has not slipped a tooth since.',
         '+3% party attack speed, on top of the Engineering limit', '#40e090', cog),
    city('tidecall-conch', 'Brinehaven', 'Tidecall Conch',
         'Hold it to your ear and the harbour tells you where the shoals are.',
         'Kills drop 6% more fish and hides', '#ff9a9a', conch),
    city('harbour-stormglass', 'Brinehaven', 'Harbour Stormglass',
         'The water inside rises an hour before the weather does.',
         '+5% experience to gathering skills', '#3a9ae0', stormglass),
    city('elder-acorn', 'Tallwood', 'Elder Acorn',
         'Fell from the first tree of Tallwood. It is still deciding what to be.',
         '+6% logs and hides from gathering', '#8ad048', acorn),
    city('stagcall-horn', 'Tallwood', 'Stagcall Horn',
         'One note, and every elite in the wood turns to look.',
         '+5% damage against elites and champions', '#e8a850', horn),
    city('codex-of-unwritten-pages', 'Runespire', 'Codex of Unwritten Pages',
         'Each page fills itself the moment someone in the room learns it.',
         '+4% experience for every character in the room', '#8a6aff', codex),
    city('seventh-circle-prism', 'Runespire', 'Seventh-Circle Prism',
         'Cut by six masters. The seventh cut is the light it lets out.',
         "The rune circle's health cut on each new monster is 10% larger", '#f070e0', prism),

    bossrel('pilfered-lantern', 'Skrix, the Lantern Thief (goblin)', "Skrix's Pilfered Lantern",
            'Whoever owned this light first, it still burns for them.',
            '+6% chance that a kill drops an item', '#50f0d0', skrix),
    bossrel('jawbone-lyre', 'Thruska, the Bone Singer (orc)', 'Jawbone Lyre',
            'Strung with gut and grudges. Its song makes axes heavier.',
            '+4% physical damage for the whole party', '#c47cf4', thruska),
    bossrel('rimeheart', 'Old Hessa, the Frost Crone (troll)', 'Rimeheart',
            'Hessa froze her own heart to outlive her enemies. It worked.',
            'Monsters drain 5% less stamina', '#a8ecff', hessa),
    bossrel('unquenched-candle', 'Mother Ilse, the Candle Witch (human)', 'Unquenched Candle',
            'Wax that never runs short, lit from a flame that never went out.',
            'The party rests 15% shorter when its stamina runs out', '#ffe060', ilse),
    bossrel('crown-of-the-ossuary', 'Ossric, the Ossuary Lord (skeleton)',
            'Crown of the Ossuary', 'Every bone in it once knelt to him. Some still do.',
            '+6% damage against bosses and legendary bosses', '#4aa0f0', ossric),
    bossrel('velvet-thirst-chalice', 'Count Varesh, the Velvet Thirst (vampire)',
            'Velvet Thirst Chalice', 'Never empty, and never quite the colour of wine.',
            "Each kill restores 4% of the party's stamina", '#e8463c', varesh),
    bossrel('ember-princes-grasp', 'Vorzhaal, the Ember Prince (demon)', "Ember Prince's Grasp",
            'A cooling coal in an iron fist. It never finishes cooling.',
            'Critical hits deal 10% more damage', '#ff6a20', vorzhaal),
    bossrel('hoard-sleepers-egg', 'Glimmerdeep, the Hoard Sleeper (dragon)',
            "Hoard-Sleeper's Egg", 'Warm as a coin left in the sun. Something inside is counting.',
            'Kills give 5% more materials', '#3ad0b0', glimmerdeep),
    bossrel('silk-widows-spindle', 'Mother Skein, the Silk Widow (spider)',
            "Silk Widow's Spindle", 'Spun from the threads her prey pulled loose escaping.',
            'Affixes of elites, champions and legendary bosses are 20% weaker', '#e8e0ff', skein),
    bossrel('golden-hive-comb', 'Queen Zarra of the Golden Hive (insect)', 'Golden Hive Comb',
            "The honey keeps the queen's hours: every idle hand fills a cell.",
            'Idle characters gather 5% more of every material', '#ffb820', zarra),
    bossrel('the-seventeenth-key', 'Warden Seventeen, the Last Sentry (golem)',
            'The Seventeenth Key', 'It opens no door any more. It only keeps the line.',
            '+5% party stamina pool', '#60e0f0', warden),
    bossrel('bramble-queens-rose', 'Thistlewrath, the Bramble Queen (treant)',
            "Bramble Queen's Rose", 'Pick it and it picks you back.',
            'Monsters take back 5% of the stamina they drain as damage', '#ff5a8a', thistle),

    equip('oathbreaker', 'Sir Corwen Ashby, the Faithless Knight (human)', 'weapon', 'Fighter',
          'Oathbreaker', 'Snapped on the day he broke his word. It mended. He did not.',
          '+4% critical chance for the wielder', '#8ab8ff', oathbreaker),
    equip('labyrinth-cleaver', 'Gorrath, the Maze Breaker (minotaur)', 'weapon', 'Fighter',
          'Labyrinth Cleaver', "Gorrath never found the maze's exit. He made a few.",
          "Every 8th hit of the wielder deals double damage", '#e07a40', cleaver),
    equip('stormwing-staff', 'Azhrenn, the Storm Wing (dragon)', 'weapon', 'Mage',
          'Stormwing Staff', 'A wing-claw of the Storm Wing, still holding its last lightning.',
          '+5% magical damage from the wielder', '#b0e8ff', stormstaff),
    equip('moonwane-scepter', 'Ysolde Marrin, the Moon Countess (vampire)', 'weapon', 'Mage',
          'Moonwane Scepter', 'The Countess held court only on nights it shone.',
          "The wielder's tokens give 10% more arcana experience", '#c8b0ff', scepter),
    equip('bridgewardens-maul', 'Grumlaw, the Bridge Warden (troll)', 'weapon', 'Guardian',
          "Bridgewarden's Maul", 'A keystone of the bridge he kept. Nobody crossed after him.',
          'While the wielder fights, monsters drain 4% less stamina', '#8ad050', maul),
    equip('vigil-censer', 'Brother Hollis, the Lantern Monk (ghost)', 'weapon', 'Healer',
          'Vigil Censer', 'Its smoke smells of a chapel that burned three hundred years ago.',
          '+8% healing from the wielder', '#80e098', censer),
    equip('pale-duelists-coat', 'Severin Holt, the Pale Duelist (vampire)', 'outfit', 'Fighter',
          "Pale Duelist's Coat", 'Cut to move in. Not one stitch of it was ever torn.',
          '+4% attack speed for the wearer', '#ff4a6a', coat),
    equip('coldscale-hauberk', 'Tethra Coldscale, the Reed Hunter (lizardfolk)', 'outfit',
          'Guardian', 'Coldscale Hauberk', 'Shed scales from a marsh that never thaws.',
          "The wearer's outfit adds 8% more to the party stamina pool", '#40c890', hauberk),
    equip('veil-of-the-regent', 'Lady Annick, the Veiled Regent (ghost)', 'outfit', 'Healer',
          'Veil of the Regent', 'She ruled from behind it for a century after she died.',
          "The wearer's support aura is 15% stronger", '#b8b0f0', veil),
    equip('gravewake-mattock', 'Old Mattock, the Gravedigger (zombie)', 'tool', 'any (mining)',
          'Gravewake Mattock', 'Dug four hundred graves and struck ore in every one.',
          '+12% ore while the holder mines', '#9ad070', mattock),
    equip('sunken-deck-harpoon', 'Captain Dregmoor of the Sunken Deck (skeleton)', 'tool',
          'any (fishing)', 'Sunken-Deck Harpoon',
          'Barnacled, rusted, and still the best catch on the coast.',
          '+12% fish while the holder fishes', '#2fb0a8', harpoon),
    equip('blightmoon-sickle', 'Rotroot, the Withered Warden (treant)', 'tool', 'any (farming)',
          'Blightmoon Sickle', "Rotroot's last harvest: everything it cut grew back twice.",
          '+12% crops while the holder farms', '#c8e060', sickle),
]


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


# ---------------------------------------------------------------- sheets

BG = (18, 21, 27)


def sheets(arts, framed):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print('Pillow missing: sheets written without text')
        Image = None
    font = None
    if Image is not None:
        try:
            font = ImageFont.load_default_imagefont()
        except AttributeError:
            font = ImageFont.load_default()

    def to_img(rows):
        im = Image.new('RGBA', (len(rows[0]), len(rows)))
        im.putdata([p for row in rows for p in row])
        return im

    def text(im, xy, s, colour, k=1):
        tw = int(ImageDraw.Draw(im).textlength(s, font=font)) + 2
        t = Image.new('RGBA', (tw, 13), (0, 0, 0, 0))
        ImageDraw.Draw(t).text((0, 0), s, font=font, fill=colour)
        if k != 1:
            t = t.resize((tw * k, 13 * k), Image.NEAREST)
        im.alpha_composite(t, xy)

    def big_sheet(kind, fname, title):
        items = [it for it in ITEMS if it['kind'] == kind]
        cols = 2
        cw, ch = 820, 184
        rows_n = (len(items) + cols - 1) // cols
        Wd, Ht = cols * cw + 40, rows_n * ch + 80
        if Image is None:
            canvas = [[BG + (255,)] * Wd for _ in range(Ht)]
        else:
            im = Image.new('RGBA', (Wd, Ht), BG + (255,))
            text(im, (24, 22), title, (242, 196, 67), 3)
        for i, it in enumerate(items):
            cx, cy = 20 + (i % cols) * cw, 72 + (i // cols) * ch
            fr = framed[it['id']]
            big = upscale(fr, 4)
            if Image is None:
                composite(canvas, big, cx, cy)
                continue
            im.alpha_composite(to_img(big), (cx, cy))
            tx = cx + 176
            text(im, (tx, cy + 4), it['name'], tuple(hx(it['colour'])) + (255,), 2)
            sub = it['source']
            if it['kind'] == 'equipment':
                sub = '%s / %s  -  %s' % (it['slot'], it['class'], sub)
            text(im, (tx, cy + 40), sub, (150, 160, 178, 255), 1)
            if it['kind'] == 'boss-relic':
                text(im, (tx, cy + 56), 'Boss: ' + it['boss'], (150, 160, 178, 255), 1)
            text(im, (tx, cy + 80), 'Buff: ' + it['buff'], (240, 240, 230, 255), 1)
            text(im, (tx, cy + 104), '"%s"' % it['flavour'], (176, 168, 150, 255), 1)
        path = os.path.join(HERE, fname)
        if Image is None:
            write_png(path, canvas)
        else:
            im.save(path)

    big_sheet('relic', 'sheet-city-relics.png', 'City relics')
    big_sheet('boss-relic', 'sheet-boss-relics.png', 'Boss-owned relics')
    big_sheet('equipment', 'sheet-equipment.png', 'Legendary equipment')

    # all 34 at x1 in 40 px slots: clean row block, then with glow
    per = 12
    pad = 4
    groups = []
    for kind in ('relic', 'boss-relic', 'equipment'):
        groups.append([it for it in ITEMS if it['kind'] == kind])
    Wd = pad + per * (40 + pad) + pad
    Ht = pad + 2 * 3 * (40 + pad) + 16 + pad
    canvas = [[BG + (255,)] * Wd for _ in range(Ht)]
    y = pad
    for glow in (False, True):
        for grp in groups:
            for j, it in enumerate(grp):
                fr = [row[:] for row in frame(active=(it['kind'] != 'equipment'))]
                composite(fr, arts[it['id']][1 if glow else 0], 4, 4)
                composite(canvas, fr, pad + j * (40 + pad), y)
            y += 40 + pad
        y += 16
    write_png(os.path.join(HERE, 'sheet-small.png'), canvas)


# ---------------------------------------------------------------- main

def check_texts():
    seen = set()
    for it in ITEMS:
        assert it['id'] not in seen, it['id']
        seen.add(it['id'])
        assert len(it['flavour']) <= 70, (it['id'], len(it['flavour']))
        assert len(it['buff']) <= 80, (it['id'], len(it['buff']))
    kinds = [it['kind'] for it in ITEMS]
    assert kinds.count('relic') == 10 and kinds.count('boss-relic') == 12
    assert kinds.count('equipment') == 12


def main():
    check_texts()
    for d in ('png', 'x1'):
        os.makedirs(os.path.join(HERE, d), exist_ok=True)
    arts = {}
    framed = {}
    for it in ITEMS:
        s = Sprite()
        it['draw'](s)
        s.finish()
        clean = s.rgba()
        glow = glow_rgba(clean, it['colour'])
        arts[it['id']] = (clean, glow)
        for suffix, rows in (('', clean), ('-glow', glow)):
            write_png(os.path.join(HERE, 'x1', it['id'] + suffix + '.png'), rows)
            write_png(os.path.join(HERE, 'png', it['id'] + suffix + '.png'), upscale(rows, SCALE))
        fr = [row[:] for row in frame(active=(it['kind'] != 'equipment'))]
        composite(fr, glow, 4, 4)
        framed[it['id']] = fr
    for name, act in (('frame-slot', False), ('frame-active-relic', True)):
        rows = frame(act)
        write_png(os.path.join(HERE, 'x1', name + '.png'), rows)
        write_png(os.path.join(HERE, 'png', name + '.png'), upscale(rows, SCALE))
    out = []
    for it in ITEMS:
        rec = {k: it[k] for k in ('id', 'name', 'kind', 'source') if k in it}
        for k in ('boss', 'city', 'slot', 'class'):
            if k in it:
                rec[k] = it[k]
        rec.update(flavour=it['flavour'], buff=it['buff'], colour=it['colour'])
        out.append(rec)
    with open(os.path.join(HERE, 'items.json'), 'w') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write('\n')
    sheets(arts, framed)
    print('wrote %d items' % len(ITEMS))


if __name__ == '__main__':
    main()
