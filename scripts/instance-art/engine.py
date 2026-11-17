"""Tiny pixel-art engine: canvas, dithering, shapes, noise, PNG output. Pure stdlib.
Extended copy of the city-banner engine: any canvas size, transparent canvases (RGBA PNG),
palette blending and a larger sheet font."""
import zlib, struct, random, math

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def hexc(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def tohex(c):
    return '#%02x%02x%02x' % c


def bay(x, y):
    return (BAYER[int(y) & 3][int(x) & 3] + 0.5) / 16.0


def q4(t):
    """Quantise a blend amount to clean dither levels (0, 1/4, 1/2, 3/4, 1)."""
    return max(0.0, min(1.0, round(t * 4) / 4.0))


def lerp_pal(a, b, t):
    """Blend two palettes key by key (both as hex strings)."""
    out = {}
    for k in a:
        ca, cb = hexc(a[k]), hexc(b[k])
        out[k] = tohex(tuple(int(round(ca[i] + (cb[i] - ca[i]) * t)) for i in range(3)))
    return out


class Cv:
    def __init__(self, pal, bg, w, h):
        self.W, self.H = w, h
        self.pal = {k: hexc(v) for k, v in pal.items()}
        self.rev = {}
        for k, v in self.pal.items():
            self.rev.setdefault(v, k)
        fill = self.pal[bg] if bg else None
        self.px = [[fill] * w for _ in range(h)]
        self.clip = None   # optional (x0, y0, x1, y1)

    def c(self, k):
        if k is None:
            return None
        return self.pal[k] if isinstance(k, str) else k

    def set(self, x, y, k):
        x = int(math.floor(x)); y = int(math.floor(y))
        if 0 <= x < self.W and 0 <= y < self.H:
            if self.clip and not (self.clip[0] <= x < self.clip[2] and self.clip[1] <= y < self.clip[3]):
                return
            self.px[y][x] = self.c(k)

    def get(self, x, y):
        x = int(math.floor(x)); y = int(math.floor(y))
        if 0 <= x < self.W and 0 <= y < self.H:
            p = self.px[y][x]
            return None if p is None else self.rev.get(p)
        return None

    def mix(self, x, y, a, b, t):
        """Ordered-dither pixel between keys a and b, t = share of b."""
        self.set(x, y, b if bay(x, y) < t else a)

    def rect(self, x0, y0, x1, y1, k):
        for y in range(int(y0), int(y1)):
            for x in range(int(x0), int(x1)):
                self.set(x, y, k)

    def hline(self, x0, x1, y, k):
        for x in range(int(round(x0)), int(round(x1)) + 1):
            self.set(x, y, k)

    def vline(self, x, y0, y1, k):
        for y in range(int(round(y0)), int(round(y1)) + 1):
            self.set(x, y, k)

    def line(self, x0, y0, x1, y1, k):
        x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
        dx = abs(x1 - x0); dy = -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.set(x0, y0, k)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    def poly(self, pts, k):
        ys = [p[1] for p in pts]
        for y in range(max(0, int(min(ys))), min(self.H, int(max(ys)) + 1)):
            yc = y + 0.5
            xs = []
            n = len(pts)
            for i in range(n):
                xa, ya = pts[i]; xb, yb = pts[(i + 1) % n]
                if (ya <= yc < yb) or (yb <= yc < ya):
                    xs.append(xa + (yc - ya) * (xb - xa) / (yb - ya))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                for x in range(int(math.ceil(xs[i] - 0.5)), int(math.floor(xs[i + 1] - 0.5)) + 1):
                    self.set(x, y, k)

    def ellipse(self, cx, cy, rx, ry, k):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx = (x + 0.5 - cx) / max(rx, 0.01); dy = (y + 0.5 - cy) / max(ry, 0.01)
                if dx * dx + dy * dy <= 1.0:
                    self.set(x, y, k)

    def disc(self, cx, cy, r, k):
        self.ellipse(cx, cy, r, r, k)

    def colors(self):
        s = set()
        for row in self.px:
            s.update(p for p in row if p is not None)
        return s


def mpd(rng, n, amp, rough=0.55):
    size = 1
    while size < n:
        size *= 2
    a = [0.0] * (size + 1)
    a[0] = rng.uniform(-1, 1) * amp
    a[size] = rng.uniform(-1, 1) * amp
    step, scale_ = size, amp
    while step > 1:
        half = step // 2
        for i in range(half, size, step):
            a[i] = (a[i - half] + a[i + half]) / 2 + rng.uniform(-1, 1) * scale_
        scale_ *= rough
        step = half
    return a[:n]


def smooth(a, k=1):
    n = len(a)
    return [sum(a[max(0, i - k):min(n, i + k + 1)]) / (min(n, i + k + 1) - max(0, i - k)) for i in range(n)]


# ---------------------------------------------------------------- output

def png_bytes(px):
    """RGB PNG, or RGBA when any pixel is None (transparent)."""
    h = len(px); w = len(px[0])
    alpha = any(p is None for row in px for p in row)
    raw = bytearray()
    for row in px:
        raw.append(1)  # Sub filter: long runs of equal pixels become zeros
        prev = (0, 0, 0, 0) if alpha else (0, 0, 0)
        for p in row:
            if alpha:
                q = (0, 0, 0, 0) if p is None else (p[0], p[1], p[2], 255)
            else:
                q = p
            raw += bytes((q[i] - prev[i]) & 255 for i in range(len(q)))
            prev = q

    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6 if alpha else 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b''))


def save(px, path):
    with open(path, 'wb') as f:
        f.write(png_bytes(px))


def scale(px, s):
    out = []
    for row in px:
        r = []
        for p in row:
            r.extend([p] * s)
        for _ in range(s):
            out.append(list(r))
    return out


def scale_f(px, f):
    """Nearest-neighbour scale by a non-integer factor (for the x1.5 continuity sheet)."""
    h = len(px); w = len(px[0])
    W2, H2 = int(w * f), int(h * f)
    return [[px[min(h - 1, int(y / f))][min(w - 1, int(x / f))] for x in range(W2)] for y in range(H2)]


def blit(dst, src, ox, oy, bg=None):
    for y, row in enumerate(src):
        for x, p in enumerate(row):
            if p is None:
                p = bg
                if p is None:
                    continue
            Y, X = oy + y, ox + x
            if 0 <= Y < len(dst) and 0 <= X < len(dst[0]):
                dst[Y][X] = p


# ---------------------------------------------------------------- 5x7 pixel font for sheets
FONT = {
    'A': ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    'B': ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    'C': ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    'D': ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    'E': ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    'F': ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    'G': ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
    'H': ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    'I': ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    'K': ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    'L': ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    'M': ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    'N': ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    'O': ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    'P': ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    'R': ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    'S': ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    'T': ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    'U': ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    'V': ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    'W': ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
    'X': ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    'Y': ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    '1': ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    '2': ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
    '3': ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    '4': ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    '5': ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    '6': ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    '7': ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    '.': ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
    '-': ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
    ' ': ["00000"] * 7,
}


def text(px, s, x, y, sc, col, shadow=None):
    for ch in s.upper():
        g = FONT[ch]
        for gy, row in enumerate(g):
            for gx, bit in enumerate(row):
                if bit == '1':
                    for yy in range(sc):
                        for xx in range(sc):
                            if shadow:
                                X, Y = x + gx * sc + xx + sc, y + gy * sc + yy + sc
                                if 0 <= Y < len(px) and 0 <= X < len(px[0]) and px[Y][X] != col:
                                    px[Y][X] = shadow
                            X, Y = x + gx * sc + xx, y + gy * sc + yy
                            if 0 <= Y < len(px) and 0 <= X < len(px[0]):
                                px[Y][X] = col
        x += 6 * sc
    return x


def fade(px, bgc=(0x12, 0x15, 0x1B)):
    """Darken the lower-left corner toward the sidebar colour, in dithered steps."""
    H = len(px); W = len(px[0])
    out = [list(r) for r in px]
    for y in range(H):
        for x in range(W):
            u = x / (W * 0.62)
            v = (y - H * 0.38) / (H * 0.62)
            if u >= 1 or v <= 0:
                continue
            s = (1 - u) ** 1.2 * min(1.0, v) ** 1.1
            lvl = s * 4.0
            lo = int(lvl)
            if bay(x, y) < lvl - lo:
                lo += 1
            a = 0.17 * lo
            r, g, b = px[y][x]
            out[y][x] = (int(r + (bgc[0] - r) * a), int(g + (bgc[1] - g) * a), int(b + (bgc[2] - b) * a))
    return out


# ================================================================ instance-set extensions
FONT.update({
    'J': ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    'Q': ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    'Z': ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    '0': ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    '8': ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    '9': ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
    ',': ["00000", "00000", "00000", "00000", "00000", "00100", "01000"],
    '!': ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
    ':': ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
    '/': ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
    '(': ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
    ')': ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
    'x': ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
})


def text_w(s, sc):
    return len(s) * 6 * sc - sc


def vnoise(seed):
    """Smooth value noise in [0, 1], deterministic per seed."""
    def h(ix, iy):
        n = (ix * 374761393 + iy * 668265263 + seed * 2147483647) & 0xffffffff
        n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
        return (n & 0xffff) / 65535.0

    def f(x, y):
        ix, iy = math.floor(x), math.floor(y)
        fx, fy = x - ix, y - iy
        sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        a = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * sx
        b = h(ix, iy + 1) + (h(ix + 1, iy + 1) - h(ix, iy + 1)) * sx
        return a + (b - a) * sy
    return f


def hashf(x, y, seed=0):
    n = (int(x) * 73856093 ^ int(y) * 19349663 ^ seed * 83492791) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n & 0xffff) / 65535.0


def bands(cv, stops, x0=0, x1=None, y0=0, y1=None, tw=4, wave=None):
    """Banded sky: stops = [(y, key), ...] top to bottom; each change is a dithered seam tw px
    tall (clean 1/4 steps). wave(x) shifts the seams to curve them."""
    x1 = cv.W if x1 is None else x1
    y1 = cv.H if y1 is None else y1
    for y in range(y0, y1):
        for x in range(x0, x1):
            yy = y - (wave(x) if wave else 0)
            k = stops[0][1]
            for i, (sy, c) in enumerate(stops):
                if yy >= sy:
                    k = c
            for i in range(1, len(stops)):
                sy, c = stops[i]
                if sy - tw <= yy < sy:
                    k = c if bay(x, y) < q4((yy - (sy - tw) + 0.5) / tw) else stops[i - 1][1]
                    break
            cv.set(x, y, k)


def light(cv, cx, cy, rx, ry, remap, power=1.0, steps=4, pred=None, inner=0.0):
    """Dithered light pass: pixels whose key is in remap are swapped toward remap[key] with a
    falloff from the centre. No blur: every pixel stays a palette colour."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + 0.5 - cx) / rx
            dy = (y + 0.5 - cy) / ry
            d = math.sqrt(dx * dx + dy * dy)
            if d >= 1:
                continue
            t = 1.0 if d < inner else (1 - (d - inner) / (1 - inner)) ** power
            t = round(t * steps) / steps
            k = cv.get(x, y)
            if k in remap and (pred is None or pred(x, y)) and bay(x, y) < t:
                cv.set(x, y, remap[k])


def stamp(cv, x0, y0, rows, keymap, flip=False):
    """Draw an ASCII sprite; '.' and ' ' are transparent."""
    for gy, row in enumerate(rows):
        if flip:
            row = row[::-1]
        for gx, ch in enumerate(row):
            if ch in '. ':
                continue
            cv.set(x0 + gx, y0 + gy, keymap[ch])


def crow_fly(cv, x, y, k, phase=0):
    """A distant bird: two wing strokes, three poses."""
    if phase == 0:
        pts = [(-2, -1), (-1, 0), (0, 0), (1, 0), (2, -1)]
    elif phase == 1:
        pts = [(-2, 0), (-1, -1), (0, 0), (1, -1), (2, 0)]
    else:
        pts = [(-3, -1), (-2, -1), (-1, 0), (0, 0), (1, 0), (2, -1), (3, -1)]
    for dx, dy in pts:
        cv.set(x + dx, y + dy, k)


def outline_shape(cv, keys, ink, sides='rb'):
    """Selective outline: pixels outside a set of keys, right/below them, become ink."""
    add = []
    for y in range(cv.H):
        for x in range(cv.W):
            if cv.get(x, y) in keys:
                continue
            for (dx, dy, s) in ((-1, 0, 'r'), (0, -1, 'b'), (1, 0, 'l'), (0, 1, 't')):
                if s in sides and cv.get(x + dx, y + dy) in keys:
                    add.append((x, y))
                    break
    for x, y in add:
        cv.set(x, y, ink)


def sheet_canvas(w, h, bg=(0x12, 0x15, 0x1B)):
    return [[bg] * w for _ in range(h)]


# ---------------------------------------------------------------- masks (sets of pixels)
def m_ell(cx, cy, rx, ry):
    m = set()
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + 0.5 - cx) / max(rx, 0.01); dy = (y + 0.5 - cy) / max(ry, 0.01)
            if dx * dx + dy * dy <= 1.0:
                m.add((x, y))
    return m


def m_poly(pts):
    m = set()
    ys = [p[1] for p in pts]
    n = len(pts)
    for y in range(int(min(ys)) - 1, int(max(ys)) + 2):
        yc = y + 0.5
        xs = []
        for i in range(n):
            xa, ya = pts[i]; xb, yb = pts[(i + 1) % n]
            if (ya <= yc < yb) or (yb <= yc < ya):
                xs.append(xa + (yc - ya) * (xb - xa) / (yb - ya))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            for x in range(int(math.ceil(xs[i] - 0.5)), int(math.floor(xs[i + 1] - 0.5)) + 1):
                m.add((x, y))
    return m


def m_seg(x0, y0, x1, y1, r0, r1=None):
    r1 = r0 if r1 is None else r1
    m = set()
    for y in range(int(min(y0, y1) - max(r0, r1)) - 1, int(max(y0, y1) + max(r0, r1)) + 2):
        for x in range(int(min(x0, x1) - max(r0, r1)) - 1, int(max(x0, x1) + max(r0, r1)) + 2):
            px, py = x + 0.5, y + 0.5
            dx, dy = x1 - x0, y1 - y0
            L = dx * dx + dy * dy
            t = 0 if L == 0 else max(0, min(1, ((px - x0) * dx + (py - y0) * dy) / L))
            if math.hypot(px - x0 - t * dx, py - y0 - t * dy) <= r0 + (r1 - r0) * t:
                m.add((x, y))
    return m


def m_bez(p0, p1, p2, r0, r1, steps=40):
    m = set()
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        m |= m_ell(x, y, r0 + (r1 - r0) * t, r0 + (r1 - r0) * t)
    return m


def cyl(cv, m, keys, cuts=(0.18, 0.42, 0.72, 0.9), top=True, ink=None):
    """Shade a mask like a lit cylinder: light from the left. keys run light to dark, one more
    than cuts. top=True brightens pixels whose upper neighbour is outside the mask."""
    rows = {}
    for (x, y) in m:
        a = rows.setdefault(y, [x, x])
        a[0] = min(a[0], x); a[1] = max(a[1], x)
    for (x, y) in m:
        x0, x1 = rows[y]
        u = (x - x0 + 0.5) / (x1 - x0 + 1)
        i = 0
        while i < len(cuts) and u > cuts[i]:
            i += 1
        if top and (x, y - 1) not in m and i > 0:
            i -= 1
        if ink and (x + 1, y) not in m and (x, y + 1) not in m:
            cv.set(x, y, ink)
            continue
        cv.set(x, y, keys[i])


def run_u(m):
    """For every pixel of a mask: its position (0 left .. 1 right) within its own horizontal run."""
    out = {}
    rows = {}
    for (x, y) in m:
        rows.setdefault(y, []).append(x)
    for y, xs in rows.items():
        xs.sort()
        start = xs[0]
        prev = xs[0]
        run = [xs[0]]
        for x in xs[1:] + [None]:
            if x is not None and x == prev + 1:
                run.append(x); prev = x
                continue
            n = len(run)
            for i, rx in enumerate(run):
                out[(rx, y)] = (i + 0.5) / n
            if x is not None:
                run = [x]; prev = x
    return out


def crag(cv, px_, py_, lw, rw, base, seed, snow_to, K, pw=0.8, ledges=True, nzseed=4):
    """A rock crag: jagged left/right edges falling from a peak, a wandering ridge splitting the
    lit left face from the shadowed right face, snow above snow_to, strata ledges.
    K: dict with keys lit, lit2, edge, shade, shade2, snow, snow2, ink (palette keys)."""
    nz = vnoise(nzseed)
    r = random.Random(seed)
    hgt = base - py_
    le = mpd(r, hgt + 1, 2 + hgt * 0.08, 0.62)
    re_ = mpd(r, hgt + 1, 2 + hgt * 0.08, 0.62)
    ri = smooth(mpd(r, hgt + 1, 2.0, 0.6), 1)
    sn = mpd(r, 512, 2.0, 0.7)
    for y in range(max(0, py_), min(cv.H, base + 1)):
        i_ = y - py_
        t = i_ / max(1, hgt)
        t2 = t ** pw
        xl = px_ - lw * t2 + (le[i_] - le[0]) * min(1, t * 3)
        xr = px_ + rw * t2 + (re_[i_] - re_[0]) * min(1, t * 3)
        xd = px_ + (rw - lw) * 0.15 * t + ri[i_] * t * 1.5
        for x in range(int(round(xl)), int(round(xr)) + 1):
            if not (0 <= x < cv.W):
                continue
            lit = x < xd
            ledge = ledges and (((x // 2 + y) % 7 == 0) if lit else ((y - x // 3) % 6 == 0))
            if lit:
                k = K['lit']
                if x - xl < 1.5:
                    k = K['edge']
                elif ledge and nz(x / 3.0, y / 3.0) > 0.45:
                    k = K['lit2']
            else:
                k = K['shade2'] if (x - xd) > 3 else K['shade']
                if ledge and nz(x / 3.0, y / 3.0) > 0.45:
                    k = K['shade'] if k == K['shade2'] else K['shade2']
            st = snow_to + sn[(x * 3) % 512] * 1.5
            gully = nz(x / 2.0, 7.0) > 0.55
            if y < st or (y < st + 5 and gully and lit):
                k = K['snow'] if lit else K['snow2']
            cv.set(x, y, k)
        if K.get('ink') and 0 <= int(round(xr)) + 1 < cv.W:
            cv.set(int(round(xr)) + 1, y, K['ink'])


def rotated(layer, cx, cy, deg):
    """Nearest-neighbour rotation of a layer canvas about (cx, cy). Returns {(x, y): key}."""
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    out = {}
    for y in range(layer.H):
        for x in range(layer.W):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            sx = ca * dx + sa * dy + cx
            sy = -sa * dx + ca * dy + cy
            k = layer.get(sx, sy)
            if k is not None:
                out[(x, y)] = k
    return out
