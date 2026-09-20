// Logs the first N draws with a DISTINCT tile matrix / bound texture of PRIMS tris whose unit-0 texture is really bound (skips warm-up draws). uv matrix is loc 3 (normal models) or loc 4 (battle).
// Use AFTER 40_gl_capture_generic.js has dumped the uploads (tx_<id>_*.bin); this one only tracks bindings + the tile matrix.
const PRIMS = 448, N = 6;
const mod = Process.findModuleByName("libJurassicPark.so");
const gl = n => Module.findExportByName("libGLESv2.so", n);
let unit = 0, shown = 0; const cur = {}, m4 = {}, seenPos = {};
Interceptor.attach(gl("glActiveTexture"), { onEnter(a) { unit = a[0].toInt32() - 0x84c0; } });
Interceptor.attach(gl("glBindTexture"), { onEnter(a) { if (a[0].toInt32() === 0xde1) cur[unit] = a[1].toInt32(); } });
Interceptor.attach(gl("glUniformMatrix4fv"), { onEnter(a) { const o = []; for (let i = 0; i < 16; i++) o.push(+a[3].add(i * 4).readFloat().toFixed(5)); m4[a[0].toInt32()] = o; } });
Interceptor.attach(mod.base.add(0x309fc4 - 0x10000).add(1), { onEnter(a) {
  if (shown >= N) return; const inner = a[1].add(4).readU32(); if (!inner || ptr(inner).add(0x1c).readU32() !== PRIMS || !cur[0]) return;
  const pos = m4[0] ? m4[0].slice(12, 15).join(",") : "?", key = JSON.stringify(m4[3]) + JSON.stringify(m4[4]) + JSON.stringify(cur); if (seenPos[key]) return; seenPos[key] = 1; shown++;   // one log per distinct tile/texture (creatures may share the model matrix)
  log("BOUND_DRAW boundTex=" + JSON.stringify(cur) + " worldPos=" + pos + " uv(loc3)=" + JSON.stringify(m4[3]) + " uv(loc4)=" + JSON.stringify(m4[4]));
} });
log("bound-draw hook installed PRIMS=" + PRIMS);
