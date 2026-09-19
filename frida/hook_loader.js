// Tiny dynamic loader: every 2s, reads /data/data/com.ludia.jurassicpark/dyn.js and, if its content
// changed, runs it once as a function body. Lets us iterate on memory-inspection snippets in seconds
// (adb push + run-as cp) instead of re-patching/reinstalling the APK (~2 min) for every experiment.
// Deliberately contains NO Interceptor.attach/replace -- memory reads only (see project notes on the
// anti-tamper check that disconnects the game whenever code inside libJurassicPark.so is patched).
const PKG_DIR = "/data/data/com.ludia.jurassicpark/";
const DYN_PATH = PKG_DIR + "dyn.js";
const LOG_PATH = PKG_DIR + "dyn_log.txt";
const MAX_LINES = 600;

let lines = [];
function flush() {
    try {
        const f = new File(LOG_PATH, "w");
        f.write(lines.join("\n"));
        f.flush();
        f.close();
    } catch (e) {}
}
globalThis.log = function (m) {
    lines.push("[" + new Date().toISOString().substr(11, 12) + "] " + m);
    if (lines.length > MAX_LINES) lines = lines.slice(lines.length - MAX_LINES);
    flush();
};

let last = null;
function tick() {
    let code = null;
    try {
        code = File.readAllText(DYN_PATH);
    } catch (e) {
        return;
    }
    if (code === last) return;
    last = code;
    log("== running new snippet (" + code.length + " bytes) ==");
    try {
        const r = (new Function(code))();
        if (r !== undefined) log("result: " + (typeof r === "string" ? r : JSON.stringify(r)));
    } catch (e) {
        log("ERR " + e.message + " | " + (e.stack || ""));
    }
}

log("loader ready (no Interceptor usage)");
setInterval(tick, 2000);
