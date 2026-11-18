"""Brinehaven in five ranks: the same harbour at sunrise, lighthouse rock and town hill, growing
from a fishing hamlet with a beacon into a grand harbour capital. Palette and helpers come from
the original Brinehaven banner (brinehaven.py); rank III is close to that banner. Canvas 192x72."""
import random, math
from rank_engine import *

W, H = 192, 72

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
    # gilded dome of the capital's guild hall
    'AU': '#d39a4a', 'AD': '#8a5a3a',
}

SX, SY, HZ = 80, 41, 41
LX = 110


def draw(rank):
    T = rank
    rng = random.Random(5)
    cv = Cv(PAL, 'K0', W, H)

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
    for x in range(W):
        if abs(x - SX) < 50:
            cv.set(x, HZ - 1, 'GO' if abs(x - SX) < 26 else 'P1')
    for y in range(SY - 7, HZ):
        for x in range(SX - 8, SX + 9):
            d = math.hypot(x + 0.5 - SX - 0.5, y + 0.5 - SY)
            if d <= 5.2:
                cv.set(x, y, 'SUN')
            elif d <= 6.3:
                cv.set(x, y, 'GO')

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

    # ---------------------------------------------------------------- far headlands
    hd = smooth(mpd(random.Random(9), W, 3, 0.5), 1)
    for x in range(0, 46):
        top = int(round(HZ - 3 - 3 * math.sin(min(1, x / 46) * math.pi) + hd[x]))
        for y in range(top, HZ):
            cv.set(x, y, 'K2' if y > top else 'K3')
    if T >= 4:
        # a far watchtower on the headland
        cv.vline(22, 33, 37, 'K1'); cv.vline(23, 33, 37, 'K1'); cv.set(22, 32, 'K1'); cv.set(23, 32, 'GO')

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
        for _ in range(4):
            x = r.randrange(W)
            if abs(x - SX) > spread + 4 and y % 3 == 0:
                calm = x < 80 and y > 50
                cv.hline(x, x + r.randint(2, 5), y, ('Q2' if calm else 'Q3') if t > 0.3 else 'K3')
                if t > 0.5 and not calm:
                    cv.hline(x + 1, x + 4, y + 1, 'Q0')
    for y in range(HZ - 6, HZ + 6):
        for x in range(W):
            m = 1 - abs(y - HZ) / 6.0
            if bay(x, y) < q4(m * 0.5) and cv.get(x, y) in ('K2', 'Q3', 'Q2', 'K3'):
                cv.set(x, y, 'K3')

    # ---------------------------------------------------------------- ships
    def ship(x, y, s=1.0, pennants=False, sails=True):
        L = int(round(22 * s))
        for i in range(L):
            yy = y + (1 if i < 3 * s or i > L - 4 * s else 0)
            cv.vline(x + i, yy - 2, y + 1, 'T0')
            cv.set(x + i, yy - 2, 'T1' if i > L // 2 else 'T0')
        cv.hline(x + 2, x + L - 2, y - 1, 'RS')
        if s >= 0.9:
            for i in range(4, L - 4, 3):
                cv.set(x + i, y - 1, 'GO' if T >= 4 else 'T0')      # gunports, lit from inside
        sc0 = int(round(13 * s))
        cv.hline(x + sc0, x + L - 1, y - 3, 'T1'); cv.hline(x + sc0 + 1, x + L - 1, y - 4, 'T0')
        cv.set(x + sc0 + 2, y - 4, 'GO'); cv.set(x + L - 4, y - 4, 'GO')
        bs = int(round(4 * s))
        cv.line(x - bs, y - 5, x + 1, y - 2, 'T0')
        masts = [(5, 20, 9), (12, 24, 11), (18, 14, 7)]
        for (mdx, mh, msw) in masts:
            mx = x + int(round(mdx * s)); top = y - int(round(mh * s)); sw = max(4, int(round(msw * s)))
            cv.vline(mx, top, y - 2, 'T0')
            if sails:
                row = top + 2
                tiers = 3 if sw > 7 else 2
                for tier in range(tiers):
                    h = max(2, int(round((4 if tier < 2 else 3) * s)))
                    w = sw - tier
                    for yy in range(row, row + h):
                        if yy >= y - 3:
                            break
                        bulge = 1 if yy == row + h // 2 else 0
                        for xx in range(mx - w // 2 - bulge, mx + w // 2 + 1 + bulge):
                            k = 'WH' if xx > mx else 'WS'
                            if xx >= mx + w // 2 - 1 + bulge:
                                k = 'P1'
                            cv.set(xx, yy, k)
                    cv.hline(mx - w // 2 - 1, mx + w // 2 + 1, row - 1, 'T0')
                    row += h + 1
            else:
                # moored: yards with furled sails
                for j, yy in enumerate(range(top + 2, y - 4, 5)):
                    w = sw - j
                    cv.hline(mx - w // 2, mx + w // 2, yy, 'T0')
                    cv.hline(mx - w // 2 + 1, mx + w // 2 - 1, yy + 1, 'WH')
                    cv.set(mx + w // 2 - 1, yy + 1, 'WS')
            cv.set(mx, top - 1, 'RD'); cv.set(mx + 1, top - 1, 'RD'); cv.set(mx + 2, top, 'RD')
            if pennants:
                for i in range(3, 7):
                    cv.set(mx + i, top - 1 + (i % 2), 'RD' if i < 5 else 'CO')
        cv.line(x - bs, y - 5, x + int(round(5 * s)), y - int(round(20 * s)), 'WS')
        for i in range(-2, L):
            if i % 2 == 0:
                cv.hline(x + i, x + i + 1, y + 3, 'Q1')
        for i in range(2, L - 2, 3):
            cv.set(x + i, y + 5, 'Q1')

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

    def rowboat(x, y, c='RD'):
        cv.hline(x, x + 5, y, 'T1'); cv.hline(x + 1, x + 4, y + 1, 'T0')
        cv.set(x, y - 1, 'T1'); cv.set(x + 5, y - 1, 'T0')
        cv.set(x + 2, y - 1, c); cv.set(x + 2, y - 2, 'WH')
        cv.line(x + 1, y - 1, x - 2, y + 2, 'T0'); cv.line(x + 4, y - 1, x + 7, y + 2, 'T0')
        cv.hline(x - 1, x + 6, y + 2, 'Q1')

    if T >= 3:
        ship(34, 46, 1.0, pennants=T >= 5)
    elif T == 2:
        ship(40, 46, 0.6, sails=True)
    if T >= 5:
        ship(4, 42, 0.62, pennants=True)
        ship(58, 44, 0.5, pennants=True)
    boat(92, 50)
    if T >= 2:
        boat(66, 45, sail=True)
    if T == 1:
        boat(52, 45, sail=True, flip=True)
    boat(138, 62, sail=False)
    if T >= 4:
        boat(84, 56, sail=True, flip=True)

    # ---------------------------------------------------------------- town hill, right
    hill = [int(round(58 - 40 * max(0, min(1, (x - 132) / 60.0)) ** 0.8)) for x in range(W)]
    for x in range(132, W):
        for y in range(hill[x], 60):
            d = y - hill[x]
            k = 'A1' if d > 1 else 'A2'
            if d == 0:
                k = 'K2'
            if T <= 2 and d > 0:
                # scrub and sea grass on the open hillside, darker downhill
                k = 'K2' if d < 3 else ('K1' if bay(x, y) < q4(0.75 - d / 40) else 'A1')
            cv.set(x, y, k)

    if T == 1:
        # a natural rocky shore with surf instead of a quay
        for x in range(132, W):
            sh = 56 + int(round(1.5 * math.sin(x * 0.4) + (1 if x % 7 == 0 else 0)))
            for y in range(sh, 60):
                cv.set(x, y, 'A2' if y == sh else ('A1' if (x + y) % 4 else 'A0'))
            cv.set(x, 60, 'WH' if x % 3 else 'K3')
            if x % 2:
                cv.set(x + 1, 61, 'K3')
    else:
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
        if T >= 4:
            # crenellated sea wall
            for x in range(134, W):
                cv.set(x, 50, 'A3' if x % 3 else 'A2')
                if x % 3 == 0:
                    cv.set(x, 49, 'A3')

    def gable(x, yb, w, h, roof='RD', wall='WH', shade_wall='WS', lit=True):
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
        if lit:
            for wx in range(x + 1, x + w - 1, 3):
                cv.set(wx, yb - h + 1, 'GO')
            cv.set(x + w // 2, yb - h - rh + 2, 'GO')
        else:
            cv.set(x + 1 + (w > 5), yb - h + 1, 'T0')
        cv.vline(x + 1, yb - 1, yb, 'T0')

    def side(x, yb, w, h, roof='RD', wall='WH', shade_wall='WS', lit=True):
        for y in range(yb - h, yb + 1):
            for xx in range(x, x + w):
                cv.set(xx, y, wall if xx < x + w - 2 else shade_wall)
        for i in range(3):
            y = yb - h - 1 - i
            for xx in range(x - 1 + i, x + w + 1 - i):
                cv.set(xx, y, roof if i else 'T0')
            cv.set(x - 1 + i, y, 'CO' if roof in ('RD', 'T1') else 'K2')
        for wx in range(x + 1, x + w - 1, 2):
            if (wx + yb) % 3 and lit:
                cv.set(wx, yb - h + 1, 'GO')
        cv.set(x + w - 3, yb - h - 4, 'T0'); cv.set(x + w - 3, yb - h - 5, 'A2')

    def hut(x, yb, w=6, h=3):
        """Fisherman's hut: tarred planks, turf-and-thatch roof."""
        for y in range(yb - h, yb + 1):
            for xx in range(x, x + w):
                k = 'T1' if xx < x + w - 2 else 'T0'
                if (xx - x) % 2 == 1 and k == 'T1':
                    k = 'T1' if y % 2 else 'T0'
                cv.set(xx, y, k)
        cv.set(x, yb - h, 'A3')
        rh = (w + 1) // 2
        for i in range(rh + 1):
            y = yb - h - 1 - i
            cv.hline(x - 1 + i, x + w - i, y, 'A2' if i < rh else 'A3')
            cv.set(x - 1 + i, y, 'A3')
            cv.set(x + w - i, y, 'A0')
        cv.vline(x + 1, yb - 1, yb, 'A0')
        cv.set(x + w - 3, yb - 2, 'GO')

    # ---------------------------------------------------------------- the town on the hill
    rows = [(20, [(176, 'g', 6, 3), (184, 's', 8, 3)]),
            (27, [(160, 's', 7, 3), (168, 'g', 5, 3), (174, 'g', 7, 4), (183, 'g', 6, 3)]),
            (34, [(148, 'g', 5, 3), (154, 's', 8, 3), (164, 'g', 7, 4), (172, 's', 9, 3), (183, 'g', 7, 4)]),
            (42, [(140, 'g', 6, 4), (147, 'g', 5, 3), (153, 'g', 7, 4), (161, 's', 10, 4), (172, 'g', 6, 4), (179, 'g', 7, 3), (187, 'g', 6, 4)]),
            (50, [(136, 'g', 8, 5), (145, 'g', 9, 6), (155, 'g', 8, 5), (164, 'g', 9, 6), (174, 'g', 8, 5), (183, 'g', 9, 6)])]
    if T == 1:
        for (x, yb, w, h) in ((176, 30, 7, 3), (160, 43, 7, 4), (183, 41, 7, 4), (148, 55, 8, 4), (161, 54, 7, 4), (176, 52, 8, 4)):
            hut(x, yb, w, h)
        for (cx_, cy_) in ((166, 47), (181, 46), (154, 50)):
            for j in range(6):
                cv.set(cx_ + j * 0.9, cy_ - j, 'WS' if j < 3 else 'K3')
                if j in (2, 3):
                    cv.set(cx_ + j * 0.9 + 1, cy_ - j, 'WS')
        # drying racks with nets and fish
        for (rx, ry) in ((140, 55), (182, 46)):
            cv.vline(rx, ry - 4, ry, 'T0'); cv.vline(rx + 7, ry - 4, ry, 'T0'); cv.hline(rx, rx + 7, ry - 4, 'T0')
            for i in range(1, 7):
                cv.set(rx + i, ry - 3, 'WS' if i % 2 else 'A3'); cv.set(rx + i, ry - 2, 'K2' if i % 3 else 'WS')
        # a path up the hill
        for i in range(9):
            cv.set(170 + i, 50 - i * 0.9, 'A3')
    else:
        first = {2: 2, 3: 0, 4: 0, 5: 0}[T]
        for ri, (yb, hs) in enumerate(rows):
            if ri < first:
                continue
            for n, (x, kind, w, h) in enumerate(hs):
                if T == 5 and ri == 0:
                    continue                       # the guild hall crowns the hill instead
                if T >= 4 and ri == 4 and n in (0, 1):
                    continue                       # warehouses on the quay
                far = ri < 2
                wall, sh = [('WH', 'WS'), ('P1', 'CO'), ('Q3', 'Q2'), ('WH', 'WS'), ('K3', 'K2')][(n * 2 + ri) % 5]
                if far:
                    wall, sh = ('K3', 'K2') if n % 2 else ('WS', 'Q2')
                roof = ['RD', 'T1', 'K1', 'RD', 'RS'][(n + ri * 2) % 5]
                lit = T >= 3 or (n + ri) % 2 == 0
                if kind == 'g':
                    gable(x, yb, w, h, roof=roof, wall=wall, shade_wall=sh, lit=lit)
                else:
                    side(x, yb, w, h, roof=roof, wall=wall, shade_wall=sh, lit=lit)
            for x in range(132, W):
                if hill[x] <= yb + 1:
                    cv.set(x, yb + 1, 'A2'); cv.set(x, yb + 2, 'A1')
        if T >= 4:
            # warehouses: long tarred sheds with big doors and hoists
            for (wx, ww) in ((135, 9), (145, 9)):
                for y in range(42, 51):
                    for xx in range(wx, wx + ww):
                        k = 'T1' if xx < wx + ww - 2 else 'T0'
                        if (xx - wx) % 3 == 2 and k == 'T1':
                            k = 'T0' if y % 3 == 0 else 'T1'
                        cv.set(xx, y, k)
                for i in range(4):
                    cv.hline(wx - 1 + i, wx + ww - i, 41 - i, 'RS' if i % 2 else 'RD')
                    cv.set(wx - 1 + i, 41 - i, 'CO')
                cv.rect(wx + 2, 45, wx + 6, 51, 'A0'); cv.set(wx + 3, 47, 'GO')
                cv.hline(wx + 3, wx + 5, 42, 'GO')
                cv.hline(wx + ww - 2, wx + ww + 1, 40, 'T0'); cv.vline(wx + ww + 1, 41, 44, 'T0')
        if T >= 3:
            # flags on the rooftops
            for (fx, fy) in ((157, 40), (176, 31), (166, 23)) + (((186, 14), (150, 30)) if T >= 4 else ()):
                cv.vline(fx, fy - 5, fy, 'T0')
                for i in range(1, 5):
                    cv.set(fx + i, fy - 5 + (i % 2), 'RD' if i < 3 else 'CO')
                    if i < 3:
                        cv.set(fx + i, fy - 4 + (i % 2), 'RS')

    # reflections of the town in the harbour water
    for y in range(60, H):
        for x in range(134, W):
            if (y % 2 == 0) and ((x * 7 + y * 3) % 5 < 2):
                src = cv.get(x, 59 - (y - 59) * 2)
                if src in ('WH', 'P1', 'K3', 'GO'):
                    cv.set(x, y, 'Q3')
                elif src in ('RD', 'CO', 'T1'):
                    cv.set(x, y, 'RS')

    if T >= 2:
        for x in (148, 167, 186):
            cv.hline(x, x + 2, 43, 'T0'); cv.vline(x + 2, 44, 45, 'T0')
        for x in range(140, 160, 2):
            cv.set(x, 52, 'T1')
        cv.hline(139, 160, 51, 'T0')

    # ---------------------------------------------------------------- piers, harbour wall, quay life
    if T >= 3:
        # stone harbour mole from the quay out to the lighthouse rock
        for x in range(118, 135):
            for y in range(55, 60):
                k = 'A2' if (y - 55) % 2 == 0 and (x + y) % 5 else 'A1'
                if y == 55:
                    k = 'A3'
                if y == 59:
                    k = 'A0'
                cv.set(x, y, k)
            cv.set(x, 60, 'Q0' if x % 2 else 'K3')
        pier_list = ((63, 128, 150),)
    elif T == 2:
        pier_list = ((56, 120, 140), (63, 128, 150))
    else:
        pier_list = ((57, 124, 146),)
    for (py, x0, x1) in pier_list:
        cv.hline(x0, x1, py, 'T1'); cv.hline(x0, x1, py + 1, 'T0')
        for x in range(x0, x1 + 1, 4):
            cv.vline(x, py + 2, py + 3, 'T0')
            cv.set(x, py + 4, 'Q1')
    if T == 1:
        rowboat(128, 62); rowboat(146, 64, 'K1'); rowboat(118, 66, 'CO')
        cv.set(140, 55, 'WH'); cv.set(140, 56, 'K1')   # a fisher on the jetty
        cv.line(141, 55, 146, 52, 'T0'); cv.line(146, 52, 148, 58, 'WS')
    else:
        for (x, k) in ((122, 'T1'), (125, 'T1'), (131, 'RS')):
            cv.rect(x, 53 if T == 2 else 52, x + 2, 56 if T == 2 else 55, k); cv.set(x, 53 if T == 2 else 52, 'A3')
        cv.set(134, 54, 'WH'); cv.set(134, 55, 'RD'); cv.set(136, 54, 'A3'); cv.set(136, 55, 'K1')
        rowboat(118, 66, 'CO')
    if T >= 3:
        # market awnings on the mole
        for (ax, c) in ((119, 'RD'), (126, 'K1')) + (((112, 'CO'),) if T >= 5 else ()):
            if ax < 118:
                continue
            for xx in range(ax, ax + 6):
                cv.set(xx, 51, c if (xx - ax) % 2 == 0 else 'WH')
                cv.set(xx, 52, 'RS' if (xx - ax) % 2 == 0 and c == 'RD' else ('T0' if (xx - ax) % 2 == 0 else 'WS'))
            cv.vline(ax, 53, 54, 'T0'); cv.vline(ax + 5, 53, 54, 'T0')
            cv.set(ax + 2, 54, 'GO'); cv.set(ax + 3, 54, 'CO'); cv.set(ax + 1, 54, 'K3')
        for (fx, c) in ((124, 'K1'), (132, 'RD')) + (((128, 'WH'), (121, 'CO')) if T >= 4 else ()):
            cv.set(fx, 52, 'A3'); cv.set(fx, 53, c); cv.set(fx, 54, c)

    # ---------------------------------------------------------------- walled port (IV+): sea towers, crane, moored ship
    def round_tower(x, yb, h, w=7):
        for y in range(yb - h, yb + 1):
            for xx in range(x, x + w):
                u = (xx - x) / (w - 1)
                k = 'A3' if u < 0.3 else ('A2' if u < 0.7 else 'A1')
                if (y - yb) % 3 == 0 and 0 < u < 1:
                    k = 'A2' if k == 'A3' else ('A1' if k == 'A2' else 'A0')
                cv.set(xx, y, k)
            cv.set(x + w, y, 'A0')
        for xx in range(x - 1, x + w + 1):
            cv.set(xx, yb - h, 'A3')
            if (xx - x) % 2 == 0:
                cv.set(xx, yb - h - 1, 'A3')
        cv.set(x + w // 2, yb - h + 4, 'GO'); cv.set(x + w // 2, yb - h + 5, 'T1')
        cv.set(x + w // 2, yb - h + 10, 'GO')
        rh = w
        for i in range(rh):
            hw = (w / 2 + 0.5) * (1 - i / rh)
            cx = x + (w - 1) / 2
            for xx in range(int(round(cx - hw)), int(round(cx + hw)) + 1):
                cv.set(xx, yb - h - 2 - i, 'RD' if xx < cx else 'RS')
            cv.set(int(round(cx - hw)), yb - h - 2 - i, 'CO')
        fx = x + w // 2
        cv.vline(fx, yb - h - rh - 6, yb - h - rh - 1, 'T0')
        for i in range(1, 6):
            cv.set(fx + i, yb - h - rh - 6 + (1 if i in (2, 3) else 0), 'RD' if i < 4 else 'CO')
            if i < 4:
                cv.set(fx + i, yb - h - rh - 5 + (1 if i in (2, 3) else 0), 'RS')

    if T >= 4:
        ship(160, 67, 0.95, pennants=T >= 5, sails=False)
        round_tower(186, 58, 18, 6)

    # ---------------------------------------------------------------- the domed guild hall (V)
    if T == 5:
        gx0, gx1, gyb = 168, 191, 21
        for y in range(gyb - 7, gyb + 1):
            for x in range(gx0, gx1 + 1):
                k = 'WH' if x < gx1 - 5 else 'WS'
                if (x - gx0) % 4 == 2:
                    k = 'WS' if k == 'WH' else 'Q2'
                cv.set(x, y, k)
        for x in range(gx0 + 1, gx1, 4):
            cv.vline(x, gyb - 5, gyb - 2, 'GO'); cv.set(x, gyb - 5, 'SUN')
        cv.hline(gx0 - 1, gx1 + 1, gyb - 8, 'A3'); cv.hline(gx0 - 1, gx1 + 1, gyb + 1, 'A2')
        cv.hline(gx0, gx1, gyb - 9, 'WH')
        dcx = (gx0 + gx1) / 2
        cv.rect(dcx - 6, gyb - 12, dcx + 7, gyb - 9, 'WH'); cv.rect(dcx + 3, gyb - 12, dcx + 7, gyb - 9, 'WS')
        for x in range(int(dcx - 5), int(dcx + 7), 2):
            cv.set(x, gyb - 11, 'GO')
        for y in range(gyb - 20, gyb - 12):
            for x in range(int(dcx - 8), int(dcx + 9)):
                dx = (x + 0.5 - dcx) / 7.5; dy = (y + 0.5 - (gyb - 12)) / 7.5
                if dx * dx + dy * dy <= 1:
                    lum = -dx * 0.8 - dy * 0.4
                    k = 'SUN' if lum > 0.55 else ('GO' if lum > 0.05 else ('AU' if lum > -0.5 else 'AD'))
                    if (x - int(dcx)) % 4 == 0 and k != 'SUN':
                        k = 'AU' if k == 'GO' else 'AD'
                    cv.set(x, y, k)
        cv.vline(int(dcx), gyb - 24, gyb - 20, 'AD'); cv.set(int(dcx), gyb - 25, 'SUN'); cv.set(int(dcx) - 1, gyb - 22, 'GO')
        cv.vline(int(dcx), gyb - 32, gyb - 26, 'T0')
        for i in range(1, 7):
            cv.set(int(dcx) + i, gyb - 32 + (1 if i in (2, 3, 4) else 0), 'RD' if i < 5 else 'CO')
            if i < 5:
                cv.set(int(dcx) + i, gyb - 31 + (1 if i in (2, 3, 4) else 0), 'RS')

    # ---------------------------------------------------------------- mist bands
    for (my, mx0, mx1) in ((44, 2, 30), (46, 60, 92), (43, 116, 150)):
        for x in range(mx0, mx1):
            edge = min(x - mx0, mx1 - x)
            if edge > 3 or bay(x, my) < edge / 4.0:
                if cv.get(x, my) in ('K2', 'K3', 'Q2', 'Q3', 'P1', 'CO', 'GO'):
                    cv.set(x, my, 'K3')

    # ---------------------------------------------------------------- lighthouse rock
    boulders = [(LX - 14, 57, 8, 5), (LX + 13, 56, 9, 6), (LX + 4, 53, 11, 7), (LX - 7, 52, 9, 6),
                (LX + 15, 60, 8, 4), (LX - 16, 61, 7, 3), (LX, 59, 12, 5), (LX + 1, 47, 8, 4)]
    if T == 1:
        boulders = [b for i, b in enumerate(boulders) if i not in (7,)]
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

    if T == 1:
        # ---------------------------------------------------------------- a timber beacon
        base, tip = 47, 32
        cv.line(LX - 5, base, LX - 1, tip + 2, 'T0'); cv.line(LX + 5, base, LX + 1, tip + 2, 'T0')
        cv.line(LX - 4, base, LX, tip + 2, 'T1')
        cv.vline(LX, tip + 2, base, 'T0')
        cv.hline(LX - 3, LX + 3, 41, 'T1'); cv.hline(LX - 2, LX + 2, 37, 'T1')
        cv.line(LX - 3, 41, LX + 2, 37, 'T0')
        # iron fire basket and flame
        cv.hline(LX - 3, LX + 3, tip + 1, 'T0'); cv.hline(LX - 2, LX + 2, tip + 2, 'A0')
        for (dx, dy, k) in [(-2, 0, 'CO'), (-1, 0, 'GO'), (0, 0, 'SUN'), (1, 0, 'GO'), (2, 0, 'CO'),
                            (-1, -1, 'GO'), (0, -1, 'SUN'), (1, -1, 'CO'), (0, -2, 'GO'), (-1, -2, 'CO'),
                            (0, -3, 'CO'), (1, -4, 'RD')]:
            cv.set(LX + dx, tip + dy, k)
        for (dx, dy) in ((-4, -2), (4, -1), (-3, -5), (3, -4)):
            cv.set(LX + dx, tip + dy, 'GO')
        # smoke puffs drifting away
        for j, (dx, dy, r) in enumerate(((1, -6, 1.2), (3, -9, 1.6), (6, -12, 2.0), (10, -15, 2.3), (15, -17, 2.4))):
            for yy in range(int(tip + dy - r) - 1, int(tip + dy + r) + 2):
                for xx in range(int(LX + dx - r) - 1, int(LX + dx + r) + 2):
                    ddx = xx + 0.5 - (LX + dx); ddy = yy + 0.5 - (tip + dy)
                    if ddx * ddx + ddy * ddy <= r * r and not (j >= 3 and bay(xx, yy) < 0.25 * (j - 2)):
                        cv.set(xx, yy, 'WS' if ddy > 0 or j < 2 else 'K3')
        # a warm halo around the fire
        for yy in range(tip - 6, tip + 4):
            for xx in range(LX - 6, LX + 7):
                dd = math.hypot(xx - LX, (yy - tip + 1) * 1.2)
                if 3 < dd < 6 and bay(xx, yy) < q4((6 - dd) / 6) and cv.get(xx, yy) in ('K2', 'K3', 'P1'):
                    cv.set(xx, yy, 'P1' if cv.get(xx, yy) != 'P1' else 'GO')
        cv.set(LX - 2, 44, 'WH'); cv.set(LX - 2, 45, 'K1')     # the keeper
    else:
        # ---------------------------------------------------------------- lighthouse
        base, top = 44, {2: 16, 3: 14, 4: 12, 5: 9}[T]
        for y in range(top, base + 1):
            t = (y - top) / (base - top)
            hw = 2.5 + 3.5 * t + (0.6 * t if T == 5 else 0)
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
        for y in ((top + 11, top + 22) if T < 5 else (top + 8, top + 18, top + 27)):
            cv.set(LX, y, 'K0' if T < 4 else 'GO'); cv.set(LX, y + 1, 'K0' if T < 4 else 'T1')
        cv.vline(LX - 1, 41, 44, 'T0'); cv.vline(LX, 41, 44, 'T0')
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
        if top - 10 >= 0:
            cv.set(LX, top - 10, 'T0'); cv.set(LX + 1, top - 10, 'T0')
        if T >= 3:
            # the beam: a pale wedge through the dawn haze toward the upper left
            lx, ly = LX + 0.5, top - 3.5
            strength = {3: 0.75, 4: 1.0, 5: 1.25}[T]
            for y in range(0, HZ):
                for x in range(0, LX - 3):
                    dx, dy = x + 0.5 - lx, y + 0.5 - ly
                    a = math.atan2(-dy, -dx)
                    dist = math.hypot(dx, dy)
                    w_ = (0.045 + 1.5 / max(dist, 1)) * (1.3 if T == 5 else 1.0)
                    ang0 = -0.07 if T < 5 else 0.06
                    if abs(a + ang0) < w_ + 0.035:
                        core = abs(a + ang0) < w_ * 0.5 + 0.01
                        fade = max(0, 1 - dist / (130 * strength))
                        k = cv.get(x, y)
                        up = {'K0': 'K1', 'K1': 'K2', 'K2': 'K3', 'K3': 'P1', 'P1': 'SUN', 'CO': 'P1'}.get(k)
                        if core:
                            up = {'K0': 'K2', 'K1': 'K3', 'K2': 'K3', 'K3': 'P1', 'P1': 'SUN', 'CO': 'P1'}.get(k)
                            if dist < 22:
                                up = 'SUN' if dist < 12 else 'P1'
                        if up and (core and fade > 0.25 or bay(x, y) < q4(fade * (1.0 if core else 0.55) + 0.15)):
                            cv.set(x, y, up)
        for d in (-4, -3, 4, 5):
            cv.set(LX + d, top - 4, 'GO')
        if T == 2:
            for d in (-5, 6):
                cv.set(LX + d, top - 4, 'P1')

    if T >= 4:
        round_tower(132, 58, 15, 6)
        # treadwheel crane on the mole
        cx_, cy_ = 127, 46
        cv.vline(cx_ - 3, cy_, cy_ + 9, 'T0'); cv.vline(cx_ + 3, cy_, cy_ + 9, 'T0')
        for a in range(20):
            ang = a * math.pi / 10
            cv.set(cx_ + math.cos(ang) * 3.5, cy_ + 4 + math.sin(ang) * 3.5, 'T1' if math.cos(ang) < 0 else 'T0')
        cv.line(cx_, cy_ + 4, cx_ + 3, cy_ + 4, 'T0')
        cv.line(cx_ + 1, cy_ + 1, cx_ - 8, cy_ - 10, 'T0'); cv.line(cx_ + 2, cy_ + 1, cx_ - 7, cy_ - 10, 'T1')
        cv.vline(cx_ - 8, cy_ - 9, cy_ - 3, 'WS')
        cv.rect(cx_ - 10, cy_ - 3, cx_ - 6, cy_, 'T1'); cv.hline(cx_ - 10, cx_ - 7, cy_ - 3, 'A3'); cv.vline(cx_ - 7, cy_ - 3, cy_ - 1, 'T0')


    # gulls
    gulls = [(126, 14), (132, 10), (95, 22), (139, 17)][: {1: 2, 2: 3}.get(T, 4)]
    if T >= 4:
        gulls += [(150, 4), (60, 12)]
    for (gx, gy) in gulls:
        cv.set(gx - 1, gy, 'WH'); cv.set(gx, gy + 1, 'WS'); cv.set(gx + 1, gy, 'WH')
        cv.set(gx - 2, gy - 1, 'WH'); cv.set(gx + 2, gy - 1, 'WH')
    for y in range(63, H):
        if y % 2 == 0:
            cv.hline(LX - 2, LX + 2, y, 'Q3' if y < 68 else 'Q2')

    # ---------------------------------------------------------------- festival (V)
    def lanterns(x0, y0, x1, y1, sag, every=3):
        n = max(1, int(abs(x1 - x0)))
        cols = ('GO', 'RD', 'SUN', 'CO')
        for i in range(n + 1):
            t = i / n
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)
            cv.set(x, y, 'T0')
            if i % every == 1:
                cv.set(x, y + 1, cols[(i // every) % 4])

    if T == 5:
        lanterns(134, 46, 160, 47, 2.5)
        lanterns(160, 47, 191, 46, 2.5)
        lanterns(118, 49, 134, 46, 2.0)
        lanterns(LX + 5, 8, 128, 44, 3.0, 2)      # bunting from the lighthouse gallery to the tower
        lanterns(150, 33, 168, 19, 1.5)
        rr = random.Random(3)
        for (fx, fy, r, c1, c2) in ((150, 9, 4, 'SUN', 'GO'), (178, 4, 3, 'RD', 'CO'), (136, 20, 3, 'WH', 'K3')):
            for i in range(10):
                a = i * math.pi / 5
                for j, rad in enumerate((r * 0.5, r)):
                    x = fx + math.cos(a) * rad; y = fy + math.sin(a) * rad * 0.9
                    if (cv.get(x, y) or '').startswith('K'):
                        cv.set(x, y, c1 if j == 0 else c2)
            cv.set(fx, fy, 'SUN')
    return cv
