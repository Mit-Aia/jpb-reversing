const mod = Process.findModuleByName("libJurassicPark.so");
log("module base=" + mod.base + " size=" + mod.size + " path=" + mod.path);
log("ELF magic @base: " + mod.base.readByteArray(4) ? "ok" : "?");
// every mapping that falls inside/near the module, with its file offset -> gives the real vaddr<->file mapping
const rs = Process.enumerateRanges("---").filter(r => r.base.compare(mod.base.sub(0x1000)) >= 0 && r.base.compare(mod.base.add(mod.size + 0x200000)) < 0);
rs.forEach(r => log("range " + r.base + " (+0x" + r.base.sub(mod.base).toString(16) + ") size=0x" + r.size.toString(16) + " " + r.protection + (r.file ? " fileoff=0x" + r.file.offset.toString(16) + " " + r.file.path.split("/").pop() : "")));
// locate the string "12GlEsRenderer" (Ghidra addr 0x56de34) in real memory
const pat = "31 32 47 6c 45 73 52 65 6e 64 65 72 65 72";
let found = [];
["r--", "r-x", "rw-"].forEach(p => Process.enumerateRanges(p).forEach(r => {
    try { Memory.scanSync(r.base, r.size, pat).forEach(m => found.push(m.address)); } catch (e) {}
}));
found.forEach(a => log("'12GlEsRenderer' found at " + a + " => offset from base = 0x" + a.sub(mod.base).toString(16) + " (Ghidra says 0x56de34)"));
return "done, hits=" + found.length;
