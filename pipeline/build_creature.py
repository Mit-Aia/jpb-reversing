"""Build a rigged, animated creature dataset from a live capture + the game's cache files.

  python build_creature.py <name> <capture_dir> <cache_dir> <idx_count> [out_dir]      (default: <repo>/export/<name>/)

capture_dir must contain res_creature.bin (64KB dump of the mesh resource) and anim_creature.bin
(sampler output: per frame u32 t, nSkin*12 pos, nSkin*12 normals, nb*64 Static, nb*64 Palette).
idx_count comes from the game's draw descriptor (word[5]). Layout knowledge: see memory 'mesh format' UPDATE block.
"""
import sys, os, json, struct, glob
import numpy as np

name, capdir, cache, idx_count = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
outdir = sys.argv[5] if len(sys.argv) > 5 else os.path.join(capdir, "..", "..", "export", name)   # one folder per creature
os.makedirs(outdir, exist_ok=True)

res = open(os.path.join(capdir, "res_creature.bin"), "rb").read()
W = lambda i: struct.unpack_from("<I", res, i * 4)[0]
nb, nRender, nSkin, nPairs = W(0), W(1), W(3), W(4)
print(f"resource: {nb} bone groups, {nRender} render verts, {nSkin} skin verts, {nPairs} influence pairs")
fld = lambda i, extra: i * 4 + W(i) + extra           # self-relative field -> byte offset in resource
ids = np.frombuffer(res, "<u2", nb, fld(26, 0) - 26 * 4 + 26 * 4 + 0 if False else W(26) + 0x68).astype(int)
cnt = np.frombuffer(res, "<u2", nb, W(27) + 0x6c).astype(int)
posOff = W(28) + 0x70
rest = np.frombuffer(res, "<f4", nSkin * 3, posOff).reshape(nSkin, 3)
remap = np.frombuffer(res, "<u2", nRender, W(29) + 0x74).astype(int)
lists = np.frombuffer(res, "<u2", nPairs, W(30) + 0x78).astype(int)
wts = np.frombuffer(res, "<f4", nPairs, W(31) + 0x7c)
assert cnt.sum() == nPairs, f"group counts sum {cnt.sum()} != {nPairs}"
assert remap.max() < nSkin and lists.max() < nSkin
wsum = np.zeros(nSkin); p = 0
for g in range(nb):
    for _ in range(cnt[g]): wsum[lists[p]] += wts[p]; p += 1
print(f"weights: per-vertex sum min {wsum.min():.4f} max {wsum.max():.4f} (must be 1)")
assert abs(wsum - 1).max() < 1e-3, "weights do not sum to 1 -> offsets wrong"

# ---- animation samples
raw = open(os.path.join(capdir, "anim_creature.bin"), "rb").read()
stride = 4 + nSkin * 24 + nb * 128; nf = len(raw) // stride
P = np.zeros((nf, nSkin, 3), "f4"); Bs = np.zeros((nf, nb, 4, 4), "f4"); Bp = np.zeros_like(Bs)
for k in range(nf):
    o = k * stride + 4
    P[k] = np.frombuffer(raw, "<f4", nSkin * 3, o).reshape(nSkin, 3); o += nSkin * 24
    Bs[k] = np.frombuffer(raw, "<f4", nb * 16, o).reshape(nb, 4, 4); o += nb * 64
    Bp[k] = np.frombuffer(raw, "<f4", nb * 16, o).reshape(nb, 4, 4)
print(f"{nf} frames; palette varies {np.abs(Bp - Bp[0]).max():.3f}, static varies {np.abs(Bs - Bs[0]).max():.6f}")
apply = lambda q, M: q @ M[:3, :3] + M[3, :3]
def skin(k):
    out = np.zeros((nSkin, 3)); p = 0
    for g in range(nb):
        for _ in range(cnt[g]):
            v = lists[p]; out[v] += apply(apply(rest[v], Bs[k][g]), Bp[k][g]) * wts[p]; p += 1
    return out
errs = [np.abs(skin(k) - P[k]).max() for k in (0, nf // 3, 2 * nf // 3, nf - 1)]
print("skinning reproduction max error over 4 frames:", np.round(errs, 5))
assert max(errs) < 1e-2, "skin formula does not reproduce live vertices"

# ---- find the source .dab, mesh chunk, vertex buffer, triangles
V0 = rest[remap][:3].astype("<f4")
sig = rest[:4].astype("<f4").tobytes()                    # 4 consecutive skin verts = the contiguous position array
found = None
for path in sorted(glob.glob(os.path.join(cache, "*.dab"))):
    if os.path.getsize(path) > 300_000_000: continue
    d = open(path, "rb").read(); i = d.find(sig)
    while i >= 0:
        chunk = i - posOff
        if chunk >= 0 and d[chunk:chunk + 4] == res[:4] and d[chunk + 0x150 - 0x150 + 4:chunk + 8] == res[4:8]:
            found = (path, d, chunk); break
        i = d.find(sig, i + 1)
    if found: break
assert found, "no cache .dab contains this mesh chunk"
path, dab, chunk = found
print("source:", os.path.basename(path), "mesh chunk at", chunk)
# interleaved vertex buffer: render verts 0..2 at stride 36
vb = None; i = dab.find(V0[0].tobytes())
while i >= 0:
    if dab[i + 36:i + 48] == V0[1].tobytes() and dab[i + 72:i + 84] == V0[2].tobytes(): vb = i; break
    i = dab.find(V0[0].tobytes(), i + 1)
assert vb is not None, "vertex buffer not found"
A = np.frombuffer(dab, "<u4", nRender * 9, vb).reshape(nRender, 9)
F = A.view("<f4"); assert np.allclose(F[:, :3], rest[remap], atol=1e-4), "vertex buffer positions do not match remap"
print("vertex buffer at", vb, "colour word", hex(A[0, 6]), "UV range", F[:, 7:9].min(0).round(3), F[:, 7:9].max(0).round(3))
Vr = rest[remap]
best = None
for off in range(chunk - 2 * idx_count - 96, chunk - 2 * idx_count + 96, 2):
    if off < 0: continue
    a = np.frombuffer(dab, "<u2", idx_count, off).astype(int)
    if a.max() >= nRender: continue
    t = a.reshape(-1, 3); deg = int((np.array([len(set(x)) for x in t]) < 3).sum())
    e = np.concatenate([np.linalg.norm(Vr[t[:, i]] - Vr[t[:, (i + 1) % 3]], axis=1) for i in range(3)])
    key = (deg, len(set(a.tolist())) != nRender, e.mean())
    if best is None or key < best[0]: best = (key, off, t)
(deg, notall, em), tri_off, tri = best
print(f"triangles at {tri_off}: {len(tri)} tris, degenerate {deg}, all verts used {not notall}, mean edge {em:.2f}")
assert deg == 0, "triangle array not cleanly aligned"

infl = [[] for _ in range(nSkin)]; p = 0
for g in range(nb):
    for _ in range(cnt[g]): infl[lists[p]].append((int(g), float(wts[p]))); p += 1
uv_game = F[:, 7:9].astype(float)
data = {"name": name, "boneIds": ids.tolist(), "rest": Vr.round(6).tolist(), "tris": tri.tolist(),
        "skinVertexOfRenderVertex": remap.tolist(), "influences": [infl[r] for r in remap.tolist()],
        "invBind_rowmajor": Bs[0].reshape(nb, 16).round(7).tolist(),
        "palette_rowmajor": Bp.reshape(nf, nb, 16).round(6).tolist(),
        "uv_game": uv_game.round(6).tolist(), "uv": [[u, 1 - v] for u, v in uv_game.round(6).tolist()],
        "normals": F[:, 3:6].astype(float).round(5).tolist(), "fps": 30.0,
        "source": {"dab": os.path.basename(path), "meshChunk": int(chunk), "vertexBuffer": int(vb), "triangles": int(tri_off)}}
json.dump(data, open(os.path.join(outdir, f"{name}_rig.json"), "w"))
with open(os.path.join(outdir, f"{name}_rest.obj"), "w") as f:
    f.write(f"# {name} reconstructed from live game memory\n")
    for v in Vr: f.write("v %.5f %.5f %.5f\n" % tuple(v))
    for u in uv_game: f.write("vt %.6f %.6f\n" % (u[0], 1 - u[1]))
    for n in F[:, 3:6]: f.write("vn %.5f %.5f %.5f\n" % tuple(n))
    for t in tri + 1: f.write("f " + " ".join(f"{i}/{i}/{i}" for i in t) + "\n")
print("wrote", os.path.join(outdir, f"{name}_rig.json"), "and OBJ")
