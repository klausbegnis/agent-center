"""Render every deliverable of the instance set and the four contact sheets.
Deterministic: every random source is seeded, PNGs are written by engine.py with zlib.
Run: python3 build.py            (writes png/, png/x1/, sheet-*.png, rewards.json)"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from engine import *
import banners, roadmap, isles_map, route, icons, rewards, sprite

OUT = os.path.join(HERE, 'png')
X1 = os.path.join(OUT, 'x1')
WHITE = (230, 232, 240)
GREY = (150, 160, 178)
BG = (0x12, 0x15, 0x1B)


def stack(imgs, names, sc, label_sc=2):
    w = len(imgs[0][0]) * sc; h = len(imgs[0]) * sc
    lab = 7 * label_sc + 14
    sheet = sheet_canvas(w + 24, len(imgs) * (h + lab) + 12)
    for i, (px, name) in enumerate(zip(imgs, names)):
        oy = 12 + i * (h + lab)
        blit(sheet, scale(px, sc), 12, oy)
        text(sheet, name, 12, oy + h + 6, label_sc, WHITE)
    return sheet


def variants(mod, sc, sheet_name, titles, report):
    imgs = []
    for (name, arg), title in zip(mod.VARIANTS, titles):
        cv = mod.draw(arg)
        save(cv.px, os.path.join(X1, name + '.png'))
        save(scale(cv.px, sc), os.path.join(OUT, name + '.png'))
        report.append('%-20s %d colours' % (name, len(cv.colors())))
        imgs.append(cv.px)
    save(stack(imgs, titles, 3), os.path.join(HERE, sheet_name))


def wrap(s, n):
    words, lines, cur = s.split(), [], ''
    for w in words:
        if len(cur) + len(w) + (1 if cur else 0) > n:
            lines.append(cur); cur = w
        else:
            cur = (cur + ' ' + w) if cur else w
    if cur:
        lines.append(cur)
    return lines


def icons_rewards(report):
    ic = icons.all_icons()
    for name, cv in ic.items():
        save(cv.px, os.path.join(X1, 'icon-' + name + '.png'))
        save(scale(cv.px, 6), os.path.join(OUT, 'icon-' + name + '.png'))
        report.append('icon-%-12s %d colours' % (name, len(cv.colors())))
    arts = rewards.render(OUT, X1, report)
    for nm, act in (('frame-legendary', True),):
        rows = sprite.frame(act)
        sprite.write_png(os.path.join(X1, nm + '.png'), rows)
        sprite.write_png(os.path.join(OUT, nm + '.png'), sprite.upscale(rows, 6))

    Wd = 24 + 6 * 124
    cell = 96
    rows_ic = 2
    # rewards: two per row, frame x4 (160 px) and text beside it
    rh = 184
    Ht = 20 + 30 + rows_ic * (cell + 44) + 30 + 3 * rh + 16
    sh = sheet_canvas(Wd, Ht)
    y = 16
    text(sh, 'ROOM ICONS  16X16 AT X6', 16, y, 2, (242, 196, 67))
    y += 30
    for i, (name, cv) in enumerate(ic.items()):
        cx = 24 + (i % 6) * 124
        cy = y + (i // 6) * (cell + 44)
        for yy in range(cell):                          # a dark tile so the outline reads
            for xx in range(cell):
                sh[cy + yy][cx + xx] = (28, 32, 41) if ((xx // 12 + yy // 12) % 2) else (24, 28, 36)
        blit(sh, scale(cv.px, 6), cx, cy)
        blit(sh, cv.px, cx + cell + 4, cy + cell - 16)  # the x1 size beside it
        text(sh, name, cx + (cell - text_w(name, 2)) // 2, cy + cell + 8, 2, WHITE)
    y += rows_ic * (cell + 44) + 6
    text(sh, 'INSTANCE RELICS  32X32 AT X4 IN THE LEGENDARY SLOT', 16, y, 2, (242, 196, 67))
    y += 30
    for i, it in enumerate(rewards.ITEMS):
        cx = 24 + (i % 2) * 372
        cy = y + (i // 2) * rh
        fr = [r[:] for r in sprite.frame(True)]
        sprite.composite(fr, arts[it['id']][1], 4, 4)
        blit(sh, scale([[p[:3] for p in r] for r in fr], 4), cx, cy)
        tx = cx + 172
        ty = cy + 4
        col = hexc(it['colour'])
        for line in wrap(it['name'], 16):
            text(sh, line, tx, ty, 2, col)
            ty += 20
        ty += 4
        text(sh, it['instance'], tx, ty, 1, GREY)
        ty += 14
        for line in wrap(it['flavour'], 31):
            text(sh, line, tx, ty, 1, (200, 190, 170))
            ty += 11
    save(sh, os.path.join(HERE, 'sheet-icons-rewards.png'))


def main():
    os.makedirs(X1, exist_ok=True)
    report = []
    banners.render(None, report)
    variants(roadmap, 3, 'sheet-roadmap.png',
             ['ROADMAP 1  FIRST SITE REACHED', 'ROADMAP 3  THREE CLEARED, FOURTH IN PROGRESS',
              'ROADMAP 6  ALL CLEARED'], report)
    variants(isles_map, 3, 'sheet-isles-map.png',
             ['ISLES MAP 1  FIRST SITE REACHED', 'ISLES MAP 4  FOUR CLEARED, FIFTH REACHED',
              'ISLES MAP 8  ALL CLEARED'], report)
    variants(route, 3, 'sheet-route.png',
             ['ROUTE START', 'ROUTE MID  THREE ROOMS CLEARED', 'ROUTE BOSS'], report)
    icons_rewards(report)
    big = []
    for d in (HERE, OUT, X1):
        for f in sorted(os.listdir(d)):
            if f.endswith('.png'):
                sz = os.path.getsize(os.path.join(d, f))
                if sz > 300 * 1024:
                    big.append((f, sz))
    with open(os.path.join(HERE, 'palette-report.txt'), 'w') as f:
        f.write('\n'.join(report) + '\n')
    print('\n'.join(report))
    print('files over 300 KB:', big or 'none')


if __name__ == '__main__':
    main()
