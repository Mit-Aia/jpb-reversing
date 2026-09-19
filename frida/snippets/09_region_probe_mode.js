const mod = Process.findModuleByName("libJurassicPark.so");
const addrs = [0x47a144,0x47a1a0,0x47a304,0x47a588,0x47a5dc,0x47a6d0,0x47a7e4,0x47a828,0x47a914,0x47aa00,0x47aa44,0x47ac30,0x47ae4c,0x47ae74,0x47aed0,0x47aef4,0x47af3c,0x47b010,0x47b1ac,0x47b374,0x47b484,0x47b4c8,0x47b558,0x47b604,0x47b62c,0x47b8b4,0x47b920,0x47b9c4,0x47ba5c,0x47bb14,0x47bbcc,0x47bc84,0x47bd34,0x47bdfc,0x47bf0c,0x47bfb4,0x47c060,0x47c170,0x47c380,0x47c5ac,0x47c5dc,0x47c610,0x47cda8,0x47ce34,0x47ceb8,0x47cf04,0x47cf60,0x47cfe0];
const names = ["FUN_0047a144","FUN_0047a1a0","FUN_0047a304","FUN_0047a588","FUN_0047a5dc","FUN_0047a6d0","FUN_0047a7e4","FUN_0047a828","FUN_0047a914","FUN_0047aa00","FUN_0047aa44","FUN_0047ac30","FUN_0047ae4c","FUN_0047ae74","FUN_0047aed0","FUN_0047aef4","FUN_0047af3c","FUN_0047b010","FUN_0047b1ac","FUN_0047b374","FUN_0047b484","FUN_0047b4c8","FUN_0047b558","FUN_0047b604","FUN_0047b62c","FUN_0047b8b4","_transformVertexNeon","_rotateVertexNeon","_addVertexNeon","_transformVertex","_rotateVertex","_addVertex","FUN_0047bd34","FUN_0047bdfc","FUN_0047bf0c","FUN_0047bfb4","FUN_0047c060","FUN_0047c170","FUN_0047c380","FUN_0047c5ac","FUN_0047c5dc","FUN_0047c610","FUN_0047cda8","FUN_0047ce34","FUN_0047ceb8","FUN_0047cf04","FUN_0047cf60","FUN_0047cfe0"];
const modes = ["T","T","T","T","T","T","T","T","T","T","T","T","T","T","T","T","T","T","T","T","T","T","T","T","T","T","A","A","A","A","A","A","T","T","T","T","T","T","T","T","T","T","T","T","T","T","T","T"];
const cnt = {};
globalThis.__rl = [];
addrs.forEach((g, i) => {
  const k = names[i] + "@" + g.toString(16);
  cnt[k] = 0;
  let p = mod.base.add(g - 0x10000);
  if (modes[i] === "T") p = p.add(1);
  try { globalThis.__rl.push(Interceptor.attach(p, { onEnter() { cnt[k]++; } })); }
  catch (e) { log("attach fail " + k + ": " + e.message); }
});
log("attached " + globalThis.__rl.length + " count hooks");
setTimeout(() => { log("FIRED(10s): " + JSON.stringify(Object.entries(cnt).filter(([k, v]) => v > 0))); }, 10000);
setTimeout(() => { log("FIRED(30s): " + JSON.stringify(Object.entries(cnt).filter(([k, v]) => v > 0))); globalThis.__rl.forEach(l => l.detach()); log("detached all"); }, 30000);
