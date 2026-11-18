"""Room scenes of the Old Road's six instances (200 x 125, drawn by the game at 400 x 250).

When a room's party is inside an instance, the game hides the theme's scenery and draws the
instance's scene instead. Each scene is a 3/4 top-down room seen from inside the dungeon: a back
wall band across the top carries the instance's identity, and the floor below stays calm and
mid-dark so the characters and their speech bubbles read anywhere on it. Props stand only along
the back wall and the far left and right edges.
Deterministic: every random source is seeded."""
import random, math
from engine import *

W, H = 200, 125
WALL = 25          # first floor row


# ================================================================ shared helpers

def flags(cv, K, y0=WALL, vx=100, vy=-95, tw=22, h0=6, dh=1, seed=1, plank=False):
    """Perspective flagstones (or planks) from y0 down: rows grow taller toward the viewer and the
    joints converge on a vanishing point above the room. K: a, b (tile tones, close in value),
    j (joint), hi (worn top edge). Returns tile(x, y) -> (row, col) for later passes."""
    rows = []
    y, h = y0, h0
    while y < cv.H + 40:
        rows.append(y)
        y += h
        h += dh
    nz = vnoise(seed + 40)

    def row_of(y):
        ri = 0
        for i, r in enumerate(rows):
            if r <= y:
                ri = i
        return ri

    def col_of(x, y, ri):
        s = (y + 0.5 - vy) / (cv.H - vy)
        off = (tw / 2.0) * (ri % 2) + hashf(ri, 0, seed) * 5 if not plank else 0
        return int(math.floor(((x + 0.5 - vx) / s + off) / tw))

    def tile(x, y):
        ri = row_of(y)
        return ri, col_of(x, y, ri)

    for y in range(y0, cv.H):
        ri = row_of(y)
        top = rows[ri]
        for x in range(cv.W):
            c = col_of(x, y, ri)
            joint_v = c != col_of(x - 1, y, ri)
            v = hashf(ri * 7 + 3, c * 13 + 5, seed)
            n = nz(x / 3.5, y / 2.5)
            if plank:
                # planks run toward the viewer: tone per plank, grain streaks along it
                k = K['a'] if v < 0.5 else K['b']
                if n > 0.66:
                    k = K['b'] if k == K['a'] else K['a']
                if joint_v:
                    k = K['j']
                elif y == top and hashf(c, ri, seed + 9) < 0.35:   # butt joints, staggered
                    k = K['j']
                elif y == top + 1 and hashf(c, ri, seed + 9) < 0.35 and bay(x, y) < 0.5:
                    k = K['hi']
            else:
                k = K['a'] if v < 0.55 else K['b']
                if n > 0.62 + v * 0.1:
                    k = K['b'] if k == K['a'] else K['a']
                if y == top or joint_v:
                    k = K['j']
                elif y == top + 1 and hashf(x // 3, ri, seed + 2) < 0.55:
                    k = K['hi']
            cv.set(x, y, k)
    return tile


def cracks(cv, rng, n, keys, k, area=(20, WALL + 8, 180, 122), ln=(3, 8)):
    """Short wandering hairline cracks over pixels whose key is in keys."""
    for _ in range(n):
        x = rng.uniform(area[0], area[2]); y = rng.uniform(area[1], area[3])
        dx = rng.choice((-1, 1));
        for i in range(rng.randint(*ln)):
            if cv.get(x, y) in keys:
                cv.set(x, y, k)
            x += dx * (1 if rng.random() < 0.7 else 0)
            y += 1 if rng.random() < 0.45 else 0


def vignette(cv, dark, cx=100, cy=74, rx=112, ry=70, inner=0.55, levels=2.0, pred=None):
    """Darken toward the edges in dithered steps through a key -> darker key map."""
    for y in range(cv.H):
        for x in range(cv.W):
            if pred and not pred(x, y):
                continue
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
            d = math.sqrt(dx * dx + dy * dy)
            t = max(0.0, (d - inner) / (1 - inner)) * levels
            for step in range(int(levels + 0.999)):
                tt = q4(t - step)
                if tt > 0 and bay(x, y) < tt:
                    k = cv.get(x, y)
                    if k in dark:
                        cv.set(x, y, dark[k])


def wall_blocks(cv, x0, x1, y0, y1, K, bw=9, bh=4, seed=3):
    """Coursed stone blocks: K a, b, j (joint), hi (top lip), lo (underside shadow)."""
    nz = vnoise(seed)
    for y in range(y0, y1):
        r = (y - y0) // bh
        ry = (y - y0) % bh
        off = (bw // 2) * (r % 2) + int(hashf(r, 1, seed) * 3)
        for x in range(x0, x1):
            c = (x + off) // bw
            cx = (x + off) % bw
            v = hashf(c, r, seed)
            k = K['a'] if v < 0.55 else K['b']
            if nz(x / 3.0, y / 2.0) > 0.7:
                k = K['b'] if k == K['a'] else K['a']
            if ry == bh - 1 or cx == 0:
                k = K['j']
            elif ry == 0 and cx < bw - 2:
                k = K['hi']
            elif ry == bh - 2 and cx == bw - 1:
                k = K['lo']
            cv.set(x, y, k)


def flame(cv, x, y, K, tall=4):
    """A small sconce flame: K = (outer, mid, core, white)."""
    o, m, c, w = K
    for i in range(tall):
        cv.set(x, y - i, m if i < tall - 1 else o)
    cv.set(x - 1, y, o); cv.set(x + 1, y, o); cv.set(x - 1, y - 1, o); cv.set(x + 1, y - 1, o)
    cv.set(x, y, c); cv.set(x, y - 1, w if tall > 3 else c)


def drips(cv, xs, y0, y1, k, seed):
    for x in xs:
        ln = int(y0 + hashf(x, 3, seed) * (y1 - y0))
        for y in range(y0, ln):
            cv.set(x, y, k)


# ================================================================ 1. The Sunken Crypt

CRYPT = {
    'K': '#07090b',
    'S0': '#0f1317', 'S1': '#192127', 'S2': '#26313a', 'S3': '#384650', 'S4': '#55666b',
    'F0': '#1f292c', 'F1': '#2b373a', 'F2': '#344246', 'F3': '#405155',
    'P1': '#172529', 'P2': '#203538',
    'V1': '#26423b', 'V2': '#33574b',
    'W1': '#1e6a52', 'W2': '#3fae7c', 'W3': '#90f0b2', 'W4': '#eaffe2',
    'B1': '#7d7462', 'B2': '#bdb293', 'B3': '#e8dfc4',
    'G0': '#1c2a1b', 'G1': '#2f4325',
}


SKULL = [".232.", "23332", "30303", ".313."]


def skull(cv, x, y, flip=False):
    stamp(cv, x, y, SKULL, {'1': 'B1', '2': 'B2', '3': 'B3', '0': 'K'}, flip=flip)


def niche(cv, x, y, w, h, kind):
    """An arched loculus cut into the wall, with what lies in it."""
    m = set()
    r = w / 2.0
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            dx = xx + 0.5 - (x + r)
            if yy >= y + r or dx * dx + (yy + 0.5 - (y + r)) ** 2 <= r * r:
                m.add((xx, yy))
    for (xx, yy) in m:
        cv.set(xx, yy, 'S0' if (xx, yy - 1) in m and (xx - 1, yy) in m else 'K')
    for (xx, yy) in m:                                    # rim: lit sill, shadowed reveal
        if (xx, yy + 1) not in m:
            cv.set(xx, yy + 1, 'S4')
            cv.set(xx, yy + 2, 'S2')
        if (xx - 1, yy) not in m:
            cv.set(xx - 1, yy, 'S1')
        if (xx + 1, yy) not in m:
            cv.set(xx + 1, yy, 'S3')
        if (xx, yy - 1) not in m:
            cv.set(xx, yy - 1, 'S1')
    by = y + h - 1
    if kind == 'skulls':
        for i in range(0, w - 3, 4):
            skull(cv, x + i, by - 3, flip=i % 8 == 4)
        cv.hline(x, x + w - 1, by, 'B1')
    elif kind == 'pile':
        cv.hline(x, x + w - 1, by, 'B1'); cv.hline(x + 1, x + w - 2, by - 1, 'B2')
        cv.set(x, by - 1, 'B3'); cv.set(x + w - 1, by - 1, 'B3')
        skull(cv, x + w // 2 - 2, by - 5)
    elif kind == 'bones':
        for j in range(3):
            yy = by - j
            cv.hline(x + j % 2, x + w - 1 - (j + 1) % 2, yy, 'B2' if j % 2 == 0 else 'B1')
            cv.set(x + j % 2, yy, 'B3'); cv.set(x + w - 1 - (j + 1) % 2, yy, 'B3')
        cv.set(x + 2, by - 3, 'B1'); cv.set(x + 3, by - 4, 'B2'); cv.set(x + 4, by - 5, 'B2')
    elif kind == 'shroud':
        cv.hline(x, x + w - 1, by, 'B1')
        cv.hline(x, x + w - 2, by - 1, 'S3'); cv.hline(x + 1, x + w - 3, by - 2, 'S4')
        cv.set(x + 1, by - 3, 'S3'); cv.set(x + 2, by - 3, 'S4'); cv.set(x + w - 2, by - 1, 'S2')
    elif kind == 'urn':
        cx = x + w // 2
        stamp(cv, cx - 2, by - 4, [".43.", "4332", "4332", ".32.", "4332"],
              {'4': 'S4', '3': 'S3', '2': 'S2'})
        skull(cv, x - 1 + (0 if cx - x > 3 else w - 4), by - 3) if w > 8 else None


def sarcophagus(cv, x0, y0, w, ln, broken=False, flip=False):
    """A stone sarcophagus seen from above at 3/4, long axis toward the viewer."""
    # shadow
    for yy in range(y0 + 2, y0 + ln + 4):
        for xx in range(x0 - 1, x0 + w + 2):
            if cv.get(xx, yy) in ('F1', 'F2', 'F3', 'V1', 'V2', 'P2'):
                if bay(xx, yy) < 0.75:
                    cv.set(xx, yy, 'F0')
    # body front face
    cv.rect(x0, y0 + ln - 4, x0 + w, y0 + ln + 2, 'S2')
    cv.hline(x0, x0 + w - 1, y0 + ln + 1, 'S1')
    for xx in range(x0 + 2, x0 + w - 2, 3):
        cv.vline(xx, y0 + ln - 2, y0 + ln, 'S1')
    cv.vline(x0, y0 + ln - 4, y0 + ln + 1, 'S3')
    # lid top
    lid = m_poly([(x0, y0 + 2), (x0 + 2, y0), (x0 + w - 2, y0), (x0 + w, y0 + 2),
                  (x0 + w, y0 + ln - 4), (x0, y0 + ln - 4)])
    if broken:
        lid -= m_poly([(x0 + w * 0.5, y0 + ln - 4), (x0 + w + 1, y0 + ln * 0.45), (x0 + w + 1, y0 + ln - 4)])
    for (xx, yy) in lid:
        u = (xx - x0) / float(w)
        k = 'S3' if u < 0.75 else 'S2'
        if (xx - 1, yy) not in lid or (xx, yy - 1) not in lid:
            k = 'S4'
        if (xx + 1, yy) not in lid:
            k = 'S1'
        cv.set(xx, yy, k)
    # carved effigy: hands crossed on a sword
    cx = x0 + w // 2
    cv.vline(cx, y0 + 4, y0 + ln - 8, 'S1')
    cv.hline(cx - 2, cx + 2, y0 + 7, 'S1')
    cv.set(cx - 1, y0 + 3, 'S4'); cv.set(cx, y0 + 2, 'S4'); cv.set(cx + 1, y0 + 3, 'S2')
    for (xx, yy) in lid:
        if hashf(xx, yy, 21) < 0.08:
            cv.set(xx, yy, 'G1')
    if broken:
        # the open coffin shows darkness and a ribcage
        cv.poly([(x0 + w * 0.5 + 1, y0 + ln - 5), (x0 + w - 1, y0 + ln * 0.5), (x0 + w - 1, y0 + ln - 5)], 'K')
        for yy in range(int(y0 + ln * 0.62), y0 + ln - 5, 2):
            cv.hline(x0 + w - 4, x0 + w - 2, yy, 'B1')


def scene_crypt():
    rng = random.Random(101)
    cv = Cv(CRYPT, 'S0', W, H)
    CX = 100
    # ------------------------------------------------ back wall
    wall_blocks(cv, 0, W, 0, WALL - 3, {'a': 'S2', 'b': 'S1', 'j': 'S0', 'hi': 'S3', 'lo': 'S0'},
                bw=10, bh=4, seed=7)
    for y in range(0, 5):                               # vault shadow at the top
        for x in range(W):
            if bay(x, y) < q4(1 - y / 5.0):
                cv.set(x, y, 'S0' if y > 1 else 'K')
    # burial niches in two tiers between the pilasters
    PIL = [4, 40, 70, 130, 160, 196]
    kinds = ['skulls', 'bones', 'shroud', 'pile', 'urn', 'skulls', 'bones', 'pile', 'skulls',
             'shroud', 'pile', 'bones']
    ki = 0
    for (a, b) in ((PIL[0], PIL[1]), (PIL[1], PIL[2]), (PIL[3], PIL[4]), (PIL[4], PIL[5])):
        n = (b - a - 4) // 11
        span = n * 11 - 2
        x0 = a + (b - a - span) // 2 + 1
        for (yy, hh) in ((3, 7), (12, 7)):
            for i in range(n):
                niche(cv, x0 + i * 11, yy, 9, hh, kinds[ki % len(kinds)])
                ki += 1
    # the doorway with the witch-light gate
    DX0, DX1, DT = CX - 12, CX + 13, 11
    for y in range(0, WALL - 2):
        for x in range(DX0 - 5, DX1 + 5):
            dx = x + 0.5 - (CX + 0.5)
            inside = (y >= DT and DX0 <= x < DX1) or (dx * dx + (y + 0.5 - DT) ** 2 <= 12.5 ** 2)
            ring = (y >= DT and DX0 - 4 <= x < DX1 + 4) or (dx * dx + (y + 0.5 - DT) ** 2 <= 16.5 ** 2)
            if inside:
                t = (y + 1) / 22.0
                v = t * 1.15 - abs(dx) / 13.0 * 0.55
                if v > 0.72:
                    k = 'W3' if bay(x, y) < q4((v - 0.72) * 4) else 'W2'
                elif v > 0.42:
                    k = 'W2' if bay(x, y) < q4((v - 0.42) * 3.3) else 'W1'
                elif v > 0.12:
                    k = 'W1' if bay(x, y) < q4((v - 0.12) * 3.3) else 'V1'
                else:
                    k = 'V1' if bay(x, y) < q4(v * 4 + 0.5) else 'K'
                cv.set(x, y, k)
            elif ring:
                ang = math.atan2(y + 0.5 - DT, dx)
                k = 'S3' if dx < 0 else 'S2'
                if y < DT and int((ang + 3.2) * 3.6) % 2 == 0:
                    k = 'S1' if dx > 0 else 'S4'
                if y >= DT and (y - DT) % 4 == 3:
                    k = 'S1'
                if y >= DT and (x == DX0 - 4 or x == DX1 + 3):
                    k = 'S4' if x < CX else 'S1'
                cv.set(x, y, k)
    # a skull keystone
    cv.rect(CX - 2, 0, CX + 4, 4, 'S3'); cv.hline(CX - 2, CX + 3, 4, 'S1')
    skull(cv, CX - 1, 0)
    # iron gate bars, one bent open
    for gx in range(DX0 + 1, DX1, 3):
        dxx = gx + 0.5 - CX - 0.5
        top = int(DT - math.sqrt(max(0.0, 12.5 ** 2 - dxx * dxx))) + 1
        bend = gx > CX + 5
        for y in range(top, WALL - 2):
            cv.set(gx + (1 if bend and y > 17 else 0), y, 'S0')
        cv.set(gx, top, 'S2')
    cv.hline(DX0, DX1 - 1, 12, 'S0'); cv.hline(DX0, CX + 5, 18, 'S0')
    # a hunched figure beyond the gate, back-lit
    stamp(cv, CX - 5, 13, ["..00..", ".000..", "00000.", "000000", ".0000.", ".00.0.", ".0..0."],
          {'0': 'K'})
    cv.set(CX - 3, 14, 'W3')
    # pilasters, lit from the gate side
    for px_ in PIL:
        lit_left = px_ < CX
        for y in range(0, WALL - 3):
            ks = ('S4', 'S3', 'S3', 'S2', 'S1') if lit_left else ('S1', 'S2', 'S3', 'S3', 'S4')
            for j, k in enumerate(ks):
                cv.set(px_ - 2 + j, y, k)
            if y % 7 == 6:
                cv.hline(px_ - 2, px_ + 2, y, 'S1')
        cv.hline(px_ - 3, px_ + 3, 2, 'S4'); cv.hline(px_ - 3, px_ + 3, 3, 'S1')
    # witch-light sconces
    for sx in (PIL[2], PIL[3], PIL[1], PIL[4]):
        light(cv, sx + 0.5, 9, 10, 9, {'S2': 'V2', 'S1': 'V1', 'S3': 'V2', 'S0': 'V1', 'S4': 'V2'},
              power=1.3, steps=3)
        cv.hline(sx - 2, sx + 2, 11, 'S0'); cv.set(sx - 2, 10, 'S0'); cv.set(sx + 2, 10, 'S0')
        cv.set(sx, 12, 'S0'); cv.set(sx, 13, 'S0')
        flame(cv, sx, 10, ('W1', 'W2', 'W3', 'W4'))
    light(cv, CX + 0.5, 15, 32, 14, {'S2': 'V2', 'S1': 'V1', 'S3': 'V2', 'S4': 'V2'},
          power=1.4, steps=4, pred=lambda x, y: not (DX0 - 4 <= x < DX1 + 4 and y > 0))
    # moss and drip stains, hanging roots through the vault
    for x in range(W):
        if hashf(x, 9, 4) < 0.16 and cv.get(x, 5) in ('S1', 'S2', 'S3', 'V1', 'V2'):
            ln = 2 + int(hashf(x, 8, 4) * 9)
            for y in range(4, 4 + ln):
                if cv.get(x, y) in ('S1', 'S2', 'S3', 'V1', 'V2'):
                    cv.set(x, y, 'G0' if y < 4 + ln // 2 else 'S1')
    for (rx, ln) in ((22, 7), (25, 4), (56, 9), (146, 6), (178, 8), (181, 5), (116, 5)):
        for y in range(0, ln):
            cv.set(rx + (1 if y > ln // 2 and rx % 2 else 0), y, 'G1' if y % 3 else 'G0')
    # plinth, with a dark waterline along it
    cv.hline(0, W - 1, WALL - 3, 'S4')
    cv.hline(0, W - 1, WALL - 2, 'S3')
    cv.hline(0, W - 1, WALL - 1, 'S1')
    for x in range(W):
        if hashf(x, 2, 11) < 0.45:
            cv.set(x, WALL - 2, 'S2')
        if hashf(x // 2, 5, 11) < 0.35:
            cv.set(x, WALL - 1, 'G0')
    # ------------------------------------------------ floor
    tile = flags(cv, {'a': 'F2', 'b': 'F1', 'j': 'F0', 'hi': 'F3'}, seed=5, tw=22)
    cracks(cv, rng, 26, ('F1', 'F2', 'F3'), 'F0')
    for y in range(WALL, WALL + 4):                      # contact shadow under the wall
        for x in range(W):
            if cv.get(x, y) in ('F1', 'F2', 'F3') and bay(x, y) < q4(1 - (y - WALL) / 4.0):
                cv.set(x, y, 'F0')
    # three worn steps down from the gate
    for i, (hw, y) in enumerate(((16, WALL - 2), (18, WALL), (20, WALL + 2))):
        cv.hline(CX - hw, CX + hw + 1, y, 'S3')
        cv.hline(CX - hw, CX + hw + 1, y + 1, 'S2' if i < 2 else 'S1')
        cv.set(CX - hw, y, 'S4'); cv.set(CX + hw + 1, y + 1, 'S1')
    # puddles: dark still water with a green glint
    for (px_, py_, rx, ry) in ((44, 66, 11, 3.2), (128, 72, 14, 3.6), (82, 104, 12, 3.0),
                               (160, 101, 9, 2.6), (32, 95, 7, 2.2), (112, 40, 9, 2.4),
                               (64, 86, 5, 1.6), (150, 46, 6, 1.8), (178, 76, 5, 1.6),
                               (58, 36, 6, 1.6)):
        m = set()
        for (x, y) in m_ell(px_, py_, rx, ry):
            if hashf(x // 2, y, 31) < 0.9 or abs(x - px_) < rx * 0.7:
                m.add((x, y))
        for (x, y) in m:
            cv.set(x, y, 'P1' if (x, y - 1) not in m else 'P2')
        for (x, y) in m:                                 # wet lip on the near side
            if (x, y + 1) not in m and cv.get(x, y + 1) in ('F1', 'F2') and bay(x, y + 1) < 0.5:
                cv.set(x, y + 1, 'F3')
        gy = int(py_)
        for x in range(int(px_ - rx * 0.5), int(px_ + rx * 0.3)):
            if (x, gy) in m and hashf(x, gy, 4) < 0.6:
                cv.set(x, gy, 'V2')
        if rx > 8:
            cv.set(int(px_ - 1), gy, 'W1'); cv.set(int(px_), gy, 'W2')
        if rx > 10:                                      # a ring where a drop fell
            rcx = px_ + rx * 0.4
            for a in range(0, 360, 30):
                xx = rcx + math.cos(math.radians(a)) * 2.6
                yy = py_ + math.sin(math.radians(a)) * 0.9
                if (int(xx), int(yy)) in m:
                    cv.set(xx, yy, 'V1')
    # moss in the joints
    for _ in range(90):
        x = rng.randint(0, W - 1); y = rng.randint(WALL + 2, H - 1)
        if cv.get(x, y) == 'F0':
            cv.set(x, y, 'G0')
    # green light pools: the gate down the middle, faint pools under the sconces
    pool = {'F1': 'V1', 'F2': 'V2', 'F3': 'V2', 'F0': 'P2', 'P2': 'V1', 'P1': 'P2', 'G0': 'P2'}
    light(cv, CX + 0.5, WALL + 2, 62, 44, pool, power=1.5, steps=4)
    for sx in (PIL[1], PIL[4]):
        light(cv, sx + 0.5, WALL + 2, 20, 10, pool, power=1.5, steps=3)
    # ------------------------------------------------ vignette, then the edge props on top
    vignette(cv, {'F1': 'F0', 'F2': 'F1', 'F3': 'F2', 'V2': 'V1', 'V1': 'F1', 'P2': 'P1',
                  'S1': 'S0', 'S2': 'S1', 'S3': 'S2', 'G1': 'G0', 'S4': 'S3', 'F0': 'S0',
                  'P1': 'S0', 'G0': 'S0'},
             cy=66, rx=124, ry=80, inner=0.62, levels=2.0)
    # scattered bones near the walls
    for (x, y) in ((30, 29), (74, 28), (148, 29), (168, 31), (60, 121), (140, 122), (124, 27)):
        cv.hline(x, x + 3, y, 'B1'); cv.set(x, y, 'B2'); cv.set(x + 3, y, 'B2')
        cv.set(x, y - 1, 'B1'); cv.set(x + 3, y + 1, 'B1')
    skull(cv, 22, 27); skull(cv, 176, 26, flip=True); skull(cv, 86, 27)
    sarcophagus(cv, 1, 30, 11, 24)
    sarcophagus(cv, 187, 32, 11, 24, broken=True)
    for (x, y) in ((14, 31), (185, 30), (4, 60), (194, 62), (8, 60)):
        light(cv, x + 0.5, y - 1, 7, 5, {'F1': 'V1', 'F2': 'V2', 'F3': 'V2', 'F0': 'P2',
                                         'S1': 'V1', 'S2': 'V2', 'S3': 'V2'}, power=1.2, steps=2)
        cv.vline(x, y - 3, y, 'B2'); cv.set(x, y, 'B1')
        cv.set(x, y - 4, 'W3'); cv.set(x, y - 5, 'W2')
    # rubble low in the corners, tight to the edge
    for (x, y) in ((1, 112), (4, 115), (0, 117), (197, 109), (194, 114), (197, 117)):
        cv.set(x, y, 'S3'); cv.set(x + 1, y, 'S2'); cv.set(x, y + 1, 'S1'); cv.set(x + 1, y + 1, 'S1')
    return cv


# ================================================================ helpers for the later scenes

def arch_mask(cx, top, bot, hw, pointed=0.0):
    """Pixels of an arched opening centred on cx (between pixels when cx ends in .5), round top
    of radius hw; pointed > 0 lifts it into a gothic point."""
    m = set()
    for y in range(int(top) - 2, int(bot)):
        for x in range(int(cx - hw) - 1, int(cx + hw) + 2):
            dx = x + 0.5 - cx
            if abs(dx) > hw:
                continue
            R = hw * (1 + pointed)
            ox = R - hw
            spring = top + (math.sqrt(R * R - ox * ox) if pointed else hw)
            yy = y + 0.5
            if yy >= spring:
                m.add((x, y))
            elif pointed:
                # two circles of radius R centred off-axis meet in a point at the top
                if (abs(dx) + ox) ** 2 + (yy - spring) ** 2 <= R * R and yy >= top:
                    m.add((x, y))
            elif dx * dx + (yy - spring) ** 2 <= hw * hw:
                m.add((x, y))
    return m


def ring_of(m, w):
    """The w-pixel band around a mask (4-neighbour dilation minus the mask)."""
    out, cur = set(), set(m)
    for _ in range(w):
        nxt = set()
        for (x, y) in cur:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                p = (x + dx, y + dy)
                if p not in m and p not in out:
                    nxt.add(p)
        out |= nxt
        cur = nxt
    return out


def grad_fill(cv, m, stops, fn):
    """Fill a mask through palette stops (dark .. light) by fn(x, y) in [0, 1], dithered."""
    n = len(stops) - 1
    for (x, y) in m:
        v = max(0.0, min(1.0, fn(x, y))) * n
        i = int(v)
        if i >= n:
            cv.set(x, y, stops[-1])
            continue
        cv.set(x, y, stops[i + 1] if bay(x, y) < q4(v - i) else stops[i])


def dline(cv, x0, y0, x1, y1, k, p=1.0, seed=0, keys=None):
    """A line that only paints a share p of its pixels (thin silk, rain), optionally only over keys."""
    x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
    dx = abs(x1 - x0); dy = -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        if hashf(x0, y0, seed) < p and (keys is None or cv.get(x0, y0) in keys):
            cv.set(x0, y0, k)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy; x0 += sx
        if e2 <= dx:
            err += dx; y0 += sy


def shade_under(cv, x0, y0, x1, y1, remap, t=0.75):
    """A dithered contact shadow under a prop."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            k = cv.get(x, y)
            if k in remap and bay(x, y) < t:
                cv.set(x, y, remap[k])


def wall_shadow(cv, keys, dark, rows=4):
    for y in range(WALL, WALL + rows):
        for x in range(W):
            if cv.get(x, y) in keys and bay(x, y) < q4(1 - (y - WALL) / float(rows)):
                cv.set(x, y, dark)


def vault_shadow(cv, mid, deep, rows=5):
    for y in range(0, rows):
        for x in range(W):
            if bay(x, y) < q4(1 - y / float(rows)):
                cv.set(x, y, mid if y > 1 else deep)


# ================================================================ 2. Emberdeep Foundry

FOUNDRY = {
    'K': '#0d090e',
    'S0': '#1b1318', 'S1': '#2e2027', 'S2': '#4a2f33', 'S3': '#76473c',
    'I1': '#24232e', 'I2': '#41404f', 'I3': '#686676', 'I4': '#a49ca2',
    'F1': '#7e1c16', 'F2': '#cf4618', 'F3': '#f8922a', 'F4': '#ffe48a',
    'G0': '#181215', 'G1': '#241c1f', 'G2': '#2e2528', 'G3': '#3a2f30',
    'H1': '#40241f', 'H2': '#552e23',
    'M1': '#3f1d22',
}


ANVIL = ["4443333333.",
         ".3322222221",
         "...32221...",
         "...3221....",
         "..322211...",
         ".22221111.."]


def lava(cv, x, y, nz, sx, crust=0.46):
    """One pixel of molten slag: crusted dark plates over glowing flow."""
    n = nz(x / 2.2 + sx, y / 6.0)
    m = nz(x / 1.3 + 40 + sx, y / 2.5)
    if n < crust:
        k = 'S0' if m < 0.5 else 'M1'
        if abs(n - crust) < 0.04:
            k = 'F1'
    elif n < crust + 0.18:
        k = 'F1' if bay(x, y) < 0.5 else 'F2'
    elif n < 0.78:
        k = 'F2'
    else:
        k = 'F3' if m < 0.8 else 'F4'
    cv.set(x, y, k)


def scene_foundry():
    rng = random.Random(202)
    cv = Cv(FOUNDRY, 'S0', W, H)
    CX = 100
    nzl = vnoise(77)
    # ------------------------------------------------ back wall: basalt blocks, soot from above
    wall_blocks(cv, 0, W, 0, WALL - 3, {'a': 'S2', 'b': 'S1', 'j': 'S0', 'hi': 'S3', 'lo': 'K'},
                bw=12, bh=5, seed=12)
    vault_shadow(cv, 'S0', 'K', 6)
    for x in range(W):                                   # soot streaks running down
        if hashf(x, 1, 5) < 0.22:
            ln = 4 + int(hashf(x, 2, 5) * 10)
            for y in range(0, ln):
                if cv.get(x, y) in ('S1', 'S2', 'S3') and bay(x, y) < 0.75:
                    cv.set(x, y, 'S0' if y < ln // 2 else 'S1')
    # furnace mouths in the outer bays
    for fx in (24.5, 175.5):
        m = arch_mask(fx, 7, WALL - 3, 7)
        for (x, y) in ring_of(m, 3):
            if y < WALL - 3:
                cv.set(x, y, 'I2' if x < fx else 'I1')
        for (x, y) in ring_of(m, 1):
            if y < WALL - 3:
                cv.set(x, y, 'I3' if x < fx else 'I2')
        grad_fill(cv, m, ['K', 'F1', 'F2', 'F3', 'F4'],
                  lambda x, y: ((y - 7) / 15.0) ** 1.4 * 1.15 - abs(x + 0.5 - fx) / 7.0 * 0.35
                  + (nzl(x / 2.0, y / 2.0) - 0.5) * 0.3)
        for gx in range(int(fx) - 5, int(fx) + 6, 3):          # fire bars
            cv.vline(gx, WALL - 9, WALL - 4, 'K')
        cv.hline(int(fx) - 7, int(fx) + 7, WALL - 9, 'I1')
        for a in range(0, 181, 30):                            # rivets round the arch
            ang = math.radians(180 + a)
            rx_, ry_ = fx + math.cos(ang) * 9, 14 + math.sin(ang) * 9
            if ry_ < WALL - 3:
                cv.set(rx_, ry_, 'I4')
        light(cv, fx, 16, 20, 14, {'S0': 'S1', 'S1': 'S2', 'S2': 'S3', 'K': 'S0'}, power=1.3,
              steps=3, pred=lambda x, y: (x, y) not in m)
    # glowing vents in the inner bays
    for vx_ in (59, 141):
        cv.rect(vx_ - 5, 8, vx_ + 6, 16, 'I1')
        cv.hline(vx_ - 5, vx_ + 5, 8, 'I3'); cv.vline(vx_ - 5, 8, 15, 'I2')
        for y in range(9, 15):
            for x in range(vx_ - 4, vx_ + 5):
                if x % 2 == 0:
                    cv.set(x, y, 'F2' if y > 11 else 'F1')
                    if y > 12 and hashf(x, y, 3) < 0.4:
                        cv.set(x, y, 'F3')
        light(cv, vx_ + 0.5, 12, 13, 9, {'S0': 'S1', 'S1': 'S2', 'S2': 'S3'}, power=1.4, steps=2,
              pred=lambda x, y: not (vx_ - 5 <= x <= vx_ + 5 and 8 <= y <= 15))
    # the vault door
    DCY = 11.5
    DS = 0.74
    door = set()
    for y in range(0, WALL - 3):
        for x in range(CX - 18, CX + 19):
            dx = x + 0.5 - (CX + 0.5); dy = y + 0.5 - DCY
            r = math.hypot(dx, dy) / DS
            ang = math.atan2(dy, dx)
            dx /= DS; dy /= DS
            if r > 15.5:
                continue
            door.add((x, y))
            lit = dx + dy * 0.8 < 0
            if r > 13:                                   # iron frame ring
                k = 'I3' if lit else 'I2'
                if r > 15:
                    k = 'I4' if lit and dy < 0 else 'I1'
                if r < 13.7:
                    k = 'I1'
                if (int((math.degrees(ang) + 371.25) / 22.5) % 2 == 0) and 13.9 < r < 14.9:
                    k = 'I4' if lit else 'I3'
            elif r > 11.8:                               # the molten seam round the door
                k = 'F3' if dy > 4 else 'F2'
                if dy < -5 and bay(x, y) < 0.5:
                    k = 'F1'
            else:
                k = 'I2'
                if lit and r > 9.6:
                    k = 'I3'
                elif not lit and r > 9.6:
                    k = 'I1'
                if abs(r - 10.9) < 0.5:
                    k = 'I1' if lit else 'K'
                if abs(r - 7.0) < 0.55:
                    k = 'I1'
                spoke = min(abs(dx), abs(dy))
                if r > 3.5 and r < 10.4:
                    if spoke < 0.6:
                        k = 'F3' if r < 6 else 'F2'
                    elif spoke < 1.5:
                        k = 'K' if not lit else 'I1'
                if abs(r - 8.6) < 0.6 and spoke > 2.5 and int((math.degrees(ang) + 382.5) / 45) % 2 == 0:
                    k = 'I4' if lit else 'I3'
                if r < 3.6:
                    k = 'I3' if r > 2.6 else ('F4' if r < 1.4 else 'F3')
            cv.set(x, y, k)
    light(cv, CX + 0.5, DCY, 30, 16, {'S0': 'S1', 'S1': 'S2', 'S2': 'S3', 'K': 'S0'},
          power=1.2, steps=4, pred=lambda x, y: (x, y) not in door)
    # iron pillars, rivets, lit from the door side
    PIL = [6, 44, 75, 125, 156, 194]
    for px_ in PIL:
        lit_left = px_ < CX
        ks = ('I3', 'I2', 'I2', 'I1', 'K') if lit_left else ('K', 'I1', 'I2', 'I2', 'I3')
        for y in range(0, WALL - 3):
            for j, k in enumerate(ks):
                cv.set(px_ - 2 + j, y, k)
            if y % 5 == 3:
                cv.set(px_ - 1, y, 'I4'); cv.set(px_ + 1, y, 'I3')
        cv.hline(px_ - 3, px_ + 3, 3, 'I3'); cv.hline(px_ - 3, px_ + 3, 4, 'I1')
    # a steam pipe across the top, chains with hooks
    for x in list(range(0, CX - 13)) + list(range(CX + 14, W)):
        cv.set(x, 0, 'K'); cv.set(x, 1, 'I2'); cv.set(x, 2, 'I1')
        if x % 16 == 3:
            cv.vline(x, 0, 2, 'I3')
    for (chx, ln) in ((36, 12), (52, 8), (148, 9), (164, 13)):
        for y in range(3, 3 + ln):
            if y % 3 == 0:
                cv.set(chx, y, 'I3')
            else:
                cv.set(chx - 1 if y % 3 == 1 else chx + 1, y, 'I2'); cv.set(chx, y, 'K')
        y = 3 + ln
        cv.set(chx, y, 'I3'); cv.set(chx + 1, y + 1, 'I2'); cv.set(chx, y + 2, 'I2'); cv.set(chx - 1, y + 1, 'I3')
    # plinth: an iron kerb along the wall
    cv.hline(0, W - 1, WALL - 3, 'I3')
    cv.hline(0, W - 1, WALL - 2, 'I2')
    cv.hline(0, W - 1, WALL - 1, 'I1')
    for x in range(2, W, 8):
        cv.set(x, WALL - 2, 'I4')
    # ------------------------------------------------ floor: scorched stone flags
    flags(cv, {'a': 'G2', 'b': 'G1', 'j': 'G0', 'hi': 'G3'}, seed=8, tw=24)
    cracks(cv, rng, 22, ('G1', 'G2', 'G3'), 'G0')
    nz = vnoise(31)
    for y in range(WALL, H):                             # scorch blotches
        for x in range(W):
            if nz(x / 9.0, y / 5.0) > 0.66 and cv.get(x, y) in ('G2', 'G3') and bay(x, y) < 0.5:
                cv.set(x, y, 'G1')
    wall_shadow(cv, ('G1', 'G2', 'G3'), 'G0')
    # a hot threshold plate before the door, two round drain grates
    for y in range(WALL, WALL + 4):
        hw = 15 + (y - WALL)
        for x in range(CX - hw, CX + hw + 2):
            k = 'I1' if (x + y) % 4 else 'G0'
            if y == WALL:
                k = 'I2'
            cv.set(x, y, k)
        cv.set(CX - hw, y, 'I2'); cv.set(CX + hw + 1, y, 'G0')
    for (gx, gy, rx, ry) in ((62, 78, 7, 2.6), (142, 101, 8, 3.0)):
        m = m_ell(gx, gy, rx, ry)
        for (x, y) in m:
            k = 'K' if x % 2 else 'I1'
            if (x, y - 1) not in m:
                k = 'I2'
            cv.set(x, y, k)
        for (x, y) in m:
            if (x, y + 1) not in m:
                cv.set(x, y + 1, 'G3')
    # warm light: the door down the middle, the furnaces at the sides
    pool = {'G1': 'H1', 'G2': 'H2', 'G3': 'H2', 'G0': 'G1', 'I1': 'I2'}
    light(cv, CX + 0.5, WALL + 1, 64, 44, pool, power=1.6, steps=4)
    for fx in (24.5, 175.5):
        light(cv, fx, WALL + 1, 24, 13, pool, power=1.4, steps=3)
    for sx in (5, 195):
        light(cv, sx, 80, 22, 66, pool, power=2.0, steps=3)
    # ------------------------------------------------ vignette
    vignette(cv, {'G1': 'G0', 'G2': 'G1', 'G3': 'G2', 'H1': 'G1', 'H2': 'H1', 'G0': 'K',
                  'S1': 'S0', 'S2': 'S1', 'S3': 'S2', 'I2': 'I1', 'I3': 'I2', 'I1': 'K',
                  'S0': 'K'},
             cy=66, rx=124, ry=80, inner=0.62, levels=2.0)
    # ------------------------------------------------ molten channels along both edges
    for side in (0, 1):
        for y in range(WALL - 3, H):
            wl = 5 + (y - WALL) * 0.04
            for xi in range(0, int(wl) + 1):
                x = xi if side == 0 else W - 1 - xi
                lava(cv, x, y, nzl, side * 60)
            lx = int(wl) + 1
            for j, k in enumerate(('I3' if y % 7 == 0 else 'I2', 'I1', 'K')):
                cv.set(lx + j if side == 0 else W - 1 - lx - j, y, k)
        sp = 4 if side == 0 else W - 6                   # a spout in the kerb feeds it
        cv.rect(sp - 1, WALL - 6, sp + 3, WALL - 2, 'I2')
        cv.hline(sp - 1, sp + 2, WALL - 6, 'I3')
        cv.rect(sp, WALL - 3, sp + 2, WALL - 1, 'F3')
    # anvil on the left by the wall, a crucible of slag on the right
    shade_under(cv, 11, 32, 26, 35, {'G1': 'G0', 'G2': 'G1', 'H1': 'G1', 'H2': 'H1', 'G3': 'G2'})
    stamp(cv, 13, 27, ANVIL, {'4': 'I4', '3': 'I3', '2': 'I2', '1': 'I1'})
    shade_under(cv, 176, 33, 190, 36, {'G1': 'G0', 'G2': 'G1', 'H1': 'G1', 'H2': 'H1', 'G3': 'G2'})
    cr = m_ell(183, 30, 5, 4)
    cyl(cv, cr, ('I3', 'I2', 'I2', 'I1', 'K'))
    for (x, y) in m_ell(183, 27.5, 4, 1.6):
        cv.set(x, y, 'F3' if x < 184 else 'F2')
    cv.set(182, 27, 'F4')
    cv.vline(179, 33, 35, 'I1'); cv.vline(187, 33, 35, 'I1')
    # slag heaps in the bottom corners, still glowing in the cracks
    for (hx, hy, sgn) in ((16, 121, 1), (184, 121, -1)):
        m = m_ell(hx, hy, 8, 5)
        for (x, y) in m:
            k = 'S2' if (x, y - 1) not in m else ('S1' if hashf(x, y, 8) < 0.6 else 'S0')
            if hashf(x // 2, y, 9) < 0.12:
                k = 'F1'
            cv.set(x, y, k)
        cv.set(hx - 2, hy - 1, 'F2'); cv.set(hx + 1, hy, 'F2'); cv.set(hx - 1, hy, 'F3')
    # ingots stacked against the wall
    for (ix, iy) in ((126, 27), (130, 27), (128, 26)):
        cv.hline(ix, ix + 3, iy, 'I3'); cv.hline(ix, ix + 3, iy + 1, 'I2'); cv.set(ix + 3, iy + 1, 'I1')
    # embers rising
    for _ in range(46):
        side = rng.random()
        if side < 0.35:
            x = rng.uniform(0, 26)
        elif side < 0.7:
            x = rng.uniform(174, 200)
        else:
            x = rng.uniform(70, 130)
        y = rng.uniform(4, 80) if side < 0.7 else rng.uniform(0, 34)
        cv.set(x, y, 'F3' if rng.random() < 0.5 else 'F2')
        if rng.random() < 0.5:
            cv.set(x, y + 1, 'F1')
    return cv


# ================================================================ 3. The Hollow Hive

HIVE = {
    'K': '#0c0b0f',
    'W0': '#151011', 'W1': '#221a18', 'W2': '#33261f', 'W3': '#4a3727', 'W4': '#6a5038',
    'X1': '#4f2810', 'X2': '#874616', 'H1': '#bb6a1c', 'H2': '#ec9d2c', 'H3': '#ffd463',
    'H4': '#fff6c0',
    'WB': '#a5bfc0', 'WD': '#4c6b71',
    'R0': '#15100e', 'R1': '#211a16', 'R2': '#2b221c', 'R3': '#362b22',
    'L1': '#3f2b1b', 'L2': '#50371d',
    'G1': '#1a2c21',
}

HCELL = {0: (1, 3), 1: (0, 4), 2: (0, 4), 3: (1, 3)}     # pointy hex interior, 5 x 4


def hex_cell(x, y):
    j = y // 4
    dy = y - j * 4
    off = 3 if j % 2 else 0
    i = (x - off) // 6
    dx = x - off - i * 6
    a, b = HCELL[dy]
    if a <= dx <= b:
        return (i, j, dx, dy)
    return None


def comb(cv, mask, glow, seed, bright=False):
    """Honeycomb over a mask: dark wax walls, cells empty, capped or full of glowing honey."""
    for (x, y) in mask:
        c = hex_cell(x, y)
        g = glow(x, y)
        if c is None:
            cv.set(x, y, 'X2' if bright else 'X1')
            continue
        i, j, dx, dy = c
        whole = all((x - dx + ax, y - dy + ay) in mask for ay in range(4)
                    for ax in range(HCELL[ay][0], HCELL[ay][1] + 1))
        v = hashf(i, j, seed)
        lv = g + (v - 0.5) * 0.4 + (0.35 if bright else 0)
        if not whole:
            k = 'X1'
        elif v < 0.2 and not bright:
            k = 'K' if dy < 2 else 'X1'                  # empty: a dark hole
        elif v < 0.4:
            k = 'X2' if lv < 0.7 else 'H1'               # capped with wax
            if dx == 2 and dy in (1, 2):
                k = 'H1' if lv < 0.7 else 'H2'
        else:                                           # honey, lit by the glow
            ramp = ['X2', 'H1', 'H2', 'H3', 'H4']
            base = 1 if lv < 0.35 else (2 if lv < 0.75 else 3)
            if bright and lv > 1.0:
                base = 3
            step = {0: -1, 1: 0, 2: 0, 3: -1}[dy]
            k = ramp[max(0, base + step)]
            if dy == 1 and dx == 1:
                k = ramp[min(4, base + 1)]
        cv.set(x, y, k)


def web(cv, ox, oy, sx, R, seed):
    """A corner web: spokes fanning from the corner, sagging rings between them."""
    angs = [math.radians(a) for a in (2, 20, 38, 56, 74, 90)]
    for a in angs:
        dline(cv, ox, oy, ox + sx * R * math.cos(a), oy + R * math.sin(a) * 0.95, 'WD', 0.95, seed)
    for ri, r in enumerate((6, 11.5, 17.5, 24)):
        if r > R:
            break
        for a0, a1 in zip(angs, angs[1:]):
            p0 = (ox + sx * r * math.cos(a0), oy + r * math.sin(a0) * 0.95)
            p1 = (ox + sx * r * math.cos(a1), oy + r * math.sin(a1) * 0.95)
            mid = ((p0[0] + p1[0]) / 2 - sx * r * 0.06, (p0[1] + p1[1]) / 2 - r * 0.05)
            k = 'WD' if ri % 2 == 0 else 'WB'
            dline(cv, p0[0], p0[1], mid[0], mid[1], k, 0.9, seed + ri)
            dline(cv, mid[0], mid[1], p1[0], p1[1], k, 0.9, seed + ri)
    # a torn strand hanging loose
    for y in range(0, 7):
        cv.set(ox + sx * (R * 0.55) + (1 if y > 3 else 0) * sx, oy + R * 0.6 + y, 'WD')


def roots_floor(cv, K, seed, vx=100, vy=-90, tw=15):
    """Broad roots running toward the viewer, wobbling, with grain along them."""
    nz = vnoise(seed)
    gz = vnoise(seed + 5)

    def u_of(x, y):
        s = (y + 0.5 - vy) / (cv.H - vy)
        u = (x + 0.5 - vx) / s
        return u + (nz(u / 34.0, y / 16.0) - 0.5) * 7

    for y in range(WALL, cv.H):
        for x in range(cv.W):
            u = u_of(x, y)
            c = math.floor(u / tw)
            t = u / tw - c
            v = hashf(c, 7, seed)
            k = K['a'] if v < 0.5 else K['b']
            g = gz(u / 1.8, y / 14.0)
            if g > 0.7:
                k = K['b'] if k == K['a'] else K['a']
            if c != math.floor(u_of(x - 1, y) / tw):
                k = K['j']
            elif t < 0.12 and bay(x, y) < 0.5:
                k = K['hi']
            elif t > 0.9 and bay(x, y) < 0.5:
                k = K['j']
            # where one root passes under another: a short dark seam
            elif hashf(c, int(y / 9.0 + v * 3), seed) < 0.12 and abs((y / 9.0 + v * 3) % 1) < 0.12:
                k = K['j']
            cv.set(x, y, k)


def scene_hive():
    rng = random.Random(303)
    cv = Cv(HIVE, 'W1', W, H)
    CX = 100
    nz = vnoise(41)
    # ------------------------------------------------ back wall: the inside of the trunk
    for y in range(0, WALL - 3):
        for x in range(W):
            bow = math.sin((x / W) * math.pi) * 2.5
            n = nz(x / 2.6 + math.sin(y / 5.0 + x / 30.0) * 0.5, (y - bow) / 16.0)
            k = 'W2' if n > 0.5 else 'W1'
            if n > 0.72:
                k = 'W3'
            if n < 0.22:
                k = 'W0'
            if n > 0.86 and bay(x, y) < 0.5:
                k = 'W4'
            cv.set(x, y, k)
    for (kx, ky) in ((14, 10), (73, 6), (128, 14), (186, 8)):    # knots
        for (r, k) in ((3.2, 'W3'), (2.2, 'W0'), (1.2, 'K')):
            cv.ellipse(kx, ky, r * 1.2, r, k)
    vault_shadow(cv, 'W0', 'K', 6)
    # honeycomb breaking through the wood on both sides
    pz = vnoise(52)
    for (pcx, pcy, rx, ry) in ((42, 11, 36, 14), (158, 11, 36, 14), (100, -2, 16, 6)):
        mask = set()
        for y in range(0, WALL - 3):
            for x in range(int(pcx - rx - 2), int(pcx + rx + 3)):
                dx = (x + 0.5 - pcx) / rx; dy = (y + 0.5 - pcy) / ry
                if dx * dx + dy * dy < 0.8 + (pz(x / 6.0, y / 4.0) - 0.5) * 0.8:
                    mask.add((x, y))
        rim = ring_of(mask, 2)
        for (x, y) in rim:
            if 0 <= y < WALL - 3:
                cv.set(x, y, 'W0' if (x, y - 1) in mask or (x - 1, y) in mask else 'W3')
        comb(cv, mask, lambda x, y: 0.75 - math.hypot((x - pcx) / rx, (y - pcy) / ry) * 0.6
             + (0.25 if abs(x - CX) < 40 else 0), seed=int(pcx))
    # the hive mouth: a glowing arch of comb in the middle
    am = arch_mask(CX + 0.5, 2, WALL - 3, 12)
    rim = ring_of(am, 3)
    for (x, y) in rim:
        if y < WALL - 3:
            k = 'X2' if x <= CX else 'X1'
            if (x, y + 1) in am or (x + 1, y) in am or (x - 1, y) in am:
                k = 'H1'
            cv.set(x, y, k)
    comb(cv, am, lambda x, y: 0.4 + ((y - 2) / 20.0) * 0.7 - abs(x + 0.5 - CX - 0.5) / 12.0 * 0.4,
         seed=9, bright=True)
    # the heart of the glow: a deep doorway in the comb
    inner = arch_mask(CX + 0.5, 9, WALL - 3, 5)
    grad_fill(cv, inner, ['X2', 'H2', 'H3', 'H4'],
              lambda x, y: (y - 9) / 13.0 * 1.1 - abs(x + 0.5 - CX - 0.5) / 5.0 * 0.35)
    light(cv, CX + 0.5, 12, 34, 16, {'W0': 'W1', 'W1': 'W2', 'W2': 'W3', 'W3': 'W4', 'K': 'W0'},
          power=1.3, steps=4, pred=lambda x, y: (x, y) not in am)
    # honey runs down from the comb
    for x in range(W):
        if hashf(x, 4, 13) < 0.3 and cv.get(x, 18) in ('X1', 'X2', 'H1', 'H2', 'W1', 'W2', 'W3'):
            if any(cv.get(x, yy) in ('H1', 'H2', 'H3') for yy in range(10, 19)):
                ln = 2 + int(hashf(x, 5, 13) * 4)
                for y in range(19, 19 + ln):
                    cv.set(x, y, 'H1' if y < 18 + ln else 'H2')
    # the trunk's floor lip: a ring of wood the roots grow out from
    cv.hline(0, W - 1, WALL - 3, 'W3')
    cv.hline(0, W - 1, WALL - 2, 'W2')
    cv.hline(0, W - 1, WALL - 1, 'W0')
    for x in range(W):
        if hashf(x, 2, 17) < 0.4:
            cv.set(x, WALL - 2, 'W1')
        if hashf(x // 3, 6, 17) < 0.3:
            cv.set(x, WALL - 3, 'W4' if hashf(x, 3, 17) < 0.3 else 'W2')
    # ------------------------------------------------ floor: root-wood
    roots_floor(cv, {'a': 'R2', 'b': 'R1', 'j': 'R0', 'hi': 'R3'}, seed=6)
    for _ in range(70):                                   # moss in the root gaps
        x = rng.randint(0, W - 1); y = rng.randint(WALL + 2, H - 1)
        if cv.get(x, y) == 'R0':
            cv.set(x, y, 'G1')
    wall_shadow(cv, ('R1', 'R2', 'R3', 'G1'), 'R0')
    # small honey puddles with a glint, fallen wax flakes
    for (hx, hy, rx, ry) in ((52, 58, 3.5, 1.4), (138, 84, 4.5, 1.6), (88, 110, 3, 1.2)):
        m = m_ell(hx, hy, rx, ry)
        for (x, y) in m:
            cv.set(x, y, 'X1')
        cv.set(hx - 1, int(hy), 'X2'); cv.set(hx, int(hy), 'H1')
    for (fx, fy) in ((70, 40), (126, 46), (34, 88), (158, 112)):
        cv.set(fx, fy, 'X1'); cv.set(fx + 1, fy, 'X1')
    # amber light: the hive mouth down the middle, faint pools under the comb
    pool = {'R1': 'L1', 'R2': 'L2', 'R3': 'L2', 'R0': 'R1', 'G1': 'R1'}
    light(cv, CX + 0.5, WALL + 1, 62, 44, pool, power=1.6, steps=4)
    for sx in (44, 156):
        light(cv, sx, WALL + 1, 30, 12, pool, power=1.5, steps=3)
    # ------------------------------------------------ vignette
    vignette(cv, {'R1': 'R0', 'R2': 'R1', 'R3': 'R2', 'L1': 'R1', 'L2': 'L1', 'R0': 'K', 'G1': 'R0',
                  'W1': 'W0', 'W2': 'W1', 'W3': 'W2', 'W4': 'W3', 'W0': 'K', 'X2': 'X1'},
             cy=66, rx=124, ry=80, inner=0.62, levels=2.0)
    # ------------------------------------------------ edge props
    # great roots curling down both edges
    for (p0, p1, p2, r0, r1) in (((-3, WALL - 6), (12, 50), (2, 100), 5.5, 3.2),
                                 ((-2, 70), (9, 95), (3, 128), 3.0, 4.5),
                                 ((203, WALL - 6), (188, 52), (198, 102), 5.5, 3.2),
                                 ((202, 76), (190, 100), (196, 130), 3.0, 4.5)):
        m = m_bez(p0, p1, p2, r0, r1, steps=50)
        for (x, y) in m:
            if (x, y + 2) not in m and cv.get(x, y + 2) in ('R0', 'R1', 'R2', 'R3', 'L1', 'G1'):
                cv.set(x, y + 2, 'K' if bay(x, y) < 0.5 else 'R0')
        cyl(cv, m, ('W4', 'W3', 'W2', 'W1', 'W0'), cuts=(0.2, 0.45, 0.7, 0.88))
        for (x, y) in m:
            if hashf(x, y // 3, 23) < 0.1:
                cv.set(x, y, 'W0')
    # silk-wrapped cocoons hanging at the edges
    for (cx_, cy_, ln) in ((19, 26, 8), (182, 24, 9), (10, 62, 6)):
        cv.vline(cx_, 0 if cy_ < 30 else cy_ - 14, cy_ - ln // 2 - 1, 'WD')
        m = m_ell(cx_, cy_, 2.4, ln / 2.0)
        cyl(cv, m, ('WB', 'WB', 'WD', 'WD', 'WD'), cuts=(0.25, 0.45, 0.7, 0.85))
        for (x, y) in m:
            if (y + x) % 3 == 0:
                cv.set(x, y, 'WD' if cv.get(x, y) == 'WB' else 'R0')
    # webs in the upper corners, a spider waiting in one
    web(cv, 0, 0, 1, 27, 61)
    web(cv, W - 1, 0, -1, 24, 62)
    stamp(cv, 183, 13, ["1.1.1", ".000.", "10001", ".020.", "1.1.1"], {'0': 'K', '1': 'WD', '2': 'H2'})
    cv.vline(185, 7, 12, 'WD')
    # egg sacs in the bottom corners
    for (ex, ey) in ((6, 116), (11, 120), (4, 122), (193, 115), (189, 120), (196, 121)):
        m = m_ell(ex, ey, 2.6, 2.0)
        for (x, y) in m:
            cv.set(x, y, 'WB' if (x, y - 1) not in m and (x - 1, y) not in m else 'WD')
    # amber motes drifting from the hive
    for _ in range(14):
        x = rng.uniform(64, 136); y = rng.uniform(2, 40)
        if cv.get(x, y) not in ('H3', 'H4'):
            cv.set(x, y, 'H2' if rng.random() < 0.6 else 'H3')
    return cv


# ================================================================ 4. Frostwatch Keep

FROST = {
    'K': '#070a19',
    'N1': '#0b1430', 'N2': '#1d3062',
    'T0': '#13152a', 'T1': '#20223a', 'T2': '#30314d', 'T3': '#464766', 'T4': '#666180',
    'S1': '#45558a', 'S2': '#7287ba', 'S3': '#b2c6e6', 'S4': '#eef6ff',
    'I2': '#74c2e4',
    'F1': '#a8421c', 'F2': '#ee8e30', 'F3': '#ffe388',
    'C1': '#4a1d33', 'C2': '#7a2e45',
    'E0': '#181a2d', 'E1': '#212439', 'E2': '#2a2d45', 'E3': '#353a55',
    'H1': '#382a36', 'H2': '#4a3237',
}


def snow_drift(cv, x0, x1, y, h, keys):
    """A small drift of snow, peaked in the middle."""
    for x in range(int(x0), int(x1) + 1):
        t = (x - x0) / max(1.0, x1 - x0)
        hh = h * math.sin(t * math.pi) ** 0.8
        for yy in range(int(round(y - hh)), y + 1):
            if cv.get(x, yy) in keys:
                cv.set(x, yy, 'S4' if yy == int(round(y - hh)) else ('S3' if yy < y else 'S2'))


def brazier(cv, x, y, big=True):
    """An iron brazier on three legs with a fire in its bowl; (x, y) the bowl's base centre."""
    cv.vline(x - 3, y, y + 5, 'T0'); cv.vline(x + 3, y, y + 5, 'T0'); cv.vline(x, y, y + 6, 'T0')
    cv.hline(x - 4, x + 4, y - 1, 'T3'); cv.hline(x - 3, x + 3, y, 'T2')
    cv.hline(x - 4, x + 4, y - 2, 'T4'); cv.set(x + 4, y - 1, 'T1')
    for i in range(-3, 4):
        h = 5 - abs(i) + (1 if i in (-1, 0) else 0)
        for j in range(h):
            k = 'F1' if j == h - 1 or abs(i) == 3 else ('F2' if j > 1 or abs(i) > 1 else 'F3')
            cv.set(x + i, y - 3 - j, k)
    cv.set(x, y - 9, 'F1'); cv.set(x - 1, y - 3, 'S4' if not big else 'F3')


def scene_frost():
    rng = random.Random(404)
    cv = Cv(FROST, 'T1', W, H)
    CX = 100
    # ------------------------------------------------ back wall: great frosted blocks
    wall_blocks(cv, 0, W, 0, WALL - 3, {'a': 'T2', 'b': 'T1', 'j': 'T0', 'hi': 'T3', 'lo': 'K'},
                bw=14, bh=6, seed=15)
    for y in range(0, WALL - 3):                          # rime on the block tops
        for x in range(W):
            if cv.get(x, y) == 'T3' and hashf(x, y, 3) < 0.35:
                cv.set(x, y, 'S1')
    vault_shadow(cv, 'T0', 'K', 5)
    # arrow slits with snow blowing in
    for sx in (20, 58, 142, 180):
        for y in range(3, 20):
            cv.hline(sx - 4, sx + 4, y, 'T1')
            cv.set(sx - 4, y, 'T3'); cv.set(sx - 3, y, 'T3'); cv.set(sx - 2, y, 'T2')
            cv.set(sx + 2, y, 'T0'); cv.set(sx + 3, y, 'T0'); cv.set(sx + 4, y, 'K')
            cv.set(sx - 1, y, 'N1'); cv.set(sx, y, 'N2' if 6 < y < 15 else 'N1'); cv.set(sx + 1, y, 'N1')
        for x in range(sx - 4, sx + 5):                   # pointed head
            for y in range(1, 3 + 1):
                if abs(x - sx) <= y + 1:
                    cv.set(x, y, 'T2' if x < sx else 'T0')
        cv.set(sx, 3, 'N1')
        cv.hline(sx - 5, sx + 5, 19, 'S3'); cv.hline(sx - 5, sx + 5, 20, 'T3')
        cv.set(sx - 5, 19, 'S2'); cv.set(sx + 5, 19, 'S2'); cv.hline(sx - 3, sx + 2, 18, 'S4')
        for y in range(6, 18, 3):
            cv.set(sx - 1 + (y // 3) % 3, y, 'S4')
        # snow blown in: specks drifting down and to the right, thinning out
        for i in range(10):
            t = i / 10.0
            px_ = sx + 2 + t * 18 + hashf(i, sx, 5) * 4
            py_ = 9 + t * 20 + hashf(sx, i, 6) * 6
            cv.set(px_, py_, 'S4' if i < 4 else 'S3')
    # banners between the slits
    for bx in (39, 161):
        cv.hline(bx - 6, bx + 6, 2, 'T4'); cv.set(bx - 7, 2, 'T3'); cv.set(bx + 7, 2, 'T3')
        for y in range(3, 21):
            for x in range(bx - 5, bx + 6):
                if y > 17 and abs(x - bx) < (y - 17) * 1.4:    # swallowtail
                    continue
                k = 'C2' if x < bx + 2 else 'C1'
                if x == bx - 5:
                    k = 'C1'
                if (x - bx + y) % 9 == 0 and x > bx - 4:
                    k = 'C1'
                cv.set(x, y, k)
            cv.set(bx - 5, y, 'C1')
        # a white wolf's head on each
        stamp(cv, bx - 3, 7, ["3...3", "33.33", "33333", ".343.", "..3.."],
              {'3': 'S3', '4': 'K'})
        cv.hline(bx - 4, bx + 4, 4, 'F2')
        cv.hline(bx - 4, bx + 4, 15, 'F2')
    # the great hearth in the middle
    HX0, HX1, HT = CX - 14, CX + 15, 9
    cv.rect(HX0 - 4, 2, HX1 + 4, WALL - 3, 'T2')
    for y in range(2, WALL - 3):                          # hood stones
        for x in range(HX0 - 4, HX1 + 4):
            k = 'T3' if x < CX else 'T2'
            if (y - 2) % 4 == 3 or (x + (y // 4) * 3) % 8 == 0:
                k = 'T1'
            cv.set(x, y, k)
    cv.hline(HX0 - 6, HX1 + 5, 6, 'T4'); cv.hline(HX0 - 6, HX1 + 5, 7, 'T1')   # mantel
    cv.hline(HX0 - 6, HX1 + 5, 5, 'S3')
    hm = arch_mask(CX + 0.5, HT, WALL - 3, 14.5)
    hm = {(x, y) for (x, y) in hm if y >= HT + 3 or abs(x + 0.5 - CX - 0.5) < 13}
    grad_fill(cv, hm, ['K', 'T0', 'F1', 'F2', 'F3'],
              lambda x, y: ((y - HT) / 13.0) ** 1.6 * 0.8 - abs(x + 0.5 - CX - 0.5) / 14.0 * 0.5)
    for (x, y) in ring_of(hm, 1):
        if HT - 2 <= y < WALL - 3:
            cv.set(x, y, 'T4' if x < CX else 'T3')
    for (lx, ly) in ((CX - 9, WALL - 5), (CX + 2, WALL - 5), (CX - 4, WALL - 6)):   # logs
        cv.hline(lx, lx + 7, ly, 'T0'); cv.hline(lx, lx + 7, ly + 1, 'K'); cv.set(lx, ly, 'F1')
    for x in range(CX - 11, CX + 13):                    # flame tongues
        ph = (x - CX + 11) % 4
        h = 2 + 5 * math.sin((x - CX + 11) / 23.0 * math.pi) ** 1.5 + (3, 1, -1, 1)[ph] + hashf(x // 4, 1, 7) * 3
        lean = 0
        for j in range(int(h)):
            f = j / max(1.0, h)
            k = 'F3' if f < 0.4 else ('F2' if f < 0.75 else 'F1')
            if ph == 2 and f > 0.5:
                break
            cv.set(x + lean, WALL - 6 - j, k)
    for (lx, ly) in ((CX - 9, WALL - 5), (CX + 2, WALL - 5)):
        cv.hline(lx, lx + 7, ly + 1, 'K'); cv.set(lx + 7, ly + 1, 'F1')
    # a round shield and crossed axes over the mantel
    stamp(cv, CX - 4, 0, [".T444T.", "T4CCC3T", "T4CSC3T", ".T333T."],
          {'T': 'T0', '4': 'T4', '3': 'T3', 'C': 'C2', 'S': 'S3'})
    for (ax, d) in ((CX - 10, 1), (CX + 11, -1)):
        dline(cv, ax, 0, ax + d * 4, 4, 'T4')
        cv.set(ax, 0, 'S3'); cv.set(ax - d, 1, 'S3')
    light(cv, CX + 0.5, 18, 36, 14, {'T0': 'T1', 'T1': 'T2', 'T2': 'T3', 'S1': 'S2'},
          power=1.3, steps=4, pred=lambda x, y: (x, y) not in hm)
    # icicles along the vault
    for x in range(1, W - 1):
        if hashf(x, 0, 21) < 0.2 and not (HX0 - 6 <= x <= HX1 + 5):
            ln = 2 + int(hashf(x, 1, 21) * 4)
            for y in range(0, ln):
                cv.set(x, y, 'S3' if y < 1 else ('I2' if y < ln - 1 else 'S2'))
    # plinth with frost and the drifts under the slits
    cv.hline(0, W - 1, WALL - 3, 'S1')
    cv.hline(0, W - 1, WALL - 2, 'T3')
    cv.hline(0, W - 1, WALL - 1, 'T0')
    for x in range(W):
        if hashf(x, 2, 19) < 0.45:
            cv.set(x, WALL - 3, 'T4')
    # ------------------------------------------------ floor: frosted flagstones
    flags(cv, {'a': 'E2', 'b': 'E1', 'j': 'E0', 'hi': 'E3'}, seed=11, tw=26, h0=7)
    cracks(cv, rng, 16, ('E1', 'E2', 'E3'), 'E0')
    nz = vnoise(66)
    for y in range(WALL, H):                              # hoarfrost, thicker near the walls
        for x in range(W):
            edge = max(0, 1 - y / 70.0) * 0.25 + (abs(x - CX) / 100.0) ** 3 * 0.35
            if cv.get(x, y) in ('E0', 'E3') and nz(x / 4.0, y / 3.0) + edge > 0.78 and bay(x, y) < 0.5:
                cv.set(x, y, 'S1')
    wall_shadow(cv, ('E1', 'E2', 'E3', 'S1'), 'E0')
    for sx in (20, 58, 142, 180):
        snow_drift(cv, sx - 5, sx + 9, WALL + 1, 3, ('E0', 'E1', 'E2', 'E3', 'S1', 'T0', 'T3', 'S1'))
        for i in range(5):                                # a tongue of snow spilling into the hall
            cv.set(sx + 3 + i * 2, WALL + 3 + i, 'S2' if i % 2 else 'S1')
    # warm light: the hearth and two braziers at the wall
    pool = {'E1': 'H1', 'E2': 'H2', 'E3': 'H2', 'E0': 'E1', 'S1': 'E3'}
    light(cv, CX + 0.5, WALL + 1, 56, 40, pool, power=1.6, steps=4)
    for bx in (77, 124):
        light(cv, bx + 0.5, WALL + 3, 18, 10, pool, power=1.4, steps=3)
    # ------------------------------------------------ vignette
    vignette(cv, {'E1': 'E0', 'E2': 'E1', 'E3': 'E2', 'H1': 'E1', 'H2': 'H1', 'E0': 'K', 'S1': 'E1',
                  'T1': 'T0', 'T2': 'T1', 'T3': 'T2', 'T4': 'T3', 'T0': 'K', 'C2': 'C1'},
             cy=66, rx=124, ry=80, inner=0.62, levels=2.0)
    # ------------------------------------------------ props
    brazier(cv, 77, WALL - 1)
    brazier(cv, 124, WALL - 1)
    # braziers at the far edges, and their pools
    for (bx, by) in ((7, 58), (192, 60)):
        light(cv, bx + 0.5, by + 3, 14, 7, {'E0': 'E1', 'E1': 'H1', 'E2': 'H2', 'K': 'E0'},
              power=1.3, steps=3)
        shade_under(cv, bx - 4, by + 4, bx + 5, by + 7, {'H1': 'E1', 'H2': 'H1', 'E2': 'E1', 'E1': 'E0'})
        brazier(cv, bx, by, big=False)
    # firewood stacked by the left wall, a weapon rack on the right
    shade_under(cv, 11, 32, 27, 35, {'H1': 'E1', 'H2': 'H1', 'E2': 'E1', 'E1': 'E0', 'E3': 'E2', 'S1': 'E1'})
    for (lx, ly) in ((13, 31), (18, 31), (23, 31), (15.5, 27.5), (20.5, 27.5), (18, 24)):
        cv.disc(lx, ly, 2.4, 'T0')
        cv.disc(lx - 0.3, ly - 0.3, 1.7, 'H2')
        cv.set(lx - 0.5, ly - 0.5, 'H1')
    cv.hline(174, 191, 33, 'T0')
    for i, rx_ in enumerate(range(176, 191, 3)):         # spears and an axe in a rack
        cv.vline(rx_, 19 + (i % 2) * 2, 32, 'T3' if i % 2 else 'T4')
        cv.set(rx_, 18 + (i % 2) * 2, 'S3'); cv.set(rx_, 17 + (i % 2) * 2, 'S4')
    stamp(cv, 186, 18, ["33.", "334", "33."], {'3': 'S3', '4': 'T4'})
    cv.hline(174, 191, 30, 'T2'); cv.hline(174, 191, 31, 'T0')
    cv.hline(174, 191, 24, 'T2')
    # snow drifted into the bottom corners, a frozen puddle
    for (x0, x1, y, h) in ((-6, 14, H - 1, 6), (186, 206, H - 1, 7), (8, 22, H - 1, 3)):
        snow_drift(cv, x0, x1, y, h, tuple(FROST.keys()))
    for (fx, fy, rx, ry) in ((150, 96, 9, 2.4), (54, 82, 7, 2.0)):
        m = m_ell(fx, fy, rx, ry)
        for (x, y) in m:
            cv.set(x, y, 'S1' if (x, y - 1) not in m or hashf(x, y, 2) < 0.2 else 'E3')
        cv.set(fx - 2, fy, 'I2'); cv.set(fx - 1, fy - 1, 'S3')
    # snow motes falling in the hall
    for _ in range(30):
        x = rng.uniform(0, W); y = rng.uniform(WALL, H)
        if cv.get(x, y) in ('E0', 'E1', 'E2', 'E3', 'H1', 'H2'):
            cv.set(x, y, 'S2' if rng.random() < 0.6 else 'S3')
    return cv


# ================================================================ 5. The Drowned Library

LIB = {
    'K': '#09091a',
    'S1': '#1f1b37', 'S2': '#342f50', 'S3': '#524a70', 'S4': '#7e7498',
    'N1': '#16143b', 'N2': '#28225c',
    'MO': '#fff3cc',
    'O0': '#22141c', 'O1': '#3a2228', 'O2': '#5e3328',
    'B1': '#7b2a3d', 'D2': '#2c5a5f', 'L2': '#bb7434', 'L3': '#f1be5e', 'L4': '#fff1b4',
    'A0': '#0e0e25', 'A1': '#161836', 'A2': '#1c1f42', 'A3': '#272c55',
    'D1': '#1a343f',
}

BOOKS = ('B1', 'D2', 'L2', 'S3', 'O2', 'B1', 'D2', 'S4')


def shelves(cv, x0, x1, seed):
    """A bookcase from the cornice to the waterline: three shelves of books, uprights."""
    for y in range(0, WALL - 3):
        for x in range(x0, x1):
            cv.set(x, y, 'O0')
    for x in range(x0, x1):
        cv.set(x, 0, 'O1'); cv.set(x, 1, 'O2'); cv.set(x, 2, 'O0')
    for sy in (9, 16, 23):
        top = sy - 6
        x = x0 + 1
        while x < x1 - 1:
            r = hashf(x, sy, seed)
            if r < 0.07:                                  # a gap
                x += 2
                continue
            k = BOOKS[int(hashf(x, sy + 1, seed) * len(BOOKS))]
            w = 1 if r < 0.75 else 2
            h = 4 + int(hashf(x, sy + 2, seed) * 2.5)
            for xx in range(x, min(x + w, x1 - 1)):
                for yy in range(sy - h, sy):
                    cv.set(xx, yy, k)
                cv.set(xx, sy - h, 'L3' if k in ('B1', 'O2') and hashf(xx, 4, seed) < 0.3 else k)
            if r > 0.93 and x + 3 < x1 - 1:               # a book fallen sideways
                cv.hline(x, x + 3, sy - 1, 'L2'); cv.hline(x, x + 3, sy - 2, 'B1')
                x += 4
                continue
            x += w
        if sy < WALL - 3:
            cv.hline(x0, x1 - 1, sy, 'O2'); cv.hline(x0, x1 - 1, sy + 1, 'O0')
    for ux in range(x0, x1, 20):                          # uprights
        cv.vline(ux, 0, WALL - 4, 'O1'); cv.vline(ux + 1, 0, WALL - 4, 'O0')
    cv.vline(x1 - 1, 0, WALL - 4, 'O1')


def candle(cv, x, y):
    cv.vline(x, y, y + 2, 'L4'); cv.set(x, y + 2, 'S4')
    cv.set(x, y - 1, 'L3'); cv.set(x, y - 2, 'L4')


def scene_library():
    rng = random.Random(505)
    cv = Cv(LIB, 'S1', W, H)
    CX = 100
    # ------------------------------------------------ back wall: bookcases either side of a window
    shelves(cv, 0, 80, 3)
    shelves(cv, 121, W, 4)
    # stone bay around the window
    cv.rect(80, 0, 121, WALL - 3, 'S2')
    for y in range(0, WALL - 3):
        for x in range(80, 121):
            if (y % 5 == 4) or ((x + (y // 5) * 4) % 9 == 0):
                cv.set(x, y, 'S1')
            elif y % 5 == 0:
                cv.set(x, y, 'S3')
    wm = arch_mask(CX + 0.5, 1, WALL - 5, 13, pointed=0.3)
    grad_fill(cv, wm, ['N1', 'N2'],
              lambda x, y: 0.75 - y / 22.0 + max(0.0, 1 - math.hypot(x - 104, y - 9) / 9.0) * 0.5)
    for (x, y) in m_ell(104.5, 9.5, 6.5, 6.5):
        if (x, y) in wm and bay(x, y) < 0.5:
            cv.set(x, y, 'S2')
    for (x, y) in m_ell(104.5, 9.5, 4.5, 4.5):
        if (x, y) in wm:
            cv.set(x, y, 'MO' if (x - 103.5) ** 2 + (y - 8.5) ** 2 < 11 else 'S4')
    cv.set(105, 8, 'L4'); cv.set(103, 11, 'L4')
    for (x, y) in wm:                                     # lead and mullions
        if (x in (CX - 5, CX + 6) and y > 5 or y in (14, 19) or (x == CX and y < 8)) and \
                cv.get(x, y) not in ('MO', 'S4', 'L4'):
            cv.set(x, y, 'K')
    for (x, y) in ring_of(wm, 3):
        if y < WALL - 3:
            cv.set(x, y, 'S3' if x <= CX else 'S1')
    for (x, y) in ring_of(wm, 4) - ring_of(wm, 3):
        if y < WALL - 3:
            cv.set(x, y, 'K' if x > CX else 'S1')
    for (x, y) in ring_of(wm, 1):
        if y < WALL - 3:
            cv.set(x, y, 'S4' if x <= CX else 'K')
    cv.hline(CX - 15, CX + 16, WALL - 5, 'S4'); cv.hline(CX - 15, CX + 16, WALL - 4, 'S2')
    for (sx, sy) in ((91, 4), (96, 10), (93, 15), (113, 15)):   # stars
        if cv.get(sx, sy) in ('N1', 'N2'):
            cv.set(sx, sy, 'S4')
    # water stain on the books: the flood came this high
    for y in range(WALL - 7, WALL - 3):
        for x in range(W):
            k = cv.get(x, y)
            if k in ('B1', 'D2', 'L2', 'S3', 'O2', 'S4', 'O1', 'S2') and bay(x, y) < q4((y - (WALL - 8)) / 4.0):
                cv.set(x, y, 'D1' if k not in ('O1', 'O2') else 'O0')
    cv.hline(0, W - 1, WALL - 3, 'S3')
    cv.hline(0, W - 1, WALL - 2, 'S2')
    cv.hline(0, W - 1, WALL - 1, 'A0')
    # ------------------------------------------------ floor: a tiled floor under still water
    tile = flags(cv, {'a': 'A2', 'b': 'A1', 'j': 'A0', 'hi': 'A3'}, seed=13, tw=20, h0=6)
    for y in range(WALL, H):                              # checkerboard, softened by water
        for x in range(W):
            k = cv.get(x, y)
            if k in ('A1', 'A2'):
                r, c = tile(x, y)
                k = 'A2' if (r + c) % 2 == 0 else 'A1'
                cv.set(x, y, k)
            elif k == 'A0' and hashf(x, y, 9) < 0.3:
                cv.set(x, y, 'A1')
            elif k == 'A3' and hashf(x, y, 8) < 0.5:
                cv.set(x, y, 'A2')
    # the wall mirrored in the water, breaking up with distance
    refl = {'MO': 'S4', 'S4': 'S3', 'S3': 'A3', 'S2': 'A2', 'S1': 'A1', 'N1': 'A1', 'N2': 'A2',
            'O2': 'O1', 'O1': 'O0', 'O0': 'A0', 'B1': 'O1', 'D2': 'D1', 'L2': 'O2', 'L3': 'L2',
            'L4': 'L3', 'D1': 'A1', 'K': 'A0', 'A0': 'A0'}
    for i in range(0, 9):
        y = WALL + i
        sy = WALL - 3 - i
        if sy < 0:
            break
        off = (0, 1, 0, -1)[i % 4] if i > 1 else 0
        p = q4(1 - i / 9.0)
        for x in range(W):
            k = cv.get(x + off, sy)
            if k in refl and bay(x, y) < p:
                cv.set(x, y, refl[k])
    # moonlight from the window down the water
    for y in range(WALL, H):
        t = (y - WALL) / float(H - WALL)
        hw = 10 + t * 26
        cx = CX + 6 + t * 18
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = abs(x + 0.5 - cx) / hw
            s = max(0.0, 1 - u) ** 0.6 * (1 - t * 0.5)
            k = cv.get(x, y)
            if k in ('A1', 'A2', 'A0') and bay(x, y) < q4(s * 1.3):
                cv.set(x, y, {'A0': 'A1', 'A1': 'A2', 'A2': 'A3'}[k])
            elif k == 'A3' and s > 0.55 and bay(x, y) < q4((s - 0.55) * 1.5):
                cv.set(x, y, 'S2')
    # the moon's broken reflection
    for i in range(10):
        y = WALL + 14 + i * 3 + (i * i) // 6
        if y >= H - 4:
            break
        x = CX + 8 + i * 2 + (1 if i % 2 else -1)
        ln = max(1, 5 - i // 2)
        cv.hline(x - ln // 2, x + ln // 2, y, 'S4' if i < 3 else 'S3')
        if i < 2:
            cv.set(x, y, 'MO')
    # long low swells: the light on the water's surface, in soft horizontal bands
    sz = vnoise(88)
    for y in range(WALL + 4, H):
        for x in range(W):
            n = sz(x / 22.0, y / 1.4)
            k = cv.get(x, y)
            if n > 0.6 and k in ('A0', 'A1', 'A2') and bay(x, y) < 0.5:
                cv.set(x, y, {'A0': 'A1', 'A1': 'A2', 'A2': 'A3'}[k])
            elif n < 0.2 and k in ('A2', 'A3') and bay(x, y) < 0.5:
                cv.set(x, y, {'A2': 'A1', 'A3': 'A2'}[k])
    # ripples: short sheen strokes over the water
    for _ in range(70):
        x = rng.randint(4, W - 6); y = rng.randint(WALL + 10, H - 2)
        ln = rng.randint(2, 5)
        k = 'A3' if rng.random() < 0.7 else 'D1'
        for xx in range(x, x + ln):
            if cv.get(xx, y) in ('A1', 'A2'):
                cv.set(xx, y, k)
    # ------------------------------------------------ vignette
    vignette(cv, {'A1': 'A0', 'A2': 'A1', 'A3': 'A2', 'D1': 'A1', 'A0': 'K', 'S1': 'K',
                  'S2': 'S1', 'S3': 'S2', 'O1': 'O0', 'O2': 'O1', 'O0': 'K', 'B1': 'O1', 'D2': 'D1',
                  'L2': 'O2', 'S4': 'S3'},
             cy=66, rx=124, ry=80, inner=0.62, levels=2.0)
    # ------------------------------------------------ props
    # floating candles before the shelves, with their glow and their reflections
    for (x, y) in ((22, 8), (47, 4), (66, 11), (134, 9), (156, 4), (178, 11), (12, 36), (188, 44),
                   (6, 78), (194, 90)):
        light(cv, x + 0.5, y, 8, 6, {'O0': 'O1', 'O1': 'O2', 'S1': 'S2', 'A1': 'A2', 'A0': 'A1',
                                     'A2': 'A3', 'D1': 'A3', 'K': 'A0'}, power=1.2, steps=2)
        candle(cv, x, y)
        if y > WALL:
            ry = y + 9
            cv.set(x, ry, 'L2'); cv.set(x, ry + 1, 'O2'); cv.set(x, ry + 3, 'O1')
    # piles of drowned books at the edges, a toppled chair, floating pages
    for (bx, by, n) in ((2, 50, 4), (191, 64, 3), (3, 104, 3), (190, 112, 4)):
        for i in range(n):
            k = BOOKS[(bx + i) % len(BOOKS)]
            yy = by - i * 2
            w = 6 - (i % 2)
            cv.hline(bx + (i % 2), bx + w, yy, k)
            cv.hline(bx + (i % 2), bx + w, yy + 1, 'O0')
            cv.set(bx + w, yy, 'S4' if i == n - 1 else k)
        cv.hline(bx - 1, bx + 7, by + 2, 'A3')
    for (px_, py_) in ((30, 30), (160, 33), (70, 118), (128, 121), (20, 92), (180, 82)):
        cv.hline(px_, px_ + 2, py_, 'S4'); cv.set(px_ + 1, py_ + 1, 'S3')
    return cv


# ================================================================ 6. Wyrmrest Spire

SPIRE = {
    'K': '#0d0b17',
    'K1': '#19162d', 'K2': '#2a2545', 'K3': '#40395f', 'K4': '#6b6592',
    'LW': '#f4fbff', 'LC': '#98d2ff',
    'R0': '#110d13', 'R1': '#211a20', 'R2': '#342a2e', 'R3': '#4e403d', 'R4': '#7a604f',
    'B1': '#6c604f', 'B2': '#a6967a', 'B3': '#dcd1b2',
    'T1': '#c4521c', 'T2': '#ffb444',
    'E1': '#5c9c8a',
    'Q0': '#19151c', 'Q1': '#241e26', 'Q2': '#2c262f', 'Q3': '#363039',
}


def rock_floor(cv, K, seed, cell=24):
    """Cracked rock slabs: a jittered Voronoi in floor space, squashed by perspective."""
    vy = -95

    def fp(x, y):
        s = (y + 0.5 - vy) / (cv.H - vy)
        return ((x + 0.5 - 100) / s, (y - WALL) / (s * 0.62))

    def pt(i, j):
        return ((i + 0.15 + hashf(i, j, seed) * 0.7) * cell, (j + 0.15 + hashf(j, i, seed + 1) * 0.7) * cell)

    def near(u, v):
        ci, cj = int(math.floor(u / cell)), int(math.floor(v / cell))
        best = []
        for i in range(ci - 1, ci + 2):
            for j in range(cj - 1, cj + 2):
                px_, py_ = pt(i, j)
                best.append((math.hypot(u - px_, v - py_), i, j))
        best.sort()
        return best

    nz = vnoise(seed + 2)
    ids = {}
    for y in range(WALL, cv.H):
        s = (y + 0.5 - vy) / (cv.H - vy)
        for x in range(cv.W):
            u, v = fp(x, y)
            b = near(u, v)
            d0, i, j = b[0]
            d1 = b[1][0]
            ids[(x, y)] = (i, j)
            k = K['a'] if hashf(i, j, seed + 3) < 0.5 else K['b']
            if nz(x / 4.0, y / 3.0) > 0.68:
                k = K['b'] if k == K['a'] else K['a']
            if (d1 - d0) * s < 1.1:
                k = K['j']
            cv.set(x, y, k)
    for (x, y), c in ids.items():                         # lit lip on the far side of each crack
        if cv.get(x, y) != K['j'] and cv.get(x, y - 1) == K['j'] and bay(x, y) < 0.5:
            cv.set(x, y, K['hi'])


def scene_spire():
    rng = random.Random(606)
    cv = Cv(SPIRE, 'R1', W, H)
    CX = 100
    nz = vnoise(71)
    # ------------------------------------------------ back wall: rough-hewn rock
    wall_blocks(cv, 0, W, 0, WALL - 3, {'a': 'R2', 'b': 'R1', 'j': 'R0', 'hi': 'R3', 'lo': 'K'},
                bw=15, bh=5, seed=19)
    for y in range(0, WALL - 3):
        for x in range(W):
            if nz(x / 5.0, y / 3.0) > 0.7 and cv.get(x, y) in ('R2', 'R3'):
                cv.set(x, y, 'R1')
    vault_shadow(cv, 'R0', 'K', 6)
    # the storm window
    wm = arch_mask(CX + 0.5, 3, WALL - 5, 11, pointed=0.5)
    cz = vnoise(72)
    grad_fill(cv, wm, ['K1', 'K2', 'K3', 'K4'],
              lambda x, y: cz(x / 6.0, y / 3.0) * 0.9 + (0.25 if y < 8 else 0) - 0.15)
    bolt = [(104, 2), (102, 6), (105, 8), (100, 13), (103, 14), (97, 20)]
    for (a, b) in zip(bolt, bolt[1:]):
        for (x, y) in m_seg(a[0], a[1], b[0], b[1], 1.0):
            if (x, y) in wm:
                cv.set(x, y, 'LC')
        dline(cv, a[0], a[1], b[0], b[1], 'LW')
    dline(cv, 102, 6, 94, 11, 'LC', keys=('K1', 'K2', 'K3', 'K4'))
    for (x, y) in wm:                                     # rain across the glass
        if (x * 2 + y) % 7 == 0 and hashf(x, y, 5) < 0.4 and cv.get(x, y) in ('K1', 'K2', 'K3'):
            cv.set(x, y, 'K4')
    for (x, y) in ring_of(wm, 2):
        if y < WALL - 3:
            cv.set(x, y, 'R4' if x <= CX else 'R3')
    for (x, y) in ring_of(wm, 1):
        if y < WALL - 3:
            cv.set(x, y, 'R3' if x <= CX else 'R1')
    cv.hline(CX - 12, CX + 13, WALL - 5, 'R4'); cv.hline(CX - 12, CX + 13, WALL - 4, 'R1')
    light(cv, CX + 0.5, 10, 32, 15, {'R1': 'K2', 'R2': 'K3', 'R3': 'K4', 'R0': 'K1'},
          power=1.6, steps=3, pred=lambda x, y: (x, y) not in wm)
    # the dragon's spine along the vault, its ribs arching down the wall
    ribs = set()
    for side in (-1, 1):
        for i, rx_ in enumerate((10, 27, 44, 61, 78)):
            x0 = CX + side * (CX - rx_)
            end = WALL - 2 - (abs(i - 2) * 2)
            m = m_bez((x0, 3), (x0 + side * 17, 9), (x0 + side * 7, end), 2.2, 0.8, steps=70)
            ribs |= m
    shadow = set()
    for (x, y) in ribs:
        if (x + 1, y + 1) not in ribs and cv.get(x + 1, y + 1) in ('R1', 'R2', 'R3', 'K2', 'K3'):
            shadow.add((x + 1, y + 1))
    for (x, y) in shadow:
        cv.set(x, y, 'R0')
    cyl(cv, ribs, ('B3', 'B2', 'B2', 'B1', 'B1'), cuts=(0.2, 0.45, 0.7, 0.9))
    for x in range(0, W):                                 # vertebrae
        v = x % 8
        if v in (0, 7):
            k = 'R0'
        else:
            k = 'B2' if v < 4 else 'B1'
        cv.set(x, 1, k); cv.set(x, 2, 'B1' if v not in (0, 7) else 'K')
        cv.set(x, 0, 'B3' if v in (2, 3) else ('B2' if v in (1, 4, 5) else 'K'))
        if v == 3:
            cv.set(x, 3, 'B1')
    # claw marks gouged into the rock
    for (cx_, cy_) in ((36, 8), (166, 11)):
        for i in range(3):
            for j in range(7):
                x, y = cx_ + i * 3 + j * 0.6, cy_ + j
                cv.set(x, y, 'R0'); cv.set(x - 1, y, 'R3')
    # torches flanking the window
    for tx in (77, 124):
        light(cv, tx + 0.5, 9, 9, 8, {'R1': 'R2', 'R2': 'R3', 'R0': 'R1', 'B1': 'B2'}, power=1.2, steps=2)
        cv.vline(tx, 10, 14, 'R0'); cv.hline(tx - 1, tx + 1, 10, 'R4')
        cv.set(tx, 9, 'T1'); cv.set(tx, 8, 'T2'); cv.set(tx - 1, 9, 'T1'); cv.set(tx + 1, 9, 'T1')
        cv.set(tx, 7, 'T1')
    # plinth
    cv.hline(0, W - 1, WALL - 3, 'R3')
    cv.hline(0, W - 1, WALL - 2, 'R2')
    cv.hline(0, W - 1, WALL - 1, 'R0')
    for x in range(W):
        if hashf(x, 2, 23) < 0.35:
            cv.set(x, WALL - 2, 'R1')
    # ------------------------------------------------ floor: cracked rock
    rock_floor(cv, {'a': 'Q2', 'b': 'Q1', 'j': 'Q0', 'hi': 'Q3'}, seed=17)
    cracks(cv, rng, 20, ('Q1', 'Q2', 'Q3'), 'Q0')
    wall_shadow(cv, ('Q1', 'Q2', 'Q3'), 'Q0')
    # storm light from the window, warm pools under the torches
    cold = {'Q1': 'K2', 'Q2': 'K2', 'Q3': 'K3', 'Q0': 'K1'}
    light(cv, CX + 3.5, WALL + 2, 56, 52, cold, power=1.4, steps=4)
    warm = {'Q1': 'R1', 'Q2': 'R2', 'Q3': 'R2', 'Q0': 'Q1'}
    for tx in (77, 124):
        light(cv, tx + 0.5, WALL + 1, 14, 7, warm, power=1.4, steps=2)
    # scattered scales and a few bone shards
    for (x, y) in ((40, 44), (150, 52), (66, 98), (122, 80), (172, 106), (30, 112), (96, 68)):
        cv.set(x, y, 'E1'); cv.set(x + 1, y, 'Q0')
    for (x, y) in ((58, 30), (140, 29), (112, 30)):
        cv.hline(x, x + 3, y, 'B1'); cv.set(x, y, 'B2'); cv.set(x + 3, y, 'B2')
    # ------------------------------------------------ vignette
    vignette(cv, {'Q1': 'Q0', 'Q2': 'Q1', 'Q3': 'Q2', 'K2': 'Q2', 'K3': 'K2', 'Q0': 'K', 'K1': 'Q0',
                  'R1': 'R0', 'R2': 'R1', 'R3': 'R2', 'R4': 'R3', 'R0': 'K', 'B1': 'R3', 'B2': 'B1'},
             cy=66, rx=124, ry=80, inner=0.62, levels=2.0)
    # ------------------------------------------------ props
    # a nest of eggs against the left wall
    nest = m_ell(16, 33, 12, 3.5)
    for (x, y) in nest:
        k = 'R2' if hashf(x, y, 3) < 0.5 else 'R1'
        if (x, y - 1) not in nest or hashf(x // 2, y, 4) < 0.15:
            k = 'R3'
        cv.set(x, y, k)
        if (x, y + 1) not in nest:
            cv.set(x, y + 1, 'K')
    for (ex, ey, sp) in ((9.5, 29, 0), (15.5, 28, 1), (21.5, 29.5, 0)):
        m = m_ell(ex, ey, 2.7, 3.4)
        cyl(cv, m, ('B3', 'B2', 'E1', 'E1', 'R3') if sp == 0 else ('B3', 'B3', 'B2', 'B1', 'B1'),
            cuts=(0.2, 0.4, 0.65, 0.88))
        for (x, y) in m:
            if (x, y + 1) not in m:
                cv.set(x, y, 'R3' if sp == 0 else 'B1')
        cv.set(ex - 1.5, ey - 1.5, 'LW')
    for (gx, gy) in ((5, 35), (25, 35), (28, 34), (3, 33), (12, 36)):
        cv.set(gx, gy, 'T2'); cv.set(gx + 1, gy, 'T1')
    # a broken column on the right by the wall
    for y in range(20, 36):
        for x in range(185, 196):
            jag = (3, 1, 0, 2, 4, 3, 1, 0, 2, 3, 5)[x - 185]
            if y < 21 + jag:
                continue
            u = (x - 185) / 10.0
            k = 'R4' if u < 0.25 else ('R3' if u < 0.6 else ('R2' if u < 0.85 else 'R1'))
            if y == 21 + jag:
                k = 'R4' if u < 0.6 else 'R3'
            if (x - 185) in (3, 7) and y > 23 + jag:
                k = 'R2' if u < 0.6 else 'R1'
            cv.set(x, y, k)
    cv.hline(184, 196, 36, 'K'); cv.hline(183, 197, 35, 'R1')
    for (x, y) in ((181, 34), (179, 35), (182, 35)):
        cv.set(x, y, 'R3'); cv.set(x + 1, y, 'R1')
    # the skull of an old wyrm in the bottom-right corner, snout to the left
    sk = m_poly([(201, 104), (192, 103), (186, 106), (176, 109), (172, 112), (173, 115),
                 (186, 115), (201, 116)])
    jaw = m_poly([(175, 117), (188, 117), (201, 119), (201, 125), (190, 125), (180, 121)])
    cyl(cv, jaw, ('B2', 'B2', 'B1', 'B1', 'R3'), cuts=(0.2, 0.4, 0.7, 0.9))
    for (x, y) in sk:
        k = 'B2'
        if (x, y - 1) not in sk:
            k = 'B3'
        elif (x, y + 1) not in sk:
            k = 'B1'
        cv.set(x, y, k)
    for x in range(174, 190, 2):                          # teeth
        cv.set(x, 116, 'B3')
    cv.hline(174, 189, 117, 'R0')
    for (x, y) in m_ell(188.5, 108.5, 2.6, 2.0):          # eye socket, a brow ridge
        cv.set(x, y, 'K')
    cv.hline(185, 191, 106, 'B3')
    cv.set(176, 111, 'K'); cv.set(177, 111, 'R0')       # nostril
    for (x, y) in m_bez((193, 104), (194, 97), (186, 93), 1.6, 0.6):   # swept-back horn
        cv.set(x, y, 'B2' if (x, y - 1) in m_bez((193, 104), (194, 97), (186, 93), 1.6, 0.6) else 'B3')
    shade_under(cv, 170, 116, 200, 125, {'Q1': 'Q0', 'Q2': 'Q1', 'Q3': 'Q2', 'K2': 'Q1'})
    # rubble in the bottom-left corner
    for (x, y) in ((1, 112), (4, 116), (0, 119), (7, 121), (3, 122)):
        cv.set(x, y, 'R3'); cv.set(x + 1, y, 'R2'); cv.set(x, y + 1, 'R1'); cv.set(x + 1, y + 1, 'R0')
    return cv


SCENES = [
    ('sunken-crypt', scene_crypt),
    ('emberdeep-foundry', scene_foundry),
    ('hollow-hive', scene_hive),
    ('frostwatch-keep', scene_frost),
    ('drowned-library', scene_library),
    ('wyrmrest-spire', scene_spire),
]
