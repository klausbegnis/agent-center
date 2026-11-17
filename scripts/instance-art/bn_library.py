"""The Drowned Library: a domed archive tilting into a lake under a full moon."""
import random, math
from engine import *

W, H = 192, 72
WL = 52          # water line
CX = 126         # rotunda axis (before tilt)
TILT = 9.0       # degrees, right side sinking

PAL = {
    'K0': '#0c0b1e', 'K1': '#16143b', 'K2': '#231f53', 'K3': '#352d6b',
    'MO': '#fff3cc', 'M2': '#e6cd92', 'MH': '#4b3f88',
    # stone, moonlit from the right
    'S0': '#0f0d1c', 'S1': '#1f1b37', 'S2': '#342f50', 'S3': '#524a70', 'S4': '#7e7498',
    'S5': '#c3b6cc',
    # verdigris dome
    'D1': '#1a343f', 'D2': '#2c5a5f', 'D3': '#4f8a7f',
    # lamplight and book spines
    'L1': '#5e3328', 'L2': '#bb7434', 'L3': '#f1be5e', 'L4': '#fff1b4', 'B1': '#7b2a3d',
    # lake
    'A0': '#09091a', 'A1': '#131331', 'A2': '#201e47',
    # ghost-light
    'G1': '#7bd6e6',
}

STONE = ('S5', 'S4', 'S3', 'S2', 'S1')


def library_layer():
    L = Cv(PAL, None, W, H + 20)
    top = 28                      # cornice
    x0, x1 = CX - 20, CX + 20
    # drum, lit from the moon on the right
    for y in range(top, 72):
        for x in range(x0, x1 + 1):
            u = (x - x0) / (x1 - x0)
            k = 'S1' if u < 0.3 else ('S2' if u < 0.62 else ('S3' if u < 0.86 else 'S4'))
            if u > 0.95:
                k = 'S5'
            if (y - top) % 5 == 4:
                k = {'S1': 'S0', 'S2': 'S1', 'S3': 'S2', 'S4': 'S3', 'S5': 'S4'}[k]
            L.set(x, y, k)
    # pilasters and tall arched windows
    for i, px_ in enumerate(range(x0 + 2, x1, 8)):
        for y in range(top + 2, 72):
            L.set(px_, y, 'S3' if px_ > CX else 'S2')
            L.set(px_ + 1, y, 'S1' if px_ < CX else 'S2')
        wx = px_ + 3
        if wx + 3 > x1:
            continue
        for y in range(top + 6, top + 22):
            for x in range(wx, wx + 4):
                if y == top + 6 and x in (wx, wx + 3):
                    continue
                t = (y - top - 6) / 16.0
                k = 'L2' if (x == wx or y < top + 8) else ('L3' if t > 0.3 else 'L2')
                if x == wx + 1 and top + 10 < y < top + 19:
                    k = 'L4' if i in (2, 3) else 'L3'
                if y in (top + 12, top + 17):
                    k = 'L1'                                 # mullions
                L.set(x, y, k)
        L.hline(wx - 1, wx + 4, top + 22, 'S3')
    # cornice and balustrade
    L.rect(x0 - 2, top - 2, x1 + 3, top + 1, 'S3')
    L.hline(x0 - 2, x1 + 2, top - 2, 'S4'); L.hline(x0 - 2, x1 + 2, top + 1, 'S1')
    L.set(x1 + 2, top - 2, 'S5'); L.set(x1 + 2, top - 1, 'S5')
    for x in range(x0 - 1, x1 + 2):
        L.set(x, top - 4, 'S3' if x > CX else 'S2')
        if x % 2 == 0:
            L.set(x, top - 3, 'S2' if x < CX else 'S3')
    # dome: verdigris copper with ribs, moon side lit
    for y in range(top - 18, top - 3):
        for x in range(x0 - 1, x1 + 2):
            dx = (x + 0.5 - CX) / 20.5
            dy = (y + 0.5 - (top - 4)) / 13.0
            if dx * dx + dy * dy > 1:
                continue
            u = dx
            k = 'D1' if u < -0.1 else ('D2' if u < 0.55 else 'D3')
            if dx * dx + dy * dy > 0.86 and u > 0.2:
                k = 'S4'
            rib = abs(math.sin(math.asin(max(-1, min(1, dx / math.sqrt(max(0.05, 1 - dy * dy))))) * 3.2))
            if rib < 0.12:
                k = {'D1': 'S0', 'D2': 'D1', 'D3': 'D2', 'S4': 'S3'}[k]
            L.set(x, y, k)
    # explicit ribs
    for phi in (-62, -34, -8, 18, 44, 68):
        sp = math.sin(math.radians(phi))
        for y in range(top - 17, top - 3):
            dy = (y + 0.5 - (top - 4)) / 13.0
            if abs(dy) >= 1:
                continue
            x = CX + 20.5 * sp * math.sqrt(1 - dy * dy)
            k = L.get(x, y)
            if k in ('D1', 'D2', 'D3', 'S4'):
                L.set(x, y, {'D1': 'S0', 'D2': 'D1', 'D3': 'D2', 'S4': 'D3'}[k])
    # a breach in the dome
    for (x, y) in ((CX - 8, top - 10), (CX - 7, top - 10), (CX - 9, top - 9), (CX - 8, top - 9),
                   (CX - 7, top - 9), (CX - 6, top - 9), (CX - 8, top - 8), (CX - 7, top - 8),
                   (CX - 6, top - 8), (CX - 7, top - 7)):
        L.set(x, y, 'S0')
    L.set(CX - 7, top - 8, 'L2')
    # lantern cupola and spire
    for y in range(top - 22, top - 16):
        for x in range(CX - 4, CX + 5):
            L.set(x, y, 'S2' if x < CX + 2 else 'S4')
    for x in (CX - 2, CX, CX + 2):
        L.vline(x, top - 21, top - 18, 'L3')
    L.hline(CX - 5, CX + 5, top - 22, 'S4')
    L.ellipse(CX + 0.5, top - 23, 4, 2.0, 'D2'); L.set(CX + 2, top - 24, 'D3')
    L.vline(CX, top - 27, top - 25, 'S3'); L.set(CX, top - 28, 'L3')
    # the broken wall: shelves of books open to the night
    hole = m_poly([(x0 - 1, 38), (x0 + 3, 33), (x0 + 7, 35), (x0 + 11, 31), (x0 + 15, 37),
                   (x0 + 13, 43), (x0 + 16, 49), (x0 + 10, 64), (x0 - 1, 64)])
    spine = ('B1', 'L2', 'D2', 'L1', 'S3', 'B1', 'D1', 'L2')
    for (x, y) in hole:
        sy = (y - 34) % 6
        if sy == 5:
            k = 'L1'                                         # shelf board
        elif sy == 0:
            k = 'S0'
        else:
            k = spine[int(hashf(x, (y - 34) // 6, 3) * len(spine))]
            if sy == 1 and hashf(x, y, 8) < 0.3:
                k = 'S0'                                     # gaps, leaning books
        L.set(x, y, k)
    for (x, y) in hole:                                      # ragged lit edge of the breach
        for (dx, dy) in ((1, 0), (0, -1), (-1, 0), (0, 1)):
            q = (x + dx, y + dy)
            if q not in hole and L.get(*q) in STONE + ('S0',) and x0 <= q[0] <= x1:
                L.set(q[0], q[1], 'S4' if dx < 0 else 'S0')
    # broken stones spilling out
    for (x, y) in ((x0 - 3, 48), (x0 - 4, 49), (x0 - 2, 53), (x0 - 5, 54), (x0 - 3, 54)):
        L.set(x, y, 'S3')
    return L


def draw():
    cv = Cv(PAL, 'K0', W, H)
    rng = random.Random(23)

    # ------------------------------------------------------------ sky and the full moon
    bands(cv, [(0, 'K0'), (14, 'K1'), (28, 'K2'), (40, 'K3')], y1=WL, tw=4)
    MX, MY = 156, 18
    for y in range(MY - 20, MY + 21):
        for x in range(MX - 22, MX + 23):
            d = math.hypot(x + 0.5 - MX, y + 0.5 - MY)
            if 12 < d < 20 and bay(x, y) < q4((20 - d) / 8.0) * 0.75:
                if cv.get(x, y) in ('K0', 'K1', 'K2'):
                    cv.set(x, y, {'K0': 'K1', 'K1': 'K2', 'K2': 'K3'}[cv.get(x, y)])
    cv.disc(MX, MY, 12.5, 'MH')
    cv.disc(MX, MY, 11.5, 'M2')
    cv.disc(MX + 0.6, MY - 0.6, 10.6, 'MO')
    for (x, y, r) in ((MX - 4, MY + 2, 2.2), (MX + 3, MY - 4, 1.4), (MX + 5, MY + 4, 1.6),
                      (MX - 2, MY - 5, 1.0)):
        cv.disc(x, y, r, 'M2')
    for i in range(36):
        x, y = rng.randrange(W), rng.randrange(36)
        if cv.get(x, y) in ('K0', 'K1'):
            cv.set(x, y, 'S3' if i % 3 else 'S4')
    # thin clouds across the moon
    for (cx, cy, hl) in ((150, 22, 26), (52, 20, 14), (88, 30, 18)):
        for x in range(cx - hl, cx + hl):
            u = (x - cx) / hl
            t = 1.4 * (1 - u * u)
            if t < 0.5:
                continue
            for y in range(int(cy - t * 0.5), int(cy + t * 0.5) + 1):
                cv.set(x, y, 'K3' if cv.get(x, y) in ('MO', 'M2', 'MH') else 'K2')
            if cv.get(x, cy + 1) in ('MO', 'M2'):
                cv.set(x, int(cy + t * 0.5) + 1, 'M2')

    # ------------------------------------------------------------ far shore: a drowned town
    far = smooth(mpd(random.Random(2), W, 2, 0.6), 2)
    for x in range(W):
        top = int(47 + far[x])
        for y in range(top, WL):
            cv.set(x, y, 'S1')
    for (x, w, h, roof) in ((8, 6, 8, 1), (17, 4, 5, 0), (26, 3, 12, 2), (40, 7, 6, 1),
                            (60, 5, 9, 0), (70, 3, 4, 0), (176, 6, 7, 1), (186, 4, 10, 2)):
        b = int(47 + far[x])
        cv.rect(x, b - h, x + w, b, 'S1')
        if roof == 1:
            for i in range(w // 2 + 1):
                cv.hline(x + i, x + w - i, b - h - 1 - i, 'S1')
        elif roof == 2:
            for i in range(4):
                cv.set(x + w // 2, b - h - 1 - i, 'S1')
                if i < 2:
                    cv.hline(x, x + w, b - h - 1 - i // 2, 'S1')
        if hashf(x, 1) < 0.6:
            cv.set(x + 1 + w // 3, b - h + 2, 'L2')

    # ------------------------------------------------------------ water
    bands(cv, [(WL, 'A2'), (WL + 4, 'A1'), (WL + 14, 'A0')], y0=WL, tw=4)
    # the moon's path on the lake
    for y in range(WL, H):
        d = y - WL
        for x in range(MX - 14, MX + 15):
            s = hashf(x // 3, y, 9)
            if abs(x - MX) < 10 - d * 0.2 and s < 0.62 - d * 0.02 and y % 2 == 0:
                cv.set(x, y, 'MO' if d < 6 and s < 0.25 else ('M2' if d < 12 else 'MH'))

    # ------------------------------------------------------------ a drowned arcade leading in
    for i, ax in enumerate(range(62, 104, 10)):
        top = 41 + i * 0 - (1 if i == 2 else 0)
        broken = i == 1
        for y in range(top, WL):
            for x in range(ax, ax + 11):
                dx = x + 0.5 - (ax + 5.5)
                hole = y > top + 3 and abs(dx) < 3.5 and (y > top + 6 or math.hypot(dx, y - (top + 6)) < 3.5)
                if hole:
                    continue
                if broken and x > ax + 6 and y < top + 4:
                    continue
                k = 'S2'
                if x == ax + 10 or (abs(dx) < 4 and dx > 2.5 and y > top + 3):
                    k = 'S4'
                elif x == ax:
                    k = 'S1'
                if y == top:
                    k = 'S3'
                cv.set(x, y, k)
                ry = 2 * WL - y
                if ry < H and (ry - WL) % 3 != 2 and not hole:
                    cv.set(x, ry, 'A2')
        if not broken:
            cv.hline(ax, ax + 10, top - 1, 'S3')
            cv.set(ax + 10, top - 1, 'S5')
    # ------------------------------------------------------------ the library, tilted, plus reflection
    lay = rotated(library_layer(), CX, 62, TILT)
    refl = {'L3': 'L2', 'L4': 'L3', 'L2': 'L1', 'S5': 'A2', 'S4': 'A2', 'D3': 'A2', 'D2': 'A1'}
    for (x, y), k in lay.items():
        if y < WL:
            cv.set(x, y, k)
            ry = 2 * WL - y
            if WL <= ry < H and (ry - WL) % 3 != 2:
                rk = refl.get(k, 'A1' if k not in ('S0', 'D1') else 'A0')
                if ry - WL > 10 and rk in ('L3', 'L2'):
                    rk = 'L1'
                cv.set(x + (1 if hashf(ry, 0, 3) < 0.3 else 0), ry, rk)
    for x in range(CX - 26, CX + 28):
        if hashf(x // 2, 2, 4) < 0.7:
            cv.set(x, WL, 'S3')

    # ------------------------------------------------------------ pages and lights adrift
    pages = [(104, 40, 0), (99, 34, 1), (107, 28, 2), (95, 26, 0), (101, 19, 1), (90, 15, 2),
             (112, 22, 1), (86, 30, 0), (97, 9, 2), (114, 33, 0)]
    for (x, y, p) in pages:
        if p == 0:
            cv.set(x, y, 'MO'); cv.set(x + 1, y, 'M2')
        elif p == 1:
            cv.set(x, y, 'MO'); cv.set(x, y + 1, 'M2'); cv.set(x + 1, y, 'MO')
        else:
            cv.set(x, y, 'M2'); cv.set(x + 1, y + 1, 'MO')
    for (x, y, k) in ((150, 44, 'G1'), (82, 46, 'G1'), (164, 58, 'L3'), (118, 61, 'G1'),
                      (174, 40, 'L3')):
        light(cv, x + 0.5, y + 0.5, 3.5, 3.5, {'A1': 'A2', 'A0': 'A1', 'K3': 'MH', 'K2': 'K3',
                                               'S1': 'S2', 'S2': 'S3'}, power=1, steps=2)
        cv.set(x, y, 'MO' if k == 'G1' else 'L4')
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            cv.set(x + d[0], y + d[1], k)

    # ------------------------------------------------------------ a rowboat with a hooded rower
    BX, BY = 78, 62
    for i in range(16):
        x = BX + i
        depth = 2 if 2 < i < 13 else 1
        cv.set(x, BY - (1 if i in (0, 15) else 0), 'S3' if i < 12 else 'S4')
        for d in range(1, depth + 1):
            cv.set(x, BY + d - (1 if i in (0, 15) else 0), 'L1')
        if i in (0, 1):
            cv.set(x, BY - 1 - (1 - i), 'S3')
    for i in range(1, 15, 2):
        cv.set(BX + i, BY + 4, 'A2')
    rower = m_ell(BX + 9, BY - 3, 2.2, 3) | m_ell(BX + 9, BY - 6.5, 1.6, 1.6)
    for (x, y) in rower:
        cv.set(x, y, 'S1' if x < BX + 10 else 'S2')
    cv.set(BX + 8, BY - 6, 'S0')
    cv.line(BX + 7, BY - 3, BX + 1, BY + 3, 'L1')            # oar
    # bow lantern on a pole
    cv.vline(BX + 15, BY - 7, BY - 1, 'S0')
    cv.set(BX + 16, BY - 7, 'S0'); cv.set(BX + 16, BY - 6, 'L4'); cv.set(BX + 16, BY - 5, 'L2')
    for y in range(BY + 3, BY + 9):
        if y % 2:
            cv.set(BX + 16, y, 'L2' if y < BY + 6 else 'L1')
    for x in range(BX - 6, BX + 22, 2):
        if cv.get(x, BY + 2) in ('A0', 'A1', 'A2'):
            cv.set(x, BY + 2, 'A2')
    return cv
