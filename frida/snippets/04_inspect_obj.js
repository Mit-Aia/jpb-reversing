const mod = Process.findModuleByName("libJurassicPark.so");
const obj = ptr("0xffa3fb6c");
function w(p, i) { try { return p.add(i * 4).readU32(); } catch (e) { return null; } }
let s = [];
for (let i = 0; i < 16; i++) { const v = w(obj, i); s.push("+0x" + (i * 4).toString(16) + "=" + (v === null ? "ERR" : "0x" + v.toString(16))); }
log("obj words: " + s.join(" "));
log("range of obj: " + JSON.stringify(Process.findRangeByAddress(obj)));
const sn = w(obj, 0x38 / 4);
log("sceneNode(+0x38)=0x" + (sn ? sn.toString(16) : sn));
if (sn) {
  const snp = ptr(sn);
  log("range of sceneNode: " + JSON.stringify(Process.findRangeByAddress(snp)));
  const arr = w(snp, 0x88 / 4);
  log("*(sceneNode+0x88)=0x" + (arr ? arr.toString(16) : arr));
  if (arr) {
    const ap = ptr(arr);
    for (let b = 0; b < 4; b++) {
      const m = ap.add(b * 0xa4 + 8);
      let f = [];
      try { for (let i = 0; i < 16; i++) f.push(m.add(i * 4).readFloat().toFixed(3)); } catch (e) { f.push("ERR"); }
      log("bone " + b + " matrix: " + f.join(" "));
    }
  }
}
