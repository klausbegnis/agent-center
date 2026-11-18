"""Goldmill in five ranks: the same golden-hour hill of windmills, river and market road,
growing from a couple of farms into a golden capital. Same palette and drawing code as the
original Goldmill banner (its helpers are copied here unchanged), canvas 192x72."""
import os, random, math
from rank_engine import *

W, H = 192, 72

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




# ====================================================================== tier additions

def granary(cv, x, yb, h=9):
    """Round granary: stone drum, conical thatch cap."""
    for y in range(yb - h, yb + 1):
        for xx in range(x - 3, x + 4):
            u = (xx - x + 3) / 6
            cv.set(xx, y, 'ST' if u < 0.35 else ('B2' if u < 0.75 else 'B1'))
        if (y - yb) % 3 == 0:
            cv.hline(x - 2, x + 2, y, 'B2' if y % 2 else 'ST')
    cv.set(x - 3, yb - h, 'SUN')
    for i in range(6):
        hw = 4.5 - i * 0.8
        for xx in range(int(round(x - hw)), int(round(x + hw)) + 1):
            u = (xx - (x - hw)) / max(1, 2 * hw)
            cv.set(xx, yb - h - 1 - i, 'W3' if u < 0.35 else ('W1' if u < 0.75 else 'W0'))
    cv.vline(x, yb - 2, yb, 'K')
    cv.set(x + 1, yb - h + 3, 'S5')


def stall(cv, x, yb, col='R'):
    for xx in range(x, x + 5):
        cv.set(xx, yb - 3, col if (xx - x) % 2 == 0 else 'ST')
        cv.set(xx, yb - 2, 'B1' if (xx - x) % 2 == 0 else 'B2')
    cv.vline(x, yb - 1, yb, 'B1'); cv.vline(x + 4, yb - 1, yb, 'K')
    cv.set(x + 1, yb - 1, 'W3'); cv.set(x + 2, yb - 1, 'R'); cv.set(x + 3, yb - 1, 'G2')
    cv.hline(x + 1, x + 3, yb, 'B2')


def figure(cv, x, yb, c='R'):
    cv.set(x, yb - 3, 'ST'); cv.set(x, yb - 2, c); cv.set(x, yb - 1, c); cv.set(x, yb, 'K')


def flag(cv, x, ytop, h, col='R', length=4):
    cv.vline(x, ytop, ytop + h, 'K')
    for i in range(length):
        dy = 1 if (i % 4) in (1, 2) else 0
        cv.set(x + 1 + i, ytop + dy, col)
        if i < length - 2:
            cv.set(x + 1 + i, ytop + 1 + dy, 'B1' if col == 'R' else 'S0')


def town_wall(cv, x0, x1, ybf, h=4, gaps=()):
    """Low crenellated wall, ground line given by ybf(x)."""
    for x in range(x0, x1 + 1):
        if any(a <= x <= b for (a, b) in gaps):
            continue
        yb = int(round(ybf(x)))
        for y in range(yb - h + 1, yb + 1):
            k = 'ST' if y == yb - h + 1 else ('B2' if (x + y // 2) % 5 else 'B1')
            cv.set(x, y, k)
        if x % 2 == 0:
            cv.set(x, yb - h, 'ST')
        cv.set(x, yb, 'B1')


def wtower(cv, x, yb, h=9, w=4, roof='R', flagc='R', lit=False):
    for y in range(yb - h, yb + 1):
        for xx in range(x, x + w):
            u = (xx - x) / max(1, w - 1)
            cv.set(xx, y, 'ST' if u < 0.4 else ('B2' if u < 0.8 else 'B1'))
        cv.set(x + w, y, 'K')
    cv.set(x + w // 2, yb - h + 3, 'S5' if lit else 'K')
    rh = w + 2
    for i in range(rh):
        hw = (w / 2 + 1) * (1 - i / rh)
        cx = x + (w - 1) / 2
        for xx in range(int(round(cx - hw)), int(round(cx + hw)) + 1):
            cv.set(xx, yb - h - 1 - i, roof if xx < cx else ('B1' if roof == 'R' else 'W1'))
    if flagc:
        flag(cv, int(x + (w - 1) / 2), yb - h - rh - 5, 4, flagc)


def bell_tower(cv, x, yb, h=22):
    for y in range(yb - h, yb + 1):
        for xx in range(x, x + 5):
            u = (xx - x) / 4
            k = 'ST' if u < 0.4 else ('B2' if u < 0.8 else 'B1')
            if (y - yb) % 4 == 0 and xx > x:
                k = 'B2' if k == 'ST' else 'B1'
            cv.set(xx, y, k)
        cv.set(x + 5, y, 'K')
    # belfry opening with the bell
    cv.rect(x + 1, yb - h + 2, x + 4, yb - h + 5, 'K')
    cv.set(x + 2, yb - h + 3, 'W3'); cv.set(x + 2, yb - h + 4, 'W2'); cv.set(x + 3, yb - h + 4, 'W1')
    cv.set(x + 2, yb - h + 9, 'S5')
    for i in range(9):
        hw = 3.5 * (1 - i / 9)
        for xx in range(int(round(x + 2 - hw)), int(round(x + 2 + hw)) + 1):
            cv.set(xx, yb - h - 1 - i, 'R' if xx <= x + 2 else 'B1')
    flag(cv, x + 2, yb - h - 15, 5, 'R', 5)


def barge(cv, x, y, load='W2'):
    """Flat river barge heaped with grain sacks, a cabin at the stern, dark hull for contrast."""
    cv.hline(x - 6, x + 6, y, 'B2'); cv.set(x - 6, y, 'ST')
    cv.hline(x - 5, x + 5, y + 1, 'K')
    cv.set(x - 7, y - 1, 'B2'); cv.set(x + 7, y - 1, 'B1')
    for i, xx in enumerate(range(x - 5, x + 2)):
        cv.set(xx, y - 1, 'W3' if i % 2 == 0 else load)
        if i % 2 == 0 and 0 < i < 6:
            cv.set(xx, y - 2, 'W3' if i < 3 else 'W2')
    cv.rect(x + 3, y - 3, x + 6, y, 'B1'); cv.set(x + 3, y - 3, 'B2'); cv.set(x + 3, y - 2, 'S5')
    cv.hline(x + 2, x + 6, y - 4, 'R')
    figure(cv, x + 2, y - 1, 'S1')
    cv.hline(x - 6, x + 6, y + 2, 'S1')


def lantern_string(cv, x0, y0, x1, y1, sag=2.0, every=3):
    n = max(1, int(abs(x1 - x0)))
    cols = ('SUN', 'R', 'W3', 'S1')
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)
        cv.set(x, y, 'K')
        if i % every == 1:
            cv.set(x, y + 1, cols[(i // every) % len(cols)])


def mill_hall(cv, x, yb, ang, gold=False):
    """Great mill-hall: a long hall at the foot of a giant windmill."""
    # hall body
    for y in range(yb - 7, yb + 1):
        for xx in range(x - 17, x - 3):
            k = 'ST' if xx < x - 12 else 'B2'
            if xx == x - 4:
                k = 'B1'
            cv.set(xx, y, k)
    for wx in range(x - 15, x - 4, 3):
        cv.set(wx, yb - 4, 'S5'); cv.set(wx, yb - 3, 'W1')
    cv.rect(x - 11, yb - 2, x - 9, yb + 1, 'K')
    for i in range(6):
        cv.hline(x - 18 + i, x - 3 - i // 2, yb - 8 - i, ('W3' if gold else 'R') if i % 2 == 0 else ('W2' if gold else 'B1'))
        cv.set(x - 18 + i, yb - 8 - i, 'SUN' if gold else 'W3')
    for bx in (x - 15, x - 8):
        cv.vline(bx, yb - 6, yb - 3, 'R'); cv.set(bx, yb - 7, 'W3')


def windmill_cathedral(cv, x, yb, ang):
    """The capital's heart: a long gold-roofed nave, a gold-spired west tower on the lit end,
    and the giant mill as its crossing tower."""
    nx0, nx1 = x - 30, x - 4
    # nave walls: lit stone, buttress shadows, tall glowing windows
    for y in range(yb - 11, yb + 1):
        for xx in range(nx0, nx1):
            k = 'B2'
            if (xx - nx0) % 5 == 0:
                k = 'ST'
            elif (xx - nx0) % 5 == 4:
                k = 'B1'
            cv.set(xx, y, k)
    for wx in range(nx0 + 2, nx1 - 1, 5):
        cv.vline(wx, yb - 9, yb - 4, 'S5'); cv.set(wx, yb - 9, 'SUN'); cv.vline(wx + 1, yb - 9, yb - 4, 'W1')
    cv.hline(nx0, nx1 - 1, yb, 'B1')
    # gold roof: ridge highlight, ribbed courses, dark eave
    for i in range(6):
        y = yb - 12 - i
        x0 = nx0 + i // 2
        for xx in range(x0, nx1 + 1):
            k = 'W2' if (xx + i) % 3 else 'W1'
            if i == 5:
                k = 'W3'
            if i == 0:
                k = 'W0'
            cv.set(xx, y, k)
        cv.set(x0, y, 'SUN')
    # west tower with gold spire on the lit end
    tx = nx0 - 3
    for y in range(yb - 20, yb + 1):
        for xx in range(tx, tx + 6):
            u = (xx - tx) / 5
            cv.set(xx, y, 'ST' if u < 0.4 else ('B2' if u < 0.8 else 'B1'))
        cv.set(tx + 6, y, 'K')
    cv.disc(tx + 3, yb - 13, 1.6, 'S5'); cv.set(tx + 2, yb - 14, 'SUN')
    cv.rect(tx + 2, yb - 3, tx + 4, yb + 1, 'K'); cv.set(tx + 2, yb - 3, 'W1')
    cv.vline(tx + 2, yb - 19, yb - 17, 'K'); cv.vline(tx + 4, yb - 19, yb - 17, 'K')
    for i in range(11):
        hw = 3.6 * (1 - i / 11)
        for xx in range(int(round(tx + 3 - hw)), int(round(tx + 3 + hw)) + 1):
            cv.set(xx, yb - 21 - i, 'W3' if xx < tx + 3 else 'W1')
        cv.set(int(round(tx + 3 - hw)), yb - 21 - i, 'SUN')
    flag(cv, tx + 3, yb - 38, 6, 'R', 6)
    windmill(cv, x, yb, 20, 14, 0.78, None, big=True)
    top = yb - 20 - 6
    cv.vline(x, top - 3, top, 'W3'); cv.set(x, top - 4, 'SUN'); cv.set(x + 1, top - 2, 'W1')


def bunting(cv, x0, y0, x1, y1, sag=2.0):
    n = max(1, int(abs(x1 - x0)))
    cols = ('R', 'SUN', 'S1', 'W2')
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)
        cv.set(x, y, 'B1')
        if i % 2 == 0:
            cv.set(x, y + 1, cols[(i // 2) % 4])


def draw(tier):
    rng = random.Random(11)
    cv = Cv(PAL, 'S0', W, H)
    SX, SY = 38, 35
    T = tier
    bands = [(0, 'S0'), (9, 'S1'), (19, 'S2'), (28, 'S3'), (35, 'S4'), (41, 'S5')]
    for y in range(0, 46):
        for x in range(W):
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
    cv.disc(SX, SY, 5.2, 'S5')
    cv.disc(SX, SY, 4.2, 'SUN')

    def cloud(cx, cy, length, thick, seed):
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
    for (bx, by) in [(78, 15), (84, 13), (89, 16), (95, 12)][:2 + T // 2]:
        cv.set(bx - 1, by - 1, 'S0'); cv.set(bx, by, 'S0'); cv.set(bx + 1, by - 1, 'S0')

    # ---------------------------------------------------------- far hills (haze), terraced in the capital
    far = smooth(mpd(random.Random(21), W, 4.0, 0.5), 2)
    for x in range(W):
        top = int(round(40 + far[x]))
        for y in range(top, 48):
            k = 'F1' if y < top + 2 else 'F0'
            if y == top and abs(x - SX) < 20:
                k = 'S4'
            if T >= 4 and y > top + 1 and abs(x - SX) > 14 and (y + x // (14 if T == 5 else 22)) % (2 if T == 5 else 3) == 0:
                k = 'F1' if T == 4 else ('S4' if (x // 14) % 2 else 'S3')
            cv.set(x, y, k)
    for x in range(0, W, 7):
        top = int(round(40 + far[x]))
        if rng.random() < 0.5 and abs(x - SX) > 8:
            cv.set(x, top - 1, 'F0'); cv.set(x + 1, top - 1, 'F0'); cv.set(x, top - 2, 'F0')
    far_mills = [70] + ([16, 112] if T >= 2 else []) + ([176, 132] if T >= 4 else []) + ([92, 4] if T >= 5 else [])
    for fx_ in far_mills:
        ft = int(round(40 + far[fx_]))
        cv.vline(fx_, ft - 5, ft, 'F0'); cv.vline(fx_ + 1, ft - 4, ft, 'F0')
        a = fx_ * 0.37
        cv.line(fx_ - 3, ft - 8, fx_ + 4, ft - 2, 'F0'); cv.line(fx_ - 3, ft - 2, fx_ + 4, ft - 8, 'F0')
        if T == 5:
            cv.set(fx_, ft - 3, 'S5')

    # ---------------------------------------------------------- mid patchwork fields
    mid = smooth(mpd(random.Random(4), W, 3.0, 0.5), 3)
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
            if T == 1:
                k = ['G2', 'W2', 'G1', 'G2', 'G1'][pick]
            else:
                k = ['G2', 'W2', 'G1', 'W1', 'W2'][pick]
            if d in (2, 4, 7, 10, 14, 19, 25):
                k = 'G1' if k in ('W2', 'W1') else 'G0'
            if y == top:
                k = 'G1'
                if abs(x - SX) < 16:
                    k = 'G2'
            cv.set(x, y, k)
    for x in range(2, 110, 5):
        if rng.random() < 0.55:
            top = int(round(45 + mid[x] - (x / W) * 1.5))
            yy = top + rng.choice([0, 3, 6])
            cv.set(x, yy - 1, 'G0'); cv.set(x + 1, yy - 1, 'G0'); cv.set(x, yy - 2, 'G1')

    # ---------------------------------------------------------- windmill hill
    hill = []
    for x in range(W):
        base = 52 - 21 * math.exp(-((x - 152) / 30.0) ** 2) - 4 * max(0, min(1, (x - 150) / 40.0))
        hill.append(base)
    hn = smooth(mpd(random.Random(8), W, 1.2, 0.5), 1)
    for x in range(88, W):
        top = int(round(hill[x] + hn[x]))
        slope = hill[min(W - 1, x + 1)] - hill[max(0, x - 1)]
        for y in range(top, H):
            d = y - top
            if slope > 0.3:
                k = 'G0' if d < 3 or bay(x, y) < 0.5 else 'G1'
            elif slope < -0.3:
                k = 'G2' if d < 4 else ('G1' if bay(x, y) < q4((d - 4) / 8) else 'G2')
            else:
                k = 'G1'
            if d == 0:
                k = 'W3' if slope < -0.2 else ('G2' if slope < 0.3 else 'G1')
            cv.set(x, y, k)
    for x in range(92, W, 3):
        top = int(round(hill[x] + hn[x]))
        if rng.random() < 0.4:
            cv.set(x, top + rng.randint(3, 10), 'G0')
    # wheat terraces: a few strips at first, the whole slope stepped later
    tx0 = {1: 140, 2: 116, 3: 116, 4: 112, 5: 104}[T]
    for x in range(tx0, W):
        top = int(round(hill[x] + hn[x]))
        y0 = top + 8 + (2 if x < 140 else 0)
        if T >= 4:
            y0 = top + 5
        step = 4 if T < 5 else 3
        for y in range(y0, H):
            d = y - y0
            k = 'W2'
            if d % step == step - 1:
                k = 'W1'
            if d == 0 or (T >= 4 and d % (step * 2) == 0):
                k = 'G0' if x % 2 else 'G1'
            if x > 170 and k == 'W2':
                k = 'W1' if bay(x, y) < q4((x - 170) / 30) else 'W2'
            if T == 1 and d > 6:
                k = 'G1' if d % 5 == 0 else 'G2'
            cv.set(x, y, k)

    # ---------------------------------------------------------- foreground wheat
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
        if x > 100 and (x * 5) % 3 == 0:
            cv.vline(x, top + 2, top + 3 + (x % 2), 'W0')
            cv.set(x, top + 1, 'W3')
        elif x <= 100 and x % 6 == 0:
            cv.set(x, top + 2, 'W1')
        if x % 2 == 0:
            cv.set(x, top - 1, 'W2')
            if x % 4 == 0 and x > 150:
                cv.set(x, top - 2, 'W3')

    # ---------------------------------------------------------- river
    RIV = {}
    path = [(46, 45, 4), (70, 47, 3), (86, 50, 3), (92, 53, 4), (90, 57, 5), (95, 61, 7), (103, 66, 9), (112, 72, 12)]
    if T >= 4:   # dredged and widened for the barges
        path = [(46, 45, 4), (70, 47, 4), (86, 50, 4), (92, 53, 5), (90, 57, 6), (95, 61, 8), (103, 66, 10), (112, 72, 13)]
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
        quay = T >= 3 and 50 <= y <= 64
        cv.set(x0 - 1, y, 'ST' if quay else 'G0'); cv.set(x1 + 1, y, 'B2' if quay else 'G0')
        if quay:
            cv.set(x0 - 2, y, 'B1')
        if y > 55:
            cv.set(x1 + 2, y, 'W0')
        if y % 2 == 1:
            r2 = random.Random(y * 31)
            for _ in range(1 + (x1 - x0) // 7):
                dx0 = r2.randint(x0 + 1, max(x0 + 1, x1 - 3))
                ln = r2.randint(1, 3)
                cv.hline(dx0, min(x1 - 1, dx0 + ln), y, 'SUN' if y < 54 else 'S5')

    for x in range(120, W - 4, 6):
        top = int(round(hill[x] + hn[x]))
        for row in range(3 if T > 1 else 1):
            y = top + 11 + (2 if x < 140 else 0) + row * 5 + (x // 6 % 2) * 2
            if y < H - 12 and x > tx0 + 2:
                cv.set(x, y - 1, 'W3'); cv.set(x, y, 'W1'); cv.set(x + 1, y, 'W0')
    hx = lambda x: int(round(hill[x] + hn[x]))
    ang = 0.62

    # ---------------------------------------------------------- town wall behind/around the old village (III+)
    if T >= 3:
        town_wall(cv, 74, 138, lambda x: 49 + (x - 74) * 0.02, 4 if T == 3 else 5, gaps=[(84, 100)])
        wtower(cv, 72, 50, 8 if T == 3 else 10, 4)
        wtower(cv, 136, 51, 8 if T == 3 else 10, 4)
        if T >= 4:
            wtower(cv, 104, 49, 10, 4, lit=True)

    # ---------------------------------------------------------- windmills on the hill
    if 2 <= T <= 4:
        windmill(cv, 126, hx(126) + 1, 12, 8, 0.35, rng)
    if T == 1:
        windmill(cv, 130, hx(130) + 1, 10, 7, 0.35, rng)
    if T >= 2:
        windmill(cv, 178, hx(178) + 1, 12, 9, 1.05, rng)
    if T >= 3:
        # mills spread out over the fields as the town grows
        mtop = lambda x: int(round(45 + mid[x] - (x / W) * 1.5))
        windmill(cv, 56, mtop(56) + 2, 8, 6, 0.9, rng)
    if T >= 4:
        windmill(cv, 22, mtop(22) + 2, 7, 5, 0.3, rng)
    if T == 5:
        windmill_cathedral(cv, 152, hx(152) + 1, ang)
    elif T == 4:
        mill_hall(cv, 152, hx(152) + 2, ang)
        windmill(cv, 152, hx(152) + 1, 22, 15, ang, rng, big=True)
        flag(cv, 152, hx(152) - 34, 6, 'R', 5)
    else:
        h_ = {1: 15, 2: 19, 3: 19}[T]
        windmill(cv, 152, hx(152) + 1, h_, {1: 11, 2: 13, 3: 13}[T], ang, rng, big=True)

    # ---------------------------------------------------------- the village / town by the river
    if T >= 4:
        # houses spreading left across the fields (behind the river)
        for (x, yb, w_, hh) in [(62, 51, 6, 3), (69, 50, 6, 3), (56, 50, 5, 3), (76, 52, 6, 3)]:
            house(cv, x, yb, w_, hh, 4, rng, chimney=(x % 2 == 0))
        if T == 5:
            for (x, yb, w_, hh) in [(48, 50, 5, 3), (42, 49, 5, 3)]:
                house(cv, x, yb, w_, hh, 3, rng, chimney=True)
    if T >= 3:
        granary(cv, 96, 50, 8)
        bell_tower(cv, 108, 51, 18 if T == 3 else 20)
        house(cv, 114, 51, 6, 3, 4, rng, chimney=True)
        house(cv, 90, 52, 5, 3, 3, rng)
    elif T == 2:
        granary(cv, 96, 50, 8)
    tree(cv, 100, 50, 3, dark=True)
    house(cv, 103, 52, 7, 3, 4, rng, chimney=True)
    if T >= 2:
        house(cv, 112, 51, 6, 3, 4, rng, chimney=True)
    house(cv, 82, 53, 6, 3, 3, rng, chimney=T == 1)
    bx, byb = 119, 54
    cv.rect(bx, byb - 4, bx + 9, byb + 1, 'R')
    cv.vline(bx + 8, byb - 4, byb, 'B1')
    cv.rect(bx + 3, byb - 2, bx + 6, byb + 1, 'K')
    cv.set(bx + 4, byb - 3, 'ST')
    for i in range(4):
        cv.hline(bx - 1 + i, bx + 9 - i, byb - 5 - i, 'B1' if i else 'K')
        cv.set(bx - 1 + i, byb - 5 - i, 'B2')
    tree(cv, 132, 53, 3)
    # bridge: plank footbridge, then the wooden bridge, then stone arches
    by = 56
    if T == 1:
        for x in range(86, 99):
            cv.set(x, by, 'B2' if x % 2 else 'B1')
            if x % 4 == 0:
                cv.set(x, by + 1, 'K')
    elif T == 2:
        for x in range(85, 100):
            y = by - (1 if 88 <= x <= 96 else 0)
            cv.set(x, y, 'B2'); cv.set(x, y + 1, 'B1')
            if x % 3 == 0:
                cv.set(x, y - 1, 'B1')
        cv.vline(89, 57, 58, 'K'); cv.vline(95, 57, 58, 'K')
    else:
        for x in range(83, 102):
            t = (x - 83) / 18
            y = by - int(round(2 * math.sin(t * math.pi)))
            cv.set(x, y, 'ST'); cv.set(x, y + 1, 'B2'); cv.set(x, y + 2, 'B1')
            if x % 2 == 0:
                cv.set(x, y - 1, 'ST' if x < 92 else 'B2')
        for ax in (88, 96):
            cv.hline(ax - 1, ax + 1, by + 1, 'K'); cv.set(ax, by, 'K')
        cv.rect(87, by + 2, 90, by + 4, 'K'); cv.rect(95, by + 2, 98, by + 4, 'K')
        if T >= 4:
            flag(cv, 84, by - 9, 7, 'R', 4); flag(cv, 101, by - 9, 7, 'S1', 4)
    if T <= 2:
        cv.set(92, 54 if T == 2 else 55, 'K'); cv.set(92, 53 if T == 2 else 54, 'R')
        cv.line(93, 53, 97, 51, 'B1')

    # ---------------------------------------------------------- market road, wider and busier each rank
    rw = {1: 4.5, 2: 6.5, 3: 6.5, 4: 7.0, 5: 7.5}[T]
    for y in range(55, H):
        t = (y - 55) / (H - 55)
        cx = 126 + 30 * t * t + 4 * t
        hw = 1.5 + rw * t
        x0, x1 = int(round(cx - hw)), int(round(cx + hw))
        for xx in range(x0, x1 + 1):
            k = 'ST'
            if xx == x0:
                k = 'SUN'
            elif xx >= x1 - (1 if hw > 4 else 0):
                k = 'B2'
            elif y > 60 and (xx - x0) in (int(hw * 0.6), int(hw * 1.4)):
                k = 'W2'
            if T >= 3 and k == 'ST' and (xx * 2 + y) % 5 == 0:
                k = 'B2'          # cobbles
            cv.set(xx, y, k)
        cv.set(x1 + 1, y, 'G0' if y < 62 else 'W0')

    def cart(x, y, flip=False):
        d = -1 if flip else 1
        for yy, (a, b) in zip(range(y - 6, y - 1), [(-1, 1), (-2, 2), (-3, 3), (-3, 3)]):
            for xx in range(x + a, x + b + 1):
                k = 'W3' if xx - x < (yy - y + 6) - 2 else ('W2' if xx < x + b - 1 else 'W1')
                cv.set(xx, yy, k)
            cv.set(x + a - 1, yy, 'W0'); cv.set(x + b + 1, yy, 'W0')
        cv.hline(x - 1, x + 1, y - 7, 'W0')
        cv.hline(x - 4, x + 4, y - 2, 'B2')
        cv.hline(x - 4, x + 4, y - 1, 'K')
        cv.rect(x - 2, y - 1, x + 1, y + 1, 'K')
        cv.set(x - 1, y - 1, 'B2')
        hx_ = x + d * 6
        cv.hline(x + d * 4, x + d * 5, y - 2, 'B1')
        cv.rect(min(hx_, hx_ + d * 3), y - 3, max(hx_, hx_ + d * 3) + 1, y - 1, 'B1')
        cv.set(hx_, y - 3, 'B2'); cv.set(hx_ + d, y - 3, 'B2')
        cv.set(hx_ + d * 4, y - 4, 'B1'); cv.set(hx_ + d * 4, y - 5, 'B1'); cv.set(hx_ + d * 5, y - 4, 'B1')
        cv.set(hx_ + d * 3, y - 4, 'K')
        for lx in (hx_, hx_ + d * 3):
            cv.vline(lx, y - 1, y, 'K')
        cv.set(x + 3 * d, y - 4, 'ST'); cv.set(x + 3 * d, y - 3, 'R')

    # market street: houses and stalls lining the road
    if T >= 2:
        street = [(134, 58, 6, 3), (141, 61, 6, 3)]
        if T >= 3:
            street += [(110, 58, 6, 3), (147, 64, 5, 3)]
        for (x, yb, w_, hh) in street:
            house(cv, x, yb, w_, hh, 4, rng, chimney=x % 2 == 0)
        stalls = [(121, 59, 'R')] + ([(117, 62, 'S1'), (128, 64, 'R'), (122, 67, 'W1')] if T >= 3 else [])
        if T >= 4:
            stalls += [(136, 66, 'S1'), (113, 66, 'R')]
        for (x, yb, c) in stalls:
            stall(cv, x, yb, c)
    cart(143, 66)
    if T >= 2:
        cart(129, 59, flip=True)
    if T >= 4:
        cart(158, 70)
    walkers = [(153, 70, 'R'), (124, 56, 'S1'), (137, 61, 'R')]
    if T >= 3:
        walkers += [(133, 63, 'S1'), (126, 66, 'W1'), (119, 60, 'B2'), (148, 69, 'S1')]
    if T >= 5:
        walkers += [(116, 64, 'R'), (140, 71, 'W1'), (131, 70, 'S1')]
    for (fx, fy, c) in walkers[: {1: 1, 2: 3, 3: 7, 4: 7, 5: 10}[T]]:
        figure(cv, fx, fy, c)

    # river traffic
    if T >= 4:
        barge(cv, 98, 62); barge(cv, 106, 68, 'W3')
        for x in range(76, 86):
            cv.set(x, 58, 'B2'); cv.set(x, 59, 'B1')
        cv.vline(78, 59, 61, 'K'); cv.vline(83, 59, 61, 'K')
        for (x, y) in [(78, 57), (81, 57)]:
            cv.set(x, y, 'W2'); cv.set(x + 1, y, 'W1')
    else:
        bx_, by_ = 99, 63
        cv.hline(bx_ - 3, bx_ + 3, by_, 'B1'); cv.hline(bx_ - 2, bx_ + 2, by_ + 1, 'K')
        cv.set(bx_ - 3, by_ - 1, 'B2'); cv.set(bx_ + 3, by_ - 1, 'B1')
        cv.set(bx_, by_ - 1, 'R'); cv.set(bx_, by_ - 2, 'ST')
        cv.line(bx_ + 1, by_ - 2, bx_ + 5, by_ - 5, 'B1')
        cv.hline(bx_ - 4, bx_ + 4, by_ + 2, 'S2')

    bales = [(44, 48), (58, 47), (160, 59)] if T == 1 else [(44, 48), (50, 49), (58, 47), (66, 48), (160, 59)]
    if T >= 4:
        bales = [(44, 48), (50, 49), (36, 47), (160, 59), (168, 61)]
    for (x, y) in bales:
        bale(cv, x, y)

    # festival: banners on the hill, lantern strings over the market (V), banners from IV
    if T >= 4:
        for fx in (118, 136, 170, 184):
            flag(cv, fx, hx(fx) - 9, 9, 'R' if fx % 2 else 'S1', 5)
    if T == 5:
        lantern_string(cv, 110, 54, 134, 55, 2.5, 3)
        lantern_string(cv, 134, 57, 152, 61, 2.0, 3)
        lantern_string(cv, 84, 51, 101, 51, 2.0, 3)
        bunting(cv, 126, hx(126) - 10, 152, hx(152) - 18, 3)
        bunting(cv, 152, hx(152) - 18, 178, hx(178) - 10, 3)
        bunting(cv, 80, 57, 104, 60, 2)
        # gold-domed guild house in the old town
        for i in range(4):
            cv.hline(78 + i, 86 - i, 44 - i, 'W3' if i < 2 else 'W2'); cv.set(78 + i, 44 - i, 'SUN')
        cv.rect(78, 45, 87, 50, 'ST'); cv.rect(84, 45, 87, 50, 'B2'); cv.set(80, 47, 'S5'); cv.set(82, 47, 'S5')
        cv.set(82, 39, 'SUN'); cv.set(82, 38, 'W3')
        rr = random.Random(9)
        for _ in range(16):
            x = rr.uniform(70, 186); y = rr.uniform(4, 30)
            if (cv.get(x, y) or '').startswith('S'):
                cv.set(x, y, 'SUN'); cv.set(x, y + 1, 'W1')
    tree(cv, 187, 64, 7)
    return cv
