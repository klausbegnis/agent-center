"""The Smugglers' Warren: a sea cave in a moonlit cliff at night, lanterns strung inside, a sloop
moored at a wooden jetty, crates and barrels; warm lantern light against cold moonlit water."""
import random, math
from engine import *

W, H = 192, 72
WL = 47          # horizon and the water's surface far out
CX = 150         # cave mouth axis
CT = 21          # crown of the cave mouth
JY = 51          # jetty deck

PAL = {
    # night sky
    'N0': '#060914', 'N1': '#0c1226', 'N2': '#151e3c', 'N3': '#223056',
    'M1': '#e4ecff', 'M2': '#9aaad6',
    # cliff, moonlit from the upper left
    'R0': '#05060b', 'R1': '#0f121d', 'R2': '#1b2131', 'R3': '#2d374c', 'R4': '#4f5d78',
    'G1': '#1d2c2c',
    # cold water
    'A0': '#040811', 'A1': '#091222', 'A2': '#111d36', 'A3': '#253859',
    # lantern light
    'L0': '#2a140e', 'L1': '#5a2a14', 'L2': '#a8501c', 'L3': '#ec9a3c', 'L4': '#ffe09a',
    # timber, sailcloth
    'W1': '#24170f', 'W2': '#432a1a', 'W3': '#73502e', 'CL': '#a89c84',
    # a far light out at sea
    'GH': '#6fe0b0',
}

WARM = {'R0': 'L0', 'R1': 'L0', 'R2': 'L1', 'R3': 'L2', 'W1': 'W2', 'W2': 'W3', 'W3': 'L3',
        'L0': 'L1', 'L1': 'L2', 'A1': 'L0', 'A2': 'L1', 'A0': 'L0', 'CL': 'L4', 'G1': 'L1'}


def cliff_top(x):
    """Upper edge of the cliff mass for column x (it rises to the right)."""
    if x < 92:
        return None
    t = (x - 92) / 100.0
    return 47 - 40 * (1 - (1 - t) ** 2.2)


def lantern(cv, x, y, big=True):
    if big:
        cv.hline(x - 1, x + 1, y - 1, 'W1')
        cv.set(x - 1, y, 'L3'); cv.set(x, y, 'L4'); cv.set(x + 1, y, 'L3')
        cv.set(x - 1, y + 1, 'L2'); cv.set(x, y + 1, 'L4'); cv.set(x + 1, y + 1, 'L2')
        cv.set(x, y + 2, 'W1')
    else:
        cv.set(x, y, 'L4'); cv.set(x, y + 1, 'L3')


def draw():
    cv = Cv(PAL, 'N0', W, H)
    nz = vnoise(23)
    rng = random.Random(61)

    # ------------------------------------------------------------ sky, crescent moon, stars
    bands(cv, [(0, 'N0'), (14, 'N1'), (28, 'N2'), (39, 'N3')], y1=WL, tw=4)
    MX, MY = 50, 13
    for y in range(MY - 16, MY + 17):
        for x in range(MX - 18, MX + 19):
            d = math.hypot(x + 0.5 - MX, y + 0.5 - MY)
            k = cv.get(x, y)
            if 7 < d < 15 and k in ('N0', 'N1', 'N2') and bay(x, y) < q4((15 - d) / 8.0) * 0.75:
                cv.set(x, y, {'N0': 'N1', 'N1': 'N2', 'N2': 'N3'}[k])
    cv.disc(MX, MY, 6.5, 'M2')
    cv.disc(MX, MY, 5.6, 'M1')
    cv.disc(MX + 3.2, MY - 1.6, 5.4, 'N1')
    for (x, y) in ((MX - 4, MY), (MX - 4, MY + 1), (MX - 3, MY + 3)):
        cv.set(x, y, 'M2')
    for i in range(55):
        x, y = rng.randrange(W), rng.randrange(38)
        if cv.get(x, y) in ('N0', 'N1', 'N2') and math.hypot(x - MX, y - MY) > 9:
            cv.set(x, y, 'M2' if i % 5 else 'M1')
    for (x, y) in ((18, 6), (88, 4), (124, 9)):
        cv.set(x, y, 'M1')
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            cv.set(x + d[0], y + d[1], 'N3')
    # a wisp of cloud under the moon
    for (cx, cy, hl) in ((60, 20, 26), (24, 27, 16), (100, 30, 14)):
        for x in range(cx - hl, cx + hl):
            u = (x - cx) / hl
            if 1 - u * u < 0.2:
                continue
            cv.set(x, cy, 'N2' if cy > 22 else 'N3')
            if abs(u) < 0.6:
                cv.set(x, cy - 1, 'N3' if cy < 25 else 'N2')
                cv.set(x + 3, cy + 1, 'N1')

    # ------------------------------------------------------------ far islands, a far light
    for (cx, w, h) in ((14, 18, 5), (70, 12, 3)):
        for x in range(cx - w, cx + w + 1):
            u = (x - cx) / w
            top = WL - int(h * (1 - u * u) ** 0.6 + nz(x / 3.0, 2) * 1.2)
            for y in range(top, WL):
                cv.set(x, y, 'N2')
            if (1 - u * u) ** 0.6 * h > 1.5:
                cv.set(x, top, 'R3' if x < cx else 'N2')
    cv.set(20, WL - 7, 'GH'); cv.vline(20, WL - 6, WL - 6, 'N2')

    # ------------------------------------------------------------ water
    bands(cv, [(WL, 'A3'), (WL + 2, 'A2'), (WL + 8, 'A1'), (WL + 18, 'A0')], y0=WL, tw=4)
    for y in range(WL + 1, H):
        d = y - WL
        for x in range(W):
            s = math.sin(x * 0.5 / (1 + d * 0.12) + d * 1.9) + 0.6 * nz(x / 5.0, y / 1.5)
            if s > 1.25 and y % 2 == 0:
                cv.set(x, y, 'A3' if d < 10 else 'A2')
    # the moon's path
    for y in range(WL, H):
        d = y - WL
        for x in range(MX - 16, MX + 17):
            s = hashf(x // 3, y, 9)
            if abs(x - MX) < 4 + d * 0.45 and s < 0.6 - d * 0.02 and y % 2 == 0:
                cv.set(x, y, 'M1' if d < 5 and s < 0.25 else ('M2' if d < 13 else 'A3'))
    cv.hline(0, 91, WL, 'A3')
    for x in range(MX - 5, MX + 6):
        cv.set(x, WL, 'M2')

    # ------------------------------------------------------------ the cliff
    cliff = set()
    r = random.Random(3)
    jag = smooth(mpd(r, 128, 3.0, 0.62), 1)
    for x in range(92, W):
        top = cliff_top(x) + jag[x - 92] * (0.4 + (x - 92) / 120.0)
        for y in range(int(round(top)), H):
            cliff.add((x, y))
    # the mouth of the cave: a ragged arch
    mouth = set()
    for y in range(CT - 2, H):
        for x in range(CX - 26, CX + 26):
            dx = x + 0.5 - CX
            hw = 20 + 2.2 * nz(y / 2.0, 5) + (y - CT) * 0.18
            yy = y + 0.5 - (CT + 14)
            if (yy >= 0 and abs(dx) <= hw) or (dx / hw) ** 2 + (yy / 14.5) ** 2 <= 1:
                mouth.add((x, y))
    cliff -= mouth
    U = run_u(cliff)
    for (x, y) in cliff:
        u = U[(x, y)]
        n = nz(x / 3.0, y / 4.0)
        k = 'R2'
        if n > 0.6:
            k = 'R3'
        elif n < 0.32:
            k = 'R1'
        if (y - int(x * 0.35)) % 7 == 0 and n > 0.52:
            k = 'R1' if k != 'R1' else 'R0'                    # bedding planes
        if (x - 1, y) not in cliff and x > 92:
            k = 'R4'                                           # moonlit seaward edges
        elif (x - 2, y) not in cliff:
            k = 'R3'
        if (x, y - 1) not in cliff:
            k = 'R4' if (x, y) not in mouth else k
        cv.set(x, y, k)
    # vertical cracks with a moonlit lip
    for (fx, y0, y1) in ((112, 30, 50), (124, 18, 42), (178, 10, 36), (186, 30, 60), (104, 40, 52)):
        for y in range(y0, y1):
            x = fx + int(round(1.4 * math.sin(y * 0.5 + fx)))
            if (x, y) in cliff:
                cv.set(x, y, 'R0')
                if (x - 1, y) in cliff:
                    cv.set(x - 1, y, 'R3')
    # grass on the cliff top, a few stunted pines leaning seaward
    for x in range(92, W):
        top = min((y for y in range(H) if (x, y) in cliff), default=None)
        if top is None:
            continue
        for i in range(1 + (hashf(x, 0, 3) < 0.5)):
            cv.set(x, top - i, 'G1')
        if hashf(x, 1, 3) < 0.15:
            cv.set(x, top - 2, 'G1')
    for (px, h) in ((170, 9), (176, 6), (184, 11)):
        top = min(y for y in range(H) if (px, y) in cliff)
        for i in range(h):
            hw = (h - i) * 0.4 if i > 2 else 0
            for xx in range(int(px - hw - 1), int(px + hw * 0.6) + 1):
                cv.set(xx - i // 3, top - i, 'R0' if i < 3 else 'G1')
        cv.set(px - h // 3, top - h, 'G1')
    # a lookout's hut on the clifftop, one window lit
    HX = 128
    ht = min(y for y in range(H) if (HX + 3, y) in cliff)
    cv.rect(HX, ht - 6, HX + 8, ht + 1, 'W2')
    cv.vline(HX, ht - 6, ht, 'W3')
    for i in range(6):
        cv.hline(HX - 1 + i, HX + 9 - i, ht - 7 - i, 'R2' if i else 'R3')
    cv.set(HX + 5, ht - 4, 'L4'); cv.set(HX + 6, ht - 4, 'L3'); cv.set(HX + 5, ht - 3, 'L3')
    cv.set(HX + 6, ht - 3, 'L2')
    cv.set(HX + 2, ht - 13, 'R2'); cv.set(HX + 2, ht - 14, 'R3')      # chimney
    light(cv, HX + 5.5, ht - 3.5, 6, 5, WARM, power=1.6, steps=2,
          pred=lambda x, y: cv.get(x, y) not in ('L3', 'L4'))

    # ------------------------------------------------------------ inside the cave: warm, receding
    for (x, y) in mouth:
        dx = abs(x + 0.5 - CX) / 22.0
        v = (y - CT) / 30.0
        g = 1 - min(1.0, math.hypot(dx * 0.9, (v - 0.7) * 1.3))
        k = 'R0'
        if g > 0.25:
            k = 'L0' if bay(x, y) < q4((g - 0.25) * 6) else 'R0'
        if g > 0.66:
            k = 'L1' if bay(x, y) < q4((g - 0.66) * 6) else 'L0'
        if y > JY + 2:
            k = 'A0' if bay(x, y) < 0.5 else 'R0'          # black water inside the cave
        cv.set(x, y, k)
    # inner rock ribs: the cave narrows inward
    for (ins, kk) in ((5, 'R1'), (10, 'L0')):
        for y in range(CT + ins, JY):
            for x in range(CX - 24, CX + 25):
                if (x, y) not in mouth:
                    continue
                dx = x + 0.5 - CX
                hw = 20 - ins * 1.1
                yy = y + 0.5 - (CT + 14)
                inside = (yy >= 0 and abs(dx) <= hw) or (dx / hw) ** 2 + (yy / (14.5 - ins * 0.8)) ** 2 <= 1
                if not inside and cv.get(x, y) in ('R0', 'L0', 'L1', 'L2'):
                    n = nz(x / 2.5, y / 3.0 + ins)
                    cv.set(x, y, kk if n > 0.3 else 'R0')
                    if n > 0.72 and kk == 'R1':
                        cv.set(x, y, 'R2')
    # the rim of the mouth, catching moon on the left, lantern light on the inside
    for (x, y) in mouth:
        for (dx_, dy_) in ((-1, 0), (1, 0), (0, -1)):
            q = (x + dx_, y + dy_)
            if q in cliff:
                cv.set(q[0], q[1], 'L1' if dx_ > 0 or dy_ < 0 else 'R3')
    # stalactites hanging from the crown
    for (sx, ln) in ((CX - 12, 4), (CX - 6, 6), (CX - 1, 3), (CX + 4, 5), (CX + 10, 4), (CX + 15, 3)):
        top = min(y for y in range(H) if (sx, y) in mouth)
        for i in range(ln):
            cv.set(sx, top + i, 'R1' if i < ln - 1 else 'L1')
            if i < ln // 2:
                cv.set(sx + 1, top + i, 'R1')
    # a back platform inside with its own lamp, crates and a figure
    cv.hline(CX - 8, CX + 12, 41, 'W3'); cv.hline(CX - 8, CX + 12, 42, 'W1')
    for px_ in (CX - 7, CX + 1, CX + 11):
        cv.vline(px_, 43, JY - 1, 'W1')
    cv.rect(CX + 5, 37, CX + 9, 41, 'W2'); cv.hline(CX + 5, CX + 8, 37, 'W3'); cv.vline(CX + 8, 38, 40, 'W1')
    cv.rect(CX - 6, 38, CX - 3, 41, 'W2'); cv.hline(CX - 6, CX - 4, 38, 'W3')
    cv.vline(CX + 2, 34, 40, 'R0'); cv.set(CX + 2, 33, 'R0'); cv.set(CX + 1, 36, 'R0'); cv.set(CX + 3, 36, 'R0')
    cv.set(CX + 1, 33, 'R0'); cv.set(CX + 3, 33, 'R0')                                  # a goblin, ears out
    # ------------------------------------------------------------ strings of lanterns across the mouth
    for (x0, y0, x1, y1, sag, gap, big) in ((CX - 21, CT + 9, CX + 21, CT + 7, 7, 6, True),
                                            (CX - 15, CT + 14, CX + 16, CT + 13, 4, 5, False)):
        pts = []
        for i in range(x1 - x0 + 1):
            t = i / float(x1 - x0)
            y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)
            pts.append((x0 + i, int(round(y))))
            cv.set(x0 + i, int(round(y)), 'W2' if big else 'W1')
        for i in range(gap // 2, len(pts) - 1, gap):
            x, y = pts[i]
            lantern(cv, x, y + 2, big)
    for (x0, y0, x1, y1, sag, gap, big) in ((CX - 21, CT + 9, CX + 21, CT + 7, 7, 6, True),):
        for i in range(gap // 2, x1 - x0, gap):
            t = i / float(x1 - x0)
            y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t) + 3
            light(cv, x0 + i + 0.5, y, 5, 4, WARM, power=1.8, steps=2,
                  pred=lambda x, y: cv.get(x, y) not in ('L3', 'L4'))

    # ------------------------------------------------------------ the jetty
    for x in range(108, CX + 14):
        cv.set(x, JY, 'W3' if x % 4 else 'W2')
        cv.set(x, JY + 1, 'W2')
        cv.set(x, JY + 2, 'W1')
    for px_ in range(110, CX + 14, 7):
        for y in range(JY + 3, H):
            if y < 66:
                cv.set(px_, y, 'W1')
                cv.set(px_ + 1, y, 'W2' if y < JY + 6 else 'W1')
    cv.vline(108, JY - 4, JY + 2, 'W2'); cv.set(108, JY - 5, 'W3')       # mooring post
    # crates and barrels stacked on the deck
    for (x, y, w, h) in ((126, JY - 5, 5, 5), (131, JY - 4, 4, 4), (127, JY - 9, 4, 4), (156, JY - 4, 5, 4)):
        cv.rect(x, y, x + w, y + h, 'W2')
        cv.hline(x, x + w - 1, y, 'W3'); cv.vline(x, y, y + h - 1, 'W3')
        cv.line(x, y + h - 1, x + w - 1, y, 'W1')
        cv.vline(x + w - 1, y + 1, y + h - 1, 'W1')
    for (bx, by) in ((119, JY - 1), (122, JY - 1), (120, JY - 5), (138, JY - 1)):
        for i, k in enumerate(('W3', 'W2', 'W2', 'W1')):
            cv.vline(bx + i, by - 3, by, k)
        cv.hline(bx, bx + 3, by - 2, 'R1'); cv.hline(bx, bx + 3, by, 'R1')
        cv.hline(bx + 1, bx + 2, by - 4, 'W3')
    # a lamp post at the end of the jetty
    cv.vline(114, JY - 9, JY - 1, 'W1'); cv.hline(114, 117, JY - 9, 'W1')
    lantern(cv, 117, JY - 7)
    light(cv, 117.5, JY - 6, 14, 10, WARM, power=1.3, steps=3, pred=lambda x, y: cv.get(x, y) not in ('L3', 'L4'))
    # a goblin hauling a crate and a tall smuggler with a hat
    gob = ["1...1",
           ".111.",
           ".101.",
           "..1..",
           ".111.",
           "1.1.1",
           ".1.1."]
    stamp(cv, 142, JY - 7, gob, {'1': 'R0', '0': 'L3'})
    cv.rect(146, JY - 6, 149, JY - 3, 'W2'); cv.hline(146, 148, JY - 6, 'W3')
    for (x, y) in ((135, JY - 12), (134, JY - 11), (135, JY - 11), (136, JY - 11), (137, JY - 11), (133, JY - 11),
                   (135, JY - 10), (134, JY - 9), (135, JY - 9), (136, JY - 9), (134, JY - 8), (135, JY - 8),
                   (136, JY - 8), (134, JY - 7), (135, JY - 7), (136, JY - 7), (134, JY - 6), (136, JY - 6),
                   (134, JY - 5), (136, JY - 5)):
        cv.set(x, y, 'R0')
    cv.set(137, JY - 8, 'R0'); cv.set(138, JY - 7, 'L4')                 # a pipe glowing
    # warm light pooled on the deck by the mouth
    light(cv, CX, JY, 20, 4, WARM, power=1.8, steps=2, pred=lambda x, y: cv.get(x, y) not in ('L3', 'L4'))

    # ------------------------------------------------------------ the sloop, moored in front
    SX0, SX1, SY = 82, 124, 60           # hull from bow (left) to stern (right), waterline
    hull = set()
    for x in range(SX0, SX1 + 1):
        t = (x - SX0) / float(SX1 - SX0)
        sheer = SY - 4 - 2.5 * (1 - t) ** 2 + 0.5 * t     # bow sweeps up
        keel = SY + 1 + 2.2 * math.sin(min(1.0, t * 1.4) * math.pi / 2) * (1 if t > 0.1 else t * 10)
        for y in range(int(round(sheer)), int(round(keel)) + 1):
            hull.add((x, y))
    for (x, y) in hull:
        k = 'W2'
        if (x, y - 1) not in hull:
            k = 'W3'                                      # rail
        elif (y - SY) % 2 == 0:
            k = 'W1'                                      # strakes
        if y >= SY:
            k = 'R0' if (x + y) % 2 else 'W1'
        cv.set(x, y, k)
    for x in range(SX0 + 6, SX1 - 1, 5):                  # ports
        cv.set(x, SY - 2, 'R0')
    cv.set(SX0 + 16, SY - 2, 'L3')                        # one glowing port
    cv.line(SX0, SY - 7, SX0 - 13, SY - 11, 'W2')        # bowsprit
    cv.set(SX0 - 1, SY - 6, 'W3')
    # mast, boom with the furled mainsail, stays
    MXs = 104
    cv.vline(MXs, 12, SY - 4, 'W2'); cv.vline(MXs + 1, 14, SY - 4, 'W1')
    cv.hline(MXs - 2, MXs + 2, 17, 'W2')                  # crosstree
    cv.line(MXs, SY - 9, SX1 + 4, SY - 11, 'W2')         # boom
    for x in range(MXs + 1, SX1 + 3):
        y = int(round(SY - 9 + (SY - 11 - (SY - 9)) * (x - MXs) / (SX1 + 4 - MXs)))
        cv.set(x, y - 1, 'CL' if x % 3 else 'M2')
        if (x // 2) % 3 == 0:
            cv.set(x, y - 2, 'CL')
    cv.line(MXs, 13, SX0 - 13, SY - 11, 'R3')            # forestay with the jib furled on it
    for i in range(0, 18):
        x = MXs - 2 - i * 2
        y = int(round(13 + (SY - 11 - 13) * (MXs - x) / float(MXs - SX0 + 13)))
        cv.set(x, y + 1, 'CL' if i % 2 else 'M2')
    cv.line(MXs + 1, 13, SX1, SY - 5, 'R2')              # backstay
    cv.line(MXs, 18, MXs - 7, SY - 4, 'R2'); cv.line(MXs + 1, 18, MXs + 8, SY - 4, 'R2')   # shrouds
    cv.set(MXs, 11, 'R3')
    # a pennant at the masthead
    for (dx, dy) in ((1, 0), (2, 0), (3, 1), (1, 1), (4, 1)):
        cv.set(MXs + dx, 12 + dy, 'L2')
    # stern lantern and mooring line to the post
    cv.vline(SX1 - 1, SY - 9, SY - 5, 'W1')
    lantern(cv, SX1, SY - 9)
    cv.line(SX1 - 2, SY - 4, 108, JY - 3, 'W1')
    light(cv, SX1 + 0.5, SY - 8, 10, 8, WARM, power=1.4, steps=3, pred=lambda x, y: cv.get(x, y) not in ('L3', 'L4'))
    # deck cargo and a sailor at the rail
    cv.rect(SX0 + 10, SY - 7, SX0 + 15, SY - 4, 'W2'); cv.hline(SX0 + 10, SX0 + 14, SY - 7, 'W3')
    cv.rect(SX0 + 15, SY - 6, SX0 + 18, SY - 4, 'W1'); cv.hline(SX0 + 15, SX0 + 17, SY - 6, 'W3')
    for (x, y) in ((116, SY - 12), (116, SY - 11), (115, SY - 10), (116, SY - 10), (117, SY - 10),
                   (116, SY - 9), (116, SY - 8), (115, SY - 7), (116, SY - 7), (117, SY - 7),
                   (115, SY - 6), (117, SY - 6), (115, SY - 5), (117, SY - 5)):
        cv.set(x, y, 'R0')
    cv.hline(114, 118, SY - 12, 'R0'); cv.hline(115, 117, SY - 13, 'R0')     # hat
    # a rowboat tied under the jetty
    for x in range(132, 146):
        cv.set(x, 57, 'W3' if x not in (132, 145) else 'W2')
        if 133 < x < 144:
            cv.set(x, 58, 'W1')
    cv.set(131, 56, 'W2'); cv.set(146, 56, 'W2')

    # ------------------------------------------------------------ reflections in the water
    for y in range(SY + 2, H):
        d = y - SY
        if y % 2 == 1:
            continue
        for x in range(SX0 + d // 2, SX1 - d // 3):
            if hashf(x // 2, y, 4) < 0.55:
                cv.set(x, y, 'R0' if hashf(x, y, 5) < 0.7 else 'W1')
    for (lx, ly0, wd, ln) in ((SX1, SY + 2, 2, 10), (117, JY + 6, 2, 12), (CX, JY + 4, 14, 16),
                              (SX0 + 16, SY + 2, 1, 6), (HX + 5, JY + 4, 1, 3)):
        for y in range(ly0, min(H, ly0 + ln)):
            if y % 2:
                continue
            d = y - ly0
            for x in range(lx - wd - d // 4, lx + wd + d // 4 + 1):
                s = hashf(x // 2, y, 7)
                if s < 0.7 - d * 0.035 and cv.get(x, y) in ('A0', 'A1', 'A2', 'A3', 'R0', 'W1', 'W2'):
                    cv.set(x, y, 'L4' if d < 3 and s < 0.2 else ('L3' if d < 7 else ('L2' if d < 12 else 'L1')))
    # the cave's water is lit from within
    light(cv, CX, JY + 5, 22, 8, {'A0': 'L0', 'A1': 'L0', 'A2': 'L1', 'A3': 'L1'}, power=2.0, steps=2)
    # cold moonlit glints on the near water
    for i in range(40):
        x, y = rng.randrange(0, 100), rng.randrange(WL + 4, H)
        if cv.get(x, y) in ('A0', 'A1', 'A2') and y % 2 == 0:
            cv.hline(x, x + 1 + i % 3, y, 'A3' if y > 58 else 'M2')
    # gulls asleep on the hut roof, a bat leaving the cave
    crow_fly(cv, 132, 14, 'R0', 2); crow_fly(cv, 140, 9, 'R0', 0)
    return cv
