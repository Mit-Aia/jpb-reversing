import struct
from collections import defaultdict

path = r"C:\Users\Matheus\Documents\Jurassic park builder\Arquivo extra\sudino_brachio.dhr"
with open(path, "rb") as f:
    hdr = f.read()

print(f"total {len(hdr)} bytes")

start = 0xA8
record_size = 24
offset = start
marker_groups = defaultdict(list)
while offset + record_size <= len(hdr):
    marker, rid, rtype, flag, off_, size_ = struct.unpack("<4sIIIII", hdr[offset:offset+record_size])
    marker_groups[marker.hex()].append((offset, rid, rtype, flag, off_, size_))
    offset += record_size

print(f"\ntotal records parsed: {sum(len(v) for v in marker_groups.values())}")
for marker, records in marker_groups.items():
    total_size = sum(r[5] for r in records)
    print(f"\nmarker {marker}: {len(records)} records, total_size={total_size}")
    for off, rid, rtype, flag, doff, dsize in records[:5]:
        print(f"   hdr_off=0x{off:x} id={rid:10d} type={rtype:6d} flag={flag:6d} data_off={doff:8d} data_size={dsize:8d}")
    if len(records) > 5:
        print(f"   ... and {len(records)-5} more")
