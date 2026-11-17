import random, math
from engine import *

PAL = {
    # night sky
    'N0': '#0d0e1f', 'N1': '#181b35', 'N2': '#262b4c', 'N3': '#3a4166',
    # snow (moonlit, cool)
    'SN': '#e4ecf7', 'S1': '#a3b0d0', 'S2': '#66719a',
    # rock, darkest to moonlit
    'R0': '#120e17', 'R1': '#211b2a', 'R2': '#33293a', 'R3': '#4a3d4f', 'R4': '#6d5c6c',
    # fire and molten metal
    'F0': '#4f1f27', 'F1': '#8f3428', 'F2': '#d65a26', 'F3': '#f59a34', 'F4': '#ffe17f',
    # smoke
    'M0': '#2d2a3a', 'M1': '#4b4658',
    # timber
    'T': '#5b3826',
}

ROCK = ('R0', 'R1', 'R2', 'R3', 'R4')

GUARD = [
    ".......ooo.......",
    ".....ooxxxoo.....",
    "....oxxxxxxxo....",
    "oo..oxxxxxxxo..oo",
    "oxo.ooooooooo.oxo",
    ".oxxoxxxoxxxoxxo.",
    "....oxooxooxo....",
    "....oxxxoxxxo....",
    "...obbbbobbbbo...",
    "oxxxobbbbbbboxxxo",
    "oxxxxbbbbbbbxxxxo",
    "oxxxxobbbbboxxxxo",
    "oxxxoxbbbbbxoxxxo",
    "oxxxoxobbboxoxxxo",
    "oxxxoxxbobxxoxxxo",
    ".oxxoxxxoxxxoxxo.",
    ".oxxxoxxoxxoxxxo.",
    "..oxxxoowooxxxo..",
    "...ohhhhwhhhho...",
    "...oxoohwhooxo...",
    "...oxxowwwoxxo...",
    "..oxxxxowoxxxxo..",
    "..ooooooooooooo..",
    "..oxxxxowoxxxxo..",
    "..oxxxxowoxxxxo..",
    "..oxxxowwwoxxxo..",
    ".oowwwwwwwwwwwoo.",
    ".owwwwwwwwwwwwwo.",
    ".owwwwwwwwwwwwwo.",
    ".oowwwwwwwwwwwoo.",
    "..oxxxo...oxxxo..",
    ".ooooooo.ooooooo.",
]
for r in GUARD:
    assert len(r) == 17, r


def vnoise(seed):
    def h(ix, iy):
        n = (ix * 374761393 + iy * 668265263 + seed * 2147483647) & 0xffffffff
        n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
        return (n & 0xffff) / 65535.0

    def f(x, y):
        ix, iy = math.floor(x), math.floor(y)
        fx, fy = x - ix, y - iy
        sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        a = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * sx
        b = h(ix, iy + 1) + (h(ix + 1, iy + 1) - h(ix, iy + 1)) * sx
        return a + (b - a) * sy
    return f


def guardian(cv, x0, y0, gate_side):
    """Carved stone guardian. Moonlight from the left; the gate fire rims the gate-facing side."""
    rows = GUARD
    n = len(rows)
    for gy, row in enumerate(rows):
        for gx, ch in enumerate(row):
            if ch == '.':
                continue
            x, y = x0 + gx, y0 + gy
            if ch == 'o':
                cv.set(x, y, 'R0'); continue
            l = row[gx - 1] if gx > 0 else '.'
            r = row[gx + 1] if gx < 16 else '.'
            u = rows[gy - 1][gx] if gy > 0 else '.'
            base = {'x': 'R3', 'b': 'R4', 'w': 'R2', 'h': 'R4'}[ch]
            k = base
            if u in '.o' and ch in 'xw':
                k = 'R4'                                # top planes catch the moon
            if l in '.o' and ch != 'b':
                k = 'R4'
            if r in '.o':
                k = 'R2' if ch != 'w' else 'R1'
            if ch == 'b' and gx % 2 == 0 and gy > 8:
                k = 'R3'                                # braid grooves
            if ch == 'w' and gy == 27 and 2 < gx < 14:
                k = 'R3'
            fire_edge = (r in '.o') if gate_side > 0 else (l in '.o')
            if fire_edge and gy > 16 and gy % 2 == 0:
                k = 'F1'
            if ch == 'w' and gy >= 26 and fire_edge:
                k = 'F2'
            cv.set(x, y, k)
    # glowing rune eyes
    cv.set(x0 + 6, y0 + 6, 'F3'); cv.set(x0 + 10, y0 + 6, 'F3')


def draw():
    rng = random.Random(7)
    cv = Cv(PAL, 'N0')

    # ---------------------------------------------------------------- sky
    bands = [(0, 'N0'), (14, 'N1'), (28, 'N2'), (40, 'N3')]
    for y in range(H):
        for x in range(W):
            k = 'N0'
            for i, (y0, c) in enumerate(bands):
                if y >= y0:
                    k = c
                if i + 1 < len(bands):
                    y1, c1 = bands[i + 1]
                    if y1 - 4 <= y < y1 and y >= y0:
                        k = c1 if bay(x, y) < q4((y - (y1 - 4)) / 4) else c
            cv.set(x, y, k)
    for i in range(60):
        x, y = rng.randrange(W), rng.randrange(30)
        cv.set(x, y, 'S2' if i % 3 else 'S1')
    for (x, y) in [(12, 5), (46, 3), (88, 12), (60, 16)]:
        cv.set(x, y, 'SN')
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            cv.set(x + d[0], y + d[1], 'S2')
    # crescent moon, upper left
    MX, MY = 78, 9
    cv.disc(MX, MY, 4.5, 'SN')
    cv.disc(MX + 2, MY - 1, 4.0, 'N0')
    cv.set(MX - 4, MY, 'S1'); cv.set(MX - 3, MY + 3, 'S1')

    # ---------------------------------------------------------------- far snowy range
    far = smooth(mpd(random.Random(3), W, 9, 0.62), 1)
    for x in range(W):
        top = int(round(26 + far[x] - 6 * math.exp(-((x - 36) / 18.0) ** 2)))
        sl = far[min(W - 1, x + 1)] - far[max(0, x - 1)]
        for y in range(top, H):
            d = y - top
            if d < 4 - abs(sl):
                k = 'S1' if sl > 0 else 'S2'   # moon on the left: slopes rising to the right are lit
                if d == 0:
                    k = 'SN' if sl > 0 else 'S1'
            else:
                k = 'N3' if d < 9 else 'N2'
            cv.set(x, y, k)

    # ---------------------------------------------------------------- smoke stacks on a shoulder, left
    shoulder = smooth(mpd(random.Random(5), W, 3, 0.5), 2)
    for x in range(0, 100):
        top = int(round(41 + shoulder[x] + max(0, (x - 70)) * -0.2))
        for y in range(top, H):
            k = 'R1' if y - top > 1 else 'R2'
            cv.set(x, y, k)
    stacks = [(22, 23, 3), (36, 18, 4), (52, 26, 3)]
    # smoke first (behind the stack tops), drifting up and left
    for (sx, sy, w) in stacks:
        # one lumpy plume per stack: many puffs along a curve, shaded as a single mass
        r = random.Random(sx * 13)
        mask = {}
        n = 22
        for p in range(n):
            t = p / (n - 1)
            px_ = sx + w / 2 - 34 * t ** 1.4 + r.uniform(-1.5, 1.5) * t * 3
            py_ = sy - 2 - 26 * t ** 0.8 + r.uniform(-1.5, 1.5) * t * 2
            rad = 1.4 + 4.2 * t ** 0.8 * r.uniform(0.6, 1.15)
            for yy in range(int(py_ - rad) - 1, int(py_ + rad) + 2):
                for xx in range(int(px_ - rad * 1.2) - 1, int(px_ + rad * 1.2) + 2):
                    dx = (xx + 0.5 - px_) / (rad * 1.2); dy = (yy + 0.5 - py_) / rad
                    if dx * dx + dy * dy <= 1:
                        mask[(xx, yy)] = t
        for (xx, yy), t in mask.items():
            if t > 0.75 and bay(xx, yy) < (t - 0.75) * 3:
                continue                               # the far end thins out
            k = 'M0'
            if (xx - 1, yy - 1) not in mask or (xx, yy - 2) not in mask:
                k = 'M1'                               # moonlit upper-left rims
            if (xx, yy + 1) not in mask and t < 0.35:
                k = 'F0'                               # furnace glow on the underside
            cv.set(xx, yy, k)
    for (sx, sy, w) in stacks:
        for y in range(sy, 46):
            for x in range(sx, sx + w):
                k = 'R3' if x == sx else ('R1' if x == sx + w - 1 else 'R2')
                if (y - sy) % 3 == 0 and x != sx:
                    k = 'R1'
                cv.set(x, y, k)
        cv.hline(sx - 1, sx + w, sy, 'R3'); cv.set(sx + w, sy, 'R1')
        cv.hline(sx, sx + w - 1, sy - 1, 'F2'); cv.set(sx, sy - 1, 'F3')
    # furnace hall at the foot of the stacks
    cv.rect(14, 38, 64, 47, 'R2')
    for x in range(14, 64):
        cv.set(x, 37 - (0 if x % 8 < 4 else 1), 'R3')
        cv.set(x, 38, 'R3')
    for x in range(17, 62, 6):
        cv.rect(x, 41, x + 2, 44, 'F2'); cv.set(x, 41, 'F3')
    cv.hline(14, 63, 46, 'R1')

    # ---------------------------------------------------------------- the great mountain
    nz = vnoise(4)

    def crag(px_, py_, lw, rw, base, seed, snow_to, pw=0.8):
        """A rock crag: jagged left/right edges from the peak, a ridge splitting the moonlit
        left face from the shadowed right face, snow above snow_to."""
        r = random.Random(seed)
        hgt = base - py_
        le = mpd(r, hgt + 1, 3 + hgt * 0.09, 0.62)
        re_ = mpd(r, hgt + 1, 3 + hgt * 0.09, 0.62)
        ri = smooth(mpd(r, hgt + 1, 2.0, 0.6), 1)
        sn = mpd(r, 400, 2.0, 0.7)
        for y in range(max(0, py_), min(H, base + 1)):
            i_ = y - py_
            t = i_ / max(1, hgt)
            t2 = t ** pw
            xl = px_ - lw * t2 + (le[i_] - le[0]) * min(1, t * 3)
            xr = px_ + rw * t2 + (re_[i_] - re_[0]) * min(1, t * 3)
            xd = px_ + (rw * 0.25) * t + ri[i_] * t * 1.2
            for x in range(int(round(xl)), int(round(xr)) + 1):
                if not (0 <= x < W):
                    continue
                lit = x < xd
                # strata: faint diagonal ledges
                ledge = ((x // 2 + y) % 7 == 0) if lit else ((y - x // 3) % 6 == 0)
                if lit:
                    k = 'R3'
                    if x - xl < 2:
                        k = 'R4'
                    elif ledge:
                        k = 'R4' if nz(x / 3.0, y / 3.0) > 0.5 else 'R2'
                    elif xd - x < 1.5:
                        k = 'R4'
                else:
                    k = 'R1' if (x - xd) > 3 else 'R2'
                    if ledge and nz(x / 3.0, y / 3.0) > 0.45:
                        k = 'R2' if k == 'R1' else 'R1'
                st = snow_to + sn[(x * 3) % 400] * 1.5
                gully = nz(x / 2.0, 7.0) > 0.55
                if y < st or (y < st + 5 and gully and lit):
                    if lit:
                        k = 'SN' if x - xl > 1 and xd - x > 1 else 'S1'
                        if (x + y) % 9 == 0 and y > st - 3:
                            k = 'S1'
                    else:
                        k = 'S2' if (x - xd) > 1 else 'S1'
                cv.set(x, y, k)
            if 0 <= int(round(xr)) + 1 < W:
                cv.set(int(round(xr)) + 1, y, 'R0')

    crag(184, 4, 18, 30, 70, 31, 13, 0.85)
    crag(166, 12, 30, 20, 80, 36, 18, 0.8)
    crag(140, -6, 64, 42, 100, 34, 10, 0.72)
    crag(94, 10, 40, 18, 80, 33, 17, 0.7)
    crag(114, 18, 14, 10, 60, 37, 22, 0.9)
    # a long shoulder running down to the left instead of a lone cone
    for x in range(56, 100):
        top = int(round(40 - (x - 56) * 0.42 + 1.5 * math.sin(x * 0.5) + (1 if x % 7 == 0 else 0)))
        for y in range(top, 60):
            k = 'R3' if y - top < 2 else ('R2' if (x + y) % 6 else 'R3')
            if y - top > 6:
                k = 'R1'
            if y == top:
                k = 'R4'
            cv.set(x, y, k)

    # ---------------------------------------------------------------- carved facade
    GX = 138
    for y in range(14, 60):
        inset = max(0, 24 - y) * 3
        x0 = 96 + inset + int(1.5 * math.sin(y * 0.9) + (1 if y % 5 == 0 else 0))
        x1 = 180 - inset - int(1.5 * math.sin(y * 0.7 + 1) + (1 if y % 6 == 2 else 0))
        for x in range(x0, x1 + 1):
            row = (y - 17) // 4
            joint = (y - 17) % 4 == 3 or (x + (row % 2) * 5) % 10 == 0
            k = 'R2' if joint else 'R3'
            if x == x0:
                k = 'R4'
            if x == x1:
                k = 'R1'
            cv.set(x, y, k)
        cv.set(x0 - 1, y, 'R1'); cv.set(x1 + 1, y, 'R0')
    cv.hline(96, 180, 30, 'R1')   # carved band
    cv.hline(96, 180, 31, 'R4')
    # pillars framing the niches
    for px_ in (98, 176, 123, 153):
        for y in range(24, 60):
            cv.set(px_, y, 'R4'); cv.set(px_ + 1, y, 'R3'); cv.set(px_ + 2, y, 'R1')
    # niches behind guardians (deep shadow)
    for nx0 in (102, 157):
        cv.rect(nx0, 24, nx0 + 19, 56, 'R0')
        for i in range(4):
            cv.hline(nx0 + i, nx0 + 18 - i, 23 - i, 'R0')
        cv.vline(nx0, 20, 56, 'R0')
    # ---------------------------------------------------------------- the gate
    for y in range(22, 59):
        # stepped dwarven arch: narrows in steps near the top
        step = max(0, (30 - y)) // 2
        hw = 13 - step * 2
        for x in range(GX - hw - 3, GX + hw + 4):
            if x < GX - hw or x > GX + hw:
                k = 'R4' if x < GX else 'R2'
                if x == GX - hw - 3:
                    k = 'R3'
                if x == GX + hw + 3:
                    k = 'R0'
                cv.set(x, y, k)
                continue
            # interior: furnace glow, hottest low in the hall
            t = (y - 22) / 36.0
            if t > 0.75:
                k = 'F4' if bay(x, y) < q4((t - 0.75) * 6) else 'F3'
            elif t > 0.5:
                k = 'F3' if bay(x, y) < q4((t - 0.5) * 4) else 'F2'
            elif t > 0.25:
                k = 'F2' if bay(x, y) < q4((t - 0.25) * 4) else 'F1'
            else:
                k = 'F1' if bay(x, y) < q4(t * 4) else 'F0'
            cv.set(x, y, k)
    # receding inner pillars and a long stair, silhouetted
    for (ix, w_) in ((GX - 8, 2), (GX + 7, 2), (GX - 4, 1), (GX + 4, 1)):
        top = 30 if w_ == 2 else 34
        cv.rect(ix, top, ix + w_, 59, 'F0' if w_ == 1 else 'R0')
    for i in range(6):
        y = 52 + i
        cv.hline(GX - 3 - i, GX + 3 + i, y, 'F1' if i % 2 else 'F2')
    # lintel with a great carved gear (the city's emblem)
    cv.rect(GX - 17, 18, GX + 18, 22, 'R3')
    cv.hline(GX - 17, GX + 17, 18, 'R4'); cv.hline(GX - 17, GX + 17, 21, 'R1')
    gcx, gcy = GX + 0.5, 12.5
    for y in range(4, 22):
        for x in range(GX - 9, GX + 10):
            dx, dy = x + 0.5 - gcx, y + 0.5 - gcy
            r_ = math.hypot(dx, dy); a = math.atan2(dy, dx)
            tooth = (math.cos(a * 8) > 0.3)
            if r_ <= 5.6 + (1.6 if tooth else 0):
                k = 'R3'
                if r_ <= 2.2:
                    k = 'F3' if r_ <= 1.2 else 'R0'
                elif r_ > 5.6 + (0.6 if tooth else -1) or r_ < 3.4:
                    k = 'R4' if dx + dy < 0 else 'R1'
                cv.set(x, y, k)
    # runes along the lintel glow faintly
    for x in range(GX - 15, GX + 16, 3):
        cv.set(x, 20, 'F1'); cv.set(x + 1, 19, 'F1')

    # ---------------------------------------------------------------- banners between pillars and gate
    for bx in (126, 147):
        cv.vline(bx, 32, 47, 'F1'); cv.vline(bx + 1, 32, 47, 'F1'); cv.vline(bx + 2, 32, 46, 'F0')
        cv.hline(bx - 1, bx + 3, 32, 'R4')
        cv.set(bx, 48, 'F1'); cv.set(bx + 2, 47, 'F0')
        cv.set(bx + 1, 36, 'F3'); cv.set(bx, 37, 'F3'); cv.set(bx + 2, 37, 'F3'); cv.set(bx + 1, 38, 'F3')
        cv.vline(bx, 33, 46, 'F2')

    # ---------------------------------------------------------------- guardians
    guardian(cv, 103, 24, +1)
    guardian(cv, 157, 24, -1)
    for gx0 in (102, 156):   # plinths
        cv.rect(gx0, 56, gx0 + 19, 60, 'R3')
        cv.hline(gx0, gx0 + 18, 56, 'R4'); cv.hline(gx0, gx0 + 18, 59, 'R1')
        cv.vline(gx0 + 18, 56, 59, 'R1')

    for y in range(58, H):
        for x in range(84, W):
            k = 'R1' if (x * 3 + y * 5) % 23 else 'R2'
            if y > 66:
                k = 'R0' if bay(x, y) < q4((y - 66) / 5) else k
            cv.set(x, y, k)
    # ---------------------------------------------------------------- plaza + braziers
    for y in range(59, 63):
        for x in range(92, 186):
            k = 'R3' if (y - 59) % 2 == 0 else 'R2'
            if x == 92 + (y - 59) * -1:
                k = 'R1'
            cv.set(x - (y - 59), y, k)
    def brazier(x, y):
        cv.rect(x - 1, y - 4, x + 2, y + 1, 'R1')   # stand
        cv.hline(x - 2, x + 2, y - 4, 'R4'); cv.hline(x - 2, x + 2, y - 3, 'R2')
        cv.hline(x - 2, x + 2, y + 1, 'R0')
        flame = [(-1, -5, 'F2'), (0, -5, 'F3'), (1, -5, 'F2'), (0, -6, 'F4'), (-1, -6, 'F3'), (1, -6, 'F2'),
                 (0, -7, 'F3'), (-1, -7, 'F2'), (0, -8, 'F2'), (1, -8, 'F1'), (0, -9, 'F1')]
        for dx, dy, k in flame:
            cv.set(x + dx, y + dy, k)
    brazier(120, 59)
    brazier(156, 59)
    brazier(100, 59)
    brazier(178, 59)

    # ---------------------------------------------------------------- molten river, out of the gate to the lower right
    for y in range(59, H):
        t = (y - 59) / (H - 59)
        cx = GX + 6 + 40 * t * t + 10 * t
        hw = 3 + 13 * t
        x0, x1 = int(round(cx - hw)), int(round(cx + hw))
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            n = nz(x / 4.0 - y * 0.3, y / 1.5)
            k = 'F2'
            if n > 0.62:
                k = 'F4' if n > 0.75 else 'F3'
            elif n < 0.28:
                k = 'F1'                     # cooling crust plates
            if u < 0.08 or u > 0.92:
                k = 'F3' if u < 0.5 else 'F1'
            cv.set(x, y, k)
        cv.set(x0 - 1, y, 'R2'); cv.set(x1 + 1, y, 'R0')
        if y % 2:
            for xx in range(x0 - 4, x0 - 1):
                if cv.get(xx, y) in ROCK:
                    cv.set(xx, y, 'F0')
    # stone bridge across the flow
    for x in range(146, 176):
        y = 66 - (1 if 152 < x < 170 else 0)
        cv.set(x, y, 'R4'); cv.set(x, y + 1, 'R2'); cv.set(x, y + 2, 'R1')
    for x in range(154, 169):
        cv.set(x, 68, 'R1')
    cv.set(161, 64, 'R3'); cv.set(161, 63, 'F3'); cv.set(162, 64, 'R1')   # a dwarf with a lantern

    # ---------------------------------------------------------------- trestle with mine carts, left
    RY = 44
    # chasm under it
    for x in range(0, 100):
        for y in range(RY + 2, H):
            if x < 90 or y > 47:
                cv.set(x, y, 'R0' if y > 50 or bay(x, y) < q4((y - RY) / 6) else 'R1')
    for x in range(0, 101):
        cv.set(x, RY, 'R4'); cv.set(x, RY + 1, 'T'); cv.set(x, RY + 2, 'R0')
    for x in range(4, 100, 12):
        for y in range(RY + 3, H):
            cv.set(x, y, 'R1')
            cv.set(x + 6, y, 'R1') if False else None
        for i in range(0, 12):
            y1 = RY + 3 + i
            if y1 < H:
                cv.set(x + i, y1, 'R1' if (x + i) % 2 else 'R2')
                cv.set(x + 11 - i, y1, 'R1')
        cv.hline(x, x + 12, RY + 14, 'R1')
    # tunnel portal where the rails meet the mountain
    for y in range(34, 44):
        hw = 5 if y > 36 else (4 if y > 34 else 2)
        cv.hline(96 - hw, 96 + hw, y, 'R0')
        cv.set(96 - hw - 1, y, 'T'); cv.set(96 + hw + 1, y, 'R1')
    cv.hline(93, 99, 33, 'T')
    cv.set(96, 38, 'F2'); cv.set(96, 37, 'F3')
    def minecart(x, ore=True):
        y = RY - 1
        cv.rect(x, y - 4, x + 7, y, 'R3')
        cv.hline(x, x + 6, y - 4, 'R4'); cv.vline(x + 6, y - 4, y - 1, 'R1'); cv.set(x, y - 2, 'R4')
        cv.hline(x + 1, x + 5, y - 2, 'R2')
        if ore:
            for (dx, dy, k) in [(1, -5, 'F2'), (2, -5, 'F3'), (3, -6, 'F4'), (4, -5, 'F2'), (5, -5, 'F1'), (3, -5, 'F3'), (2, -6, 'F2')]:
                cv.set(x + dx, y + dy, k)
        cv.set(x + 1, y, 'R0'); cv.set(x + 5, y, 'R0')
    minecart(66)
    minecart(75)
    minecart(5, ore=False)
    # a dwarf pushing the train
    cv.set(85, RY - 4, 'R4'); cv.set(85, RY - 3, 'F1'); cv.set(85, RY - 2, 'F1'); cv.set(84, RY - 1, 'R0'); cv.set(86, RY - 1, 'R0')
    cv.set(84, RY - 3, 'R3'); cv.set(84, RY - 4, 'F3')

    # warm light from the gate: solid tones on the jamb faces and the plaza in front, no speckle
    for y in range(24, 59):
        cv.set(GX - 14, y, 'F1'); cv.set(GX + 14, y, 'F1')
    for y in range(59, 63):
        for x in range(GX - 16, GX + 17):
            if cv.get(x, y) in ('R3', 'R2') and abs(x - GX) < 16 - (y - 59) * 2:
                cv.set(x, y, 'F1' if cv.get(x, y) == 'R2' else 'F2')
    return cv
