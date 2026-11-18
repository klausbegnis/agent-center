"""Saltreach Lighthouse: a ruined lighthouse on a sea stack at stormy dusk, its lamp burning
ghost-green, a beam across the waves, a wreck on the rocks below and a dead keeper on the stair."""
import random, math
from engine import *

W, H = 192, 72
WL = 47          # horizon
LX = 150         # tower axis
LY = 10          # lamp centre
TT = 17          # top of the tower shaft (gallery)
TB = 45          # foot of the tower, top of the stack

PAL = {
    # storm sky at dusk, top to the amber gash on the horizon
    'K0': '#0a0d1c', 'K1': '#121731', 'K2': '#1d2244', 'K3': '#2e2f58', 'K4': '#4a3d68',
    'K5': '#7c4d6a', 'K6': '#c47a5e', 'K7': '#f4c27a',
    # sea, deep teal
    'A0': '#050f16', 'A1': '#0a1d28', 'A2': '#11303d', 'A3': '#1b4a55', 'A4': '#337377',
    'F1': '#86bdb6', 'F2': '#e2f7ef',
    # rock of the stack, warm rim from the sunset on the left
    'R0': '#08090f', 'R1': '#15161f', 'R2': '#252532', 'R3': '#3b384a', 'R4': '#5f5568',
    # tower stone
    'T1': '#4a4256', 'T2': '#6d6276', 'T3': '#9a8a94', 'T4': '#d9b9a0',
    # ghost-light
    'G1': '#1a5448', 'G2': '#38b483', 'G3': '#9cf7c6', 'G4': '#effff3',
    # wreck timber
    'W1': '#2b1f1e', 'W2': '#4b3429', 'W3': '#7a573a',
}

STEP = {'K0': 'K1', 'K1': 'K2', 'K2': 'K3', 'K3': 'K4', 'K4': 'K5', 'K5': 'K6', 'K6': 'K7'}
SKY = ('K0', 'K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7')
DARKER = {'R4': 'R3', 'R3': 'R2', 'R2': 'R1', 'R1': 'R0', 'R0': 'R0', 'T4': 'R4'}


def tower_hw(y):
    return 3.8 + (y - TT) * 0.095


def stack_edges(y, le, re_):
    """Left and right edge of the sea stack at row y."""
    t = (y - TB + 2) / (H - TB + 2)
    xl = LX - 12 - 14 * t ** 1.3 + le[y]
    xr = LX + 11 + 24 * t ** 1.1 + re_[y]
    return xl, xr


def draw():
    cv = Cv(PAL, 'K0', W, H)
    nz = vnoise(71)

    # ------------------------------------------------------------ sky
    bands(cv, [(0, 'K0'), (8, 'K1'), (17, 'K2'), (27, 'K3'), (35, 'K4'), (40, 'K5'), (44, 'K6')],
          y1=WL, tw=4, wave=lambda x: -3 * math.exp(-((x - 36) / 40.0) ** 2))
    # the amber gash where the sun went down
    for x in range(0, 110):
        g = math.exp(-((x - 34) / 30.0) ** 2)
        for y in range(WL - 1 - int(3 * g), WL):
            cv.set(x, y, 'K7' if g > 0.55 and y >= WL - 2 else 'K6')
    # heavy storm clouds: dark bodies, bellies lit amber near the sunset, violet elsewhere
    r3 = random.Random(9)
    for (cx, cy, n, spread, rr) in ((30, 32, 7, 30, 4.0), (92, 36, 6, 26, 3.2), (70, 11, 9, 40, 6.5),
                                    (150, 3, 10, 40, 6), (180, 26, 6, 16, 4.5), (12, 15, 5, 16, 5)):
        blobs = [(cx + r3.uniform(-spread, spread), cy + r3.uniform(-2, 2), rr * r3.uniform(0.7, 1.2))
                 for _ in range(n)]
        m = set()
        for (bx, by, br) in blobs:
            m |= m_ell(bx, by, br * 1.5, br)
        for (x, y) in m:
            if not (0 <= x < W and 0 <= y < WL - 2):
                continue
            warm = math.exp(-((x - 34) / 46.0) ** 2)
            k = 'K1' if y < 20 else 'K2'
            if (x, y - 1) not in m:
                k = 'K3' if y > 18 else 'K2'
            if (x, y + 1) not in m or (x, y + 2) not in m:
                if warm > 0.4 and y > 22:
                    k = 'K6' if (x, y + 1) not in m and warm > 0.7 else 'K5'
                elif y > 22:
                    k = 'K4'
                else:
                    k = 'K3'
            cv.set(x, y, k)
    # rain curtains hanging off the far clouds
    for x in range(78, 128):
        if hashf(x // 2, 0, 3) < 0.55:
            continue
        for y in range(38, WL):
            if (x + y // 2) % 3 == 0 and bay(x, y) < 0.6:
                k = cv.get(x, y)
                if k in STEP and k not in ('K6', 'K7'):
                    cv.set(x, y, STEP[k])
    # far islets on the horizon, one with a broken sea arch
    for (cx, w, h) in ((14, 16, 4), (62, 10, 3), (106, 20, 5)):
        for x in range(cx - w, cx + w + 1):
            u = (x - cx) / w
            top = WL - int(h * (1 - u * u) ** 0.7 + 0.6 * nz(x / 3.0, 1))
            for y in range(top, WL):
                cv.set(x, y, 'R1' if cx > 40 else 'K4')
    for (x, y) in ((104, WL - 6), (105, WL - 7), (105, WL - 6), (112, WL - 6), (113, WL - 7)):
        cv.set(x, y, 'R1')                                # little needles off the islet

    # ------------------------------------------------------------ sea
    bands(cv, [(WL, 'A3'), (WL + 3, 'A2'), (WL + 9, 'A1'), (WL + 18, 'A0')], y0=WL, tw=4)
    for y in range(WL, H):
        d = y - WL
        f = 0.55 / (1 + d * 0.16)
        ph = d * 1.7
        for x in range(W):
            s = math.sin(x * f + ph + 1.6 * math.sin(x * 0.05 + d)) + 0.5 * nz(x / 6.0, y / 2.0)
            if s > 1.15:
                cv.set(x, y, 'A4' if d > 2 else 'F1')
                if d > 9 and s > 1.32 and hashf(x, y, 5) < 0.5:
                    cv.set(x, y, 'F1')
                if d > 4:
                    cv.set(x, y + 1, 'A1' if d < 14 else 'A0')
            elif s < -0.8 and d > 4:
                cv.set(x, y, 'A0' if d > 8 else 'A1')
    # the sunset's glint on the swells
    for y in range(WL, WL + 12):
        d = y - WL
        for x in range(0, 90):
            g = math.exp(-((x - 34) / (18 + d * 1.5)) ** 2)
            if y % 2 == 0 and hashf(x // 3, y, 2) < g * (0.8 - d * 0.06):
                cv.set(x, y, 'K7' if d < 3 and g > 0.7 else ('K6' if d < 7 else 'K5'))
    cv.hline(0, W - 1, WL, 'A4')
    for x in range(10, 64):
        cv.set(x, WL, 'K6' if abs(x - 34) < 18 else 'K5')

    # ------------------------------------------------------------ the beam
    s0, s1 = 0.17, 0.40                  # slopes of the beam's edges, going left
    sc_ = (s0 + s1) / 2
    for y in range(0, WL):
        for x in range(0, LX - 3):
            dx = LX - x
            s = (y - LY) / dx
            if not (s0 < s < s1):
                continue
            t = 1 - abs(s - sc_) / ((s1 - s0) / 2)
            I = (t ** 0.35) * max(0.0, 1 - dx / 200.0) ** 0.7
            k = cv.get(x, y)
            if k not in SKY:
                continue
            if I > 0.66 and dx < 60:
                cv.set(x, y, 'G2' if bay(x, y) < q4((I - 0.66) * 3) else 'G1')
            elif I > 0.42:
                cv.set(x, y, 'G1' if bay(x, y) < q4((I - 0.42) * 4.2) else STEP.get(STEP.get(k, k), k))
            elif I > 0.12 and bay(x, y) < q4((I - 0.12) * 3.3):
                cv.set(x, y, STEP.get(k, k))
    # where the beam lands: a pool of ghost-light on the swells
    for y in range(WL + 1, WL + 13):
        for x in range(10, 112):
            u = (x - 60) / 44.0
            v = (y - WL - 5) / 7.0
            d = u * u + v * v
            if d >= 1:
                continue
            t = 1 - d
            k = cv.get(x, y)
            if k in ('A4', 'F1'):
                cv.set(x, y, 'G3' if t > 0.55 else 'G2')
            elif k in ('A3', 'A2') and bay(x, y) < q4(t * 1.4):
                cv.set(x, y, 'G1' if t > 0.4 else 'A4')
            elif k in ('A1', 'A0') and bay(x, y) < q4(t):
                cv.set(x, y, 'A3')
    # a ghost ship riding the horizon inside the beam
    GSX = 74
    for (x0, x1, y) in ((GSX - 7, GSX + 8, WL - 1), (GSX - 5, GSX + 6, WL)):
        cv.hline(x0, x1, y, 'G1')
    cv.hline(GSX - 8, GSX + 8, WL - 2, 'G2'); cv.set(GSX - 9, WL - 3, 'G2')
    cv.hline(GSX + 5, GSX + 8, WL - 3, 'G2')
    for (mx, mh) in ((GSX - 3, 11), (GSX + 2, 13), (GSX + 6, 8)):
        cv.vline(mx, WL - 2 - mh, WL - 3, 'G2')
        for j in range(2, mh - 1, 3):                  # rags of sail
            for i in range(-2 + (j % 2), 3):
                if hashf(mx + i, j, 4) < 0.65:
                    cv.set(mx + i, WL - 2 - mh + j, 'G1' if i else 'G2')
    cv.set(GSX + 2, WL - 16, 'G3')

    # ------------------------------------------------------------ the sea stack
    r = random.Random(13)
    le = smooth(mpd(r, 128, 2.5, 0.65), 1)
    re_ = smooth(mpd(r, 128, 2.5, 0.65), 1)
    stack = set()
    for y in range(TB - 2, H):
        xl, xr = stack_edges(y, le, re_)
        for x in range(int(round(xl)), int(round(xr)) + 1):
            stack.add((x, y))
    U = run_u(stack)
    for (x, y) in stack:
        u = U[(x, y)]
        u += (nz(x / 4.0, y / 6.0) - 0.5) * 0.25
        k = 'R4' if u < 0.12 else ('R3' if u < 0.3 else ('R2' if u < 0.55 else ('R1' if u < 0.85 else 'R0')))
        if (y + int(x * 0.5)) % 5 == 0 and nz(x / 3.0, y / 3.0) > 0.42:
            k = DARKER[k]
        cv.set(x, y, k)
    # strata ledges: a lit lip over a dark shadow
    for (ly, x0, x1) in ((50, -10, 6), (55, -16, 2), (59, -6, 16), (63, -20, -6), (52, 6, 18)):
        for x in range(LX + x0, LX + x1):
            yy = ly + int(round((x - LX) * 0.12 + nz(x / 3.0, ly) * 1.4))
            if (x, yy) in stack and (x, yy + 1) in stack:
                cv.set(x, yy, 'R4' if x < LX - 4 else 'R3')
                cv.set(x, yy + 1, 'R0')
    # fissures
    for (fx, fy0, fy1) in ((LX - 3, 47, 58), (LX + 8, 49, 66), (LX - 12, 57, 68)):
        for y in range(fy0, fy1):
            x = fx + int(round(1.5 * math.sin(y * 0.6 + fx)))
            if (x, y) in stack:
                cv.set(x, y, 'R0')
                if (x - 1, y) in stack and x < LX + 4:
                    cv.set(x - 1, y, 'R3')
    # the sunset rim on the seaward edge and the top
    for (x, y) in stack:
        if (x - 1, y) not in stack and y < 66:
            cv.set(x, y, 'T4' if y < 54 else 'R4')
            if (x + 1, y) in stack and y < 58:
                cv.set(x + 1, y, 'R4')
        elif (x, y - 1) not in stack:
            cv.set(x, y, 'R4' if x < LX + 4 else 'R3')
    # wet, darker foot
    for (x, y) in stack:
        if y > 63 and bay(x, y) < q4((y - 63) / 7.0) + 0.1:
            cv.set(x, y, {'R4': 'A3', 'R3': 'A2', 'R2': 'A1', 'T4': 'A3'}.get(cv.get(x, y), 'A0'))
    # tufts of salt grass on the top
    for x in range(LX - 13, LX + 12):
        if (x, TB - 2) in stack and hashf(x, 1, 3) < 0.4:
            cv.set(x, TB - 3, 'R3')
    # ------------------------------------------------------------ the stair cut into the stack
    stair = []
    for (ax, ay, bx, by) in ((LX - 22, 67, LX - 6, 58), (LX - 6, 58, LX - 15, 52), (LX - 15, 52, LX - 5, 46)):
        n = abs(bx - ax)
        for i in range(n):
            stair.append((ax + (i if bx > ax else -i), int(round(ay + (by - ay) * i / n))))
    for (x, y) in stair:
        cv.set(x, y + 1, 'R0')
    for (x, y) in stair:
        cv.set(x, y, 'T3' if x < LX - 10 else 'T2')

    # ------------------------------------------------------------ the tower
    tower = set()
    for y in range(TT, TB + 1):
        hw = tower_hw(y)
        for x in range(int(round(LX - hw)), int(round(LX + hw)) + 1):
            tower.add((x, y))
    TU = run_u(tower)
    shade = ('T4', 'T3', 'T2', 'T1', 'R2', 'R1')
    for (x, y) in tower:
        u = TU[(x, y)]
        i = 0 if u < 0.1 else (1 if u < 0.3 else (2 if u < 0.55 else (3 if u < 0.78 else (4 if u < 0.92 else 5))))
        if ((y - TT) // 5) % 2 == 1:                  # weathered painted bands
            i = min(5, i + 1)
        if (y - TT) % 5 == 0 and i < 5 and u > 0.12:  # course joints
            i = min(5, i + 1)
        cv.set(x, y, shade[i])
    # stains running down from the gallery
    for x in range(LX - 3, LX + 4, 3):
        for y in range(TT + 2, TT + 6 + (x % 4)):
            if cv.get(x, y) in ('T3', 'T2'):
                cv.set(x, y, 'T1')
    # a breach torn in the shaft, right side
    hole = m_poly([(LX + 1, 25), (LX + 4, 23), (LX + 7, 26), (LX + 7, 33), (LX + 4, 32), (LX + 2, 29)])
    for (x, y) in hole:
        if (x, y) in tower:
            cv.set(x, y, 'R0')
    for (x, y) in hole:
        if (x, y) in tower and (x - 1, y) not in hole and (x - 1, y) in tower:
            cv.set(x - 1, y, 'T3')
    cv.set(LX + 4, 28, 'G1'); cv.set(LX + 4, 29, 'G2'); cv.set(LX + 5, 29, 'G1')
    for (x, y) in ((LX + 8, 34), (LX + 9, 36), (LX + 8, 38)):          # rubble falling away
        cv.set(x, y, 'T1')
    # slit windows, one lit
    for (wy, lit) in ((21, False), (32, True), (38, False)):
        cv.vline(LX - 1, wy, wy + 2, 'G2' if lit else 'R0')
        cv.set(LX - 1, wy - 1, 'T3')
    # the door at the foot, ghost-light leaking out
    for y in range(TB - 6, TB + 1):
        for x in range(LX - 2, LX + 2):
            if y == TB - 6 and x in (LX - 2, LX + 1):
                continue
            cv.set(x, y, 'G2' if y > TB - 2 else ('G1' if y > TB - 4 else 'R0'))
    cv.set(LX - 3, TB - 4, 'T4')
    # the gallery and its broken rail
    cv.hline(LX - 7, LX + 7, TT, 'T2'); cv.hline(LX - 6, LX + 6, TT + 1, 'R1')
    cv.set(LX - 7, TT, 'T4'); cv.set(LX - 6, TT, 'T3')
    for x in range(LX - 6, LX + 7, 2):
        if x in (LX + 4, LX + 6):
            continue
        cv.vline(x, TT - 3, TT - 1, 'R1')
    cv.hline(LX - 7, LX + 3, TT - 3, 'R1')
    cv.line(LX + 3, TT - 3, LX + 8, TT + 2, 'R1')         # rail torn and hanging
    # lamp room: green glass, iron mullions, the flame
    for y in range(LY - 4, TT - 1):
        for x in range(LX - 4, LX + 5):
            dx = abs(x - LX)
            k = 'G2' if dx > 2 else 'G3'
            if dx == 0 and LY - 2 <= y <= LY + 2:
                k = 'G4'
            if x in (LX - 3, LX + 2):
                k = 'R1'
            cv.set(x, y, k)
    cv.hline(LX - 5, LX + 5, LY - 5, 'R2'); cv.hline(LX - 5, LX + 5, TT - 1, 'R2')
    cv.set(LX - 5, LY - 5, 'T3')
    # dome cap and wind vane
    for y in range(LY - 9, LY - 5):
        hw = (y - (LY - 10)) * 1.5
        for x in range(int(LX - hw), int(LX + hw) + 1):
            cv.set(x, y, 'T3' if x < LX - hw + 2 else ('R2' if x < LX + 1 else 'R1'))
    cv.vline(LX, LY - 12, LY - 10, 'R1'); cv.hline(LX - 1, LX + 2, LY - 12, 'R1')
    # halo around the lamp
    light(cv, LX + 0.5, LY, 24, 15, {'K0': 'K1', 'K1': 'K2', 'K2': 'K3', 'K3': 'K4'}, power=1.6, steps=3)
    light(cv, LX + 0.5, LY, 11, 9, {'K1': 'G1', 'K2': 'G1', 'K3': 'G1', 'K4': 'G1', 'R1': 'G1',
                                     'R2': 'G1', 'T2': 'G2', 'T1': 'G1'}, power=1.8, steps=3,
          pred=lambda x, y: abs(x - LX) > 4 or y < LY - 5)
    # the short back beam to the right
    for y in range(0, 30):
        for x in range(LX + 6, W):
            dx = x - LX
            s = (y - LY) / dx
            if 0.02 < s < 0.16:
                k = cv.get(x, y)
                if k in STEP and bay(x, y) < q4(0.6 * (1 - dx / 60.0)):
                    cv.set(x, y, STEP[k])
    # ghost-light on the tower's right edge near the top
    for y in range(TT + 1, TT + 8):
        x = int(round(LX + tower_hw(y)))
        cv.set(x, y, 'G1')

    # ------------------------------------------------------------ the wreck on the rocks, right
    for (cx, cy, rx, ry) in ((178, 60, 16, 5), (190, 54, 5, 8), (166, 64, 8, 4)):
        m = m_ell(cx, cy, rx, ry)
        for (x, y) in m:
            k = 'R1'
            if (x, y - 1) not in m:
                k = 'R3'
            elif (x, y - 2) not in m or (x - 1, y) not in m:
                k = 'R2'
            cv.set(x, y, k)
    # keel and ribs, the hull listing to the right
    keel = [(160 + i, 61 - int(i * 0.30)) for i in range(32)]
    ribs = []
    for j, i in enumerate(range(1, 32, 4)):
        bx, by = keel[i]
        h = (9, 13, 16, 17, 15, 12, 9, 7)[j]
        tipx = bx - 2
        m = m_bez((bx, by), (bx + 7, by - h * 0.55), (tipx, by - h), 1.1, 0.6)
        ribs.append((tipx, by - h))
        cyl(cv, m, ('W3', 'W2', 'W1'), cuts=(0.4, 0.75), top=False)
    # what is left of the gunwale, lashing the rib tops together
    for (a, b) in zip(ribs[1:5], ribs[2:6]):
        if a == ribs[3]:
            continue
        cv.line(a[0], a[1], b[0], b[1], 'W2')
        cv.line(a[0], a[1] + 1, b[0], b[1] + 1, 'W1')
    # strakes of the hull still clinging to the lower ribs
    for (off, i0, i1) in ((2, 0, 26), (4, 3, 20), (6, 6, 14)):
        for i in range(i0, i1):
            x, y = keel[i]
            if hashf(i, off, 8) < 0.82:
                cv.set(x, y - off, 'W2' if off % 4 else 'W3')
                cv.set(x, y - off + 1, 'W1')
    for (x, y) in keel:
        cv.set(x, y, 'W3'); cv.set(x, y + 1, 'W1'); cv.set(x, y + 2, 'R0')
    # broken mast with a rag of sail and a torn yard
    cv.line(172, 56, 182, 24, 'W2'); cv.line(173, 56, 183, 24, 'W1')
    cv.line(174, 31, 190, 36, 'W2')
    for (x, y0, ln) in ((177, 33, 7), (179, 33, 10), (181, 34, 6), (183, 34, 9), (185, 35, 5)):
        for y in range(y0, y0 + ln):
            if hashf(x, y, 6) < 0.8:
                cv.set(x + (y - y0) // 4, y, 'T2' if x < 181 else 'T1')
    cv.set(182, 23, 'R1'); cv.set(183, 22, 'R1')         # a gull perched on the stump
    cv.set(181, 22, 'F1'); cv.set(182, 22, 'F2')
    # a reef-lizard with a spear, crouched on the rocks
    LZX, LZY = 186, 50
    liz = ["...00.",
           "..000.",
           ".0000.",
           "00000.",
           "0.00..",
           ".0..0."]
    stamp(cv, LZX - 3, LZY - 6, liz, {'0': 'R0'}, flip=True)
    cv.set(LZX - 3, LZY - 5, 'G2')                       # eye catching the lamp
    cv.line(LZX + 1, LZY - 1, LZX - 2, LZY - 11, 'W2')
    cv.set(LZX - 2, LZY - 12, 'T3')
    cv.line(LZX + 2, LZY, LZX + 5, LZY + 1, 'R0')        # tail

    # ------------------------------------------------------------ surf: foam at the foot, spray
    for y in range(WL + 3, H):
        xl, xr = stack_edges(y, le, re_)
        for x in range(int(xl) - 7, int(xl) + 1):
            if hashf(x, y, 9) < 0.25 + (x - xl + 7) * 0.08:
                cv.set(x, y, 'F1' if (x + y) % 3 else 'F2')
    for x in range(112, W):
        for y in range(H - 6, H):
            s = math.sin(x * 0.35 + y * 1.3) + nz(x / 4.0, y)
            if s > 1.0:
                cv.set(x, y, 'F2' if s > 1.35 else 'F1')
    for y in range(62, 65):
        for x in range(152, 192):
            if cv.get(x, y) in ('R1', 'R2', 'W1') and hashf(x, y, 12) < 0.3:
                cv.set(x, y, 'F1')
    # the burst of spray against the stack's seaward side: jets arcing up and back
    sr = random.Random(77)
    BX0, BY0 = 129, 60
    for (ang, ln, wd) in ((100, 17, 2.4), (115, 14, 2.0), (82, 12, 1.6), (130, 9, 1.5)):
        a = math.radians(ang)
        for i in range(int(ln * 3)):
            t = i / (ln * 3.0)
            x = BX0 + math.cos(a) * ln * t - 2 * t * t
            y = BY0 - math.sin(a) * ln * t + 5 * t * t
            w_ = wd * (1 - t * 0.6)
            for j in range(-int(w_ + 1), int(w_ + 2)):
                xx = x + j
                if abs(j) <= w_ * 0.5:
                    cv.set(xx, y, 'F2')
                elif sr.random() < 0.6:
                    cv.set(xx, y, 'F1')
        for i in range(10):                               # droplets falling off the crest
            tx = BX0 + math.cos(a) * ln - 2 + sr.uniform(-4, 3)
            ty = BY0 - math.sin(a) * ln + 5 + sr.uniform(-2, 6)
            cv.set(tx, ty, 'F1' if sr.random() < 0.6 else 'F2')
    for i in range(24):
        x, y = 166 + sr.randrange(26), 44 + sr.randrange(12)
        if cv.get(x, y) in SKY + ('R1', 'R2'):
            cv.set(x, y, 'F1')

    # ------------------------------------------------------------ the dead keeper on the stair
    KX, KY = LX - 11, 50
    sk = [".111.",
          "10101",
          ".111.",
          "..1..",
          ".111.",
          "1.1.1",
          ".111.",
          "..1..",
          ".1.1.",
          ".1.1.",
          "1...1"]
    stamp(cv, KX - 2, KY - 10, sk, {'1': 'T4', '0': 'R0'})
    cv.set(KX - 1, KY - 9, 'G3'); cv.set(KX + 1, KY - 9, 'G3')
    cv.set(KX - 1, KY - 11, 'R1'); cv.hline(KX - 2, KX + 2, KY - 11, 'R1')   # a sodden cap
    cv.line(KX + 2, KY - 5, KX + 5, KY - 7, 'T4')          # arm raised with a lantern
    cv.set(KX + 5, KY - 8, 'R1'); cv.set(KX + 5, KY - 7, 'G4'); cv.set(KX + 6, KY - 7, 'G2')
    cv.set(KX + 5, KY - 6, 'G2'); cv.set(KX + 4, KY - 6, 'G3')
    light(cv, KX + 5.5, KY - 6.5, 8, 7, {'R1': 'G1', 'R2': 'G1', 'R3': 'G1', 'R4': 'G2', 'R0': 'G1'},
          power=1.6, steps=2, pred=lambda x, y: not (KX - 3 <= x <= KX + 6 and KY - 11 <= y <= KY))
    # a second one waiting by the door
    cv.vline(LX - 6, TB - 6, TB - 1, 'T3'); cv.set(LX - 6, TB - 7, 'T4')
    cv.set(LX - 7, TB - 4, 'T3'); cv.set(LX - 5, TB - 4, 'T3')
    cv.set(LX - 7, TB, 'T3'); cv.set(LX - 5, TB, 'T3')

    # ------------------------------------------------------------ gulls in the beam, wisps over the sea
    for (x, y, p) in ((112, 20, 0), (104, 26, 1), (121, 28, 2), (96, 17, 1)):
        crow_fly(cv, x, y, 'F2' if p != 1 else 'F1', p)
    for (x, y) in ((40, 40), (118, 54), (96, 60)):
        light(cv, x + 0.5, y + 0.5, 3.5, 3.5, {k: 'G1' for k in ('A1', 'A2', 'A3', 'K4', 'K5', 'K3', 'A0')},
              power=1, steps=2)
        cv.set(x, y, 'G4')
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            cv.set(x + d[0], y + d[1], 'G2')
    return cv
