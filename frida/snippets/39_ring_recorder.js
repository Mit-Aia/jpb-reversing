// RING recorder for arena battles: keeps the LAST N samples (~40 s) of every grabbed body (own nV/nb/ids/res), so the user can attack whenever
// and we dump afterwards with 39b_dump_ring.js. Freezes automatically when the scene is torn down (positions become all-zero) so the last live
// frames (the whole fight) are preserved. Needs 30_grab_all.js first. Re-running replaces any previous recorder.
const PKG = "/data/data/com.ludia.jurassicpark/", N = 1200, PERIOD = 33, u32 = p => p.readU32();
const mod = Process.findModuleByName("libJurassicPark.so");
if (globalThis.__ring && globalThis.__ring.timer) clearInterval(globalThis.__ring.timer);
const seenSelf = {}, recs = [];
Object.values(globalThis.__objs).filter(o => o.nV > 10).forEach(o => {
  if (seenSelf[String(o.self)]) return; seenSelf[String(o.self)] = 1;
  const res = ptr(o.res), w = i => u32(res.add(i * 4)), nb = w(0), ids = [];
  for (let i = 0; i < nb; i++) ids.push(res.add(26 * 4 + w(26) + 0x68 - 26 * 4 + 0).add(i * 2).readU16());
  const f0 = new File(PKG + "res_" + o.nV + ".bin", "wb"); f0.write(res.readByteArray(0x10000)); f0.flush(); f0.close();
  const posB = o.nV * 12, stride = 4 + posB * 2 + nb * 128;
  recs.push({ o, nb, nV: o.nV, nRender: w(1), ids, posB, stride, out: new Uint8Array(N * stride), count: 0, head: 0 });
  log("ring body: nV=" + o.nV + " nb=" + nb + " nRender=" + w(1) + " stride=" + stride);
});
const ring = globalThis.__ring = { recs, frozen: false, t0: Date.now() };
ring.timer = setInterval(() => {
  if (ring.frozen) return;
  const tt = Date.now() - ring.t0;
  for (const r of recs) {
    try {
      const self = r.o.self, pos = ptr(u32(self.add(4)));
      if (pos.readU32() === 0 && pos.add(4).readU32() === 0 && pos.add(8).readU32() === 0 && pos.add(12).readU32() === 0) { ring.frozen = true; log("ring FROZEN (scene torn down) nV=" + r.nV + " frames kept=" + Math.min(r.count, N)); clearInterval(ring.timer); return; }
      let o = r.head * r.stride; new DataView(r.out.buffer, o, 4).setUint32(0, tt, true); o += 4;
      r.out.set(new Uint8Array(pos.readByteArray(r.posB)), o); o += r.posB;
      r.out.set(new Uint8Array(ptr(u32(self.add(0x10))).readByteArray(r.posB)), o); o += r.posB;
      const arr = ptr(u32(ptr(u32(self.add(0x38))).add(0x88)));
      for (let i = 0; i < r.nb; i++) { r.out.set(new Uint8Array(arr.add(r.ids[i] * 0xa4 + 8).readByteArray(64)), o); o += 64; }
      for (let i = 0; i < r.nb; i++) { r.out.set(new Uint8Array(arr.add(r.ids[i] * 0xa4 + 0x64).readByteArray(64)), o); o += 64; }
      r.head = (r.head + 1) % N; r.count++;
    } catch (e) { if (r.count % 200 === 0) log("ring sample err " + r.nV + " " + e.message); }
  }
}, PERIOD);
const nameCount = {};   // several bodies can share nV (e.g. 3 Velociraptor bodies): number the repeats so they do not overwrite each other
ring.dump = () => recs.forEach(r => {
  const valid = Math.min(r.count, N), start = r.count >= N ? r.head : 0, out = new Uint8Array(valid * r.stride);
  for (let i = 0; i < valid; i++) out.set(r.out.subarray(((start + i) % N) * r.stride, ((start + i) % N + 1) * r.stride), i * r.stride);
  const k = nameCount[r.nV] = (nameCount[r.nV] || 0) + 1, fn = "anim_" + r.nV + (k > 1 ? "_" + k : "") + ".bin"; const f = new File(PKG + fn, "wb"); f.write(out.buffer); f.flush(); f.close(); log("ring dumped " + fn + " nV=" + r.nV + " frames=" + valid + " frozen=" + ring.frozen);
});
const seen = {}, want = {}; recs.forEach(r => { want[r.nRender] = 1; });
const dl = Interceptor.attach(mod.base.add(0x309fc4 - 0x10000).add(1), { onEnter(a) {
  const inner = a[1].add(4).readU32(); if (!inner) return; const p = ptr(inner), nr = p.add(8).readU32(); if (!want[nr] || seen[inner]) return; seen[inner] = 1;
  log("DRAW nRender=" + nr + " idxCount(w5)=" + p.add(20).readU32() + " prims(w7)=" + p.add(28).readU32());
} });
setTimeout(() => dl.detach(), 5000);
log("ring recorder running: " + recs.length + " creatures, " + N + " samples each");
