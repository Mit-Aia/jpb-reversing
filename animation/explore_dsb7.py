import struct
from collections import defaultdict

path = r"C:\Users\Matheus\Documents\Jurassic park builder\DinoServer-Windows-v1.0.18-FullCache\DinoServer\cache_android\sudino_brachio.dsb"
data = open(path, "rb").read()

REC_START = 4120
REC_SIZE = 56
N_RECS = 145

def half(off):
    return struct.unpack_from("<e", data, off)[0]
def u16(off):
    return struct.unpack_from("<H", data, off)[0]
def i16(off):
    return struct.unpack_from("<h", data, off)[0]
def u32(off):
    return struct.unpack_from("<I", data, off)[0]
def f32(off):
    return struct.unpack_from("<f", data, off)[0]

groups = defaultdict(list)
for i in range(N_RECS):
    off = REC_START + i * REC_SIZE
    idA = u32(off + 4)
    groups[idA].append(i)

# For each slot (0..27), determine if it's CONSTANT within every group (that has >=2 members)
multi_groups = {k: v for k, v in groups.items() if len(v) >= 2}
print("groups with >=2 members:", len(multi_groups))

varying_slots = set()
for idA, idxs in multi_groups.items():
    vals_per_slot = [[] for _ in range(28)]
    for i in idxs:
        off = REC_START + i * REC_SIZE
        for s in range(28):
            vals_per_slot[s].append(u16(off + s*2))
    for s in range(28):
        if len(set(vals_per_slot[s])) > 1:
            varying_slots.add(s)

print("slots that vary within at least one group:", sorted(varying_slots))

# Now dump raw u16 AND i16 AND half for the varying slots, for several groups
shown = 0
for idA, idxs in sorted(multi_groups.items(), key=lambda kv: -len(kv[1])):
    if len(idxs) < 4:
        continue
    shown += 1
    if shown > 4:
        break
    print(f"\n=== idA=0x{idA:08x}  n={len(idxs)} ===")
    for i in idxs:
        off = REC_START + i * REC_SIZE
        row = []
        for s in sorted(varying_slots):
            row.append((s, u16(off+s*2), i16(off+s*2), round(half(off+s*2), 5)))
        print(f"  rec{i}: {row}")

# Also check the 4-byte-aligned interpretation: slot10+11 as one f32, and slot24+25 as one f32
print("\n=== as f32 (slot10/11 combined, slot24/25 combined) ===")
shown = 0
for idA, idxs in sorted(multi_groups.items(), key=lambda kv: -len(kv[1])):
    if len(idxs) < 4:
        continue
    shown += 1
    if shown > 4:
        break
    print(f"idA=0x{idA:08x}:")
    for i in idxs:
        off = REC_START + i * REC_SIZE
        v1 = f32(off + 20)
        v2 = f32(off + 48)
        print(f"  rec{i}: f32@20={v1:.6f}  f32@48={v2:.6f}")
