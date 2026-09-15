import struct

path = r"C:\Users\Matheus\Documents\Jurassic park builder\DinoServer-Windows-v1.0.18-FullCache\DinoServer\cache_android\sudino_brachio.dsb"
data = open(path, "rb").read()

REC_START = 4120
REC_SIZE = 56
N_RECS = 145
REC_END = REC_START + REC_SIZE * N_RECS
print("record block:", REC_START, "->", REC_END, "(file size", len(data), ")")

records = []
for i in range(N_RECS):
    off = REC_START + i * REC_SIZE
    tag0, idA, tag1, p12, valB, valC, timeD, tag2, idA2, tag3, p40, valB2, valC2, timeE = struct.unpack_from("<14I", data, off)
    records.append(dict(off=off, tag0=tag0, idA=idA, tag1=tag1, p12=p12, valB=valB, valC=valC, timeD=timeD,
                         tag2=tag2, idA2=idA2, tag3=tag3, p40=p40, valB2=valB2, valC2=valC2, timeE=timeE))

# sanity: tag0/tag1/tag2/tag3 constant? idA==idA2?
tag0s = set(r['tag0'] for r in records)
tag1s = set(r['tag1'] for r in records)
tag2s = set(r['tag2'] for r in records)
tag3s = set(r['tag3'] for r in records)
print("tag0 unique:", len(tag0s), "tag1 unique:", len(tag1s), "tag2 unique:", len(tag2s), "tag3 unique:", len(tag3s))
mismatches = sum(1 for r in records if r['idA'] != r['idA2'])
print("idA != idA2 count:", mismatches, "/", N_RECS)

p12s = set(r['p12'] for r in records)
p40s = set(r['p40'] for r in records)
print("p12 unique values:", p12s)
print("p40 unique values:", p40s)

# timeD/timeE as signed?
print("\nfirst 10 records timeD,timeE,diff,valB,valB2,idA(as hex):")
for r in records[:10]:
    print(r['timeD'], r['timeE'], r['timeD']-r['timeE'], r['valB'], r['valB2'], hex(r['idA']))

print("\nlast 10 records:")
for r in records[-10:]:
    print(r['timeD'], r['timeE'], r['timeD']-r['timeE'], r['valB'], r['valB2'], hex(r['idA']))

# decode valC/valC2 as float32
print("\nvalC as float, first 20:")
for r in records[:20]:
    fC = struct.unpack("<f", struct.pack("<I", r['valC']))[0]
    fC2 = struct.unpack("<f", struct.pack("<I", r['valC2']))[0]
    print(round(fC,4), round(fC2,4))

# how many distinct idA values (bone/track ids)?
idAs = [r['idA'] for r in records]
uniq_idA = sorted(set(idAs))
print("\nunique idA count:", len(uniq_idA))
print("idA sequence (hex):", [hex(x) for x in idAs[:30]])

# valB/valB2 range
valBs = [r['valB'] for r in records]
valB2s = [r['valB2'] for r in records]
print("\nvalB min/max:", min(valBs), max(valBs))
print("valB2 min/max:", min(valB2s), max(valB2s))
