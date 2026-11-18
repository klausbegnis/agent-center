"""Moonwake Abbey: a gothic abbey on a sea-cliff island under a huge full moon, stained glass
burning, a wolf howling on a rock spur against the moon, bats round the bell tower."""
import random, math
from engine import *

W, H = 192, 72
HZ = 47           # horizon
MX, MY, MR = 125, 24, 20.5   # the moon
TX = 141          # bell tower axis

PAL = {
    # night sky
    'K0': '#0a0a1c', 'K1': '#141433', 'K2': '#221f4b', 'K3': '#35306b', 'K4': '#524b8e',
    # moon
    'M0': '#7c7fb2', 'M1': '#a2a5cf', 'M2': '#cfd2ec', 'M3': '#f2f3ff',
    # sea
    'A0': '#070d1a', 'A1': '#0e1b2f', 'A2': '#192c48', 'A3': '#2b4368',
    # cliff rock
    'R0': '#07070e', 'R1': '#141328', 'R2': '#232140', 'R3': '#3b385f',
    # abbey stone
    'T1': '#1e1c36', 'T2': '#312e52', 'T3': '#4d4878',
    # stained glass and candle light
    'G1': '#7d1d3c', 'G2': '#d4543f', 'G3': '#ffb95e', 'G4': '#3ea8a2', 'G5': '#fff0bf',
    # cliff-top turf
    'C1': '#1a2f37',
}


def lancet(cv, x, y0, w, h, seed, rose=False):
    """A pointed window of stained glass: lead lines and a warm core."""
    for y in range(y0, y0 + h):
        for xx in range(x, x + w):
            dx = xx + 0.5 - (x + w / 2.0)
            top = y0 + (w / 2.0) * (1 - math.sqrt(max(0, 1 - (abs(dx) / (w / 2.0)) ** 2))) * 1.4
            if y + 0.5 < top:
                continue
            hsh = hashf(xx, y, seed)
            k = 'G3' if hsh < 0.38 else ('G2' if hsh < 0.7 else ('G1' if hsh < 0.88 else 'G4'))
            if (y - y0) % 3 == 0 or (w > 2 and xx == x + w // 2):
                k = 'T1'                                   # leading
            cv.set(xx, y, k)


def draw():
    cv = Cv(PAL, 'K0', W, H)
    nz = vnoise(83)
    rng = random.Random(41)

    # ------------------------------------------------------------ sky, halo and stars
    bands(cv, [(0, 'K0'), (14, 'K1'), (30, 'K2'), (42, 'K3')], y1=HZ, tw=4)
    light(cv, MX, MY, 58, 40, {'K0': 'K1', 'K1': 'K2', 'K2': 'K3', 'K3': 'K4'}, power=1.6, steps=4)
    light(cv, MX, MY, 30, 28, {'K2': 'K3', 'K3': 'K4', 'K1': 'K2'}, power=1.2, steps=3)
    for i in range(70):
        x, y = rng.randrange(W), rng.randrange(HZ - 6)
        if math.hypot(x - MX, y - MY) > MR + 14 and cv.get(x, y) in ('K0', 'K1', 'K2'):
            cv.set(x, y, 'M1' if i % 5 else 'M3')
            if i % 13 == 0:
                for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    cv.set(x + d[0], y + d[1], 'K3')
    # ------------------------------------------------------------ the moon
    for y in range(int(MY - MR) - 1, int(MY + MR) + 2):
        for x in range(int(MX - MR) - 1, int(MX + MR) + 2):
            dx, dy = (x + 0.5 - MX) / MR, (y + 0.5 - MY) / MR
            d = math.hypot(dx, dy)
            if d > 1:
                continue
            k = 'M2'
            limb = d + 0.25 * dx - 0.15 * dy
            if limb > 0.92:
                k = 'M1' if bay(x, y) < q4((limb - 0.92) * 6) else 'M2'
            elif limb < 0.55 and dx < 0.2:
                k = 'M3' if bay(x, y) < q4((0.55 - limb) * 2.2) else 'M2'
            mar = nz(x / 5.0, y / 5.0) + 0.5 * nz(x / 2.0 + 9, y / 2.0)
            if mar > 1.02:
                k = 'M0' if mar > 1.16 else 'M1'
            cv.set(x, y, k)
    for (cx, cy, r) in ((MX - 7, MY + 6, 2.2), (MX + 5, MY - 8, 1.6), (MX - 11, MY - 4, 1.2)):
        cv.disc(cx, cy, r, 'M1'); cv.set(cx - 1, cy - 1, 'M0'); cv.set(cx + 1, cy + 1, 'M3')
    # long thin clouds drawn across the moon and sky
    for (cx, cy, hl, th) in ((96, 17, 34, 1.6), (150, 30, 30, 1.4), (40, 12, 30, 1.6), (176, 9, 18, 1.2),
                             (66, 34, 22, 1.0)):
        for x in range(int(cx - hl), int(cx + hl) + 1):
            u = (x - cx) / hl
            t = th * (1 - u * u) ** 0.6 + 0.5 * math.sin(x * 0.6 + cy)
            if t <= 0.5:
                continue
            for y in range(int(round(cy - t * 0.5)), int(round(cy + t * 0.5)) + 1):
                onm = math.hypot(x - MX, y - MY) < MR
                cv.set(x, y, 'M1' if onm else ('K3' if cv.get(x, y) in ('K3', 'K4') else 'K2'))
            yb = int(round(cy + t * 0.5)) + 1
            if math.hypot(x - MX, yb - MY) < MR + 6:
                cv.set(x, yb, 'M2' if math.hypot(x - MX, yb - MY) < MR else 'K4')

    for x in range(0, 100):
        u = x / 100.0
        cy = 8 + 3 * math.sin(x / 13.0)
        th = 2.5 + 2.5 * nz(x / 7.0, 2.0)
        for y in range(int(cy - th), int(cy + th * 0.5) + 1):
            cv.set(x, y, 'K1')
        cv.set(x, int(cy + th * 0.5) + 1, 'K3' if x > 50 else 'K2')
        if nz(x / 4.0, 8.0) > 0.45:
            cv.set(x, int(cy - th), 'K3' if x > 40 else 'K2')
    # ------------------------------------------------------------ far isles
    for (cx, hw, ht, k) in ((18, 20, 7, 'K1'), (62, 13, 4, 'K2'), (184, 12, 4, 'K2')):
        for x in range(cx - hw, cx + hw + 1):
            u = (x - cx) / hw
            top = HZ - ht * (1 - u * u) ** 0.6 - 1.5 * nz(x / 3.0, 5.0)
            for y in range(int(round(top)), HZ):
                cv.set(x, y, k)
    # a ruined watchtower on the far left isle with a ghost-light
    cv.rect(14, HZ - 13, 17, HZ - 6, 'K1'); cv.set(14, HZ - 14, 'K1'); cv.set(16, HZ - 15, 'K1')
    cv.set(15, HZ - 11, 'G4')

    # ------------------------------------------------------------ sea and the silver moon path
    bands(cv, [(HZ, 'A3'), (HZ + 2, 'A2'), (HZ + 8, 'A1'), (HZ + 17, 'A0')], y0=HZ, tw=4)
    for y in range(HZ, H):
        d = y - HZ
        for x in range(W):
            hw = 7 + d * 0.55
            seg = hashf(x // (2 + d // 5), y, 12)
            if abs(x - MX) < hw and (y % 2 == 0 or d < 2):
                c = abs(x - MX) / hw
                if seg < 0.75 - c * 0.6:
                    k = 'M3' if (d < 4 and c < 0.4) else ('M2' if c < 0.35 + 0.2 * (d < 8) else 'M1')
                    if d > 16 and k == 'M2':
                        k = 'M1'
                    if c > 0.75:
                        k = 'A3'
                    cv.set(x, y, k)
            elif d < 20 and seg < 0.12 and y % 2 == 1:
                cv.set(x, y, 'A3' if d < 9 else 'A2')
    cv.hline(0, W - 1, HZ, 'A3')
    for x in range(MX - 10, MX + 11):
        cv.set(x, HZ, 'M2' if abs(x - MX) < 7 else 'M1')

    # ------------------------------------------------------------ a drowned ship's masts, ghost-lit
    for (mx, top_, lean) in ((62, 30, 0.12), (74, 34, -0.08)):
        for y in range(top_, HZ + 3):
            x = mx + (y - top_) * lean
            cv.set(x, y, 'R1')
        for (yy, hw) in ((top_ + 4, 5), (top_ + 9, 6)):         # broken yards
            x = mx + (yy - top_) * lean
            cv.line(x - hw, yy + 1, x + hw, yy - 1, 'R1')
        x = mx + 6 * lean
        for y in range(top_ + 5, top_ + 12):                    # a rag of sail
            for xx in range(int(x) + 1, int(x) + 4 - (y - top_ - 5) // 3):
                if hashf(xx, y, 3) < 0.7:
                    cv.set(xx, y, 'K3' if (xx + y) % 2 else 'A3')
    for (x, y) in ((60, 33), (77, 37), (68, 44)):
        light(cv, x + 0.5, y + 0.5, 4, 3.5, {'K1': 'K2', 'K2': 'K3', 'K3': 'K4', 'R1': 'G4', 'A2': 'G4',
                                             'A3': 'G4', 'A1': 'A2'}, power=1.2, steps=2)
        cv.set(x, y, 'M3')
    for y in range(HZ + 3, HZ + 12, 2):                         # their reflections
        cv.hline(61, 63, y, 'A3'); cv.set(73, y + 1, 'A3')
    cv.set(68, HZ + 2, 'G4'); cv.set(68, HZ + 4, 'G4'); cv.set(60, HZ + 6, 'G4')

    # ------------------------------------------------------------ the island cliff
    CL = 133                                                   # foot of the left face
    cliff = set()
    top = {}
    for x in range(CL, W):
        u = x - CL
        t = 33 - 1.5 * nz(x / 6.0, 1.0) + max(0, 7 - u) ** 1.4 * 1.6
        top[x] = int(round(t))
    for x in range(CL, W):
        bot = 57 + int(1.5 * nz(x / 4.0, 3.0))
        for y in range(top[x], bot):
            cliff.add((x, y))
    # the cliff face leans out a little lower down
    for y in range(44, 58):
        for x in range(CL - int((y - 44) * 0.35), CL):
            cliff.add((x, y))
    U = run_u(cliff)
    for (x, y) in cliff:
        u = U[(x, y)]
        lvl = 3.0 - u * 4.2 + 0.9 * nz(x / 3.0, y / 2.0) - max(0, y - 50) * 0.12       # moonlit left face, then shadow
        lo = max(0, min(3, int(lvl)))
        if lvl - int(lvl) > 0.5 and (x + y) % 2 == 0 and lo < 3:
            lo += 1
        k = ('R0', 'R1', 'R2', 'R3')[lo]
        if lo == 0 and nz(x / 4.0, y / 4.0) > 0.42:
            k = 'R1'
        st = (y + int(x * 0.12)) % 5 == 0 and nz(x / 3.0, y) > 0.4
        if st:
            k = {'R3': 'R2', 'R2': 'R1', 'R1': 'R0', 'R0': 'R0'}[k]
            if (x, y - 1) in cliff:
                cv.set(x, y - 1, {'R0': 'R1', 'R1': 'R2', 'R2': 'R3'}.get(cv.get(x, y - 1), 'R3'))
        if (x - 1, y) not in cliff:
            k = 'R3'
        cv.set(x, y, k)
    for x in range(CL, W):                                     # turf on the cliff top
        cv.set(x, top[x], 'C1')
        if hashf(x, 2, 5) < 0.5:
            cv.set(x, top[x] - 1, 'C1')
        if x < CL + 30 and hashf(x, 1, 5) < 0.4:
            cv.set(x, top[x], 'R3')
    # sea caves and surf at the foot
    for (cx, cy, rw) in ((158, 54, 3), (176, 53, 4)):
        for y in range(cy - rw, cy + 4):
            for x in range(cx - rw, cx + rw + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 * 1.4 <= rw * rw:
                    cv.set(x, y, 'R0')
    for x in range(CL - 6, W):
        b = 57 + int(1.5 * nz(x / 4.0, 3.0))
        if hashf(x, 4, 9) < 0.7:
            cv.set(x, b, 'M2' if hashf(x, 5, 9) < 0.4 else 'M1')
        if hashf(x, 6, 9) < 0.3:
            cv.set(x + 1, b + 1, 'A3')
    # a stair cut up the cliff with lanterns
    for i in range(14):
        x = CL + 3 + i * 2
        y = 55 - i * 1.4
        cv.set(x, y, 'R3'); cv.set(x + 1, y, 'R2'); cv.set(x, y + 1, 'R0'); cv.set(x + 1, y + 1, 'R0')
    for (x, y) in ((CL + 4, 52), (CL + 20, 42)):
        cv.set(x, y, 'G5'); cv.set(x, y + 1, 'G3')
        light(cv, x + 0.5, y + 0.5, 5, 4, {'R1': 'R2', 'R2': 'R3', 'R0': 'R1'}, power=1.4, steps=2)

    # ------------------------------------------------------------ the abbey
    BT = 33                                                    # abbey ground line
    NX0, NX1, NT = 154, 184, 19
    for y in range(NT, BT + 1):
        for x in range(NX0, NX1 + 1):
            row = (y - NT) // 3
            joint = (y - NT) % 3 == 2 or (x + row * 3) % 7 == 0
            cv.set(x, y, 'T1' if joint else 'T2')
    # roof: steep slate with a moonlit ridge, broken open at the far end
    roof = m_poly([(NX0 - 1, NT + 0.5), (NX0 + 6, NT - 8.5), (NX1 - 5, NT - 8.5), (NX1 + 2, NT + 0.5)])
    hole = m_poly([(171, NT - 9), (180, NT - 9), (183, NT - 1), (176, NT - 3), (173, NT - 6)])
    for (x, y) in roof:
        if (x, y) in hole:
            continue
        k = 'T1' if y % 2 else 'R1'
        if (x, y - 1) not in roof:
            k = 'M1'
        elif (x + 1, y) in roof and (x - 1, y) not in roof:
            k = 'T3'
        elif y % 2 and (x + (y // 2) * 2) % 4 == 0:
            k = 'T2'
        cv.set(x, y, k)
    for x in (174, 177, 180):                                  # bare rafters
        cv.line(x - 1, NT - 8, x + 1, NT - 1, 'R0')
    cv.hline(172, 182, NT - 8, 'R1')
    # buttresses with pinnacles
    for bx in (162, 170, 178):
        for y in range(NT - 1, BT + 1):
            w = 1 + max(0, (y - NT)) // 5
            for x in range(bx - w, bx + 1):
                cv.set(x, y, 'T3' if x == bx - w else 'T2')
        cv.vline(bx, NT - 4, NT - 1, 'T2'); cv.set(bx, NT - 5, 'R1'); cv.set(bx - 1, NT - 2, 'T3')
    # lancets along the nave
    for i, wx in enumerate((156, 164, 172)):
        cv.rect(wx - 1, NT + 2, wx + 5, BT - 2, 'T1')
        lancet(cv, wx, NT + 3, 4, 10, 7 + i)
    for wx in (156, 164, 172):
        light(cv, wx + 2, NT + 9, 7, 9, {'T2': 'T3', 'T1': 'T2'}, power=1.6, steps=2,
              pred=lambda x, y: cv.get(x, y) in ('T1', 'T2'))
    # west front with the great rose window
    WX0, WX1, WT = 146, 156, 11
    front = m_poly([(WX0, BT + 0.5), (WX0, WT + 6), (151, WT - 2), (WX1 + 1, WT + 6), (WX1 + 1, BT + 0.5)])
    for (x, y) in front:
        row = (y - WT) // 3
        joint = (y - WT) % 3 == 2 or (x + row * 3) % 6 == 0
        k = 'T2' if not joint else 'T1'
        if (x - 1, y) not in front or (x, y - 1) not in front and x < 151:
            k = 'M1' if y < 24 else 'T3'                       # moon rim
        elif x in (WX0 + 1, WX0 + 2):
            k = 'T3' if not joint else 'T2'
        cv.set(x, y, k)
    RX, RY = 151.5, 19.5
    cv.disc(RX, RY, 4.3, 'T1')
    for y in range(int(RY - 4), int(RY + 5)):
        for x in range(int(RX - 4), int(RX + 5)):
            dx, dy = x + 0.5 - RX, y + 0.5 - RY
            d = math.hypot(dx, dy)
            if d > 3.5:
                continue
            a = math.atan2(dy, dx)
            if d < 1.1:
                k = 'G5'
            elif int((a + math.pi) / (math.pi / 4)) % 2 == 0:
                k = 'G2' if d > 2.3 else 'G3'
            else:
                k = 'G1' if d > 2.3 else 'G4'
            cv.set(x, y, k)
    # the great door, ajar, with candle-light
    cv.rect(148, BT - 7, 155, BT + 1, 'T1')
    for y in range(BT - 6, BT + 1):
        for x in range(149, 154):
            if y == BT - 6 and x not in (151,):
                continue
            if y == BT - 5 and x in (149, 153):
                continue
            cv.set(x, y, 'G3' if x in (151, 152) else ('G2' if x == 150 else 'R0'))
    cv.set(151, BT, 'G5'); cv.set(151, BT - 1, 'G5')
    light(cv, 151, BT + 1, 9, 4, {'C1': 'G1', 'R3': 'G2', 'R2': 'G1', 'T3': 'G2'}, power=1.2, steps=2)
    # ------------------------------------------------------------ the bell tower, in front of the moon
    TT = 6
    for y in range(TT, BT + 1):
        for x in range(TX - 4, TX + 5):
            u = (x - (TX - 4)) / 8.0
            row = (y - TT) // 3
            joint = (y - TT) % 3 == 2 or (x + row * 2) % 5 == 0
            k = 'T2' if u < 0.5 else 'T1'
            if joint:
                k = 'T1' if k == 'T2' else 'R1'
            if x == TX - 4:
                k = 'M2' if y < 24 else 'T3'
            elif x == TX - 3 and not joint:
                k = 'T3'
            cv.set(x, y, k)
    for (y0, dx) in ((22, -5), (28, -6)):                      # stepped corner buttresses
        cv.vline(TX + dx, y0, BT, 'M0' if y0 == 22 else 'T3'); cv.vline(TX + dx + 1, y0, BT, 'T2')
        cv.set(TX + dx + 1, y0 - 1, 'T3')
    # belfry: an open arch with the bell hanging, lit from within
    for y in range(TT + 3, TT + 11):
        for x in range(TX - 2, TX + 3):
            dx = x + 0.5 - (TX + 0.5)
            if y < TT + 5 and abs(dx) > (y - TT - 2) * 1.3:
                continue
            cv.set(x, y, 'G1' if y < TT + 6 else 'G2')
    cv.hline(TX - 1, TX + 1, TT + 6, 'G3'); cv.hline(TX - 1, TX + 2, TT + 7, 'G3')
    cv.set(TX, TT + 5, 'G5'); cv.hline(TX - 2, TX + 2, TT + 8, 'R0')
    cv.set(TX, TT + 4, 'R0'); cv.set(TX + 1, TT + 4, 'R0')
    cv.hline(TX - 4, TX + 4, TT + 11, 'T3')
    cv.vline(TX + 1, TT + 16, TT + 19, 'G3'); cv.set(TX + 1, TT + 15, 'G1')   # a lit slit
    for (x, h) in ((TX - 4, 3), (TX + 4, 3)):
        cv.vline(x, TT - h, TT, 'T2'); cv.set(x, TT - h - 1, 'R1')
    cv.hline(TX - 4, TX + 4, TT, 'T3')
    for y in range(TT - 13, TT):
        hw = (y - (TT - 13)) * 0.3
        for x in range(int(round(TX - hw)), int(round(TX + hw)) + 1):
            cv.set(x, y, 'M1' if x < TX else 'R1')
    cv.vline(TX, 0, TT - 13, 'R1')
    # ------------------------------------------------------------ the roofless choir: broken arches
    for (ax, ah) in ((186, 16), (191, 12)):
        for y in range(BT - ah, BT + 1):
            cv.set(ax, y, 'T2'); cv.set(ax + 1, y, 'T1'); cv.set(ax - 1, y, 'M0' if y < BT - 4 else 'T3')
    for i in range(5):
        a = math.pi * (i / 6.0)
        cv.set(188.5 + 3 * math.cos(math.pi - a), BT - 16 - 3 * math.sin(a), 'T2')
    cv.hline(184, 192, BT, 'T1')
    # graveyard on the cliff edge, a ghost drifting among the stones
    for (gx, gh) in ((138, 3), (142, 2), (188, 3)):
        tp = top.get(gx, 34)
        cv.vline(gx, tp - gh, tp - 1, 'T3'); cv.set(gx + 1, tp - gh + 1, 'T2')
    cv.vline(140, top[140] - 5, top[140] - 1, 'T3'); cv.hline(139, 141, top[140] - 4, 'T3')
    GX0, GY0 = 185, 21
    ghost = ["..33..", ".3443.", ".3443.", "334433", ".3333.", "..3.3.", ".3...3"]
    for gy, row in enumerate(ghost):
        for gx, ch in enumerate(row):
            if ch == '.':
                continue
            if gy > 4 and bay(GX0 + gx, GY0 + gy) > 0.5:
                continue
            cv.set(GX0 + gx, GY0 + gy, 'G4' if ch == '3' else 'M3')
    light(cv, GX0 + 3, GY0 + 4, 7, 7, {'K2': 'K3', 'K3': 'K4', 'R1': 'R2', 'C1': 'G4', 'T2': 'T3',
                                       'M2': 'M3', 'M1': 'M2'}, power=1.5, steps=2)

    # ------------------------------------------------------------ the wolf's rock spur against the moon
    spur = set()
    for y in range(37, 60):
        t = (y - 37) / 23.0
        xl = 112 - 1 - 6 * t ** 0.8 - 1.2 * nz(y / 2.0, 1.0)
        xr = 112 + 3 + 5 * t ** 1.3 + 1.2 * nz(y / 2.0, 6.0)
        for x in range(int(round(xl)), int(round(xr)) + 1):
            spur.add((x, y))
    U2 = run_u(spur)
    for (x, y) in spur:
        u = U2[(x, y)]
        k = 'R2' if u < 0.3 else ('R1' if u < 0.75 else 'R0')
        if (x - 1, y) not in spur:
            k = 'R3'
        elif (y + x // 2) % 5 == 0 and k != 'R0':
            k = 'R0'
        cv.set(x, y, k)
    for x in range(102, 124):
        if hashf(x, 8, 2) < 0.6:
            cv.set(x, 60 + (x % 3 == 0), 'M1' if x % 2 else 'M2')
    wolf = ["1...........",
            ".11.........",
            "..111.1.....",
            "...11111....",
            "....1111....",
            "....11111...",
            "....111111..",
            "...1111111..",
            "...11111111.",
            "...111111111",
            "...11.111111",
            "...11.1111.1",
            "..111111111."]
    WX, WY = 107, 26
    stamp(cv, WX, WY, wolf, {'1': 'R0'})
    cv.set(WX + 2, WY + 2, 'R0')
    cv.set(WX + 5, WY + 6, 'M3')                                       # moonlit fur on the chest

    # ------------------------------------------------------------ bats
    for (x, y, p) in ((131, 3, 0), (144, 8, 1), (150, 2, 2), (126, 12, 1), (158, 6, 0), (106, 8, 2),
                      (98, 22, 0), (162, 12, 1)):
        crow_fly(cv, x, y, 'R0', p)
        cv.set(x, y + 1, 'R0')

    # ------------------------------------------------------------ reflections under the island
    for y in range(58, H):
        if y % 2:
            continue
        d = y - 58
        for (x0, x1, k) in ((150, 153, 'G3'), (142, 144, 'G2'), (156, 160, 'G2'), (164, 168, 'G2'),
                            (134, 192, 'R1')):
            for x in range(x0, x1):
                if hashf(x // 2, y, 4) < 0.6 - d * 0.04 and (k != 'R1' or cv.get(x, y) in ('A1', 'A2', 'A3')):
                    cv.set(x, y, k if d < 7 else ('G1' if k.startswith('G') else 'A0'))
    # a rowing boat with a lamp, dark against the moon path
    BX, BY = 124, 65
    for x in range(BX - 5, BX + 6):
        cv.set(x, BY, 'R0'); cv.set(x, BY + 1, 'R0' if abs(x - BX) < 4 else 'A1')
    cv.vline(BX + 1, BY - 4, BY - 1, 'R0'); cv.set(BX, BY - 3, 'R0'); cv.set(BX, BY - 2, 'R0')
    cv.set(BX + 2, BY - 2, 'R0'); cv.set(BX + 1, BY - 5, 'R0')
    cv.vline(BX - 4, BY - 7, BY - 1, 'R0'); cv.set(BX - 5, BY - 7, 'G5'); cv.set(BX - 5, BY - 6, 'G3')
    cv.line(BX + 3, BY - 1, BX + 8, BY + 3, 'R0')
    for x in range(BX - 7, BX + 8):
        if x % 2 == 0:
            cv.set(x, BY + 2, 'M2')
    return cv
