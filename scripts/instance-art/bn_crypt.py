"""The Sunken Crypt: a half-flooded mausoleum at dusk, witch-light in the doorway."""
import random, math
from engine import *

W, H = 192, 72
WL = 50          # water line
CX = 138         # mausoleum axis

PAL = {
    # dusk sky, top to horizon
    'K0': '#1b1530', 'K1': '#2c1f47', 'K2': '#47294f', 'K3': '#6c3452', 'K4': '#9b4a52',
    'K5': '#cb7050', 'K6': '#eaa65e', 'K7': '#ffe09a',
    # far shore silhouette and mist
    'H0': '#1e1428', 'MI': '#4a2e4f',
    # water
    'A0': '#0f1020', 'A1': '#191b31', 'A2': '#28283f',
    # stone, cool, lit from the low sun on the left
    'S0': '#130f19', 'S1': '#26212f', 'S2': '#3c3646', 'S3': '#5a5160', 'S4': '#827380',
    'S5': '#b8917f',
    # moss and reeds
    'G0': '#1f2a1d', 'G1': '#3a4a26', 'R2': '#5c5a2e', 'R3': '#9a7a3e',
    # witch-light
    'W1': '#1e6a52', 'W2': '#3fae7c', 'W3': '#90f0b2', 'W4': '#eaffe2',
    # stone tinted by the witch-light
    'V1': '#203a39', 'V2': '#2f5a4e',
}

STONE = ('S1', 'S2', 'S3', 'S4', 'S5')

STATUE = [            # headless robed figure, right arm raised with a snapped blade
    "..........4.",
    ".........43.",
    "........43..",
    "...44..42...",
    "..4332.42...",
    "..43322321..",
    ".4433322....",
    ".433322.....",
    ".43332221...",
    ".433322.1...",
    ".4333221....",
    ".43332221...",
    ".433322221..",
    "4433322221..",
    "4333322221..",
    "43333222211.",
    "43333222221.",
    "433332222211",
]

HEAD = [              # a giant stone head fallen on its side, face up, half sunk
    "........44433322.......",
    ".....44433333332221....",
    "...4433333332222222211.",
    "..43333000333222002221.",
    ".4333300W0333220W02221.",
    ".43333300033322000222211",
    "433333333333222222222221",
    "433333333344432222222221",
    "4333333333333432222222221",
    "43333300000033322222222211",
]

CROW = [".00.", "0000", ".00.", ".0.0"]


def draw():
    rng = random.Random(11)
    cv = Cv(PAL, 'K0', W, H)
    nz = vnoise(5)

    # ------------------------------------------------------------ sky
    bands(cv, [(0, 'K0'), (9, 'K1'), (18, 'K2'), (27, 'K3'), (34, 'K4'), (40, 'K5'), (45, 'K6')],
          y1=WL, tw=4)
    SX, SY = 30, 46
    cv.disc(SX, SY, 6.5, 'K6')
    cv.disc(SX, SY, 5, 'K7')
    # long stratus streaks, lit from below by the set sun
    for (cx, cy, hl, th) in ((34, 23, 34, 2.2), (78, 15, 30, 1.8), (162, 19, 36, 2.6),
                             (112, 30, 24, 1.4), (16, 36, 20, 1.2), (176, 31, 18, 1.2),
                             (64, 39, 16, 1.0), (140, 8, 22, 1.4)):
        for x in range(int(cx - hl), int(cx + hl) + 1):
            u = (x - cx) / hl
            t = th * (1 - u * u) ** 0.6 + 0.4 * math.sin(x * 0.7 + cy)
            if t <= 0.35:
                continue
            top = int(round(cy - t * 0.6))
            bot = int(round(cy + t * 0.6))
            body = 'K1' if cy < 20 else ('K2' if cy < 30 else 'K3')
            lit = 'K3' if cy < 20 else ('K4' if cy < 30 else 'K5')
            if abs(x - SX) < 50 and cy > 20:
                lit = 'K5' if cy < 34 else 'K6'
            for y in range(top, bot + 1):
                cv.set(x, y, body)
            cv.set(x, bot + 1, lit)
    # ------------------------------------------------------------ far shore with dead trees
    far = smooth(mpd(random.Random(4), W, 2.5, 0.6), 2)
    shore = []
    for x in range(W):
        top = 46 + far[x] - 9 * math.exp(-((x - 170) / 16.0) ** 2) - 4 * math.exp(-((x - 100) / 10.0) ** 2)
        top = int(round(top))
        shore.append(top)
        for y in range(top, WL):
            cv.set(x, y, 'H0')
    for (tx, th, lean) in ((14, 13, -1), (70, 9, 1), (86, 12, -1), (182, 14, 1), (160, 8, -1)):
        base = shore[tx]
        for i in range(th):
            x = tx + (lean * i) // 6
            cv.set(x, base - i, 'H0')
            if i < 3:
                cv.set(x + 1, base - i, 'H0')
            if i in (th // 2, th // 2 + 3, th - 2):
                d = 1 if (i // 2) % 2 else -1
                for j in range(1, 4 + th // 5):
                    cv.set(x + d * j, base - i - (j + 1) // 2, 'H0')
    # little leaning tombstones on the far bank, for scale
    for i, gx in enumerate((26, 33, 55, 61, 104, 111)):
        t = shore[gx]
        h = 2 + i % 2
        cv.rect(gx, t - h, gx + 2, t, 'H0')
        cv.set(gx + 1, t - h - 1, 'H0')
    # mist at the foot of the far shore
    for y in range(WL - 4, WL):
        for x in range(W):
            if cv.get(x, y) == 'H0' and bay(x, y) < q4((y - (WL - 5)) / 5) * 0.75:
                cv.set(x, y, 'MI')

    # ------------------------------------------------------------ water
    bands(cv, [(WL, 'A2'), (WL + 3, 'A1'), (WL + 13, 'A0')], y0=WL, tw=4)
    # sky glow and sun on the water: broken horizontal streaks
    for y in range(WL, H):
        d = y - WL
        for x in range(W):
            seg = hashf(x // (3 + d // 4), y, 3)
            if abs(x - SX) < 7 - d * 0.4 and seg < 0.6 - d * 0.04 and (y % 2 == 0 or d < 2):
                cv.set(x, y, 'K6' if d < 3 and seg < 0.3 else ('K5' if d < 7 else 'K4'))
            elif d < 10 and seg < 0.16 - d * 0.012 and (y % 2 == 0):
                cv.set(x, y, 'K4' if d < 4 else 'K3')
    cv.hline(0, W - 1, WL, 'A2')
    for x in range(SX - 7, SX + 8):
        cv.set(x, WL, 'K5' if abs(x - SX) > 4 else 'K6')

    # ------------------------------------------------------------ the mausoleum (own layer, tilted)
    L = Cv(PAL, None, W, H + 12)
    # dome and drum
    for y in range(3, 22):
        for x in range(CX - 13, CX + 14):
            dx = (x + 0.5 - CX) / 11.5
            dy = (y + 0.5 - 17) / 10
            if dx * dx + dy * dy <= 1 and y < 18:
                u = dx
                k = 'S4' if u < -0.55 else ('S3' if u < -0.1 else ('S2' if u < 0.5 else 'S1'))
                if dx * dx + dy * dy > 0.82 and u < 0:
                    k = 'S5' if u < -0.3 else 'S4'
                if x in (CX - 6, CX, CX + 6) and k != 'S5':
                    k = 'S2' if u < 0 else 'S1'
                L.set(x, y, k)
    for y in range(15, 21):
        for x in range(CX - 12, CX + 13):
            u = (x - CX) / 12
            L.set(x, y, 'S4' if u < -0.6 else ('S3' if u < 0 else ('S2' if u < 0.6 else 'S1')))
    L.hline(CX - 12, CX + 12, 15, 'S4')
    for x in range(CX - 10, CX + 11, 4):
        L.vline(x, 17, 19, 'S0')                     # drum windows
    # urn finial, a crack in the dome
    L.rect(CX - 1, 4, CX + 2, 8, 'S3'); L.set(CX - 1, 5, 'S4'); L.set(CX + 1, 6, 'S1')
    L.hline(CX - 2, CX + 2, 8, 'S2'); L.set(CX, 3, 'S4')
    for (x, y) in ((CX + 4, 9), (CX + 5, 10), (CX + 5, 11), (CX + 6, 12), (CX + 7, 13)):
        L.set(x, y, 'S0')
    # pediment
    for y in range(13, 27):
        hw = (y - 13) * 2.15
        for x in range(int(CX - hw), int(CX + hw) + 1):
            edge_l = x < CX - hw + 2
            edge_r = x > CX + hw - 2
            k = 'S2'
            if edge_l:
                k = 'S5' if y < 22 else 'S4'
            elif edge_r:
                k = 'S1'
            elif x < CX - 6 + (y - 13):
                k = 'S3'
            L.set(x, y, k)
    # skull roundel in the tympanum, eyes lit
    L.disc(CX + 0.5, 21.5, 3.6, 'S3')
    L.disc(CX + 1, 22, 2.6, 'S2')
    for (x, y, k) in ((CX - 1, 20, 'S4'), (CX, 20, 'S4'), (CX + 1, 20, 'S4'), (CX - 2, 21, 'S4'),
                      (CX - 1, 21, 'W2'), (CX + 1, 21, 'W2'), (CX, 21, 'S3'), (CX + 2, 21, 'S3'),
                      (CX - 1, 22, 'S3'), (CX, 22, 'S1'), (CX + 1, 22, 'S3'), (CX - 1, 23, 'S1'),
                      (CX, 23, 'S3'), (CX + 1, 23, 'S1')):
        L.set(x, y, k)
    # entablature
    L.rect(CX - 29, 26, CX + 30, 30, 'S3')
    L.hline(CX - 29, CX + 29, 26, 'S4'); L.hline(CX - 29, CX + 29, 28, 'S2')
    L.hline(CX - 29, CX + 29, 29, 'S1')
    L.set(CX - 29, 26, 'S5'); L.set(CX - 29, 27, 'S5')
    for x in range(CX - 27, CX + 28, 3):
        L.set(x, 28, 'S1')                           # dentils
    # cella wall
    for y in range(30, WL + 8):
        for x in range(CX - 25, CX + 26):
            row = (y - 30) // 3
            joint = (y - 30) % 3 == 2 or (x + row * 3) % 8 == 0
            k = 'S1' if joint else 'S2'
            if x < CX - 20 and not joint:
                k = 'S3'
            L.set(x, y, k)
    # columns (outer right one snapped)
    for i, cx0 in enumerate((CX - 25, CX - 16, CX + 12, CX + 21)):
        top = 30
        if i == 3:
            top = 39
        for y in range(top, WL + 8):
            for j, k in enumerate(('S5' if i == 0 else 'S4', 'S4', 'S3', 'S2', 'S1')):
                L.set(cx0 + j, y, k)
        if i == 3:
            for j, dy in enumerate((0, -2, -1, -3, 0)):
                L.set(cx0 + j, top + dy, 'S3' if j < 3 else 'S2')
                for yy in range(top + dy, top):
                    L.set(cx0 + j, yy, 'S3' if j < 3 else 'S2')
            L.hline(cx0, cx0 + 4, top + 1, 'S1')
        else:
            L.hline(cx0 - 1, cx0 + 5, 30, 'S4'); L.hline(cx0 - 1, cx0 + 5, 31, 'S2')
        for y in range(top + 3, WL + 8, 5):          # fluting shadow
            L.set(cx0 + 2, y, 'S2')
    # the snapped capital hangs from the entablature
    L.hline(CX + 20, CX + 26, 30, 'S4'); L.hline(CX + 20, CX + 26, 31, 'S2')
    L.hline(CX + 21, CX + 25, 32, 'S1'); L.set(CX + 22, 33, 'S1')
    # the door: an arch full of witch-light
    DX0, DX1, DTOP = CX - 6, CX + 7, 37
    for y in range(29, WL + 8):
        for x in range(DX0 - 3, DX1 + 3):
            dx = x + 0.5 - (CX + 0.5)
            inside = (y >= DTOP and DX0 <= x < DX1) or (dx * dx + (y + 0.5 - DTOP) ** 2 <= 6.6 ** 2)
            ring = (y >= DTOP and (DX0 - 2 <= x < DX1 + 2)) or (dx * dx + (y + 0.5 - DTOP) ** 2 <= 8.7 ** 2)
            if inside:
                t = (y - 31) / 16.0
                r = abs(dx) / 7.0
                v = t * 1.1 - r * 0.5
                if v > 0.72:
                    k = 'W3' if bay(x, y) < q4((v - 0.72) * 4) else 'W2'
                elif v > 0.42:
                    k = 'W2' if bay(x, y) < q4((v - 0.42) * 3.3) else 'W1'
                elif v > 0.12:
                    k = 'W1' if bay(x, y) < q4((v - 0.12) * 3.3) else 'V1'
                else:
                    k = 'V1' if bay(x, y) < q4(v * 4 + 0.5) else 'S0'
                L.set(x, y, k)
            elif ring and y < WL + 8:
                ang = math.atan2(y + 0.5 - DTOP, dx)
                k = 'S3' if dx < 0 else 'S2'
                if y < DTOP and int((ang + 3.2) * 2.6) % 2 == 0:
                    k = 'S1' if dx > 0 else 'S2'
                L.set(x, y, k)
    for (x, y) in ((CX, 29), (CX + 1, 29), (CX, 30), (CX + 1, 30)):
        L.set(x, y, 'S4')                            # keystone
    # a figure waiting in the doorway, back-lit
    for (x, y) in ((CX + 2, 39), (CX + 3, 39), (CX + 2, 40), (CX + 3, 40),
                   (CX + 1, 41), (CX + 2, 41), (CX + 3, 41), (CX + 4, 41),
                   (CX + 1, 42), (CX + 2, 42), (CX + 3, 42), (CX + 4, 42),
                   (CX + 1, 43), (CX + 2, 43), (CX + 3, 43), (CX + 4, 43),
                   (CX + 1, 44), (CX + 4, 44), (CX + 2, 44), (CX + 3, 44),
                   (CX + 2, 45), (CX + 3, 45), (CX + 2, 46), (CX + 3, 46),
                   (CX + 2, 47), (CX + 3, 47), (CX + 2, 48), (CX + 3, 48)):
        L.set(x, y, 'S0')
    L.set(CX + 3, 40, 'W2')
    # a broken iron gate leaf hanging open
    for i, gx in enumerate((CX - 5, CX - 3)):
        for y in range(DTOP - 1 + i, WL + 8):
            L.set(gx, y, 'S0')
    L.hline(CX - 5, CX - 2, DTOP + 2, 'S0'); L.hline(CX - 5, CX - 3, DTOP + 8, 'S0')
    # cracks and moss streaks
    for pts in (((CX - 12, 31), (CX - 10, 34), (CX - 11, 37), (CX - 9, 41)),
                ((CX + 9, 30), (CX + 10, 33), (CX + 9, 35)),
                ((CX - 22, 16 + 10), (CX - 20, 27))):
        for a, b in zip(pts, pts[1:]):
            L.line(a[0], a[1], b[0], b[1], 'S0')
    for x in range(CX - 28, CX + 29):
        if hashf(x, 1, 7) < 0.55:
            L.set(x, 25 + (0 if hashf(x, 2) < 0.6 else -1), 'G1' if x < CX else 'G0')
        if hashf(x, 3, 7) < 0.3:
            ln = 1 + int(hashf(x, 4) * 4)
            for y in range(30, 30 + ln):
                L.set(x, y, 'G0')
    # ivy curtain off the left corner
    for (x, ln) in ((CX - 28, 9), (CX - 27, 13), (CX - 26, 7), (CX - 24, 4), (CX - 29, 5)):
        for y in range(27, 27 + ln):
            if hashf(x, y, 9) < 0.8:
                L.set(x, y, 'G1' if (x + y) % 3 else 'G0')
    # perched crows
    stamp(L, CX - 2, 0, CROW, {'0': 'S0'})
    stamp(L, CX - 30, 22, CROW, {'0': 'S0'}, flip=True)

    # composite the tilted layer, plus its broken reflection
    tilt = 0.05

    def lay(x, y):
        return y + int(math.floor((x - CX) * tilt + 0.5))
    refl = {'S5': 'A2', 'S4': 'A2', 'S3': 'A2', 'S2': 'A1', 'S1': 'A1', 'S0': 'A0', 'G0': 'A1',
            'G1': 'A1', 'W1': 'W1', 'W2': 'W1', 'W3': 'W2', 'V1': 'A1', 'V2': 'A1', 'K6': 'A2'}
    for y in range(L.H):
        for x in range(W):
            k = L.get(x, y)
            if k is None:
                continue
            Y = lay(x, y)
            if Y < WL:
                cv.set(x, Y, k)
            # reflection
            ry = 2 * WL - Y
            if WL < ry < H and Y < WL:
                if (ry - WL) % 3 == 2 and k not in ('W2', 'W3'):
                    continue
                off = 1 if hashf(ry, 0, 2) < 0.3 else 0
                rk = refl.get(k, 'A1')
                if ry - WL > 12 and rk == 'A2':
                    rk = 'A1'
                cv.set(x + off, ry, rk)

    for x in range(CX - 27, CX + 29):
        if hashf(x // 2, 1, 6) < 0.7:
            cv.set(x, WL, 'K3')
    for (x, y) in ((12, 3), (57, 6), (104, 2), (176, 5), (31, 10), (150, 3)):
        cv.set(x, y, 'S4' if x % 2 else 'K4')
    # ------------------------------------------------------------ witch-light spill
    lit = {'S1': 'V1', 'S2': 'V2', 'S3': 'V2', 'S4': 'W1', 'A1': 'V1', 'A2': 'V2', 'S0': 'V1'}
    light(cv, CX + 0.5, 45, 19, 15, lit, power=1.1, steps=4,
          pred=lambda x, y: not (CX - 7 <= x < CX + 8 and y > 30))
    # light column on the water under the door
    for y in range(WL, H):
        d = y - WL
        hw = 5 - d * 0.12
        for x in range(int(CX - hw), int(CX + hw) + 2):
            s = hashf(x // 2, y, 5)
            if (y % 2 == 0 or d < 3) and s < 0.75 - d * 0.03:
                k = 'W3' if (d < 4 and abs(x - CX - 0.5) < 2.5) else ('W2' if d < 11 else 'W1')
                cv.set(x, y, k)
    for x in range(CX - 8, CX + 10):
        if cv.get(x, WL) in ('A2', 'A1', 'V2', 'V1'):
            cv.set(x, WL, 'W1' if abs(x - CX) > 5 else 'W2')

    # ------------------------------------------------------------ hooded mourner with a lantern
    SK = ('S5', 'S4', 'S3', 'S2', 'S1')
    PX = 96
    cv.rect(PX - 4, 42, PX + 7, WL + 1, 'S2')
    cv.hline(PX - 5, PX + 7, 42, 'S4'); cv.hline(PX - 5, PX + 7, 43, 'S2')
    cv.vline(PX - 4, 44, WL - 1, 'S3'); cv.vline(PX + 6, 44, WL - 1, 'S1')
    cv.set(PX - 5, 42, 'S5')
    for y in range(45, WL, 3):
        cv.hline(PX - 3, PX + 5, y, 'S1')
    robe = m_poly([(PX - 1, 29.5), (PX + 4.5, 29.5), (PX + 6.5, 42), (PX - 4.5, 42)])
    robe -= m_poly([(PX - 5, 37), (PX - 2, 42), (PX - 5, 42)])          # chipped hem
    hood = m_ell(PX + 1.5, 27.5, 3.2, 3.6)
    arm = m_seg(PX + 3, 32.5, PX + 8.5, 31.5, 1.1)
    cyl(cv, robe | hood, SK)
    cyl(cv, arm, SK[1:], cuts=(0.3, 0.6, 0.85))
    for (x, y) in ((PX + 2, 27), (PX + 3, 27), (PX + 2, 28), (PX + 3, 28), (PX + 3, 29),
                   (PX + 2, 29)):
        cv.set(x, y, 'S0')
    for y in range(33, 42, 2):                                           # robe folds
        cv.set(PX + 1 + (y % 4) // 2, y, 'S2')
    for (x, y) in ((PX - 1, 34), (PX, 35), (PX, 36), (PX + 1, 37)):     # crack
        cv.set(x, y, 'S1')
    # the lantern it holds out over the water
    cv.set(PX + 9, 32, 'S0'); cv.set(PX + 9, 33, 'S0')
    cv.rect(PX + 8, 34, PX + 11, 38, 'S0')
    cv.set(PX + 9, 35, 'W3'); cv.set(PX + 9, 36, 'W4'); cv.set(PX + 10, 35, 'W2')
    cv.set(PX + 10, 36, 'W3')
    light(cv, PX + 9.5, 36, 9, 8, {'S2': 'V2', 'S1': 'V1', 'S3': 'V2'}, power=1.4, steps=3,
          pred=lambda x, y: x > PX + 2 or y > 38)
    for y in range(WL + 1, WL + 10):                                     # reflections
        if y % 2 == 0:
            cv.hline(PX - 4 + (y % 4 == 0), PX + 6, y, 'A2' if y < WL + 5 else 'A1')
    for y in range(WL + 11, WL + 16):
        if y % 2:
            cv.hline(PX + 8, PX + 10, y, 'W2' if y < WL + 14 else 'W1')

    # ------------------------------------------------------------ a giant stone hand reaching up
    HX = 177
    palm = m_ell(HX, 47.5, 5.5, 5.5)
    fingers = [((HX - 4, 45), (HX - 8, 38), (HX - 6, 32), 1.6, 1.1),
               ((HX - 1, 43), (HX - 2, 34), (HX + 0.5, 28.5), 1.7, 1.2),
               ((HX + 2.5, 43), (HX + 4, 37), (HX + 5, 35), 1.7, 1.5),
               ((HX + 5, 45), (HX + 9, 40), (HX + 10, 37.5), 1.5, 1.1)]
    thumb = ((HX - 4, 49), (HX - 10, 48), (HX - 11, 43), 1.7, 1.2)
    cyl(cv, {p for p in palm if p[1] < WL}, SK)
    for (a, b, c, r0, r1) in [thumb] + fingers:
        m = {p for p in m_bez(a, b, c, r0, r1) if p[1] < WL}
        cyl(cv, m, SK, cuts=(0.25, 0.5, 0.75, 0.92))
    cv.hline(HX + 4, HX + 6, 35, 'S1'); cv.set(HX + 5, 34, 'S2')          # the snapped finger
    for (x, y) in ((HX - 2, 46), (HX - 1, 47), (HX, 46), (HX + 1, 48), (HX - 3, 47)):
        cv.set(x, y, 'G1' if x % 2 else 'G0')
    stamp(cv, HX - 2, 25, CROW, {'0': 'S0'})
    for y in range(WL + 1, WL + 9):
        if y % 2 == 0:
            cv.hline(HX - 11 + (y % 4 == 0) * 2, HX + 5 - (y - WL), y, 'A2' if y < WL + 5 else 'A1')

    # ------------------------------------------------------------ stepping stones to the door
    stones = [(104, 69, 5.0), (113, 64.5, 4.2), (121, 60.5, 3.6), (127.5, 57, 3.0),
              (132, 54.5, 2.6), (135.5, 52.5, 2.2)]
    for (x, y, r) in stones:
        ry = r * 0.42
        for yy in range(int(y - ry) - 1, int(y + ry) + 3):
            for xx in range(int(x - r - 2), int(x + r + 3)):
                dx = (xx + 0.5 - x) / (r + 1.5); dy = (yy + 0.5 - y - 0.6) / (ry + 1.0)
                if dx * dx + dy * dy <= 1 and cv.get(xx, yy) in ('A0', 'A1', 'K3', 'K4'):
                    if (xx + yy) % 2 == 0:
                        cv.set(xx, yy, 'A2')
        m = m_ell(x, y, r, ry + 0.6)
        for (xx, yy) in m:
            u = (xx + 0.5 - x) / r
            k = 'S2'
            if (xx, yy - 1) not in m:
                k = 'S4' if u < 0.2 else 'S3'
            elif (xx, yy + 1) not in m:
                k = 'S1'
            cv.set(xx, yy, k)
        cv.hline(int(x - r * 0.6), int(x + r * 0.6), int(y + ry + 1.2), 'A0')

    # ------------------------------------------------------------ gravestones leaning in the water
    for (gx, gy, lean, h) in ((152, 57, 1, 7), (158, 60, -1, 6), (113, 54, -1, 5)):
        m = set()
        for i in range(h):
            off = (lean * i) // 3
            for j in range(4):
                if i == h - 1 and j in (0, 3):
                    continue
                m.add((gx + j + off, gy - i))
        cyl(cv, m, ('S4', 'S3', 'S2', 'S1'), cuts=(0.3, 0.55, 0.8))
        cv.hline(gx - 1, gx + 4, gy + 1, 'A2')
        cv.hline(gx, gx + 3, gy + 3, 'A1')

    # fallen column drum and debris in the shallows
    cv.ellipse(CX + 33, WL - 0.5, 3.5, 2.2, 'S2'); cv.hline(CX + 31, CX + 34, WL - 2, 'S4')
    cv.set(CX + 30, WL - 1, 'S3'); cv.hline(CX + 31, CX + 36, WL, 'A2')
    for (x, y) in ((CX - 32, WL - 1), (CX - 33, WL - 1), (CX - 31, WL - 2)):
        cv.set(x, y, 'S3')

    # ------------------------------------------------------------ reeds, right foreground and far left
    def reed(x, base, h, lean, head=True):
        for i in range(h):
            xx = x + int(lean * i * i / (h * 2.0))
            k = 'G0' if i < h * 0.4 else ('G1' if i < h * 0.8 else 'R2')
            cv.set(xx, base - i, k)
        if head:
            xx = x + int(lean * h * h / (h * 2.0))
            for j in range(3):
                cv.set(xx, base - h + 1 + j, 'R3' if j == 0 else 'R2')
                cv.set(xx + 1, base - h + 1 + j, 'G0')
    for (x, h, ln, hd) in ((186, 22, -1.5, True), (183, 17, -0.8, False), (189, 15, 1.0, True),
                           (178, 12, -1.0, False), (175, 9, 0.6, True), (191, 25, -0.6, False),
                           (181, 20, -2.0, True), (170, 7, -0.5, False), (172, 10, 1.2, False)):
        reed(x, H - 1, h, ln, hd)
    for x in range(168, W):
        for y in range(H - 3, H):
            if hashf(x, y, 8) < 0.5 + (y - (H - 3)) * 0.2:
                cv.set(x, y, 'G0')
    for (x, h, ln) in ((6, 7, -0.5), (9, 9, 0.5), (12, 6, 1.0), (22, 5, -0.4)):
        reed(x, WL - 1, h, ln, False)

    # ------------------------------------------------------------ crows in flight, wisps
    for (x, y, p) in ((84, 12, 0), (93, 8, 1), (101, 13, 2), (72, 18, 1), (118, 6, 0)):
        crow_fly(cv, x, y, 'S0', p)
    for (x, y) in ((118, 42), (162, 37), (146, 63)):
        light(cv, x + 0.5, y + 0.5, 3.2, 3.2, {'A1': 'V1', 'A2': 'V2', 'A0': 'V1', 'H0': 'V1',
                                               'MI': 'V2', 'K3': 'V2', 'K4': 'V2', 'S1': 'V1',
                                               'S2': 'V2', 'K5': 'W1'}, power=1, steps=2)
        cv.set(x, y, 'W4')
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            cv.set(x + d[0], y + d[1], 'W2')
    return cv
