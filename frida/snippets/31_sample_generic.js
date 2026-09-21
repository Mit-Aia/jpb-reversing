// Generic sampler: needs globalThis.__objs from 30_grab_all.js. Picks the object with most skin vertices.
const PKG = "/data/data/com.ludia.jurassicpark/";
const objs = Object.values(globalThis.__objs).filter(o => !(globalThis.__targetNV) || o.nV === globalThis.__targetNV).sort((a, b) => b.nV - a.nV);   // optional globalThis.__targetNV picks one mesh in a crowded park
const big = objs[0], self = big.self, u32 = p => p.readU32();
const res = ptr(big.res), w = i => u32(res.add(i * 4));
const nb = w(0), nV = big.nV, nRender = w(1), nPairs = w(4);
const idsOff = w(26) + 0x68 + 26 * 4 - 26 * 4;   // field-relative offsets: value + address-of-field (26*4)
const ids = []; for (let i = 0; i < nb; i++) ids.push(res.add(26 * 4 + w(26) + 0x68 - 26 * 4 + 0).add(i * 2).readU16());
log("nb=" + nb + " nSkin=" + nV + " nRender=" + nRender + " nPairs=" + nPairs + " ids=" + JSON.stringify(ids));
const f0 = new File(PKG + "res_creature.bin", "wb"); f0.write(res.readByteArray(0x10000)); f0.flush(); f0.close();
const nodeP = big.pnode, SAMPLES = 240, PERIOD = 33, posB = nV * 12, stride = 4 + posB * 2 + nb * 128;
const out = new Uint8Array(SAMPLES * stride); let k = 0; const t0 = Date.now();
const timer = setInterval(() => {
  if (k >= SAMPLES) { clearInterval(timer); const f = new File(PKG + "anim_creature.bin", "wb"); f.write(out.buffer); f.flush(); f.close(); log("anim_creature.bin written samples=" + k + " stride=" + stride + " nb=" + nb + " nV=" + nV + " dur=" + (Date.now() - t0)); return; }
  let o = k * stride; new DataView(out.buffer, o, 4).setUint32(0, Date.now() - t0, true); o += 4;
  try {
    out.set(new Uint8Array(ptr(u32(self.add(4))).readByteArray(posB)), o); o += posB;
    out.set(new Uint8Array(ptr(u32(self.add(0x10))).readByteArray(posB)), o); o += posB;
    const arr = ptr(u32(ptr(u32(nodeP)).add(0x88)));
    for (let i = 0; i < nb; i++) { out.set(new Uint8Array(arr.add(ids[i] * 0xa4 + 8).readByteArray(64)), o); o += 64; }
    for (let i = 0; i < nb; i++) { out.set(new Uint8Array(arr.add(ids[i] * 0xa4 + 0x64).readByteArray(64)), o); o += 64; }
  } catch (e) { log("sample err " + e.message); }
  k++;
}, PERIOD);
// draw descriptor of this creature's mesh: word[2] == nRender
const seen = {};
const dl = Interceptor.attach(mod0().add(0x309fc4 - 0x10000).add(1), { onEnter(a) {
  const inner = a[1].add(4).readU32(); if (!inner) return; const p = ptr(inner);
  if (p.add(8).readU32() !== nRender || seen[inner]) return; seen[inner] = 1;
  const ww = []; for (let i = 0; i < 10; i++) ww.push("0x" + p.add(i * 4).readU32().toString(16));
  log("DRAW descriptor words: " + ww.join(" ") + "  (mode=w6 prims=w7 idxCount=w5)");
} });
function mod0() { return Process.findModuleByName("libJurassicPark.so").base; }
setTimeout(() => dl.detach(), 4000);
log("sampling started");
