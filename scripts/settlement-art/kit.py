"""Shared drawing kit for the settlement: palettes and every building / prop, lit from the left.
Every function draws relative to an anchor (usually bottom centre or bottom left) so the same
code renders both the big scenes and the isolated building sprites."""
import math, random
from engine import *

# ------------------------------------------------------------------ palettes (same keys everywhere)
DAWN = {
    'S0': '#1c2648', 'S1': '#34406e', 'S2': '#6c5e92', 'S3': '#c27c98', 'S4': '#efab8e', 'S5': '#ffd9a6', 'SUN': '#fff4d6',
    'F0': '#4c5282', 'F1': '#7c74a4', 'M0': '#34506a',
    'G0': '#1f3240', 'G1': '#365a52', 'G2': '#678a5e',
    'E0': '#3a2c3e', 'E1': '#74564f', 'E2': '#b88a72',
    'K': '#161424', 'B1': '#45303e', 'B2': '#86584c',
    'C0': '#454a66', 'C1': '#7a7c98', 'C2': '#c8bcc4',
    'W1': '#a87048', 'W2': '#dca266', 'W3': '#ffdb8e',
    'R0': '#76304a', 'R1': '#c24e52', 'O': '#ff8a3e',
    'A0': '#2a86a6', 'A1': '#90f2ec',
}
DAY = {
    'S0': '#3864ae', 'S1': '#5486c8', 'S2': '#7eaada', 'S3': '#a6c8e2', 'S4': '#cde0e6', 'S5': '#f0eed8', 'SUN': '#fffbe6',
    'F0': '#7890b6', 'F1': '#a2b8cc', 'M0': '#4e7674',
    'G0': '#294638', 'G1': '#4a7a42', 'G2': '#8fae4c',
    'E0': '#563c36', 'E1': '#966c4c', 'E2': '#d6b07a',
    'K': '#1c1822', 'B1': '#583a30', 'B2': '#9a6440',
    'C0': '#58586a', 'C1': '#8c8c98', 'C2': '#d8d2c2',
    'W1': '#b07a38', 'W2': '#e2b452', 'W3': '#fff0a2',
    'R0': '#8a3434', 'R1': '#d0583e', 'O': '#ff9a3a',
    'A0': '#2a96ae', 'A1': '#9ef6ff',
}
GOLDEN = {
    'S0': '#2f3468', 'S1': '#4f4f8c', 'S2': '#8e5f93', 'S3': '#d97f78', 'S4': '#f4ac6a', 'S5': '#ffd98a', 'SUN': '#fff6cf',
    'F0': '#7a5c8e', 'F1': '#a46f8f', 'M0': '#4c4c6e',
    'G0': '#2e4a4c', 'G1': '#4f6b3c', 'G2': '#8a913f',
    'E0': '#4e3036', 'E1': '#9c6250', 'E2': '#e9c39a',
    'K': '#2a1e34', 'B1': '#5e3a3e', 'B2': '#9c6250',
    'C0': '#5c4a5e', 'C1': '#9a7a80', 'C2': '#e9c39a',
    'W1': '#bf7a32', 'W2': '#e6a94a', 'W3': '#ffd37a',
    'R0': '#7c2e3c', 'R1': '#c4483e', 'O': '#ff8a3a',
    'A0': '#3a8aa0', 'A1': '#a0f0e0',
}
DUSK = {
    'S0': '#12132c', 'S1': '#22234c', 'S2': '#3c3468', 'S3': '#6c3c74', 'S4': '#c25a64', 'S5': '#f29a5a', 'SUN': '#ffd27a',
    'F0': '#372e58', 'F1': '#56406e', 'M0': '#252842',
    'G0': '#172030', 'G1': '#283846', 'G2': '#46584e',
    'E0': '#282034', 'E1': '#52404e', 'E2': '#8a6a6a',
    'K': '#0c0a16', 'B1': '#30223a', 'B2': '#5a3e4a',
    'C0': '#322e48', 'C1': '#57526e', 'C2': '#8c84a0',
    'W1': '#c4702e', 'W2': '#f4a640', 'W3': '#ffe48c',
    'R0': '#5a2038', 'R1': '#b03c4a', 'O': '#ff7a2a',
    'A0': '#3aa2c4', 'A1': '#aaffff',
}


def stage_palette(n):
    return {1: DAWN, 2: lerp_pal(DAWN, DAY, 0.6), 3: DAY, 4: lerp_pal(DAY, GOLDEN, 0.4),
            5: GOLDEN, 6: lerp_pal(GOLDEN, DUSK, 0.5), 7: DUSK}[n]


# ------------------------------------------------------------------ little things

def smoke(cv, x, y, n=10, drift=0.75, col=('C2', 'C1'), wide=True):
    """Rising smoke curling right (wind from the left)."""
    sx, sy = x, y
    for j in range(n):
        sx += drift * (0.6 + j * 0.09)
        sy -= 1.0
        k = col[0] if j < n * 0.45 else col[1]
        cv.set(sx, sy, k)
        if wide and j % 2 == 0:
            cv.set(sx + 1, sy, k)
        if wide and 2 < j < n - 2:
            cv.set(sx, sy - 1, k)
            if j > 4:
                cv.set(sx - 1, sy, k)


def figure(cv, x, yb, body='R1', head='E2', carry=None):
    cv.set(x, yb - 3, head)
    cv.set(x, yb - 2, body)
    cv.set(x, yb - 1, body)
    cv.set(x, yb, 'K')
    if carry:
        cv.set(x + 1, yb - 2, carry)


def flag(cv, x, ytop, h, col='R1', dark='R0', length=5, pole='K'):
    """Pole with a pennant streaming right (wind from the left)."""
    cv.vline(x, ytop, ytop + h, pole)
    for i in range(length):
        dy = 1 if (i % 4) in (1, 2) else 0
        cv.set(x + 1 + i, ytop + dy, col)
        if i < length - 2:
            cv.set(x + 1 + i, ytop + 1 + dy, dark if i > 1 else col)
    cv.set(x, ytop - 1, 'W3')


def banner(cv, x, ytop, h=4, col='R1', dark='R0', trim='W2'):
    """Hanging banner on a wall: vertical cloth with a notched tail."""
    for y in range(ytop, ytop + h):
        cv.set(x, y, col); cv.set(x + 1, y, dark)
    cv.set(x, ytop + h, col)
    cv.set(x, ytop, trim); cv.set(x + 1, ytop, trim)


def lantern(cv, x, y, glow=True):
    cv.set(x, y, 'W3')
    if glow:
        cv.set(x, y + 1, 'O')


def lantern_string(cv, x0, y0, x1, y1, sag=2.0, every=3, cols=('W3', 'O', 'R1', 'W3', 'A1')):
    n = max(1, int(abs(x1 - x0)))
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)
        if i % every == 1:
            cv.set(x, y, 'B1')
            cv.set(x, y + 1, cols[(i // every) % len(cols)])


def crate(cv, x, yb, w=3, h=2):
    cv.rect(x, yb - h + 1, x + w, yb + 1, 'B2')
    cv.vline(x + w - 1, yb - h + 1, yb, 'B1')
    cv.hline(x, x + w - 1, yb - h + 1, 'W1')


def sack(cv, x, yb):
    cv.set(x, yb, 'C1'); cv.set(x + 1, yb, 'C0'); cv.set(x, yb - 1, 'C2')


def barrel(cv, x, yb):
    cv.set(x, yb, 'B2'); cv.set(x + 1, yb, 'B1')
    cv.set(x, yb - 1, 'B2'); cv.set(x + 1, yb - 1, 'K')
    cv.set(x, yb - 2, 'W1'); cv.set(x + 1, yb - 2, 'B1')


def glow_ground(cv, cx, cy, r, ground_keys, warm=('E2', 'W1'), ry=0.45):
    """Warm light pooled on the ground around a fire: only recolours ground pixels."""
    for y in range(int(cy - r * ry) - 1, int(cy + r * ry) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            d = math.hypot((x + 0.5 - cx) / r, (y + 0.5 - cy) / (r * ry))
            if d > 1:
                continue
            k = cv.get(x, y)
            if k in ground_keys:
                if d < 0.38:
                    cv.set(x, y, warm[1])
                elif d < 0.7:
                    cv.set(x, y, warm[0])
                elif d < 0.85 and (x + y) % 2 == 0:
                    cv.set(x, y, warm[0])


# ------------------------------------------------------------------ trees

def tree(cv, x, yb, r, shade=0, kind='round'):
    """Round or pine tree, lit from the upper left. shade 0 = near, 1 = mid, 2 = far (hazier)."""
    hi, mid, lo = [('G2', 'G1', 'G0'), ('G2', 'G1', 'G0'), ('G1', 'M0', 'M0')][min(shade, 2)]
    if kind == 'pine':
        h = int(r * 2.6)
        for i in range(h):
            y = yb - 1 - i
            hw = (h - i) * r / h * 0.95 + 0.3
            if i % 3 == 2:
                hw -= 0.6
            for xx in range(int(round(x - hw)), int(round(x + hw)) + 1):
                u = (xx - (x - hw)) / max(1, 2 * hw)
                k = hi if u < 0.3 else (mid if u < 0.65 else lo)
                cv.set(xx, y, k)
        cv.set(x, yb, 'B1')
        return
    cv.vline(x, yb - r, yb, 'B1')
    cy = yb - r - r * 0.55
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for xx in range(int(x - r) - 1, int(x + r) + 2):
            dx = xx + 0.5 - x - 0.5; dy = y + 0.5 - cy
            d = math.hypot(dx * 0.9, dy * 1.1)
            wob = 0.6 * math.sin(xx * 1.7 + y * 2.3)
            if d <= r + 0.3 + wob * 0.5:
                s = dx + dy * 1.1
                k = hi if s < -r * 0.45 else (mid if s < r * 0.55 else lo)
                cv.set(xx, y, k)


def big_tree(cv, x, yb, lights=0):
    """The landmark oak on the near right bank: flared trunk, low boughs, a clumpy crown
    where every lobe catches the light on its upper-left."""
    # trunk with root flare
    th = 44
    for y in range(yb - th, yb + 1):
        t = (y - (yb - th)) / th
        hw = 2.6 + 1.2 * t + 5.0 * max(0.0, t - 0.82) ** 1.6 * 9
        x0, x1 = int(round(x - hw)), int(round(x + hw))
        for xx in range(x0, x1 + 1):
            u = (xx - x0) / max(1, x1 - x0)
            k = 'B2' if u < 0.3 else ('B1' if u < 0.72 else 'K')
            if k == 'B1' and (y * 3 + xx) % 11 == 0:
                k = 'K'          # bark grooves
            if k == 'B2' and (y + xx * 2) % 9 == 0:
                k = 'W1'
            cv.set(xx, y, k)
    # boughs reaching into the crown
    for (ax, ay, bx, by, w) in [(x, yb - 30, x - 16, yb - 50, 2), (x, yb - 36, x + 6, yb - 58, 2),
                                (x - 1, yb - 26, x - 24, yb - 36, 1), (x + 1, yb - 34, x + 12, yb - 44, 1)]:
        for o in range(w):
            cv.line(ax, ay - o, bx, by - o, 'B1' if o else 'K')
        cv.line(ax, ay - w, bx, by - w, 'B2')
    lobes = [  # cx, cy, r  (back/low first)
        (x + 8, yb - 40, 9), (x - 26, yb - 38, 7), (x - 16, yb - 44, 9), (x + 2, yb - 46, 10),
        (x - 30, yb - 46, 6), (x - 22, yb - 54, 9), (x - 8, yb - 56, 11), (x + 8, yb - 56, 10),
        (x - 14, yb - 66, 9), (x + 2, yb - 68, 10), (x + 12, yb - 66, 7), (x - 4, yb - 76, 8),
        (x - 26, yb - 62, 6), (x + 14, yb - 46, 7),
    ]
    mask = set()
    for (lx, ly, r) in lobes:
        for yy in range(ly - r - 1, ly + r + 2):
            for xx in range(lx - r - 1, lx + r + 2):
                dx, dy = xx + 0.5 - lx, yy + 0.5 - ly
                if dx * dx + dy * dy * 1.2 <= r * r:
                    mask.add((xx, yy))
    for (xx, yy) in mask:
        cv.set(xx, yy, 'G0')
    # each lobe: mid tone body offset up-left, lit cap further up-left
    order = sorted(lobes, key=lambda l: (l[1] + l[0] * 0.3), reverse=True)
    for (lx, ly, r) in order:
        for yy in range(ly - r - 1, ly + r + 2):
            for xx in range(lx - r - 1, lx + r + 2):
                if (xx, yy) not in mask:
                    continue
                dx, dy = xx + 0.5 - lx, yy + 0.5 - ly
                d0 = math.hypot(dx, dy * 1.1)
                if d0 > r:
                    continue
                d1 = math.hypot(dx + r * 0.22, (dy + r * 0.25) * 1.1)
                d2 = math.hypot(dx + r * 0.42, (dy + r * 0.45) * 1.1)
                k = None
                if d1 < r * 0.86:
                    k = 'G1'
                if d2 < r * 0.5:
                    k = 'G2'
                elif d2 < r * 0.62 and bay(xx, yy) < 0.5:
                    k = 'G2'
                if k is None and d0 < r * 0.98 and bay(xx, yy) < 0.25 and d1 < r:
                    k = 'G1'
                if k:
                    cv.set(xx, yy, k)
                elif d0 <= r:
                    cv.set(xx, yy, 'G0')
    # sky-facing rim on the very top-left edge
    for (xx, yy) in mask:
        if (xx, yy - 1) not in mask and (xx - 1, yy) not in mask:
            cv.set(xx, yy, 'G2')
    if lights:
        rr = random.Random(5)
        pts = sorted(mask)
        for _ in range(lights * 10):
            (px_, py_) = pts[rr.randrange(len(pts))]
            if (px_, py_ + 2) in mask and cv.get(px_, py_) == 'G0':
                cv.set(px_, py_, 'W3')
                cv.set(px_, py_ + 1, 'O')


def bush(cv, x, yb, r=2, flowers=None):
    for y in range(yb - r, yb + 1):
        for xx in range(x - r - 1, x + r + 2):
            dx, dy = xx + 0.5 - x - 0.5, (y + 0.5 - yb) * 1.6
            if dx * dx + dy * dy <= (r + 0.6) ** 2:
                cv.set(xx, y, 'G2' if dx + dy < -r * 0.5 else ('G1' if dx < r * 0.5 else 'G0'))
    cv.hline(x - r, x + r, yb, 'G0')
    if flowers:
        cv.set(x - 1, yb - r, flowers); cv.set(x + 1, yb - 1, flowers)


def rock(cv, x, yb, w=3):
    cv.hline(x, x + w - 1, yb, 'C0'); cv.hline(x, x + w - 2, yb - 1, 'C1')
    cv.set(x + w - 1, yb, 'K'); cv.set(x + w - 1, yb - 1, 'C0')
    cv.set(x, yb - 1, 'C2' if w > 3 else 'C1')
    cv.hline(x, x + w, yb + 1, 'G0')


# ------------------------------------------------------------------ camp pieces

def tent(cv, x, yb, w, h, cloth=('W2', 'W1', 'B1'), open_=True):
    """A-frame tent seen from the front-left: lit left half, shaded right half, dark doorway."""
    ax = x + w // 2
    for i in range(h):
        y = yb - i
        hw = (w / 2.0) * (1 - i / h)
        x0, x1 = int(round(ax - hw)), int(round(ax + hw))
        for xx in range(x0, x1 + 1):
            k = cloth[0] if xx < ax else (cloth[1] if xx < x1 else cloth[2])
            cv.set(xx, y, k)
    cv.set(ax, yb - h, 'K'); cv.set(ax, yb - h - 1, 'B1')
    if open_:
        for i in range(max(1, h // 2)):
            hw = max(0, (h // 2 - i - 1) * 0.6)
            cv.hline(ax - hw, ax + hw, yb - i, 'K')
    cv.hline(x - 1, x + w + 1, yb + 1, 'G0')


def bedroll(cv, x, y, col='R1'):
    cv.hline(x, x + 2, y, col)
    cv.set(x + 3, y, 'C2')
    cv.set(x + 2, y, 'R0' if col == 'R1' else 'B1')


def campfire(cv, x, yb, size=1, ground=None, smoke_on=True):
    if ground:
        glow_ground(cv, x, yb + 1, 5 + 2 * size, ground, ('W1', 'W2'))
    cv.hline(x - 2, x + 2, yb, 'B1')
    cv.set(x - 2, yb, 'B2'); cv.set(x + 2, yb, 'K')
    cv.set(x - 1, yb - 1, 'O'); cv.set(x, yb - 1, 'W3'); cv.set(x + 1, yb - 1, 'O')
    cv.set(x, yb - 2, 'W2'); cv.set(x - 1, yb - 2, 'O')
    cv.set(x, yb - 3, 'O')
    if size > 1:
        cv.set(x + 1, yb - 2, 'W2'); cv.set(x, yb - 4, 'O'); cv.set(x - 1, yb - 3, 'R1')
        cv.set(x, yb - 3, 'W2'); cv.set(x + 1, yb - 3, 'O'); cv.set(x, yb - 5, 'R1')
    # sparks
    cv.set(x + 1, yb - 5, 'W3'); cv.set(x - 1, yb - 7, 'O')
    # stones
    cv.set(x - 3, yb, 'C1'); cv.set(x + 3, yb, 'C0')
    if smoke_on:
        smoke(cv, x, yb - 5, 11, 0.6, ('C1', 'F1'))


def cart(cv, x, yb, flip=False, load=True, horse=False):
    """Two-wheeled cart, ~10 px."""
    d = -1 if flip else 1
    cv.hline(x - 4, x + 4, yb - 2, 'B2')
    cv.hline(x - 4, x + 4, yb - 1, 'B1')
    cv.set(x - 4, yb - 3, 'B2'); cv.set(x + 4, yb - 3, 'B1')
    # wheel
    cv.set(x - 1, yb - 1, 'K'); cv.set(x + 1, yb - 1, 'K'); cv.set(x, yb, 'K'); cv.set(x, yb - 2, 'K')
    cv.set(x - 1, yb, 'K'); cv.set(x + 1, yb, 'K'); cv.set(x, yb - 1, 'B2')
    # shafts
    cv.line(x + d * 5, yb - 2, x + d * 8, yb - 1, 'B1')
    if load:
        sack(cv, x - 3, yb - 3); sack(cv, x - 1, yb - 3); crate(cv, x + 1, yb - 3, 3, 2)
        cv.set(x - 2, yb - 5, 'C2'); cv.set(x - 1, yb - 5, 'C1')
    if horse:
        hx = x + d * 9
        cv.rect(min(hx, hx + d * 3), yb - 3, max(hx, hx + d * 3) + 1, yb - 1, 'B1')
        cv.set(hx, yb - 3, 'B2'); cv.set(hx + d, yb - 3, 'B2')
        cv.set(hx + d * 4, yb - 4, 'B1'); cv.set(hx + d * 4, yb - 5, 'B1'); cv.set(hx + d * 5, yb - 4, 'B1')
        cv.set(hx + d * 3, yb - 4, 'K')
        for lx in (hx, hx + d * 3):
            cv.vline(lx, yb - 1, yb, 'K')


def logpile(cv, x, yb):
    for i, (dx, dy) in enumerate([(0, 0), (2, 0), (4, 0), (1, -1), (3, -1), (2, -2)]):
        cv.set(x + dx, yb + dy, 'B2'); cv.set(x + dx + 1, yb + dy, 'W1' if i % 2 else 'E2')


def runestone(cv, x, yb, h=4, glow=True, w=2):
    for y in range(yb - h + 1, yb + 1):
        for xx in range(x, x + w):
            cv.set(xx, y, 'C2' if xx == x else 'C1')
        cv.set(x + w, y, 'C0')
    cv.set(x + 1, yb - h, 'C1')
    if w > 2:
        cv.set(x + 1, yb - h, 'C2'); cv.set(x + 2, yb - h, 'C1')
    if glow:
        cv.set(x + 1, yb - h // 2 - 1, 'A1')
        if h > 5:
            cv.set(x + 1, yb - h // 2 + 1, 'A0')


def stone_ring(cv, cx, cy, rx, ry, n, h, glow=True, skip_front=False):
    """Ring of rune stones on an ellipse; draws back stones first."""
    pts = []
    for i in range(n):
        a = math.tau * i / n + 0.3
        pts.append((cx + math.cos(a) * rx, cy + math.sin(a) * ry, math.sin(a)))
    pts.sort(key=lambda p: p[1])
    for (px_, py_, s) in pts:
        if skip_front and s > 0.5:
            continue
        hh = h if s > -0.3 else h - 1
        runestone(cv, int(round(px_)) - 1, int(round(py_)), hh, glow)
    return pts


# ------------------------------------------------------------------ structures

def lean_to(cv, x, yb):
    """Workbench under a slanted plank roof, saw and axe stump."""
    cv.vline(x, yb - 6, yb, 'B1'); cv.vline(x + 9, yb - 4, yb, 'K')
    for i in range(11):
        y = yb - 7 + i * 3 // 10
        cv.set(x - 1 + i, y, 'B2' if i % 3 else 'W1')
        cv.set(x - 1 + i, y + 1, 'B1')
    cv.hline(x + 1, x + 8, yb - 2, 'B2')
    cv.hline(x + 1, x + 8, yb - 1, 'K')
    cv.vline(x + 2, yb - 1, yb, 'B1'); cv.vline(x + 7, yb - 1, yb, 'B1')
    cv.set(x + 4, yb - 3, 'C2'); cv.set(x + 5, yb - 3, 'C1')   # tools on the bench
    cv.set(x + 6, yb - 3, 'B2')
    # stump with axe
    cv.rect(x + 12, yb - 1, x + 14, yb + 1, 'B2'); cv.set(x + 13, yb - 1, 'B1')
    cv.set(x + 12, yb - 2, 'E2'); cv.set(x + 13, yb - 3, 'C2'); cv.set(x + 14, yb - 3, 'C1')
    logpile(cv, x - 7, yb)


def house(cv, x, yb, gw, sw, wh, roof='thatch', wall='plaster', lit=0.0, chimney=False, door=True,
          seed=0, storeys=1, smoke_on=True, wins=True):
    """3/4 house: lit gable end on the left (gw wide), shaded long side (sw wide) with the roof plane above.
    x is the left edge of the gable, yb the ground row."""
    rng = random.Random(seed * 7 + x * 13 + yb)
    ey = yb - wh            # eave row (top row of the walls is ey+1)
    ha = (gw + 1) // 2      # gable height
    gx1 = x + gw - 1
    # wall materials
    if wall == 'plaster':
        g_lit, g_frame, s_col, s_frame = 'C2', 'B1', 'C1', 'B1'
    elif wall == 'wood':
        g_lit, g_frame, s_col, s_frame = 'B2', 'B1', 'B1', 'K'
    elif wall == 'stone':
        g_lit, g_frame, s_col, s_frame = 'C2', 'C1', 'C1', 'C0'
    else:  # 'brick' warm stone
        g_lit, g_frame, s_col, s_frame = 'E2', 'E1', 'E1', 'B1'
    # gable end wall (+ gable triangle)
    for y in range(ey + 1 - ha, yb + 1):
        i = (ey + 1) - y          # rows above the eave
        if i > 0:
            x0, x1 = x + i, gx1 - i
        else:
            x0, x1 = x, gx1
        for xx in range(x0, x1 + 1):
            k = g_lit
            if wall == 'plaster' and (xx in (x, gx1) or y == ey + 1 or (storeys > 1 and y == yb - wh // 2)):
                k = g_frame
            if wall == 'wood' and y % 2 == 0 and i <= 0:
                k = g_frame if (xx + y) % 5 else g_lit
            if wall in ('stone', 'brick') and (y + (xx // 3)) % 3 == 0 and (xx + y) % 2 == 0:
                k = g_frame
            if xx == x1 and i <= 0:
                k = g_frame if wall != 'plaster' else 'C1'
            cv.set(xx, y, k)
    # gable window
    if ha >= 3:
        cv.set(x + gw // 2, ey - ha // 2 + 1, 'W3' if rng.random() < lit else 'K')
    # side wall
    for y in range(ey + 1, yb + 1):
        for xx in range(gx1 + 1, gx1 + 1 + sw):
            k = s_col
            if wall == 'plaster' and (xx == gx1 + sw or y == ey + 1 or (xx - gx1) % 5 == 0 or (storeys > 1 and y == yb - wh // 2)):
                k = s_frame
            if wall == 'wood' and (xx - gx1) % 3 == 0:
                k = s_frame
            if wall in ('stone', 'brick') and (y + (xx // 3)) % 3 == 0 and (xx + y) % 2 == 0:
                k = s_frame
            cv.set(xx, y, k)
    cv.hline(x, gx1 + sw, yb, 'B1' if wall in ('plaster', 'wood') else 'C0')
    # door on the gable end
    if door:
        dx = x + gw // 2
        cv.vline(dx, yb - 2, yb, 'K')
        if gw >= 7:
            cv.vline(dx + 1, yb - 2, yb, 'B1')
        if lit > 0.5:
            cv.set(dx, yb - 1, 'O')
    # windows on the side wall: one per bay, a row per storey
    if wins:
        rows = [yb - 2] if storeys == 1 else [yb - 2, yb - 2 - wh // 2]
        if wh <= 3:
            rows = [yb - 1]
        for ry_ in rows:
            for xx in range(gx1 + 2, gx1 + sw - 1, 3 if sw > 6 else 4):
                if xx - gx1 >= sw - 1:
                    continue
                on = rng.random() < lit
                cv.set(xx, ry_, 'W3' if on else 'K')
                if on and wh >= 5:
                    cv.set(xx, ry_ + 1, 'O' if lit > 0.6 else 'W2')
                elif wh >= 5:
                    cv.set(xx, ry_ + 1, 'B1' if wall != 'wood' else 'K')
    # roof
    hi, mid, lo, dk = {'thatch': ('W3', 'W2', 'W1', 'B1'), 'tile': ('R1', 'R1', 'R0', 'B1'),
                       'slate': ('C2', 'C1', 'C0', 'K'), 'shingle': ('B2', 'B2', 'B1', 'K'),
                       'gold': ('W3', 'W2', 'W1', 'B1'), 'teal': ('A1', 'A0', 'C0', 'K')}[roof]
    for i in range(0, ha + 1):
        y = ey - i + 1 if i else ey + 1
        y = ey + 1 - i
        # left (lit) barge edge of the gable
        lx = x + i - 1
        if i > 0:
            cv.set(lx, y, hi if roof != 'slate' else 'C2')
        # roof plane to the right of the gable's right slope
        rx0 = gx1 - i + 1 if i > 0 else gx1 + 1
        rx0 = max(rx0, x + i)
        rx1 = gx1 + sw - i // 3 if False else gx1 + sw
        if i == 0:
            cv.set(x - 1, y, hi)
            continue
        for xx in range(rx0, rx1 + 1):
            k = mid
            if roof in ('tile', 'slate', 'shingle', 'gold', 'teal') and i % 2 == 0:
                k = lo if (xx + i) % 2 else mid
            if roof == 'thatch':
                k = mid if (xx * 3 + i) % 7 else lo
            if i == ha:
                k = hi                      # ridge catches the light
            if i == 1:
                k = lo if roof != 'thatch' else 'W1'
            if xx == rx1:
                k = dk
            cv.set(xx, y, k)
        cv.set(rx1 + 1, y, dk)
    # eave shadow line under the roof plane
    cv.hline(gx1 + 1, gx1 + sw, ey + 1, dk if roof != 'thatch' else 'B1')
    if chimney:
        cx = gx1 + sw - 3
        top = ey - ha
        cv.vline(cx, top - 1, ey - 1, 'C1'); cv.vline(cx + 1, top - 1, ey - 1, 'C0')
        cv.set(cx, top - 2, 'C0'); cv.set(cx + 1, top - 2, 'K')
        if smoke_on:
            smoke(cv, cx, top - 2, 9, 0.7, ('C2', 'F1'))
    return ey - ha


def _trace(pts):
    """Ground points along a polyline, one per pixel step, deduplicated, in drawing order (back first)."""
    out, seen = [], set()
    for i in range(len(pts) - 1):
        (xa, ya), (xb, yb) = pts[i], pts[i + 1]
        n = int(max(abs(xb - xa), abs(yb - ya), 1))
        steep = abs(yb - ya) > abs(xb - xa)
        for j in range(n + 1):
            t = j / n
            p = (int(round(xa + (xb - xa) * t)), int(round(ya + (yb - ya) * t)))
            if p not in seen:
                seen.add(p)
                out.append((p[0], p[1], steep, len(out)))
    out.sort(key=lambda q: (q[1], q[3]))
    return out


def palisade(cv, pts, h=6, gate=None):
    """Sharpened log wall along a polyline of ground points. gate = (x0, x1) leaves an opening.
    Receding (steep) runs stack their logs so the wall reads as a solid band seen edge-on."""
    for (x, y, steep, i) in _trace(pts):
        if gate and gate[0] <= x <= gate[1]:
            continue
        lit = (x % 2 == 0) if not steep else (y % 3 != 0)
        cv.vline(x, y - h + 1, y, 'B2' if lit else 'B1')
        cv.set(x, y - h, 'E2' if lit else 'B2')
        if lit and (not steep or y % 3 == 1):
            cv.set(x, y - h - 1, 'E2')
        cv.set(x, y - 2, 'K' if not lit else 'B1')   # binding rope
        cv.set(x, y, 'K')
        if steep:
            cv.set(x + 1, y - h + 2, 'K')   # shadow side of the receding run


def watch_platform(cv, x, yb, h=10):
    cv.vline(x, yb - h, yb, 'B2'); cv.vline(x + 6, yb - h, yb, 'B1')
    cv.line(x, yb, x + 6, yb - h + 2, 'B1')
    cv.hline(x - 1, x + 7, yb - h, 'B2'); cv.hline(x - 1, x + 7, yb - h + 1, 'K')
    cv.vline(x - 1, yb - h - 3, yb - h, 'B2'); cv.vline(x + 7, yb - h - 3, yb - h, 'B1')
    cv.hline(x - 1, x + 7, yb - h - 3, 'B2')
    # ladder
    for y in range(yb - h + 2, yb + 1, 2):
        cv.set(x + 3, y, 'B2')
    figure(cv, x + 3, yb - h - 1, 'A0')


def standing_stone(cv, x, yb, h=10):
    for y in range(yb - h, yb + 1):
        t = (y - (yb - h)) / h
        hw = 1.2 + 0.9 * t
        x0, x1 = int(round(x - hw)), int(round(x + hw))
        for xx in range(x0, x1 + 1):
            cv.set(xx, y, 'C2' if xx == x0 else ('C0' if xx == x1 else 'C1'))
    for (dy, k) in [(3, 'A1'), (5, 'A0'), (6, 'A1'), (8, 'A1')]:
        if dy < h:
            cv.set(x, yb - h + dy, k)


def crystal(cv, x, ytop, h=7, halo=True):
    """Floating rune crystal: elongated diamond with a dithered halo."""
    if halo:
        for y in range(ytop - 4, ytop + h + 4):
            for xx in range(x - 6, x + 7):
                d = math.hypot((xx - x) / 6.0, (y - (ytop + h / 2)) / (h / 2 + 4))
                if d < 1 and bay(xx, y) < q4((1 - d) * 0.9):
                    k = cv.get(xx, y)
                    if k and k.startswith('S'):
                        cv.set(xx, y, 'A0')
    mid = h // 2
    for i in range(h):
        hw = (i if i <= mid else h - 1 - i) * 0.6
        for xx in range(int(round(x - hw)), int(round(x + hw)) + 1):
            cv.set(xx, ytop + i, 'A1' if xx <= x else 'A0')
    cv.set(x, ytop - 1, 'A1')


def stall(cv, x, yb, col='R1', goods=('W2', 'R1', 'A0')):
    """Market stall with a striped awning, 7 px wide."""
    for xx in range(x, x + 7):
        cv.set(xx, yb - 5, col if (xx - x) % 2 == 0 else 'C2')
        cv.set(xx, yb - 4, 'R0' if (xx - x) % 2 == 0 and col == 'R1' else ('C1' if (xx - x) % 2 else 'A0' if col == 'A1' else 'W1'))
    cv.vline(x, yb - 3, yb, 'B1'); cv.vline(x + 6, yb - 3, yb, 'K')
    cv.hline(x + 1, x + 5, yb - 1, 'B2'); cv.hline(x + 1, x + 5, yb, 'B1')
    for i, g in enumerate(goods):
        cv.set(x + 2 + i, yb - 2, g)


def well(cv, x, yb):
    cv.rect(x - 2, yb - 1, x + 3, yb + 1, 'C1'); cv.hline(x - 2, x + 2, yb - 1, 'C2'); cv.set(x + 2, yb, 'C0')
    cv.vline(x - 2, yb - 5, yb - 2, 'B2'); cv.vline(x + 2, yb - 5, yb - 2, 'B1')
    cv.hline(x - 3, x + 3, yb - 6, 'R0'); cv.hline(x - 2, x + 2, yb - 7, 'R1')
    cv.set(x, yb - 3, 'B1'); cv.set(x, yb - 2, 'C0')


def fence(cv, x0, x1, y):
    for x in range(x0, x1 + 1):
        if x % 3 == 0:
            cv.vline(x, y - 2, y, 'B2')
        else:
            cv.set(x, y - 1, 'B1')


def field(cv, x0, x1, y0, y1, crop='wheat', slant=0.3):
    for y in range(y0, y1 + 1):
        for x in range(x0 + int((y - y0) * -slant), x1 + 1 + int((y - y0) * -slant)):
            if crop == 'wheat':
                k = 'W2' if (y - y0) % 2 == 0 else 'W1'
                if (y - y0) % 2 == 0 and (x + y) % 5 == 0:
                    k = 'W3'
            elif crop == 'dusk':
                k = 'W1' if (y - y0) % 2 == 0 else 'E1'
            elif crop == 'green':
                k = 'G2' if (y - y0) % 2 == 0 else 'G1'
            else:
                k = 'E1' if (y - y0) % 2 == 0 else 'E0'
                if (y - y0) % 2 == 0 and (x % 3 == 0):
                    k = 'G1'
            cv.set(x, y, k)


def jetty(cv, x0, x1, y):
    cv.hline(x0, x1, y, 'B2'); cv.hline(x0, x1, y + 1, 'B1')
    for x in range(x0, x1 + 1, 3):
        cv.vline(x, y + 1, y + 3, 'K')


def boat(cv, x, y, sail=False, col='R1'):
    cv.hline(x - 4, x + 4, y, 'B2'); cv.hline(x - 3, x + 3, y + 1, 'B1'); cv.hline(x - 2, x + 2, y + 2, 'K')
    cv.set(x - 5, y - 1, 'B2'); cv.set(x + 5, y - 1, 'B1')
    if sail:
        cv.vline(x, y - 9, y - 1, 'K')
        for i in range(7):
            w = 1 + i // 2
            cv.hline(x - w, x - 1, y - 8 + i, 'C2')
            cv.hline(x + 1, x + w, y - 8 + i, 'C1')
        flag(cv, x, y - 11, 1, col, 'R0', 3)
    else:
        figure(cv, x - 1, y - 1, 'A0')
    cv.hline(x - 5, x + 5, y + 3, 'S2')


def tower_wood(cv, x, yb, h=16, w=7):
    """Timber watchtower: splayed legs, braced, roofed lookout."""
    top = yb - h
    for y in range(top + 5, yb + 1):
        t = (y - top - 5) / max(1, h - 5)
        off = t * 1.5
        cv.set(x - off, y, 'B2'); cv.set(x + w - 1 + off, y, 'B1')
    for y in range(top + 7, yb - 1, 4):
        cv.line(x, y, x + w - 1, y + 3, 'B1')
        cv.line(x + w - 1, y, x, y + 3, 'K')
    cv.rect(x - 1, top + 2, x + w + 1, top + 6, 'B2')
    cv.vline(x + w, top + 2, top + 5, 'B1')
    cv.hline(x - 1, x + w, top + 5, 'K')
    cv.set(x + 2, top + 3, 'K'); cv.set(x + 4, top + 3, 'K')
    for i in range(4):
        cv.hline(x - 2 + i, x + w + 1 - i, top + 1 - i, 'R1' if i < 2 else 'R0')
        cv.set(x - 2 + i, top + 1 - i, 'O')
        cv.set(x + w + 1 - i, top + 1 - i, 'B1')
    flag(cv, x + w // 2, top - 8, 5, 'R1', 'R0', 5)


def stone_tower(cv, x, yb, w, h, roof='cone', lit=0.0, rcol=('R1', 'R0'), flag_col='R1', seed=1, glow=False):
    """Square stone tower, lit left face. roof: cone / crenel / spire."""
    rng = random.Random(seed)
    top = yb - h
    for y in range(top, yb + 1):
        for xx in range(x, x + w):
            u = (xx - x) / max(1, w - 1)
            k = 'C2' if u < 0.3 else ('C1' if u < 0.75 else 'C0')
            if (y - top) % 3 == 2 and (xx + (y // 3)) % 3 == 0:
                k = 'C1' if k == 'C2' else 'C0'
            cv.set(xx, y, k)
        cv.set(x + w, y, 'K')
    # arrow slits / windows
    for y in range(top + 3, yb - 2, 4):
        on = rng.random() < lit
        cv.set(x + w // 2, y, 'W3' if on else 'K')
        cv.set(x + w // 2, y + 1, 'O' if on else 'K')
    if roof == 'crenel':
        cv.hline(x - 1, x + w, top, 'C1')
        cv.set(x - 1, top, 'C2')
        for xx in range(x - 1, x + w + 1, 2):
            cv.set(xx, top - 1, 'C2' if xx < x + w // 2 else 'C1')
        cv.set(x + w, top - 1, 'C0')
        if flag_col:
            flag(cv, x + w // 2, top - 8, 7, flag_col, 'R0' if flag_col == 'R1' else 'A0', 5)
    else:
        rh = (w + 2) if roof == 'cone' else (w * 2 + 3)
        hi, lo = rcol
        for i in range(rh):
            y = top - i
            hw = (w / 2 + 1) * (1 - i / rh)
            cx = x + (w - 1) / 2
            x0, x1 = int(round(cx - hw)), int(round(cx + hw))
            for xx in range(x0, x1 + 1):
                cv.set(xx, y, hi if xx < cx - 0.2 else lo)
            cv.set(x1, y, 'K' if i < rh - 1 else lo)
        cv.hline(x - 1, x + w, top, 'K')
        if flag_col:
            flag(cv, int(x + (w - 1) / 2), top - rh - 5, 4, flag_col, 'R0' if flag_col == 'R1' else 'A0', 4)
    if glow:
        cv.set(x + w // 2, top + 1, 'W3')


def wall_line(cv, pts, h=6, gaps=(), lit_face=True):
    """Crenellated stone curtain wall along a polyline of ground points."""
    for (x, y, steep, i) in _trace(pts):
        if any(g0 <= x <= g1 for (g0, g1) in gaps):
            continue
        top = y - h + 1
        for yy in range(top, y + 1):
            k = 'C1'
            if (yy - top) % 3 == 1 and (x + yy // 3) % 4 == 0:
                k = 'C0'
            if yy == top + 1:
                k = 'C2'
            if steep and yy > top + 1:
                k = 'C2' if (yy + i) % 4 else 'C1'
            cv.set(x, yy, k)
        cv.set(x, y, 'C0')
        if steep:
            cv.set(x + 1, top, 'C0')
            if y % 2 == 0:
                cv.set(x, top - 1, 'C2')
        else:
            if x % 2 == 0:
                cv.set(x, top - 1, 'C2')
            cv.set(x, top, 'C0' if x % 2 else 'C1')


def gatehouse(cv, x, yb, w=13, h=13, lit=0.0, flag_col='R1'):
    """Twin-towered gate: x is the left edge."""
    tw = 4
    stone_tower(cv, x, yb, tw, h, 'crenel', lit, flag_col=None, seed=x)
    stone_tower(cv, x + w - tw, yb, tw, h, 'crenel', lit, flag_col=None, seed=x + 1)
    # arch block
    for y in range(yb - h + 4, yb + 1):
        for xx in range(x + tw, x + w - tw):
            cv.set(xx, y, 'C1' if (y + xx) % 5 else 'C0')
    for xx in range(x + tw, x + w - tw, 2):
        cv.set(xx, yb - h + 3, 'C2')
    ax = x + w // 2
    for y in range(yb - 5, yb + 1):
        hw = 2 if y > yb - 4 else 1
        cv.hline(ax - hw, ax + hw - 1 if hw > 1 else ax, y, 'K')
    cv.hline(ax - 2, ax + 1, yb - 4, 'B1')        # portcullis hint
    cv.set(ax - 1, yb - 2, 'B1'); cv.set(ax + 1, yb - 2, 'B1')
    banner(cv, ax - 1, yb - h + 5, 3, flag_col, 'R0')
    if flag_col:
        flag(cv, x + 1, yb - h - 7, 6, flag_col, 'R0', 5)
        flag(cv, x + w - 3, yb - h - 7, 6, flag_col, 'R0', 5)


def windmill(cv, x, yb, h, L, ang, lit=False):
    """Stone tower windmill with lattice sails (from the Goldmill banner)."""
    wb = max(3, h // 4 + 1)
    wt = max(2, wb - 2)
    top = yb - h
    for y in range(top, yb + 1):
        t = (y - top) / max(1, h)
        hw = wt + (wb - wt) * t
        x0 = int(round(x - hw)); x1 = int(round(x + hw))
        for xx in range(x0, x1 + 1):
            u = (xx - x0) / max(1, x1 - x0)
            k = 'K' if xx == x1 else ('C2' if u < 0.45 else ('C1' if u < 0.78 else 'C0'))
            cv.set(xx, y, k)
    cv.rect(x - 1, yb - 3, x + 1, yb + 1, 'K')
    wy = top + max(3, h // 4)
    cv.set(x, wy, 'W3' if lit else 'K')
    cw = wt + 2
    for i in range(0, cw + 2):
        y = top - i
        hw = cw - i * 0.85
        if hw < 0:
            break
        for xx in range(int(round(x - hw)), int(round(x + hw)) + 1):
            u = (xx - (x - hw)) / max(1, 2 * hw)
            cv.set(xx, y, 'W3' if u < 0.3 else ('W2' if u < 0.7 else 'W1'))
        cv.set(int(round(x + hw)), y, 'K')
    hx, hy = x + 0.5, top - 1 + 0.5
    for b in range(4):
        a = ang + b * math.pi / 2
        dx, dy = math.cos(a), math.sin(a)
        px_, py_ = -dy, dx
        for yy in range(int(hy - L - 3), int(hy + L + 4)):
            for xx in range(int(hx - L - 3), int(hx + L + 4)):
                rx, ry = xx + 0.5 - hx, yy + 0.5 - hy
                u = rx * dx + ry * dy
                v = rx * px_ + ry * py_
                if u < 0.5 or u > L + 0.5:
                    continue
                if -0.6 <= v < 0.6:
                    cv.set(xx, yy, 'K')
                elif u > 2.5 and 0.6 <= v < 3.6:
                    edge = v > 2.7
                    if edge or int(u) % 3 == 0 or u > L - 0.5:
                        cv.set(xx, yy, 'B1')
                    else:
                        cv.set(xx, yy, 'SUN' if rx < 0 else 'C2')
    cv.set(int(hx), int(hy), 'W1')


def waterwheel(cv, cx, cy, r=4):
    for a in range(0, 360, 15):
        t = math.radians(a)
        cv.set(cx + math.cos(t) * r, cy + math.sin(t) * r, 'B1')
    for a in range(0, 360, 45):
        t = math.radians(a + 10)
        cv.line(cx, cy, cx + math.cos(t) * r, cy + math.sin(t) * r, 'B2')
    cv.set(cx, cy, 'K')


def firework(cv, cx, cy, r, cols=('W3', 'O')):
    for a in range(0, 360, 30):
        t = math.radians(a)
        for s in range(2, r + 1):
            if s % 2 == r % 2 or s == r:
                cv.set(cx + math.cos(t) * s, cy + math.sin(t) * s * 0.9, cols[0] if s > r * 0.6 else cols[1])
    cv.set(cx, cy, cols[0])
