// Records EVERY grabbed body object (nV>10) that has its own scene node, each with ITS OWN mesh size / bone ids / resource (arena with two different species).
// Needs 30_grab_all.js first. 30 s at ~33 ms -> anim_<nV>.bin + res_<nV>.bin (same layout as 31/33), and logs each mesh's DRAW descriptor (idx count = word5).
const PKG = "/data/data/com.ludia.jurassicpark/", SAMPLES = 900, PERIOD = 33, u32 = p => p.readU32();
const mod = Process.findModuleByName("libJurassicPark.so");
const seenSelf = {}, recs = [];
Object.values(globalThis.__objs).filter(o => o.nV > 10).forEach(o => {
  if (seenSelf[String(o.self)]) return; seenSelf[String(o.self)] = 1;
  const res = ptr(o.res), w = i => u32(res.add(i * 4)), nb = w(0), ids = [];
  for (let i = 0; i < nb; i++) ids.push(res.add(26 * 4 + w(26) + 0x68 - 26 * 4 + 0).add(i * 2).readU16());
  const f0 = new File(PKG + "res_" + o.nV + ".bin", "wb"); f0.write(res.readByteArray(0x10000)); f0.flush(); f0.close();
  const posB = o.nV * 12, stride = 4 + posB * 2 + nb * 128;
  recs.push({ o, nb, nV: o.nV, nRender: w(1), ids, posB, stride, out: new Uint8Array(SAMPLES * stride) });
  log("body: nV=" + o.nV + " nb=" + nb + " nRender=" + w(1) + " stride=" + stride);
});
const t0 = Date.now(); let k = 0;
const timer = setInterval(() => {
  if (k >= SAMPLES) { clearInterval(timer); recs.forEach(r => { const f = new File(PKG + "anim_" + r.nV + ".bin", "wb"); f.write(r.out.buffer); f.flush(); f.close(); }); log("bodies-sampler done samples=" + k + " dur=" + (Date.now() - t0)); return; }
  const tt = Date.now() - t0;
  recs.forEach(r => {
    let o = k * r.stride; new DataView(r.out.buffer, o, 4).setUint32(0, tt, true); o += 4;
    try {
      const self = r.o.self; r.out.set(new Uint8Array(ptr(u32(self.add(4))).readByteArray(r.posB)), o); o += r.posB;
      r.out.set(new Uint8Array(ptr(u32(self.add(0x10))).readByteArray(r.posB)), o); o += r.posB;
      const arr = ptr(u32(ptr(u32(self.add(0x38))).add(0x88)));
      for (let i = 0; i < r.nb; i++) { r.out.set(new Uint8Array(arr.add(r.ids[i] * 0xa4 + 8).readByteArray(64)), o); o += 64; }
      for (let i = 0; i < r.nb; i++) { r.out.set(new Uint8Array(arr.add(r.ids[i] * 0xa4 + 0x64).readByteArray(64)), o); o += 64; }
    } catch (e) { if (k % 100 === 0) log("sample err " + r.nV + " " + e.message); }
  });
  k++;
}, PERIOD);
const seen = {}, want = {}; recs.forEach(r => { want[r.nRender] = 1; });
const dl = Interceptor.attach(mod.base.add(0x309fc4 - 0x10000).add(1), { onEnter(a) {
  const inner = a[1].add(4).readU32(); if (!inner) return; const p = ptr(inner), nr = p.add(8).readU32(); if (!want[nr] || seen[inner]) return; seen[inner] = 1;
  log("DRAW nRender=" + nr + " idxCount(w5)=" + p.add(20).readU32() + " prims(w7)=" + p.add(28).readU32());
} });
setTimeout(() => dl.detach(), 5000);
log("bodies-sampler started: " + recs.length + " creatures");
