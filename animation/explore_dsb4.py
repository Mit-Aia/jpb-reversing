import struct

path = r"C:\Users\Matheus\Documents\Jurassic park builder\DinoServer-Windows-v1.0.18-FullCache\DinoServer\cache_android\sudino_brachio.dsb"
data = open(path, "rb").read()

REC_START = 4120
REC_SIZE = 56
N_RECS = 145
N_HALVES = REC_SIZE // 2  # 28

# for each of the 28 u16-slot positions within a record, decode across all records
# both as u16 int and as half-float, report stats
import math

def is_reasonable_half(h):
    if math.isnan(h) or math.isinf(h):
        return False
    return abs(h) < 2000

for slot in range(N_HALVES):
    u16s = []
    halfs = []
    for i in range(N_RECS):
        off = REC_START + i * REC_SIZE + slot * 2
        u16 = struct.unpack_from("<H", data, off)[0]
        h = struct.unpack_from("<e", data, off)[0]
        u16s.append(u16)
        halfs.append(h)
    n_reasonable = sum(1 for h in halfs if is_reasonable_half(h))
    n_nan_inf = sum(1 for h in halfs if math.isnan(h) or math.isinf(h))
    print(f"slot {slot:2d} (byteoff {slot*2:2d}): u16 min={min(u16s):6d} max={max(u16s):6d} uniq={len(set(u16s)):3d} | half reasonable={n_reasonable}/{N_RECS} nan/inf={n_nan_inf}")
