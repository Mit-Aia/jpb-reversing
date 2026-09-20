// Prints, per grabbed object, every pointer that could be its scene node (needs 30_grab_all.js first).
const u32 = p => { try { return p.readU32(); } catch (e) { return -1; } };
Object.values(globalThis.__objs).filter(o => o.nV > 10).forEach(o => {
  const s = o.self, a = u32(s.add(0x38)), pn = u32(o.pnode);
  const bones = p => { try { return ptr(u32(ptr(p).add(0x88))).toString(); } catch (e) { return "err"; } };
  log("PROBE obj=" + s + " pnode=" + o.pnode + " *pnode=0x" + pn.toString(16) + " bonesVia*pnode=" + bones(pn) + " | this+0x38=0x" + a.toString(16) + " *(this+0x38)=0x" + u32(ptr(a)).toString(16) + " bonesVia(this+0x38)=" + bones(a));
});
