import struct, sys
sys.path.insert(0, r"C:\Users\Matheus\Documents\Jurassic park builder\Arquivo extra\scripts_re_sessao")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

def find_positions_start(data, table_end=4240, search_limit=2000):
    """table_end is always 4240 (table sits at absolute byte 4200-4240) -- confirmed
    across all 6 usable brachio parts (1,2,4,6,9,11). Dynamically find where real
    position data begins after that (zero-padding length varies per part)."""
    for off in range(table_end, table_end + search_limit, 4):
        vals = struct.unpack_from("<4f", data, off)
        if all(v == 0.0 for v in vals):
            continue
        if any(abs(v) > 1e-6 and abs(v) < 1e6 for v in vals):
            return off
    return None

def process(path, pos_end, idx_range, label, ax_pos, ax_wire, table_end=4240):
    with open(path, "rb") as f:
        data = f.read()

    pos_start = find_positions_start(data, table_end)
    n = (pos_end - pos_start) // 12
    vals = struct.unpack_from(f"<{n*3}f", data, pos_start)
    positions = [vals[i*3:i*3+3] for i in range(n)]

    idx_start, idx_end = idx_range
    n_idx = (idx_end - idx_start)//2
    indices = struct.unpack_from(f"<{n_idx}H", data, idx_start)

    in_range = sum(1 for i in indices if i < n)
    print(f"=== {label} ===")
    print(f"  positions: {n} verts (bytes {pos_start}-{pos_end})")
    print(f"  index buffer: {idx_start}-{idx_end} ({len(indices)} u16, max={max(indices)}), {in_range}/{len(indices)} in range ({100*in_range/len(indices):.1f}%)")
    print()

    xs = [p[0] for p in positions]; ys = [p[1] for p in positions]; zs = [p[2] for p in positions]
    ax_pos.scatter(xs, ys, s=8, c=zs, cmap='viridis')
    ax_pos.set_title(f"{label}: positions (n={n})")
    ax_pos.set_aspect('equal')

    ax_wire.scatter(xs, ys, s=4, c='lightgray')
    for i in range(len(indices)-1):
        a, b = indices[i], indices[i+1]
        if a < n and b < n:
            pa, pb = positions[a], positions[b]
            ax_wire.plot([pa[0], pb[0]], [pa[1], pb[1]], 'b-', linewidth=0.3, alpha=0.6)
    ax_wire.set_title(f"{label}: wireframe")
    ax_wire.set_aspect('equal')

if __name__ == "__main__":
    # pos_end and idx_range come from running content_sniffer.segment() on the full
    # file first (see debug scripts from this session) -- the 'position' segment's
    # end is pos_end, and the first big 'index' segment after it is idx_range.
    fig, axes = plt.subplots(2, 3, figsize=(18, 12))
    process(
        r"C:\Users\Matheus\Documents\Jurassic park builder\Arquivo extra\malha_brachio\parte_4_50f02d9b.bin",
        10924, (10968, 14168), "parte_4", axes[0][0], axes[1][0]
    )
    process(
        r"C:\Users\Matheus\Documents\Jurassic park builder\Arquivo extra\malha_brachio\parte_6_6d90042b.bin",
        11460, (11504, 14960), "parte_6", axes[0][1], axes[1][1]
    )
    process(
        r"C:\Users\Matheus\Documents\Jurassic park builder\Arquivo extra\malha_brachio\parte_9_f2d22e12.bin",
        10252, (10296, 13124), "parte_9", axes[0][2], axes[1][2]
    )
    plt.tight_layout()
    outpath = "mesh_preview_469.png"
    plt.savefig(outpath, dpi=120)
    print(f"saved to {outpath}")
