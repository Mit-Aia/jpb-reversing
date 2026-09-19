const mod = Process.findModuleByName("libJurassicPark.so");
const target = mod.base.add(0x47b8b4 - 0x10000).add(1);
globalThis.__objs = {};
function u32(p) { try { return p.readU32(); } catch (e) { return null; } }
const l = Interceptor.attach(target, { onEnter(a) {
  const k = a[0].toString();
  if (!globalThis.__objs[k]) globalThis.__objs[k] = { self: a[0], pnode: a[1] };
} });
setTimeout(() => {
  l.detach();
  Object.values(globalThis.__objs).forEach(o => {
    const s = o.self;
    const w = []; for (let i = 0; i < 16; i++) w.push("0x" + (u32(s.add(i * 4)) >>> 0).toString(16));
    log("OBJ " + s + " words: " + w.join(" "));
    const beg = u32(s.add(4)), end = u32(s.add(8)), cap = u32(s.add(12));
    log("   vec@+4 begin=0x" + beg.toString(16) + " end=0x" + end.toString(16) + " cap=0x" + cap.toString(16) + " => " + ((end - beg) / 12) + " vec3 (if end-begin) / " + ((cap - beg) / 12) + " (cap)");
    const beg2 = u32(s.add(0x10)), end2 = u32(s.add(0x14)), cap2 = u32(s.add(0x18));
    log("   vec@+0x10 begin=0x" + beg2.toString(16) + " end=0x" + end2.toString(16) + " cap=0x" + cap2.toString(16) + " => " + ((cap2 - beg2) / 12));
    const res = u32(s.add(0x34));
    const hw = []; for (let i = 0; i < 0x50; i++) hw.push((u32(ptr(res).add(i * 4)) >>> 0).toString(16));
    log("   resource=0x" + res.toString(16) + " header words[0..0x4f]: " + hw.join(" "));
  });
  log("grab done, objects=" + Object.keys(globalThis.__objs).length);
}, 1500);
