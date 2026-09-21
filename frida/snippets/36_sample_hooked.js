// For species whose creatures SHARE one scene node/bone array (e.g. Pteranodon): the game rewrites the bones per creature right before each
// per-frame update, so a timer cannot read a consistent palette. Record from inside the update (FUN_0047b8b4, onLeave) instead.
// Needs 30_grab_all.js first. Records the two biggest distinct objects with the same mesh size -> anim_A.bin / anim_B.bin (+ res_A.bin / res_B.bin, each creature's own resource),
// every 2nd call (~30 Hz), SAMPLES per object. Same file layout as 31/33 (t, pos, normals, Static, Palette).
const PKG = "/data/data/com.ludia.jurassicpark/", SAMPLES = globalThis.__samples || 900, EVERY = 2;   // set globalThis.__samples (e.g. 3000 = ~100 s) first for long, non-looping wander animations
const mod = Process.findModuleByName("libJurassicPark.so"), u32 = p => p.readU32();
const TARGET = globalThis.__targetNV || 0;   // crowded scenes: set globalThis.__targetNV = <nV of the creature> with a tiny snippet first
const objs = Object.values(globalThis.__objs).filter(o => !TARGET || o.nV === TARGET).sort((a, b) => b.nV - a.nV), first = objs[0];
const second = objs.find(o => String(o.self) !== String(first.self) && o.nV === first.nV && o.nb === first.nb);
const res = ptr(first.res), w = i => u32(res.add(i * 4)), nb = w(0), nV = first.nV;
// each creature has its OWN copy of the mesh resource and its OWN bone ids inside the shared bone array (Pteranodon B = A's ids + 1)
const idsOf = o => { const rr = ptr(o.res), ww = i => u32(rr.add(i * 4)), out = []; for (let i = 0; i < nb; i++) out.push(rr.add(26 * 4 + ww(26) + 0x68 - 26 * 4 + 0).add(i * 2).readU16()); return out; };
const posB = nV * 12, stride = 4 + posB * 2 + nb * 128, t0 = Date.now(), map = {};
[first, second].filter(x => x).forEach((o, i) => { map[String(o.self)] = { o, tag: i ? "B" : "A", ids: idsOf(o), out: new Uint8Array(SAMPLES * stride), k: 0, calls: 0 }; const f0 = new File(PKG + "res_" + (i ? "B" : "A") + ".bin", "wb"); f0.write(ptr(o.res).readByteArray(0x10000)); f0.flush(); f0.close(); });
let finished = false;
log("hooked-sampler: objects=" + Object.keys(map).length + " nb=" + nb + " nV=" + nV + " stride=" + stride + " samples=" + SAMPLES + " every=" + EVERY);
const h = Interceptor.attach(mod.base.add(0x47b8b4 - 0x10000).add(1), {
  onEnter(a) {   // the bone palette the update USES is *(a[1]) -> node -> +0x88; read it now (it can be swapped before onLeave)
    this.s = String(a[0]); const r = map[this.s]; this.rec = null; if (!r || r.k >= SAMPLES) return; if (r.calls++ % EVERY) return;
    const node = u32(a[1]), arr = ptr(u32(ptr(node).add(0x88))), pal = new Uint8Array(nb * 128);
    for (let i = 0; i < nb; i++) { pal.set(new Uint8Array(arr.add(r.ids[i] * 0xa4 + 8).readByteArray(64)), i * 64); pal.set(new Uint8Array(arr.add(r.ids[i] * 0xa4 + 0x64).readByteArray(64)), nb * 64 + i * 64); }
    this.rec = r; this.pal = pal; if (r.k === 0) log("node[" + r.tag + "] via arg=0x" + node.toString(16) + " via this+0x38=0x" + u32(r.o.self.add(0x38)).toString(16));
  },
  onLeave() {
    const r = this.rec; if (!r) return;
    let o = r.k * stride; new DataView(r.out.buffer, o, 4).setUint32(0, Date.now() - t0, true); o += 4;
    const self = r.o.self;
    r.out.set(new Uint8Array(ptr(u32(self.add(4))).readByteArray(posB)), o); o += posB;
    r.out.set(new Uint8Array(ptr(u32(self.add(0x10))).readByteArray(posB)), o); o += posB;
    r.out.set(this.pal, o);
    r.k++;
    if (!finished && Object.values(map).every(x => x.k >= SAMPLES)) { finished = true; setTimeout(() => {
      h.detach(); Object.values(map).forEach(x => { const f = new File(PKG + "anim_" + x.tag + ".bin", "wb"); f.write(x.out.buffer); f.flush(); f.close(); });
      log("hooked-sampler done dur=" + (Date.now() - t0) + " samples=" + SAMPLES + " stride=" + stride);
    }, 0); }
  }
});
