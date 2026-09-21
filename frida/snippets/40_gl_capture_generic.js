// Generic texture capture: set PRIMS to the creature's triangle count (draw descriptor word[7]).
const PRIMS = 1999;
const PKG = "/data/data/com.ludia.jurassicpark/";
const mod = Process.findModuleByName("libJurassicPark.so");
const gl = n => Module.findExportByName("libGLESv2.so", n);
let unit = 0; const cur = {}, tex = {}, m4 = {};
const bpp = (fmt, type) => type === 0x1401 ? ({ 0x1908: 4, 0x1907: 3, 0x1909: 1, 0x190a: 2, 0x1906: 1 }[fmt] || 0) : (type === 0x8033 || type === 0x8034 || type === 0x8363 ? 2 : 0);
function save(name, p, n) { try { const f = new File(PKG + name, "wb"); f.write(p.readByteArray(n)); f.flush(); f.close(); return true; } catch (e) { return false; } }
Interceptor.attach(gl("glActiveTexture"), { onEnter(a) { unit = a[0].toInt32() - 0x84c0; } });
Interceptor.attach(gl("glBindTexture"), { onEnter(a) { if (a[0].toInt32() === 0xde1) cur[unit] = a[1].toInt32(); } });
Interceptor.attach(gl("glTexImage2D"), { onEnter(a) {
  const lvl = a[1].toInt32(), w = a[3].toInt32(), h = a[4].toInt32(), fmt = a[6].toInt32(), type = a[7].toInt32(), px = a[8], id = cur[unit];
  if (lvl !== 0) return;
  const n = w * h * bpp(fmt, type), name = "tx_" + id + "_" + w + "x" + h + "_f" + fmt.toString(16) + "_t" + type.toString(16) + ".bin";
  let ok = false; if (!px.isNull() && n > 0 && n <= 20000000) ok = save(name, px, n);
  tex[id] = { w, h, fmt, type, file: ok ? name : null }; log("UP tex=" + id + " " + w + "x" + h + " fmt=0x" + fmt.toString(16) + " type=0x" + type.toString(16) + " saved=" + ok);
} });
Interceptor.attach(gl("glCompressedTexImage2D"), { onEnter(a) {
  const lvl = a[1].toInt32(), ifmt = a[2].toInt32(), w = a[3].toInt32(), h = a[4].toInt32(), size = a[6].toInt32(), px = a[7], id = cur[unit];
  if (lvl !== 0) return; const name = "tx_" + id + "_" + w + "x" + h + "_c" + ifmt.toString(16) + ".bin"; let ok = false;
  if (!px.isNull() && size > 0 && size <= 20000000) ok = save(name, px, size);
  tex[id] = { w, h, comp: ifmt, size, file: ok ? name : null }; log("UPC tex=" + id + " " + w + "x" + h + " comp=0x" + ifmt.toString(16) + " saved=" + ok);
} });
Interceptor.attach(gl("glUniformMatrix4fv"), { onEnter(a) { const o = []; for (let i = 0; i < 16; i++) o.push(+a[3].add(i * 4).readFloat().toFixed(5)); m4[a[0].toInt32()] = o; } });
let done = 0;
Interceptor.attach(mod.base.add(0x309fc4 - 0x10000).add(1), { onEnter(a) {
  if (done >= 2) return; const inner = a[1].add(4).readU32(); if (!inner || ptr(inner).add(0x1c).readU32() !== PRIMS) return; done++;
  log("CREATURE_DRAW(" + PRIMS + " tris) boundTex=" + JSON.stringify(cur) + " info=" + JSON.stringify(Object.values(cur).map(i => tex[i])));
  Object.keys(m4).forEach(k => log("   M4 loc=" + k + " = " + JSON.stringify(m4[k])));
} });
log("generic gl capture installed, PRIMS=" + PRIMS);
