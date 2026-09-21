# Usage: blender -b --python import_tricera.py -- rig.json out.blend out.glb tile.png render.png [name=extra_rig.json ...]  (use ABSOLUTE paths)
# Builds a creature (mesh+skeleton+animation+UV+texture) as a real Blender rig from data captured out of the running game.
# Usage (headless):  blender -b --python import_tricera.py -- tricera_rig.json out.blend [out.glb]
# In the GUI: run from the Scripting tab after editing JSON_PATH below.
#
# Skinning model recovered from the game (verified to 0.0000 error against live game memory):
#   v_out = sum_g  w_g * Palette_g( Static_g( p_rest ) )      (row-vector convention: x' = x*M[0..2] + M[12..14])
#   Static_g  = game record +0x08  (mesh -> bone space, i.e. inverse bind)   -> constant
#   Palette_g = game record +0x64  (bone -> world, animated per frame)
# In Blender (column vectors): rest bone matrix R = inv(Static^T), posed bone matrix P = Palette^T,
# and Blender's deform matrix P * R^-1 == (Static * Palette)^T, exactly the game's.
import bpy, json, sys, math
from mathutils import Matrix

JSON_PATH = "tricera_rig.json"
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if argv:
    JSON_PATH = argv[0]
OUT_BLEND = argv[1] if len(argv) > 1 else None
OUT_GLB = argv[2] if len(argv) > 2 else None
TEX_PATH = argv[3] if len(argv) > 3 else None      # 128x128 tile cropped from the game atlas (see notes)
OUT_RENDER = argv[4] if len(argv) > 4 else None
# optional extra animations, each `name=<rig.json>` (same skeleton/mesh as argv[0], e.g. a sleep loop captured separately)
EXTRA_ANIMS = [a.split("=", 1) for a in argv[5:]]

d = json.load(open(JSON_PATH))
rest, tris, infl, ids = d["rest"], d["tris"], d["influences"], d["boneIds"]
pal, inv = d["palette_rowmajor"], d["invBind_rowmajor"]
nb = len(ids)
ANIMS = [("idle", pal)]
for aname, apath in EXTRA_ANIMS:
    e = json.load(open(apath))
    assert e["boneIds"] == ids and e["invBind_rowmajor"] == inv, "extra animation %s is not on the same skeleton" % aname
    ANIMS.append((aname, e["palette_rowmajor"]))
    if abs(float(e.get("fps", 30)) - float(d.get("fps", 30))) > 0.5: print("WARNING: clip %s fps %s differs from base %s" % (aname, e.get("fps"), d.get("fps")))
nf = max(len(a[1]) for a in ANIMS)
NAME = d.get("name", "Creature")


def mcol(m16):
    return Matrix([m16[0:4], m16[4:8], m16[8:12], m16[12:16]]).transposed()


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
FPS = float(d.get("fps", 30)); scene.render.fps = int(round(FPS))
TS = round(FPS) / FPS      # keyframes are spaced TS frames apart so that glTF/Blender time = real capture time even when the game sampled at 8-30 Hz
scene.frame_start, scene.frame_end = 1, int(math.ceil(1 + (nf - 1) * TS))

mesh = bpy.data.meshes.new(NAME)
mesh.from_pydata([tuple(v) for v in rest], [], [tuple(t) for t in tris])
print("MESHVALIDATE changed:", mesh.validate(verbose=True))
mesh.update()
obj = bpy.data.objects.new(NAME, mesh)
scene.collection.objects.link(obj)
for p in mesh.polygons:
    p.use_smooth = True
if "uv" in d:
    uvl = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        uvl.data[loop.index].uv = d["uv"][loop.vertex_index]

if TEX_PATH:
    mat = bpy.data.materials.new(NAME + "Skin")
    mat.use_nodes = True  # deprecated in Blender 6.0, still required in 5.x
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    img = bpy.data.images.load(TEX_PATH)
    img.pack()
    tn = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tn.image = img
    tn.interpolation = "Linear"      # game samples with linear filtering; "Closest" made the 128px tiles look like blocks
    mat.node_tree.links.new(tn.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.55   # game shader: glossiness 0.14*128 -> mildly shiny, not fully matte
    mesh.materials.append(mat)

arm_data = bpy.data.armatures.new(NAME + "Rig")
arm = bpy.data.objects.new(NAME + "Rig", arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
R = []
for g in range(nb):
    Rg = mcol(inv[g]).inverted()
    R.append(Rg)
    eb = arm_data.edit_bones.new("bone_%02d" % ids[g])
    eb.head = (0, 0, 0)
    eb.tail = (0, 1.5, 0)
    eb.matrix = Rg
bpy.ops.object.mode_set(mode="OBJECT")

for g in range(nb):
    obj.vertex_groups.new(name="bone_%02d" % ids[g])
for vi, lst in enumerate(infl):
    for g, w in lst:
        obj.vertex_groups[g].add([vi], w, "REPLACE")
mod = obj.modifiers.new("Armature", "ARMATURE")
mod.object = arm

bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"
arm.animation_data_create()
ACTIONS = []
for aname, apal in ANIMS:
    act = bpy.data.actions.new(aname)
    act.use_fake_user = True
    arm.animation_data.action = act
    for f in range(len(apal)):
        for g in range(nb):
            pb = arm.pose.bones["bone_%02d" % ids[g]]
            pb.matrix = mcol(apal[f][g])
            fr = 1 + f * TS
            pb.keyframe_insert("location", frame=fr)
            pb.keyframe_insert("rotation_quaternion", frame=fr)
            pb.keyframe_insert("scale", frame=fr)
        bpy.context.view_layer.update()
    ACTIONS.append(act)
bpy.ops.object.mode_set(mode="OBJECT")


# Game space is Y-up; Blender is Z-up. Rotate the whole rig with a root empty so it stands upright (skinning maths unaffected).
import math
root = bpy.data.objects.new(NAME + "Root", None)
scene.collection.objects.link(root)
root.rotation_euler = (math.radians(90), 0, 0)
arm.parent = root
obj.parent = arm      # glTF exporter requires the armature to be the parent of the skinned mesh


def reference(f, pal):
    out = [Matrix.Identity(4).col[3].xyz * 0 for _ in rest]
    for vi, lst in enumerate(infl):
        acc = None
        for g, w in lst:
            q = mcol(pal[f][g]) @ (mcol(inv[g]) @ __import__("mathutils").Vector((*rest[vi], 1.0)))
            acc = q.xyz * w if acc is None else acc + q.xyz * w
        out[vi] = acc
    return out


worst = 0.0
for (aname, apal), act in zip(ANIMS, ACTIONS):
    arm.animation_data.action = act
    n = len(apal)
    for f in (0, n // 4, n // 2, n - 1):
        ff = 1 + f * TS; scene.frame_set(int(ff), subframe=ff - int(ff))
        ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        me = ev.to_mesh()
        ref = reference(f, apal)
        err = max((me.vertices[i].co - ref[i]).length for i in range(len(ref)))
        worst = max(worst, err)
        print("VERIFY %s frame %d: max deformed-vs-reference error = %.6f" % (aname, f + 1, err))
        ev.to_mesh_clear()
print("VERIFY worst error = %.6f" % worst)

arm.animation_data.action = ACTIONS[0]
scene.frame_set(1)
if OUT_RENDER:
    from mathutils import Vector
    # frame the ANIMATED mesh at frame 1 (flyers carry their world position in the bone palette, so the rest pose can be far away)
    ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get()); me = ev.to_mesh(); pts = [obj.matrix_world @ v.co for v in me.vertices]; ev.to_mesh_clear()
    lo = [min(p[i] for p in pts) for i in range(3)]; hi = [max(p[i] for p in pts) for i in range(3)]
    ext = max(hi[i] - lo[i] for i in range(3))
    cx, cy, cz = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2          # already Blender world coordinates
    cam_d = bpy.data.cameras.new("Cam"); cam_d.type = "ORTHO"; cam_d.ortho_scale = ext * 1.9
    cam = bpy.data.objects.new("Cam", cam_d); scene.collection.objects.link(cam)
    cam.location = (cx + 200, cy, cz); cam.rotation_euler = (math.radians(90), 0, math.radians(90)); scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading; sh.light = "FLAT"; sh.color_type = "TEXTURE"
    scene.render.resolution_x, scene.render.resolution_y = 900, 500
    scene.render.filepath = OUT_RENDER
    bpy.ops.render.render(write_still=True)
    print("rendered", OUT_RENDER)
# one NLA track per animation so the .blend keeps them all and the glTF exporter writes each as its own clip
ad = arm.animation_data
ad.action = None
for (aname, apal), act in zip(ANIMS, ACTIONS):
    tr = ad.nla_tracks.new(); tr.name = aname
    tr.strips.new(aname, 1, act)
    tr.mute = len(ad.nla_tracks) > 1      # tracks overlap in time: only the first clip plays by default (unmute / Solo another in the NLA editor)
if OUT_BLEND:
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    print("saved", OUT_BLEND)
if OUT_GLB:
    bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", export_animations=True, export_skins=True)
    print("saved", OUT_GLB)
