const mod = Process.findModuleByName("libJurassicPark.so");
const gl = n => Module.findExportByName("libGLESv2.so", n);
let last3 = null, done = 0;
Interceptor.attach(gl("glUniformMatrix4fv"), { onEnter(a) {
  if (a[0].toInt32() === 3) { const o = []; for (let i = 0; i < 16; i++) o.push(+a[3].add(i * 4).readFloat().toFixed(5)); last3 = o; }
} });
Interceptor.attach(mod.base.add(0x309fc4 - 0x10000).add(1), { onEnter(a) {
  if (done >= 3) return;
  const inner = a[1].add(4).readU32(); if (!inner || ptr(inner).add(0x1c).readU32() !== 482) return;
  done++; log("DINO texMatrix(loc3) = " + JSON.stringify(last3));
} });
log("texmatrix hook installed");
