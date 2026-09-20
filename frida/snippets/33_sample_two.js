// Records BOTH creatures of the arena at once (30 s, ~33 ms/sample) -> anim_A.bin / anim_B.bin (same layout as anim_creature.bin) + res_creature.bin.
// A = first grabbed node, B = the other node running the same mesh. Needs 30_grab_all.js first. Which one is "yours" is decided later from the data.
const PKG = "/data/data/com.ludia.jurassicpark/", SAMPLES = 900, PERIOD = 33;
const objs = Object.values(globalThis.__objs).sort((a, b) => b.nV - a.nV);
const first = objs[0], second = objs.find(o => o.nV === first.nV && o.pnode !== first.pnode && o.res === first.res);
const u32 = p => p.readU32();
const res = ptr(first.res), w = i => u32(res.add(i * 4)), nb = w(0), nV = first.nV, nRender = w(1);
const ids = []; for (let i = 0; i < nb; i++) ids.push(res.add(26 * 4 + w(26) + 0x68 - 26 * 4 + 0).add(i * 2).readU16());
const f0 = new File(PKG + "res_creature.bin", "wb"); f0.write(res.readByteArray(0x10000)); f0.flush(); f0.close();
const posB = nV * 12, stride = 4 + posB * 2 + nb * 128, t0 = Date.now();
const rec = [first, second].filter(x => x).map((o, i) => ({ o, tag: i ? "B" : "A", out: new Uint8Array(SAMPLES * stride) }));
log("two-sampler: nodes=" + rec.length + " nb=" + nb + " nV=" + nV + " stride=" + stride + " samples=" + SAMPLES);
let k = 0;
const timer = setInterval(() => {
  if (k >= SAMPLES) {
    clearInterval(timer);
    rec.forEach(r => { const f = new File(PKG + "anim_" + r.tag + ".bin", "wb"); f.write(r.out.buffer); f.flush(); f.close(); });
    log("two-sampler done samples=" + k + " stride=" + stride + " nb=" + nb + " nV=" + nV + " dur=" + (Date.now() - t0)); return;
  }
  const tt = Date.now() - t0;
  rec.forEach(r => {
    let o = k * stride; new DataView(r.out.buffer, o, 4).setUint32(0, tt, true); o += 4;
    try {
      const self = r.o.self; r.out.set(new Uint8Array(ptr(u32(self.add(4))).readByteArray(posB)), o); o += posB;
      r.out.set(new Uint8Array(ptr(u32(self.add(0x10))).readByteArray(posB)), o); o += posB;
      const arr = ptr(u32(ptr(u32(r.o.pnode)).add(0x88)));
      for (let i = 0; i < nb; i++) { r.out.set(new Uint8Array(arr.add(ids[i] * 0xa4 + 8).readByteArray(64)), o); o += 64; }
      for (let i = 0; i < nb; i++) { r.out.set(new Uint8Array(arr.add(ids[i] * 0xa4 + 0x64).readByteArray(64)), o); o += 64; }
    } catch (e) { if (k % 100 === 0) log("sample err " + r.tag + " " + e.message); }
  });
  k++;
}, PERIOD);
