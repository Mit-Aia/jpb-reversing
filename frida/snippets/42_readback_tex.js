// Reads back the ACTUAL pixels of the textures bound while the creature draws (GL ES2: attach texture to a temp FBO + glReadPixels).
// Needs no load-time capture. PRIMS = triangle count of the creature draw; DIM = texture side (square) to read.
const PRIMS = 2520, DIM = 1024;
const PKG = "/data/data/com.ludia.jurassicpark/";
const mod = Process.findModuleByName("libJurassicPark.so");
const F = (n, r, a) => new NativeFunction(Module.findExportByName("libGLESv2.so", n), r, a);
const glGetIntegerv = F("glGetIntegerv", "void", ["int", "pointer"]);
const glActiveTexture = F("glActiveTexture", "void", ["int"]);
const glGenFramebuffers = F("glGenFramebuffers", "void", ["int", "pointer"]);
const glBindFramebuffer = F("glBindFramebuffer", "void", ["int", "int"]);
const glFramebufferTexture2D = F("glFramebufferTexture2D", "void", ["int", "int", "int", "int", "int"]);
const glCheckFramebufferStatus = F("glCheckFramebufferStatus", "int", ["int"]);
const glReadPixels = F("glReadPixels", "void", ["int", "int", "int", "int", "int", "int", "pointer"]);
const glDeleteFramebuffers = F("glDeleteFramebuffers", "void", ["int", "pointer"]);
const glGetError = F("glGetError", "int", []);
let done = false;
Interceptor.attach(mod.base.add(0x309fc4 - 0x10000).add(1), { onEnter(a) {
  if (done) return; const inner = a[1].add(4).readU32(); if (!inner || ptr(inner).add(0x1c).readU32() !== PRIMS) return;
  const t = Memory.alloc(16); glGetIntegerv(0x8B8D, t); const prog = t.readU32(); if (prog === 27) return;   // skip the depth-only pass
  done = true; glGetIntegerv(0x84E0, t); const act = t.readS32(); glGetIntegerv(0x8CA6, t); const oldFb = t.readS32();
  const fb = Memory.alloc(4); glGenFramebuffers(1, fb); const id = fb.readU32(); const res = [];
  for (let unit = 0; unit < 2; unit++) {
    glActiveTexture(0x84C0 + unit); glGetIntegerv(0x8069, t); const tex = t.readU32(); if (!tex) { res.push({ unit, tex }); continue; }
    glBindFramebuffer(0x8D40, id); glFramebufferTexture2D(0x8D40, 0x8CE0, 0xDE1, tex, 0);
    const st = glCheckFramebufferStatus(0x8D40); glGetError();
    const buf = Memory.alloc(DIM * DIM * 4); glReadPixels(0, 0, DIM, DIM, 0x1908, 0x1401, buf); const err = glGetError();
    const name = "readback_u" + unit + "_tex" + tex + ".bin"; const f = new File(PKG + name, "wb"); f.write(buf.readByteArray(DIM * DIM * 4)); f.flush(); f.close();
    res.push({ unit, tex, fbStatus: "0x" + st.toString(16), glError: err, file: name });
  }
  glBindFramebuffer(0x8D40, oldFb); glDeleteFramebuffers(1, fb); glActiveTexture(act);
  log("READBACK program=" + prog + " " + JSON.stringify(res));
} });
log("readback hook installed PRIMS=" + PRIMS + " DIM=" + DIM);
