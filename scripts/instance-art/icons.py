"""Room-type icons, 16 x 16 on transparent, drawn from shapes and outlined in one ink.
Light from the top left; every icon keeps a 1 px margin for its outline."""
import math
from engine import *

N = 16
PAL = {
    'o': '#170f1c',                                   # ink
    'z': '#0b0910',                                   # deep interior
    'a': '#3d3950', 'b': '#67617e', 'c': '#a39cb6',   # stone
    'd': '#56607a', 'e': '#9eaac2', 'f': '#eef4fc',   # steel
    'g': '#5a3420', 'h': '#8c5a30', 'i': '#c48c4c',   # wood
    'j': '#a2601a', 'k': '#eaa932', 'l': '#fff1a2',   # gold
    'm': '#7a1a2a', 'n': '#d03c3c', 'p': '#ff8a72',   # red
    'q': '#24683a', 'r': '#4cae4a', 's': '#b2ee76',   # green
    'F': '#e0561a', 'G': '#ffb230', 'Y': '#fff4b0',   # fire
    'u': '#4a2a6c', 'v': '#8a4ac2', 'w': '#cf98ff',   # arcane
    'x': '#cdc2a2', 'X': '#fffbea',                   # bone
    'B': '#245a9e', 'C': '#56a2e8', 'D': '#b8e2ff',   # party blue
}


def new():
    return Cv(PAL, None, N, N)


def ink(cv):
    """1 px outline around everything drawn."""
    add = []
    for y in range(N):
        for x in range(N):
            if cv.get(x, y) is not None:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                k = cv.get(x + dx, y + dy)
                if k is not None and k != 'o':
                    add.append((x, y))
                    break
    for x, y in add:
        cv.set(x, y, 'o')
    return cv


def shade(cv, m, keys):
    """Light from the top left: keys = (light, mid, dark); edges facing the light get light."""
    for (x, y) in m:
        up = (x, y - 1) not in m or (x - 1, y) not in m
        dn = (x, y + 1) not in m or (x + 1, y) not in m
        cv.set(x, y, keys[0] if up and not dn else (keys[2] if dn and not up else keys[1]))


# ---------------------------------------------------------------- icons

def entrance():
    cv = new()
    m = m_poly([(1, 15), (1, 6), (3, 3), (6, 1.5), (10, 1.5), (13, 3), (15, 6), (15, 15)])
    shade(cv, m, 'cba')
    door = m_poly([(4, 15), (4, 7), (5.5, 5), (10.5, 5), (12, 7), (12, 15)])
    for (x, y) in door:
        cv.set(x, y, 'z')
    for (x, y) in ((5, 5), (10, 5), (4, 6), (11, 6)):
        cv.set(x, y, 'o')
    for i, y in enumerate((9, 11, 13)):                 # stairs going down into the dark
        cv.hline(5 + i, 10 - i, y, 'a' if i < 2 else 'b')
    cv.hline(5 + 0, 10, 15, 'b')
    for x in (7, 8):
        cv.set(x, 2, 'X')                               # keystone
        cv.set(x, 3, 'c')
    for y in (8, 9):                                    # wall torches
        pass
    for tx in (2, 13):
        cv.set(tx, 7, 'Y'); cv.set(tx, 8, 'G'); cv.set(tx, 6, 'F'); cv.set(tx, 9, 'h'); cv.set(tx, 10, 'g')
    return ink(cv)


def fight():
    cv = new()
    for (tip, gc, sgn) in (((2, 2), (10, 10), 1), ((13, 2), (5, 10), -1)):
        # blade
        for i in range(8):
            x = tip[0] + sgn * i
            y = tip[1] + i
            cv.set(x, y, 'f')
            cv.set(x + sgn, y, 'e')
        cv.set(tip[0], tip[1], 'f'); cv.set(tip[0] + sgn, tip[1], None)
    for (gc, sgn) in (((10, 10), 1), ((5, 10), -1)):
        # cross-guard perpendicular to the blade
        for j in range(-2, 3):
            cv.set(gc[0] + sgn * j, gc[1] - j, 'l' if j == -2 else 'k')
        # grip and pommel
        cv.set(gc[0] + sgn, gc[1] + 1, 'h'); cv.set(gc[0] + 2 * sgn, gc[1] + 2, 'g')
        cv.set(gc[0] + 3 * sgn, gc[1] + 3, 'k')
    return ink(cv)


def trap():
    cv = new()
    cv.rect(1, 11, 15, 15, 'b')
    cv.hline(1, 14, 11, 'c'); cv.hline(1, 14, 14, 'a')
    for sx in (2, 6, 10):
        for i in range(8):
            hw = i // 3
            y = 4 + i
            for x in range(sx + 1 - hw, sx + 2 + hw):
                cv.set(x, y, 'f' if x <= sx + 1 - hw + (0 if hw else 0) and x < sx + 2 else ('e' if x == sx + 1 else 'd'))
        cv.set(sx + 1, 3, 'f')
        cv.hline(sx, sx + 2, 11, 'z')
    cv.set(7, 3, 'p'); cv.set(7, 4, 'n'); cv.set(7, 5, 'n'); cv.set(6, 6, 'm')    # blood on a tip
    cv.set(12, 11, 'n'); cv.set(13, 12, 'm')
    return ink(cv)


def puzzle():
    cv = new()
    m = set()
    m |= {(x, y) for x in range(2, 12) for y in range(4, 14)}
    m |= m_ell(7, 3, 2.4, 2.0)                          # top knob
    m |= m_ell(13, 9, 2.0, 2.4)                         # right knob
    m -= m_ell(2.5, 9, 2.0, 2.2)                        # left socket
    m = {p for p in m if 1 <= p[0] < 15 and 1 <= p[1] < 15}
    shade(cv, m, 'wvu')
    # a glowing rune on the piece
    for (x, y) in ((6, 7), (7, 7), (8, 7), (7, 8), (7, 9), (6, 10), (8, 10), (7, 11)):
        cv.set(x, y, 'X')
    cv.set(5, 6, 'w'); cv.set(9, 6, 'w')
    return ink(cv)


def elite():
    cv = new()
    helm = m_ell(8, 8.5, 5.2, 5.5) | {(x, y) for x in range(3, 13) for y in range(9, 14)}
    helm = {p for p in helm if 2 <= p[0] < 14 and 3 <= p[1] < 15}
    shade(cv, helm, 'edd')
    for (x, y) in helm:
        if (x - 1, y) not in helm or (x, y - 1) not in helm:
            cv.set(x, y, 'e')
    cv.set(5, 5, 'f'); cv.set(6, 4, 'f')
    # horns
    for (pts, k) in ((((3, 7), (2, 5), (1, 3), (1, 2)), 'x'), (((12, 7), (13, 5), (14, 3), (14, 2)), 'x')):
        for (x, y) in pts:
            cv.set(x, y, k)
        cv.set(pts[1][0] + (1 if pts[0][0] < 8 else -1), pts[1][1], 'x')
    cv.set(1, 2, 'X'); cv.set(14, 2, 'X')
    # visor slit with burning eyes, nasal guard
    cv.hline(4, 11, 9, 'z')
    cv.set(5, 9, 'n'); cv.set(6, 9, 'p'); cv.set(9, 9, 'p'); cv.set(10, 9, 'n')
    cv.vline(7, 8, 12, 'd'); cv.vline(8, 8, 12, 'e')
    cv.set(7, 9, 'e'); cv.set(8, 9, 'd')
    for x in (4, 6, 9, 11):
        cv.set(x, 12, 'z')
    return ink(cv)


def treasure():
    cv = new()
    body = {(x, y) for x in range(2, 14) for y in range(8, 15)}
    lid = m_ell(8, 8, 6, 4) | set()
    lid = {p for p in lid if p[1] < 8 and 2 <= p[0] < 14}
    shade(cv, body, 'ihg')
    shade(cv, lid, 'ihg')
    for x in range(2, 14):                              # gold bands
        cv.set(x, 8, 'k'); cv.set(x, 9, 'j')
    for y in range(4, 15):
        for x in (4, 11):
            if (x, y) in body or (x, y) in lid:
                cv.set(x, y, 'k' if y < 9 else 'j')
    cv.rect(7, 9, 9, 12, 'k'); cv.set(7, 9, 'l'); cv.set(8, 11, 'z')
    # coins spilling over the rim
    for (x, y, k) in ((3, 4, 'k'), (4, 3, 'l'), (6, 3, 'k'), (9, 2, 'l'), (10, 3, 'k'), (12, 4, 'j'),
                      (7, 2, 'k'), (5, 2, 'j')):
        cv.set(x, y, k)
    cv.set(9, 1, 'X')
    return ink(cv)


def rest():
    cv = new()
    # crossed logs
    for i in range(10):
        cv.set(3 + i, 14 - i // 3, 'h'); cv.set(3 + i, 13 - i // 3, 'i')
        cv.set(12 - i, 14 - i // 3, 'g'); cv.set(12 - i, 13 - i // 3, 'h')
    cv.set(2, 14, 'i'); cv.set(13, 14, 'g')
    # flame
    fl = m_poly([(8, 1.5), (11.5, 7), (11, 11), (5, 11), (4.5, 7), (6, 5), (7, 6.5)])
    for (x, y) in fl:
        cv.set(x, y, 'F')
    inner = m_poly([(8, 4.5), (10, 8), (9.5, 11), (6.5, 11), (6, 8.5)])
    for (x, y) in inner:
        cv.set(x, y, 'G')
    for (x, y) in ((8, 8), (8, 9), (7, 10), (8, 10), (9, 10)):
        cv.set(x, y, 'Y')
    cv.set(12, 3, 'G'); cv.set(4, 4, 'F')               # sparks
    # a stone ring
    for x in (2, 4, 11, 13):
        cv.set(x, 15 if x in (2, 13) else 15, 'b')
    return ink(cv)


def boss():
    cv = new()
    skull = m_ell(8, 9, 5.5, 5) | {(x, y) for x in range(5, 12) for y in range(12, 15)}
    skull = {p for p in skull if 2 <= p[0] < 14 and 4 <= p[1] < 15}
    shade(cv, skull, 'Xxx')
    for (x, y) in skull:
        if (x + 1, y) not in skull or (x, y + 1) not in skull:
            cv.set(x, y, 'b')
    for (x, y) in ((5, 9), (6, 9), (5, 10), (6, 10), (9, 9), (10, 9), (9, 10), (10, 10)):
        cv.set(x, y, 'z')
    cv.set(6, 9, 'n'); cv.set(9, 9, 'n')
    cv.set(7, 11, 'z'); cv.set(8, 11, 'z')
    for x in (6, 8, 10):
        cv.set(x, 14, 'z')
    # crown
    crown = {(x, y) for x in range(3, 13) for y in range(3, 6)}
    for (x, h) in ((3, 1), (6, 0), (8, 0), (10, 0), (12, 1)):
        crown |= {(x, y) for y in range(h + 1, 3)}
        crown |= {(x + 1, y) for y in range(h + 1, 3)} if x in (6, 8) else set()
    crown = {p for p in crown if p[0] < 14}
    shade(cv, crown, 'lkj')
    cv.set(7, 4, 'n'); cv.set(8, 4, 'p')
    cv.set(4, 4, 'C'); cv.set(11, 4, 'C')
    return ink(cv)


def cleared():
    cv = new()
    disc = m_ell(8, 8, 7, 7)
    shade(cv, disc, 'rqq')
    ring = {p for p in disc if math.hypot(p[0] + 0.5 - 8, p[1] + 0.5 - 8) > 5.6}
    for (x, y) in ring:
        cv.set(x, y, 's' if x + y < 15 else 'q')
    for (x, y) in ((4, 8), (5, 9), (6, 10), (7, 11), (8, 10), (9, 9), (10, 8), (11, 7), (12, 6),
                   (5, 8), (6, 9), (7, 10), (8, 9), (9, 8), (10, 7), (11, 6), (11, 5)):
        cv.set(x, y, 'X')
    cv.set(7, 12, 'q'); cv.set(8, 11, 'q')
    return ink(cv)


def locked():
    cv = new()
    shackle = {(x, y) for x in range(4, 12) for y in range(2, 8)} - {(x, y) for x in range(6, 10) for y in range(4, 8)}
    shackle -= {(4, 2), (11, 2)}
    shade(cv, shackle, 'fed')
    body = {(x, y) for x in range(2, 14) for y in range(7, 15)}
    shade(cv, body, 'lkj')
    for x in range(2, 14):
        cv.set(x, 7, 'l')
    cv.set(7, 9, 'z'); cv.set(8, 9, 'z'); cv.set(7, 10, 'z'); cv.set(8, 10, 'z')
    cv.vline(7, 11, 12, 'z')
    cv.set(3, 8, 'X')
    return ink(cv)


def party():
    cv = new()
    pin = m_ell(8, 6.5, 5.5, 5.5) | m_poly([(3.5, 8), (12.5, 8), (8, 15)])
    pin = {p for p in pin if 1 <= p[0] < 15 and 1 <= p[1] < 15}
    shade(cv, pin, 'CBB')
    for (x, y) in pin:
        if (x - 1, y) not in pin or (x, y - 1) not in pin:
            cv.set(x, y, 'D')
    # a gold star: you are here
    star = ["...l...",
            "...l...",
            "llllkkk",
            ".lkkkj.",
            ".lk.kj.",
            "lj...jj"]
    stamp(cv, 5, 3, star, {'l': 'l', 'k': 'k', 'j': 'j'})
    return ink(cv)


def flag():
    cv = new()
    cv.vline(3, 2, 15, 'h'); cv.vline(4, 2, 15, 'g')
    cv.set(3, 1, 'l'); cv.set(4, 1, 'k')
    cloth = m_poly([(5, 2), (14.5, 2.5), (11.5, 6.5), (14.5, 10.5), (5, 10)])
    for (x, y) in cloth:
        k = 'n'
        if y == 2 or x == 5:
            k = 'p'
        if y >= 9 or (x > 9 and (y == 6 or y == 7)):
            k = 'm'
        cv.set(x, y, k)
    # a tiny gold emblem
    cv.set(8, 5, 'k'); cv.set(9, 5, 'k'); cv.set(8, 6, 'l'); cv.set(9, 6, 'k'); cv.set(8, 7, 'j')
    cv.hline(2, 6, 15, 'a')
    return ink(cv)


ICONS = [('entrance', entrance), ('fight', fight), ('trap', trap), ('puzzle', puzzle),
         ('elite', elite), ('treasure', treasure), ('rest', rest), ('boss', boss),
         ('cleared', cleared), ('locked', locked), ('party', party), ('flag', flag)]


def all_icons():
    return {name: fn() for name, fn in ICONS}
