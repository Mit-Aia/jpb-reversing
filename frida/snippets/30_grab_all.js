// Generic creature grab: collect every skinned vertex-buffer object updated in the next ~2s (FUN_0047b8b4 = per-frame update).
const mod = Process.findModuleByName("libJurassicPark.so");
const target = mod.base.add(0x47b8b4 - 0x10000).add(1);
const u32 = p => { try { return p.readU32(); } catch (e) { return null; } };
globalThis.__objs = {};
const l = Interceptor.attach(target, { onEnter(a) { const k = a[0].toString(); if (!globalThis.__objs[k]) globalThis.__objs[k] = { self: a[0], pnode: a[1], n: 0 }; globalThis.__objs[k].n++; } });
setTimeout(() => {
  l.detach();
  const rows = Object.values(globalThis.__objs).map(o => {
    const s = o.self, beg = u32(s.add(4)), end = u32(s.add(8)), res = u32(s.add(0x34)), node = u32(o.pnode);
    const hw = []; for (let i = 0; i < 8; i++) hw.push(u32(ptr(res).add(i * 4)));
    o.res = res; o.node = node; o.nV = (end - beg) / 12; o.nb = hw[0];
    return "obj=" + s + " node=0x" + node.toString(16) + " calls=" + o.n + " nSkinVerts=" + o.nV + " nBoneGroups=" + hw[0] + " hdr=" + hw.map(x => x.toString(16)).join(",") + " vptr@ghidra=0x" + (u32(s) - mod.base.toUInt32() + 0x10000).toString(16);
  });
  rows.forEach(r => log("OBJ " + r)); log("grab done: " + rows.length + " objects, distinct sceneNodes=" + new Set(Object.values(globalThis.__objs).map(o => o.node)).size);
}, 2000);
log("grab hook attached");
