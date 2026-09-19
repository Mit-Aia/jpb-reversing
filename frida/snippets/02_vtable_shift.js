const mod = Process.findModuleByName("libJurassicPark.so");
const b = mod.base;
for (const shift of [0, 0x10000, 0x1000]) {
    const a = b.add(0x5a0fe8 - shift);
    let ws = [];
    try { for (let i = 0; i < 6; i++) ws.push("0x" + a.add(i * 4).readU32().toString(16)); } catch (e) { ws.push("ERR " + e.message); }
    log("Ghidra 0x5a0fe8 - shift 0x" + shift.toString(16) + " -> base+0x" + (0x5a0fe8 - shift).toString(16) + ": " + ws.join(" ") + "   (base=0x" + b.toString(16) + ")");
}
