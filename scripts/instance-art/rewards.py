"""Six signature instance relics, 32 x 32 on transparent, clean and with a pixel halo.
Uses the sprite engine of the legendary-relics batch (sprite.py) so they sit in the same slots."""
import json, math, os
from sprite import *

HERE = os.path.dirname(os.path.abspath(__file__))


def H(x, y, s=0):
    n = (x * 73856093 ^ y * 19349663 ^ s * 83492791) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n & 0xffff) / 65535.0


BRONZE = R('#3a1e10', '#6e3e1a', '#a8702e', '#dca850', '#fff0b0')
VERD = R('#123a34', '#1e6050', '#3c9a7a', '#7ed4b0', '#d4fff0')
WITCH = R('#0e3a30', '#1e7a56', '#44c888', '#a4ffc4', '#f4fff0')
WEED = R('#10241a', '#1e4228', '#346a34', '#5e9a44', '#9cd06a')
CRUST = R('#140e12', '#271b20', '#3e2c2e', '#5e4642', '#866656')
MAGMA = R('#5a0a10', '#b02818', '#f0601c', '#ffaa30', '#fff0a0')
AMBER = R('#4a1e06', '#9a4e0e', '#e0901c', '#ffc84e', '#fff4b8')
ICE = R('#1c3e6c', '#3a7ab0', '#6ab8e0', '#aeeaff', '#f2ffff')
TEAL = R('#0f2430', '#1c3e4e', '#2f6070', '#4c8a94', '#86c2bc')
PAGE = R('#5a4c3c', '#8e7c62', '#c2b090', '#e6dcbe', '#fffaea')
ARC = R('#2a1a5a', '#5a34a8', '#9a6ae8', '#cfa8ff', '#f6ecff')
STORM = R('#1a2a6a', '#3456b8', '#6a90f0', '#b4d0ff', '#f4f8ff')


def bell(s):
    """The Tidewake Bell: a funeral bell from the crypt, green-lit from inside."""
    body = ell(16, 11, 6.2, 5.5) | poly([(9.8, 11), (22.2, 11), (25.5, 24), (6.5, 24)])
    lip = ell(16, 24, 10, 2.4)
    s.paint(body | lip, BRONZE, cap=4, grad=0.9, k=2.6)
    # verdigris creeping over the bronze, heaviest low and on the shadow side
    for p in body | lip:
        x, y = p
        if H(x // 3, y // 3, 3) < 0.12 + (y - 8) * 0.02 + (x - 16) * 0.035:
            s.put(x, y, VERD, s.ix[p])
    for x in range(8, 25):                            # a raised band
        if (x, 19) in body:
            s.put(x, 19, BRONZE, 3 if x < 16 else 2)
            s.put(x, 20, BRONZE, 1)
    s.paint(ell(16, 24.6, 7.6, 1.4), WITCH, flat=1, shadow=False)        # glowing mouth
    s.paint(ell(16, 24.8, 4.5, 0.9), WITCH, flat=2, shadow=False)
    s.paint(disc(16, 27, 1.8), WITCH, mode='sphere', sph=(16, 27, 1.8, 1.8), k=2, lo=2, hi=4)
    s.put(16, 25, IRON, 1); s.put(16, 26, IRON, 2)
    loop = disc(16, 4.8, 2.7) - disc(16, 4.8, 1.2)
    s.paint(loop, IRON, cap=1, k=2)
    # a strand of weed draped over the shoulder
    for t in range(0, 26):
        p = bezpt((11, 7), (7, 13), (9, 22), t / 25.0)
        s.put(int(p[0]), int(p[1]), WEED, 2 if t % 3 else 3)
    for t in range(0, 14):
        p = bezpt((20, 7), (23, 10), (22, 15), t / 13.0)
        s.put(int(p[0]), int(p[1]), WEED, 1 if t % 2 else 2)
    for (x, y) in ((8, 26), (24, 27), (9, 29)):       # drips
        s.put(x, y, ICE, 3, noline=True)
    s.glint(11, 10)


def slag(s):
    """Heart of the Last Pour: the foundry's final casting, banded in iron, still molten inside."""
    heart = disc(11, 12, 6.5) | disc(21, 12, 6.5) | poly([(4.6, 13.5), (27.4, 13.5), (16, 28.5)])
    heart -= poly([(14.5, 5), (17.5, 5), (16, 9)])
    s.paint(heart, CRUST, cap=4, grad=1.0, k=2.4)
    # molten seams breaking through the crust
    for pts in (((9, 14), (11, 17), (13, 19), (15, 24), (16, 26)),
                ((22, 13), (20, 16), (22, 18), (18, 20)),
                ((10, 17), (6, 16)), ((19, 23), (21, 21))):
        for a, b in zip(pts, pts[1:]):
            for p in bres(a[0], a[1], b[0], b[1]):
                if p in heart and p not in edge(heart):
                    s.put(p[0], p[1], MAGMA, 3 if p[1] < 16 else 2)
    s.gem(15.5, 19.0, 3.0, 2.8, MAGMA, glint=False)
    s.paint(disc(15.5, 19, 1.3), MAGMA, flat=4, shadow=False)
    # iron band across the upper lobes, riveted
    band = seg(4, 12.5, 28, 9, 1.5) & grow(heart, 1)
    s.paint(band, IRON, cap=1, k=2, base=2)
    for (x, y) in ((7, 12), (16, 10), (25, 9)):
        s.put(x, y, GOLD, 3)
    # a broken chain link hanging from the top
    link = ell(16, 4.5, 2.2, 2.8) - ell(16, 4.5, 0.9, 1.6)
    s.paint(link, IRON, cap=1, k=2, base=3)
    for (x, y, i) in ((4, 7, 3), (27, 5, 2), (25, 26, 3), (6, 24, 2)):       # sparks
        s.put(x, y, MAGMA, i + 1, noline=True)
    s.glint(9, 9)


def amber(s):
    """Amber of the Sleeping Queen: a drop of hive-amber with a tiny queen asleep inside."""
    drop = ell(16, 19.5, 8.8, 9.2) | poly([(8.6, 17), (23.4, 17), (16, 3.5)])
    s.paint(drop, AMBER, mode='sphere', sph=(15, 18, 10, 11.5), k=2.4, lo=1, hi=3)
    # light passing through: the far (lower right) inside glows
    for (x, y) in drop:
        d = math.hypot(x + 0.5 - 18.5, (y + 0.5 - 22) * 1.1)
        if d < 4.8 and (x, y) not in edge(drop):
            s.put(x, y, AMBER, 4 if d < 2.6 else 3)
    # the queen inside, seen from above: wings spread, striped abdomen
    queen = ["w.......w",
             "ww.0.0.ww",
             "www000www",
             ".ww000ww.",
             "..w000w..",
             "...0s0...",
             "..l000l..",
             "...0s0...",
             "..l000l..",
             "...0s0...",
             "....0...."]
    for gy, row in enumerate(queen):
        for gx, ch in enumerate(row):
            x, y = 12 + gx, 12 + gy
            if ch == '0':
                s.put(x, y, AMBER, 0)
            elif ch == 's':
                s.put(x, y, AMBER, 2)
            elif ch == 'w':
                s.put(x, y, AMBER, 4)
            elif ch == 'l':
                s.put(x, y, AMBER, 1)
    # bound at the top in a twist of silk
    for (x, y) in ((14, 6), (15, 5), (16, 5), (17, 6), (14, 7), (18, 7), (15, 8), (16, 8),
                   (17, 8), (16, 3), (16, 2), (17, 1), (15, 1), (16, 1)):
        s.put(x, y, BONE, 4 if x < 16 else 3)
    s.glint(11, 13)


def horn(s):
    """The Rimebitten Horn: the keep's warhorn, its bell crusted with ice."""
    p0, p1, p2 = (5, 6), (7, 26), (26, 20)
    body = bez(p0, p1, p2, 1.3, 5.2)
    s.paint(body, BONE, cap=3, grad=0.6, k=2.4)
    # ice crusting the top of the bell end
    for (x, y) in body:
        t = (x - 5) / 21.0
        if t > 0.6 and (x, y - 1) not in body and H(x, 0, 4) < 0.8:
            s.put(x, y, ICE, 4)
            s.put(x, y + 1, ICE, 3)
            if H(x, 1, 4) < 0.4:
                s.put(x, y + 2, ICE, 2)
    # steel bands
    for t in (0.2, 0.52):
        c = bezpt(p0, p1, p2, t)
        c2 = bezpt(p0, p1, p2, t + 0.02)
        dx, dy = c2[0] - c[0], c2[1] - c[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        r = 1.3 + 3.7 * t + 0.6
        band = seg(c[0] - nx * r, c[1] - ny * r, c[0] + nx * r, c[1] + ny * r, 1.0)
        s.paint(band & grow(body, 1), STEEL, cap=1, k=2)
    # the open bell
    mouth = ell(26.0, 20, 2.0, 5.2)
    s.paint(mouth & grow(body, 1), STEEL, flat=2, shadow=False)
    s.paint(ell(26.4, 20, 1.0, 3.8), IRON, flat=0, shadow=False)
    # icicles hanging off the bell rim
    for (x, l) in ((21, 3), (23, 4), (25, 2), (19, 2)):
        top = max(y for (xx, y) in body if xx == x) + 1
        for i in range(l):
            s.put(x, top + i, ICE, 4 if i == 0 else 3)
    # leather strap looping under
    for t in range(0, 30):
        p = bezpt((8, 13), (12, 30), (18, 24), t / 29.0)
        s.put(int(p[0]), int(p[1]), LEATHER, 2 if t % 4 else 3)
    s.put(4, 6, STEEL, 3); s.put(5, 5, STEEL, 4)       # mouthpiece
    s.glint(23, 14)


def tome(s):
    """The Drowned Concordance: a swollen, waterlogged index of the drowned library."""
    pages = poly([(9, 7), (26, 6), (27.5, 25), (10, 27)])
    s.paint(pages, PAGE, cap=2, k=2, base=3)
    for y in range(8, 27, 2):                          # wavy page edges
        for x in range(23, 28):
            if (x, y) in pages and (x + y) % 3 == 0:
                s.put(x, y, PAGE, 1)
    cover = poly([(5, 5), (23, 4), (24.5, 25), (6.5, 27)])
    s.paint(cover, TEAL, cap=3, grad=0.8, k=2.4)
    spine = poly([(4, 5.5), (7, 5), (8.5, 27), (5.5, 27.5)])
    s.paint(spine, TEAL, cap=1, base=1, k=2)
    for y in (8, 14, 20, 25):
        for x in range(4, 9):
            if (x, y) in spine:
                s.put(x, y, GOLD, 2)
    # a gold sigil: an open eye
    for (x, y) in ((12, 15), (13, 14), (14, 13), (15, 13), (16, 13), (17, 13), (18, 14), (19, 15),
                   (18, 16), (17, 17), (16, 17), (15, 17), (14, 17), (13, 16)):
        s.put(x, y, GOLD, 3)
    s.gem(15.8, 15.0, 1.6, 1.6, ARC)
    for (x0, y0) in ((9, 7), (21, 6), (10, 24), (22, 23)):  # corner fittings
        s.paint(rect(x0, y0, x0 + 1, y0 + 1), GOLD, cap=1)
    # clasp
    s.paint(rect(22, 13, 26, 16), GOLD, cap=1, k=2)
    s.put(25, 14, IRON, 0)
    # weed and water
    for t in range(0, 18):
        p = bezpt((7, 4), (13, 1), (17, 6), t / 17.0)
        s.put(int(p[0]), int(p[1]), WEED, 3 if t % 2 else 2)
    for (x, y, l) in ((11, 28, 3), (17, 27, 2), (21, 26, 4)):
        for i in range(l):
            s.put(x, y + i, ICE, 3 if i < l - 1 else 4, noline=i > 0)
    # a ghost-lit ribbon trailing out
    for (x, y, i) in ((19, 26, 2), (19, 27, 3), (20, 28, 3), (20, 29, 2), (21, 30, 3)):
        s.put(x, y, ARC, i)
    s.glint(8, 8)


def fang(s):
    """Fang of the Coiled Wyrm: pried from the skull on the spire, it hums before storms."""
    p0, p1, p2 = (12, 9), (13, 22), (23, 29)
    tooth = bez(p0, p1, p2, 4.4, 0.5)
    s.paint(tooth, BONE, cap=3, grad=0.7, k=2.6)
    for (x, y) in tooth:                               # enamel ridge
        c = bezpt(p0, p1, p2, max(0, min(1, (y - 9) / 20.0)))
        if abs(x - (c[0] - 1.5)) < 0.6 and 12 < y < 25:
            s.put(x, y, BONE, 4)
    for p in bres(15, 14, 13, 19):                     # an old crack
        if p in tooth:
            s.put(p[0], p[1], BONE, 1)
    # gold root cap wrapped in wire
    cap = ell(12, 8, 5.4, 3.2)
    s.paint(cap, GOLD, cap=2, k=2.4)
    for x in range(8, 17, 2):
        if (x, 8) in cap:
            s.put(x, 8, GOLD, 1)
    s.gem(12.0, 7.6, 1.5, 1.4, STORM)
    # leather cord loop
    for t in range(0, 26):
        p = bezpt((9, 6), (13, -3), (16, 6), t / 25.0)
        s.put(int(p[0]), int(p[1]), LEATHER, 3 if t % 3 else 2)
    # crackling storm around the tip
    for (x, y, i) in ((25, 22, 3), (26, 21, 4), (27, 22, 3), (27, 23, 2), (20, 30, 3), (19, 31, 2),
                      (26, 27, 3), (27, 28, 4), (5, 15, 3), (4, 16, 4), (6, 17, 2), (24, 13, 3),
                      (25, 12, 2)):
        s.put(x, y, STORM, i, noline=True)
    s.glint(10, 14)


ITEMS = [
    dict(id='tidewake-bell', instance='The Sunken Crypt', name='The Tidewake Bell',
         flavour='It rang for every burial. Underwater, it rings for the ones who stayed.',
         colour='#5ef0a8', draw=bell),
    dict(id='heart-of-the-last-pour', instance='Emberdeep Foundry', name='Heart of the Last Pour',
         flavour="The foundry's final casting never cooled. It beats at forge heat.",
         colour='#ff7a2a', draw=slag),
    dict(id='amber-of-the-sleeping-queen', instance='The Hollow Hive',
         name='Amber of the Sleeping Queen',
         flavour='A queen no bigger than a thumbnail, waiting for her hive to call.',
         colour='#ffb530', draw=amber),
    dict(id='rimebitten-horn', instance='Frostwatch Keep', name='The Rimebitten Horn',
         flavour='Blown once to warn the pass. The echo froze before it came back.',
         colour='#8fe6ff', draw=horn),
    dict(id='drowned-concordance', instance='The Drowned Library', name='The Drowned Concordance',
         flavour='Every page is ruined. Read it anyway: the ink rearranges itself.',
         colour='#b48cff', draw=tome),
    dict(id='fang-of-the-coiled-wyrm', instance='Wyrmrest Spire', name='Fang of the Coiled Wyrm',
         flavour='Pried from the skull on the spire. It hums when storms gather.',
         colour='#9fb4ff', draw=fang),
]


def bezpt(p0, p1, p2, t):
    return ((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
            (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])


def render(out_png, out_x1, report=None):
    os.makedirs(out_x1, exist_ok=True)
    arts = {}
    for it in ITEMS:
        assert len(it['flavour']) <= 72, it['id']
        s = Sprite()
        it['draw'](s)
        s.finish()
        clean = s.rgba()
        glow = glow_rgba(clean, it['colour'])
        arts[it['id']] = (clean, glow)
        for suffix, rows in (('', clean), ('-glow', glow)):
            write_png(os.path.join(out_x1, 'reward-' + it['id'] + suffix + '.png'), rows)
            write_png(os.path.join(out_png, 'reward-' + it['id'] + suffix + '.png'), upscale(rows, 6))
        n = len({tuple(p[:3]) for row in clean for p in row if p[3]})
        line = 'reward-%-28s %d colours' % (it['id'], n)
        print(line)
        if report is not None:
            report.append(line)
    rec = [{k: it[k] for k in ('id', 'name', 'instance', 'flavour', 'colour')} for it in ITEMS]
    with open(os.path.join(HERE, 'rewards.json'), 'w') as f:
        json.dump(rec, f, indent=2, ensure_ascii=False)
        f.write('\n')
    return arts


if __name__ == '__main__':
    render(os.path.join(HERE, 'png'), os.path.join(HERE, 'png', 'x1'))
