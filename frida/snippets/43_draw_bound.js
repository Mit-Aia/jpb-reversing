// Logs the first N draws of the creature (PRIMS tris) whose unit-0 texture is really bound (skips warm-up draws).
// Use AFTER 40_gl_capture_generic.js has dumped the uploads (tx_<id>_*.bin); this one only tracks bindings + the tile matrix.
const PRIMS = 2520, N = 3;
const mod = Process.findModuleByName("libJurassicPark.so");
const gl = n => Module.findExportByName("libGLESv2.so", n);
let unit = 0, shown = 0; const cur = {}, m4 = {};
Interceptor.attach(gl("glActiveTexture"), { onEnter(a) { unit = a[0].toInt32() - 0x84c0; } });
Interceptor.attach(gl("glBindTexture"), { onEnter(a) { if (a[0].toInt32() === 0xde1) cur[unit] = a[1].toInt32(); } });
Interceptor.attach(gl("glUniformMatrix4fv"), { onEnter(a) { const o = []; for (let i = 0; i < 16; i++) o.push(+a[3].add(i * 4).readFloat().toFixed(5)); m4[a[0].toInt32()] = o; } });
Interceptor.attach(mod.base.add(0x309fc4 - 0x10000).add(1), { onEnter(a) {
  if (shown >= N) return; const inner = a[1].add(4).readU32(); if (!inner || ptr(inner).add(0x1c).readU32() !== PRIMS || !cur[0]) return; shown++;
  log("BOUND_DRAW boundTex=" + JSON.stringify(cur) + " uvMatrix(loc4)=" + JSON.stringify(m4[4]));
} });
log("bound-draw hook installed PRIMS=" + PRIMS);
