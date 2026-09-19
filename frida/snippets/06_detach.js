try { globalThis.__l.detach(); } catch (e) { log("detach err " + e.message); }
Interceptor.detachAll();
log("detached; final count=" + globalThis.__cnt);
