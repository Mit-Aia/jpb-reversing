const mod = Process.findModuleByName("libJurassicPark.so");
const target = mod.base.add(0x47b8b4 - 0x10000).add(1);   // FUN_0047b8b4 (thumb): (this, int* pSceneNode)
let n = 0;
const seen = {};
function u32(p) { try { return p.readU32(); } catch (e) { return null; } }
const l = Interceptor.attach(target, { onEnter(a) {
  if (n >= 40) return;
  n++;
  const self = a[0], pnode = a[1];
  const node = u32(pnode);
  const key = self.toString();
  if (seen[key]) return;
  seen[key] = 1;
  const rec = { self: key, vptr: "0x" + (u32(self) - mod.base.toUInt32() + 0x10000).toString(16) + "(ghidra)", pnode: pnode.toString(), node: node === null ? null : "0x" + node.toString(16) };
  if (node) {
    const arr = u32(ptr(node).add(0x88));
    rec.boneArr = arr === null ? null : "0x" + arr.toString(16);
    const res = u32(self.add(0x34));
    if (res) { rec.boneCount = u32(ptr(res)); }
    if (arr) {
      rec.bones = [];
      for (let b = 0; b < 12; b++) {
        const m = ptr(arr).add(b * 0xa4 + 8);
        const f = [];
        try { for (let i = 0; i < 16; i++) f.push(+m.add(i * 4).readFloat().toFixed(3)); } catch (e) { f.push("ERR"); break; }
        rec.bones.push(f);
      }
    }
  }
  log("CAPTURE " + JSON.stringify(rec));
} });
setTimeout(() => { l.detach(); log("capture hook detached, calls seen=" + n); }, 6000);
log("capture hook attached at " + target);
