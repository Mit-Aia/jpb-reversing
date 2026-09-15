import struct

path = r"C:\Users\Matheus\Documents\Jurassic park builder\Arquivo extra\malha_brachio\parte_1_8d0569d4.bin"
with open(path, "rb") as f:
    data = f.read()

def try_parse_count_index_list(start, end, verbose=False):
    pos = start
    groups = []
    while pos < end:
        if pos + 2 > end:
            break
        count = struct.unpack_from("<H", data, pos)[0]
        pos += 2
        if count == 0 or count > 2000:
            if verbose:
                print(f"  BAIL at pos={pos-2}: count={count} implausible")
            return groups, pos - 2
        if pos + count*2 > end:
            if verbose:
                print(f"  BAIL at pos={pos-2}: count={count} would overrun end (need {pos+count*2}, end={end})")
            return groups, pos - 2
        idxs = struct.unpack_from(f"<{count}H", data, pos)
        pos += count*2
        groups.append((count, idxs, pos))
    return groups, pos

start = 376
end = 4400  # extend well beyond original guess
groups, endpos = try_parse_count_index_list(start, end, verbose=True)
print(f"parsed {len(groups)} groups before stopping, endpos={endpos}")
for i, (c, idxs, p) in enumerate(groups[-8:]):
    print(f"  group (near end) count={c} end_offset={p} indices={idxs[:6]}{'...' if len(idxs)>6 else ''}")

print()
print("bytes right after stop point:")
print(data[endpos:endpos+40].hex())
for off in range(endpos, endpos+40, 2):
    print(f"  byte {off}: u16={struct.unpack_from('<H', data, off)[0]}")
