# Jurassic Park Builder — poking at the old asset format

Jurassic Park Builder (the Ludia mobile game, not the movie) shut its servers down back in 2020. I run a private server for it as a side project, and at some point I got curious about how the actual 3D dino assets are packed — turns out the format is completely proprietary (Ludia's own "AG" engine), and as far as I can tell nobody's documented it anywhere. So I've been picking it apart in my free time. This repo is my notes, scripts and Ghidra output so far, not a finished tool.

Short version of where things stand: the static mesh/skinning format (`.dab` files) is basically cracked — I can go from raw bytes to an actual recognizable 3D point cloud of a dinosaur leg. The animation format (`.dsb`) is maybe half-figured-out. And I'm currently stuck trying to capture the runtime bone matrices with Frida because BlueStacks' ARM translation layer (Houdini) hides the target library from Frida's module enumeration.

I'm **not** including the actual game asset files (`.dab`/`.dsb`/`.dhr`, the APK) in this repo since that's Ludia's IP, not mine — just the scripts and the stuff I derived from them.

## Setup, if you want to poke at this too

- Get the APK (`libJurassicPark.so` inside `lib/armeabi-v7a/` is NOT stripped of C++ symbols, which is the only reason any of this was feasible)
- Ghidra 12.1.3 + JDK 21 (Ghidra 12 refuses to run on JDK 17, wastes an hour figuring that out)
- Python 3 with numpy/matplotlib for the parsing/render scripts

## `mesh/` — the .dab format (solved, more or less)

Each dinosaur has a bunch of `.dab` mesh chunks (one per body part / limb). Byte layout, worked out mostly by cross-referencing statistical guesses against the actual decompiled skinning code:

- a per-bone list of vertex/face-corner indices (confirmed via edge-length coherence testing against a random baseline — real triangles come out way shorter than random ones)
- a flat array of vertex positions (plain 12-byte float triples, no header — but the *start offset* of this array isn't fixed, you have to detect it)
- a triangle-strip index buffer
- per-vertex normals

`content_sniffer.py` is the thing that actually makes this generalize across files — it scans a byte range and classifies it (index buffer vs float positions vs [0,1]-bounded scalars) instead of hardcoding offsets, because every file has these sections in a slightly different order/size.

`render_mesh_v3.py` / `render_parts_469.py` turn a raw `.dab` chunk into a wireframe you can actually look at. `export_obj.py` dumps everything to a combined `.obj`.

The image in `renders/` is all 6 usable mesh chunks of one dino (brachiosaurus) plotted together, each in its own local bind-pose space — you can see 5 of them are clearly the same leg shape reused for both front/back legs, and the 6th (green) is a full side-on body silhouette. They don't line up into an assembled dinosaur because each part's world position comes from a bone matrix that isn't stored in this file at all — see the Frida section below for why that matters.

Also decompiled the actual runtime matrix-apply code (`ghidra/findings/matrix_funcs.txt`), which is a pretty standard affine transform, and traced where the live bone matrix lives in memory: `*(sceneNode+0x88) + boneId*0xA4 + 8`, 64 bytes, column-major 4x4. That's the number I'm trying to actually read out of a running instance of the game.

## `animation/` — the .dsb format (partial)

This is where the animation/keyframe data presumably lives, since it's the only file type left that isn't mesh or the chunk index. Found a repeating 56-byte record block and pulled apart which fields are per-track constants vs per-key variables vs some kind of repeating phase marker, all documented inline as I went (see `explore_dsb.py` through `explore_dsb7.py`, numbered roughly in the order I actually ran them, including the wrong turns).

Recovered real type names for the compressed keyframe formats by grepping function names in the binary instead of guessing (`ghidra/findings/trackdata_funcs.txt`) — there's `stVec3HF`/`stQuatHF` (half-float variants), and weirdly two *different* compressed quaternion schemes (`stQuatTB` and `stQuat3`). But I never found the actual function that reads these bytes — every lead traced back to compiler-generated `std::function` glue with zero real logic in it (`ghidra/findings/vec3hf_manager.txt`, `real_parser_bodies.txt` is literally an empty search result). My best guess is the real deserializer got fully inlined somewhere and there's no symbol left to find it by name. Haven't cracked the actual position/rotation values yet.

## `ghidra/` — the actual RE work

Java scripts I ran headless against the `.so` (`analyzeHeadless.bat ... -postScript X.java`). A few notes on what worked and what didn't, because I wasted a lot of time on the didn't:

- Searching by C++ class name / RTTI / mangled symbol substrings for `AGSkin`, `AGMesh`, `AGPackage` etc: dead end, every time, zero hits (`ListRttiSymbols.java`). These classes just don't have discoverable RTTI in this binary.
- What actually works: find a literal string the code must reference (a file extension, a magic tag), get real xrefs to it, decompile from there. Or, when xrefs come up empty: list every function near a known one in address space and decompile the neighbors directly — compilers keep translation units contiguous, and this is literally how I found the real skinning loop (`FindNeonFuncs.java` → `ListFuncsNear.java` → found `FUN_0047b62c`, the actual per-bone skin loop, sitting right next to the leaf transform functions I already knew about).

## `frida/` — where I'm currently stuck

Got frida-gadget injected into the APK fine (`objection patchapk`), confirmed it's alive on the device, can attach and run scripts. The problem: `Process.enumerateModules()` never lists `libJurassicPark.so`, ever — only ever shows the 6 earliest bootstrap libs (see `bone_matrix_dump_failed_capture.json`, that's a real capture attempt, it just never sees the target lib load). Logcat proves the library is loaded and running in the same process, so it's there, Frida just can't see it.

The instance I'm testing on is BlueStacks running the game (armeabi-v7a) through Houdini, since the host is x86_64 with no real ARM core. My read on this is Houdini manages translated code outside the normal linker bookkeeping Frida walks, so it stays invisible to enumeration no matter how long you wait. Tried forcing `Module.load()` as a workaround — just crashes the process.

If anyone's actually solved this specific problem (Frida + Houdini-translated ARM lib on an x86 BlueStacks host) I'd genuinely like to know, that's the main reason this is public now instead of just sitting on my drive.

## what I still don't know

- exact byte layout of a `.dsb` keyframe record (compressed pos/rot values)
- how to get Frida to see a Houdini-translated library, or whether that's even possible on this BlueStacks build
- whether there's a real ARM device path that doesn't need root (I have access to one but it's not mine, so nothing persistent/risky on it)
