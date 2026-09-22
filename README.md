# Jurassic Park Builder — reverse engineering the dino assets

Jurassic Park Builder (the Ludia mobile game, not the movie) shut its servers down back in 2020. I run a private server for it as a side project, and at some point I got curious about how the actual 3D dino assets are packed — the format is completely proprietary (Ludia's own "AG" engine) and as far as I can tell nobody has documented it. This repo is the notes, scripts and Ghidra output from picking it apart.

## Where things stand

The hard part is done: I can take a creature that is running in the game and end up with a **rigged, animated, textured model** (`.glb` / `.blend`) whose skinning reproduces the game's own vertex positions exactly.

- **Mesh, skinning and animation: solved.** Exact format of the mesh chunk, the bone/weight data and the skinning formula (below). Verified against live game memory: recomputing the skinning from rest positions + weights + bone matrices matches the game's own output vertices with 0.0000 error.
- **UVs and textures: solved.** Every creature is drawn from a shared skin atlas; a texture-matrix uniform picks its tile.
- **Done so far (`export/`):** Triceratops, Carnotaurus, Pteranodon, Pterodactylus, Tyrannosaurus, Parasaurolophus, Ouranosaurus, Camarasaurus, and the aquatic family — Dunkleosteus, Trinacromerum, Ammonite, Kronosaurus, Gillicus, Leedsichthys, Platecarpus, Tylosaurus. Land-mammal/arctic family started (Entelodon). The same pipeline works for every family tried so far.
- **Still open:** the `.dsb` on-disk animation format (I capture the animation from the running game instead, so it stopped being blocking, but the format is still undecoded), higher-resolution textures (the game only has 128×128 tiles), and other creature families.

Layout: `export/<Species>/[<Species>_<A|B>/]<Species>_<By|Ad>[_<A|B>]/` (one folder per species; `By` = baby, `Ad` = adult, `A`/`B` = the two variants seen in the park, `_Battle` = battle model). What's in each leaf folder: `*_animated.glb` (skinned mesh + skeleton + 240-frame animation + texture), `*_rigged.blend`, `*_rest.obj` (rest pose with UVs/normals), `*_rig.json` (raw weights/matrices per frame), the texture tile and a render. These are models and textures reconstructed from the game, so they are Ludia's IP too — they are here for research/preservation. The original game files (`.dab`/`.dsb`/`.dhr`, the APK), raw memory dumps and the full texture atlases are **not** in the repo (`capture/` is git-ignored).

## The format, in short

Everything below was verified on live data (both creatures).

**Skinning.** Each bone has a runtime record of `0xA4` bytes at `*(sceneNode+0x88) + boneId*0xA4`. Two 4×4 float matrices matter: `+0x08` is constant (mesh→bone space, i.e. inverse bind) and `+0x64` is animated every frame (bone→world). Matrices are row-vector style (`x' = x*m[0] + y*m[4] + z*m[8] + m[12]`). A vertex is

```
v_out = Σ_g  w_g · Palette_g( Static_g( p_rest ) )
```

with at most 3 influences per vertex and weights summing to exactly 1. The game does this on the CPU (there are no skinning shaders); each skinned mesh keeps its final positions/normals as `vec3` arrays that it rewrites every frame.

**Mesh chunk** (`.dab`; offsets relative to the chunk start, header words `w[i]` are little-endian u32; "self-relative" means value + address of the field itself):

| what | where |
|---|---|
| `w[0]` bone groups, `w[1]` render vertices, `w[3]` skin (unique) vertices, `w[4]` (group, vertex) influence pairs | header |
| `u16` bone id per group | `w[26]` + `0x68` (self-relative) |
| `u16` vertex count per group (sums to `w[4]`) | `w[27]` + `0x6c` |
| `f32×3` rest positions, `w[3]` of them | `w[28]` + `0x70` |
| `u16` render→skin vertex remap, `w[1]` entries (render vertices are duplicated across UV/normal seams) | `w[29]` + `0x74` |
| `u16` skin vertex index per influence pair, `w[4]` entries | `w[30]` + `0x78` |
| `f32` weight per influence pair, `w[4]` entries | `w[31]` + `0x7c` |

**Not inside the mesh chunk:**
- The **triangle list** is a separate `u16` chunk (`GL_TRIANGLES`, indices into the *render* vertices) that sits just before the mesh chunk, ending ~8 bytes before it.
- The **interleaved GL vertex buffer** lives elsewhere in the same `.dab`: 36 bytes per render vertex = `pos f32×3, normal f32×3, color u32 (0xFFFFFFFF), u f32, v f32`.
- Game V runs top-down; flip it (`1 − v`) for Blender/glTF.

**Textures.** Creatures don't carry their own texture. They are drawn from one shared RGBA8 skin atlas per family (1024² for the Triceratops, 2048² for the Carnotaurus). A texture-matrix uniform (`glUniformMatrix4fv`, location 3) is sent before each draw: `u' = scale·u + tx`, `v' = scale·v + ty`, which selects a 128×128 tile. Mesh UVs stay 0..1 inside the tile.

**Packages.** `cache_android` has three families: `su*` (surface dinos), `aq*` (aquatic) and `ar*` (arctic/mammals), each with a `*battledino_*` variant. **Package names can be misleading** — the baby Carnotaurus lives in `sudino_spinosa.dab` and there is no carnotaurus package — so always identify a creature from the capture, not the file name.

## How a creature is extracted

Needs a **real ARM device** (I use an Android 15 tablet; the game is armeabi-v7a, no root needed) and a private server for the game to talk to.

1. **Patch the APK** with frida-gadget in *script* mode (not listen mode — listen mode hung on launch):
   ```
   objection patchapk --source <apk> --architecture armeabi-v7a --gadget-version 16.1.11 \
       --script-source frida/hook_loader.js --gadget-config gadget.json --enable-debug
   ```
   with `gadget.json` = `{"interaction": {"type": "script", "path": "libfrida-gadget.script.so", "on_change": "ignore"}}`. Gadget 17.x crashed on launch here; 16.1.11 is fine. Android 15 refuses `targetSdk < 23` installs, so install with `pm install --bypass-low-target-sdk-block -r`. `--enable-debug` is what lets `adb shell run-as` read files back out of the app's data dir.
2. **`frida/hook_loader.js`** runs whatever you drop in the app's `dyn.js` (checked every 2 s), so experiments take seconds instead of a re-patch. `frida/run_snippet.sh` pushes a snippet and prints the log.
3. **Capture** with the creature on screen: `snippets/30_grab_all.js` (find the skinned objects) → `snippets/31_sample_generic.js` (dump the mesh resource + ~8 s of animation and print the draw descriptor). Pull the files with `adb exec-out run-as … cat` (plain `adb shell` mangles binaries).
4. **Texture:** start the game fresh, then `snippets/40_gl_capture_generic.js` (set `PRIMS` to the creature's triangle count) to dump the atlas uploads and log the texture matrix at the creature's draw call. GL texture ids are renumbered between runs — only trust the id logged in the same run.
5. **Build:** `python pipeline/build_creature.py <name> <capture_dir> <cache_dir> <idx_count>` parses the capture generically, finds the source `.dab`, the vertex buffer and the triangle list, and refuses to continue if any consistency check fails (weights sum to 1, the formula reproduces the live vertices, no degenerate triangles).
6. **Blender:** `blender -b --python blender/import_tricera.py -- <name>_rig.json out.blend out.glb tile.png render.png` (the name is historical, it is generic) builds armature, vertex groups, keyframed animation, UV/material, verifies the deformation, and exports. Tested with Blender 5.1; worst deformation error against the reference was 0.026 (Triceratops) and 0.13 (Carnotaurus) units on models that are 90–175 units across — the Carnotaurus figure is not fully explained yet (probably slight scale/shear in some bone matrices that Blender's edit-bone orthonormalization drops).

## Layout

- `pipeline/` — builds a rig dataset from a capture, with checks.
- `blender/` — rig/animation/texture builder and glTF export.
- `frida/` — loader, snippets (`snippets/`), and the earlier probes/experiments (kept for reference).
- `ghidra/` — headless scripts and their output in `findings/`.
- `mesh/`, `animation/`, `renders/` — the earlier, purely static work on `.dab`/`.dsb` files. `mesh/` is superseded by `pipeline/` (it relied on heuristics to guess section boundaries, and some of its conclusions turned out wrong, e.g. it treated the per-bone influence lists as face lists).
- `export/` — per-creature results. `capture/` — raw dumps (not tracked).

## Tooling notes (things that cost me time)

- **Ghidra addresses are `0x10000` too high.** Ghidra imports this ARM `.so` with image base `0x10000`, so the runtime address is `module.base + (ghidraAddr − 0x10000)`. I lost a lot of time hooking the wrong places before finding this. (It also means an earlier conclusion of mine that the game has an anti-tamper check that disconnects on any hook was wrong — that was just hooks in the wrong place. Hooks inside the `.so` are fine, even at hundreds of thousands of calls per second.)
- **Thumb vs ARM.** Frida needs `addr | 1` for Thumb functions and the plain address for ARM ones; guessing wrong corrupts the function and crashes the game. `ghidra/ListFuncsMode.java` reads the real mode per function (almost everything is Thumb-2; the small `_transformVertex`/`_rotateVertex`/`_addVertex` leaf functions are ARM).
- **Ghidra headless is slow to start.** Import and analyze once into a persistent project (`-import`), then run scripts with `-process libJurassicPark.so -noanalysis -readOnly -postScript …` — about 9 s per query instead of ~3 minutes.
- **Zero xrefs usually means a virtual method.** Scan the binary's data for the function's address as a raw 4-byte word (`ghidra/FindFuncPtrRefs2.java`) to find the vtable, then dump the words around it (`DumpVtables.java`) — the C++ RTTI names are right there, even though Ghidra's own RTTI analysis finds nothing (this is how I got `AndroidVertexBufferDynamicImpl`, `GlEsRenderer`, …). Constructors then show up as normal references to the vtable address.
- **Imported GL symbols look uncalled.** Headless import doesn't link external symbols, so `getCallingFunctions()` on `glDrawElements` etc. returns nothing. Look up the relocation table (`FindRelocRefs.java`) to find the real local PLT trampolines, or just hook `libGLESv2.so`'s exports from Frida.
- **PIC globals.** Decompiled code shows globals as `DAT_xxx + immediate`; to get the real address, list the instructions after a known call (`ListInstrRefs.java`) and read the resolved reference off the load/store.
- Literal strings are still the best way in when nothing else works (`FindStringXrefs.java`); the game has profiler labels like `"THREADED SKINNING - MAIN"` (a dead end for finding the skinning code, but they tell you what exists).
- Setup: Ghidra 12.1.3 + JDK 21 (Ghidra 12 refuses JDK 17), Python 3 with numpy/Pillow/matplotlib, Blender 5.1. `libJurassicPark.so` in the APK is not stripped of C++ symbols, which is the only reason any of this was feasible.

## `.dsb` (partial, on hold)

Found a repeating 56-byte record block and worked out which fields are per-track constants vs per-key variables (`animation/explore_dsb*.py`, numbered in the order I ran them, wrong turns included). The binary names the compressed keyframe types (`stVec3HF`/`stQuatHF` half-float variants, and two different compressed quaternion schemes, `stQuatTB` and `stQuat3`; see `ghidra/findings/trackdata_funcs.txt`) but I never found the function that actually reads them. Since the animation can be captured from the running game, this isn't blocking anymore, but decoding it would allow exporting animations without the game running.

## What's next

- Aquatic (`aq*`) and arctic/mammal (`ar*`) creatures, and more surface dinos — they need to be unlocked in the game first, and may use different classes, atlases or draw modes.
- Working out the residual Blender deformation error.
- Decoding `.dsb`.
