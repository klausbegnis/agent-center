import random, math
from engine import *

PAL = {
    # sky, top to horizon (cool violet -> rose -> peach -> gold)
    'S0': '#2f3468', 'S1': '#4f4f8c', 'S2': '#8e5f93', 'S3': '#d97f78', 'S4': '#f4ac6a', 'S5': '#ffd98a', 'SUN': '#fff6cf',
    # far haze hills
    'F0': '#7a5c8e', 'F1': '#a46f8f',
    # greens (cool shadow -> warm lit)
    'G0': '#2e4a4c', 'G1': '#4f6b3c', 'G2': '#8a913f',
    # wheat
    'W0': '#7c4a2c', 'W1': '#bf7a32', 'W2': '#e6a94a', 'W3': '#ffd37a',
    # wood / stone / outline
    'K': '#2a1e34', 'B1': '#5e3a3e', 'B2': '#9c6250', 'ST': '#e9c39a',
    'R': '#a8403e',
}


def windmill(cv, x, yb, h, L, ang, rng, big=False):
    """Stone tower windmill: lit from the left (sun low on the left)."""
    wb = max(3, h // 4 + 1)    # base half width
    wt = max(2, wb - 2)
    top = yb - h
    for y in range(top, yb + 1):
        t = (y - top) / max(1, h)
        hw = wt + (wb - wt) * t
        x0 = int(round(x - hw)); x1 = int(round(x + hw))
        for xx in range(x0, x1 + 1):
            u = (xx - x0) / max(1, x1 - x0)
            if xx == x1:
                k = 'K'
            elif u < 0.18:
                k = 'SUN' if xx == x0 and y > top + 1 else 'ST'
            elif u < 0.55:
                k = 'ST'
            elif u < 0.78:
                k = 'B2'
            else:
                k = 'B1'
            cv.set(xx, y, k)
        # stone courses
        if (y - top) % 4 == 3:
            for xx in range(x0 + 1, x1):
                if (xx + y) % 3 == 0:
                    cv.set(xx, y, 'B2' if cv.get(xx, y) == 'ST' else 'B1')
    # door and gallery
    cv.rect(x - 1, yb - 3, x + 1, yb + 1, 'K')
    cv.set(x - 1, yb - 4, 'B1')
    gy = yb - int(h * 0.55)
    gw = wt + (wb - wt) * 0.45 + 2
    cv.hline(x - gw, x + gw, gy, 'B1')
    cv.hline(x - gw, x - gw + 2, gy, 'B2')
    for xx in range(int(x - gw), int(x + gw) + 1, 2):
        cv.set(xx, gy + 1, 'K')
    # warm lit window
    wy = top + max(3, h // 4)
    cv.set(x, wy, 'S5'); cv.set(x, wy + 1, 'W1')
    if big:
        cv.set(x - 3, gy + 4, 'S5')
    # cap (pointed thatch cap)
    cw = wt + 2
    for i in range(0, cw + 2):
        y = top - i
        hw = cw - i * 0.85
        if hw < 0:
            break
        for xx in range(int(round(x - hw)), int(round(x + hw)) + 1):
            u = (xx - (x - hw)) / max(1, 2 * hw)
            cv.set(xx, y, 'W3' if u < 0.3 else ('W1' if u < 0.7 else 'W0'))
        cv.set(int(round(x + hw)), y, 'K')
    cv.hline(x - cw, x + cw, top, 'W0')
    cv.hline(x - cw, x - cw + 1, top, 'W2')
    # sails, inverse mapped: each blade = spar + lattice cloth to one side
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
                elif u > 2.5 and 0.6 <= v < (4.6 if big else 3.6):
                    edge = v > (3.7 if big else 2.7)
                    lattice = (int(u) % 3 == 0)
                    if edge or lattice or u > L - 0.5:
                        cv.set(xx, yy, 'B1')
                    else:
                        lit = (rx < 0)  # left side of the mill faces the sun
                        cv.set(xx, yy, 'SUN' if lit else 'ST')
    cv.set(int(hx), int(hy), 'W1')
    cv.set(int(hx), int(hy) - 1, 'K')


def house(cv, x, yb, w, hh, roof, rng, chimney=False, wall='ST', smoke=True):
    """Thatched cottage, gable facing the viewer, lit from left."""
    # walls
    for y in range(yb - hh, yb + 1):
        for xx in range(x, x + w):
            k = wall
            if xx == x + w - 1:
                k = 'B1'
            elif xx >= x + w - 2 and wall == 'ST':
                k = 'B2'
            cv.set(xx, y, k)
    cv.hline(x, x + w - 1, yb, 'B1')
    # door, window
    cv.vline(x + 1 + (w > 6), yb - 2, yb, 'K')
    if w >= 5:
        cv.set(x + w - 3, yb - hh + 1 + (hh > 3), 'S5')
    # roof: thatch, overhanging
    ry = yb - hh - 1
    for i in range(roof):
        y = ry - i
        x0 = x - 1 + i * 0.6
        x1 = x + w + i * 0.15
        if x0 > x1:
            break
        for xx in range(int(round(x0)), int(round(x1)) + 1):
            u = (xx - x0) / max(1, x1 - x0)
            k = 'W2' if u < 0.45 else 'W1'
            if i == 0:
                k = 'W0'
            if xx == int(round(x0)) and i > 0:
                k = 'W3'
            cv.set(xx, y, k)
    if chimney:
        cx = x + w - 2
        top = ry - roof + 1
        cv.vline(cx, top - 1, ry - 1, 'B1')
        cv.set(cx - 1, top - 1, 'B2')
        if smoke:
            sx, sy = cx, top - 2
            for j in range(9):
                sx += 0.7 + j * 0.08
                sy -= 0.9
                k = 'F1' if j < 4 else 'S3'
                cv.set(sx, sy, k)
                if j % 2 == 0:
                    cv.set(sx + 1, sy, k)
                if 2 < j < 7:
                    cv.set(sx, sy - 1, k)


def tree(cv, x, yb, r, dark=False):
    """Round deciduous tree, lit top-left."""
    cv.vline(x, yb - r, yb, 'B1')
    for y in range(int(yb - 2 * r - 1), int(yb - r + 2)):
        for xx in range(x - r - 1, x + r + 2):
            dx = xx + 0.5 - x - 0.5; dy = y + 0.5 - (yb - r - r * 0.6)
            d = math.hypot(dx * 0.9, dy * 1.1)
            if d <= r + 0.3:
                lit = (dx + dy) < -r * 0.4
                k = 'G0'
                if not dark:
                    k = 'G2' if lit else ('G1' if dx + dy < r * 0.5 else 'G0')
                elif lit:
                    k = 'G1'
                cv.set(xx, y, k)


def bale(cv, x, y):
    cv.rect(x, y, x + 3, y + 2, 'W2')
    cv.set(x, y, 'W3'); cv.set(x + 1, y, 'W3')
    cv.set(x + 2, y + 1, 'W1'); cv.set(x + 2, y, 'W1')
    cv.hline(x, x + 3, y + 2, 'W0')
    cv.set(x + 3, y + 1, 'W0')


def draw():
    rng = random.Random(11)
    cv = Cv(PAL, 'S0')
    SX, SY = 38, 35   # sun

    # ---------------------------------------------------------- sky
    bands = [(0, 'S0'), (9, 'S1'), (19, 'S2'), (28, 'S3'), (35, 'S4'), (41, 'S5')]
    for y in range(0, 46):
        for x in range(W):
            # distance to sun widens the warm bands near it
            d = math.hypot((x - SX) * 0.45, (y - SY) * 1.3)
            yy = y + max(0, 14 - d) * 0.9
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
    # sun disc + ring
    cv.disc(SX, SY, 5.2, 'S5')
    cv.disc(SX, SY, 4.2, 'SUN')

    # ---------------------------------------------------------- clouds (lit from below-left by a low sun)
    def cloud(cx, cy, length, thick, seed):
        """Flat-bottomed puffy cloud: violet body, rose top, undersides lit gold by the low sun."""
        r = random.Random(seed)
        mask = set()
        n = max(3, length // 4)
        for p in range(n):
            t = (p + 0.5) / n
            px_ = cx + t * length + r.uniform(-1.5, 1.5)
            rad = (thick + 1.2) * (0.45 + 0.9 * math.sin(t * math.pi) ** 1.5) * r.uniform(0.65, 1.3)
            for y in range(int(cy - rad * 1.2) - 1, cy + 2):
                for x in range(int(px_ - rad * 1.5) - 1, int(px_ + rad * 1.5) + 2):
                    dx = (x + 0.5 - px_) / (rad * 1.45); dy = (y + 0.5 - cy) / (rad * 1.0)
                    if dx * dx + dy * dy <= 1 and y <= cy:
                        mask.add((x, y))
        for (x, y) in mask:
            below = (x, y + 1) not in mask
            below2 = (x, y + 2) not in mask
            above = (x, y - 1) not in mask
            left = (x - 1, y) not in mask
            k = 'F0'
            if above:
                k = 'S2'
            if left and x < SX + 50:
                k = 'S3'
            if below2:
                k = 'S3'
            if below:
                k = 'S4' if x < SX + 70 else 'S3'
            cv.set(x, y, k)
    cloud(2, 15, 36, 2.5, 3)
    cloud(50, 23, 22, 1.5, 5)
    cloud(64, 9, 34, 2.5, 7)
    cloud(156, 20, 36, 2, 9)
    cloud(-6, 28, 20, 1, 13)
    cloud(100, 30, 20, 1, 17)

    # birds
    for (bx, by) in [(78, 15), (84, 13), (89, 16), (95, 12)]:
        cv.set(bx - 1, by - 1, 'S0'); cv.set(bx, by, 'S0'); cv.set(bx + 1, by - 1, 'S0')

    # ---------------------------------------------------------- far hills (haze)
    far = smooth(mpd(random.Random(21), W, 4.0, 0.5), 2)
    for x in range(W):
        top = int(round(40 + far[x]))
        for y in range(top, 48):
            k = 'F1' if y < top + 2 else 'F0'
            if y == top and abs(x - SX) < 20:
                k = 'S4'  # rim light where the hill meets the sun
            cv.set(x, y, k)
    # tiny distant windmill and trees on far ridge
    for x in range(0, W, 7):
        top = int(round(40 + far[x]))
        if rng.random() < 0.5 and abs(x - SX) > 8:
            cv.set(x, top - 1, 'F0'); cv.set(x + 1, top - 1, 'F0'); cv.set(x, top - 2, 'F0')

    fx_ = 70
    ft = int(round(40 + far[fx_]))
    cv.vline(fx_, ft - 5, ft, 'F0'); cv.vline(fx_ + 1, ft - 4, ft, 'F0')
    cv.line(fx_ - 3, ft - 8, fx_ + 4, ft - 2, 'F0'); cv.line(fx_ - 3, ft - 2, fx_ + 4, ft - 8, 'F0')
    # ---------------------------------------------------------- mid patchwork fields
    mid = smooth(mpd(random.Random(4), W, 3.0, 0.5), 3)
    hedge_x = {}
    for x in range(W):
        top = int(round(45 + mid[x] - (x / W) * 1.5))
        for y in range(top, H):
            d = y - top
            band = 0
            for bnd in (2, 4, 7, 10, 14, 19, 25):
                if d >= bnd:
                    band += 1
            split = int(math.floor((x - 40 + band * 9 + (band * band) * 3) / (16 + band * 9)))
            pick = (band * 3 + split) % 5
            k = ['G2', 'W2', 'G1', 'W1', 'W2'][pick]
            if d in (2, 4, 7, 10, 14, 19, 25):
                k = 'G1' if k in ('W2', 'W1') else 'G0'
            if y == top:
                k = 'G1'
                if abs(x - SX) < 16:
                    k = 'G2'
            cv.set(x, y, k)
    # hedgerow trees along field edges
    for x in range(2, 110, 5):
        if rng.random() < 0.55:
            top = int(round(45 + mid[x] - (x / W) * 1.5))
            yy = top + rng.choice([0, 3, 6])
            cv.set(x, yy - 1, 'G0'); cv.set(x + 1, yy - 1, 'G0'); cv.set(x, yy - 2, 'G1')

    # ---------------------------------------------------------- windmill hill (right)
    hill = []
    for x in range(W):
        t = (x - 96) / 60.0
        base = 52 - 21 * math.exp(-((x - 152) / 30.0) ** 2) - 4 * max(0, min(1, (x - 150) / 40.0))
        hill.append(base)
    hn = smooth(mpd(random.Random(8), W, 1.2, 0.5), 1)
    for x in range(88, W):
        top = int(round(hill[x] + hn[x]))
        slope = hill[min(W - 1, x + 1)] - hill[max(0, x - 1)]
        for y in range(top, H):
            d = y - top
            if slope > 0.3:     # faces right, away from sun
                k = 'G0' if d < 3 or bay(x, y) < 0.5 else 'G1'
            elif slope < -0.3:  # faces the sun
                k = 'G2' if d < 4 else ('G1' if bay(x, y) < q4((d - 4) / 8) else 'G2')
            else:
                k = 'G1'
            if d == 0:
                k = 'W3' if slope < -0.2 else ('G2' if slope < 0.3 else 'G1')
            cv.set(x, y, k)
    # grass tufts on hill
    for x in range(92, W, 3):
        top = int(round(hill[x] + hn[x]))
        if rng.random() < 0.4:
            cv.set(x, top + rng.randint(3, 10), 'G0')
    # wheat terraces on the hill's lower slope
    for x in range(116, W):
        top = int(round(hill[x] + hn[x]))
        y0 = top + 8 + (2 if x < 140 else 0)
        for y in range(y0, H):
            d = y - y0
            k = 'W2'
            if d % 4 == 3:
                k = 'W1'
            if d == 0:
                k = 'G0' if x % 2 else 'G1'   # hedge along the terrace edge
            if x > 170 and k == 'W2':
                k = 'W1' if bay(x, y) < q4((x - 170) / 30) else 'W2'
            cv.set(x, y, k)

    # ---------------------------------------------------------- foreground wheat (lower band), calm on the left
    for x in range(W):
        top = 62 + int(round(1.5 * math.sin(x / 13.0) + 0.8 * math.sin(x / 5.3)))
        for y in range(top, H):
            d = y - top
            k = 'W2' if d < 2 else 'W1'
            if d >= 4:
                k = 'W1' if bay(x, y) < 0.75 else 'W0'
            if d >= 7:
                k = 'W0' if bay(x, y) < 0.5 else 'W1'
            if d == 0:
                k = 'W3'
            cv.set(x, y, k)
        # stalks: short vertical ticks, denser on the right where no text sits
        if x > 100 and (x * 5) % 3 == 0:
            cv.vline(x, top + 2, top + 3 + (x % 2), 'W0')
            cv.set(x, top + 1, 'W3')
        elif x <= 100 and x % 6 == 0:
            cv.set(x, top + 2, 'W1')
        # ear tips
        if x % 2 == 0:
            cv.set(x, top - 1, 'W2')
            if x % 4 == 0 and x > 150:
                cv.set(x, top - 2, 'W3')
    # ---------------------------------------------------------- river (reflects the sky)
    # centre line and half width per row; the river bends out of the haze near the sun
    # and widens toward the viewer, staying right of the text corner
    RIV = {}
    path = [(46, 45, 4), (70, 47, 3), (86, 50, 3), (92, 53, 4), (90, 57, 5), (95, 61, 7), (103, 66, 9), (112, 72, 12)]
    for i in range(len(path) - 1):
        (xa, ya, wa), (xb, yb, wb_) = path[i], path[i + 1]
        for y in range(ya, yb + 1):
            t = (y - ya) / max(1, yb - ya)
            RIV[y] = (xa + (xb - xa) * t, wa + (wb_ - wa) * t)
    for y in range(45, H):
        cx, hw = RIV[y]
        if y <= 47:
            x0, x1 = int(cx - 12 + (y - 45) * 6), int(cx + 6 + (y - 45) * 3)
        else:
            x0, x1 = int(round(cx - hw)), int(round(cx + hw))
        for x in range(x0, x1 + 1):
            k = 'S4' if y < 52 else 'S3'
            if 52 <= y < 55:
                k = 'S3' if bay(x, y) < q4((y - 51) / 4) else 'S4'
            if y > 62:
                k = 'S2' if bay(x, y) < q4((y - 62) / 8) else 'S3'
            if x == x1 and y > 48:
                k = 'S2'
            cv.set(x, y, k)
        cv.set(x0 - 1, y, 'G0'); cv.set(x1 + 1, y, 'G0')
        if y > 55:
            cv.set(x1 + 2, y, 'W0')
        # highlight dashes, denser near the sun side
        if y % 2 == 1:
            r2 = random.Random(y * 31)
            for _ in range(1 + (x1 - x0) // 7):
                dx0 = r2.randint(x0 + 1, max(x0 + 1, x1 - 3))
                ln = r2.randint(1, 3)
                cv.hline(dx0, min(x1 - 1, dx0 + ln), y, 'SUN' if y < 54 else 'S5')

    for x in range(120, W - 4, 6):
        top = int(round(hill[x] + hn[x]))
        for row in range(3):
            y = top + 11 + (2 if x < 140 else 0) + row * 5 + (x // 6 % 2) * 2
            if y < H - 12:
                cv.set(x, y - 1, 'W3'); cv.set(x, y, 'W1'); cv.set(x + 1, y, 'W0')
    # ---------------------------------------------------------- windmills
    hx = lambda x: int(round(hill[x] + hn[x]))
    windmill(cv, 126, hx(126) + 1, 12, 8, 0.35, rng)
    windmill(cv, 178, hx(178) + 1, 12, 9, 1.05, rng)
    windmill(cv, 152, hx(152) + 1, 19, 13, 0.62, rng, big=True)

    # ---------------------------------------------------------- village by the river
    tree(cv, 100, 50, 3, dark=True)
    house(cv, 103, 52, 7, 3, 4, rng, chimney=True)
    house(cv, 112, 51, 6, 3, 4, rng, chimney=True)
    house(cv, 82, 53, 6, 3, 3, rng, chimney=False)
    # red barn with gambrel roof
    bx, byb = 119, 54
    cv.rect(bx, byb - 4, bx + 9, byb + 1, 'R')
    cv.vline(bx + 8, byb - 4, byb, 'B1')
    cv.rect(bx + 3, byb - 2, bx + 6, byb + 1, 'K')
    cv.set(bx + 4, byb - 3, 'ST')
    for i in range(4):
        cv.hline(bx - 1 + i, bx + 9 - i, byb - 5 - i, 'B1' if i else 'K')
        cv.set(bx - 1 + i, byb - 5 - i, 'B2')
    tree(cv, 132, 53, 3)
    # bridge over the river
    by = 56
    for x in range(85, 100):
        y = by - (1 if 88 <= x <= 96 else 0)
        cv.set(x, y, 'B2'); cv.set(x, y + 1, 'B1')
        if x % 3 == 0:
            cv.set(x, y - 1, 'B1')
    cv.vline(89, 57, 58, 'K'); cv.vline(95, 57, 58, 'K')
    cv.set(92, 54, 'K'); cv.set(92, 53, 'R')  # figure fishing on the bridge
    cv.line(93, 53, 97, 51, 'B1')

    # ---------------------------------------------------------- market road with carts (bottom right)
    # road: a smooth curve, packed earth with a lit left verge and a shadowed right verge
    for y in range(55, H):
        t = (y - 55) / (H - 55)
        cx = 126 + 30 * t * t + 4 * t
        hw = 1.5 + 6.5 * t
        x0, x1 = int(round(cx - hw)), int(round(cx + hw))
        for xx in range(x0, x1 + 1):
            k = 'ST'
            if xx == x0:
                k = 'SUN'
            elif xx >= x1 - (1 if hw > 4 else 0):
                k = 'B2'
            elif y > 60 and (xx - x0) in (int(hw * 0.6), int(hw * 1.4)):
                k = 'W2'   # wheel ruts
            cv.set(xx, y, k)
        cv.set(x1 + 1, y, 'G0' if y < 62 else 'W0')

    def cart(x, y, load='W2', flip=False):
        """Hay cart (wheel, bed, load) with a horse in front, ~12 px long."""
        d = -1 if flip else 1
        for yy, (a, b) in zip(range(y - 6, y - 1), [(-1, 1), (-2, 2), (-3, 3), (-3, 3)]):
            for xx in range(x + a, x + b + 1):
                k = 'W3' if xx - x < (yy - y + 6) - 2 else ('W2' if xx < x + b - 1 else 'W1')
                cv.set(xx, yy, k)
            cv.set(x + a - 1, yy, 'W0'); cv.set(x + b + 1, yy, 'W0')
        cv.hline(x - 1, x + 1, y - 7, 'W0')
        cv.hline(x - 4, x + 4, y - 2, 'B2')                 # bed
        cv.hline(x - 4, x + 4, y - 1, 'K')
        cv.rect(x - 2, y - 1, x + 1, y + 1, 'K')             # wheel
        cv.set(x - 1, y - 1, 'B2')
        hx = x + d * 6                                       # horse
        cv.hline(x + d * 4, x + d * 5, y - 2, 'B1')         # shaft
        cv.rect(min(hx, hx + d * 3), y - 3, max(hx, hx + d * 3) + 1, y - 1, 'B1')
        cv.set(hx, y - 3, 'B2'); cv.set(hx + d, y - 3, 'B2')
        cv.set(hx + d * 4, y - 4, 'B1'); cv.set(hx + d * 4, y - 5, 'B1'); cv.set(hx + d * 5, y - 4, 'B1')
        cv.set(hx + d * 3, y - 4, 'K')                       # mane
        for lx in (hx, hx + d * 3):
            cv.vline(lx, y - 1, y, 'K')
        cv.set(x + 3 * d, y - 4, 'ST'); cv.set(x + 3 * d, y - 3, 'R')  # driver on the shaft
    cart(143, 66, 'W2')
    cart(129, 59, 'W2', flip=True)
    # walking figures carrying goods
    for (fx, fy, c) in [(153, 70, 'R'), (124, 56, 'S1'), (137, 61, 'R')]:
        cv.set(fx, fy - 3, 'ST'); cv.set(fx, fy - 2, c); cv.set(fx, fy - 1, c); cv.set(fx, fy, 'K')
    # fishing boat on the river
    bx_, by_ = 99, 63
    cv.hline(bx_ - 3, bx_ + 3, by_, 'B1'); cv.hline(bx_ - 2, bx_ + 2, by_ + 1, 'K')
    cv.set(bx_ - 3, by_ - 1, 'B2'); cv.set(bx_ + 3, by_ - 1, 'B1')
    cv.set(bx_, by_ - 1, 'R'); cv.set(bx_, by_ - 2, 'ST')
    cv.line(bx_ + 1, by_ - 2, bx_ + 5, by_ - 5, 'B1')
    cv.hline(bx_ - 4, bx_ + 4, by_ + 2, 'S2')

    # hay bales in the mid field
    for (x, y) in [(44, 48), (50, 49), (58, 47), (66, 48), (160, 59)]:
        bale(cv, x, y)
    # framing tree, right edge
    tree(cv, 187, 64, 7)
    return cv
