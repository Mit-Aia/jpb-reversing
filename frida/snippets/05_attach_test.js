const mod = Process.findModuleByName("libJurassicPark.so");
const target = mod.base.add(0x31a874 - 0x10000).add(1);   // FUN_0031a874, thumb, per-frame FPS-zone helper
globalThis.__cnt = 0;
globalThis.__l = Interceptor.attach(target, { onEnter: function (args) { globalThis.__cnt++; } });
log("attached at " + target + " (Ghidra 0x31a874)");
setTimeout(() => log("calls after 5s: " + globalThis.__cnt), 5000);
setTimeout(() => log("calls after 15s: " + globalThis.__cnt), 15000);
setTimeout(() => log("calls after 40s: " + globalThis.__cnt), 40000);
