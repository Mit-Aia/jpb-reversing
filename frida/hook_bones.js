// Hook FUN_0037ab98 in libJurassicPark.so:
//   int FUN_0037ab98(int sceneNode, int boneId) { return boneId*0xa4 + *(int*)(sceneNode+0x88); }
// This returns a pointer to a 164-byte bone struct; the live 4x4 world matrix
// for that bone lives at (return value + 8), 16 floats, column-major.
// See project_mesh_format_re.md for the full derivation.

const OFFSET = 0x37ab98;
const seen = {}; // key: sceneNode|boneId -> count
let totalHits = 0;
const MAX_LOG_PER_KEY = 3;

function findLib() {
    const mods = Process.enumerateModules();
    for (const m of mods) {
        if (m.name === 'libJurassicPark.so') return m;
    }
    return null;
}

function tryHookWhenReady(attemptsLeft) {
    let lib = findLib();
    if (!lib) {
        // fallback: try forcing a resolve via Module.load / findExports on other names
        try {
            lib = Module.load('libJurassicPark.so');
            send({ type: 'info', message: 'Module.load succeeded', base: lib.base.toString() });
        } catch (e) {
            send({ type: 'poll', message: 'not loaded yet, Module.load failed: ' + e.toString(), attemptsLeft, modules: Process.enumerateModules().map(m => m.name) });
        }
    }
    if (!lib) {
        if (attemptsLeft > 0) {
            setTimeout(() => tryHookWhenReady(attemptsLeft - 1), 2000);
        } else {
            send({ type: 'giveup' });
        }
        return;
    }
    installHook(lib);
}

function installHook(lib) {
    const target = lib.base.add(OFFSET);
    send({ type: 'info', message: 'hooking', base: lib.base.toString(), target: target.toString() });

    Interceptor.attach(target, {
        onEnter(args) {
            this.sceneNode = args[0];
            this.boneId = args[1].toInt32();
        },
        onLeave(retval) {
            if (retval.isNull()) return;
            const key = this.sceneNode.toString() + '|' + this.boneId;
            seen[key] = (seen[key] || 0) + 1;
            totalHits++;
            if (seen[key] > MAX_LOG_PER_KEY) return;

            try {
                const matPtr = retval.add(8);
                const floats = [];
                for (let i = 0; i < 16; i++) {
                    floats.push(matPtr.add(i * 4).readFloat());
                }
                send({
                    type: 'bone_matrix',
                    sceneNode: this.sceneNode.toString(),
                    boneId: this.boneId,
                    structPtr: retval.toString(),
                    matrix: floats,
                    hitCount: seen[key]
                });
            } catch (e) {
                send({ type: 'read_error', message: e.toString(), sceneNode: this.sceneNode.toString(), boneId: this.boneId });
            }
        }
    });

    // periodic heartbeat so we know the hook is alive even with no calls yet
    setInterval(() => {
        send({ type: 'heartbeat', totalHits, uniqueKeys: Object.keys(seen).length });
    }, 5000);
}

tryHookWhenReady(20); // poll every 2s for up to 40s
