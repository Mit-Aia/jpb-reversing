import struct, sys
sys.path.insert(0, r"C:\Users\Matheus\Documents\Jurassic park builder\Arquivo extra\scripts_re_sessao")
from content_sniffer import segment
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

def find_positions_start(data, table_end, search_limit=2000):
    """Dynamically find where real (non-zero, non-denormal) position float data
    begins after the 40-byte offset table -- do NOT assume a fixed B/C/D split,
    the zero-padding length after the table varies per file."""
    for off in range(table_end, table_end + search_limit, 4):
        vals = struct.unpack_from("<4f", data, off)
        if all(v == 0.0 for v in vals):
            continue
        if any(abs(v) > 1e-6 and abs(v) < 1e6 for v in vals):
            return off
    return None

def find_index_buffer_in_aprime(data, a_start, a_end):
    """Use the content sniffer restricted to a sub-range to find the largest 'index' segment.
    Note: for some files (e.g. parte_11) the index buffer is NOT inside the A' section at all --
    it can be in B'/C'/tail. If this returns None, scan those other sections too."""
    segs = segment(data, a_start, a_end)
    idx_segs = [s for s in segs if s[2] == "index"]
    if not idx_segs:
        return None, None
    best = max(idx_segs, key=lambda s: s[1]-s[0])
    return best[0], best[1]

def process(path, table_end, a_start, a_end, label, ax_pos, ax_wire, idx_range=None):
    with open(path, "rb") as f:
        data = f.read()

    pos_start = find_positions_start(data, table_end)
    n = (a_start - pos_start) // 12
    vals = struct.unpack_from(f"<{n*3}f", data, pos_start)
    positions = [vals[i*3:i*3+3] for i in range(n)]

    if idx_range:
        idx_start, idx_end = idx_range
    else:
        idx_start, idx_end = find_index_buffer_in_aprime(data, a_start, a_end)
    indices = []
    if idx_start:
        n_idx = (idx_end - idx_start)//2
        indices = struct.unpack_from(f"<{n_idx}H", data, idx_start)

    print(f"=== {label} ===")
    print(f"  positions: {n} verts (bytes {pos_start}-{a_start})")
    if idx_start:
        in_range = sum(1 for i in indices if i < n)
        print(f"  index buffer: {idx_start}-{idx_end} ({len(indices)} u16, max={max(indices)}), {in_range}/{len(indices)} in range ({100*in_range/len(indices):.1f}%)")
    else:
        print("  index buffer: NOT FOUND")
    print()

    xs = [p[0] for p in positions]; ys = [p[1] for p in positions]; zs = [p[2] for p in positions]
    ax_pos.scatter(xs, ys, s=8, c=zs, cmap='viridis')
    ax_pos.set_title(f"{label}: positions (n={n})")
    ax_pos.set_aspect('equal')

    ax_wire.scatter(xs, ys, s=4, c='lightgray')
    if idx_start:
        for i in range(len(indices)-1):
            a, b = indices[i], indices[i+1]
            if a < n and b < n:
                pa, pb = positions[a], positions[b]
                ax_wire.plot([pa[0], pb[0]], [pa[1], pb[1]], 'b-', linewidth=0.3, alpha=0.6)
    ax_wire.set_title(f"{label}: wireframe")
    ax_wire.set_aspect('equal')

if __name__ == "__main__":
    fig, axes = plt.subplots(2, 3, figsize=(18, 12))

    # table_end is always 4240 (table starts at 4200, is 40 bytes) for every part checked so far.
    # a_start/a_end come from that file's own 10-value offset table (see project memory).
    process(
        r"C:\Users\Matheus\Documents\Jurassic park builder\Arquivo extra\malha_brachio\parte_1_8d0569d4.bin",
        4240, 8272, 12240, "parte_1", axes[0][0], axes[1][0]
    )
    process(
        r"C:\Users\Matheus\Documents\Jurassic park builder\Arquivo extra\malha_brachio\parte_2_b0654064.bin",
        4240, 12252, 18464, "parte_2", axes[0][1], axes[1][1]
    )
    process(
        r"C:\Users\Matheus\Documents\Jurassic park builder\Arquivo extra\malha_brachio\parte_11_cfb207a2.bin",
        4240, 16988, 24856, "parte_11", axes[0][2], axes[1][2], idx_range=(29084, 33040)
    )

    plt.tight_layout()
    outpath = "mesh_preview_v3.png"
    plt.savefig(outpath, dpi=120)
    print(f"saved to {outpath}")
