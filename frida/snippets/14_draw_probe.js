const mod = Process.findModuleByName("libJurassicPark.so");
const t = mod.base.add(0x309fc4 - 0x10000).add(1);   // GlEsRenderer::drawIndexed(this, drawObj, x)
const seen = {}; let calls = 0;
function u32(p) { try { return p.readU32(); } catch (e) { return null; } }
const l = Interceptor.attach(t, { onEnter(a) {
  calls++;
  const dobj = a[1]; const inner = u32(dobj.add(4)); if (!inner) return;
  const mode = u32(ptr(inner).add(0x18)), cnt = u32(ptr(inner).add(0x1c));
  const k = mode + ":" + cnt;
  if (!seen[k]) { const w = []; for (let i = 0; i < 12; i++) w.push("0x" + (u32(ptr(inner).add(i * 4)) >>> 0).toString(16)); seen[k] = { n: 0, inner: inner.toString(16), words: w.join(" ") }; }
  seen[k].n++;
} });
setTimeout(() => { l.detach(); log("draw calls=" + calls); Object.entries(seen).sort((a, b) => b[1].n - a[1].n).forEach(([k, v]) => log("mode:count=" + k + " n=" + v.n + " inner=0x" + v.inner + " words=" + v.words)); }, 3000);
log("draw probe attached");
