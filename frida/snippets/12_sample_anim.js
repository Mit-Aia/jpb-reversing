const PKG = "/data/data/com.ludia.jurassicpark/";
const objs = Object.values(globalThis.__objs);
const big = objs.find(o => o.self.add(4).readU32() && (o.self.add(8).readU32() - o.self.add(4).readU32()) / 12 > 100);
const self = big.self;
const u32 = (p) => p.readU32();
const res = ptr(u32(self.add(0x34)));
const nodePtr = big.pnode;                       // int* pSceneNode
const nb = u32(res);                              // bone groups
const idsOff = u32(res.add(26 * 4)) + 0x68;       // ushort bone ids
const ids = []; for (let i = 0; i < nb; i++) ids.push(res.add(idsOff).add(i * 2).readU16());
const nV = (u32(self.add(8)) - u32(self.add(4))) / 12;
log("nBoneGroups=" + nb + " boneIds=" + JSON.stringify(ids) + " nVerts=" + nV + " resource=" + res);

function dump(name, p, n) { const f = new File(PKG + name, "wb"); f.write(p.readByteArray(n)); f.flush(); f.close(); }
dump("res_big.bin", res, 0x4000);
const res2 = ptr(u32(objs.find(o => o !== big).self.add(0x34)));
dump("res_small.bin", res2, 0x400);
log("resources dumped");

const SAMPLES = 240, PERIOD = 33;
const bonesBytes = nb * 64, posBytes = nV * 12;
const stride = 4 + posBytes * 2 + bonesBytes;
const out = new Uint8Array(SAMPLES * stride);
let k = 0;
const t0 = Date.now();
const timer = setInterval(() => {
  if (k >= SAMPLES) { clearInterval(timer); const f = new File(PKG + "anim.bin", "wb"); f.write(out.buffer); f.flush(); f.close(); log("anim.bin written samples=" + k + " stride=" + stride + " dur=" + (Date.now() - t0) + "ms"); return; }
  let o = k * stride;
  const dv = new DataView(out.buffer, o, 4); dv.setUint32(0, Date.now() - t0, true); o += 4;
  try {
    out.set(new Uint8Array(ptr(u32(self.add(4))).readByteArray(posBytes)), o); o += posBytes;
    out.set(new Uint8Array(ptr(u32(self.add(0x10))).readByteArray(posBytes)), o); o += posBytes;
    const node = u32(nodePtr), arr = ptr(u32(ptr(node).add(0x88)));
    for (let i = 0; i < nb; i++) { out.set(new Uint8Array(arr.add(ids[i] * 0xa4 + 8).readByteArray(64)), o); o += 64; }
  } catch (e) { log("sample err " + e.message); }
  k++;
}, PERIOD);
log("sampling started");
