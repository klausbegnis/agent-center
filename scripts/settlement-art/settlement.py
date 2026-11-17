"""The party's settlement in seven growth stages: same hills, river bend and great oak every time.
Run through build.py. draw(n) returns the canvas for stage n (1..7)."""
import math, random
from engine import *
from kit import *

W, H = 224, 112
NAMES = {1: 'Camp', 2: 'Outpost', 3: 'Hamlet', 4: 'Village', 5: 'Town', 6: 'Stronghold', 7: 'Citadel'}

# key building anchors: the same screen spot in every stage
HEARTH = (110, 86)
WORK = (74, 78)
RUNE = (138, 62)
STORE = (148, 85)
KEEP = (56, None)          # y follows the hill top

LIT = {1: 0.25, 2: 0.1, 3: 0.05, 4: 0.12, 5: 0.35, 6: 0.7, 7: 0.92}
SUN = {1: (30, 37, 5), 2: (40, 26, 5), 3: (46, 11, 5), 4: (40, 20, 5), 5: (32, 32, 6), 6: (28, 41, 7), 7: None}
GROUND = {'G0', 'G1', 'G2', 'M0', 'E0', 'E1'}

# ---------------------------------------------------------------- fixed terrain


def hill_top(x):
    return 47 - 9.0 * math.exp(-((x - 56) / 25.0) ** 2) - 2.0 * math.exp(-((x - 20) / 10.0) ** 2)


_GN = smooth(mpd(random.Random(4), W, 1.0, 0.5), 2)


def ground_top(x):
    return min(47 + _GN[x] * 0.6, hill_top(x))


RIVER = [(168, 47, 0.8), (176, 52, 1.5), (175, 58, 2.5), (168, 66, 3.5), (166, 74, 4.5), (171, 84, 5.5),
         (181, 94, 7.0), (189, 104, 8.5), (193, 112, 10.0)]


def river_at(y):
    for i in range(len(RIVER) - 1):
        (xa, ya, wa), (xb, yb, wb) = RIVER[i], RIVER[i + 1]
        if ya <= y <= yb:
            t = (y - ya) / max(1, yb - ya)
            t = t * t * (3 - 2 * t)
            return xa + (xb - xa) * t, wa + (wb - wa) * t
    return None


def path_pts(n):
    """Main road: from the lower-left corner up to the hearth."""
    return [(-2, 106), (30, 100), (66, 94), (88, 90), (104, 88)]


def sky(cv, n):
    sun = SUN[n]
    bands = [(0, 'S0'), (10, 'S1'), (20, 'S2'), (29, 'S3'), (36, 'S4'), (42, 'S5')]
    if n == 3:
        bands = [(0, 'S0'), (12, 'S1'), (24, 'S2'), (33, 'S3'), (39, 'S4'), (44, 'S5')]
    if n == 7:
        bands = [(0, 'S0'), (14, 'S1'), (25, 'S2'), (33, 'S3'), (39, 'S4'), (44, 'S5')]
    SX, SY = (sun[0], sun[1]) if sun else (26, 50)
    for y in range(0, 50):
        for x in range(W):
            d = math.hypot((x - SX) * 0.42, (y - SY) * 1.3)
            yy = y + max(0, 16 - d) * (0.9 if n != 3 else 0.35)
            k = bands[0][1]
            for i in range(len(bands) - 1):
                y0, c0 = bands[i]; y1, c1 = bands[i + 1]
                if yy >= y0:
                    k = c0
                    if yy >= y1 - 3:
                        t = q4((yy - (y1 - 3)) / 3.0)
                        k = c1 if bay(x, y) < t else c0
            if yy >= bands[-1][0]:
                k = bands[-1][1]
            cv.set(x, y, k)
    if sun:
        sx, sy, r = sun
        cv.disc(sx, sy, r + 1.2, 'S5')
        cv.disc(sx, sy, r, 'SUN')
    if n == 7:
        # stars and a thin moon high on the right
        rr = random.Random(77)
        for _ in range(60):
            x, y = rr.randrange(W), rr.randrange(0, 22)
            if cv.get(x, y) in ('S0', 'S1'):
                cv.set(x, y, 'S3' if rr.random() < 0.7 else 'C2')
        for (x, y) in [(150, 6), (96, 4), (184, 12)]:
            cv.set(x, y, 'SUN'); cv.set(x - 1, y, 'S3'); cv.set(x + 1, y, 'S3'); cv.set(x, y - 1, 'S3'); cv.set(x, y + 1, 'S3')
        cv.disc(170, 9, 3.5, 'C2'); cv.disc(171.5, 8, 3.2, 'S0')
    # clouds: flat-bottomed, lit from the sun side
    clouds = {1: [(6, 16, 34, 2.5), (84, 9, 40, 2), (150, 22, 30, 1.5), (120, 33, 22, 1)],
              2: [(70, 12, 36, 2.5), (150, 18, 34, 2), (4, 36, 20, 1)],
              3: [(10, 14, 30, 2.5), (100, 8, 44, 3), (170, 24, 34, 2)],
              4: [(60, 10, 40, 2.5), (150, 20, 36, 2), (10, 28, 24, 1.5)],
              5: [(2, 14, 34, 2.5), (60, 22, 24, 1.5), (110, 8, 40, 2.5), (170, 22, 36, 2)],
              6: [(46, 18, 40, 2), (130, 12, 46, 2.5), (180, 28, 30, 1.5), (6, 26, 20, 1)],
              7: [(40, 28, 46, 1.5), (120, 30, 36, 1.2)]}[n]
    for i, (cx, cy, ln, th) in enumerate(clouds):
        cloud(cv, cx, cy, ln, th, 31 * n + i, SX, n)


def cloud(cv, cx, cy, length, thick, seed, SX, n):
    r = random.Random(seed)
    mask = set()
    m = max(3, length // 4)
    for p in range(m):
        t = (p + 0.5) / m
        px_ = cx + t * length + r.uniform(-1.5, 1.5)
        rad = (thick + 1.2) * (0.45 + 0.9 * math.sin(t * math.pi) ** 1.5) * r.uniform(0.65, 1.3)
        for y in range(int(cy - rad * 1.2) - 1, cy + 2):
            for x in range(int(px_ - rad * 1.5) - 1, int(px_ + rad * 1.5) + 2):
                dx = (x + 0.5 - px_) / (rad * 1.45); dy = (y + 0.5 - cy) / (rad * 1.0)
                if dx * dx + dy * dy <= 1 and y <= cy:
                    mask.add((x, y))
    day = n in (2, 3, 4)
    for (x, y) in mask:
        below = (x, y + 1) not in mask
        below2 = (x, y + 2) not in mask
        above = (x, y - 1) not in mask
        left = (x - 1, y) not in mask
        if day:
            k = 'S4'
            if above or left:
                k = 'S5' if n != 2 else 'SUN'
            if below:
                k = 'S3'
            if above and x < SX + 60:
                k = 'SUN'
        elif n == 7:
            k = 'S2'
            if above:
                k = 'S3'
            if below:
                k = 'S4' if x < 120 else 'S3'
        else:
            k = 'F0'
            if above:
                k = 'S2'
            if left and x < SX + 50:
                k = 'S3'
            if below2:
                k = 'S3'
            if below:
                k = 'S4' if x < SX + 80 else 'S3'
        cv.set(x, y, k)


def mountains(cv, n):
    far = smooth(mpd(random.Random(21), W, 7.0, 0.55), 1)
    peaks = [40 + far[x] - 6 * math.exp(-((x - 118) / 22.0) ** 2) - 4 * math.exp(-((x - 196) / 16.0) ** 2)
             + 3 * math.exp(-((x - 30) / 20.0) ** 2) for x in range(W)]
    for x in range(W):
        top = int(round(peaks[x]))
        sl = peaks[min(W - 1, x + 1)] - peaks[max(0, x - 1)]
        for y in range(top, 50):
            k = 'F1' if sl < -0.15 else 'F0'
            if y > top + 5:
                k = 'F0' if bay(x, y) < q4((y - top - 5) / 5.0) else k
            if y == top and sl < 0.4:
                k = 'F1'
            if y <= top + 1 and peaks[x] < 36 and sl < 0.2:
                k = 'S5' if n != 7 else 'C2'    # snow caps catch the light
            cv.set(x, y, k)
    # far tree line along the horizon
    tl = smooth(mpd(random.Random(9), W, 1.6, 0.8), 0)
    for x in range(W):
        t = int(round(45 + tl[x]))
        for y in range(t, 50):
            cv.set(x, y, 'M0')
        if x % 3 == 0:
            cv.set(x, t - 1, 'M0')


def terrain(cv, n):
    gn = smooth(mpd(random.Random(14), W, 1.0, 0.6), 1)
    for x in range(W):
        top = int(round(ground_top(x)))
        ht = hill_top(x)
        sl = hill_top(min(W - 1, x + 1)) - hill_top(max(0, x - 1))
        on_hill = ht < 46.5
        for y in range(top, H):
            d = y - top
            if on_hill and y < 58:
                if sl < -0.25:
                    k = 'G2'
                    if d > 4:
                        k = 'G1' if bay(x, y) < q4((d - 4) / 8.0) else 'G2'
                elif sl > 0.25:
                    k = 'G1' if d > 1 or bay(x, y) < 0.5 else 'G0'
                    if d > 5:
                        k = 'G1'
                else:
                    k = 'G2' if d < 3 else 'G1'
                if d == 0:
                    k = 'SUN' if sl < -0.3 and n in (1, 5, 6) else ('G2' if sl < 0.3 else 'G1')
                    if n == 7:
                        k = 'G2' if sl < 0 else 'G1'
            else:
                # plain: hazy and light far away, deeper and darker near
                yw = y + 2.5 * math.sin(x / 17.0) + 1.5 * math.sin(x / 7.0 + 1.3)
                if y < 53:
                    k = 'G2' if bay(x, y) < 0.75 else 'F1'
                elif yw < 66:
                    k = 'G2'
                elif yw < 72:
                    k = 'G2' if bay(x, y) < q4(1 - (yw - 66) / 6.0) else 'G1'
                elif yw < 98:
                    k = 'G1'
                else:
                    k = 'G1' if bay(x, y) < q4(1 - (yw - 98) / 6.0) else 'G0'
                # soft large-scale patches
                if 64 <= y < 98 and (gn[x] + math.sin(y * 0.4 + x * 0.05)) > 1.2 and bay(x, y) < 0.25:
                    k = 'G2'
            cv.set(x, y, k)
    # the rune knoll: a low lit mound
    cx, cy = RUNE[0], RUNE[1] + 1
    for y in range(cy - 6, cy + 3):
        for x in range(cx - 18, cx + 18):
            dx, dy = (x + 0.5 - cx) / 17.0, (y + 0.5 - cy) / 5.0
            if dx * dx + dy * dy <= 1:
                s = dx + dy * 0.6
                cv.set(x, y, 'G2' if s < 0.2 else ('G1' if bay(x, y) < 0.5 else 'G2'))
                if dy < -0.75 and dx < 0.3:
                    cv.set(x, y, 'G2')
    # far plain patchwork once there is farming
    if n >= 4:
        for x in range(80, 168):
            for y in range(47, 53):
                if ground_top(x) > y:
                    continue
                band = (y - 47) // 2
                split = (x + band * 7) // (12 + band * 4)
                pick = (band + split) % 4
                k = ['W2', 'G2', 'W1', 'G2'][pick]
                if (y - 47) % 2 == 1 and pick in (0, 2):
                    k = 'G1' if bay(x, y) < 0.5 else k
                cv.set(x, y, k)
    if n >= 7:
        # terraces climbing the far hills to the right
        for x in range(186, W):
            for y in range(42, 50):
                if cv.get(x, y) in ('F0', 'F1', 'M0'):
                    if (y + (x // 9)) % 3 == 0:
                        cv.set(x, y, 'W1')
                    elif (y + (x // 9)) % 3 == 1:
                        cv.set(x, y, 'G1')


def river(cv, n):
    for y in range(47, H):
        r = river_at(y)
        if not r:
            continue
        cx, hw = r
        x0, x1 = int(round(cx - hw)), int(round(cx + hw))
        for x in range(x0, x1 + 1):
            if y < 60:
                k = 'S5' if bay(x, y) < 0.5 else 'S4'
            elif y < 78:
                k = 'S4' if bay(x, y) < q4(1 - (y - 60) / 18.0) else 'S3'
            else:
                k = 'S3' if bay(x, y) < q4(1 - (y - 78) / 24.0) else 'S2'
            if x == x1 and y > 54:
                k = 'S2' if y < 90 else 'S1'
            cv.set(x, y, k)
        cv.set(x0 - 1, y, 'G0')
        if y > 52:
            cv.set(x1 + 1, y, 'E1'); cv.set(x1 + 2, y, 'G0')
        if y > 80:
            cv.set(x0 - 2, y, 'E1' if y % 3 else 'G0')
        if y % 2 == 1 and y > 52:
            r2 = random.Random(y * 31)
            for _ in range(1 + (x1 - x0) // 6):
                dx0 = r2.randint(x0 + 1, max(x0 + 1, x1 - 2))
                ln = r2.randint(1, 2 if y < 80 else 3)
                cv.hline(dx0, min(x1 - 1, dx0 + ln), y, 'SUN' if y < 80 else 'S5')


def foreground(cv, n):
    """Near bank: darker grass, a few tufts and flowers, calm on the left."""
    rr = random.Random(3)
    for x in range(W):
        top = 104 + int(round(1.2 * math.sin(x / 11.0) + 0.7 * math.sin(x / 4.1)))
        r = river_at(top)
        for y in range(top, H):
            if r and abs(x - r[0]) <= r[1] + 1:
                continue
            k = 'G0' if bay(x, y) < q4((y - top) / 6.0 + 0.25) else 'G1'
            if y == top:
                k = 'G1'
            cv.set(x, y, k)
        if x > 120 and rr.random() < 0.35 and not (r and abs(x - r[0]) <= r[1] + 2):
            cv.set(x, top - 1, 'G1'); cv.set(x, top - 2, 'G2' if rr.random() < 0.5 else 'G1')
            if rr.random() < 0.25:
                cv.set(x, top - 3, ['W3', 'R1', 'C2'][rr.randrange(3)])


def road(cv, n):
    pts = path_pts(n)
    hw0 = {1: 0.6, 2: 0.9, 3: 1.2, 4: 1.6, 5: 2.0, 6: 2.4, 7: 2.8}[n]
    paved = n >= 5
    for i in range(len(pts) - 1):
        (xa, ya), (xb, yb) = pts[i], pts[i + 1]
        steps = int(max(abs(xb - xa), abs(yb - ya)) * 2)
        for s in range(steps + 1):
            t = s / steps
            x = xa + (xb - xa) * t; y = ya + (yb - ya) * t
            hw = hw0 * (0.6 + 0.4 * (y - 86) / 20.0)
            hw = max(0.5, hw)
            for xx in range(int(round(x - hw * 2.2)), int(round(x + hw * 2.2)) + 1):
                for yy in range(int(round(y - hw * 0.5)), int(round(y + hw * 0.5)) + 1):
                    if cv.get(xx, yy) in ('G0', 'G1', 'G2', 'E1', 'E0'):
                        if n == 1 and bay(xx, yy) < 0.5:
                            continue
                        if paved:
                            k = 'C1' if (xx + yy * 2) % 4 else 'C0'
                            if yy == int(round(y - hw * 0.5)):
                                k = 'C2'
                        else:
                            k = 'E2' if yy == int(round(y - hw * 0.5)) else 'E1'
                        cv.set(xx, yy, k)


def clearing(cv, cx, cy, rx, ry):
    """Trodden earth around the camp: solid core, dithered rim."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
            wob = 0.08 * math.sin(x * 0.7) + 0.06 * math.sin(y * 1.3 + x * 0.2)
            d += wob
            if d > 1 or cv.get(x, y) not in ('G0', 'G1', 'G2'):
                continue
            if d < 0.45:
                k = 'E2' if (x * 7 + y * 3) % 9 else 'E1'
            elif d < 0.72:
                k = 'E1' if (x * 7 + y * 3) % 11 else 'E2'
            elif d < 0.9:
                k = 'E1'
            else:
                k = 'E1' if (x + y) % 2 == 0 and d < 0.96 else 'G1'
            cv.set(x, y, k)


def lane(cv, pts, n, w=1):
    """Narrow side street/track between two points."""
    paved = n >= 5
    for i in range(len(pts) - 1):
        (xa, ya), (xb, yb) = pts[i], pts[i + 1]
        steps = int(max(abs(xb - xa), abs(yb - ya)) * 2) + 1
        for s in range(steps + 1):
            t = s / steps
            x = int(round(xa + (xb - xa) * t)); y = int(round(ya + (yb - ya) * t))
            for xx in range(x - w, x + w + 1):
                if cv.get(xx, y) in ('G0', 'G1', 'G2', 'F1'):
                    cv.set(xx, y, ('C1' if (xx + y) % 3 else 'C0') if paved else 'E1')
                if cv.get(xx, y - 1) in ('G0', 'G1', 'G2', 'F1') and w > 0:
                    cv.set(xx, y - 1, 'C2' if paved else 'E2')


# ---------------------------------------------------------------- trees (wilderness that recedes)

def tree_slots():
    rr = random.Random(40)
    slots = []
    # forest on the hill
    for _ in range(46):
        x = rr.uniform(6, 104)
        y = hill_top(x) + rr.uniform(1, 12)
        if y > 58:
            continue
        slots.append((int(x), int(y), rr.choice([2, 3, 3, 4]), 'pine' if rr.random() < 0.55 else 'round'))
    # copses on the plain
    for (cx, cy, n_, spread) in [(118, 66, 5, 10), (92, 64, 5, 9), (150, 72, 4, 6), (128, 92, 3, 6),
                                 (60, 86, 3, 8), (40, 74, 4, 8), (156, 56, 3, 6), (100, 56, 4, 10),
                                 (186, 66, 4, 6), (184, 84, 3, 5), (20, 66, 4, 9), (136, 80, 4, 8),
                                 (84, 72, 4, 8), (60, 64, 4, 8), (118, 54, 4, 8), (146, 64, 3, 6),
                                 (30, 82, 3, 7), (100, 96, 3, 8), (160, 94, 2, 4), (12, 54, 4, 8)]:
        for _ in range(n_):
            x = cx + rr.uniform(-spread, spread); y = cy + rr.uniform(-spread * 0.35, spread * 0.35)
            slots.append((int(x), int(y), rr.choice([2, 3, 3, 4]), 'pine' if rr.random() < 0.35 else 'round'))
    return slots


TREES = tree_slots()


def scatter_slots():
    rr = random.Random(55)
    out = []
    for _ in range(60):
        x = rr.uniform(4, 176); y = rr.uniform(58, 100)
        out.append((int(x), int(y), rr.choice(['bush'] * 6 + ['rock', 'flower', 'flower'])))
    return out


SCATTER = scatter_slots()


def tufts(cv, n):
    """Shaped grass tufts (2 px blades with a lit tip) on open ground, sparser in the title corner."""
    for y in range(54, 104):
        for x in range(W):
            h = (x * 73 + y * 151 + (x * y) % 17) % 97
            dens = 2 if not (x < 90 and y > 86) else 0
            if h < dens and cv.get(x, y) in ('G1', 'G2') and cv.get(x, y - 1) in ('G1', 'G2'):
                base = cv.get(x, y)
                cv.set(x, y, 'G0' if base == 'G1' else 'G1')
                cv.set(x, y - 1, 'G2' if base == 'G1' else 'G1')


# cleared ground per stage (ellipses cx, cy, rx, ry), cumulative
CLEAR = {
    1: [(112, 84, 32, 13), (76, 78, 10, 5), (138, 60, 14, 5), (148, 84, 9, 4)],
    2: [(110, 80, 34, 12), (52, 40, 12, 6), (36, 76, 10, 22)],
    3: [(110, 78, 50, 18), (160, 82, 10, 8), (16, 66, 14, 7)],
    4: [(110, 74, 64, 24), (140, 60, 26, 8), (60, 80, 26, 14), (14, 80, 14, 8), (96, 56, 18, 6)],
    5: [(100, 70, 80, 30), (56, 44, 30, 10), (154, 58, 18, 8), (20, 50, 12, 6)],
    6: [(100, 64, 94, 34), (186, 72, 10, 12), (90, 50, 30, 8)],
    7: [(110, 60, 110, 40), (40, 50, 40, 12)],
}


def cleared(n, x, y):
    for s in range(1, n + 1):
        for (cx, cy, rx, ry) in CLEAR[s]:
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                return True
    r = river_at(y)
    if r and abs(x - r[0]) <= r[1] + 3:
        return True
    return False


# ---------------------------------------------------------------- the five key buildings

def hearth(cv, n, x, yb, lit, sprite_tier=None):
    if n == 1:
        campfire(cv, x, yb, 2, GROUND)
        bedroll(cv, x - 8, yb + 1, 'R1'); bedroll(cv, x + 5, yb + 2, 'A0'); bedroll(cv, x - 4, yb + 3, 'W1')
        logpile(cv, x + 6, yb - 1)
        figure(cv, x - 4, yb, 'A0'); figure(cv, x + 4, yb, 'R1')
    elif n == 2:
        glow_ground(cv, x, yb, 10, GROUND)
        # open cooking shelter: four posts and a thatched lid over a stone hearth
        cv.vline(x - 6, yb - 6, yb, 'B2'); cv.vline(x + 6, yb - 6, yb, 'B1')
        for i in range(4):
            cv.hline(x - 8 + i, x + 8 - i, yb - 7 - i, 'W2' if i else 'W1')
            cv.set(x - 8 + i, yb - 7 - i, 'W3'); cv.set(x + 8 - i, yb - 7 - i, 'B1')
        cv.hline(x - 7, x + 7, yb - 6, 'B1')
        cv.rect(x - 3, yb - 1, x + 4, yb + 1, 'C1'); cv.hline(x - 3, x + 3, yb - 1, 'C2'); cv.set(x + 3, yb, 'C0')
        cv.set(x - 1, yb - 2, 'O'); cv.set(x, yb - 2, 'W3'); cv.set(x + 1, yb - 2, 'O'); cv.set(x, yb - 3, 'O')
        cv.vline(x, yb - 6, yb - 5, 'K'); cv.rect(x - 1, yb - 5, x + 2, yb - 3, 'K'); cv.set(x - 1, yb - 5, 'C1')
        smoke(cv, x + 2, yb - 11, 10, 0.7, ('C2', 'F1'))
        cv.hline(x - 12, x - 9, yb + 1, 'B2'); cv.hline(x + 9, x + 12, yb + 2, 'B2')
        figure(cv, x - 10, yb, 'A0'); figure(cv, x + 10, yb + 1, 'R1'); figure(cv, x - 4, yb + 2, 'W1')
    elif n == 3:
        glow_ground(cv, x - 2, yb + 1, 8, GROUND)
        house(cv, x - 13, yb, 9, 16, 5, 'thatch', 'wood', max(lit, 0.6), True, seed=1)
        campfire(cv, x - 15, yb + 3, 1, smoke_on=False)
        figure(cv, x - 17, yb + 3, 'A0'); figure(cv, x - 4, yb + 2, 'R1')
    elif n == 4:
        house(cv, x - 15, yb, 11, 18, 6, 'tile', 'wood', max(lit, 0.5), True, seed=2)
        cv.hline(x - 16, x - 4, yb - 6, 'R0')
        banner(cv, x - 15, yb - 5, 3, 'R1', 'R0'); banner(cv, x - 6, yb - 5, 3, 'R1', 'R0')
        figure(cv, x - 12, yb + 2, 'A0'); figure(cv, x - 1, yb + 2, 'W1'); figure(cv, x + 6, yb + 1, 'R1')
    elif n == 5:
        house(cv, x - 16, yb, 13, 20, 9, 'tile', 'stone', max(lit, 0.5), True, seed=3, storeys=2)
        house(cv, x - 22, yb + 1, 5, 4, 5, 'tile', 'plaster', lit, False, seed=4, door=True)
        banner(cv, x - 14, yb - 7, 4); banner(cv, x - 6, yb - 7, 4)
        flag(cv, x - 10, yb - 25, 6, 'R1', 'R0', 6)
    else:
        big = n == 7
        gw, sw, wh = (15, 22, 10) if not big else (15, 24, 11)
        top = house(cv, x - 17, yb, gw, sw, wh, 'gold' if big else 'tile', 'stone', max(lit, 0.6), True, seed=5, storeys=2)
        # porch with columns
        cv.hline(x - 18, x - 2, yb - 4, 'C2' if big else 'C1')
        for px_ in range(x - 17, x - 2, 3):
            cv.vline(px_, yb - 3, yb, 'C2'); cv.set(px_ + 1, yb - 2, 'C0')
        banner(cv, x - 16, yb - 9, 5, 'R1', 'R0'); banner(cv, x - 5, yb - 9, 5, 'R1', 'R0')
        for fx in (x - 14, x - 6):
            flag(cv, fx, top - 6, 6, 'R1', 'R0', 6)
        if big:
            # bell cupola on the ridge
            cx = x + 6
            cv.rect(cx - 2, top - 2, cx + 3, top + 3, 'C2'); cv.set(cx + 2, top, 'C0'); cv.set(cx + 2, top + 1, 'C0')
            cv.set(cx, top, 'W3'); cv.set(cx, top + 1, 'O')
            for i in range(4):
                cv.hline(cx - 3 + i, cx + 3 - i, top - 3 - i, 'W2' if i % 2 else 'W3')
            flag(cv, cx, top - 13, 6, 'A1', 'A0', 6)
        figure(cv, x - 10, yb + 2, 'A0'); figure(cv, x - 8, yb + 3, 'R1'); figure(cv, x + 3, yb + 2, 'W2')


def workshop(cv, n, x, yb, lit, gr=GROUND):
    if n == 1:
        lean_to(cv, x - 5, yb)
    elif n == 2:
        house(cv, x - 6, yb, 7, 9, 5, 'shingle', 'wood', 0.0, False, seed=10, wins=False)
        # open front with a glowing brazier and a sawhorse
        cv.rect(x + 3, yb - 3, x + 8, yb + 1, 'K')
        cv.set(x + 5, yb - 1, 'O'); cv.set(x + 6, yb, 'W2')
        cv.line(x - 11, yb, x - 9, yb - 2, 'B2'); cv.line(x - 7, yb, x - 9, yb - 2, 'B1'); cv.hline(x - 12, x - 6, yb - 2, 'B2')
        logpile(cv, x + 12, yb)
        figure(cv, x - 2, yb + 2, 'W1')
    elif n == 3:
        glow_ground(cv, x + 3, yb + 1, 6, gr, ('W1', 'O'))
        top = house(cv, x - 7, yb, 7, 11, 5, 'thatch', 'stone', 0.3, False, seed=11, wins=False)
        cv.rect(x + 2, yb - 3, x + 8, yb + 1, 'K')
        cv.rect(x + 3, yb - 2, x + 7, yb + 1, 'O'); cv.hline(x + 4, x + 6, yb - 1, 'W3')
        cv.vline(x + 8, top - 4, yb - 6, 'C1'); cv.vline(x + 9, top - 4, yb - 6, 'C0')
        smoke(cv, x + 8, top - 5, 12, 0.8, ('C1', 'C0'))
        cv.set(x - 10, yb, 'C0'); cv.hline(x - 11, x - 9, yb - 1, 'C1')   # anvil
        figure(cv, x - 12, yb + 1, 'R1')
    elif n == 4:
        glow_ground(cv, x + 4, yb + 1, 8, gr, ('W1', 'O'))
        top = house(cv, x - 9, yb, 9, 13, 6, 'tile', 'stone', 0.3, False, seed=12, wins=False)
        cv.rect(x + 2, yb - 4, x + 10, yb + 1, 'K')
        cv.rect(x + 3, yb - 3, x + 9, yb + 1, 'O'); cv.hline(x + 4, x + 8, yb - 1, 'W3'); cv.set(x + 6, yb - 2, 'W3')
        for cx in (x + 4, x + 10):
            cv.vline(cx, top - 4, yb - 7, 'C1'); cv.vline(cx + 1, top - 4, yb - 7, 'C0')
            cv.set(cx, top - 5, 'O')
            smoke(cv, cx, top - 6, 12, 0.8, ('C1', 'C0'))
        barrel(cv, x - 12, yb); cv.hline(x - 15, x - 13, yb - 1, 'C1'); cv.set(x - 14, yb, 'C0')
        cv.vline(x - 10, yb - 7, yb - 4, 'B1'); cv.hline(x - 10, x - 8, yb - 7, 'B1'); cv.rect(x - 9, yb - 6, x - 7, yb - 4, 'W2')
        figure(cv, x - 4, yb + 2, 'R1'); figure(cv, x + 12, yb + 2, 'A0')
    else:
        big = n >= 6
        glow_ground(cv, x + 4, yb + 2, 7, gr, ('W1', 'O') if n < 7 else ('E1', 'W1'))
        gw, sw, wh = (9, 15, 8) if n == 5 else ((11, 17, 9) if n == 6 else (11, 19, 10))
        top = house(cv, x - 11, yb, gw, sw, wh, 'slate', 'stone', 0.3, False, seed=13, wins=False, storeys=2)
        gx1 = x - 11 + gw
        # glowing vents along the shaded wall
        for vx in range(gx1 + 1, gx1 + sw - 1, 4):
            cv.rect(vx, yb - wh + 3, vx + 2, yb - wh + 5, 'O'); cv.set(vx, yb - wh + 3, 'W3')
        cv.rect(gx1 + 2, yb - 4, gx1 + 9, yb + 1, 'K')
        cv.rect(gx1 + 3, yb - 3, gx1 + 8, yb + 1, 'O'); cv.hline(gx1 + 4, gx1 + 7, yb - 1, 'W3')
        stacks = [gx1 + 3, gx1 + 9] if n == 5 else [gx1 + 2, gx1 + 8, gx1 + 14]
        for i, cx in enumerate(stacks):
            ht = 8 + 3 * (i % 2) + (4 if big else 0)
            cv.vline(cx, top - ht, yb - wh - 1, 'C1'); cv.vline(cx + 1, top - ht, yb - wh - 1, 'C0')
            cv.hline(cx - 1, cx + 2, top - ht, 'C2')
            cv.set(cx, top - ht - 1, 'O'); cv.set(cx + 1, top - ht - 1, 'W3')
            smoke(cv, cx, top - ht - 2, 14, 0.85, ('C1', 'C0'))
            if big:
                cv.set(cx + 1, top - ht - 5, 'O'); cv.set(cx + 3, top - ht - 8, 'W3')
        barrel(cv, x - 14, yb); crate(cv, x - 18, yb)
        cv.hline(x - 16, x - 14, yb - 4, 'C1')
        if big:
            # ore cart on rails
            cv.hline(gx1 + sw + 1, gx1 + sw + 10, yb + 1, 'C0')
            cv.rect(gx1 + sw + 3, yb - 2, gx1 + sw + 8, yb, 'B1'); cv.hline(gx1 + sw + 3, gx1 + sw + 7, yb - 2, 'C2')
            cv.set(gx1 + sw + 4, yb, 'K'); cv.set(gx1 + sw + 7, yb, 'K')
            banner(cv, x - 10, yb - wh + 2, 4, 'R1', 'R0')
        figure(cv, x - 6, yb + 2, 'R1'); figure(cv, gx1 + 5, yb + 3, 'W1')


def rune(cv, n, x, yb, lit, gr=GROUND):
    if n == 1:
        stone_ring(cv, x, yb, 9, 2.6, 7, 4)
    elif n == 2:
        stone_ring(cv, x, yb, 10, 2.8, 8, 5)
        standing_stone(cv, x, yb, 11)
        for (dx, dy) in [(-3, -13), (3, -15), (0, -18), (-2, -21)]:
            cv.set(x + dx, yb + dy, 'A1' if dy % 2 else 'A0')
    elif n == 3:
        pts = stone_ring(cv, x, yb, 12, 3, 8, 5, skip_front=True)
        shrine(cv, x, yb, 1)
        for (px_, py_, s) in pts:
            if s > 0.5:
                runestone(cv, int(round(px_)) - 1, int(round(py_)), 5)
    elif n == 4:
        stone_ring(cv, x, yb, 14, 3.4, 10, 5, skip_front=True)
        shrine(cv, x, yb, 2)
    elif n == 5:
        temple(cv, x, yb, 1)
    elif n == 6:
        temple(cv, x, yb, 2)
    else:
        temple(cv, x, yb, 3)


def shrine(cv, x, yb, tier):
    """Round stone sanctum with a conical roof and a glowing doorway."""
    w = 9 if tier == 1 else 13
    h = 6 if tier == 1 else 9
    x0 = x - w // 2
    for y in range(yb - h, yb + 1):
        for xx in range(x0, x0 + w):
            u = (xx - x0) / (w - 1)
            k = 'C2' if u < 0.3 else ('C1' if u < 0.75 else 'C0')
            if (y - yb) % 3 == 0 and (xx + y) % 4 == 0:
                k = 'C0' if k != 'C2' else 'C1'
            cv.set(xx, y, k)
    cv.vline(x, yb - 3, yb, 'A1'); cv.vline(x + 1, yb - 3, yb, 'A0'); cv.set(x, yb - 4, 'A0')
    rh = w // 2 + 3
    for i in range(rh):
        y = yb - h - 1 - i
        hw = (w / 2 + 1) * (1 - i / rh)
        for xx in range(int(round(x - hw)), int(round(x + hw)) + 1):
            cv.set(xx, y, 'A0' if xx < x else 'C0')
        cv.set(int(round(x - hw)), y, 'A1' if i < rh - 1 else 'A0')
    cv.hline(x0 - 1, x0 + w, yb - h, 'C1'); cv.set(x0 - 1, yb - h, 'C2')
    crystal(cv, x, yb - h - rh - 7, 5 if tier == 1 else 7, halo=tier > 1)
    if tier > 1:
        runestone(cv, x0 - 4, yb + 1, 6, w=2); runestone(cv, x0 + w + 2, yb + 1, 6, w=2)


def temple(cv, x, yb, tier):
    """Columned temple (5), with an arcane tower (6), then a twin-spired cathedral (7)."""
    rng = random.Random(tier)
    if tier >= 3:
        # cathedral nave behind, long roof running right
        house(cv, x - 4, yb - 3, 11, 16, 9, 'slate', 'stone', 0.8, False, seed=70, door=False, storeys=2)
        # rose window on the gable
        cv.disc(x + 1.5, yb - 15, 2.2, 'A0'); cv.set(x + 1, yb - 15, 'A1'); cv.set(x + 2, yb - 16, 'W3')
    # stepped base
    w = 21 if tier < 3 else 23
    x0 = x - w // 2
    cv.rect(x0 - 2, yb - 1, x0 + w + 2, yb + 1, 'C1'); cv.hline(x0 - 2, x0 + w + 1, yb - 1, 'C2')
    cv.rect(x0 - 1, yb - 2, x0 + w + 1, yb - 1, 'C2')
    # columns
    ch = 8 if tier < 3 else 9
    for cx in range(x0, x0 + w, 3):
        cv.vline(cx, yb - 2 - ch, yb - 3, 'C2'); cv.vline(cx + 1, yb - 2 - ch, yb - 3, 'C0')
    for xx in range(x0 + 2, x0 + w - 1, 3):
        cv.vline(xx, yb - 2 - ch, yb - 3, 'A0' if rng.random() < 0.6 else 'K')
    cv.set(x0 + w // 2 - 1, yb - 4, 'A1'); cv.set(x0 + w // 2 - 1, yb - 5, 'A1')
    # entablature + pediment
    ey = yb - 3 - ch
    cv.rect(x0 - 1, ey - 1, x0 + w + 1, ey + 1, 'C2'); cv.hline(x0 - 1, x0 + w, ey, 'C1')
    ph = w // 2 + 1
    for i in range(ph // 2 + 1):
        y = ey - 2 - i
        cv.hline(x0 - 1 + 2 * i, x0 + w - 2 * i, y, 'C1' if i else 'C0')
        cv.set(x0 - 1 + 2 * i, y, 'C2'); cv.set(x0 + w - 2 * i, y, 'K')
    pt = ey - 2 - ph // 2
    cv.set(x, ey - 4, 'A1')
    if tier == 1:
        crystal(cv, x, pt - 12, 9)
    else:
        # arcane tower rising from behind the temple
        tx, tw = x + 4, 5
        th = 30 if tier == 2 else 38
        for y in range(yb - th, ey - 1):
            for xx in range(tx, tx + tw):
                u = (xx - tx) / (tw - 1)
                k = 'C2' if u < 0.3 else ('C1' if u < 0.7 else 'C0')
                if (y % 4 == 0) and xx == tx + 2:
                    k = 'A1' if rng.random() < 0.7 else 'W3'
                cv.set(xx, y, k)
            cv.set(tx + tw, y, 'K')
        tt = yb - th
        cv.hline(tx - 1, tx + tw, tt, 'C2'); cv.hline(tx - 1, tx + tw, tt + 1, 'C0')
        for i in range(7):
            hw = 3.5 * (1 - i / 7)
            for xx in range(int(round(tx + 2 - hw)), int(round(tx + 2 + hw)) + 1):
                cv.set(xx, tt - 1 - i, 'A0' if xx <= tx + 1 else 'C0')
        crystal(cv, tx + 2, tt - 18, 8)
        for (dx, dy) in [(-6, -12), (7, -14), (-4, -22), (6, -24)]:
            cv.set(tx + 2 + dx, tt + dy, 'A1')
        if tier >= 3:
            # twin spires on the left of the cathedral
            for (sx, sh) in [(x - 14, 24), (x - 8, 20)]:
                stone_tower(cv, sx, yb - 2, 4, sh, 'spire', 0.9, ('C1', 'C0'), 'A1', seed=sx)


def store(cv, n, x, yb, lit):
    if n == 1:
        cart(cv, x, yb, flip=True)
        barrel(cv, x + 6, yb); barrel(cv, x + 8, yb + 1); sack(cv, x - 8, yb + 1)
        # tethered horse grazing nearby
        hx, hy = x + 12, yb - 3
        cv.rect(hx, hy, hx + 4, hy + 2, 'B2'); cv.set(hx + 3, hy + 1, 'B1'); cv.set(hx + 4, hy + 1, 'B1')
        cv.set(hx - 1, hy + 1, 'B1'); cv.set(hx - 2, hy + 2, 'B1'); cv.set(hx, hy, 'W1')
        cv.vline(hx, hy + 2, hy + 3, 'K'); cv.vline(hx + 3, hy + 2, hy + 3, 'K'); cv.set(hx + 4, hy - 1, 'B1')
    elif n == 2:
        house(cv, x - 6, yb, 5, 7, 4, 'shingle', 'wood', 0.0, False, seed=20)
        cart(cv, x + 12, yb + 2, flip=True)
        crate(cv, x - 10, yb); crate(cv, x - 9, yb - 2, 2, 2); sack(cv, x + 6, yb + 1); barrel(cv, x + 3, yb + 2)
    elif n == 3:
        # granary store raised on posts against damp and rats, a ladder, goods stacked below
        house(cv, x - 8, yb - 3, 7, 9, 5, 'thatch', 'wood', 0.0, False, seed=21)
        cv.hline(x - 9, x + 8, yb - 2, 'K')
        for sx in (x - 8, x - 4, x + 1, x + 6):
            cv.vline(sx, yb - 1, yb + 1, 'B2'); cv.set(sx + 1, yb - 1, 'B1')
        cv.line(x - 11, yb + 1, x - 7, yb - 3, 'B2')
        crate(cv, x - 5, yb + 1); sack(cv, x - 1, yb + 1); sack(cv, x + 3, yb + 1)
        cart(cv, x + 14, yb + 2, flip=True)
        stall(cv, x - 18, yb + 4, 'R1')
        figure(cv, x + 7, yb + 3, 'A0')
    elif n == 4:
        house(cv, x - 4, yb - 4, 7, 10, 6, 'tile', 'wood', lit, False, seed=22)
        plaza(cv, x - 8, yb - 2, x + 14, yb + 4, n)
        stall(cv, x - 12, yb + 2, 'R1', ('W2', 'R1', 'G2'))
        stall(cv, x - 3, yb + 4, 'A1', ('W3', 'B2', 'R1'))
        stall(cv, x + 6, yb + 3, 'R1', ('A1', 'W2', 'C2'))
        for (fx, fy, c) in [(x - 5, yb + 5, 'R1'), (x + 4, yb + 6, 'A0'), (x + 14, yb + 4, 'W1'), (x - 14, yb + 4, 'W2')]:
            figure(cv, fx, fy, c)
    else:
        tier = n - 4
        gw, sw, wh = [(9, 12, 9), (11, 14, 10), (11, 16, 11)][tier - 1]
        top = house(cv, x - 6, yb - 2, gw, sw, wh, 'tile' if tier < 3 else 'gold', 'plaster', max(lit, 0.4), True, seed=23, storeys=2)
        # banners down the facade, a flag on the ridge
        banner(cv, x - 5, yb - wh + 1, 4, 'A1', 'A0'); banner(cv, x - 6 + gw - 3, yb - wh + 1, 4, 'A1', 'A0')
        flag(cv, x - 6 + gw // 2, top - 7, 6, 'A1', 'A0', 6)
        if tier >= 2:
            # clock / bell tower at the far end
            stone_tower(cv, x - 6 + gw + sw - 3, yb - 2, 5, wh + 10, 'cone', lit, ('R1', 'R0'), 'A1', seed=31)
            cv.disc(x - 6 + gw + sw - 0.5, yb - wh - 4, 1.4, 'W3')
        plaza(cv, x - 16, yb + 1, x + 14, yb + 5, n)
        stall(cv, x - 16, yb + 4, 'R1', ('W2', 'R1', 'G2'))
        stall(cv, x - 7, yb + 5, 'A1', ('W3', 'B2', 'R1'))
        stall(cv, x + 3, yb + 5, 'R1', ('A1', 'W2', 'C2'))
        if tier >= 3:
            lantern_string(cv, x - 16, yb - 2, x + 10, yb - 1, 3, 3)
        for (fx, fy, c) in [(x - 8, yb + 6, 'R1'), (x + 1, yb + 6, 'A0'), (x + 11, yb + 6, 'W1'), (x - 12, yb + 6, 'W2'), (x - 3, yb + 7, 'C2')]:
            figure(cv, fx, fy, c)


def plaza(cv, x0, y0, x1, y1, n):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if cv.get(x, y) in ('G0', 'G1', 'G2', 'E1', 'E2'):
                if n >= 5:
                    cv.set(x, y, 'C1' if (x + 2 * y) % 5 else 'C2')
                else:
                    cv.set(x, y, 'E1' if (x * 3 + y) % 7 else 'E2')


def defences(cv, n, lit, props):
    """Appends defensive structures to the prop list (they sit at many depths)."""
    kx = KEEP[0]
    ky = int(round(hill_top(kx))) + 1
    left = [(40, 93), (36, 84), (31, 70), (28, 56), (30, 47)]
    front_a = [(40, 93), (62, 94)]
    front_b = [(70, 94), (100, 95), (130, 95), (158, 94), (172, 92)]
    back = [(84, 47), (110, 51), (140, 54), (160, 53), (171, 52)]
    if n == 1:
        return
    if n == 2:
        props.append((90, lambda: palisade(cv, [(38, 92), (34, 82), (30, 68), (28, 56)], 7)))
        props.append((ky, lambda: watch_platform(cv, kx - 3, ky, 10)))
        props.append((ky - 1, lambda: flag(cv, kx + 8, ky - 20, 18, 'R1', 'R0', 6)))
    elif n in (3, 4):
        props.append((96, lambda: palisade(cv, left, 6)))
        props.append((97, lambda: palisade(cv, front_a + front_b, 5, gate=(63, 69))))
        props.append((50, lambda: palisade(cv, back, 4)))
        # gate posts + lintel
        def gate():
            cv.vline(62, 85, 94, 'B2'); cv.vline(70, 85, 94, 'B1')
            cv.hline(61, 71, 85, 'B2'); cv.hline(61, 71, 86, 'K')
            flag(cv, 62, 78, 7, 'R1', 'R0', 5)
        props.append((97.5, gate))
        if n == 3:
            props.append((ky, lambda: watch_platform(cv, kx - 3, ky, 10)))
        else:
            props.append((ky, lambda: tower_wood(cv, kx - 3, ky, 20, 7)))
            props.append((93.5, lambda: tower_wood(cv, 160, 93, 14, 6)))
    else:
        wh = 6 if n == 5 else 7
        props.append((96, lambda: wall_line(cv, left, wh)))
        props.append((97, lambda: wall_line(cv, front_a + front_b, wh, gaps=[(58, 72)])))
        props.append((50, lambda: wall_line(cv, back, 5)))
        props.append((95, lambda: gatehouse(cv, 58, 95, 15, wh + 7, lit)))
        props.append((97.2, lambda: stone_tower(cv, 36, 94, 5, wh + 6, 'cone', lit, flag_col='R1', seed=3)))
        props.append((97.3, lambda: stone_tower(cv, 128, 96, 5, wh + 6, 'cone' if n < 7 else 'spire', lit, flag_col='R1', seed=4)))
        props.append((95, lambda: stone_tower(cv, 167, 93, 5, wh + 6, 'cone', lit, flag_col='R1', seed=5)))
        props.append((70, lambda: stone_tower(cv, 28, 70, 5, wh + 5, 'cone', lit, flag_col='R1', seed=6)))
        if n == 5:
            props.append((ky, lambda: stone_tower(cv, kx - 4, ky, 8, 22, 'crenel', lit, flag_col='R1', seed=7)))
        elif n == 6:
            props.append((ky + 6, lambda: wall_line(cv, [(36, ky + 8), (46, ky + 6), (70, ky + 6), (80, ky + 8)], 6)))
            props.append((ky, lambda: keep(cv, kx, ky, 1, lit)))
        else:
            props.append((ky + 6, lambda: wall_line(cv, [(34, ky + 9), (46, ky + 6), (70, ky + 6), (82, ky + 9)], 7)))
            props.append((ky, lambda: keep(cv, kx, ky, 2, lit)))


def keep(cv, x, yb, tier, lit):
    """Keep on the hill (6) growing into the spired citadel (7)."""
    if tier == 1:
        stone_tower(cv, x - 13, yb + 2, 6, 18, 'crenel', lit, flag_col='R1', seed=8)
        stone_tower(cv, x + 8, yb + 2, 6, 16, 'crenel', lit, flag_col='R1', seed=9)
        stone_tower(cv, x - 6, yb, 13, 24, 'crenel', lit, flag_col='R1', seed=10)
        banner(cv, x - 3, yb - 19, 6, 'R1', 'R0'); banner(cv, x + 3, yb - 19, 6, 'R1', 'R0')
    else:
        stone_tower(cv, x - 16, yb + 3, 5, 18, 'spire', lit, ('R1', 'R0'), None, seed=11)
        stone_tower(cv, x + 12, yb + 3, 5, 17, 'spire', lit, ('R1', 'R0'), None, seed=12)
        stone_tower(cv, x - 8, yb + 1, 16, 22, 'crenel', lit, flag_col=None, seed=13)
        stone_tower(cv, x - 2, yb - 21, 4, 7, 'spire', lit, ('W2', 'W1'), 'A1', seed=14)
        banner(cv, x - 6, yb - 17, 7, 'R1', 'R0'); banner(cv, x + 5, yb - 17, 7, 'R1', 'R0')
        cv.disc(x, yb - 11, 1.6, 'W3')
        for i, fx in enumerate((x - 8, x + 7)):
            flag(cv, fx, yb - 29, 7, 'R1', 'R0', 5)


# ---------------------------------------------------------------- house slots that fill in

HOUSES = [  # x, yb, gw, sw, wh, from_stage
    (86, 66, 7, 8, 4, 3), (40, 84, 7, 8, 4, 3), (124, 77, 7, 8, 4, 4), (100, 70, 7, 9, 4, 4),
    (48, 70, 7, 7, 4, 4), (152, 74, 5, 6, 4, 4), (88, 57, 5, 7, 3, 4), (104, 58, 5, 6, 3, 4),
    (40, 61, 5, 6, 3, 5), (126, 92, 7, 6, 3, 5), (116, 66, 7, 7, 4, 4), (78, 92, 5, 7, 3, 6),
    (68, 51, 5, 6, 3, 6), (36, 52, 5, 6, 3, 6), (118, 57, 5, 7, 3, 6), (180, 68, 5, 6, 4, 6),
    (184, 80, 7, 6, 4, 6), (152, 62, 5, 5, 3, 7), (60, 62, 5, 6, 3, 7), (146, 92, 6, 7, 3, 7),
]


def draw(n):
    pal = stage_palette(n)
    cv = Cv(pal, 'S0', W, H)
    lit = LIT[n]
    sky(cv, n)
    mountains(cv, n)
    terrain(cv, n)
    river(cv, n)
    road(cv, n)
    foreground(cv, n)
    tufts(cv, n)
    # streets
    if n >= 3:
        lane(cv, [(104, 88), (128, 90), (150, 89), (164, 86)], n, 0)      # to the jetty / harbour
    if n >= 4:
        lane(cv, [(104, 88), (100, 76), (98, 66), (96, 58)], n, 0)
        lane(cv, [(90, 90), (70, 86), (52, 80)], n, 0)
        lane(cv, [(110, 88), (126, 80), (138, 66)], n, 0)
    if n >= 5:
        lane(cv, [(96, 58), (80, 50), (60, 44)], n, 0)
    if n >= 3:
        field(cv, 8, 26, 62, 70, 'wheat' if n < 6 else 'dusk', 0.5)
        fence(cv, 7, 27, 61); fence(cv, 3, 22, 71)
        cv.vline(6, 62, 70, 'B1')
    if n >= 4:
        field(cv, 6, 24, 74, 80, 'green', 0.5)
        field(cv, 2, 20, 82, 86, 'soil', 0.5)
        field(cv, 178, 198, 62, 70, 'wheat', 0.4)
        field(cv, 176, 198, 72, 78, 'green', 0.4)
        fence(cv, 177, 199, 61)
    props = []
    for (x, y, r, kind) in TREES:
        if cleared(n, x, y):
            continue
        shade = 1 if y < 60 else 0
        props.append((y, lambda x=x, y=y, r=r, kind=kind, shade=shade: tree(cv, x, y, r, shade, kind)))
    if n <= 2:
        clearing(cv, HEARTH[0] + 2, HEARTH[1] - 1, 26 if n == 1 else 34, 8 if n == 1 else 10)
    for (x, y, kind) in SCATTER:
        if cleared(n, x, y) and n > 1:
            continue
        if n == 1 and ((x - 110) / 24) ** 2 + ((y - 82) / 9) ** 2 < 1:
            continue
        if kind == 'bush':
            props.append((y, lambda x=x, y=y: bush(cv, x, y, 2 if (x + y) % 3 else 3)))
        elif kind == 'rock':
            props.append((y, lambda x=x, y=y: rock(cv, x, y, 3 + (x % 2))))
        elif n <= 4:
            props.append((y, lambda x=x, y=y: bush(cv, x, y, 1, 'W3' if x % 2 else 'R1')))
    hx, hy = HEARTH
    props.append((hy, lambda: hearth(cv, n, hx, hy, lit)))
    props.append((WORK[1], lambda: workshop(cv, n, WORK[0], WORK[1], lit)))
    props.append((RUNE[1], lambda: rune(cv, n, RUNE[0], RUNE[1], lit)))
    props.append((STORE[1], lambda: store(cv, n, STORE[0], STORE[1], lit)))
    defences(cv, n, lit, props)
    for i, (x, yb, gw, sw, wh, s0) in enumerate(HOUSES):
        if n < s0:
            continue
        roof = 'thatch' if n == 3 else ('tile' if (n >= 5 or i % 2) else 'thatch')
        wall = 'plaster' if (n >= 4 and i % 3) else ('wood' if n < 5 else 'stone')
        st = 2 if n >= 5 and wh >= 4 else 1
        props.append((yb, lambda x=x, yb=yb, gw=gw, sw=sw, wh=wh, roof=roof, wall=wall, st=st, i=i:
                      house(cv, x, yb, gw, sw, wh + (3 if st == 2 else 0), roof, wall, lit, chimney=(i % 3 == 0), seed=i, storeys=st,
                            smoke_on=(i % 2 == 0))))
    # stage specific extras
    if n == 1:
        props.append((80, lambda: tent(cv, 92, 80, 13, 9, ('W2', 'W1', 'B1'))))
        props.append((78, lambda: tent(cv, 116, 78, 13, 9, ('R1', 'R0', 'B1'))))
        props.append((84, lambda: tent(cv, 126, 84, 7, 5, ('C2', 'C1', 'C0'))))
    if n == 2:
        props.append((76, lambda: tent(cv, 96, 76, 9, 7, ('W2', 'W1', 'B1'))))
        props.append((74, lambda: tent(cv, 122, 74, 9, 7, ('R1', 'R0', 'B1'))))
        props.append((82, lambda: tent(cv, 130, 82, 7, 5, ('C2', 'C1', 'C0'))))
    if n >= 3:
        props.append((80 if n == 3 else 82, lambda: well(cv, 128 if n == 3 else 92, 80 if n == 3 else 82)))
        props.append((80, lambda: jetty(cv, 158, 168, 80)))
        props.append((82, lambda: boat(cv, 172, 83, sail=n >= 5)))
    if n >= 4:
        def mill():
            house(cv, 150, 69, 7, 8, 6, 'thatch' if n == 4 else 'tile', 'wood' if n == 4 else 'stone', lit, True, seed=40)
            waterwheel(cv, 164, 67, 4)
        props.append((69, mill))
    if n >= 5:
        props.append((47, lambda: windmill(cv, 20, 47, 14, 9, 0.5 + n * 0.3, n >= 6)))
        props.append((92, lambda: jetty(cv, 164, 172, 90)))
        props.append((93, lambda: boat(cv, 182, 96, sail=True, col='A1')))
        props.append((88, lambda: cart(cv, 120, 92, horse=True)))
    if n >= 6:
        props.append((64, lambda: bridge(cv, 158, 182, 64, False)))
        props.append((72, lambda: barracks(cv, 70, 66, lit)))
    if n >= 7:
        props.append((51.5, lambda: aqueduct(cv, 86, 206, 51, 7)))
        props.append((86, lambda: bridge(cv, 160, 186, 86, True)))
        props.append((101, lambda: beacon(cv, 172, 101)))
    # people on the road and in the streets (drawn in depth order, so walls hide them)
    walkers = {1: [], 2: [(52, 96, 'A0')], 3: [(48, 97, 'R1'), (80, 91, 'W1')],
               4: [(44, 98, 'R1'), (56, 96, 'A0'), (84, 91, 'W1')],
               5: [(44, 98, 'A0'), (54, 96, 'R1'), (88, 90, 'W2'), (96, 89, 'C2')],
               6: [(40, 98, 'R1'), (50, 97, 'A0'), (86, 91, 'R1'), (98, 89, 'A0'), (92, 90, 'W2')],
               7: [(40, 98, 'R1'), (50, 97, 'A1'), (84, 91, 'R1'), (98, 89, 'A0'), (92, 90, 'W2')]}[n]
    for (fx, fy, c) in walkers:
        props.append((fy + 0.1, lambda fx=fx, fy=fy, c=c: figure(cv, fx, fy, c)))
    props.sort(key=lambda p: p[0])
    for _, fn in props:
        fn()
    big_tree(cv, 212, 108, lights=3 if n == 7 else 0)
    if n == 7:
        festival(cv)
    return cv


def bridge(cv, x0, x1, y, stone):
    for x in range(x0, x1 + 1):
        t = (x - x0) / (x1 - x0)
        dy = int(round(-2.5 * math.sin(t * math.pi)))
        cv.set(x, y + dy, 'C2' if stone else 'B2')
        cv.set(x, y + dy + 1, 'C1' if stone else 'B1')
        if stone:
            cv.set(x, y + dy + 2, 'C0' if x % 2 else 'C1')
            if x % 2 == 0:
                cv.set(x, y + dy - 1, 'C2')
        elif x % 3 == 0:
            cv.set(x, y + dy - 1, 'B1')
    if stone:
        for (ax, aw) in [((x0 + x1) // 2, 4), (x0 + 4, 2), (x1 - 4, 2)]:
            for i in range(aw):
                cv.hline(ax - aw + i, ax + aw - i, y + 3 - i, 'K')
    else:
        for x in range(x0 + 4, x1 - 2, 6):
            cv.vline(x, y + 1, y + 3, 'K')


def aqueduct(cv, x0, x1, yb, h):
    """Arcade of stone arches carrying water along the back of the city."""
    for x in range(x0, x1 + 1):
        p = (x - x0) % 6
        for y in range(yb - h, yb + 1):
            k = 'C1'
            if p == 0:
                k = 'C2'
            elif p == 5:
                k = 'C0'
            cv.set(x, y, k)
        # arch openings
        if 1 <= p <= 4:
            top = yb - h + 3 + (0 if p in (2, 3) else 1)
            for y in range(top, yb + 1):
                cv.set(x, y, 'K' if p != 1 else 'C0')
        cv.set(x, yb - h, 'C2'); cv.set(x, yb - h + 1, 'A0' if x % 3 else 'A1')
        cv.set(x, yb - h + 2, 'C0')


def barracks(cv, x, yb, lit):
    house(cv, x, yb, 7, 14, 5, 'slate', 'stone', lit, False, seed=50)
    # training yard: fenced square with dummies
    fence(cv, x + 4, x + 22, yb + 7)
    for (dx, c) in [(8, 'R1'), (12, 'A0'), (16, 'R1')]:
        figure(cv, x + dx, yb + 5, c)
    cv.vline(x + 20, yb + 2, yb + 5, 'B1'); cv.hline(x + 19, x + 21, yb + 3, 'B2'); cv.set(x + 20, yb + 1, 'W2')


def beacon(cv, x, yb):
    """Lighthouse-like beacon tower on the near bank with a great brazier."""
    h = 28
    for y in range(yb - h, yb + 1):
        t = (y - (yb - h)) / h
        hw = 2 + 1.5 * t
        x0, x1 = int(round(x - hw)), int(round(x + hw))
        for xx in range(x0, x1 + 1):
            u = (xx - x0) / max(1, x1 - x0)
            k = 'C2' if u < 0.35 else ('C1' if u < 0.75 else 'C0')
            if ((y - yb) // 6) % 2 == 0 and k != 'C0':
                k = 'R1' if u < 0.35 else 'R0'
            cv.set(xx, y, k)
        cv.set(x1 + 1, y, 'K')
    top = yb - h
    cv.hline(x - 4, x + 4, top, 'C1'); cv.hline(x - 4, x + 4, top + 1, 'K')
    cv.rect(x - 2, top - 4, x + 3, top, 'W3'); cv.vline(x + 2, top - 4, top - 1, 'O')
    cv.set(x - 2, top - 4, 'SUN')
    for i in range(3):
        cv.hline(x - 3 + i, x + 3 - i, top - 5 - i, 'R1' if i < 2 else 'R0')
    for yy in range(top - 12, top + 6):
        for xx in range(x - 9, x + 10):
            d = math.hypot(xx - x, (yy - top + 2) * 1.2)
            if 4 < d < 9 and bay(xx, yy) < q4((9 - d) / 9.0) and (cv.get(xx, yy) or '').startswith('S'):
                cv.set(xx, yy, 'S4')
    cv.disc(x, top - 2, 1.0, 'SUN')


def festival(cv):
    for (fx, fy, r, cols) in [(108, 14, 6, ('W3', 'O')), (140, 22, 5, ('A1', 'A0')), (90, 26, 4, ('R1', 'O')),
                              (196, 8, 5, ('W3', 'R1'))]:
        firework(cv, fx, fy, r, cols)
    rr = random.Random(12)
    # floating lanterns drifting up from the town
    for _ in range(26):
        x = rr.uniform(60, 200); y = rr.uniform(10, 46)
        if cv.get(x, y) and cv.get(x, y).startswith('S'):
            cv.set(x, y, 'W3'); cv.set(x, y + 1, 'O')
    # lantern strings across the main street
    lantern_string(cv, 64, 82, 92, 80, 2.5, 3)
    lantern_string(cv, 120, 76, 146, 74, 2.5, 3)
    # kites over the hill
    for (kx, ky, c) in [(30, 18, 'R1'), (80, 10, 'A1')]:
        cv.set(kx, ky, c); cv.set(kx - 1, ky + 1, c); cv.set(kx + 1, ky + 1, c); cv.set(kx, ky + 1, c); cv.set(kx, ky + 2, c)
        cv.line(kx, ky + 3, kx + 6, ky + 14, 'S2')
