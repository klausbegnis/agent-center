"""Frostwatch Keep: a ruined fortress across an icy pass, aurora, frozen falls, a broken gate."""
import random, math
from engine import *

W, H = 192, 72
GX = 138          # gate axis
BASE = 54         # foot of the keep wall

PAL = {
    'K0': '#070a19', 'K1': '#0b1430', 'K2': '#132049', 'K3': '#1d3062',
    # aurora
    'A1': '#1b5f66', 'A2': '#36b896', 'A3': '#a6ffd2', 'A4': '#a65aa0',
    # snow, moon-blue
    'S1': '#45558a', 'S2': '#7287ba', 'S3': '#b2c6e6', 'S4': '#eef6ff',
    # rock
    'R0': '#090b17', 'R1': '#151a2e', 'R2': '#242a46', 'R3': '#394265',
    # ice
    'I1': '#2f6c9a', 'I2': '#74c2e4',
    # keep stone
    'T1': '#29273a', 'T2': '#423f58', 'T3': '#666180',
    # fire
    'F1': '#a8421c', 'F2': '#ee8e30', 'F3': '#ffe388',
}


def snowcap(cv, x0, x1, y, depth=2, lit_left=True):
    for x in range(int(x0), int(x1) + 1):
        d = depth + (1 if hashf(x, y, 3) < 0.3 else 0)
        for i in range(d):
            cv.set(x, y - 1 + i, 'S4' if i == 0 and (lit_left or x < (x0 + x1) / 2) else 'S3')
        if hashf(x, y, 5) < 0.18:
            for i in range(1 + int(hashf(x, y, 6) * 3)):
                cv.set(x, y + d - 1 + i, 'I2' if i == 0 else 'S2')    # icicles


def draw():
    cv = Cv(PAL, 'K0', W, H)
    nz = vnoise(31)

    # ------------------------------------------------------------ sky
    bands(cv, [(0, 'K0'), (12, 'K1'), (24, 'K2'), (34, 'K3')], y1=50, tw=4)
    rng = random.Random(4)
    for i in range(40):
        x, y = rng.randrange(W), rng.randrange(30)
        cv.set(x, y, 'S2' if i % 4 else 'S3')
    # ------------------------------------------------------------ aurora: one great folded curtain
    for (y0, amp, ph, L0, x0, x1, dim) in ((3, 1.0, 0.4, 17, 40, W, 0), (16, 0.6, 2.2, 10, 0, 120, 1)):
        for x in range(x0, x1):
            yc = y0 + 5 * math.sin(x / 26.0 + ph) * amp + 2 * math.sin(x / 9.0 + ph)
            L = L0 + 4 * math.sin(x / 11.0 + ph) + 2 * math.sin(x / 4.3)
            fade_ = min(1.0, (x - x0) / 18.0, (x1 - x) / 18.0)
            L *= 0.4 + 0.6 * fade_
            streak = (x * 7 + int(ph * 10)) % 5 == 0 or (x * 3) % 11 == 0
            for y in range(int(yc), int(yc + L) + 1):
                t = (y - yc) / max(1, L)               # 0 top .. 1 bottom
                lvl = t * 3.3 - dim * 0.9 + fade_ * 0.5 - 1.0
                if streak:
                    lvl -= 0.8
                if t < 0.25 and bay(x, y) > 0.5:
                    continue
                if lvl > 2.4:
                    k = 'A3'
                elif lvl > 1.2:
                    k = 'A2'
                elif lvl > -0.2:
                    k = 'A1'
                else:
                    continue
                cv.set(x, y, k)
            if not dim and fade_ > 0.5 and not streak:
                cv.set(x, int(yc + L) + 1, 'A4')
    # ------------------------------------------------------------ far snowy range
    far = smooth(mpd(random.Random(9), W, 10, 0.62), 1)
    for x in range(W):
        top = int(round(36 + far[x] - 8 * abs(math.sin(x / 15.0)) ** 3))
        sl = far[min(W - 1, x + 1)] - far[max(0, x - 1)]
        for y in range(top, 56):
            d = y - top
            k = 'R2'
            if d < 4 - abs(sl):
                k = 'S2' if sl < 0 else 'S1'
            if d == 0:
                k = 'S3' if sl < 0 else 'S2'
            cv.set(x, y, k)
    # ------------------------------------------------------------ the pass: two steep flanks
    K = dict(lit='R3', lit2='R2', edge='S2', shade='R2', shade2='R1', snow='S3', snow2='S2', ink='R0')
    crag(cv, 6, 6, 30, 50, 60, 12, 12, K, pw=0.9, nzseed=31)
    crag(cv, 190, -2, 24, 12, 58, 13, 6, K, pw=0.75, nzseed=32)
    crag(cv, 178, 8, 10, 14, 58, 15, 13, K, pw=0.8, nzseed=33)
    # ------------------------------------------------------------ frozen waterfall on the left cliff
    FX = 15
    for y in range(22, 58):
        t = (y - 22) / 36.0
        hw = 2.5 + 5 * t ** 2
        cx = FX + (y - 22) * 0.3
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x - (cx - hw)) / (2 * hw + 1)
            stripe = math.sin(x * 1.7 + y * 0.15)
            k = 'I1'
            if stripe > 0.3:
                k = 'I2'
            if stripe > 0.85 and u < 0.6:
                k = 'S4'
            if u > 0.82:
                k = 'R2' if t < 0.4 else 'I1'
            cv.set(x, y, k)
    for x in range(FX - 4, FX + 30):                             # frozen plunge pool
        for y in range(56, 60):
            if abs(x - FX - 11) < 14 - (y - 56) * 2:
                cv.set(x, y, 'I2' if y == 56 else ('I1' if (x + y) % 3 else 'S3'))
    for (x, ln) in ((FX - 2, 4), (FX + 1, 6), (FX + 3, 3)):      # icicle fringe at the lip
        cv.vline(x, 22, 22 + ln, 'I2')
    cv.hline(FX - 4, FX + 4, 21, 'S3')

    # ------------------------------------------------------------ the rock spur the keep stands on
    for x in range(88, 182):
        top = BASE - 1 + int(2 * math.sin(x / 7.0)) + (1 if x % 9 == 0 else 0)
        for y in range(top, BASE + 6):
            cv.set(x, y, 'R2' if y - top < 2 else 'R1')
        cv.set(x, top, 'S3')

    # ------------------------------------------------------------ keep: curtain wall
    WT = 32
    for y in range(WT, BASE):
        for x in range(98, 180):
            row = (y - WT) // 3
            joint = (y - WT) % 3 == 2 or (x + row * 4) % 8 == 0
            k = 'T1' if joint else 'T2'
            if x > 160:
                k = 'T1' if joint else ('T2' if (x + y) % 2 else 'T1')
            cv.set(x, y, k)
    # broken battlements
    wtop = {}
    for x in range(98, 180):
        dmg = 0
        if 120 < x < 128:
            dmg = int(5 * math.sin((x - 120) / 8.0 * math.pi))
        if 150 < x < 155:
            dmg = 3
        top = WT - 3 + dmg
        if (x - 98) % 6 >= 3 and dmg == 0:
            top = WT
        wtop[x] = top
        for y in range(top, WT):
            cv.set(x, y, 'T2')
    for x in range(98, 180):
        snowcap(cv, x, x, wtop[x], 2)
    # arrow slits
    for x in (104, 112, 164, 172):
        cv.vline(x, 38, 42, 'R0'); cv.set(x, 37, 'T3')
    # ------------------------------------------------------------ towers
    def tower(x0, x1, top, broken):
        for x in range(x0, x1 + 1):
            cut = int(6 * abs(math.sin((x - x0) * 0.9)) + (x - x0) * 0.5) if broken else 0
            for y in range(top + cut, BASE):
                u = (x - x0) / (x1 - x0)
                row = (y - top) // 3
                joint = (y - top) % 3 == 2 or (x + row * 3) % 7 == 0
                k = 'T3' if u < 0.2 else ('T2' if u < 0.65 else 'T1')
                if joint:
                    k = 'T2' if k == 'T3' else 'T1'
                cv.set(x, y, k)
        if broken:
            for x in range(x0, x1 + 1):
                cut = int(6 * abs(math.sin((x - x0) * 0.9)) + (x - x0) * 0.5)
                snowcap(cv, x, x, top + cut + 1, 2)
        else:
            for x in range(x0 - 1, x1 + 2):
                if (x - x0) % 3 != 1:
                    cv.set(x, top - 1, 'T2'); cv.set(x, top - 2, 'T2')
                    snowcap(cv, x, x, top - 2, 1)
                else:
                    snowcap(cv, x, x, top, 1)
        cv.vline((x0 + x1) // 2, top + 10, top + 14, 'R0')
    tower(102, 116, 12, True)
    tower(160, 173, 16, False)
    # a tattered banner on the intact tower
    cv.vline(166, 4, 14, 'R0')
    for (dx, dy, k) in ((1, 4, 'F1'), (2, 4, 'F1'), (3, 5, 'F1'), (1, 5, 'F2'), (2, 5, 'F1'),
                        (1, 6, 'F1'), (2, 7, 'F1'), (4, 6, 'F1')):
        cv.set(166 + dx, dy, k)

    # ------------------------------------------------------------ the great broken gate
    GW, GT = 12, 24
    for y in range(GT - 4, BASE + 1):
        for x in range(GX - GW - 4, GX + GW + 5):
            dx = x + 0.5 - GX
            ins = (y >= GT + GW and abs(dx) <= GW) or (math.hypot(dx, y + 0.5 - (GT + GW)) <= GW)
            ring = (y >= GT + GW and abs(dx) <= GW + 3) or (math.hypot(dx, y + 0.5 - (GT + GW)) <= GW + 3)
            if ins:
                t = (y - GT) / (BASE - GT)
                k = 'R0'
                if t > 0.62:
                    v = (t - 0.62) / 0.38 * (1 - abs(dx) / GW * 0.6)
                    if v > 0.6:
                        k = 'F2' if bay(x, y) < q4((v - 0.6) * 3) else 'F1'
                    elif v > 0.2:
                        k = 'F1' if bay(x, y) < q4((v - 0.2) * 2.5) else 'R0'
                cv.set(x, y, k)
            elif ring:
                a = math.atan2(y + 0.5 - (GT + GW), dx)
                k = 'T3' if dx < 0 else 'T1'
                if y < GT + GW and int((a + 3.2) * 3.5) % 2 == 0:
                    k = 'T2'
                cv.set(x, y, k)
    snowcap(cv, GX - 3, GX + 3, GT - 3, 2)
    # something huge waits inside: shoulders and eyes
    troll = m_ell(GX + 1, GT + 18, 9, 7) | m_ell(GX + 1, GT + 9, 4.5, 4)
    for (x, y) in troll:
        if cv.get(x, y) == 'R0':
            cv.set(x, y, 'R1')
    for (x, y) in troll:
        if (x, y - 1) not in troll and cv.get(x, y) == 'R1':
            cv.set(x, y, 'R2')
    cv.set(GX - 1, GT + 9, 'F3'); cv.set(GX + 2, GT + 9, 'F3')
    cv.set(GX - 1, GT + 10, 'F1'); cv.set(GX + 2, GT + 10, 'F1')
    for (x, y) in ((GX - 3, GT + 12), (GX + 5, GT + 12)):      # tusks
        cv.set(x, y, 'S3')
    # the left leaf hangs askew from one hinge
    for i in range(GW + 1):
        x = GX - GW + i
        top = GT + GW - int(math.sqrt(max(0, GW * GW - (x + 0.5 - GX) ** 2))) + i // 3
        for y in range(top, BASE - 2 + i // 4):
            if x > GX - 2:
                break
            k = 'T2' if (x - (GX - GW)) % 4 else 'R1'
            if (y - top) % 7 == 3:
                k = 'R3'
            cv.set(x - 2 + (y - top) // 9, y, k)
    # the right leaf has fallen flat in the snow
    for y in range(BASE + 1, BASE + 5):
        for x in range(GX + 6, GX + 26):
            k = 'T2' if (x - GX) % 4 else 'R1'
            if y == BASE + 1:
                k = 'S3'
            cv.set(x + (y - BASE), y, k)
    # braziers either side of the gate
    for bx in (GX - 19, GX + 19):
        cv.rect(bx - 1, BASE - 5, bx + 2, BASE, 'R1'); cv.hline(bx - 2, bx + 2, BASE - 5, 'T3')
        for (dx, dy, k) in ((0, -6, 'F2'), (1, -6, 'F2'), (-1, -6, 'F1'), (0, -7, 'F3'), (1, -7, 'F2'),
                            (0, -8, 'F2'), (1, -9, 'F1')):
            cv.set(bx + dx, BASE + dy, k)
        light(cv, bx + 0.5, BASE - 6, 7, 6, {'T2': 'T3', 'T1': 'T2', 'S3': 'F3', 'S2': 'S3'},
              power=1.5, steps=3)

    # ------------------------------------------------------------ foreground: the snowy road
    bands(cv, [(BASE + 3, 'S2'), (BASE + 7, 'S1'), (H - 4, 'R3')], y0=BASE + 3, tw=4)
    # long wind-drifts: a lit crest and a shadow under it
    for (cx, cy, hl) in ((30, 62, 34), (84, 67, 30), (176, 63, 24), (150, 70, 30), (10, 70, 20),
                         (110, 60, 16)):
        for x in range(cx - hl, cx + hl):
            u = (x - cx) / hl
            y = cy + int(round(2 * u * u))
            cv.set(x, y, 'S2' if y > BASE + 8 else 'S3')
            if abs(u) < 0.7:
                cv.set(x, y + 1, 'R3' if y > BASE + 8 else 'S1')
                if abs(u) < 0.4:
                    cv.set(x, y - 1, 'S2')
    for x in range(W):
        cv.set(x, BASE + 3, 'S3')
    # the road: trodden, bluish, winding to the gate
    for y in range(BASE + 2, H):
        t = (y - BASE - 2) / (H - BASE - 2)
        cx = GX - 34 * t ** 1.5
        hw = 4 + 9 * t
        for x in range(int(cx - hw), int(cx + hw) + 1):
            k = 'R3' if abs(x - cx) > hw - 1.5 else 'S1'
            if abs(x - cx) < hw * 0.3 and (y + x // 3) % 4 == 0:
                k = 'R3'
            cv.set(x, y, k)
    # huge footprints going in
    for i, (x, y) in enumerate(((GX - 2, BASE + 6), (GX - 9, BASE + 9), (GX - 10, BASE + 13),
                                (GX - 19, BASE + 16))):
        cv.rect(x, y, x + 3, y + 1, 'S1'); cv.set(x, y - 1, 'S1'); cv.set(x + 2, y - 1, 'S1')
        cv.set(x + 3, y + 2, 'S3')
    # warm light out of the gate onto the snow
    light(cv, GX, BASE + 2, 22, 7, {'S1': 'S2', 'S2': 'S3', 'S3': 'S4', 'R2': 'T3', 'R1': 'T2'},
          power=1.3, steps=3)
    light(cv, GX, BASE, 12, 4, {'S2': 'F2', 'S3': 'F3', 'S1': 'F1'}, power=2, steps=2)

    # ------------------------------------------------------------ snow-laden pines, mid left
    def pine(x, base, h):
        for i in range(h):
            hw = (i * 0.45) if i < h - 1 else 0
            y = base - h + i
            for xx in range(int(x - hw), int(x + hw) + 1):
                k = 'R1'
                if i % 3 == 0 and xx < x:
                    k = 'S3'
                elif i % 3 == 0:
                    k = 'S2'
                cv.set(xx, y, k)
        cv.vline(x, base, base + 1, 'R0')
    for (x, b, h) in ((90, 56, 12), (97, 57, 9), (84, 57, 8), (185, 58, 13), (178, 58, 9)):
        pine(x, b, h)

    # ------------------------------------------------------------ a werewolf howling on the crag
    WX, WY = 104, 1
    wolf = ["....11..",
            "...111..",
            "..1111..",
            ".11111..",
            "1111111.",
            ".1111111",
            ".11.1.11",
            ".1..1..1"]
    stamp(cv, WX, WY + 2, wolf, {'1': 'R0'})
    cv.set(WX + 4, WY + 1, 'R0'); cv.set(WX + 5, WY, 'R0')

    # ------------------------------------------------------------ light snowfall
    for i in range(30):
        x, y = rng.randrange(W), rng.randrange(H)
        k = cv.get(x, y)
        if k in ('K0', 'K1', 'K2', 'K3', 'R1', 'R2', 'T1', 'T2', 'R0', 'A1'):
            cv.set(x, y, 'S3' if i % 3 else 'S4')
    return cv
