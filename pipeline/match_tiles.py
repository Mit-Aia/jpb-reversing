"""Offline choice of the texture tile of a mesh: rasterise the mesh's UV triangles and compare with the non-black area of every tile of the
atlas (IoU). Tile rectangles come from the package's .dsb tile table (96-byte records with floats tx,ty,sx,sy at word 20..23).
usage (library): from match_tiles import load_atlases, tile_rects, best_tiles"""
import struct, numpy as np
from PIL import Image, ImageDraw

SIZES = (0.015625, 0.03125, 0.046875, 0.0625, 0.09375, 0.125, 0.25)

def tile_rects(dsb):
    out = set(); f = np.frombuffer(dsb[: len(dsb) // 4 * 4], "<f4")
    for i in range(0, len(f) - 24):
        tx, ty, sx, sy = float(f[i]), float(f[i + 1]), float(f[i + 2]), float(f[i + 3])
        if sx == sy and any(abs(sx - s) < 1e-6 for s in SIZES) and 0 <= tx < 1 and 0 <= ty < 1 and tx + sx <= 1.001 and ty + sy <= 1.001: out.add((round(tx, 5), round(ty, 5), sx))
    return sorted(out)

def load_atlases(dab_bytes, blocks):                       # blocks: [(name, block_start, W)]
    return {n: np.frombuffer(dab_bytes, np.uint8, W * W * 4, o + 4163).reshape(W, W, 4) for n, o, W in blocks}

def uv_mask(uv, tris, res=128):
    im = Image.new("L", (res, res), 0); dr = ImageDraw.Draw(im); uv = np.asarray(uv)
    for t in tris:
        dr.polygon([(uv[i][0] * (res - 1), uv[i][1] * (res - 1)) for i in t], fill=255)
    return np.array(im) > 0

def tile_mask(a, x, y, s, res=128):
    t = a[y:y + s, x:x + s, :3].max(2)
    if s != res: t = np.array(Image.fromarray(t).resize((res, res), Image.BOX))
    return t > 24

def best_tiles(uv, tris, atlases, rects, top=5):
    um = uv_mask(uv, tris); res = []
    for name, a in atlases.items():
        W = a.shape[0]
        for tx, ty, sx in rects:
            s = int(round(sx * W)); x, y = int(round(tx * W)), int(round(ty * W))
            if s < 16 or x + s > W or y + s > W: continue
            tm = tile_mask(a, x, y, s); inter = (um & tm).sum(); union = (um | tm).sum()
            res.append((inter / max(union, 1), name, x, y, s))
    res.sort(reverse=True); return res[:top]
