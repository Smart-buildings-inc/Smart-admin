"""
fix_fleet.py — ATLAS fleet scene: robust normalization + lighting/shading + render
===================================================================================

Run on the machine where the aircraft collections are LOADED (the source GLB/blend
geometry is not in the repo, so this must run against a file that already contains
the `Fleet_*` collections):

    # headless, renders + saves a copy next to this script:
    blender /path/to/your_fleet_scene.blend --background --python fix_fleet.py

    # or inside Blender's GUI: open your scene, Scripting > Open > fix_fleet.py > Run.

WHY THIS REPLACES build_final.py / env_build.py / scene_finish.py
----------------------------------------------------------------
The old pipeline used a PCA ("method='pca'") path to orient/scale some fleets.
PCA on contaminated vertex data (a stray vertex, an oversized rotor disc, or the
H145 armature) picks a near-degenerate principal axis, so `target / ext_len`
explodes. That is exactly what corrupted the Airbus H145:

    Fleet_Airbus H145 -> size [108.14, 86.43, 1661.17], minz -830.68   (final.json)

No real helicopter is 1.6 km tall. This script removes PCA and axis-reorientation
entirely and instead:
  1. measures each collection with a MAD (median-absolute-deviation) robust
     world-space bbox that REJECTS stray/outlier vertices,
  2. uniformly scales so the longest horizontal span == the real-world length,
  3. seats the model on the ground (minz -> 0) and recenters to its ramp slot,
  4. applies only a Z yaw,
  5. POST-VALIDATES every result (max dim < 60 m, |minz| < 5 cm) and reports it,
  6. normalizes materials so shading reads consistently under the key/fill rig,
  7. builds a clean 3-light rig + Nishita sky + hero camera,
  8. picks the best available render engine + view transform (EEVEE Next -> EEVEE
     -> Cycles; AgX -> Filmic -> Standard) so it runs on Blender 3.6 ... 4.x,
  9. saves atlas_fleet.blend and renders fleet_render.png next to this script.

It is safe to run on an empty file (missing collections are skipped with a
warning) — useful for validating the lighting/world/camera/render rig.
"""

import bpy
import math
import json
import os
import numpy as np
from mathutils import Matrix, Vector

# --------------------------------------------------------------------------- #
# Output location: the .blend's folder if saved, else this script's folder.
# --------------------------------------------------------------------------- #
def _out_dir():
    if bpy.data.filepath:
        return os.path.dirname(bpy.data.filepath)
    try:
        return os.path.dirname(os.path.abspath(__file__))
    except NameError:
        return os.path.expanduser("~/Desktop/AOS/_blender")

OUT = _out_dir()

# --------------------------------------------------------------------------- #
# Per-fleet config. `target` = real-world LENGTH (longest horizontal span, m).
# `pos` = (x, y) ramp slot centre. `yaw` = heading in degrees about +Z.
# No 'method' key any more — every fleet uses the same robust bbox path.
# --------------------------------------------------------------------------- #
CFG = {
    "Fleet_Pilatus PC-12 NG":          dict(target=14.4, pos=(-38,  0), yaw=-6),
    "Fleet_Gulfstream G650ER":         dict(target=30.4, pos=(  0,  0), yaw= 5),
    "Fleet_Cessna Citation Longitude": dict(target=23.0, pos=( 48,  2), yaw=10),
    "Fleet_Bombardier Global 7500":    dict(target=33.8, pos=(-12, 68), yaw=-5),
    "Fleet_Jet - Generic":             dict(target=16.0, pos=( 50, 66), yaw=12),
    "Fleet_Airbus H145":               dict(target=13.6, pos=( 92,  4), yaw= 8),
}
EXCLUDE = ["Fleet_Embraer Phenom 300"]

MAX_REASONABLE_DIM = 60.0   # m — anything larger means the measure was corrupted
SEAT_TOL = 0.05             # m — acceptable |minz| after seating

sc = bpy.context.scene
master = sc.collection


# --------------------------------------------------------------------------- #
# Collection helpers
# --------------------------------------------------------------------------- #
def linked_names():
    seen = set()
    def walk(c):
        seen.add(c.name)
        for ch in c.children:
            walk(ch)
    walk(master)
    return seen


def link_fleets():
    seen = linked_names()
    for fn in CFG:
        c = bpy.data.collections.get(fn)
        if c and fn not in seen:
            master.children.link(c)
    # unlink anything we explicitly exclude
    top = [ch.name for ch in master.children]
    for fn in EXCLUDE:
        c = bpy.data.collections.get(fn)
        if c and c.name in top:
            master.children.unlink(c)


def roots_of(col):
    """Root objects = those whose parent is None or outside the collection."""
    members = set(col.all_objects)
    return [o for o in col.all_objects if (o.parent is None or o.parent not in members)]


def world_points(col, cap=40000):
    objs = [o for o in col.all_objects if o.type == "MESH" and len(o.data.vertices)]
    if not objs:
        return np.empty((0, 3))
    total = sum(len(o.data.vertices) for o in objs)
    step = max(1, total // cap)
    pts = []
    for o in objs:
        mw = o.matrix_world
        vs = o.data.vertices
        for i in range(0, len(vs), step):
            co = mw @ vs[i].co
            pts.append((co.x, co.y, co.z))
    return np.asarray(pts)


def robust_bbox(col, mad_k=6.0):
    """MAD-filtered world-space bbox. Rejects stray verts that wreck naive bboxes."""
    pts = world_points(col)
    if len(pts) == 0:
        return None
    med = np.median(pts, axis=0)
    mad = np.median(np.abs(pts - med), axis=0) + 1e-9
    thresh = mad_k * mad * 1.4826  # MAD -> ~sigma
    keep = np.all(np.abs(pts - med) <= thresh, axis=1)
    use = pts[keep] if keep.sum() >= 8 else pts
    return use.min(axis=0), use.max(axis=0)


def apply_world(roots, M):
    for r in roots:
        r.matrix_world = M @ r.matrix_world
    bpy.context.view_layer.update()


# --------------------------------------------------------------------------- #
# Normalize one fleet: scale -> seat -> yaw -> position, then validate.
# --------------------------------------------------------------------------- #
def normalize_fleet(name, cfg):
    col = bpy.data.collections.get(name)
    if not col:
        return {"status": "missing"}
    bb = robust_bbox(col)
    if bb is None:
        return {"status": "no-mesh"}
    lo, hi = bb
    ext = hi - lo
    horiz = max(float(ext[0]), float(ext[1]))
    if horiz < 1e-6:
        return {"status": "degenerate-extent"}

    roots = roots_of(col)

    # 1) uniform scale so longest horizontal span == real length
    scale = cfg["target"] / horiz
    apply_world(roots, Matrix.Diagonal((scale, scale, scale, 1.0)))

    # 2) re-measure, seat on ground + recenter in XY, then yaw + move to slot
    lo2, hi2 = robust_bbox(col)
    cx = (lo2[0] + hi2[0]) / 2.0
    cy = (lo2[1] + hi2[1]) / 2.0
    minz = lo2[2]
    Tc = Matrix.Translation((-cx, -cy, -minz))            # center XY, seat Z->0
    Rz = Matrix.Rotation(math.radians(cfg["yaw"]), 4, "Z")
    Tp = Matrix.Translation((cfg["pos"][0], cfg["pos"][1], 0.0))
    apply_world(roots, Tp @ Rz @ Tc)

    # 3) validate
    lo3, hi3 = robust_bbox(col)
    size = [round(float(hi3[i] - lo3[i]), 2) for i in range(3)]
    minz_final = round(float(lo3[2]), 3)
    ok = max(size) <= MAX_REASONABLE_DIM and abs(minz_final) <= SEAT_TOL
    return {"status": "ok" if ok else "OUT_OF_RANGE",
            "size": size, "minz": minz_final, "scale": round(scale, 5)}


# --------------------------------------------------------------------------- #
# Material / shading normalization so every aircraft reads under the rig.
# --------------------------------------------------------------------------- #
def fix_materials():
    touched = 0
    fleet_objs = []
    for name in CFG:
        c = bpy.data.collections.get(name)
        if c:
            fleet_objs += [o for o in c.all_objects if o.type == "MESH"]
    mats = {slot.material for o in fleet_objs for slot in o.material_slots if slot.material}
    for m in mats:
        if not m.use_nodes:
            m.use_nodes = True
        nt = m.node_tree
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf is None:
            continue
        # clamp roughness out of the mirror-perfect / pure-matte extremes
        r = bsdf.inputs.get("Roughness")
        if r is not None and not r.is_linked:
            r.default_value = min(0.95, max(0.18, r.default_value))
        # lift pure-black base color so the surface actually shades
        bc = bsdf.inputs.get("Base Color")
        if bc is not None and not bc.is_linked:
            c4 = bc.default_value
            if c4[0] + c4[1] + c4[2] < 0.03:
                bc.default_value = (0.04, 0.04, 0.045, 1.0)
        # tame runaway emission (rotor/glass mats sometimes ship emissive)
        es = bsdf.inputs.get("Emission Strength")
        if es is not None and not es.is_linked and es.default_value > 1.0:
            es.default_value = 1.0
        touched += 1
    return touched


# --------------------------------------------------------------------------- #
# Lighting rig + Nishita sky world.
# --------------------------------------------------------------------------- #
def build_world():
    if sc.world is None:
        sc.world = bpy.data.worlds.new("World")
    w = sc.world
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld"); out.location = (300, 0)
    bg = nt.nodes.new("ShaderNodeBackground"); bg.location = (100, 0)
    bg.inputs["Strength"].default_value = 0.9
    sky = nt.nodes.new("ShaderNodeTexSky"); sky.location = (-200, 0)
    try:
        sky.sky_type = "NISHITA"
        sky.sun_elevation = math.radians(16)
        sky.sun_rotation = math.radians(50)
        sky.air_density = 1.1
        sky.dust_density = 1.0
        sky.ozone_density = 1.2
    except Exception:
        pass
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def light(name, ltype):
    o = bpy.data.objects.get(name)
    if o is None or o.type != "LIGHT":
        d = bpy.data.lights.new(name, ltype)
        o = bpy.data.objects.new(name, d)
        master.objects.link(o)
    o.data.type = ltype
    return o


def build_lights():
    # warm key sun matching the sky sun direction, soft penumbra
    sun = light("Key_Sun", "SUN")
    sun.data.energy = 3.0
    sun.data.color = (1.0, 0.93, 0.8)
    sun.data.angle = math.radians(1.3)
    sun.rotation_euler = (math.radians(90) - math.radians(16), 0, math.radians(50))
    # cool sky fill from the opposite side so shadow sides aren't black
    fill = light("Cool_Fill", "AREA")
    fill.data.shape = "RECTANGLE"; fill.data.size = 120; fill.data.size_y = 120
    fill.data.energy = 6000
    fill.data.color = (0.62, 0.74, 1.0)
    fill.location = (130, -30, 70)
    fill.rotation_euler = (Vector((6, 35, 4)) - fill.location).to_track_quat("-Z", "Y").to_euler()
    # gentle top fill so upper fuselage surfaces read
    top = light("Top_Fill", "AREA")
    top.data.shape = "RECTANGLE"; top.data.size = 200; top.data.size_y = 200
    top.data.energy = 2500
    top.data.color = (1.0, 0.98, 0.95)
    top.location = (6, 35, 120)
    top.rotation_euler = (0.0, 0.0, 0.0)


def build_camera():
    cam = bpy.data.objects.get("Hero_Cam")
    if cam is None or cam.type != "CAMERA":
        cd = bpy.data.cameras.new("Hero_Cam")
        cam = bpy.data.objects.new("Hero_Cam", cd)
        master.objects.link(cam)
    cam.data.lens = 50
    cam.data.dof.use_dof = True
    cam.location = Vector((-66, -128, 13))
    tgt = Vector((10, 34, 7))
    cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.dof.focus_distance = (tgt - cam.location).length
    cam.data.dof.aperture_fstop = 11.0
    sc.camera = cam


# --------------------------------------------------------------------------- #
# Engine-agnostic render settings (works Blender 3.6 .. 4.x).
# --------------------------------------------------------------------------- #
def pick_engine():
    enum = {e.identifier for e in
            type(sc.render).bl_rna.properties["engine"].enum_items}
    for cand in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        if cand in enum:
            sc.render.engine = cand
            return cand
    return sc.render.engine


def configure_render(engine):
    sc.render.film_transparent = False
    if engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        ee = sc.eevee
        for attr, val in [("taa_render_samples", 64), ("use_raytracing", True),
                          ("use_volumetric_lights", True)]:
            try:
                setattr(ee, attr, val)
            except Exception:
                pass
        try:
            ee.ray_tracing_options.use_denoise = True
        except Exception:
            pass
    elif engine == "CYCLES":
        sc.cycles.samples = 96
        try:
            sc.cycles.device = "CPU"
            sc.cycles.use_denoising = True
        except Exception:
            pass
    # view transform: prefer AgX, else Filmic, else Standard
    looks = {v.identifier for v in
             type(sc.view_settings).bl_rna.properties["view_transform"].enum_items}
    sc.view_settings.view_transform = (
        "AgX" if "AgX" in looks else "Filmic" if "Filmic" in looks else "Standard")
    if sc.view_settings.view_transform == "AgX":
        sc.view_settings.exposure = -1.6
    sc.render.resolution_x = 1920
    sc.render.resolution_y = 1080
    sc.render.resolution_percentage = 100


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main():
    print("FIX_FLEET_START  blender", bpy.app.version_string)
    link_fleets()

    report = {}
    for name, cfg in CFG.items():
        report[name] = normalize_fleet(name, cfg)
        print("  ", name, "->", report[name])

    mats = fix_materials()
    build_world()
    build_lights()
    build_camera()
    engine = pick_engine()
    configure_render(engine)

    report["_meta"] = {
        "engine": engine,
        "view_transform": sc.view_settings.view_transform,
        "materials_normalized": mats,
        "blender": bpy.app.version_string,
    }
    with open(os.path.join(OUT, "fix_report.json"), "w") as f:
        json.dump(report, f, indent=1)

    # save a real .blend so the scene can be opened/inspected
    blend_path = os.path.join(OUT, "atlas_fleet.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print("SAVED", blend_path)

    # render verification still
    sc.render.filepath = os.path.join(OUT, "fleet_render.png")
    if sc.camera is not None:
        bpy.ops.render.render(write_still=True)
        print("RENDERED", sc.render.filepath)
    else:
        print("WARN no camera/objects — skipped render (rig still saved)")

    out_of_range = [k for k, v in report.items()
                    if isinstance(v, dict) and v.get("status") == "OUT_OF_RANGE"]
    print("FIX_FLEET_DONE  out_of_range:", out_of_range or "none")


if __name__ == "__main__":
    main()
