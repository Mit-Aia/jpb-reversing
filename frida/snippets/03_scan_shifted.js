const SHIFT = 0x10000;
const mod = Process.findModuleByName("libJurassicPark.so");
const targets = {
  "CONTROL GlEsRenderer": 0x5a0fe8,
  "AndroidVBDynImpl(0x5acb70)": 0x5acb70,
  "ArmNeon(0x5acba8)": 0x5acba8,
  "ArmVfp?(0x5acbe0)": 0x5acbe0,
  "AGVBDynImpl(0x5acc70)": 0x5acc70,
};
const ranges = Process.enumerateRanges("rw-");
function pat(u32) { return [u32 & 255, (u32 >>> 8) & 255, (u32 >>> 16) & 255, (u32 >>> 24) & 255].map(b => b.toString(16).padStart(2, "0")).join(" "); }
const out = [];
for (const [name, g] of Object.entries(targets)) {
  const addr = mod.base.add(g - SHIFT);
  const p = pat(addr.toUInt32());
  let hits = [];
  for (const r of ranges) { try { Memory.scanSync(r.base, r.size, p).forEach(m => hits.push(m.address)); } catch (e) {} }
  log(name + " vptr=" + addr + " pattern=" + p + " hits=" + hits.length + (hits.length ? " first=" + hits.slice(0, 6).join(",") : ""));
  out.push([name, hits.map(String)]);
}
globalThis.__hits = out;
return "scan done";
