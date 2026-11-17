"""Render the six instance banners (192 x 72), their fade variants and the contact sheet.
Deterministic: every random source is seeded. Run: python3 banners.py [module ...]"""
import os, sys, importlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from engine import *

BANNERS = [('bn_crypt', 'sunken-crypt', 'The Sunken Crypt'),
           ('bn_foundry', 'emberdeep-foundry', 'Emberdeep Foundry'),
           ('bn_hive', 'hollow-hive', 'The Hollow Hive'),
           ('bn_frost', 'frostwatch-keep', 'Frostwatch Keep'),
           ('bn_library', 'drowned-library', 'The Drowned Library'),
           ('bn_spire', 'wyrmrest-spire', 'Wyrmrest Spire')]
BG = hexc('#12151B')
OUT = os.path.join(HERE, 'png')
X1 = os.path.join(OUT, 'x1')


def render(only=None, report=None):
    os.makedirs(X1, exist_ok=True)
    arts = []
    for mod, fid, name in BANNERS:
        if only and mod not in only and fid not in only:
            continue
        cv = importlib.import_module(mod).draw()
        px = cv.px
        fd = fade(px)
        save(px, os.path.join(X1, fid + '.png'))
        save(fd, os.path.join(X1, fid + '-fade.png'))
        save(scale(px, 4), os.path.join(OUT, fid + '.png'))
        save(scale(fd, 4), os.path.join(OUT, fid + '-fade.png'))
        line = '%-20s %d colours' % (fid, len(cv.colors()))
        print(line)
        if report is not None:
            report.append(line)
        arts.append((px, fd, name))
    if only:
        return
    sc = 3
    w, h = 192 * sc, 72 * sc
    lab = 34
    sheet = sheet_canvas(w + 24, len(arts) * (h + lab) + 12)
    for i, (px, fd, name) in enumerate(arts):
        oy = 12 + i * (h + lab)
        blit(sheet, scale(px, sc), 12, oy)
        text(sheet, name, 12, oy + h + 7, 3, (230, 232, 240))
    save(sheet, os.path.join(HERE, 'sheet-instances.png'))


if __name__ == '__main__':
    render(sys.argv[1:] or None)
