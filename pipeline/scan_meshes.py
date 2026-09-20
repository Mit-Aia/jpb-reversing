"""Offline scan of a .dab for skinned-mesh chunks (no game needed).
usage: python scan_meshes.py <file.dab> [...]
A chunk is accepted when its self-relative section table points inside the file, the per-group vertex counts sum to w[4],
every skin vertex has weights summing to 1 and the remap indices are valid (same checks the live-capture builder asserts)."""
import sys, numpy as np

def scan(path):
    d = open(path, "rb").read(); n = len(d); out = []
    u32 = np.frombuffer(d[: n // 4 * 4], "<u4")
    for i in range(0, n // 4 - 40):
        nb, nr, nsk, npair = int(u32[i]), int(u32[i + 1]), int(u32[i + 3]), int(u32[i + 4])
        if not (2 <= nb <= 120 and 4 <= nsk <= 4000 and nsk <= nr <= 3 * nsk + 64 and nsk <= npair <= 4 * nsk): continue
        base = i * 4
        try:
            o = [base + 4 * k + int(u32[i + k]) + a for k, a in ((26, 0x68 - 26 * 4 + 26 * 4 - 26 * 4 + 26 * 4 - 0), (27, 0), (28, 0), (29, 0), (30, 0), (31, 0))]
        except Exception: continue
        # self-relative: address of field = base + 4*k ; value + address-of-field + constant (0x68.. are the fixed offsets from notes)
        f = lambda k, c: base + int(u32[i + k]) + c
        p_ids, p_cnt, p_pos, p_rem, p_lst, p_w = f(26, 0x68), f(27, 0x6c), f(28, 0x70), f(29, 0x74), f(30, 0x78), f(31, 0x7c)
        if not all(0 <= p < n for p in (p_ids, p_cnt, p_pos, p_rem, p_lst, p_w)): continue
        if p_w + 4 * npair > n or p_lst + 2 * npair > n or p_rem + 2 * nr > n or p_pos + 12 * nsk > n or p_cnt + 2 * nb > n: continue
        cnt = np.frombuffer(d, "<u2", nb, p_cnt)
        if int(cnt.sum()) != npair: continue
        lst = np.frombuffer(d, "<u2", npair, p_lst).astype(int)
        if lst.max() >= nsk: continue
        w = np.frombuffer(d, "<f4", npair, p_w)
        ws = np.zeros(nsk); np.add.at(ws, lst, w)
        if np.abs(ws - 1).max() > 1e-3: continue
        rem = np.frombuffer(d, "<u2", nr, p_rem)
        if rem.max() >= nsk: continue
        out.append(dict(off=base, groups=nb, render=nr, skin=nsk, pairs=npair, ids=np.frombuffer(d, "<u2", nb, p_ids).tolist()))
    return out

if __name__ == "__main__":
    for p in sys.argv[1:]:
        r = scan(p); print(p, "->", len(r), "mesh chunk(s)")
        for c in r: print("  @%d groups=%d render=%d skin=%d pairs=%d" % (c["off"], c["groups"], c["render"], c["skin"], c["pairs"]))
