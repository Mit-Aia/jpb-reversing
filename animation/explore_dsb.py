import struct, sys

path = r"C:\Users\Matheus\Documents\Jurassic park builder\DinoServer-Windows-v1.0.18-FullCache\DinoServer\cache_android\sudino_brachio.dsb"
data = open(path, "rb").read()
print("size", len(data))

# --- header ---
print("header bytes[0:16]:", data[:16].hex())
print("magic[4:8]:", data[4:8])
print("magic[12:16]:", data[12:16])

# find end of zero padding after header
off = 16
while off < len(data) and data[off] == 0:
    off += 1
print("first non-zero byte after header at offset", off)

# find where LONG runs of zero stop (content start)
zero_run_end = 16
i = 16
while i < len(data):
    if data[i] != 0:
        # check if this is a real start (not an isolated stray zero break)
        # look ahead: is there a solid run of non-zero for next 32 bytes?
        nz = sum(1 for b in data[i:i+64] if b != 0)
        if nz > 48:
            zero_run_end = i
            break
    i += 1
print("content appears to start around offset", zero_run_end)

# dump some content
print("\nbytes[%d:%d+128] hex:" % (zero_run_end, zero_run_end))
print(data[zero_run_end:zero_run_end+128].hex())

# Search for repeats of a chunk (find the 2464 stride mentioned in string scan)
chunk = data[5773:5773+8]
print("\nchunk at 5773:", chunk.hex())
positions = []
start = 0
while True:
    idx = data.find(chunk, start)
    if idx == -1:
        break
    positions.append(idx)
    start = idx + 1
print("positions where this 8-byte chunk repeats:", positions)
if len(positions) > 1:
    diffs = [positions[i+1]-positions[i] for i in range(len(positions)-1)]
    print("diffs:", diffs)
