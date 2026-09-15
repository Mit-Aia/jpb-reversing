import struct, math

path = r"C:\Users\Matheus\Documents\Jurassic park builder\DinoServer-Windows-v1.0.18-FullCache\DinoServer\cache_android\sudino_brachio.dsb"
data = open(path, "rb").read()

REC_START = 4120
REC_SIZE = 56
N_RECS = 145

def half(off):
    return struct.unpack_from("<e", data, off)[0]

def u16(off):
    return struct.unpack_from("<H", data, off)[0]

def u32(off):
    return struct.unpack_from("<I", data, off)[0]

records = []
for i in range(N_RECS):
    off = REC_START + i * REC_SIZE
    records.append(dict(off=off, idA=u32(off+4)))

# group by idA (track id), in original file order (should be contiguous per track)
groups = []
cur_id = None
cur_start = None
for i, r in enumerate(records):
    if r['idA'] != cur_id:
        if cur_id is not None:
            groups.append((cur_id, cur_start, i))
        cur_id = r['idA']
        cur_start = i
groups.append((cur_id, cur_start, N_RECS))

print(f"total contiguous groups (by idA run): {len(groups)}")
sizes = [g[2]-g[1] for g in groups]
from collections import Counter
print("group size distribution:", Counter(sizes))

# print full decode for the first few groups with size >= 3
shown = 0
for gid, gstart, gend in groups:
    if gend - gstart < 3:
        continue
    shown += 1
    if shown > 6:
        break
    print(f"\n=== group idA=0x{gid:08x} records[{gstart}:{gend}] (n={gend-gstart}) ===")
    for i in range(gstart, gend):
        off = REC_START + i * REC_SIZE
        # decode all 28 half-float slots
        halfs = [round(half(off + s*2), 4) for s in range(28)]
        print(f"  rec{i}: {halfs}")
