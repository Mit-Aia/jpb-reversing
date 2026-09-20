// Dumps (once per distinct program, max 8) the GLSL sources + active uniform values of the program that draws the creature (PRIMS = triangle count of the draw).
// Queries GL from inside the drawIndexed hook (we are on the GL thread), so shaders compiled earlier are still readable.
const PRIMS = 2520;
const PKG = "/data/data/com.ludia.jurassicpark/";
const mod = Process.findModuleByName("libJurassicPark.so");
const F = (n, r, a) => new NativeFunction(Module.findExportByName("libGLESv2.so", n), r, a);
const glGetIntegerv = F("glGetIntegerv", "void", ["int", "pointer"]);
const glGetAttachedShaders = F("glGetAttachedShaders", "void", ["uint", "int", "pointer", "pointer"]);
const glGetShaderSource = F("glGetShaderSource", "void", ["uint", "int", "pointer", "pointer"]);
const glGetProgramiv = F("glGetProgramiv", "void", ["uint", "int", "pointer"]);
const glGetActiveUniform = F("glGetActiveUniform", "void", ["uint", "uint", "int", "pointer", "pointer", "pointer", "pointer"]);
const glGetUniformLocation = F("glGetUniformLocation", "int", ["uint", "pointer"]);
const glGetUniformfv = F("glGetUniformfv", "void", ["uint", "int", "pointer"]);
const glGetUniformiv = F("glGetUniformiv", "void", ["uint", "int", "pointer"]);
const seenProg = {};
Interceptor.attach(mod.base.add(0x309fc4 - 0x10000).add(1), { onEnter(a) {
  if (Object.keys(seenProg).length >= 8) return; const inner = a[1].add(4).readU32(); if (!inner || ptr(inner).add(0x1c).readU32() !== PRIMS) return;
  const tmp = Memory.alloc(64); glGetIntegerv(0x8B8D, tmp); const prog = tmp.readU32(); if (seenProg[prog]) return; seenProg[prog] = 1; log("SHADER program=" + prog);
  const cnt = Memory.alloc(4), sh = Memory.alloc(8 * 4); glGetAttachedShaders(prog, 8, cnt, sh);
  for (let i = 0; i < cnt.readS32(); i++) {
    const s = sh.add(i * 4).readU32(), buf = Memory.alloc(65536), len = Memory.alloc(4); glGetShaderSource(s, 65536, len, buf);
    const txt = buf.readUtf8String(len.readS32()); const f = new File(PKG + "shader_" + prog + "_" + s + ".txt", "wb"); f.write(txt); f.flush(); f.close();
    log("  shader " + s + " bytes=" + txt.length);
  }
  glGetProgramiv(prog, 0x8B86, tmp); const nu = tmp.readS32(); const out = [];
  for (let i = 0; i < nu; i++) {
    const nm = Memory.alloc(128), l = Memory.alloc(4), sz = Memory.alloc(4), ty = Memory.alloc(4); glGetActiveUniform(prog, i, 128, l, sz, ty, nm);
    const name = nm.readUtf8String(), type = ty.readU32(), loc = glGetUniformLocation(prog, nm), v = Memory.alloc(64);
    let vals = null; try { if (type === 0x8B5C) glGetUniformfv(prog, loc, v), vals = Array.from({ length: 16 }, (_, k) => +v.add(k * 4).readFloat().toFixed(4)); else if (type === 0x1406 || type === 0x8B50 || type === 0x8B51 || type === 0x8B52) { glGetUniformfv(prog, loc, v); const c = { 0x1406: 1, 0x8B50: 2, 0x8B51: 3, 0x8B52: 4 }[type]; vals = Array.from({ length: c }, (_, k) => +v.add(k * 4).readFloat().toFixed(4)); } else if (type === 0x8B5E) { glGetUniformiv(prog, loc, v); vals = v.readS32(); } } catch (e) { vals = "err"; }
    out.push({ name, type: "0x" + type.toString(16), loc, vals });
  }
  log("UNIFORMS " + JSON.stringify(out));
} });
log("shader dump hook installed PRIMS=" + PRIMS);
