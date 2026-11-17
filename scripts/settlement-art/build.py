"""Render the settlement's art: the seven stages (plain and faded) and the five buildings at three
tiers, with contact sheets. Deterministic: every random source is seeded.
Run from the repository folder: python3 -I scripts/settlement-art/build.py [settlement] [buildings]"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from engine import *
import settlement

BG = hexc('#12151B')
OUT = os.path.join(HERE, 'png')
X1 = os.path.join(OUT, 'x1')
WHITE = (230, 232, 240)


def sheet_stack(imgs, names, sc, label_sc=2):
    w = len(imgs[0][0]) * sc; h = len(imgs[0]) * sc
    lab = 8 * label_sc + 12
    sheet = [[BG] * (w + 24) for _ in range(len(imgs) * (h + lab) + 12)]
    for i, (px, name) in enumerate(zip(imgs, names)):
        oy = 12 + i * (h + lab)
        blit(sheet, scale(px, sc), 12, oy)
        text(sheet, name, 12, oy + h + 5, label_sc, WHITE)
    return sheet


def settlement_all(report):
    stages = []
    for n in range(1, 8):
        cv = settlement.draw(n)
        name = settlement.NAMES[n].lower()
        px = cv.px
        fd = fade(px)
        save(px, os.path.join(X1, f'stage-{n}-{name}.png'))
        save(fd, os.path.join(X1, f'stage-{n}-{name}-fade.png'))
        save(scale(px, 3), os.path.join(OUT, f'stage-{n}-{name}.png'))
        save(scale(fd, 3), os.path.join(OUT, f'stage-{n}-{name}-fade.png'))
        report.append(f'stage-{n}-{name}: {len(cv.colors())} colours')
        stages.append(px)
    names = [f'{n}  {settlement.NAMES[n]}' for n in range(1, 8)]
    save(sheet_stack(stages, names, 2), os.path.join(HERE, 'sheet-settlement.png'))
    # side by side at x1.5 for continuity
    sm = [scale_f(p, 1.5) for p in stages]
    w = len(sm[0][0]); h = len(sm[0]); g = 8
    row = [[BG] * (7 * (w + g) + g) for _ in range(h + 2 * g + 12)]
    for i, p in enumerate(sm):
        blit(row, p, g + i * (w + g), g)
        text(row, f'{i + 1} {settlement.NAMES[i + 1]}', g + i * (w + g), g + h + 4, 1, WHITE)
    save(row, os.path.join(HERE, 'sheet-settlement-row.png'))


def main(parts):
    os.makedirs(X1, exist_ok=True)
    report = []
    if 'settlement' in parts:
        settlement_all(report)
    if 'buildings' in parts:
        import buildings
        buildings.render(OUT, X1, HERE, report)
    for r in report:
        print(r)


if __name__ == '__main__':
    main(sys.argv[1:] or ['settlement', 'buildings'])
