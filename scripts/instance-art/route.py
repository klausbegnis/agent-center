"""The Sunken Crypt, inside: six rooms in a side-on cutaway, 256 x 64, three progress states."""
import random, math
from engine import *

W, H = 256, 64
SURF = 10            # ground level

PAL = {
    # dusk above ground
    'K1': '#2c1f47', 'K2': '#6c3452', 'K3': '#cb7050',
    # earth and rock around the rooms
    'E0': '#0b090f', 'E1': '#17131d', 'E2': '#251f2d', 'E3': '#382f40',
    # masonry inside
    'S1': '#2f2a3b', 'S2': '#4a4459', 'S3': '#6f6782', 'S4': '#9c92aa',
    # witch-light and moss
    'W1': '#1d6a52', 'W2': '#3fb07c', 'W3': '#a6f2c4', 'M1': '#2b3b25',
    # torchlight
    'F1': '#b2501c', 'F2': '#f2a43e', 'F3': '#fff0a6',
    # flood water
    'A1': '#173837', 'A2': '#2a5c52',
    # bone, gold, blood-red, party blue
    'B1': '#a2947c', 'B2': '#e9ddc2', 'G1': '#a2621a', 'G2': '#f1b93a', 'G3': '#fff4aa',
    'R1': '#8a2232', 'R2': '#e04a4a', 'P1': '#2a5a9e', 'P2': '#64a8ec',
}

# (x0, x1, ceiling, floor) of each room's open interior
ROOMS = [(4, 40, 14, 50), (46, 90, 16, 50), (96, 132, 18, 50), (138, 172, 13, 51),
         (178, 206, 22, 50), (212, 252, 12, 55)]
NAMES = ['entrance', 'hall', 'trap', 'elite', 'vault', 'throne']

SKEL = [".bb.", "b00b", ".bb.", "bbbb", "b.bb", ".bb.", ".b.b", ".b.b"]
ZOMB = [".mm.", "mmw.", ".mm.", "mssm", "mss.", ".ss.", ".s.s", ".s.s"]
BONES = ["b..b.", ".bbb.", "bb.bb"]
HERO = [".h.", "hhh", ".c.", "ccc", "c.c"]
CHECK = [".ggggg.", "gggggxg", "ggggxgg", "gxgxggg", "ggxgggg", ".ggggg."]


def masonry(cv, x0, x1, y0, y1):
    for y in range(y0, y1):
        for x in range(x0, x1):
            row = (y - y0) // 3
            joint = (y - y0) % 3 == 2 or (x + row * 3) % 7 == 0
            cv.set(x, y, 'S1' if joint else 'S2')


def vault_ceiling(cv, x0, x1, top):
    """Shape the top of a room into a shallow arch; returns the ceiling y per column."""
    out = {}
    w = x1 - x0
    for x in range(x0, x1):
        u = (x - x0 + 0.5) / w
        c = top + int(round(6 * (2 * u - 1) ** 2))
        out[x] = c
    return out


def torch(cv, x, y, green=False):
    a, b, c = ('W1', 'W2', 'W3') if green else ('F1', 'F2', 'F3')
    cv.set(x, y + 1, 'S4'); cv.set(x, y + 2, 'S3')
    cv.set(x, y, b); cv.set(x, y - 1, c); cv.set(x - 1, y, a); cv.set(x + 1, y, a); cv.set(x, y - 2, a)


def lightpass(cv, x, y, r, green=False):
    remap = {'S1': 'S2', 'S2': 'S3', 'S3': 'S4'} if not green else {'S1': 'W1', 'S2': 'S3', 'A1': 'A2'}
    light(cv, x + 0.5, y + 0.5, r, r * 0.8, remap, power=1.4, steps=3)


def party(cv, x, floor, facing=1):
    """Four little adventurers and a pennant: the party."""
    cols = [('P2', 'P1'), ('R2', 'R1'), ('G2', 'G1'), ('B2', 'S3')]
    for i, (h, c) in enumerate(cols):
        px = x - facing * i * 4
        stamp(cv, px, floor - 5, HERO, {'h': h, 'c': c}, flip=facing < 0)
        if i == 0:
            cv.set(px + (2 if facing > 0 else 0), floor - 4, 'S4')        # a raised blade
            cv.set(px + (3 if facing > 0 else -1), floor - 5, 'S4')
    lx = x - facing * 4 * 3 - facing
    cv.vline(lx, floor - 12, floor - 1, 'E3')
    for (dx, dy) in ((1, -12), (2, -12), (3, -11), (1, -11), (2, -11), (1, -10)):
        cv.set(lx + dx * facing, floor + dy, 'P2' if dy == -12 else 'P1')
    cv.set(lx, floor - 13, 'G2')


def check(cv, cx, y):
    stamp(cv, cx - 3, y, CHECK, {'g': 'W2', 'x': 'B2'})


# ---------------------------------------------------------------- the rooms

def room_entrance(cv, r, st):
    x0, x1, top, fl = r
    # stairs from the surface down the left of the room
    for i in range(14):
        sx = x0 + 2 + i * 2
        sy = SURF + 3 + i * 3 - 2
        if sy > fl:
            break
        cv.rect(sx, sy, x1 - 6 if False else sx + 3, fl, 'S2')
        cv.hline(sx, sx + 2, sy, 'S4'); cv.set(sx + 3, sy, 'S3')
    torch(cv, x1 - 6, 30, green=True)
    lightpass(cv, x1 - 6, 30, 7, green=True)
    # a fallen gate leaf and a skull on a post
    cv.line(x1 - 14, fl - 1, x1 - 10, fl - 7, 'E1'); cv.line(x1 - 12, fl - 1, x1 - 8, fl - 7, 'E1')
    cv.set(x1 - 3, fl - 6, 'B2'); cv.set(x1 - 3, fl - 5, 'B1'); cv.vline(x1 - 3, fl - 4, fl - 1, 'E3')


def room_hall(cv, r, st):
    x0, x1, top, fl = r
    for px in (x0 + 8, x0 + 22, x0 + 36):
        cv.rect(px, top, px + 3, fl, 'S3'); cv.vline(px, top, fl - 1, 'S4'); cv.vline(px + 3, top, fl - 1, 'S1')
        cv.hline(px - 1, px + 4, top + 6, 'S4')
    # sarcophagi along the back wall
    for sx in (x0 + 13, x0 + 27):
        cv.rect(sx, fl - 4, sx + 7, fl, 'S3'); cv.hline(sx, sx + 6, fl - 4, 'S4'); cv.hline(sx + 1, sx + 5, fl - 5, 'S2')
    torch(cv, x0 + 4, 30); torch(cv, x1 - 4, 30)
    lightpass(cv, x0 + 4, 30, 12); lightpass(cv, x1 - 4, 30, 12)
    if st == 'fight':
        for (ex, kind) in ((x0 + 17, SKEL), (x0 + 25, ZOMB), (x0 + 32, SKEL), (x0 + 39, SKEL)):
            stamp(cv, ex, fl - 8, kind, {'b': 'B2', '0': 'E0', 'm': 'W1', 'w': 'W3', 's': 'S1'})
    elif st == 'cleared':
        for ex in (x0 + 16, x0 + 26, x0 + 34):
            stamp(cv, ex, fl - 3, BONES, {'b': 'B1'})


def room_trap(cv, r, st):
    x0, x1, top, fl = r
    # a flooded spike pit across the middle, crossed by stepping plates
    for y in range(fl, fl + 7):
        for x in range(x0 + 8, x1 - 6):
            cv.set(x, y, 'A1' if y > fl + 1 else 'A2')
    for sx in range(x0 + 9, x1 - 7, 3):
        cv.set(sx, fl + 1, 'S4'); cv.set(sx, fl, 'S3') if sx % 2 else None
    for px in (x0 + 12, x0 + 20):
        cv.hline(px, px + 3, fl - 1, 'S4')
    # spikes in the pit
    for sx in range(x0 + 10, x1 - 7, 3):
        cv.set(sx, fl + 2, 'S4'); cv.set(sx, fl + 3, 'S3'); cv.set(sx - 1, fl + 4, 'S3'); cv.set(sx + 1, fl + 4, 'S2')
    # a great pendulum axe on a chain, mid-swing
    px_ = x0 + 18
    sw = -3 if st != 'cleared' else 0
    for y in range(top + 2, fl - 13):
        t = (y - top - 2) / float(fl - 15 - top)
        cv.set(px_ + int(round(sw * t)), y, 'E0' if y % 2 else 'S4')
    bx = px_ + sw
    axe = ["..sssss..",
           ".sSSSSSs.",
           "sSSSSSSSs",
           "SS..e..SS",
           "S...e...S",
           "....e...."]
    stamp(cv, bx - 4, fl - 13, axe, {'s': 'S4', 'S': 'S3', 'e': 'E3'})
    # motion trail
    for i, k in ((3, 'S2'), (5, 'S1')):
        cv.hline(bx + i + 3, bx + i + 5, fl - 11, k)
    # puzzle: four rune tiles on the back wall, lit in order
    glyphs = (((1, 1),), ((0, 0), (2, 2)), ((0, 2), (1, 1), (2, 0)), ((0, 0), (2, 0), (0, 2), (2, 2)))
    for i, rx in enumerate(range(x1 - 19, x1 - 2, 5)):
        lit = st == 'cleared' or i == 0
        cv.rect(rx, 25, rx + 4, 30, 'W1' if lit else 'S1')
        for (gx, gy) in glyphs[i]:
            cv.set(rx + gx + 0.5, 26 + gy + 0.5, 'W3' if lit else 'S3')
    torch(cv, x0 + 4, 28); lightpass(cv, x0 + 4, 28, 10)


def room_elite(cv, r, st):
    x0, x1, top, fl = r
    cx = x0 + 22
    # dais and tattered banners
    cv.rect(cx - 8, fl - 3, cx + 9, fl, 'S3'); cv.hline(cx - 8, cx + 8, fl - 3, 'S4')
    for bx in (x0 + 4, x1 - 6):
        cv.rect(bx, top + 6, bx + 3, top + 18, 'R1'); cv.vline(bx, top + 6, top + 17, 'R2')
        cv.set(bx + 1, top + 19, 'R1'); cv.set(bx + 3, top + 18, 'E1')
        cv.hline(bx - 1, bx + 4, top + 5, 'G1')
    torch(cv, x0 + 10, 28); torch(cv, x1 - 10, 28)
    lightpass(cv, x0 + 10, 28, 12); lightpass(cv, x1 - 10, 28, 12)
    if st in ('fight', 'idle'):
        knight = ["..sss...",
                  ".s0r0s..",
                  ".sbbbs..",
                  "..sss...",
                  ".SsssS.g",
                  "SSsssSSg",
                  "SSsssS.g",
                  "SS.ss..g",
                  "..sss..g",
                  "..s.s...",
                  ".ss.ss..",
                  ".s...s.."]
        knight = [row.replace('r', '0') for row in knight]
        stamp(cv, cx - 4, fl - 15, knight, {'s': 'S4', '0': 'E0', 'b': 'B2', 'S': 'S3', 'g': 'S4'})
        cv.set(cx - 2, fl - 14, 'R2'); cv.set(cx, fl - 14, 'R2')
        light(cv, cx, fl - 13, 4, 3, {'S1': 'R1', 'S2': 'R1'}, power=1, steps=2)
    elif st == 'cleared':
        stamp(cv, cx - 3, fl - 6, BONES, {'b': 'B1'})
        cv.set(cx + 2, fl - 4, 'S4'); cv.set(cx + 3, fl - 4, 'S4'); cv.set(cx + 4, fl - 5, 'S3')


def room_vault(cv, r, st):
    x0, x1, top, fl = r
    # heaped gold and chests
    for (gx, gw) in ((x0 + 4, 9), (x0 + 15, 8)):
        for i in range(gw):
            hh = int(3 * math.sin(math.pi * (i + 0.5) / gw)) + 1
            for j in range(hh):
                cv.set(gx + i, fl - 1 - j, 'G2' if j == hh - 1 else 'G1')
        cv.set(gx + gw // 2, fl - 4, 'G3')
    for (cx_, open_) in ((x0 + 8, st == 'cleared'), (x1 - 8, False)):
        cv.rect(cx_ - 3, fl - 5, cx_ + 4, fl, 'G1')
        cv.hline(cx_ - 3, cx_ + 3, fl - 5, 'G2'); cv.set(cx_, fl - 3, 'G3')
        if open_:
            cv.hline(cx_ - 3, cx_ + 3, fl - 7, 'G1'); cv.set(cx_ - 1, fl - 6, 'G3'); cv.set(cx_ + 1, fl - 6, 'G3')
    for ux in (x0 + 2, x1 - 2):
        cv.rect(ux - 1, fl - 4, ux + 1, fl, 'S3'); cv.set(ux, fl - 5, 'S4')
    torch(cv, x0 + 14, 30); lightpass(cv, x0 + 14, 30, 11)
    light(cv, x0 + 14, fl - 2, 12, 4, {'S2': 'G1', 'S1': 'S2'}, power=1.2, steps=3)


def room_throne(cv, r, st):
    x0, x1, top, fl = r
    cx = x0 + 26
    # flooded floor, the throne on a drowned dais
    for y in range(fl - 3, fl + 1):
        for x in range(x0, x1):
            cv.set(x, y, 'A2' if y == fl - 3 else 'A1')
    cv.rect(cx - 7, fl - 6, cx + 8, fl - 2, 'S3'); cv.hline(cx - 7, cx + 7, fl - 6, 'S4')
    cv.rect(cx - 6, top + 10, cx + 7, fl - 6, 'S2')
    cv.rect(cx - 6, top + 8, cx - 3, fl - 6, 'S3'); cv.rect(cx + 4, top + 8, cx + 7, fl - 6, 'S1')
    for (x, y) in ((cx - 5, top + 7), (cx + 6, top + 7), (cx - 4, top + 6), (cx + 5, top + 6)):
        cv.set(x, y, 'B2')                                                  # skull finials
    # green braziers
    for bx in (x0 + 6, x1 - 6):
        cv.rect(bx - 1, fl - 9, bx + 1, fl - 3, 'S3'); cv.hline(bx - 2, bx + 2, fl - 9, 'S4')
        for (dx, dy, k) in ((0, -10, 'W3'), (-1, -10, 'W2'), (1, -10, 'W2'), (0, -11, 'W3'), (0, -12, 'W2'),
                            (-1, -12, 'W1'), (1, -13, 'W1')):
            cv.set(bx + dx, fl + dy, k)
        light(cv, bx + 0.5, fl - 10, 13, 10, {'S1': 'W1', 'S2': 'S3', 'A1': 'A2', 'S3': 'S4'}, power=1.4, steps=3)
    if st != 'cleared':
        # the Bone King on his throne
        lich = ["...g.g.g...",
                "...ggggg...",
                "...bbbbb...",
                "...b0b0b...",
                "....bbb....",
                "..rrrrrrr..",
                ".rrrrrrrrr.",
                "rrr.rrr.rrr",
                "rr..rrr..rr",
                "b...rrr...b",
                "....rrr....",
                "...rrrrr...",
                "..rrrrrrr.."]
        light(cv, cx + 0.5, top + 18, 16, 14, {'S1': 'W1', 'S2': 'S3', 'S3': 'S4'}, power=1.6, steps=4)
        stamp(cv, cx - 5, top + 12, lich, {'g': 'G2', 'b': 'B2', '0': 'W3', 'r': 'R1'})
        for (dx, dy) in ((0, 5), (0, 6), (0, 7), (0, 8), (0, 9), (0, 10), (0, 11)):
            cv.set(cx + dx, top + 12 + dy, 'R2')
        cv.vline(cx + 8, top + 9, fl - 6, 'B1')                              # staff
        cv.set(cx + 8, top + 8, 'W3'); cv.set(cx + 7, top + 8, 'W2'); cv.set(cx + 9, top + 8, 'W2')
        cv.set(cx + 8, top + 7, 'W2')
        light(cv, cx + 8, top + 8, 7, 6, {'S1': 'W1', 'S2': 'S3'}, power=1, steps=2)
    else:
        stamp(cv, cx - 3, fl - 9, BONES, {'b': 'B1'})
        cv.set(cx - 2, fl - 10, 'G2'); cv.set(cx, fl - 10, 'G2')


ROOM_FN = [room_entrance, room_hall, room_trap, room_elite, room_vault, room_throne]


DARK = {'S1': 'E1', 'S2': 'E1', 'S3': 'E2', 'S4': 'E2', 'W1': 'E1', 'W2': 'E2', 'W3': 'E2',
        'F1': 'E1', 'F2': 'E2', 'F3': 'E2', 'A1': 'E1', 'A2': 'E1', 'B1': 'E2', 'B2': 'E2',
        'G1': 'E1', 'G2': 'E2', 'G3': 'E2', 'R1': 'E1', 'R2': 'E2', 'M1': 'E1', 'E3': 'E1'}


def draw(state):
    """state: 'start' (party at the entrance), 'mid' (rooms 1-3 cleared, party in room 4),
    'boss' (rooms 1-5 cleared, party facing the boss)."""
    cv = Cv(PAL, 'E1', W, H)
    nz = vnoise(81)
    # ------------------------------------------------------------ dusk above, earth below
    bands(cv, [(0, 'K1'), (5, 'K2'), (8, 'K3')], y1=SURF, tw=2)
    for y in range(SURF, H):
        for x in range(W):
            n = nz(x / 6.0, y / 4.0)
            k = 'E1' if n < 0.55 else 'E2'
            if n > 0.78:
                k = 'E3'
            cv.set(x, y, k)
    for x in range(W):
        cv.set(x, SURF, 'M1'); cv.set(x, SURF + 1, 'E3' if x % 3 else 'M1')
    # the mausoleum above the stair, small and far
    cv.rect(8, 3, 21, SURF, 'S2'); cv.hline(7, 22, 3, 'S3')
    for i in range(4):
        cv.hline(10 + i, 19 - i, 2 - i, 'S3')
    cv.rect(13, 5, 16, SURF, 'W2'); cv.set(14, 6, 'W3')
    for px_ in (9, 19):
        cv.vline(px_, 4, SURF - 1, 'S4')
    # a dead tree and crows on the far right of the surface
    cv.vline(238, 2, SURF, 'E0'); cv.line(238, 5, 234, 2, 'E0'); cv.line(238, 4, 242, 1, 'E0')
    cv.set(233, 1, 'E0'); cv.set(242, 0, 'E0')
    for (x, y) in ((120, 3), (126, 2), (200, 4)):
        crow_fly(cv, x, y, 'E0', (x // 3) % 3)
    # roots reaching down
    for rx in (60, 112, 150, 196, 236):
        for i in range(6):
            cv.set(rx + (i % 3) - 1, SURF + 2 + i, 'E3')

    # ------------------------------------------------------------ carve the rooms
    for i, (x0, x1, top, fl) in enumerate(ROOMS):
        ceil = vault_ceiling(cv, x0, x1, top)
        for x in range(x0, x1):
            masonry(cv, x, x + 1, ceil[x], fl)
            cv.set(x, ceil[x] - 1, 'S3')                     # ceiling rim
            cv.set(x, ceil[x] - 2, 'E3')
        # floor
        for x in range(x0 - 1, x1 + 1):
            cv.set(x, fl, 'S4'); cv.set(x, fl + 1, 'S2'); cv.set(x, fl + 2, 'E3')
        for y in range(top, fl + 1):
            cv.set(x0 - 1, y, 'E3'); cv.set(x1, y, 'E3')
    # doorways between rooms
    for i in range(len(ROOMS) - 1):
        a, b = ROOMS[i], ROOMS[i + 1]
        fl = min(a[3], b[3])
        for x in range(a[1], b[0]):
            for y in range(fl - 9, max(a[3], b[3]) + 1):
                cv.set(x, y, 'S1')
            cv.set(x, fl - 10, 'S4'); cv.set(x, fl - 11, 'S3')
            cv.set(x, max(a[3], b[3]), 'S4')
        cv.vline(a[1], fl - 9, fl, 'S3'); cv.vline(b[0] - 1, fl - 9, fl, 'S1')
    # moss along the flooded deep end
    for x in range(W):
        if hashf(x, 3, 3) < 0.25:
            cv.set(x, SURF + 2, 'M1')

    # ------------------------------------------------------------ fill the rooms
    party_room = {'start': 0, 'mid': 3, 'boss': 5}[state]
    for i, r in enumerate(ROOMS):
        if i < party_room:
            st = 'cleared'
        elif i == party_room:
            st = 'fight' if i else 'idle'
        else:
            st = 'idle' if i != 1 else 'fight'
        ROOM_FN[i](cv, r, st)
    # darken the unexplored rooms
    for i, (x0, x1, top, fl) in enumerate(ROOMS):
        if i <= party_room:
            continue
        for y in range(top - 1, fl + 8):
            for x in range(x0 - 1, x1 + 1):
                k = cv.get(x, y)
                if k in DARK:
                    cv.set(x, y, DARK[k])
        # a faint question of what waits: two eyes in the dark
        eyes = {1: [(x0 + 18, fl - 7, 'R2'), (x0 + 26, fl - 7, 'W2'), (x0 + 33, fl - 7, 'R2'),
                    (x0 + 40, fl - 7, 'R2')],
                3: [(x0 + 19, fl - 14, 'R2')], 5: [(x0 + 23, top + 15, 'W3')]}
        for (ex, ey, k) in eyes.get(i, []):
            cv.set(ex, ey, k); cv.set(ex + 2, ey, k)
    # doors into dark rooms are shut
    for i in range(len(ROOMS) - 1):
        if i + 1 > party_room:
            a, b = ROOMS[i], ROOMS[i + 1]
            fl = min(a[3], b[3])
            for x in range(a[1], b[0]):
                for y in range(fl - 9, fl + 1):
                    cv.set(x, y, 'G1' if (x - a[1]) % 2 == 0 else 'E3')
            cv.set(a[1] + 1, fl - 4, 'G2')
    # cleared rooms get a check badge in their vault
    for i, (x0, x1, top, fl) in enumerate(ROOMS):
        if i < party_room:
            check(cv, (x0 + x1) // 2, top + 1 + (4 if i == 4 else 0))
    # the party
    x0, x1, top, fl = ROOMS[party_room]
    if state == 'start':
        party(cv, x0 + 26, fl)
    elif state == 'mid':
        party(cv, x0 + 13, fl)
    else:
        party(cv, x0 + 14, fl - 3)
    return cv


VARIANTS = [('route-start', 'start'), ('route-mid', 'mid'), ('route-boss', 'boss')]
