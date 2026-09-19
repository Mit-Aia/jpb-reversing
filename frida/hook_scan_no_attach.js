// Reads live bone-transform matrices WITHOUT ever calling Interceptor.attach —
// per project_samsung_tablet_frida_re memory, any Interceptor.attach patching
// bytes inside libJurassicPark.so trips a client-side integrity check that
// drops the connection to the private DinoServer, regardless of which function
// is targeted or whether the hook ever fires. Plain memory reads (Memory.scanSync
// / readU32 / readByteArray) do NOT patch any code and should be invisible to it.
//
// Strategy (derived via static Ghidra analysis, see ghidra/findings/vtable_dump.txt
// and ghidra/findings/ctor_callers.txt):
//   - The renderer's per-submesh object is one of 4 concrete C++ classes
//     (AndroidVertexBufferDynamicImpl / ArmVertexBufferDynamicImplNeon /
//     ArmVertexBufferDynamicImplVfp / ArmVertexBufferDynamicImpl), each with a
//     KNOWN, FIXED vtable address (file offset == vaddr, confirmed via ELF
//     header: ET_DYN, first LOAD vaddr=0x0 offset=0x0).
//   - Any live instance's first 4 bytes ("this+0") equal one of these vtable
//     addresses (module.base + fixed offset) — a robust, low-false-positive
//     heap-scan signature, no need to guess a global registry.
//   - Once found: sceneNode = *(instance+0x38); boneArrayBase = *(sceneNode+0x88);
//     bone N's live 4x4 world matrix (column-major, 16 floats) is at
//     boneArrayBase + N*0xA4 + 8, matching FUN_0037ab98/FUN_003b0f4c exactly
//     (see project_mesh_format_re memory).
//
// Script-gadget mode has no send() channel to a live client, so results are
// written straight to a file in the app's private storage (pull via
// `adb shell run-as com.ludia.jurassicpark cat //data/data/.../scan_dump.json`,
// same pattern as bone_matrix_dump.json in earlier sessions).

const VTABLE_FILE_OFFSETS = [
    0x5acb70, // AndroidVertexBufferDynamicImpl
    0x5acba8, // ArmVertexBufferDynamicImplNeon
    0x5acbe0, // ArmVertexBufferDynamicImplVfp
    0x5acc70, // AGVertexBufferDynamicImpl (base)
    0x5a0fe8, // CONTROL: GlEsRenderer singleton vtable -- must exist from the splash screen on; if this gets 0 hits the scan technique itself is broken
];

const SCENE_NODE_OFFSET_IN_INSTANCE = 0x38;
const BONE_ARRAY_PTR_OFFSET_IN_SCENENODE = 0x88;
const BONE_STRIDE = 0xa4;
const MATRIX_OFFSET_IN_BONE_RECORD = 8;
const MAX_BONES_TO_DUMP = 24;
const SCAN_INTERVAL_MS = 5000;
const LOG_PATH = "/data/data/com.ludia.jurassicpark/scan_log.txt";
const DUMP_PATH = "/data/data/com.ludia.jurassicpark/scan_dump.json";

let logLines = [];
function log(msg) {
    const line = "[" + new Date().toISOString() + "] " + msg;
    logLines.push(line);
    try {
        const f = new File(LOG_PATH, "w");
        f.write(logLines.join("\n"));
        f.flush();
        f.close();
    } catch (e) {}
}

function isPlausiblePointer(p) {
    // heuristic sanity check, not a real range lookup (Process.findRangeByAddress
    // is the correct way but is a bit slow to call thousands of times per scan;
    // start cheap, only pay for findRangeByAddress on values that already look
    // like real heap/mmap pointers)
    const v = p.toUInt32 ? p.toUInt32() : parseInt(p.toString());
    return v > 0x1000 && v < 0xffff0000;
}

function tryReadMatrix(sceneNodePtr, boneId) {
    try {
        const boneArrayBase = sceneNodePtr.add(BONE_ARRAY_PTR_OFFSET_IN_SCENENODE).readPointer();
        if (!isPlausiblePointer(boneArrayBase)) return null;
        const matPtr = boneArrayBase.add(boneId * BONE_STRIDE + MATRIX_OFFSET_IN_BONE_RECORD);
        const floats = [];
        for (let i = 0; i < 16; i++) {
            floats.push(matPtr.add(i * 4).readFloat());
        }
        return floats;
    } catch (e) {
        return null;
    }
}

function scanOnce() {
    const mod = Process.findModuleByName("libJurassicPark.so");
    if (!mod) {
        log("libJurassicPark.so not loaded yet");
        return;
    }

    const patterns = VTABLE_FILE_OFFSETS.map(off => {
        const addr = mod.base.add(off);
        // little-endian 4-byte hex pattern for Memory.scanSync
        const u32 = addr.toUInt32();
        const bytes = [
            (u32 & 0xff),
            (u32 >>> 8) & 0xff,
            (u32 >>> 16) & 0xff,
            (u32 >>> 24) & 0xff,
        ].map(b => b.toString(16).padStart(2, "0")).join(" ");
        return { off, addr, bytes };
    });

    log("module base=" + mod.base + " size=" + mod.size + " -- scanning for " + patterns.length + " vtable signatures");
    for (const pat of patterns) {
        log("  candidate vtable addr=" + pat.addr + " (off=0x" + pat.off.toString(16) + ") bytePattern=" + pat.bytes);
    }

    const ranges = Process.enumerateRanges("rw-");
    let totalHits = 0;
    let totalBytesScanned = 0;
    let rangeErrors = 0;
    const results = [];

    log("enumerated " + ranges.length + " rw- ranges, total size=" + ranges.reduce((s, r) => s + r.size, 0));

    for (const pat of patterns) {
        let patHits = 0;
        for (const range of ranges) {
            let matches;
            try {
                matches = Memory.scanSync(range.base, range.size, pat.bytes);
                totalBytesScanned += range.size;
            } catch (e) {
                rangeErrors++;
                continue;
            }
            for (const m of matches) {
                totalHits++;
                patHits++;
                const instancePtr = m.address;
                let sceneNode;
                try {
                    sceneNode = instancePtr.add(SCENE_NODE_OFFSET_IN_INSTANCE).readPointer();
                } catch (e) {
                    continue;
                }
                if (!isPlausiblePointer(sceneNode)) continue;
                const bones = [];
                for (let b = 0; b < MAX_BONES_TO_DUMP; b++) {
                    const mat = tryReadMatrix(sceneNode, b);
                    if (mat) bones.push({ bone: b, matrix: mat });
                }
                if (bones.length > 0) {
                    results.push({
                        vtableOffset: "0x" + pat.off.toString(16),
                        instance: instancePtr.toString(),
                        sceneNode: sceneNode.toString(),
                        bones: bones,
                    });
                    log("HIT instance=" + instancePtr + " sceneNode=" + sceneNode + " bones_read=" + bones.length);
                }
            }
        }
        log("  pattern off=0x" + pat.off.toString(16) + " raw hits=" + patHits);
    }

    log("scan complete: raw vtable hits=" + totalHits + ", instances with readable bones=" + results.length +
        ", bytesScanned=" + totalBytesScanned + ", rangeErrors=" + rangeErrors);

    if (results.length > 0) {
        try {
            const f = new File(DUMP_PATH, "w");
            f.write(JSON.stringify({ timestamp: Date.now(), results: results }, null, 2));
            f.flush();
            f.close();
        } catch (e) {
            log("failed to write dump: " + e.message);
        }
    }
}

function selfTest() {
    const mod = Process.findModuleByName("libJurassicPark.so");
    if (!mod) { log("SELFTEST: module missing"); return; }

    // (1) is base+vaddr addressing right? vtable slot0 for GlEsRenderer should hold code ptr = base+0x30a001 (thumb bit set)
    try {
        const w0 = mod.base.add(0x5a0fe8).readU32();
        const expect = mod.base.add(0x30a001).toUInt32();
        log("SELFTEST vtable@base+0x5a0fe8 word0=0x" + w0.toString(16) + " expected=0x" + expect.toString(16) + " match=" + (w0 === expect));
        const rangeOfVtable = Process.findRangeByAddress(mod.base.add(0x5a0fe8));
        log("SELFTEST vtable range=" + JSON.stringify(rangeOfVtable));
    } catch (e) {
        log("SELFTEST vtable read failed: " + e.message);
    }

    // (2) does scanSync find a sentinel we wrote ourselves, and is it inside an enumerated rw- range?
    try {
        const buf = Memory.alloc(4096);
        buf.writeU32(0xdeadbeef);
        const ranges = Process.enumerateRanges("rw-");
        const inRange = ranges.some(r => buf.compare(r.base) >= 0 && buf.compare(r.base.add(r.size)) < 0);
        let found = 0;
        for (const r of ranges) {
            try {
                for (const m of Memory.scanSync(r.base, r.size, "ef be ad de")) {
                    if (m.address.equals(buf)) found++;
                }
            } catch (e) {}
        }
        log("SELFTEST sentinel at " + buf + " inEnumeratedRange=" + inRange + " scanFound=" + found);
    } catch (e) {
        log("SELFTEST sentinel failed: " + e.message);
    }
}

log("hook_scan_no_attach.js loaded -- NO Interceptor.attach anywhere in this script");
setTimeout(selfTest, 3000);
setInterval(scanOnce, SCAN_INTERVAL_MS);
