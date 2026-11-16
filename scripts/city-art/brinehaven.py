import random, math
from engine import *

PAL = {
    # dawn sky: deep teal -> aqua -> mint -> peach -> coral
    'K0': '#1c3656', 'K1': '#2b5d73', 'K2': '#57938f', 'K3': '#a6c6ae', 'P1': '#f5c3a0', 'CO': '#e9786a',
    'SUN': '#fff3d6', 'GO': '#ffcd84',
    # sea
    'Q0': '#112a3b', 'Q1': '#1a4656', 'Q2': '#2a6b70', 'Q3': '#4f9a90',
    # whitewash and its cool shadow, brick red and its shadow
    'WH': '#f1e5d2', 'WS': '#93aeb0', 'RD': '#c9524c', 'RS': '#7f3646',
    # rock
    'A0': '#17222e', 'A1': '#30414b', 'A2': '#5d6a69', 'A3': '#a0977f',
    # timber
    'T0': '#4a3036', 'T1': '#87584a',
}

SX, SY, HZ = 80, 41, 41


def draw():
    rng = random.Random(5)
    cv = Cv(PAL, 'K0')

    # ---------------------------------------------------------------- sky
    bands = [(0, 'K0'), (8, 'K1'), (17, 'K2'), (26, 'K3'), (33, 'P1'), (38, 'CO')]
    for y in range(HZ):
        for x in range(W):
            d = math.hypot((x - SX) * 0.30, (y - SY) * 1.0)
            yy = y + max(0, 16 - d) * 0.8
            k = bands[0][1]
            for i in range(len(bands)):
                y0, c0 = bands[i]
                if yy >= y0:
                    k = c0
                    if i + 1 < len(bands):
                        y1, c1 = bands[i + 1]
                        if yy >= y1 - 3:
                            k = c1 if bay(x, y) < q4((yy - (y1 - 3)) / 3.0) else c0
            cv.set(x, y, k)
    # far coral glow line right at the horizon
    for x in range(W):
        if abs(x - SX) < 50:
            cv.set(x, HZ - 1, 'GO' if abs(x - SX) < 26 else 'P1')
    # sun: half risen, with a gold ring
    for y in range(SY - 7, HZ):
        for x in range(SX - 8, SX + 9):
            d = math.hypot(x + 0.5 - SX - 0.5, y + 0.5 - SY)
            if d <= 5.2:
                cv.set(x, y, 'SUN')
            elif d <= 6.3:
                cv.set(x, y, 'GO')

    # thin clouds lit coral from below
    def streak(x0, y, ln, seed):
        r = random.Random(seed)
        for i in range(ln):
            t = i / ln
            th = int(1 + 1.5 * math.sin(t * math.pi) + r.random() * 0.8)
            for j in range(th):
                k = 'K2' if j < th - 1 else ('P1' if abs(x0 + i - SX) < 60 else 'K3')
                if j == 0 and th > 1:
                    k = 'K1' if y < 20 else 'K2'
                cv.set(x0 + i, y - j, k)
    streak(4, 12, 40, 1); streak(30, 21, 30, 2); streak(96, 16, 28, 3); streak(140, 7, 46, 4)
    streak(-4, 30, 26, 5); streak(150, 27, 30, 6)

    # ---------------------------------------------------------------- far headlands on the horizon (hazy)
    hd = smooth(mpd(random.Random(9), W, 3, 0.5), 1)
    for x in range(0, 46):
        top = int(round(HZ - 3 - 3 * math.sin(min(1, x / 46) * math.pi) + hd[x]))
        for y in range(top, HZ):
            cv.set(x, y, 'K2' if y > top else 'K3')

    # ---------------------------------------------------------------- sea
    for y in range(HZ, H):
        t = (y - HZ) / (H - HZ)
        for x in range(W):
            if t < 0.15:
                k = 'Q3'
            elif t < 0.35:
                k = 'Q2' if bay(x, y) < q4((t - 0.15) / 0.2) else 'Q3'
            elif t < 0.6:
                k = 'Q2'
            elif t < 0.8:
                k = 'Q1' if bay(x, y) < q4((t - 0.6) / 0.2) else 'Q2'
            else:
                k = 'Q1'
            cv.set(x, y, k)
    # sun's glitter path and wave dashes
    for y in range(HZ, H):
        r = random.Random(y * 7)
        t = (y - HZ) / (H - HZ)
        spread = 4 + t * 14
        for _ in range(3 + int(t * 3)):
            x = int(SX + r.uniform(-spread, spread))
            ln = r.randint(1, 3 + int(t * 3))
            k = 'SUN' if abs(x - SX) < spread * 0.35 else ('GO' if abs(x - SX) < spread * 0.7 else 'CO')
            if y % 2 == 0 or t < 0.2:
                cv.hline(x, x + ln, y, k)
        # wavelets elsewhere: lighter crests (sky-coloured) and darker troughs
        for _ in range(4):
            x = r.randrange(W)
            if abs(x - SX) > spread + 4 and y % 3 == 0:
                calm = x < 80 and y > 50
                cv.hline(x, x + r.randint(2, 5), y, ('Q2' if calm else 'Q3') if t > 0.3 else 'K3')
                if t > 0.5 and not calm:
                    cv.hline(x + 1, x + 4, y + 1, 'Q0')

    # ---------------------------------------------------------------- morning mist over far water
    for y in range(HZ - 6, HZ + 6):
        for x in range(W):
            m = 1 - abs(y - HZ) / 6.0
            if bay(x, y) < q4(m * 0.5) and cv.get(x, y) in ('K2', 'Q3', 'Q2', 'K3'):
                cv.set(x, y, 'K3')

    # ---------------------------------------------------------------- sailing ship (sun to its right)
    def ship(x, y):
        # hull
        for i in range(22):
            yy = y + (1 if i < 3 or i > 18 else 0)
            cv.vline(x + i, yy - 2, y + 1, 'T0')
            cv.set(x + i, yy - 2, 'T1' if i > 10 else 'T0')
        cv.hline(x + 2, x + 20, y - 1, 'RS')
        cv.hline(x + 13, x + 21, y - 3, 'T1'); cv.hline(x + 14, x + 21, y - 4, 'T0')   # stern castle
        cv.set(x + 15, y - 4, 'GO'); cv.set(x + 18, y - 4, 'GO')
        cv.line(x - 4, y - 5, x + 1, y - 2, 'T0')   # bowsprit
        # masts and square sails, sunlit on the right edge
        for mx, top, sw in ((x + 5, y - 20, 9), (x + 12, y - 24, 11), (x + 18, y - 14, 7)):
            cv.vline(mx, top, y - 2, 'T0')
            row = top + 2
            for tier in range(3 if sw > 7 else 2):
                h = 4 if tier < 2 else 3
                w = sw - tier
                for yy in range(row, row + h):
                    bulge = 1 if yy == row + h // 2 else 0
                    for xx in range(mx - w // 2 - bulge, mx + w // 2 + 1 + bulge):
                        k = 'WH' if xx > mx else 'WS'
                        if xx >= mx + w // 2 - 1 + bulge:
                            k = 'P1'
                        cv.set(xx, yy, k)
                cv.hline(mx - w // 2 - 1, mx + w // 2 + 1, row - 1, 'T0')
                row += h + 1
            cv.set(mx, top - 1, 'RD'); cv.set(mx + 1, top - 1, 'RD'); cv.set(mx + 2, top, 'RD')
        cv.line(x - 4, y - 5, x + 5, y - 20, 'WS')   # stay
        # reflection
        for i in range(-2, 22):
            if i % 2 == 0:
                cv.hline(x + i, x + i + 1, y + 3, 'Q1')
        for i in range(2, 20, 3):
            cv.set(x + i, y + 5, 'Q1')
    ship(34, 46)

    def boat(x, y, sail=True, flip=False):
        cv.hline(x, x + 6, y, 'T0'); cv.hline(x + 1, x + 5, y + 1, 'T0')
        cv.set(x, y - 1, 'T1'); cv.set(x + 6, y - 1, 'T1')
        if sail:
            for i in range(6):
                for j in range(i // 2 + 1):
                    cv.set(x + 3 + (j if not flip else -j), y - 2 - (5 - i), 'WH' if j > 0 else 'WS')
            cv.vline(x + 3, y - 8, y - 1, 'T0')
        else:
            cv.set(x + 2, y - 1, 'RD'); cv.set(x + 2, y - 2, 'WH')
            cv.line(x + 3, y - 2, x + 7, y - 5, 'T0')
        cv.hline(x - 1, x + 7, y + 2, 'Q1')
    boat(92, 50)
    boat(66, 45, sail=True)
    boat(138, 62, sail=False)

    # ---------------------------------------------------------------- town hill, right
    hill = [int(round(58 - 40 * max(0, min(1, (x - 132) / 60.0)) ** 0.8)) for x in range(W)]
    for x in range(132, W):
        for y in range(hill[x], 59):
            d = y - hill[x]
            k = 'A1' if d > 1 else 'A2'
            if d == 0:
                k = 'K2'
            cv.set(x, y, k)
    # quay wall: dressed stone, sunlit top course, arched boathouse openings
    for x in range(134, W):
        for y in range(51, 59):
            row = (y - 51) // 2
            joint = (y - 51) % 2 == 1 or (x + row * 3) % 6 == 0
            k = 'A1' if joint else 'A2'
            if y == 51:
                k = 'A3'
            cv.set(x, y, k)
        cv.set(x, 59, 'Q0')
    for ax in (150, 170):
        cv.rect(ax, 54, ax + 6, 59, 'Q0')
        cv.hline(ax + 1, ax + 4, 53, 'Q0')
        cv.set(ax + 2, 57, 'GO')
    def gable(x, yb, w, h, roof='RD', wall='WH', shade_wall='WS'):
        """House with the gable end to the viewer: lit from the left (the sun)."""
        rh = (w + 1) // 2
        for y in range(yb - h, yb + 1):
            for xx in range(x, x + w):
                k = wall if xx < x + w - 2 else shade_wall
                cv.set(xx, y, k)
        for i in range(rh + 1):
            y = yb - h - i
            for xx in range(x + i - 1, x + w - i + 1):
                k = wall if xx < x + w // 2 else shade_wall
                cv.set(xx, y, k)
            cv.set(x + i - 1, y, roof)
            cv.set(x + i, y, roof if i < rh else wall)
            cv.set(x + w - i, y, 'T0' if roof != 'RS' else 'RS')
            cv.set(x + w - i - 1, y, roof if i < rh else shade_wall)
        # windows warm, door dark
        for wx in range(x + 1, x + w - 1, 3):
            cv.set(wx, yb - h + 1, 'GO')
        cv.set(x + w // 2, yb - h - rh + 2, 'GO')
        cv.vline(x + 1, yb - 1, yb, 'T0')

    def side(x, yb, w, h, roof='RD', wall='WH', shade_wall='WS'):
        """House with the long side to the viewer: roof as a band."""
        for y in range(yb - h, yb + 1):
            for xx in range(x, x + w):
                cv.set(xx, y, wall if xx < x + w - 2 else shade_wall)
        for i in range(3):
            y = yb - h - 1 - i
            for xx in range(x - 1 + i, x + w + 1 - i):
                cv.set(xx, y, roof if i else 'T0')
            cv.set(x - 1 + i, y, 'CO' if roof in ('RD', 'T1') else 'K2')
        for wx in range(x + 1, x + w - 1, 2):
            if (wx + yb) % 3:
                cv.set(wx, yb - h + 1, 'GO')
        cv.set(x + w - 3, yb - h - 4, 'T0'); cv.set(x + w - 3, yb - h - 5, 'A2')

    # rows of buildings climbing the hill (back rows first)
    rows = [(20, [(176, 'g', 6, 3), (184, 's', 8, 3)]),
            (27, [(160, 's', 7, 3), (168, 'g', 5, 3), (174, 'g', 7, 4), (183, 'g', 6, 3)]),
            (34, [(148, 'g', 5, 3), (154, 's', 8, 3), (164, 'g', 7, 4), (172, 's', 9, 3), (183, 'g', 7, 4)]),
            (42, [(140, 'g', 6, 4), (147, 'g', 5, 3), (153, 'g', 7, 4), (161, 's', 10, 4), (172, 'g', 6, 4), (179, 'g', 7, 3), (187, 'g', 6, 4)]),
            (50, [(136, 'g', 8, 5), (145, 'g', 9, 6), (155, 'g', 8, 5), (164, 'g', 9, 6), (174, 'g', 8, 5), (183, 'g', 9, 6)])]
    for ri, (yb, hs) in enumerate(rows):
        for n, (x, kind, w, h) in enumerate(hs):
            far = ri < 2
            wall, sh = [('WH', 'WS'), ('P1', 'CO'), ('Q3', 'Q2'), ('WH', 'WS'), ('K3', 'K2')][(n * 2 + ri) % 5]
            if far:
                wall, sh = ('K3', 'K2') if n % 2 else ('WS', 'Q2')
            roof = ['RD', 'T1', 'K1', 'RD', 'RS'][(n + ri * 2) % 5]
            if kind == 'g':
                gable(x, yb, w, h, roof=roof, wall=wall, shade_wall=sh)
            else:
                side(x, yb, w, h, roof=roof, wall=wall, shade_wall=sh)
        # retaining wall below each row
        for x in range(132, W):
            if hill[x] <= yb + 1:
                cv.set(x, yb + 1, 'A2'); cv.set(x, yb + 2, 'A1')
    # reflections of the town in the harbour water: broken dashes
    for y in range(60, H):
        for x in range(134, W):
            if (y % 2 == 0) and ((x * 7 + y * 3) % 5 < 2):
                src = cv.get(x, 59 - (y - 59) * 2)
                if src in ('WH', 'P1', 'K3', 'GO'):
                    cv.set(x, y, 'Q3')
                elif src in ('RD', 'CO', 'T1'):
                    cv.set(x, y, 'RS')

    # warehouse hoist beams and hides drying on racks
    for x in (148, 167, 186):
        cv.hline(x, x + 2, 43, 'T0'); cv.vline(x + 2, 44, 45, 'T0')
    for x in range(140, 160, 2):
        cv.set(x, 52, 'T1')
    cv.hline(139, 160, 51, 'T0')

    # piers with posts and boats
    for (py, x0, x1) in ((56, 120, 140), (63, 128, 150)):
        cv.hline(x0, x1, py, 'T1'); cv.hline(x0, x1, py + 1, 'T0')
        for x in range(x0, x1 + 1, 4):
            cv.vline(x, py + 2, py + 3, 'T0')
            cv.set(x, py + 4, 'Q1')
    # barrels and crates on the quay
    for (x, k) in ((122, 'T1'), (125, 'T1'), (131, 'RS')):
        cv.rect(x, 53, x + 2, 56, k); cv.set(x, 53, 'A3')
    cv.set(134, 54, 'WH'); cv.set(134, 55, 'RD'); cv.set(136, 54, 'A3'); cv.set(136, 55, 'K1')   # dockhands

    for (my, mx0, mx1) in ((44, 2, 30), (46, 60, 92), (43, 116, 150)):
        for x in range(mx0, mx1):
            edge = min(x - mx0, mx1 - x)
            if edge > 3 or bay(x, my) < edge / 4.0:
                cv.set(x, my, 'K3')
    # ---------------------------------------------------------------- lighthouse rock
    LX = 110
    # rock built from overlapping boulders, each shaded as a lumpy sphere lit from the left
    boulders = [(LX - 14, 57, 8, 5), (LX + 13, 56, 9, 6), (LX + 4, 53, 11, 7), (LX - 7, 52, 9, 6),
                (LX + 15, 60, 8, 4), (LX - 16, 61, 7, 3), (LX, 59, 12, 5), (LX + 1, 47, 8, 4)]
    for (bx, by, rx, ry) in boulders:
        for y in range(int(by - ry) - 1, int(by + ry) + 2):
            for x in range(int(bx - rx) - 1, int(bx + rx) + 2):
                dx = (x + 0.5 - bx) / rx; dy = (y + 0.5 - by) / ry
                dd = dx * dx + dy * dy
                if dd > 1 or y > 62:
                    continue
                lum = -dx * 0.75 - dy * 0.65 + (0.25 if bx < LX else -0.1)
                k = 'A3' if lum > 0.75 else ('A2' if lum > 0.15 else ('A1' if lum > -0.55 else 'A0'))
                if dd > 0.82 and lum < 0.2:
                    k = 'A0'
                if y > 59 and k in ('A2', 'A3'):
                    k = 'A1'
                if y > 59 and (x + y) % 3 == 0:
                    k = 'Q2'
                cv.set(x, y, k)
    for x in range(LX - 23, LX + 24):
        if cv.get(x, 62) in ('A0', 'A1', 'A2', 'Q2'):
            cv.set(x, 63, 'WH' if (x + 1) % 3 else 'K3')
            if x % 2:
                cv.set(x + 1, 64, 'K3')
    # ---------------------------------------------------------------- lighthouse
    base, top = 44, 9
    for y in range(top, base + 1):
        t = (y - top) / (base - top)
        hw = 2.5 + 3.5 * t
        x0, x1 = int(round(LX - hw)), int(round(LX + hw))
        band = ((y - top) // 6) % 2 == 1
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            if band:
                k = 'RD' if u < 0.55 else 'RS'
                if x == x0:
                    k = 'CO'
            else:
                k = 'SUN' if x == x0 else ('WH' if u < 0.55 else 'WS')
            if x == x1:
                k = 'K1' if not band else 'T0'
            cv.set(x, y, k)
    # small windows up the tower
    for y in (20, 31):
        cv.set(LX, y, 'K0'); cv.set(LX, y + 1, 'K0')
    cv.set(LX - 1, 41, 'T0'); cv.vline(LX - 1, 41, 44, 'T0'); cv.vline(LX, 41, 44, 'T0')
    # gallery, lantern room and cap
    cv.hline(LX - 5, LX + 5, top, 'T0'); cv.hline(LX - 5, LX + 5, top - 1, 'A2')
    cv.set(LX - 5, top - 1, 'A3')
    for x in range(LX - 4, LX + 5, 2):
        cv.set(x, top - 2, 'T0')
    cv.rect(LX - 2, top - 6, LX + 3, top - 1, 'SUN')
    cv.vline(LX - 2, top - 6, top - 2, 'T0'); cv.vline(LX + 3, top - 6, top - 2, 'T0')
    cv.set(LX + 2, top - 5, 'GO'); cv.set(LX + 2, top - 4, 'GO')
    for i in range(3):
        cv.hline(LX - 3 + i, LX + 4 - i, top - 7 - i, 'RD' if i < 2 else 'RS')
        cv.set(LX - 3 + i, top - 7 - i, 'CO')
    cv.set(LX, top - 10, 'T0'); cv.set(LX + 1, top - 10, 'T0')
    # the beam: a pale wedge cutting through the dawn haze toward the upper left
    lx, ly = LX + 0.5, top - 3.5
    for y in range(0, HZ):
        for x in range(0, LX - 3):
            dx, dy = x + 0.5 - lx, y + 0.5 - ly
            a = math.atan2(-dy, -dx)
            dist = math.hypot(dx, dy)
            w_ = 0.045 + 1.5 / max(dist, 1)
            if abs(a + 0.07) < w_ + 0.035:
                core = abs(a + 0.07) < w_ * 0.5 + 0.01
                fade = max(0, 1 - dist / 130)
                k = cv.get(x, y)
                up = {'K0': 'K1', 'K1': 'K2', 'K2': 'K3', 'K3': 'P1', 'P1': 'SUN', 'CO': 'P1'}.get(k)
                if core:
                    up = {'K0': 'K2', 'K1': 'K3', 'K2': 'K3', 'K3': 'P1', 'P1': 'SUN', 'CO': 'P1'}.get(k)
                    if dist < 22:
                        up = 'SUN' if dist < 12 else 'P1'
                if up and (core and fade > 0.25 or bay(x, y) < q4(fade * (1.0 if core else 0.55) + 0.15)):
                    cv.set(x, y, up)
    # flare at the lamp
    for d in (-4, -3, 4, 5):
        cv.set(LX + d, top - 4, 'GO')

    # gulls
    for (gx, gy) in ((126, 14), (132, 10), (95, 22), (139, 17)):
        cv.set(gx - 1, gy, 'WH'); cv.set(gx, gy + 1, 'WS'); cv.set(gx + 1, gy, 'WH')
        cv.set(gx - 2, gy - 1, 'WH'); cv.set(gx + 2, gy - 1, 'WH')
    # lighthouse reflection in the sea, broken into dashes
    for y in range(63, H):
        if y % 2 == 0:
            cv.hline(LX - 2, LX + 2, y, 'Q3' if y < 68 else 'Q2')
    return cv
