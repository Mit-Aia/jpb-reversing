// Hooks libGLESv2 texture entry points (outside the game .so) + the game's drawIndexed to learn which texture the dino uses.
const PKG = "/data/data/com.ludia.jurassicpark/";
const mod = Process.findModuleByName("libJurassicPark.so");
const gl = n => Module.findExportByName("libGLESv2.so", n);
let unit = 0; const cur = {}; const tex = {};   // cur[unit] = bound 2D texture id ; tex[id] = last upload info
let nUp = 0, saved = 0;
const bpp = (fmt, type) => type === 0x1401 ? ({ 0x1908: 4, 0x1907: 3, 0x1909: 1, 0x190a: 2, 0x1906: 1 }[fmt] || 0) : (type === 0x8033 || type === 0x8034 || type === 0x8363 ? 2 : 0);
function save(name, p, n) { try { const f = new File(PKG + name, "wb"); f.write(p.readByteArray(n)); f.flush(); f.close(); saved++; return true; } catch (e) { return false; } }
Interceptor.attach(gl("glActiveTexture"), { onEnter(a) { unit = a[0].toInt32() - 0x84c0; } });
Interceptor.attach(gl("glBindTexture"), { onEnter(a) { if (a[0].toInt32() === 0xde1) cur[unit] = a[1].toInt32(); } });
Interceptor.attach(gl("glTexImage2D"), { onEnter(a) {
  const lvl = a[1].toInt32(), ifmt = a[2].toInt32(), w = a[3].toInt32(), h = a[4].toInt32(), fmt = a[6].toInt32(), type = a[7].toInt32(), px = a[8];
  const id = cur[unit]; nUp++;
  if (lvl !== 0) return;
  const n = w * h * bpp(fmt, type); const name = "tx_" + id + "_" + w + "x" + h + "_f" + fmt.toString(16) + "_t" + type.toString(16) + ".bin";
  let ok = false; if (!px.isNull() && n > 0 && n <= 9000000) ok = save(name, px, n);
  tex[id] = { w, h, fmt, type, ifmt, file: ok ? name : null }; log("UP tex=" + id + " " + w + "x" + h + " fmt=0x" + fmt.toString(16) + " type=0x" + type.toString(16) + " saved=" + ok);
} });
Interceptor.attach(gl("glCompressedTexImage2D"), { onEnter(a) {
  const lvl = a[1].toInt32(), ifmt = a[2].toInt32(), w = a[3].toInt32(), h = a[4].toInt32(), size = a[6].toInt32(), px = a[7];
  const id = cur[unit]; nUp++;
  if (lvl !== 0) return;
  const name = "tx_" + id + "_" + w + "x" + h + "_c" + ifmt.toString(16) + ".bin"; let ok = false;
  if (!px.isNull() && size > 0 && size <= 9000000) ok = save(name, px, size);
  tex[id] = { w, h, comp: ifmt, size, file: ok ? name : null }; log("UPC tex=" + id + " " + w + "x" + h + " compFmt=0x" + ifmt.toString(16) + " size=" + size + " saved=" + ok);
} });
let lastKey = "";
Interceptor.attach(mod.base.add(0x309fc4 - 0x10000).add(1), { onEnter(a) {
  const inner = a[1].add(4).readU32(); if (!inner) return;
  const cnt = ptr(inner).add(0x1c).readU32(); if (cnt !== 482) return;
  const key = JSON.stringify(cur); if (key !== lastKey) { lastKey = key; log("DINO_DRAW(482 tris) bound textures by unit=" + key + " info=" + JSON.stringify(Object.values(cur).map(i => tex[i]))); }
} });
log("gl capture hooks installed");
