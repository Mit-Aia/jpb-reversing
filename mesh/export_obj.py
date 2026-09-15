"""
Export validated brachio mesh parts (positions + triangle-strip index buffer)
to a single combined Wavefront .obj, one object per part.

Reuses the already-validated pipeline from render_mesh_v3.py / render_parts_469.py:
- table_end is always 4240 (40-byte offset table at absolute bytes 4200-4240).
- find_positions_start() dynamically locates the start of the clean, no-header,
  12-byte-stride (x,y,z) float array right after the table's zero-padding.
- The triangle-strip index buffer (u16) is located either by known byte ranges
  (already hand-verified this session) or by content_sniffer.segment() scanning
  the A'/B'/C'/tail sections for the largest "index"-labeled run.

Skin weights are NOT included (still unlocated per project memory) -- this is
static bind-pose geometry only.
"""
import struct, sys, os

sys.path.insert(0, os.path.dirname(__file__))
from content_sniffer import segment

MESH_DIR = r"C:\Users\Matheus\Documents\Jurassic park builder\Arquivo extra\malha_brachio"
OUT_PATH = r"C:\Users\Matheus\Documents\Jurassic park builder\Arquivo extra\scripts_re_sessao\brachio_combined.obj"


def find_positions_start(data, table_end=4240, search_limit=2000):
    for off in range(table_end, table_end + search_limit, 4):
        vals = struct.unpack_from("<4f", data, off)
        if all(v == 0.0 for v in vals):
            continue
        if any(abs(v) > 1e-6 and abs(v) < 1e6 for v in vals):
            return off
    return None


def find_index_buffer(data, search_start, search_end):
    """Scan a byte range with the content sniffer and return the largest 'index' run."""
    segs = segment(data, search_start, search_end)
    idx_segs = [s for s in segs if s[2] in ("index", "index_loose")]
    if not idx_segs:
        return None, None
    best = max(idx_segs, key=lambda s: s[1] - s[0])
    return best[0], best[1]


# Per-part config: (filename, pos_end, idx_range or None).
# pos_end = start of the section right after the position array (the 'A'' boundary).
# idx_range = (start,end) in bytes if already hand-verified; None = auto-detect via
# content_sniffer over [pos_end, file_end).
PARTS = {
    "parte_1":  ("parte_1_8d0569d4.bin",  8272,  (8416, 10304)),
    "parte_2":  ("parte_2_b0654064.bin",  12252, (12252, 13428)),
    "parte_4":  ("parte_4_50f02d9b.bin",  10924, (10968, 14168)),
    "parte_6":  ("parte_6_6d90042b.bin",  11460, (11504, 14960)),
    "parte_9":  ("parte_9_f2d22e12.bin",  10252, (10296, 13124)),
    "parte_11": ("parte_11_cfb207a2.bin", 16988, (29084, 33040)),
}


def decode_triangle_strip(indices, n_verts):
    """Standard triangle-strip decoding: consecutive triples, alternating winding,
    skip degenerate (repeated-index) and out-of-range triangles."""
    faces = []
    for i in range(len(indices) - 2):
        a, b, c = indices[i], indices[i + 1], indices[i + 2]
        if a == b or b == c or a == c:
            continue
        if a >= n_verts or b >= n_verts or c >= n_verts:
            continue
        if i % 2 == 0:
            faces.append((a, b, c))
        else:
            faces.append((a, c, b))
    return faces


def process_part(name, filename, pos_end, idx_range):
    path = os.path.join(MESH_DIR, filename)
    with open(path, "rb") as f:
        data = f.read()

    pos_start = find_positions_start(data)
    n = (pos_end - pos_start) // 12
    vals = struct.unpack_from(f"<{n*3}f", data, pos_start)
    positions = [vals[i*3:i*3+3] for i in range(n)]

    if idx_range and idx_range[0] is not None:
        idx_start, idx_end = idx_range
    else:
        idx_start, idx_end = find_index_buffer(data, pos_end, len(data))

    if idx_start is None:
        print(f"  {name}: NO index buffer found, skipping faces")
        indices = []
    else:
        n_idx = (idx_end - idx_start) // 2
        indices = list(struct.unpack_from(f"<{n_idx}H", data, idx_start))

    faces = decode_triangle_strip(indices, n)
    in_range = sum(1 for i in indices if i < n) if indices else 0
    pct = (100 * in_range / len(indices)) if indices else 0
    print(f"  {name}: {n} verts (bytes {pos_start}-{pos_end}), "
          f"idx {idx_start}-{idx_end} ({len(indices)} u16, {pct:.1f}% in range), "
          f"{len(faces)} triangles")

    return positions, faces


def main():
    print("Exporting brachio parts to combined OBJ...")
    vertex_offset = 0
    obj_lines = ["# Jurassic Park Builder - brachio mesh, static bind-pose geometry",
                 "# Reconstructed via RE of sudino_brachio .dab mesh chunks",
                 "# NOTE: no skin weights included (unlocated) -- bind pose only\n"]

    for name, (filename, pos_end, idx_range) in PARTS.items():
        positions, faces = process_part(name, filename, pos_end, idx_range)

        obj_lines.append(f"o {name}")
        for x, y, z in positions:
            obj_lines.append(f"v {x:.6f} {y:.6f} {z:.6f}")
        for a, b, c in faces:
            # OBJ face indices are 1-based and global across the whole file
            obj_lines.append(f"f {a+1+vertex_offset} {b+1+vertex_offset} {c+1+vertex_offset}")
        obj_lines.append("")

        vertex_offset += len(positions)

    with open(OUT_PATH, "w") as f:
        f.write("\n".join(obj_lines))

    print(f"\nSaved: {OUT_PATH} ({vertex_offset} total vertices)")


if __name__ == "__main__":
    main()
