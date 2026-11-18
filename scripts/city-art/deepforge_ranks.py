"""Deepforge in five ranks: the same moonlit mountain, foundry shoulder and carved gate, growing
from a lone mine entrance with one smelter into a golden mountain hold. Palette and helpers come
from the original Deepforge banner (deepforge.py); rank II is that banner. Canvas 192x72."""
import random, math
from rank_engine import *

W, H = 192, 72

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
    # gold (the hold's gate and crowns) and a royal blue for banners and fireworks
    'AD': '#7a4a22', 'AU': '#c8892e', 'BL': '#3d5fa8', 'BH': '#8fc4ff',
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

# A colossal crowned king for the capital: drawn as the left half and mirrored.
# c crown (gold), e glowing eyes, b beard, x stone, h hands, s sword hilt (gold),
# g blade, H belt, w robe hem, o carved outline.
_KING_HALF = [
    ".........c.",
    "......c.ccc",
    "......cccCc",
    "......ocCCC",
    ".....oxxxxx",
    ".....oxxxxx",
    ".....oxexxx",
    ".....oxxxxx",
    ".....obxxxb",
    "...oooobbbb",
    ".ooxxxobbbb",
    "oxxxxxobbbb",
    "oxxxxxobbbb",
    "oxxxoxobbbb",
    "oxxxoxxobbb",
    "oxxxoxxobbb",
    "oxxxoxxxobb",
    "oxxxxoxxxob",
    "oxxxxxoxxxo",
    ".oxxxxxhhhs",
    "..oxxxxhhhs",
    "..oxxxxsssS",
    "..oxxxxxxog",
    "..oHHHHHHog",
    "..oxxxxxxog",
    "..oxxxxxxog",
    "..oxxxxxoxg",
    "..oxxxxxoxg",
    "..oxxxxoxxg",
    "..oxxxxoxxg",
    ".oxxxxoxxxg",
    ".oxxxxoxxxg",
    ".oxxxxoxxog",
    ".owwwwwwwwo",
    ".owwwwwwwww",
    "oowwwwwwwww",
    "ooooooooooo",
]
KING = [r + r[-2::-1] for r in _KING_HALF]
for r in KING:
    assert len(r) == 21, r


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


def guardian(cv, x0, y0, gate_side, rows=GUARD, crown=False):
    """Carved stone guardian. Moonlight from the left; the gate fire rims the gate-facing side."""
    n = len(rows)
    wd = len(rows[0])
    for gy, row in enumerate(rows):
        for gx, ch in enumerate(row):
            if ch == '.':
                continue
            x, y = x0 + gx, y0 + gy
            if ch == 'o':
                cv.set(x, y, 'R0'); continue
            if ch in 'cC':
                cv.set(x, y, 'AU' if ch == 'C' else ('F4' if gx < wd // 2 else 'F3')); continue
            if ch in 'sS':
                cv.set(x, y, 'F3' if ch == 's' else 'AU'); continue
            if ch == 'e':
                cv.set(x, y, 'F3'); continue
            if ch == 'g':
                cv.set(x, y, 'S1' if gy % 3 else 'SN'); continue
            if ch == 'H':
                cv.set(x, y, 'AU' if gx % 3 else 'F3'); continue
            l = row[gx - 1] if gx > 0 else '.'
            r = row[gx + 1] if gx < wd - 1 else '.'
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
            if ch == 'w' and gy == n - 5 and 2 < gx < wd - 3:
                k = 'R3'
            fire_edge = (r in '.o') if gate_side > 0 else (l in '.o')
            if fire_edge and gy > n // 2 and gy % 2 == 0:
                k = 'F1'
            if ch == 'w' and gy >= n - 6 and fire_edge:
                k = 'F2'
            cv.set(x, y, k)
    if rows is GUARD:
        cv.set(x0 + 6, y0 + 6, 'F3'); cv.set(x0 + 10, y0 + 6, 'F3')
        if crown:
            for gx, k in ((5, 'F4'), (7, 'F3'), (9, 'F4'), (11, 'F3')):
                cv.set(x0 + gx, y0 - 1, k)
            cv.hline(x0 + 5, x0 + 11, y0, 'AU'); cv.set(x0 + 8, y0, 'F4')


def flag(cv, x, ytop, h, col='F1', length=5, shade='F0'):
    cv.vline(x, ytop, ytop + h, 'R0')
    cv.set(x, ytop - 1, 'F3')
    for i in range(length):
        dy = 1 if (i % 4) in (1, 2) else 0
        cv.set(x + 1 + i, ytop + dy, col)
        if i < length - 1:
            cv.set(x + 1 + i, ytop + 1 + dy, shade)
            if i < length - 3:
                cv.set(x + 1 + i, ytop + 2 + dy, col if i % 2 else shade)


def banner(cv, x, y0, y1, col='F1', shade='F0', mark='F3'):
    """Long hanging banner, 3 wide, swallowtail end, a gold sigil."""
    cv.hline(x - 1, x + 3, y0, 'R4')
    for y in range(y0 + 1, y1 + 1):
        cv.set(x, y, col if col != 'F1' else 'F2'); cv.set(x + 1, y, col); cv.set(x + 2, y, shade)
    cv.set(x, y1 + 1, col); cv.set(x + 2, y1 + 1, shade)
    my = y0 + (y1 - y0) // 3
    cv.set(x + 1, my, mark); cv.set(x, my + 1, mark); cv.set(x + 2, my + 1, mark); cv.set(x + 1, my + 2, mark)


def brazier(cv, x, y, big=True):
    cv.rect(x - 1, y - 4, x + 2, y + 1, 'R1')   # stand
    cv.hline(x - 2, x + 2, y - 4, 'R4'); cv.hline(x - 2, x + 2, y - 3, 'R2')
    cv.hline(x - 2, x + 2, y + 1, 'R0')
    flame = [(-1, -5, 'F2'), (0, -5, 'F3'), (1, -5, 'F2'), (0, -6, 'F4'), (-1, -6, 'F3'), (1, -6, 'F2'),
             (0, -7, 'F3'), (-1, -7, 'F2'), (0, -8, 'F2'), (1, -8, 'F1'), (0, -9, 'F1')]
    for dx, dy, k in flame[:None if big else 6]:
        cv.set(x + dx, y + dy, k)


def fire_pot(cv, x, y):
    """Small brazier on a wall top."""
    cv.hline(x - 1, x + 1, y, 'R4'); cv.set(x, y + 1, 'R1')
    cv.set(x, y - 1, 'F4'); cv.set(x - 1, y - 1, 'F2'); cv.set(x + 1, y - 1, 'F3')
    cv.set(x, y - 2, 'F3'); cv.set(x, y - 3, 'F1')


def lit_window(cv, x, y, tall=2):
    cv.set(x, y - 1, 'R0')
    for i in range(tall):
        cv.set(x, y + i, 'F3' if i == 0 else 'F2')
    cv.set(x + 1, y, 'R0') if cv.get(x + 1, y) in ROCK else None


def dwarf(cv, x, yb, lantern=True, col='F1'):
    cv.set(x, yb - 3, 'R4'); cv.set(x, yb - 2, col); cv.set(x, yb - 1, col); cv.set(x, yb, 'R0')
    if lantern:
        cv.set(x + 1, yb - 2, 'F4')


def firework(cv, cx, cy, r, c1, c2):
    for i in range(12):
        a = i * math.pi / 6
        for j, rr in enumerate((r * 0.45, r * 0.8, r)):
            x = cx + math.cos(a) * rr; y = cy + math.sin(a) * rr * 0.9
            if cv.get(x, y) in ('N0', 'N1', 'N2', 'N3', 'M0', 'M1', 'S2'):
                cv.set(x, y, c1 if j < 2 else c2)
    cv.set(cx, cy, 'F4')
    for i in range(1, 5):
        if cv.get(cx, cy + r + i * 2) in ('N0', 'N1', 'N2', 'N3'):
            cv.set(cx, cy + r + i * 2, 'F1' if i > 2 else 'F2')


def draw(rank):
    T = rank
    rng = random.Random(7)
    cv = Cv(PAL, 'N0', W, H)

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
                k = 'S1' if sl > 0 else 'S2'
                if d == 0:
                    k = 'SN' if sl > 0 else 'S1'
            else:
                k = 'N3' if d < 9 else 'N2'
            cv.set(x, y, k)

    # ---------------------------------------------------------------- the shoulder, left
    shoulder = smooth(mpd(random.Random(5), W, 3, 0.5), 2)
    for x in range(0, 100):
        top = int(round(41 + shoulder[x] + max(0, (x - 70)) * -0.2))
        for y in range(top, H):
            k = 'R1' if y - top > 1 else 'R2'
            cv.set(x, y, k)

    stacks = {1: [(36, 27, 3)],
              2: [(22, 23, 3), (36, 18, 4), (52, 26, 3)]}.get(T, [(8, 27, 3), (22, 23, 3), (36, 18, 4), (45, 24, 3), (52, 26, 3)])
    if T >= 4:
        stacks = [(8, 25, 3), (22, 21, 3), (36, 15, 5), (45, 22, 3), (52, 24, 3)]
    # smoke first (behind the stack tops), drifting up and left
    for si, (sx, sy, w) in enumerate(stacks):
        r = random.Random(sx * 13)
        mask = {}
        n = 22
        reach = 1.0 if T > 1 else 0.85
        if len(stacks) > 3 and sx in (8, 45):
            reach = 0.6
        for p in range(n):
            t = p / (n - 1)
            px_ = sx + w / 2 - 34 * t ** 1.4 * reach + r.uniform(-1.5, 1.5) * t * 3
            py_ = sy - 2 - 26 * t ** 0.8 * reach + r.uniform(-1.5, 1.5) * t * 2
            rad = 1.4 + 4.2 * t ** 0.8 * r.uniform(0.6, 1.15) * (0.8 + 0.2 * reach)
            for yy in range(int(py_ - rad) - 1, int(py_ + rad) + 2):
                for xx in range(int(px_ - rad * 1.2) - 1, int(px_ + rad * 1.2) + 2):
                    dx = (xx + 0.5 - px_) / (rad * 1.2); dy = (yy + 0.5 - py_) / rad
                    if dx * dx + dy * dy <= 1:
                        mask[(xx, yy)] = t
        for (xx, yy), t in mask.items():
            if t > 0.75 and bay(xx, yy) < (t - 0.75) * 3:
                continue
            k = 'M0'
            if (xx - 1, yy - 1) not in mask or (xx, yy - 2) not in mask:
                k = 'M1'
            if (xx, yy + 1) not in mask and t < 0.35:
                k = 'F0'
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
        if T >= 4:
            cv.set(sx, sy - 2, 'F4') if (sx // 2) % 2 else cv.set(sx + 1, sy - 3, 'F3')   # sparks

    def tower(tx, ty, tw, yb, flagged):
        for y in range(ty, yb + 1):
            for x in range(tx, tx + tw):
                k = 'R3' if x == tx else ('R1' if x == tx + tw - 1 else 'R2')
                if (y - ty) % 4 == 3 and tx < x < tx + tw - 1:
                    k = 'R1'
                cv.set(x, y, k)
            cv.set(tx + tw, y, 'R0')
        for x in range(tx - 1, tx + tw + 1):
            cv.set(x, ty, 'R4')
            if (x - tx) % 2 == 0:
                cv.set(x, ty - 1, 'R4')
        for wy in range(ty + 4, min(yb - 4, 56), 7):
            cv.set(tx + tw // 2, wy, 'F3'); cv.set(tx + tw // 2, wy + 1, 'F2')
        fire_pot(cv, tx + tw // 2, ty - 2)
        if flagged:
            flag(cv, tx + 1, ty - 9, 7, 'F1' if T < 5 else 'BL', 5, 'F0' if T < 5 else 'N2')

    # ---------------------------------------------------------------- foundry on the shoulder
    if T == 1:
        # a small stone forge hut at the smelter's foot, its door glowing
        cv.rect(28, 39, 44, 47, 'R2')
        cv.vline(28, 39, 46, 'R3'); cv.vline(43, 39, 46, 'R1')
        for i in range(4):
            cv.hline(27 + i, 44 - i, 38 - i, 'T' if i % 2 == 0 else 'R1')
            cv.set(27 + i, 38 - i, 'R4')
        cv.rect(31, 41, 35, 47, 'F2'); cv.hline(31, 34, 41, 'F3'); cv.rect(32, 44, 34, 47, 'F4')
        cv.set(38, 42, 'F2'); cv.set(39, 42, 'F2')
        # anvil and a smith outside
        cv.hline(23, 26, 43, 'R4'); cv.set(24, 44, 'R2'); cv.set(25, 44, 'R2'); cv.hline(23, 26, 45, 'R1')
        dwarf(cv, 21, 46, lantern=False); cv.set(22, 42, 'R4')
        cv.set(25, 42, 'F4'); cv.set(26, 41, 'F3')                                   # sparks off the anvil
        hall_x0, hall_x1 = 28, 44
    else:
        top = 38 if T < 4 else 33
        cv.rect(14, top, 64, 47, 'R2')
        for x in range(14, 64):
            cv.set(x, top - 1 - (0 if x % 8 < 4 else 1), 'R3')
            cv.set(x, top, 'R3')
        for x in range(17, 62, 6):
            cv.rect(x, 41, x + 2, 44, 'F2'); cv.set(x, 41, 'F3')
        cv.hline(14, 63, 46, 'R1')
        if T >= 4:
            # an upper storey of lit windows
            for x in range(16, 63, 4):
                cv.set(x, 35, 'F3'); cv.set(x, 36, 'F1')
            cv.hline(14, 63, 38, 'R1'); cv.hline(14, 63, 39, 'R3')
        if T >= 3:
            # the great arched furnace mouth, roaring from rank III
            for y in range(39, 47):
                hw = 5 if y > 40 else 4
                for x in range(36 - hw, 37 + hw):
                    t = (y - 39) / 7
                    k = 'F4' if bay(x, y) < q4(t * 1.4 - 0.2) else 'F3'
                    if abs(x - 36) >= hw - 0 and y < 43:
                        k = 'F2'
                    cv.set(x, y, k)
                cv.set(36 - hw - 1, y, 'R4'); cv.set(37 + hw, y, 'R0')
            cv.hline(30, 42, 38, 'R4'); cv.hline(33, 39, 37, 'R4')
        if T >= 4:
            # the great bellows on the roof, pumped by a beam
            cv.poly([(22, 32), (32, 30), (32, 33), (22, 33)], 'T')
            cv.hline(22, 32, 30 + 0, 'R0'); cv.hline(22, 32, 33, 'R0')
            for x in range(23, 32, 2):
                cv.set(x, 31, 'R0'); cv.set(x, 32, 'F0')
            cv.line(20, 28, 34, 31, 'R4')
        if T >= 3:
            # crenellated parapet and fire pots along the hall wall
            for x in range(14, 64):
                if x % 4 < 2:
                    cv.set(x, top - 3, 'R3'); cv.set(x, top - 2, 'R3')
                cv.set(x, top - 2, 'R2') if x % 4 >= 2 else None
            cv.hline(14, 63, top - 1, 'R4')
            for x in (24, 40, 50):
                fire_pot(cv, x, top - 4)
            # red pennants over the parapet: the foundry flies the hold's colours from rank III
            for x in (17, 31, 45, 59):
                flag(cv, x, top - 13, 10, 'F1' if T < 5 else 'BL', 5, 'F0' if T < 5 else 'N2')
            # squat towers at both ends of the foundry wall
            tower(11, top - 9, 5, 46, T >= 4)
            tower(61, top - 9, 5, 46, T >= 4)
        hall_x0, hall_x1 = 14, 64

    # ---------------------------------------------------------------- the great mountain
    nz = vnoise(4)

    def crag(px_, py_, lw, rw, base, seed, snow_to, pw=0.8):
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
    for x in range(56, 100):
        top = int(round(40 - (x - 56) * 0.42 + 1.5 * math.sin(x * 0.5) + (1 if x % 7 == 0 else 0)))
        for y in range(top, 60):
            k = 'R3' if y - top < 2 else ('R2' if (x + y) % 6 else 'R3')
            if y - top > 6:
                k = 'R1'
            if y == top:
                k = 'R4'
            cv.set(x, y, k)

    # ---------------------------------------------------------------- halls carved high in the cliff (IV+)
    def terrace(x0, x1, y, lit_every=2):
        """A gallery cut into the rock face: ledge, columns, lit openings, a parapet."""
        cv.rect(x0, y - 6, x1 + 1, y, 'R0')
        cv.hline(x0 - 1, x1 + 1, y - 7, 'R4'); cv.hline(x0 - 1, x1 + 1, y - 8, 'R3')
        for x in range(x0, x1 + 1):
            if (x - x0) % 3 == 0:
                cv.vline(x, y - 6, y - 1, 'R3'); cv.set(x, y - 6, 'R4')
            elif ((x - x0) // 3) % lit_every == 0:
                cv.vline(x, y - 5, y - 1, 'F2'); cv.set(x, y - 5, 'F3')
                if (x - x0) % 3 == 1:
                    cv.set(x, y - 4, 'F4')
            else:
                cv.set(x, y - 1, 'F0')
        cv.hline(x0 - 2, x1 + 2, y, 'R4'); cv.hline(x0 - 2, x1 + 2, y + 1, 'R1')
        for x in range(x0 - 1, x1 + 2, 2):
            cv.set(x, y - 1, 'R2') if (x - x0) % 3 == 0 else None
        for x in range(x0, x1 + 1, 4):
            cv.set(x, y + 2, 'R0')

    if T >= 4:
        terrace(160, 186, 18)
        terrace(100, 117, 20, lit_every=1 if T == 5 else 2)
        if T == 5:
            terrace(166, 182, 9, lit_every=1)
    if T >= 3:
        # towers and walls guarding the hold's flanks
        tower(83, 26 if T == 3 else 18, 6, H, T >= 4)
        for x in range(183, W):
            for y in range(50, 59):
                cv.set(x, y, 'R2' if (y - 50) % 3 != 2 and (x + (y // 3) * 3) % 6 else 'R1')
            cv.set(x, 50, 'R4')
            if x % 3 == 0:
                cv.set(x, 49, 'R4'); cv.set(x, 48, 'R3')
        fire_pot(cv, 187, 47)
        if T >= 4:
            tower(182, 10, 6, 58, True)
    if T >= 4:
        # aqueduct of molten metal from the mountain to the foundry
        AY = 30
        for x in range(58, 82):
            cv.set(x, AY - 1, 'R4'); cv.set(x, AY, 'F3' if (x // 2) % 3 else 'F4'); cv.set(x, AY + 1, 'R3'); cv.set(x, AY + 2, 'R1')
        for px_ in (60, 68, 76):
            for y in range(AY + 3, 46):
                if cv.get(px_, y) in ('R0', 'R1', 'R2', 'R3', 'R4', 'N2', 'N3', 'M0', 'M1', 'S1', 'S2', 'SN', 'F0'):
                    cv.set(px_, y, 'R3'); cv.set(px_ + 1, y, 'R1')
            cv.set(px_ - 1, AY + 3, 'R2'); cv.set(px_ + 2, AY + 3, 'R1')
        for i in range(4):     # arches
            cv.set(62 + i * 2, AY + 3 + (1 if i in (1, 2) else 0), 'R1')
            cv.set(70 + i * 2, AY + 3 + (1 if i in (1, 2) else 0), 'R1')
        # the pour, falling into the furnace roof
        for y in range(AY, 34):
            cv.set(57, y, 'F3'); cv.set(56, y, 'F2' if y % 2 else 'F4')
        cv.set(55, 33, 'F3'); cv.set(58, 33, 'F2'); cv.set(54, 32, 'F4')
        # windows dotted over the cliff
        rr = random.Random(41)
        n_win = 14 if T == 4 else 30
        placed = 0
        while placed < n_win:
            x = rr.randrange(96, 190); y = rr.randrange(6, 30)
            if all(cv.get(x + dx, y + dy) in ('R1', 'R2', 'R3') for dx in (-1, 0, 1) for dy in (-1, 0, 1, 2)):
                lit_window(cv, x, y)
                placed += 1

    # ---------------------------------------------------------------- the gate
    GX = 138
    if T == 1:
        # a timbered mine entrance cut into the rock
        for y in range(44, 59):
            hw = 6 if y > 46 else (5 if y > 44 else 3)
            cv.hline(GX - hw, GX + hw, y, 'R0')
        # receding inner frame and the glow of the working face deep inside
        cv.rect(GX - 2, 51, GX + 3, 59, 'F0')
        cv.rect(GX - 1, 54, GX + 2, 59, 'F1')
        cv.hline(GX - 1, GX + 1, 57, 'F2'); cv.set(GX, 56, 'F3')
        cv.vline(GX - 3, 49, 58, 'T'); cv.vline(GX + 3, 49, 58, 'R1'); cv.hline(GX - 3, GX + 3, 49, 'T')
        cv.set(GX + 1, 52, 'F4')
        for (px_, k1) in ((GX - 7, 'T'), (GX + 7, 'T')):
            cv.vline(px_, 45, 58, k1); cv.vline(px_ + (1 if px_ > GX else -1), 45, 58, 'R0')
        cv.hline(GX - 8, GX + 8, 44, 'T'); cv.hline(GX - 8, GX + 8, 43, 'R4'); cv.hline(GX - 8, GX + 8, 45, 'R0')
        cv.set(GX - 7, 44, 'R4')
        cv.vline(GX - 7, 45, 58, 'T'); cv.set(GX - 7, 46, 'R4')
        # a lantern on the post, a sign of crossed picks
        cv.set(GX - 9, 47, 'R0'); cv.set(GX - 9, 48, 'F4'); cv.set(GX - 10, 48, 'F2')
        cv.line(GX - 2, 40, GX + 2, 42, 'R4'); cv.line(GX + 2, 40, GX - 2, 42, 'R4')
        # rough ground below
        for y in range(58, H):
            for x in range(84, W):
                k = 'R1' if (x * 3 + y * 5) % 23 else 'R2'
                if y == 58:
                    k = 'R3' if x % 5 else 'R2'
                if y > 66:
                    k = 'R0' if bay(x, y) < q4((y - 66) / 5) else k
                cv.set(x, y, k)
        # rails out of the mine, a cart and a spoil heap
        for i, y in enumerate(range(59, H)):
            cv.set(GX - 3 - i, y, 'R4'); cv.set(GX + 3 + i, y, 'R4')
            if y % 2 == 0:
                cv.hline(GX - 2 - i, GX + 2 + i, y, 'T')
        cy = 64
        cv.rect(GX - 4, cy, GX + 5, cy + 5, 'R3'); cv.hline(GX - 4, GX + 4, cy, 'R4'); cv.vline(GX + 4, cy, cy + 4, 'R1')
        cv.vline(GX - 4, cy, cy + 4, 'R4'); cv.hline(GX - 3, GX + 3, cy + 2, 'R2')
        for (dx, dy, k) in [(-3, -1, 'F2'), (-2, -1, 'F3'), (-1, -2, 'F4'), (0, -1, 'F3'), (1, -1, 'F2'), (2, -1, 'F1'), (-1, -1, 'F3')]:
            cv.set(GX + dx, cy + dy, k)
        cv.set(GX - 3, cy + 5, 'R0'); cv.set(GX + 3, cy + 5, 'R0')
        # timber headframe with a hoist wheel above the entrance
        cv.line(GX - 7, 42, GX - 1, 31, 'T'); cv.line(GX + 7, 42, GX + 1, 31, 'T')
        cv.line(GX - 6, 42, GX, 31, 'R0'); cv.hline(GX - 4, GX + 4, 37, 'T')
        for a in range(16):
            ang = a * math.pi / 8
            cv.set(GX + 0.5 + math.cos(ang) * 3, 31 + math.sin(ang) * 3, 'R4' if math.cos(ang) + math.sin(ang) < 0 else 'T')
        cv.set(GX, 31, 'R4'); cv.line(GX + 3, 31, GX + 3, 43, 'R0')
        # a miners' hut with a lit window
        hx0 = 150
        cv.rect(hx0, 51, hx0 + 11, 59, 'T'); cv.vline(hx0, 51, 58, 'R4'); cv.vline(hx0 + 10, 51, 58, 'R0')
        for i in range(4):
            cv.hline(hx0 - 1 + i, hx0 + 11 - i, 50 - i, 'R2' if i % 2 else 'R3'); cv.set(hx0 - 1 + i, 50 - i, 'R4')
        cv.set(hx0 + 3, 54, 'F3'); cv.set(hx0 + 4, 54, 'F3'); cv.set(hx0 + 3, 55, 'F2'); cv.set(hx0 + 4, 55, 'F2')
        cv.vline(hx0 + 7, 54, 58, 'R0')
        cv.vline(hx0 + 9, 44, 47, 'R2'); cv.set(hx0 + 9, 43, 'R3')
        for j in range(6):
            cv.set(hx0 + 9 - j * 0.8, 42 - j, 'M1' if j % 2 else 'M0')
        for y in range(54, 64):
            hw = (y - 53) * 1.6
            for x in range(int(176 - hw), int(176 + hw) + 1):
                k = 'R3' if x < 176 - hw / 3 else 'R2'
                if (x * 7 + y * 3) % 11 == 0:
                    k = 'R4'
                if x > 176 + hw * 0.6:
                    k = 'R1'
                cv.set(x, y, k)
        dwarf(cv, 150, 64); dwarf(cv, 125, 63, lantern=False, col='T'); cv.line(124, 59, 127, 61, 'R4')
        # the small forge's glow in the pit and a smelt trickle running into a mould
        for x in range(150, 158):
            cv.set(x, 69, 'F1' if x % 2 else 'F2')
        cv.hline(149, 158, 70, 'R0')
        brazier(cv, 118, 59, big=False)
        brazier(cv, 158, 59, big=False)
    else:
        big = T == 5
        fx0, fx1, ftop = (96, 180, 14) if not big else (92, 186, 14)
        for y in range(ftop, 60):
            inset = max(0, ftop + 10 - y) * 3
            x0 = fx0 + inset + int(1.5 * math.sin(y * 0.9) + (1 if y % 5 == 0 else 0))
            x1 = fx1 - inset - int(1.5 * math.sin(y * 0.7 + 1) + (1 if y % 6 == 2 else 0))
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
        band = 30 if not big else 31
        cv.hline(fx0, fx1, band, 'R1')
        cv.hline(fx0, fx1, band + 1, 'R4' if not big else 'AU')
        if big:
            for x in range(fx0 + 2, fx1, 4):
                cv.set(x, band + 1, 'F3')
        pillars = (98, 176, 123, 153) if not big else (94, 182, 123, 153)
        for px_ in pillars:
            for y in range(band - 6, 60):
                cv.set(px_, y, 'R4'); cv.set(px_ + 1, y, 'R3'); cv.set(px_ + 2, y, 'R1')
        if not big:
            for nx0 in (102, 157):
                cv.rect(nx0, 24, nx0 + 19, 56, 'R0')
                for i in range(4):
                    cv.hline(nx0 + i, nx0 + 18 - i, 23 - i, 'R0')
                cv.vline(nx0, 20, 56, 'R0')
        else:
            for nx0 in (97, 157):
                cv.rect(nx0, 16, nx0 + 25, 56, 'R0')
                for i in range(5):
                    cv.hline(nx0 + i, nx0 + 24 - i, 15 - i, 'R0')
                # braziers at the king's feet light the niche from below
                for y in range(14, 56):
                    for x in range(nx0 + 1, nx0 + 24):
                        t = (y - 14) / 42
                        k = 'R0'
                        if t > 0.05:
                            k = 'R1' if bay(x, y) < q4((t - 0.05) * 4) else 'R0'
                        if t > 0.35:
                            k = 'F0' if bay(x, y) < q4((t - 0.35) * 4) else 'R1'
                        if t > 0.7:
                            k = 'F1' if bay(x, y) < q4((t - 0.7) * 4) else 'F0'
                        cv.set(x, y, k)
        # the gate
        jamb_hi, jamb_lo = ('R4', 'R2') if not big else ('F3', 'AU')
        for y in range(22, 59):
            step = max(0, (30 - y)) // 2
            hw = 13 - step * 2
            for x in range(GX - hw - 3, GX + hw + 4):
                if x < GX - hw or x > GX + hw:
                    k = jamb_hi if x < GX else jamb_lo
                    if x == GX - hw - 3:
                        k = 'R3' if not big else 'F4'
                    if x == GX + hw + 3:
                        k = 'R0' if not big else 'AD'
                    cv.set(x, y, k)
                    continue
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
        for (ix, w_) in ((GX - 8, 2), (GX + 7, 2), (GX - 4, 1), (GX + 4, 1)):
            top = 30 if w_ == 2 else 34
            cv.rect(ix, top, ix + w_, 59, 'F0' if w_ == 1 else 'R0')
        for i in range(6):
            y = 52 + i
            cv.hline(GX - 3 - i, GX + 3 + i, y, 'F1' if i % 2 else 'F2')
        if big:
            # golden doors swung open against the inner walls
            for (dx0, d) in ((GX - 12, 1), (GX + 12, -1)):
                for y in range(28, 59):
                    for j in range(3):
                        x = dx0 + j * d
                        cv.set(x, y, ('F3' if j == 0 else 'AU') if d > 0 else ('AU' if j == 0 else 'AD'))
                    if (y - 28) % 6 == 0:
                        cv.set(dx0 + d, y, 'F4' if d > 0 else 'F3')
        # lintel with the great carved gear
        lt_hi, lt_mid, lt_lo = ('R4', 'R3', 'R1') if not big else ('F4', 'AU', 'AD')
        cv.rect(GX - 17, 18, GX + 18, 22, lt_mid)
        cv.hline(GX - 17, GX + 17, 18, lt_hi); cv.hline(GX - 17, GX + 17, 21, lt_lo)
        gcx, gcy = GX + 0.5, 12.5
        for y in range(4, 22):
            for x in range(GX - 9, GX + 10):
                dx, dy = x + 0.5 - gcx, y + 0.5 - gcy
                r_ = math.hypot(dx, dy); a = math.atan2(dy, dx)
                tooth = (math.cos(a * 8) > 0.3)
                if r_ <= 5.6 + (1.6 if tooth else 0):
                    k = lt_mid if big else 'R3'
                    if r_ <= 2.2:
                        k = 'F3' if r_ <= 1.2 else 'R0'
                    elif r_ > 5.6 + (0.6 if tooth else -1) or r_ < 3.4:
                        k = (lt_hi if dx + dy < 0 else lt_lo) if big else ('R4' if dx + dy < 0 else 'R1')
                    cv.set(x, y, k)
        for x in range(GX - 15, GX + 16, 3):
            cv.set(x, 20, 'F1' if not big else 'F4'); cv.set(x + 1, 19, 'F1' if not big else 'F3')

        # banners between pillars and gate
        for bx in (126, 147):
            if T >= 3:
                banner(cv, bx, 25 if T >= 3 else 32, 50 if T < 5 else 52, 'F1' if T < 5 else 'BL',
                       'F0' if T < 5 else 'N2', 'F3')
            else:
                cv.vline(bx, 32, 47, 'F1'); cv.vline(bx + 1, 32, 47, 'F1'); cv.vline(bx + 2, 32, 46, 'F0')
                cv.hline(bx - 1, bx + 3, 32, 'R4')
                cv.set(bx, 48, 'F1'); cv.set(bx + 2, 47, 'F0')
                cv.set(bx + 1, 36, 'F3'); cv.set(bx, 37, 'F3'); cv.set(bx + 2, 37, 'F3'); cv.set(bx + 1, 38, 'F3')
                cv.vline(bx, 33, 46, 'F2')
        if T >= 3 and not big:
            # banners on the outer pillars too
            banner(cv, 96, 33, 46, 'F1', 'F0'); banner(cv, 177, 33, 46, 'F1', 'F0')

        # guardians / kings
        if not big:
            guardian(cv, 103, 24, +1, crown=T >= 4)
            guardian(cv, 157, 24, -1, crown=T >= 4)
            for gx0 in (102, 156):
                cv.rect(gx0, 56, gx0 + 19, 60, 'R3')
                cv.hline(gx0, gx0 + 18, 56, 'R4'); cv.hline(gx0, gx0 + 18, 59, 'R1')
                cv.vline(gx0 + 18, 56, 59, 'R1')
        else:
            guardian(cv, 99, 56 - len(KING) + 1, +1, rows=KING)
            guardian(cv, 159, 56 - len(KING) + 1, -1, rows=KING)
            for gx0 in (96, 157):
                cv.rect(gx0, 56, gx0 + 26, 60, 'R3')
                cv.hline(gx0, gx0 + 25, 56, 'AU'); cv.hline(gx0, gx0 + 25, 57, 'R4'); cv.hline(gx0, gx0 + 25, 59, 'R1')
                cv.vline(gx0 + 25, 56, 59, 'R1')
                for x in range(gx0 + 2, gx0 + 25, 4):
                    cv.set(x, 58, 'F3')

        for y in range(58, H):
            for x in range(84, W):
                k = 'R1' if (x * 3 + y * 5) % 23 else 'R2'
                if y > 66:
                    k = 'R0' if bay(x, y) < q4((y - 66) / 5) else k
                cv.set(x, y, k)
        # plaza
        for y in range(59, 63):
            for x in range(92, 186):
                k = 'R3' if (y - 59) % 2 == 0 else 'R2'
                if x == 92 + (y - 59) * -1:
                    k = 'R1'
                cv.set(x - (y - 59), y, k)
        brazier(cv, 120, 59); brazier(cv, 156, 59); brazier(cv, 100, 59); brazier(cv, 178, 59)

        # molten river out of the gate
        widen = {2: 1.0, 3: 1.0, 4: 1.15, 5: 1.25}[T]
        for y in range(59, H):
            t = (y - 59) / (H - 59)
            cx = GX + 6 + 40 * t * t + 10 * t
            hw = (3 + 13 * t) * widen
            x0, x1 = int(round(cx - hw)), int(round(cx + hw))
            for x in range(x0, x1 + 1):
                u = (x - x0) / max(1, x1 - x0)
                n = nz(x / 4.0 - y * 0.3, y / 1.5)
                k = 'F2'
                if n > 0.62:
                    k = 'F4' if n > 0.75 else 'F3'
                elif n < 0.28:
                    k = 'F1'
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
            cv.set(x, y, 'R4' if not big else ('AU' if x % 3 else 'F3')); cv.set(x, y + 1, 'R2'); cv.set(x, y + 2, 'R1')
        for x in range(154, 169):
            cv.set(x, 68, 'R1')
        cv.set(161, 64, 'R3'); cv.set(161, 63, 'F3'); cv.set(162, 64, 'R1')
        if T >= 3:
            for x in (147, 174):
                cv.vline(x, 62, 65, 'R3'); cv.set(x, 61, 'F4'); cv.set(x, 62, 'F2')
        if T >= 4:
            dwarf(cv, 150, 65); dwarf(cv, 168, 64, col='BL' if T == 5 else 'F1')
            dwarf(cv, 112, 61, lantern=False); dwarf(cv, 130, 61, col='T')
        if T == 5:
            dwarf(cv, 108, 61, col='BL'); dwarf(cv, 166, 61); dwarf(cv, 144, 61, col='AU', lantern=False)

    # ---------------------------------------------------------------- trestle with mine carts, left
    RY = 44
    for x in range(0, 100):
        for y in range(RY + 2, H):
            if x < 90 or y > 47:
                cv.set(x, y, 'R0' if y > 50 or bay(x, y) < q4((y - RY) / 6) else 'R1')
    deck = 'R4' if T > 1 else 'T'
    x_start = 0 if T > 1 else 46
    for x in range(x_start, 101):
        cv.set(x, RY, deck); cv.set(x, RY + 1, 'T'); cv.set(x, RY + 2, 'R0')
    for x in range(4 if T > 1 else 52, 100, 12):
        for y in range(RY + 3, H):
            cv.set(x, y, 'R1' if T > 1 else 'T')
        for i in range(0, 12):
            y1 = RY + 3 + i
            if y1 < H:
                cv.set(x + i, y1, ('R1' if (x + i) % 2 else 'R2') if T > 1 else 'T')
                cv.set(x + 11 - i, y1, 'R1' if T > 1 else 'R0')
        cv.hline(x, x + 12, RY + 14, 'R1')
    if T == 1:
        # the timber trestle ends at a rocky ledge on the left
        for x in range(0, 47):
            top = RY - 1 + (1 if x % 9 == 3 else 0)
            for y in range(top, top + 3):
                cv.set(x, y, 'R2' if y == top else 'R1')
            cv.set(x, top, 'R3' if x % 4 else 'R2')
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
    carts = {1: [(75, True)], 2: [(66, True), (75, True), (5, False)]}.get(T, [(48, True), (57, True), (66, True), (75, True), (5, False)])
    for (x, ore) in carts:
        minecart(x, ore)
    cv.set(85, RY - 4, 'R4'); cv.set(85, RY - 3, 'F1'); cv.set(85, RY - 2, 'F1'); cv.set(84, RY - 1, 'R0'); cv.set(86, RY - 1, 'R0')
    cv.set(84, RY - 3, 'R3'); cv.set(84, RY - 4, 'F3')
    if T >= 3:
        # lantern posts along the rail
        posts = range(30, 96, 12) if T < 5 else range(18, 96, 8)
        for x in posts:
            if all(cv.get(x, RY - d) not in ('R3', 'R4', 'F1', 'F2', 'F3', 'F4') or d > 4 for d in range(1, 5)):
                cv.vline(x, RY - 5, RY - 1, 'T'); cv.set(x, RY - 6, 'F4'); cv.set(x + 1, RY - 6, 'F2')
    if T == 5:
        # bunting of banners strung along the trestle and a royal train
        for x in range(42, 100):
            y = RY - 9 + int(round(2 * math.sin((x - 42) / 58 * math.pi * 3) ** 2))
            if cv.get(x, y) not in ('F1', 'F2', 'F3', 'F4'):
                cv.set(x, y, 'R0')
            if x % 3 == 0:
                cv.set(x, y + 1, ('BL', 'F3', 'F1')[(x // 3) % 3])

    if T >= 2:
        # warm light from the gate: solid tones on the jamb faces and the plaza in front
        for y in range(24, 59):
            cv.set(GX - 14, y, 'F1' if T < 5 else 'F4'); cv.set(GX + 14, y, 'F1' if T < 5 else 'F2')
        for y in range(59, 63):
            for x in range(GX - 16, GX + 17):
                if cv.get(x, y) in ('R3', 'R2') and abs(x - GX) < 16 - (y - 59) * 2:
                    cv.set(x, y, 'F1' if cv.get(x, y) == 'R2' else 'F2')

    # ---------------------------------------------------------------- festival over the hold
    if T == 5:
        firework(cv, 22, 8, 5, 'F3', 'F2')
        firework(cv, 58, 5, 4, 'BH', 'BL')
        firework(cv, 104, 4, 3, 'F4', 'F3')
        firework(cv, 8, 20, 3, 'BH', 'BL')
        rr = random.Random(5)
        for _ in range(14):
            x = rr.uniform(0, 110); y = rr.uniform(0, 20)
            if cv.get(x, y) in ('N0', 'N1', 'N2', 'M0', 'M1'):
                cv.set(x, y, rr.choice(('F3', 'F4', 'F2')))
    return cv
