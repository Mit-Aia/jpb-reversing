import struct

path = r"C:\Users\Matheus\Documents\Jurassic park builder\DinoServer-Windows-v1.0.18-FullCache\DinoServer\cache_android\sudino_brachio.dsb"
data = open(path, "rb").read()

def find_all(needle, data):
    positions = []
    start = 0
    while True:
        idx = data.find(needle, start)
        if idx == -1:
            break
        positions.append(idx)
        start = idx + 1
    return positions

for tag in [bytes.fromhex("e5700cd0"), bytes.fromhex("f5e42c46")]:
    pos = find_all(tag, data)
    diffs = [pos[i+1]-pos[i] for i in range(len(pos)-1)]
    print(tag.hex(), "count=", len(pos), "first10=", pos[:10], "diffs[:15]=", diffs[:15])

# Look at record starting at 4120, print as a table of u32s for first 200 values
off = 4120
n = 60
vals = struct.unpack_from(f"<{n}I", data, off)
for i, v in enumerate(vals):
    print(off + i*4, hex(v), v)
