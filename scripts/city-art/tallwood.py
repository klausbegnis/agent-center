import random, math
from engine import *

PAL = {
    # haze between the trees (lightest = far)
    'H0': '#a9c48f', 'H1': '#77a083', 'H2': '#4f7c6e', 'H3': '#35605a',
    # foliage, dark to sunlit
    'G0': '#0d1d1d', 'G1': '#163129', 'G2': '#234a37', 'G3': '#3a6b40', 'G4': '#719a43', 'G5': '#bccb5c',
    # bark and timber
    'B0': '#1e1519', 'B1': '#3a2829', 'B2': '#5f4234', 'B3': '#8d6447',
    # light
    'L0': '#f0cc72', 'L1': '#fff0b3', 'L2': '#c98a3c',
    # water
    'W0': '#1c3c48', 'W1': '#3d7480', 'W2': '#93c6bf', 'WH': '#ecf4dc',
    # roofs
    'RF': '#8b432f',
}

SUN = (-60, -70)   # light comes from far upper left


def shaft_mask(x, y):
    """0..1 strength of the golden light shafts slanting down to the right."""
    v = 0.0
    for (x0, w) in ((18, 7), (52, 4), (88, 9), (118, 3), (150, 6)):
        # line through (x0, 0) with slope dx/dy = 0.55
        d = abs((x - x0) - y * 0.55)
        if d < w:
            v = max(v, 1 - d / w)
    return v


def conifer_row(cv, base, amp, seed, col, rim=None, spacing=(5, 9), hrange=(10, 20)):
    r = random.Random(seed)
    x = -4
    while x < W + 4:
        h = r.randint(*hrange)
        top = base - h
        wid = h * 0.32
        for y in range(top, H):
            t = (y - top) / max(1, h)
            hw = wid * min(1, t) + (0.6 if (y - top) % 3 == 2 else 0)
            for xx in range(int(round(x - hw)), int(round(x + hw)) + 1):
                k = col
                if rim and xx == int(round(x - hw)) and y < base:
                    k = rim
                cv.set(xx, y, k)
        x += r.randint(*spacing)


def trunk(cv, cx, w, top, bottom, seed, haze=False):
    """Giant trunk with root flare. Lit edge left, grooves wiggle down the bark."""
    r = random.Random(seed)
    wig = smooth(mpd(r, H + 1, 1.5, 0.5), 2)
    for y in range(top, bottom + 1):
        flare = 9 * math.exp((y - bottom) / 3.5)
        c = cx + wig[y] * 0.6
        x0, x1 = int(round(c - w / 2 - flare)), int(round(c + w / 2 + flare * 0.8))
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            if haze:
                k = 'H3' if u < 0.3 else 'G2'
                if (x - int(c + wig[(y * 3) % H])) % 3 == 0 and 0.1 < u < 0.9:
                    k = 'G2' if u < 0.3 else 'G1'
                if x == x0:
                    k = 'H2'
            else:
                k = 'B2'
                if u < 0.2:
                    k = 'B3'
                elif u > 0.72:
                    k = 'B1'
                if u > 0.9 or x == x1:
                    k = 'B0'
                groove = (x - int(c + wig[(y * 3) % H])) % 4 == 0
                if groove and 0.1 < u < 0.9:
                    k = 'B1' if u < 0.72 else 'B0'
                if x == x0:
                    k = 'L0' if shaft_mask(x, y) > 0.2 else 'B3'
                # moss on the shaded side
                if u > 0.55 and ((x * 5 + y * 7) % 17 == 0):
                    k = 'G2'
            cv.set(x, y, k)


def platform_house(cv, cx, hw, y, roof='RF', big=True):
    """A round house wrapped around a trunk on a timber ring."""
    R = hw + (7 if big else 5)
    # walls (front half of the ring)
    h = 6 if big else 4
    for yy in range(y - h, y + 1):
        for x in range(cx - R + 1, cx + R):
            u = (x - (cx - R)) / (2 * R)
            k = 'B3' if u < 0.35 else ('B2' if u < 0.75 else 'B1')
            if (x - cx) % 3 == 0:
                k = 'B1' if u > 0.3 else 'B2'   # plank seams
            cv.set(x, yy, k)
    # windows: warm light
    for wx in range(cx - R + 3, cx + R - 2, 5):
        cv.set(wx, y - h + 2, 'L1'); cv.set(wx + 1, y - h + 2, 'L0')
        cv.set(wx, y - h + 3, 'L0'); cv.set(wx + 1, y - h + 3, 'L2')
    cv.set(cx - 1, y - 1, 'B0'); cv.set(cx - 1, y - 2, 'B0'); cv.set(cx, y - 1, 'B0'); cv.set(cx, y - 2, 'B0')
    # platform ring and railing
    for x in range(cx - R - 2, cx + R + 3):
        cv.set(x, y + 1, 'B3' if x < cx else 'B2')
        cv.set(x, y + 2, 'B0')
    for x in range(cx - R - 2, cx + R + 3, 3):
        cv.vline(x, y + 3, y + 4, 'B1')    # joists underneath
    # conical shingle roof, sunlit left, mossy
    rh = 5 if big else 4
    for i in range(rh + 1):
        yy = y - h - 1 - i
        a = R + 2 - i * (R + 2 - hw + 1) / rh
        x0, x1 = int(round(cx - a)), int(round(cx + a))
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            k = roof
            if roof == 'RF':
                k = 'L2' if u < 0.25 else ('RF' if u < 0.7 else 'B1')
            else:
                k = 'G4' if u < 0.3 else ('G3' if u < 0.7 else 'G2')
            if i == 0:
                k = 'B0' if u > 0.5 else 'B1'
            cv.set(x, yy, k)
        cv.set(x0, yy, 'L0' if i > 0 else 'B2')
    # hanging lantern
    cv.set(cx + R + 1, y + 3, 'B1'); cv.set(cx + R + 1, y + 4, 'L1'); cv.set(cx + R + 1, y + 5, 'L2')


def bridge(cv, x1, y1, x2, y2, sag):
    pts = []
    for x in range(x1, x2 + 1):
        t = (x - x1) / max(1, x2 - x1)
        y = y1 + (y2 - y1) * t + sag * 4 * t * (1 - t)
        pts.append((x, int(round(y))))
    for (x, y) in pts:
        cv.set(x, y, 'B3' if x % 2 else 'B2')
        cv.set(x, y + 1, 'B0')
        # hand ropes, sag a bit less than the deck
        t = (x - x1) / max(1, x2 - x1)
        ry = int(round(y1 + (y2 - y1) * t + sag * 0.6 * 4 * t * (1 - t))) - 4
        cv.set(x, ry, 'B1')
        if x % 3 == 0:
            cv.vline(x, ry + 1, y - 1, 'B1')


def deer(cv, x, y, flip=False, antlers=True):
    d = -1 if flip else 1
    body = [(0, 0), (1, 0), (2, 0), (3, 0), (0, -1), (1, -1), (2, -1), (3, -1)]
    for bx, by in body:
        cv.set(x + bx * d, y + by, 'B2')
    for bx in (0, 1, 2, 3):
        cv.set(x + bx * d, y - 2 if bx in (1, 2) else y - 1, 'B2')
    cv.set(x + 3 * d, y - 2, 'B2')
    cv.set(x + 4 * d, y - 3, 'B2'); cv.set(x + 4 * d, y - 4, 'B2'); cv.set(x + 5 * d, y - 4, 'B2')
    cv.set(x + 6 * d, y - 3, 'B1')   # muzzle
    for lx in (0, 3):
        cv.vline(x + lx * d, y + 1, y + 2, 'B1')
    cv.set(x - d, y - 1, 'L1')   # tail
    if antlers:
        cv.set(x + 4 * d, y - 5, 'B1'); cv.set(x + 3 * d, y - 6, 'B1'); cv.set(x + 5 * d, y - 6, 'B1')
        cv.set(x + 2 * d, y - 6, 'B1')
    # rim light from the left
    cv.set(x + (0 if not flip else 3) * 1, y - 1, 'L0')
    cv.set(x + 4 * d, y - 4, 'L0') if not flip else None


def draw():
    rng = random.Random(3)
    cv = Cv(PAL, 'H0')

    # ---------------------------------------------------------------- deep haze: bright sky glow through gaps
    for y in range(H):
        for x in range(W):
            k = 'H0' if y < 26 else ('H1' if bay(x, y) < q4((y - 26) / 10) else 'H0')
            if y >= 36:
                k = 'H1'
            cv.set(x, y, k)
    # far conifer silhouettes (palest), then a closer row
    conifer_row(cv, 40, 0, 11, 'H1', spacing=(4, 7), hrange=(10, 22))
    conifer_row(cv, 46, 0, 12, 'H2', rim='H1', spacing=(5, 9), hrange=(12, 26))

    # ---------------------------------------------------------------- cliff and waterfall (mid distance)
    cliff = smooth(mpd(random.Random(6), W, 3, 0.55), 1)
    def ctop(x):
        e = max(0, abs(x - 64) - 22)
        return int(round(22 + cliff[x] * 0.5 + e * 0.9))
    nz_ = random.Random(2)
    for x in range(34, 96):
        top = ctop(x)
        for y in range(top, 52):
            d = y - top
            # rock ledges: horizontal strata stepping down, lit on top, moss hanging
            off = [0, 2, 1, 3, 1, 0, 2, 3, 1, 2, 0, 3, 2, 1][(x // 4 + (y // 7)) % 14]
            ledge = (y + off) % 7
            k = 'H3'
            if ledge == 0:
                k = 'H2'          # lit ledge top
            elif ledge == 1:
                k = 'G2'          # shadow under the ledge
            if (x * 13 + (y // 3) * 7) % 23 == 0:
                k = 'G2'          # cracks
            if x > 72:
                k = 'G2' if k != 'H2' else 'H3'
            if d < 2:
                k = 'G4' if d == 0 else 'G3'
            elif d < 4 and (x + y) % 3 == 0:
                k = 'G3'     # moss drips
            cv.set(x, y, k)
    WF0, WF1 = 58, 69
    for x in range(WF0, WF1 + 1):
        top = ctop(x) - 1
        for y in range(top, 50):
            u = (x - WF0) / (WF1 - WF0)
            stripe = (x * 7) % 5
            k = 'W2' if stripe in (0, 2) else ('WH' if stripe == 1 else 'W1')
            if (y + x * 3) % 7 == 0:
                k = 'WH'
            if u > 0.8:
                k = 'W1' if stripe else 'W2'
            if x == WF0 or x == WF0 + 1:
                k = 'WH'
            cv.set(x, y, k)
        cv.set(x, top - 1, 'W2')   # rounded lip where the river spills over
    # spray cloud at the foot
    for (sx, sy, r_) in ((58, 49, 3), (64, 48, 4), (70, 49, 3), (62, 51, 3)):
        for y in range(sy - r_, sy + r_ + 1):
            for x in range(sx - r_ - 1, sx + r_ + 2):
                if (x - sx) ** 2 * 0.6 + (y - sy) ** 2 <= r_ * r_:
                    cv.set(x, y, 'WH' if (x + y) % 2 == 0 or y < sy else 'W2')

    # ---------------------------------------------------------------- light shafts across the haze
    lighten = {'H0': 'L1', 'H1': 'H0', 'H2': 'H1', 'H3': 'H2', 'G2': 'G3', 'G1': 'G2', 'G3': 'G4', 'W1': 'W2'}
    for y in range(H):
        for x in range(W):
            m = shaft_mask(x, y) * (1 - y / 120)
            k = cv.get(x, y)
            if k in lighten and (m > 0.55 or bay(x, y) < q4(m * 1.6)):
                nk = lighten[k]
                if nk == 'L1' and m < 0.75:
                    nk = 'L0' if bay(x, y) < 0.5 else 'H0'
                cv.set(x, y, nk)

    # ---------------------------------------------------------------- distant giant, hazy
    trunk(cv, 98, 9, 0, 54, 21, haze=True)

    # ---------------------------------------------------------------- ridge with deer (left), forest floor
    ridge = smooth(mpd(random.Random(15), W, 2.5, 0.5), 2)
    for x in range(0, 60):
        top = int(round(42 - 2.5 * math.sin(x / 60 * math.pi) + ridge[x] * 0.5))
        for y in range(top, H):
            d = y - top
            k = 'G2' if d < 3 else ('G1' if d < 10 else 'G0')
            if d == 0:
                k = 'G4' if shaft_mask(x, y) > 0.2 else 'G3'
            cv.set(x, y, k)
        if x % 3 == 0:
            cv.set(x, top - 1, 'G3')
    def rtop(x):
        return int(round(42 - 2.5 * math.sin(x / 60 * math.pi) + ridge[x] * 0.5))
    deer(cv, 20, rtop(20) - 3)
    deer(cv, 30, rtop(30) - 3, antlers=False)
    deer(cv, 12, rtop(12) - 3, flip=True, antlers=False)

    # ---------------------------------------------------------------- river: pool under the falls, flowing right
    for y in range(50, H):
        for x in range(44, W):
            t = (y - 50)
            cx = 64 + (x - 64)
            top_bank = 50 + max(0, (x - 70)) * 0.06
            bot_bank = 56 + max(0, (x - 60)) * 0.1 + (x - 60) ** 2 * 0.0006
            if 50 <= y and top_bank <= y <= bot_bank and x >= 46 + (y - 50) * 0.5:
                k = 'W1'
                if y > bot_bank - 2:
                    k = 'W0'
                elif y > bot_bank - 4 and bay(x, y) < 0.5:
                    k = 'W0'
                cv.set(x, y, k)
    r_ = random.Random(77)
    for y in range(50, H):
        for _ in range(6):
            x = r_.randrange(46, W)
            if cv.get(x, y) in ('W1', 'W0') and y % 2 == 1:
                ln = r_.randint(2, 5)
                for xx in range(x, x + ln):
                    if cv.get(xx, y) in ('W1', 'W0'):
                        cv.set(xx, y, 'W2' if shaft_mask(xx, y) > 0.25 or r_.random() < 0.3 else ('W1' if cv.get(xx, y) == 'W0' else 'W2'))
    # banks
    for x in range(46, W):
        tb = int(round(50 + max(0, (x - 70)) * 0.06)) - 1
        cv.set(x, tb, 'G3' if x % 4 else 'G4')
    for x in range(44, W):
        bb = int(round(56 + max(0, (x - 60)) * 0.1 + (x - 60) ** 2 * 0.0006)) + 1
        for y in range(bb, H):
            d = y - bb
            k = 'G2' if d < 2 else ('G1' if d < 6 else 'G0')
            cv.set(x, y, k)
        cv.set(x, bb, 'G3')

    # ---------------------------------------------------------------- sawmill with a water wheel
    mx, my = 104, 52
    cv.rect(mx, my - 9, mx + 14, my + 1, 'B2')
    for x in range(mx, mx + 14):
        for y in range(my - 9, my + 1):
            if (x - mx) % 2 == 0:
                cv.set(x, y, 'B3' if x < mx + 6 else 'B1')
    cv.vline(mx + 13, my - 9, my, 'B0')
    for i in range(6):                                 # gable roof
        cv.hline(mx - 2 + i, mx + 15 - i, my - 10 - i, 'RF')
        cv.set(mx - 2 + i, my - 10 - i, 'L2'); cv.set(mx + 15 - i, my - 10 - i, 'B1')
    cv.hline(mx - 2, mx + 15, my - 10, 'B1')
    cv.rect(mx + 3, my - 6, mx + 6, my - 3, 'L1'); cv.set(mx + 5, my - 4, 'L0')   # lit window
    cv.rect(mx + 8, my - 5, mx + 11, my + 1, 'B0')                                  # open door
    cv.vline(mx + 7, my - 13, my - 10, 'B1'); cv.set(mx + 7, my - 14, 'B2')         # chimney
    for j in range(8):
        cv.set(mx + 8 + j // 2, my - 15 - j, 'H1' if j < 5 else 'H0')
    # water wheel
    wx, wy, wr = mx - 4, my - 1, 6
    for y in range(wy - wr - 1, wy + wr + 2):
        for x in range(wx - wr - 1, wx + wr + 2):
            d = math.hypot(x + 0.5 - wx - 0.5, y + 0.5 - wy - 0.5)
            a = math.atan2(y - wy, x - wx)
            if wr - 1.2 <= d <= wr + 0.3:
                cv.set(x, y, 'B3' if (x < wx) else 'B1')
            elif d < wr - 1.2 and (abs(math.sin(a * 4)) < 0.25 or d < 1.2):
                cv.set(x, y, 'B2')
            elif wr + 0.3 < d <= wr + 1.3 and int((a + 3.2) * 8 / 6.4 * 2) % 2 == 0:
                cv.set(x, y, 'B0')
    for (x, y) in ((wx - 6, wy + 4), (wx - 7, wy + 5), (wx - 5, wy + 6), (wx + 3, wy + 6), (wx - 8, wy + 6)):
        cv.set(x, y, 'WH')
    # log pile
    for i, (lx, ly) in enumerate(((122, 55), (125, 55), (128, 55), (123.5, 53), (126.5, 53), (125, 51))):
        cv.set(lx, ly, 'B3'); cv.set(lx + 1, ly, 'B2'); cv.set(lx, ly + 1, 'B2'); cv.set(lx + 1, ly + 1, 'B1')
        cv.set(lx, ly, 'L0')
    # tiny woodcutter
    cv.set(131, 51, 'B3'); cv.set(131, 52, 'RF'); cv.set(131, 53, 'RF'); cv.set(131, 54, 'B0'); cv.set(132, 52, 'B1'); cv.set(133, 51, 'B2')

    # ---------------------------------------------------------------- the great trees
    trunk(cv, 146, 16, 0, 62, 31)
    trunk(cv, 186, 12, 0, 60, 32)
    platform_house(cv, 146, 9, 22, roof='RF')
    platform_house(cv, 146, 9, 42, roof='G', big=True)
    platform_house(cv, 186, 7, 32, roof='RF', big=False)
    bridge(cv, 103, 18, 129, 21, 4)
    bridge(cv, 165, 39, 175, 34, 2)
    # distant platform on the hazy tree
    cv.hline(88, 108, 19, 'H3'); cv.hline(89, 107, 20, 'G2')
    cv.rect(91, 14, 106, 19, 'H2')
    for x in range(91, 106, 3):
        cv.vline(x, 14, 18, 'H3')
    cv.set(94, 16, 'L0'); cv.set(99, 16, 'L0'); cv.set(103, 15, 'L0')
    for i in range(5):
        cv.hline(89 + i * 2, 108 - i * 2, 13 - i, 'H3')
        cv.set(89 + i * 2, 13 - i, 'H1')
    # ladder
    for y in range(44, 61):
        cv.set(160, y, 'B1')
        if y % 2 == 0:
            cv.set(159, y, 'B2')
    for y in range(44, 61):
        cv.set(158, y, 'B1')

    # ---------------------------------------------------------------- canopy overhead
    can = smooth(mpd(random.Random(44), W, 4, 0.6), 1)
    for x in range(W):
        bot = int(round(5 + can[x] + 3 * math.sin(x / 9.0)))
        if 70 < x < 125:
            bot -= 3   # a clearing lets the light in over the falls
        for y in range(0, max(0, bot) + 1):
            d = bot - y
            k = 'G1' if d > 2 else ('G2' if d > 0 else 'G3')
            cv.set(x, y, k)
    # hanging leaf clumps with sunlit tops
    r = random.Random(8)
    for i in range(26):
        cx, cy, rr = r.randrange(W), r.randint(4, 10), r.randint(2, 4)
        if 74 < cx < 122:
            continue
        for y in range(cy - rr, cy + rr + 1):
            for x in range(cx - rr - 1, cx + rr + 2):
                dx, dy = (x - cx) / (rr + 1), (y - cy) / rr
                if dx * dx + dy * dy <= 1:
                    k = 'G2'
                    if dx + dy < -0.6:
                        k = 'G4'
                    elif dx + dy < 0:
                        k = 'G3'
                    elif dx + dy > 0.8:
                        k = 'G1'
                    cv.set(x, y, k)
    # vines
    for vx in (38, 83, 133, 171):
        ln = r.randint(8, 16)
        for y in range(4, 4 + ln):
            cv.set(vx + (1 if (y // 4) % 2 else 0), y, 'G3')
        cv.set(vx, 4 + ln, 'G4')

    # ---------------------------------------------------------------- foreground ferns, lower right corner + bottom edge
    for (fx, fy, s) in ((170, 72, 9), (180, 72, 8), (160, 72, 6), (6, 72, 5), (90, 72, 5)):
        for a in (-1.2, -0.7, -0.25, 0.25, 0.7, 1.2):
            for t in range(s):
                x = fx + math.sin(a) * t
                y = fy - math.cos(a) * t + (t * t) * 0.03 * abs(a) * 2
                cv.set(x, y, 'G1')
                if t % 2 == 0 and t > 1:
                    cv.set(x + (1 if a > 0 else -1), y + 1, 'G2' if a < 0 else 'G1')
    # fireflies / pollen in the shafts
    for i in range(12):
        x, y = r.randrange(40, 180), r.randrange(14, 48)
        if shaft_mask(x, y) > 0.3 and cv.get(x, y) in ('H0', 'H1', 'H2'):
            cv.set(x, y, 'L1')
    return cv
