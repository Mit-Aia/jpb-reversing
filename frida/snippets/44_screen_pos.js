// For every creature-sized draw (LO<=tris<=HI, non-identity model matrix) logs the SCREEN pixel of its model origin (row-vector: p*M*V*P, then NDC->pixels)
// so a creature seen on the screenshot can be tied to its triangle count / tile. Uniform locs: 0=model, 1=view, 2=proj (normal shader). W,H = screenshot size.
const LO = 150, HI = 1800, W = 1920, H = 1200, SEEN_MAX = 80;
const mod = Process.findModuleByName("libJurassicPark.so");
const gl = n => Module.findExportByName("libGLESv2.so", n);
let unit = 0, shown = 0; const cur = {}, m4 = {}, seen = {};
Interceptor.attach(gl("glActiveTexture"), { onEnter(a) { unit = a[0].toInt32() - 0x84c0; } });
Interceptor.attach(gl("glBindTexture"), { onEnter(a) { if (a[0].toInt32() === 0xde1) cur[unit] = a[1].toInt32(); } });
Interceptor.attach(gl("glUniformMatrix4fv"), { onEnter(a) { const o = []; for (let i = 0; i < 16; i++) o.push(a[3].add(i * 4).readFloat()); m4[a[0].toInt32()] = o; } });
const mul = (a, b) => { const r = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j]; return r; };
Interceptor.attach(mod.base.add(0x309fc4 - 0x10000).add(1), { onEnter(a) {
  if (shown >= SEEN_MAX) return; const inner = a[1].add(4).readU32(); if (!inner || !cur[0] || !m4[0] || !m4[1] || !m4[2]) return;
  const tris = ptr(inner).add(0x1c).readU32(); if (tris < LO || tris > HI) return; const M = m4[0], V = m4[1], Pj = m4[2];
  if (M[12] === 0 && M[13] === 0 && M[14] === 0) return;
  const mvp = mul(mul(M, V), Pj), x = mvp[12], y = mvp[13], w = mvp[15] || 1, px = Math.round((x / w + 1) / 2 * W), py = Math.round((1 - y / w) / 2 * H);
  const u = m4[3] ? m4[3].map(v => +v.toFixed(5)) : null;
  if (u && u[0] === 1) return;                     // identity uv scale = particles/UI (snow, rain): creatures always sample a TILE (scale < 1)
  const key = tris + ":" + px + ":" + py; if (seen[key]) return; seen[key] = 1; shown++;
  log("SCREEN tris=" + tris + " px=(" + px + "," + py + ") tex=" + cur[0] + " uv=" + JSON.stringify(u ? [u[0], u[12], u[13]] : null));
} });
log("screen-pos hook installed");
