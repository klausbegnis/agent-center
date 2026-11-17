"""Emberdeep Foundry: a chained vault gate in a volcanic rift, slag rivers, a red sky with ash."""
import random, math
from engine import *

W, H = 192, 72
GX, GY, GR = 151, 33, 12.5      # the vault door

PAL = {
    # red sky
    'K0': '#1c0a14', 'K1': '#3b101c', 'K2': '#64191f', 'K3': '#972a20', 'K4': '#cc5020',
    'K5': '#ef8a2e',
    # smoke and ash
    'M0': '#2a1219', 'M1': '#46202a', 'AS': '#b9a49c',
    # basalt
    'R0': '#0d090e', 'R1': '#1d141a', 'R2': '#32212a', 'R3': '#4f3135', 'R4': '#7c4a3e',
    # iron
    'I1': '#24232e', 'I2': '#41404f', 'I3': '#686676', 'I4': '#a49ca2',
    # slag and fire
    'F1': '#7e1c16', 'F2': '#cf4618', 'F3': '#f8922a', 'F4': '#ffe48a',
}

ROCK = ('R1', 'R2', 'R3', 'R4')


def chain(cv, pts, big=True):
    """Iron chain along a polyline: alternating flat and edge-on links."""
    seq = []
    for a, b in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1])))
        for i in range(n):
            t = i / n
            seq.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    step = 3 if big else 2
    for i in range(0, len(seq), step):
        x, y = seq[i]
        x, y = int(round(x)), int(round(y))
        if (i // step) % 2 == 0:
            if big:
                cv.set(x - 1, y, 'I3'); cv.set(x + 1, y, 'I2'); cv.set(x, y - 1, 'I4')
                cv.set(x, y + 1, 'I1'); cv.set(x, y, 'R0')
            else:
                cv.set(x, y, 'I3'); cv.set(x + 1, y, 'I1')
        else:
            cv.set(x, y, 'I2' if big else 'I2')
            if big:
                cv.set(x + 1, y, 'I1')


def catenary(x0, y0, x1, y1, sag, n=24):
    return [(x0 + (x1 - x0) * i / n,
             y0 + (y1 - y0) * i / n + sag * (1 - (2 * i / n - 1) ** 2)) for i in range(n + 1)]


def draw():
    cv = Cv(PAL, 'K0', W, H)
    nz = vnoise(9)

    # ------------------------------------------------------------ sky and a rolling ash cloud
    bands(cv, [(0, 'K0'), (9, 'K1'), (19, 'K2'), (28, 'K3'), (36, 'K4'), (42, 'K5')], tw=4)
    for x in range(W):
        top = 6 + 5 * nz(x / 9.0, 1.0) + 2 * math.sin(x / 13.0)
        bot = 17 + 7 * nz(x / 7.0, 4.0) - 4 * math.exp(-((x - 40) / 20.0) ** 2)
        bot -= 9 * max(0.0, min(1.0, (x - 100) / 14.0))
        for y in range(int(top), int(bot)):
            k = 'M0' if y < bot - 2 else 'M1'
            if y >= bot - 1:
                k = 'K3' if x < 120 else 'K2'
            if y < top + 1.5 and nz(x / 3.0, y / 2.0) > 0.5:
                k = 'M1'
            cv.set(x, y, k)
    # second, lower wisps lit from below
    for (cx, cy, hl) in ((22, 30, 22), (96, 27, 26), (70, 35, 14)):
        for x in range(cx - hl, cx + hl):
            u = (x - cx) / hl
            t = 2.2 * (1 - u * u) - 0.3
            if t <= 0:
                continue
            for y in range(int(cy - t), int(cy + 1)):
                cv.set(x, y, 'K2' if cy < 32 else 'K3')
            cv.set(x, cy + 1, 'K4')

    # ------------------------------------------------------------ the volcano, far left
    VX, VY = 50, 25
    for x in range(0, 112):
        d = abs(x - VX)
        top = VY + (d - 6) * 0.62 if d > 6 else VY + (0 if d > 3 else 1)
        top += 1.2 * nz(x / 4.0, 9.0)
        for y in range(int(top), 50):
            k = 'R1'
            if x < VX and y - top < 2:
                k = 'R2'
            cv.set(x, y, k)
    # lava streaks down the cone
    for (sx, sl, ln) in ((VX - 2, -0.5, 14), (VX + 2, 0.7, 18), (VX + 1, 0.15, 9)):
        for i in range(ln):
            x = int(round(sx + sl * i + 0.8 * math.sin(i * 0.6)))
            y = VY + 1 + i
            cv.set(x, y, 'F2' if i < ln * 0.5 else 'F1')
    cv.hline(VX - 3, VX + 3, VY, 'F3'); cv.hline(VX - 2, VX + 2, VY - 1, 'F4')
    # the plume: a column of smoke lit from the crater
    for y in range(4, VY):
        t = (VY - y) / (VY - 4)
        hw = 2 + 9 * t ** 1.3
        cx = VX + 6 * t ** 2
        for x in range(int(cx - hw), int(cx + hw) + 1):
            n = nz(x / 3.0, y / 2.5)
            if abs(x - cx) > hw - 2 and n < 0.4:
                continue
            k = 'M1' if n > 0.5 else 'M0'
            if x < cx - hw * 0.4 and n > 0.4:
                k = 'K2'
            if t < 0.4 and abs(x - cx) < hw * 0.7:
                k = 'F2' if t < 0.1 else ('F1' if t < 0.22 else 'K3')
            cv.set(x, y, k)

    # ------------------------------------------------------------ left plateau and rift lip
    ground = smooth(mpd(random.Random(6), W, 2, 0.5), 2)
    for x in range(W):
        top = int(46 + ground[x])
        for y in range(top, H):
            k = 'R2' if y - top < 2 else 'R1'
            if y - top == 0:
                k = 'R3'
            cv.set(x, y, k)
    # ------------------------------------------------------------ the right cliff
    cliff = smooth(mpd(random.Random(2), H, 3, 0.6), 1)
    for y in range(0, 60):
        if y < 30:
            x0 = 184 + cliff[y] * 1.2 + max(0, 10 - y) * 0.6
        else:
            x0 = 184 - (y - 30) * 2.9 + cliff[y]       # rubble slope down to the rift
        if y > 46:
            x0 = max(x0, 118 + (y - 46) * 0.8)
        for x in range(int(x0), W):
            n = nz(x / 5.0, y / 3.0)
            k = 'R2' if n > 0.42 else 'R1'
            if (x + y * 2) % 11 == 0 and n > 0.5:
                k = 'R3'
            if x - x0 < 1.5:
                k = 'R3'
            cv.set(x, y, k)
        cv.set(int(x0) - 1, y, 'R0') if False else None
    for y in range(0, 6):
        for x in range(170, W):
            if nz(x / 4.0, y) > 0.55:
                cv.set(x, y, 'R1')

    # ------------------------------------------------------------ the rift: a glowing chasm
    for x in range(0, W):
        y0 = 52 + int(2 * math.sin(x / 11.0))
        if x < 64:
            continue
        depth = 7 if x > 80 else int((x - 64) / 16 * 7)
        for y in range(y0, y0 + depth):
            t = (y - y0) / max(1, depth)
            k = 'R0' if t < 0.35 else ('F1' if t < 0.75 else 'F2')
            if t >= 0.35 and t < 0.6 and bay(x, y) < 0.5:
                k = 'R0'
            cv.set(x, y, k)
        cv.set(x, y0 - 1, 'R4')
        cv.set(x, y0 + depth, 'R4' if depth > 2 else 'R3')

    # ------------------------------------------------------------ the gate facade: a horned maw
    for y in range(12, 58):
        hw = 22
        for x in range(int(GX - hw), int(GX + hw) + 1):
            row = (y - 12) // 4
            joint = (y - 12) % 4 == 3 or (x + row * 4) % 9 == 0
            k = 'R2' if joint else 'R3'
            if x > GX + 6:
                k = 'R1' if joint else 'R2'
            cv.set(x, y, k)
    # horns curling up from the frame
    for side in (-1, 1):
        hm = m_bez((GX + side * 19, 11), (GX + side * 36, 9), (GX + side * 31, -5), 4.6, 1.2)
        for (x, y) in hm:
            if y >= 14:
                continue
            k = 'R4' if side < 0 else 'R3'
            if (x, y + 1) not in hm:
                k = 'F2' if y > 4 else 'F1'                # underside caught by the glow
            elif (x, y - 1) not in hm or (x + side, y) not in hm:
                k = 'R1'
            elif (y + int(abs(x - GX) * 0.7)) % 3 == 0:
                k = 'R2'                                   # horn rings
            cv.set(x, y, k)
    for x in range(GX - 22, GX + 23):            # crenels
        if (x - GX + 22) % 6 < 3:
            cv.rect(x, 9, x + 1, 12, 'R3' if x < GX + 6 else 'R2')
            cv.set(x, 9, 'R4' if x < GX + 6 else 'R3')
    for vx in (GX - 13, GX + 13):                 # fire vents on the crown
        cv.rect(vx - 2, 6, vx + 3, 12, 'I1'); cv.hline(vx - 2, vx + 2, 6, 'I3')
        for (dx, dy, k) in ((0, -1, 'F4'), (1, -1, 'F3'), (-1, -1, 'F3'), (0, -2, 'F4'), (1, -2, 'F3'),
                            (-1, -2, 'F2'), (0, -3, 'F3'), (1, -3, 'F2'), (0, -4, 'F3'), (-1, -4, 'F2'),
                            (1, -5, 'F2'), (0, -5, 'F2'), (1, -6, 'F1'), (2, -7, 'F1'), (0, -7, 'F1')):
            cv.set(vx + dx, 6 + dy, k)
    cv.hline(GX - 21, GX + 21, 15, 'R1'); cv.hline(GX - 21, GX + 21, 16, 'R4')
    for x in range(GX - 18, GX + 19, 4):
        cv.set(x, 15, 'F2'); cv.set(x + 1, 15, 'F1')
    # stone ring
    for y in range(int(GY - GR - 4), int(GY + GR + 5)):
        for x in range(int(GX - GR - 4), int(GX + GR + 5)):
            d = math.hypot(x + 0.5 - GX, y + 0.5 - GY)
            if GR + 0.5 < d <= GR + 3.6:
                a = math.atan2(y + 0.5 - GY, x + 0.5 - GX)
                k = 'R4' if math.cos(a + 2.4) > 0.3 else ('R3' if math.cos(a + 2.4) > -0.4 else 'R1')
                if int((a + 3.2) * 4) % 3 == 0 and d > GR + 1.5:
                    k = 'R1'
                cv.set(x, y, k)
    # iron vault door with banding, rivets and molten seams
    for y in range(int(GY - GR - 1), int(GY + GR + 2)):
        for x in range(int(GX - GR - 1), int(GX + GR + 2)):
            dx, dy = x + 0.5 - GX, y + 0.5 - GY
            d = math.hypot(dx, dy)
            if d > GR + 0.5:
                continue
            a = math.atan2(dy, dx)
            lit = -(dx + dy) / (GR * 1.4)
            k = 'I2' if lit < 0.15 else 'I3'
            if lit < -0.45:
                k = 'I1'
            if GR - 2.2 < d:
                k = 'I3' if lit > -0.1 else 'I1'
                if d > GR - 0.8 and lit > 0.2:
                    k = 'I4'
            if abs(d - 8) < 0.7:
                k = 'I1'
            if abs(d - 7.2) < 0.5 and lit > 0:
                k = 'I3'
            spoke = abs(math.sin(a * 4)) < 0.12 and 3.5 < d < GR - 2
            if spoke:
                k = 'F2' if d < 8 else 'F1'
            cv.set(x, y, k)
    for i in range(12):
        a = i * math.pi / 6 + 0.26
        x, y = GX + math.cos(a) * (GR - 1.2), GY + math.sin(a) * (GR - 1.2)
        cv.set(x - 0.5, y - 0.5, 'I4' if math.cos(a + 2.4) > 0 else 'I3')
    # the central lock: a glowing furnace eye
    cv.disc(GX, GY, 3.6, 'I1')
    cv.disc(GX, GY, 2.6, 'F2')
    cv.disc(GX - 0.3, GY - 0.3, 1.5, 'F3')
    cv.set(GX - 1, GY - 1, 'F4')
    cv.vline(GX - 0.5 + 0, GY - 2, GY + 1, 'F4') if False else None
    # molten light leaking under the door
    for x in range(int(GX - 9), int(GX + 10)):
        cv.set(x, int(GY + GR + 1), 'F3' if abs(x - GX) < 6 else 'F2')
    # threshold and steps
    for i in range(4):
        y = int(GY + GR + 2 + i)
        hw = 12 + i * 2
        cv.hline(GX - hw, GX + hw, y, 'R3' if i % 2 == 0 else 'R2')
        cv.set(GX - hw, y, 'R4')
    # braziers hanging on chains either side
    for bx in (GX - 20, GX + 20):
        cv.vline(bx, 22, 30, 'I1')
        cv.rect(bx - 2, 31, bx + 3, 33, 'I2'); cv.hline(bx - 2, bx + 2, 31, 'I3')
        for (dx, dy, k) in ((0, -1, 'F3'), (1, -1, 'F2'), (-1, -1, 'F2'), (0, -2, 'F4'),
                            (1, -2, 'F3'), (0, -3, 'F3'), (0, -4, 'F2'), (1, -5, 'F1')):
            cv.set(bx + dx, 31 + dy, k)

    # ------------------------------------------------------------ great chains holding it shut
    chain(cv, catenary(GX - 12, GY - 4, 122, 3, 6))
    chain(cv, catenary(GX + 12, GY - 4, 190, 6, 6))
    chain(cv, catenary(GX - 10, GY + 6, 92, 45, 11))
    # anchor post on the plateau
    cv.rect(89, 41, 93, 48, 'I2'); cv.vline(89, 41, 47, 'I3'); cv.vline(93, 41, 47, 'I1')
    cv.hline(88, 94, 40, 'I3'); cv.hline(88, 94, 48, 'R0')

    # ------------------------------------------------------------ a dormant iron golem, slumped
    IK = ('R4', 'I2', 'I2', 'I1', 'R0')
    body = m_ell(183, 46, 8, 9)
    shoulder = m_ell(180, 40, 6, 4)
    legs = m_ell(178, 56, 7, 3.0) | m_ell(188, 56, 5, 3.0)
    head = m_poly([(171.5, 37), (178, 37), (178.5, 42.5), (171, 42.5)])
    arm = m_seg(176, 42, 170, 51, 2.4, 3.0)
    fist = m_ell(169.5, 53.5, 3.4, 2.6)
    cyl(cv, legs, IK)
    cyl(cv, body | shoulder, IK, cuts=(0.1, 0.4, 0.75, 0.93))
    cyl(cv, arm | fist, IK, cuts=(0.18, 0.45, 0.75, 0.92))
    cyl(cv, head, ('R4', 'I3', 'I2', 'I1', 'R0'), cuts=(0.15, 0.4, 0.8, 0.95))
    cv.hline(172, 177, 37, 'I3'); cv.set(171, 37, 'I1')
    cv.set(173, 39, 'F4'); cv.set(172, 39, 'F3'); cv.set(175, 39, 'F2')
    for (x, y) in ((181, 44), (183, 44), (185, 44)):
        cv.vline(x, y, y + 5, 'R0')
    for (x, y) in ((182, 44), (184, 44)):
        cv.vline(x, y, y + 5, 'F2')
        cv.set(x, y + 3, 'F3')
    for (x, y) in ((179, 39), (186, 40), (186, 52), (177, 49)):
        cv.set(x, y, 'I3')
    for (x, y) in ((182, 50), (182, 51), (183, 52)):
        cv.set(x, y, 'F1')

    # ------------------------------------------------------------ slag river from under the gate
    for y in range(int(GY + GR + 6), H):
        t = max(0.0, (y - (GY + GR + 6)) / (H - (GY + GR + 6)))
        cx = GX - 6 - 46 * t ** 1.4
        hw = 2.5 + 9 * t
        x0, x1 = int(round(cx - hw)), int(round(cx + hw))
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            n = nz(x / 3.5 + y * 0.4, y / 1.4)
            k = 'F2'
            if n > 0.6:
                k = 'F4' if n > 0.74 else 'F3'
            elif n < 0.3:
                k = 'F1'
            if u < 0.1:
                k = 'F3'
            elif u > 0.9:
                k = 'F1'
            cv.set(x, y, k)
        cv.set(x0 - 1, y, 'R4'); cv.set(x1 + 1, y, 'R0')
    # warm under-light on the ground beside the river
    light(cv, GX - 30, 64, 40, 12, {'R1': 'R2', 'R2': 'R3', 'R3': 'R4'}, power=1.3, steps=3)
    light(cv, GX, GY + 12, 26, 12, {'R2': 'R3', 'R1': 'R2', 'R3': 'R4'}, power=1.4, steps=3)

    # ------------------------------------------------------------ iron bridge across the rift
    BY = 50
    for x in range(104, 136):
        y = BY + int(round(((x - 120) / 16.0) ** 2 * -1.5 + 1.5))
        cv.set(x, y, 'I3'); cv.set(x, y + 1, 'I1')
        if x % 4 == 0:
            cv.vline(x, y - 3, y, 'I2')
        cv.set(x, y - 3, 'I2')
        if x % 8 == 0:
            for i in range(1, 8):
                cv.set(x - i // 2, y + 1 + i, 'I1')
                cv.set(x + i // 2, y + 1 + i, 'I1')
    # tiny horned figures crossing toward the gate
    for (fx, fy) in ((118, 47), (124, 47)):
        cv.vline(fx, fy - 1, fy + 2, 'R0'); cv.set(fx - 1, fy - 2, 'R0'); cv.set(fx + 1, fy - 2, 'R0')
        cv.set(fx - 1, fy + 1, 'R0'); cv.set(fx + 1, fy + 2, 'R0')

    # ------------------------------------------------------------ glowing cracks in the near ground
    for pts in (((70, 60), (78, 62), (84, 61), (92, 64)), ((40, 66), (48, 65), (52, 68)),
                ((170, 62), (178, 60), (186, 63), (191, 62)), ((150, 68), (158, 66), (166, 70))):
        for a, b in zip(pts, pts[1:]):
            cv.line(a[0], a[1], b[0], b[1], 'F1')
        mx, my = pts[1]
        cv.set(mx, my, 'F2')
    # ------------------------------------------------------------ falling ash and embers
    rng = random.Random(3)
    for i in range(34):
        x, y = rng.randrange(W), rng.randrange(44)
        k = cv.get(x, y)
        if k in ('K0', 'K1', 'K2', 'K3', 'M0', 'M1'):
            cv.set(x, y, 'AS' if i % 4 == 0 else 'R4')
            if i % 2:
                cv.set(x + 1, y + 1, 'R3' if k in ('K0', 'K1', 'M0') else 'K1')
    for i in range(16):
        x, y = rng.randrange(100, 190), rng.randrange(30, 60)
        if cv.get(x, y) in ('R1', 'R2', 'R0', 'K3', 'K4'):
            cv.set(x, y, 'F3' if i % 2 else 'F4')
    return cv
