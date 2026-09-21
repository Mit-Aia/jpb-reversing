"""Offline geometry extraction of every skinned mesh in a .dab (no game, no tablet).

usage: python extract_static.py <file.dab> [out_dir]           -> writes <out_dir>/<pkg>_<chunkoffset>.json (+ .obj)
       python extract_static.py --validate <rig.json> <cache_dir> -> compares against a live-captured rig (source.meshChunk)

What comes out of the file alone: rest positions, render->skin remap, per-vertex bone influences (group index + weight), bone ids,
interleaved vertex buffer (normal, UV) and the triangle list. What does NOT: the bone inverse-bind (Static) matrices, animation, texture tile.
Triangle array: a u16 run that ends 0..16 bytes before the mesh chunk; the exact end/length is found by scoring candidates
(indices < render count, every render vertex used, no degenerate face, short edges) -- the game's own draw count is not in the file.
"""
import sys, os, json, glob
import numpy as np


def parse_chunk(d, off, u32=None):
    w = lambda k: int.from_bytes(d[off + 4 * k: off + 4 * k + 4], "little")
    nb, nr, nsk, npair = w(0), w(1), w(3), w(4)
    p = lambda k, c: off + w(k) + c
    ids = np.frombuffer(d, "<u2", nb, p(26, 0x68)).astype(int)
    cnt = np.frombuffer(d, "<u2", nb, p(27, 0x6c)).astype(int)
    rest = np.frombuffer(d, "<f4", nsk * 3, p(28, 0x70)).reshape(nsk, 3).astype(float)
    remap = np.frombuffer(d, "<u2", nr, p(29, 0x74)).astype(int)
    lst = np.frombuffer(d, "<u2", npair, p(30, 0x78)).astype(int)
    wts = np.frombuffer(d, "<f4", npair, p(31, 0x7c)).astype(float)
    return dict(nb=nb, nr=nr, nsk=nsk, npair=npair, ids=ids, cnt=cnt, rest=rest, remap=remap, lst=lst, wts=wts)


def valid_chunk(d, off):
    try:
        m = parse_chunk(d, off)
        if not (2 <= m["nb"] <= 120 and 4 <= m["nsk"] <= 6000 and m["nsk"] <= m["nr"] <= 3 * m["nsk"] + 64 and m["nsk"] <= m["npair"] <= 4 * m["nsk"]): return None
        if int(m["cnt"].sum()) != m["npair"] or m["lst"].max() >= m["nsk"] or m["remap"].max() >= m["nsk"]: return None
        ws = np.zeros(m["nsk"]); np.add.at(ws, m["lst"], m["wts"])
        return m if np.abs(ws - 1).max() < 1e-3 else None
    except Exception:
        return None


def find_chunks(d):
    u = np.frombuffer(d[: len(d) // 4 * 4], "<u4"); out = []
    for i in range(0, len(u) - 40):
        nb, nr, nsk, npair = int(u[i]), int(u[i + 1]), int(u[i + 3]), int(u[i + 4])
        if not (2 <= nb <= 120 and 4 <= nsk <= 6000 and nsk <= nr <= 3 * nsk + 64 and nsk <= npair <= 4 * nsk): continue
        m = valid_chunk(d, i * 4)
        if m is not None: out.append(i * 4)
    return out


def find_vertex_buffer(d, m, chunk):
    Vr = m["rest"][m["remap"]]
    v0, v1, v2 = (Vr[i].astype("<f4").tobytes() for i in range(3)); cands = []
    i = d.find(v0)
    while i >= 0:
        if d[i + 36:i + 48] == v1 and d[i + 72:i + 84] == v2: cands.append(i)
        i = d.find(v0, i + 1)
    if not cands: return None
    below = [c for c in cands if c < chunk]
    return max(below) if below else cands[0]


def score_triangles(d, m, chunk, Vr):
    nr = m["nr"]; best = None
    for end in range(chunk - 16, chunk + 1, 2):
        n = 0
        while end - 2 * (n + 1) >= 0 and int.from_bytes(d[end - 2 * (n + 1):end - 2 * n], "little") < nr and n < 3 * 20000: n += 1
        n3 = n // 3 * 3
        if n3 < 30: continue
        # the walk can run into unrelated small u16 before the real start: cut at the first index where the faces become implausible
        a = np.frombuffer(d, "<u2", n3, end - 2 * n3).astype(int); t = a.reshape(-1, 3)
        e = np.linalg.norm(Vr[t] - Vr[np.roll(t, -1, axis=1)], axis=2).max(1)          # longest edge per face
        med = np.median(e)
        ok = e < 8 * med + 1e-6                                                          # degenerate faces exist in the game data: do NOT cut on them
        bad = np.where(~ok)[0]; s = (bad[-1] + 1) if len(bad) else 0                    # keep the longest suffix without absurdly long edges
        t = t[s:]
        if len(t) < 10: continue
        deg_mask = (t[:, 0] == t[:, 1]) | (t[:, 1] == t[:, 2]) | (t[:, 0] == t[:, 2]); deg = int(deg_mask.sum())
        if deg > max(3, len(t) // 100): continue
        t = t[~deg_mask]
        used = len(np.unique(t))
        key = (used != nr, abs(len(t) * 3 - n3) > 30, -len(t))
        if best is None or key < best[0]: best = (key, end, t.copy())
    return best


def extract(d, chunk):
    m = valid_chunk(d, chunk)
    if m is None: return None
    vb = find_vertex_buffer(d, m, chunk)
    if vb is None: return dict(chunk=chunk, error="vertex buffer not found", **{k: int(m[k]) for k in ("nb", "nr", "nsk")})
    A = np.frombuffer(d, "<u4", m["nr"] * 9, vb).reshape(m["nr"], 9); F = A.view("<f4")
    if not np.allclose(F[:, :3], m["rest"][m["remap"]], atol=1e-4): return dict(chunk=chunk, error="vertex buffer positions differ")
    sc = score_triangles(d, m, chunk, m["rest"][m["remap"]])
    if sc is None: return dict(chunk=chunk, error="no triangle run", vb=int(vb))
    key, end, tri = sc
    infl = [[] for _ in range(m["nsk"])]; p = 0
    for g in range(m["nb"]):
        for _ in range(int(m["cnt"][g])): infl[m["lst"][p]].append((g, float(m["wts"][p]))); p += 1
    return dict(chunk=chunk, vb=int(vb), tri_end=int(end), nb=m["nb"], nr=m["nr"], nsk=m["nsk"], boneIds=m["ids"].tolist(),
                rest=m["rest"][m["remap"]].round(5).tolist(), tris=tri.tolist(), uv_game=F[:, 7:9].astype(float).round(6).tolist(),
                normals=F[:, 3:6].astype(float).round(5).tolist(), influences=[infl[r] for r in m["remap"].tolist()],
                colour=hex(int(A[0, 6])), all_used=bool(len(np.unique(tri)) == m["nr"]))


def write_obj(path, r):
    with open(path, "w") as f:
        for v in r["rest"]: f.write("v %.5f %.5f %.5f\n" % tuple(v))
        for u in r["uv_game"]: f.write("vt %.6f %.6f\n" % (u[0], 1 - u[1]))
        for n in r["normals"]: f.write("vn %.5f %.5f %.5f\n" % tuple(n))
        for t in r["tris"]: f.write("f " + " ".join(f"{i + 1}/{i + 1}/{i + 1}" for i in t) + "\n")


if __name__ == "__main__":
    if sys.argv[1] == "--validate":
        rig = json.load(open(sys.argv[2])); cache = sys.argv[3]
        src = rig["source"]; d = open(os.path.join(cache, src["dab"]), "rb").read(); r = extract(d, src["meshChunk"])
        if r is None or "error" in r: print("FAIL", r and r.get("error")); sys.exit(1)
        t_live = sorted(tuple(sorted(x)) for x in rig["tris"]); t_off = sorted(tuple(sorted(x)) for x in r["tris"])
        print(os.path.basename(sys.argv[2]), "tris live", len(t_live), "offline", len(t_off), "SAME" if t_live == t_off else "DIFFERENT",
              "| uv equal", np.allclose(rig["uv_game"], r["uv_game"]), "| rest equal", np.allclose(rig["rest"], r["rest"], atol=1e-4))
    else:
        path = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else os.path.join("export_static", os.path.splitext(os.path.basename(path))[0])
        os.makedirs(out, exist_ok=True); d = open(path, "rb").read()
        for c in find_chunks(d):
            r = extract(d, c)
            if r is None: continue
            tag = f"{os.path.splitext(os.path.basename(path))[0]}_{c}"
            if "error" in r: print(tag, "ERROR", r["error"]); continue
            json.dump(r, open(os.path.join(out, tag + ".json"), "w")); write_obj(os.path.join(out, tag + ".obj"), r)
            print(f"{tag}: groups={r['nb']} render={r['nr']} skin={r['nsk']} tris={len(r['tris'])} all_used={r['all_used']}")
