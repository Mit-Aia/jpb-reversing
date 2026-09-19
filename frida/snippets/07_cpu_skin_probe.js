const mod = Process.findModuleByName("libJurassicPark.so");
const A = g => mod.base.add(g - 0x10000).add(1);   // thumb
const cnt = { boneLookup: 0, skinLoop: 0, applyPos: 0 };
const nodes = {};
globalThis.__cnt2 = cnt; globalThis.__nodes = nodes;
globalThis.__ls = [
  Interceptor.attach(A(0x37ab98), { onEnter(a) { cnt.boneLookup++; const k = a[0].toString(); if (!nodes[k]) nodes[k] = { maxBone: 0, n: 0 }; nodes[k].n++; const b = a[1].toInt32(); if (b > nodes[k].maxBone && b < 1000) nodes[k].maxBone = b; } }),
  Interceptor.attach(A(0x47b62c), { onEnter(a) { cnt.skinLoop++; } }),
  Interceptor.attach(A(0x3b0f4c), { onEnter(a) { cnt.applyPos++; } }),
];
log("attached 3 counting hooks (0x37ab98, 0x47b62c, 0x3b0f4c)");
setTimeout(() => log("t+5s counts=" + JSON.stringify(cnt) + " sceneNodes=" + JSON.stringify(nodes)), 5000);
setTimeout(() => log("t+20s counts=" + JSON.stringify(cnt) + " sceneNodes=" + JSON.stringify(nodes)), 20000);
