"""Dev helper: crop a native PNG region and upscale it for close inspection.
python3 crop.py in.png x0 y0 x1 y1 scale out.png"""
import sys, zlib, struct
sys.path.insert(0, __import__('os').path.dirname(__file__))
from engine import save, scale


def load(path):
    d = open(path, 'rb').read()
    i = 8; idat = b''
    while i < len(d):
        n = struct.unpack('>I', d[i:i + 4])[0]; t = d[i + 4:i + 8]; c = d[i + 8:i + 8 + n]
        if t == b'IHDR':
            w, h, _, ct = struct.unpack('>IIBB', c[:10])
        elif t == b'IDAT':
            idat += c
        i += 12 + n
    bpp = 4 if ct == 6 else 3
    raw = zlib.decompress(idat); rows = []; prev = bytearray(w * bpp); p = 0
    for y in range(h):
        f = raw[p]; line = bytearray(raw[p + 1:p + 1 + w * bpp]); p += 1 + w * bpp
        for x in range(len(line)):
            a = line[x - bpp] if x >= bpp else 0; b = prev[x]; c = prev[x - bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        rows.append([tuple(line[x * bpp:x * bpp + 3]) if bpp == 3 or line[x * bpp + 3] else (40, 40, 48) for x in range(w)])
        prev = line
    return rows


if __name__ == '__main__':
    a = sys.argv
    px = load(a[1]); x0, y0, x1, y1, s = map(int, a[2:7])
    save(scale([r[x0:x1] for r in px[y0:y1]], s), a[7])
