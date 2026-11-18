"""The Abyssal Gate: a vast whirlpool in a night ocean, ringed by broken rune-carved gate pillars,
a sea-serpent's coils breaking the surface and one great eye glowing up from the depths."""
import random, math
from engine import *

W, H = 192, 72
HZ = 27                        # horizon: we look down over the sea
VX, VY = 136, 50               # the vortex
VRX, VRY = 44, 12.5

PAL = {
    # night sky
    'K0': '#08070f', 'K1': '#120f22', 'K2': '#1f1837', 'K3': '#302352',
    # sea
    'A0': '#04080d', 'A1': '#081520', 'A2': '#0e2431', 'A3': '#17384a', 'A4': '#255b69',
    # abyss light
    'P1': '#3a1f5e', 'P2': '#6b2f8f', 'P3': '#b555c6', 'T1': '#1e8984', 'T2': '#58e2c9',
    # the eye
    'E1': '#c4501e', 'E2': '#ffb348', 'E3': '#fff4b4',
    # gate stone
    'S0': '#0b0b12', 'S1': '#1c1c29', 'S2': '#32313f', 'S3': '#4f4c5e', 'S4': '#7b7588',
    # serpent
    'N1': '#0f2629', 'N2': '#1e4744', 'N3': '#3a7666',
    # spray
    'F1': '#9cc5cc', 'F2': '#e8fcff',
}


def vortex_at(x, y):
    """Normalised radius and angle of a pixel in the whirlpool's ellipse."""
    dx = (x + 0.5 - VX) / VRX
    dy = (y + 0.5 - VY) / VRY
    return math.hypot(dx, dy), math.atan2(dy, dx)


def pillar(cv, x, base, h, w, seed, broken=True, tilt=0.0, runes=True):
    """A squared stone pillar: lit left face, shadowed right face, a broken top, glowing runes."""
    r = random.Random(seed)
    m = {}
    cut = [r.randint(0, max(1, h // 4)) if broken else 0 for _ in range(w)]
    if broken:
        cut = smooth(cut, 1)
    for i in range(w):
        for j in range(int(h - cut[i])):
            y = base - j
            xx = int(round(x + i + tilt * j))
            m[(xx, y)] = i
    face = max(1, int(w * 0.55))
    for (xx, y), i in m.items():
        k = 'S3' if i < face else 'S1'
        if i == 0:
            k = 'S4'
        elif i == face:
            k = 'S2'
        if (base - y) % 7 == 0 and i > 0:
            k = 'S2' if i < face else 'S0'                 # course joints
        cv.set(xx, y, k)
    for (xx, y), i in m.items():                           # broken top catches the light
        if (xx, y - 1) not in m:
            cv.set(xx, y, 'S4' if i < face else 'S2')
    if runes:
        for j in range(3, int(h - max(cut)) - 2, 4):
            y = base - j
            xx = int(round(x + 1 + tilt * j))
            g = r.randrange(4)
            pts = (((0, 0), (0, 1), (1, 1)), ((0, 0), (1, 0), (1, 1)), ((0, 0), (1, 1)), ((1, 0), (0, 1), (1, 1)))[g]
            for (dx, dy) in pts:
                if face > 1 or dx == 0:
                    cv.set(xx + dx, y + dy, 'T2' if (j // 4) % 2 else 'T1')
    # reflection and a ring of foam where it stands in the water
    for i in range(-1, w + 1):
        cv.set(x + i, base + 1, 'F1' if (i + seed) % 3 else 'F2')
    for j in range(2, min(9, h // 2)):
        if j % 2 == 0:
            for i in range(w):
                if hashf(x + i, j, seed) < 0.7:
                    cv.set(x + i + (j % 4 == 0), base + j, 'S1' if i < face else 'A1')
    return m


def draw():
    cv = Cv(PAL, 'K0', W, H)
    nz = vnoise(113)
    rng = random.Random(77)

    # ------------------------------------------------------------ sky: a slow spiral of cloud
    bands(cv, [(0, 'K0'), (9, 'K1'), (18, 'K2'), (24, 'K3')], y1=HZ, tw=4)
    for i in range(50):
        x, y = rng.randrange(W), rng.randrange(HZ - 6)
        if cv.get(x, y) in ('K0', 'K1'):
            cv.set(x, y, 'S3' if i % 4 else 'F1')
    for y in range(0, HZ):
        for x in range(W):
            dx, dy = (x - VX) / 70.0, (y - 4) / 16.0
            r = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            v = math.sin(a * 2 + r * 9.0 + 0.6 * nz(x / 9.0, y / 4.0) * 3)
            if r < 1.4 and v > 0.55:
                k = 'K2' if v < 0.8 else 'K3'
                if r < 0.6 and v > 0.85:
                    k = 'P1'
                cv.set(x, y, k)
    light(cv, VX, HZ, 70, 18, {'K1': 'K2', 'K2': 'K3', 'K3': 'P1', 'P1': 'P2'}, power=1.6, steps=3)
    # ------------------------------------------------------------ far ruins on the horizon
    for (x, h, w) in ((22, 7, 3), (30, 4, 2), (60, 5, 2), (176, 6, 3), (186, 3, 2), (90, 3, 2)):
        cv.rect(x, HZ - h, x + w, HZ, 'K1')
        cv.set(x + w - 1, HZ - h - 1, 'K1')
    cv.hline(19, 27, HZ - 7, 'K1')                         # a far lintel still standing
    for (cx, hw, ht) in ((8, 12, 3), (120, 10, 2)):
        for x in range(cx - hw, cx + hw + 1):
            u = (x - cx) / hw
            for y in range(int(round(HZ - ht * (1 - u * u))), HZ):
                cv.set(x, y, 'K1')

    # ------------------------------------------------------------ the sea, swirling toward the vortex
    bands(cv, [(HZ, 'A3'), (HZ + 2, 'A2'), (HZ + 10, 'A1'), (HZ + 26, 'A0')], y0=HZ, tw=4)
    for y in range(HZ + 1, H):
        for x in range(W):
            r, a = vortex_at(x, y)
            if r < 1.0:
                continue
            # current lines bend into a spiral as they near the whirlpool
            v = math.sin(a * 3 + math.log(r) * 7.0 + nz(x / 6.0, y / 3.0) * 2)
            near = max(0.0, 1.0 - (r - 1.0) / 1.6)
            if v > 0.86 - near * 0.18 and (y % 2 == 0 or near > 0.5):
                k = 'A4' if near > 0.55 else ('A3' if near > 0.15 or y < HZ + 12 else 'A2')
                cv.set(x, y, k)
    cv.hline(0, W - 1, HZ, 'A3')

    # ------------------------------------------------------------ the whirlpool
    for y in range(int(VY - VRY) - 1, int(VY + VRY) + 2):
        for x in range(int(VX - VRX) - 1, int(VX + VRX) + 2):
            r, a = vortex_at(x, y)
            if r >= 1.0:
                continue
            spiral = math.sin(a * 3 + math.log(max(r, 0.05)) * 6.5)
            far = math.sin(a) < 0                              # far wall faces us and is lit
            depth = 1 - r
            if r < 0.2:
                k = 'A0'
            else:
                g = depth * (1.25 if far else 0.8)
                if spiral > 0.55:
                    g += 0.25
                elif spiral < -0.45 and not (g > 0.5):
                    g = -1
                if g > 0.72:
                    k = 'P2' if bay(x, y) < q4((g - 0.72) * 4) else 'P1'
                elif g > 0.5:
                    k = 'P1' if bay(x, y) < q4((g - 0.5) * 4) else 'A2'
                elif g > 0.3:
                    k = 'A3' if spiral > 0.2 else 'A2'
                elif g < 0:
                    k = 'A1' if r > 0.5 else 'A0'
                else:
                    k = 'A4' if spiral > 0.3 else 'A3'
                if spiral > 0.9 and r > 0.45:
                    k = 'F1' if r > 0.75 else 'T1'             # foam streaks wound into the funnel
            cv.set(x, y, k)
    # the bright lip, with spray thrown off the rim
    for i in range(720):
        a = i / 720.0 * 2 * math.pi
        x = VX + VRX * math.cos(a); y = VY + VRY * math.sin(a)
        lit = math.sin(a) > -0.2
        if hashf(i // 3, 1, 5) < 0.8:
            cv.set(x, y, 'F2' if lit and hashf(i, 2, 5) < 0.5 else 'F1')
    for i in range(110):
        a = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(1.0, 1.25)
        x = VX + VRX * rr * math.cos(a); y = VY + VRY * rr * math.sin(a) - rng.uniform(0, 4) * (rr - 0.9) * 4
        cv.set(x, y, 'F2' if i % 3 else 'F1')
    # ------------------------------------------------------------ the eye in the depths
    light(cv, VX, VY - 1, 22, 7, {'A0': 'P1', 'A2': 'P1', 'A3': 'P2', 'P1': 'P2', 'P2': 'P3', 'T1': 'T2',
                                  'A4': 'T1'}, power=1.3, steps=3)
    EX, EY = VX, VY - 1
    for x in range(EX - 7, EX + 8):
        u = (x - EX) / 7.5
        hh = 2.6 * (1 - u * u) ** 0.8
        for y in range(int(round(EY - hh)), int(round(EY + hh)) + 1):
            d = math.hypot(u, (y - EY) / 2.8)
            k = 'E1' if d > 0.7 else ('E2' if d > 0.35 else 'E3')
            cv.set(x, y, k)
    cv.vline(EX, EY - 2, EY + 2, 'S0'); cv.set(EX + 1, EY, 'S0')          # slit pupil
    cv.set(EX - 2, EY - 1, 'E3')
    for x in range(EX - 8, EX + 9):                                      # lids
        u = (x - EX) / 8.0
        hh = 3.2 * (1 - u * u) ** 0.8
        cv.set(x, EY - round(hh) - 1 + (abs(u) > 0.9), 'P3' if abs(u) < 0.6 else 'P2')
        cv.set(x, EY + round(hh) + 1, 'P2')
    # ------------------------------------------------------------ the ring of gate pillars
    # back of the ring first (smaller, higher), then the front (bigger, lower)
    ring = [(-160, 16, 4, 1, 0.0), (-130, 22, 5, 2, 0.08), (-104, 27, 5, 3, 0.0), (-76, 27, 5, 4, 0.0),
            (-48, 19, 5, 5, -0.12), (-18, 15, 4, 6, 0.0), (198, 20, 5, 7, 0.0)]
    tops = {}
    for (deg, h, w, seed, tilt) in ring:
        a = math.radians(deg)
        x = VX + (VRX + 6) * math.cos(a); y = VY + (VRY + 3.5) * math.sin(a)
        m = pillar(cv, int(round(x - w / 2)), int(round(y)), h, w, seed, broken=deg not in (-104, -76), tilt=tilt)
        tops[deg] = (int(round(x - w / 2)), int(round(y)) - h)
    # the lintel spanning the two whole pillars: the gate itself
    (lx0, ly0), (lx1, ly1) = tops[-104], tops[-76]
    for y in range(ly0 - 3, ly0 + 1):
        for x in range(lx0 - 3, lx1 + 8):
            k = 'S3' if y < ly0 - 1 else 'S1'
            if y == ly0 - 3:
                k = 'S4'
            cv.set(x, y, k)
    for x in range(lx0 + 2, lx1 + 3, 3):
        cv.set(x, ly0 - 2, 'T2')                                         # a line of runes
    light(cv, (lx0 + lx1) / 2 + 2, ly0 - 1, 16, 5, {'K2': 'K3', 'K3': 'P1', 'S1': 'S2'}, power=1.5, steps=2)
    # gate glow: the space under the lintel shimmers
    for y in range(ly0 + 1, VY - 9):
        for x in range(lx0 + 6, lx1):
            k = cv.get(x, y)
            if k not in ('A2', 'A3', 'A1', 'A4', 'K3', 'K2', 'P1'):
                continue
            t = (y - ly0) / float(VY - 9 - ly0)
            if (x - lx0) % 4 == 1 and hashf(x, y // 4, 4) < 0.4:
                cv.set(x, y, 'T1' if t < 0.6 else 'T2')            # falling threads of light
            elif bay(x, y) < 0.5 - t * 0.4:
                cv.set(x, y, 'P1')
    cv.set((lx0 + lx1) // 2 + 3, ly0 + 4, 'T2'); cv.set((lx0 + lx1) // 2 + 1, ly0 + 9, 'F2')
    # front pillars, big, one leaning, one snapped to a stump
    pillar(cv, 182, 70, 34, 7, 11, tilt=-0.1)
    pillar(cv, 88, 66, 17, 6, 12, tilt=0.15)
    pillar(cv, 160, 71, 9, 6, 13)
    # a fallen capital in the shallows by the front pillar
    for (x, y) in m_ell(172, 69, 5, 2):
        cv.set(x, y, 'S3' if y < 69 else 'S1')
    cv.hline(168, 176, 68, 'S4')

    # ------------------------------------------------------------ the serpent's coils
    def hump(cx, base, rw, rh, th, spines=True, flip=False):
        m = set()
        for i in range(60):
            t = i / 59.0
            a = math.pi * t
            x = cx - rw * math.cos(a)
            y = base - rh * math.sin(a)
            m |= m_ell(x, y, th, th * 0.9)
        m = {p for p in m if p[1] <= base}
        for (x, y) in m:
            k = 'N2'
            if (x, y - 1) not in m:
                k = 'N3'
            elif (x, y + 1) not in m or (x + 1, y + 1) not in m:
                k = 'N1'
            if (x + y) % 4 == 0 and k == 'N2':
                k = 'N1'                                         # scale pattern
            cv.set(x, y, k)
        if spines:
            for i in range(1, 9):
                t = i / 9.0
                a = math.pi * t
                x = cx - rw * math.cos(a)
                y = base - rh * math.sin(a) - th
                nx, ny = -math.cos(a) * 0.35, -1.0
                for j in range(3):
                    cv.set(x + nx * j * rw / 6.0, y + ny * j, 'P2' if j < 2 else 'P3')
        for x in range(int(cx - rw - th - 1), int(cx + rw + th + 2)):   # foam where it breaks water
            if abs(abs(x - cx) - rw) < th + 1.5:
                cv.set(x, base + 1, 'F2' if hashf(x, base, 2) < 0.5 else 'F1')
    hump(100, 57, 8, 9, 2.2)
    hump(124, 67, 6, 7, 2.4)
    hump(78, 51, 4, 5, 1.5)
    # the tail tip curling out of the far side of the vortex
    tail = m_bez((170, 44), (178, 34), (172, 30), 1.6, 0.5)
    for (x, y) in tail:
        cv.set(x, y, 'N3' if (x - 1, y) not in tail else 'N2')
    for (x, y) in ((176, 37), (177, 34), (174, 31)):
        cv.set(x + 1, y, 'P2')
    # the head rising out of the near water on a long neck, turned toward the shore
    neck = m_bez((156, 74), (148, 60), (158, 48), 3.4, 2.4)
    for (x, y) in neck:
        k = 'N2'
        if (x - 1, y) not in neck:
            k = 'N3'
        elif (x + 1, y) not in neck or (x + 2, y) not in neck:
            k = 'N1'
        elif (x + y) % 4 == 0:
            k = 'N1'
        cv.set(x, y, k)
    head = m_poly([(155, 44), (160, 42), (163, 45), (162, 49), (156, 50), (148, 50), (146, 48), (150, 46)])
    jaw = m_poly([(148, 50.5), (156, 50.5), (157, 53), (151, 52)])
    for (x, y) in head | jaw:
        k = 'N2'
        if (x, y - 1) not in head and (x, y) in head:
            k = 'N3'
        elif (x, y) in jaw:
            k = 'N1'
        cv.set(x, y, k)
    cv.hline(147, 155, 50, 'S0')                                         # the mouth
    for x in (149, 151, 153):
        cv.set(x, 51, 'F2')                                              # fangs
    cv.set(152, 46, 'E3'); cv.set(153, 46, 'E2'); cv.set(153, 47, 'E1')  # eye
    light(cv, 152.5, 46.5, 4, 3, {'N2': 'N3', 'N1': 'N2'}, power=1, steps=2)
    for (x, y, l) in ((160, 41, 4), (163, 43, 4), (162, 48, 3), (160, 53, 3), (158, 58, 3)):
        for j in range(l):
            cv.set(x + j, y - j // 2, 'P2' if j < l - 1 else 'P3')       # frills
    for y in range(66, H):
        if y % 2 == 0:
            cv.hline(150, 160, y, 'F1' if y < 68 else 'A3')

    # ------------------------------------------------------------ teal ghost-lights drifting
    for (x, y) in ((64, 34), (178, 40), (110, 38)):
        light(cv, x + 0.5, y + 0.5, 3.5, 3, {'A1': 'T1', 'A2': 'T1', 'A3': 'T1', 'K3': 'P1'}, power=1, steps=2)
        cv.set(x, y, 'T2')
    return cv
