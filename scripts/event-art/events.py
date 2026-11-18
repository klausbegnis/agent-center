#!/usr/bin/env python3
"""Icons of the weekly events, one per kind of event in game/events.json.

Each icon is drawn by hand on a 16 x 16 grid below and written to ui/art/events/<kind>.png at
twice that size (32 x 32, nearest neighbour), so the banner and the room's marker can show it
crisp at 16 or 32 pixels. Deterministic, no network, nothing but Python 3: the PNGs are written
with zlib. Run it from anywhere:

    python3 scripts/event-art/events.py
"""
import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'ui', 'art', 'events')
SCALE = 2

# One letter per pixel; '.' is clear. Each icon has its own palette; 'k' is always the outline.
INK = (28, 20, 36, 255)

ICONS = {
    # A paw print: a race comes more often.
    'race': ({'k': INK, 'a': (176, 132, 96, 255), 'b': (226, 190, 150, 255)}, [
        '................',
        '..kkk......kkk..',
        '.kaabk....kbaak.',
        '.kaaak....kaaak.',
        '..kkk.kkkk.kkk..',
        '.....kbaak......',
        '.kk..kaaak..kk..',
        'kabk..kkk..kbak.',
        'kaak.......kaak.',
        '.kk..kkkkk..kk..',
        '....kbaaaak.....',
        '...kbaaaaaak....',
        '...kaaaaaaak....',
        '...kaaaaaaak....',
        '....kaakaak.....',
        '.....kk.kk......',
    ]),
    # Bunting on a string: a city holds a festival.
    'festival': ({'k': INK, 'r': (222, 72, 72, 255), 'y': (240, 196, 64, 255), 'b': (72, 140, 222, 255), 's': (150, 120, 90, 255)}, [
        '................',
        '................',
        '................',
        '................',
        'ss............ss',
        '.sss........sss.',
        '..sssssssssssss.',
        '..krrkyykbbkrrk.',
        '..krrkyykbbkrrk.',
        '...krkyykbbkrk..',
        '...krk.kykbk.k..',
        '....k...k.k.....',
        '................',
        '................',
        '................',
        '................',
    ]),
    # A flower on its stem: a material is in bloom.
    'bloom': ({'k': INK, 'p': (236, 120, 176, 255), 'y': (250, 214, 80, 255), 'g': (88, 172, 84, 255), 'd': (56, 120, 60, 255)}, [
        '................',
        '.....kkkkk......',
        '....kppkppk.....',
        '...kpppkpppk....',
        '...kppkykppk....',
        '..kpkkyyykkpk...',
        '..kppkykykppk...',
        '...kppkkkppk....',
        '....kkpkpkk.....',
        '......kgk.......',
        '..kkk.kgk.kkk...',
        '..kggkkgkkggk...',
        '...kdgggggdk....',
        '....kkkgkkk.....',
        '......kgk.......',
        '......kkk.......',
    ]),
    # A crown: a boss hunt.
    'bosses': ({'k': INK, 'y': (244, 196, 60, 255), 'o': (196, 136, 36, 255), 'r': (214, 60, 70, 255), 'b': (80, 150, 230, 255)}, [
        '................',
        '................',
        '..k....k....k...',
        '.kyk..kyk..kyk..',
        '.kyk..kyk..kyk..',
        '.kyyk.kyk.kyyk..',
        '.kyyykyyykyyyk..',
        '.kyyyyyyyyyyyk..',
        '.kyrykybykyryk..',
        '.kyyyyyyyyyyyk..',
        '.koooooooooook..',
        '.kkkkkkkkkkkkk..',
        '................',
        '................',
        '................',
        '................',
    ]),
    # A red banner on a pole: bounties on the toughest of every pack.
    'bounty': ({'k': INK, 'r': (206, 52, 58, 255), 'd': (140, 30, 40, 255), 'w': (240, 230, 210, 255), 's': (150, 120, 90, 255)}, [
        '..k.............',
        '.kwk............',
        '..kkkkkkkkkk....',
        '..ksrrrrrrrrk...',
        '..ksrrrrrrrrk...',
        '..ksrrwrrwrrk...',
        '..ksrrrwwrrrk...',
        '..ksrrwrrwrrk...',
        '..ksrrrrrrrrk...',
        '..ksdrrrrrrdk...',
        '..ksk.drrd.k....',
        '..ksk..dd.......',
        '..ksk...........',
        '..ksk...........',
        '..ksk...........',
        '..kkk...........',
    ]),
    # An open book: a week of training.
    'training': ({'k': INK, 'w': (240, 232, 214, 255), 'l': (190, 178, 160, 255), 'c': (110, 70, 150, 255)}, [
        '................',
        '................',
        '..kkkk....kkkk..',
        '.kwwwwk..kwwwwk.',
        '.kwllwwkkwwllwk.',
        '.kwwwwwkkwwwwwk.',
        '.kwllwwkkwwllwk.',
        '.kwwwwwkkwwwwwk.',
        '.kwllwwkkwwllwk.',
        '.kwwwwwkkwwwwwk.',
        '.kkkwwwkkwwwkkk.',
        '.ckkkkkkkkkkkkc.',
        '..cccccccccccc..',
        '................',
        '................',
        '................',
    ]),
    # A stack of coins: gold in the streams.
    'gold': ({'k': INK, 'y': (246, 204, 70, 255), 'o': (200, 142, 40, 255), 'w': (255, 244, 190, 255)}, [
        '................',
        '................',
        '.......kkkkk....',
        '......kywwyyk...',
        '......kyyyyyk...',
        '......koooook...',
        '..kkkkkkkkkkk...',
        '.kywwyyykyyyyk..',
        '.kyyyyyykooook..',
        '.koooooookkkkk..',
        '.kkkkkkkkywyyk..',
        '.kywwyyyykyyyk..',
        '.kyyyyyyykoook..',
        '.koooooookkkk...',
        '.kkkkkkkkk......',
        '................',
    ]),
    # A sun: the season's weather.
    'season': ({'k': INK, 'y': (250, 206, 72, 255), 'o': (236, 150, 50, 255)}, [
        '................',
        '.......kk.......',
        '..k....ko....k..',
        '..kok..kk..kok..',
        '...kk.kkkk.kk...',
        '.....kyyyyk.....',
        '....kyyyyyyk....',
        '.kkkkyyyyyyokkk.',
        '.kookyyyyyyokk..',
        '....kyyyyyok....',
        '.....kooook.....',
        '...kk.kkkk.kk...',
        '..kok..kk..kok..',
        '..k....ko....k..',
        '.......kk.......',
        '................',
    ]),
}


def png(width, height, rows):
    """A PNG of RGBA rows, written with zlib alone."""
    def chunk(kind, data):
        body = kind + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xFFFFFFFF)
    raw = b''.join(b'\x00' + bytes(value for pixel in row for value in pixel) for row in rows)
    header = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


def render(palette, grid):
    """The grid at SCALE, as RGBA rows."""
    clear = (0, 0, 0, 0)
    assert len(grid) == 16 and all(len(line) == 16 for line in grid), 'every icon is 16 x 16'
    rows = []
    for line in grid:
        row = []
        for letter in line:
            row.extend([clear if letter == '.' else palette[letter]] * SCALE)
        rows.extend([row] * SCALE)
    return rows


def main():
    os.makedirs(OUT, exist_ok=True)
    for kind, (palette, grid) in ICONS.items():
        size = 16 * SCALE
        with open(os.path.join(OUT, f'{kind}.png'), 'wb') as file:
            file.write(png(size, size, render(palette, grid)))
    print(f'wrote {len(ICONS)} icons to {os.path.normpath(OUT)}')


if __name__ == '__main__':
    main()
