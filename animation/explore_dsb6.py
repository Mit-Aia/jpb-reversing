import struct
from collections import defaultdict, Counter

path = r"C:\Users\Matheus\Documents\Jurassic park builder\DinoServer-Windows-v1.0.18-FullCache\DinoServer\cache_android\sudino_brachio.dsb"
data = open(path, "rb").read()

REC_START = 4120
REC_SIZE = 56
N_RECS = 145

def half(off):
    return struct.unpack_from("<e", data, off)[0]

def u32(off):
    return struct.unpack_from("<I", data, off)[0]

groups = defaultdict(list)
for i in range(N_RECS):
    off = REC_START + i * REC_SIZE
    idA = u32(off + 4)
    groups[idA].append(i)

sizes = Counter(len(v) for v in groups.values())
print("group-size histogram (non-contiguous, by idA value):", sizes)
print("num groups:", len(groups))

# show the groups with the most occurrences fully decoded
by_size = sorted(groups.items(), key=lambda kv: -len(kv[1]))
for idA, idxs in by_size[:5]:
    print(f"\n=== idA=0x{idA:08x}  occurs at records {idxs} ===")
    for i in idxs:
        off = REC_START + i * REC_SIZE
        halfs = [round(half(off + s*2), 4) for s in range(28)]
        td = u32(off+24)
        te = u32(off+52)
        print(f"  rec{i} (timeD={td},timeE={te}): {halfs}")
