const PKG = "/data/data/com.ludia.jurassicpark/";
const inner = ptr("0xc7b3e688");
function u32(p) { try { return p.readU32(); } catch (e) { return null; } }
const words = []; for (let i = 0; i < 40; i++) words.push(u32(inner.add(i * 4)));
log("inner words: " + words.map(w => "0x" + (w >>> 0).toString(16)).join(" "));
function looksIdx(p, n, lim) { try { const b = new Uint16Array(p.readByteArray(n * 2)); for (let i = 0; i < n; i++) if (b[i] >= lim) return false; return true; } catch (e) { return false; } }
const found = [];
words.forEach((w, i) => {
  if (!w || w < 0x10000) return;
  const p = ptr(w);
  if (!Process.findRangeByAddress(p)) return;
  // direct
  if (looksIdx(p, 1446, 343)) { found.push("word " + i + " -> 0x" + w.toString(16) + " = INDEX ARRAY (1446 x u16 < 343)"); const f = new File(PKG + "idx_tris.bin", "wb"); f.write(p.readByteArray(2892)); f.close(); }
  // one more level of indirection
  const q = u32(p); if (q && q > 0x10000 && Process.findRangeByAddress(ptr(q)) && looksIdx(ptr(q), 1446, 343)) { found.push("word " + i + " -> *0x" + w.toString(16) + " = 0x" + q.toString(16) + " INDEX ARRAY (via 1 indirection)"); const f = new File(PKG + "idx_tris.bin", "wb"); f.write(ptr(q).readByteArray(2892)); f.close(); }
});
log("found: " + JSON.stringify(found));
