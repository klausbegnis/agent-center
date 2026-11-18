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
