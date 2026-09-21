// Writes the ring recorder's contents (chronological) to anim_<nV>.bin. Run any time after 39_ring_recorder.js.
if (!globalThis.__ring) log("no ring recorder running"); else globalThis.__ring.dump();
