"""
build_atlas_tower.py — procedural Blender model of the ATLAS habitat BUILDING
=============================================================================

This builds the *building* — the ATLAS-01 habitat tower: one floor per human need
(water, energy, food, shelter, air, health, restoration), bottom to top, plus a
ground plaza and a rooftop (solar array, reservoir, comms mast). It is a blueprint-
accurate, fully procedural model — NO external meshes required — and it has its own
per-floor lighting so every floor is individually, evenly lit and shaded.

It is deliberately KEPT SEPARATE FROM THE AIRPLANE FLEET:
  - everything lives in its own scene  "ATLAS_Tower"
  - and its own collection            "ATLAS_Tower"
  - it saves to a SEPARATE file        _blender/atlas_tower.blend
so it can never be confused with / overwrite the fleet scene.

RUN (recommended — fresh, isolated, headless):
    blender --background --python ~/Desktop/AOS/_blender/build_atlas_tower.py
        -> writes _blender/atlas_tower.blend and _blender/atlas_tower.png

RUN (inside an open Blender GUI): Scripting > Open > this file > Run Script.
    It creates a NEW scene "ATLAS_Tower" and switches to it; your other scenes
    (e.g. the fleet) are left untouched. Saving is OFF by default in GUI mode
    (set SAVE_IN_GUI = True to also write atlas_tower.blend).

Blueprint parameters live in CONFIG at the top — change floor count, sizes,
need order, or colors there.
"""

import bpy
import math
import os

# --------------------------------------------------------------------------- #
# CONFIG — the blueprint
# --------------------------------------------------------------------------- #
FLOOR_CLEAR = 3.2     # interior clear height (m)
SLAB_T      = 0.30    # structural slab thickness (m)
STEP        = FLOOR_CLEAR + SLAB_T
HALF_W      = 8.0     # building half-width  (X)  -> 16 m wide
HALF_D      = 5.5     # building half-depth  (Z-as-Y here)  -> 11 m deep
CORE_X      = HALF_W - 1.8   # service core (elevator + stairs) on +X
CUTAWAY     = True    # leave the front (+Y) wall off, dollhouse style
SAVE_IN_GUI = False   # when run inside the GUI, also save atlas_tower.blend

# Floors bottom -> top, matching the web ATLAS twin (one floor per need).
FLOORS = [
    ("Water",       (0.18, 0.55, 1.00)),
    ("Energy",      (1.00, 0.78, 0.20)),
    ("Food",        (0.32, 0.84, 0.42)),
    ("Shelter",     (1.00, 0.62, 0.42)),
    ("Air",         (0.40, 0.90, 0.86)),
    ("Health",      (1.00, 0.32, 0.32)),
    ("Restoration", (0.70, 0.58, 1.00)),
]

OUT = (os.path.dirname(os.path.abspath(bpy.data.filepath)) if bpy.data.filepath
       else os.path.expanduser("~/Desktop/AOS/_blender"))

WALL   = (0.05, 0.07, 0.10, 1.0)
SLABC  = (0.08, 0.10, 0.13, 1.0)
GLASS  = (0.50, 0.78, 0.85, 1.0)
STEEL  = (0.16, 0.20, 0.25, 1.0)


# --------------------------------------------------------------------------- #
# Scene / collection isolation
# --------------------------------------------------------------------------- #
def fresh_scene():
    name = "ATLAS_Tower"
    # If launched headless on the empty default file, reuse it; else make a new
    # scene so we never touch the user's other scenes (the fleet).
    if bpy.data.filepath == "" and len(bpy.data.objects) <= 3 and "Camera" in bpy.data.objects:
        # default startup file -> clean it out
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        sc = bpy.context.scene
        sc.name = name
    else:
        sc = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
        for o in list(sc.collection.objects):
            sc.collection.objects.unlink(o)
    bpy.context.window.scene = sc
    col = bpy.data.collections.get("ATLAS_Tower")
    if col is None:
        col = bpy.data.collections.new("ATLAS_Tower")
        sc.collection.children.link(col)
    return sc, col


SCENE, COL = fresh_scene()


def mat(name, rgba, rough=0.5, metal=0.0, emit=None, emit_str=0.0, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = rgba
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if "Alpha" in b.inputs:
        b.inputs["Alpha"].default_value = alpha
    if alpha < 1.0:
        m.blend_method = "BLEND"
    if emit is not None:
        if "Emission Color" in b.inputs:
            b.inputs["Emission Color"].default_value = (*emit, 1.0)
        if "Emission Strength" in b.inputs:
            b.inputs["Emission Strength"].default_value = emit_str
    return m


def box(name, loc, size, material):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    # move into our collection only
    for c in list(o.users_collection):
        c.objects.unlink(o)
    COL.objects.link(o)
    if material:
        o.data.materials.append(material)
    return o


# --------------------------------------------------------------------------- #
# Build the tower
# --------------------------------------------------------------------------- #
def build():
    n = len(FLOORS)
    total_h = n * STEP
    m_wall = mat("ATLAS_Wall", WALL, rough=0.7)
    m_slab = mat("ATLAS_Slab", SLABC, rough=0.6)
    m_glass = mat("ATLAS_Glass", GLASS, rough=0.1, alpha=0.18)
    m_steel = mat("ATLAS_Steel", STEEL, rough=0.4, metal=0.8)

    # ground plaza
    box("ATLAS_Plaza", (0, 0, -SLAB_T - 0.1),
        (HALF_W * 2 + 8, HALF_D * 2 + 8, 0.2), mat("ATLAS_Plaza", (0.04, 0.06, 0.09, 1.0), rough=0.8))

    # corner columns
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(f"Col_{sx}_{sy}", (sx * HALF_W, sy * HALF_D, total_h / 2),
                (0.5, 0.5, total_h + 0.3), m_steel)

    # service core (full height, +X back corner)
    box("Core", (CORE_X, -HALF_D + 1.6, total_h / 2),
        (2.6, 2.6, total_h), mat("ATLAS_Core", (0.10, 0.12, 0.16, 1.0), rough=0.5))

    for i, (need, accent) in enumerate(FLOORS):
        base = i * STEP
        acc = mat(f"Accent_{need}", (*accent, 1.0), rough=0.45, emit=accent, emit_str=0.6)

        # slab
        box(f"Slab_{need}", (0, 0, base - SLAB_T / 2),
            (HALF_W * 2 + 0.3, HALF_D * 2 + 0.3, SLAB_T), m_slab)
        # accent reveal at slab edge (per-floor identity)
        box(f"Reveal_{need}", (0, HALF_D, base + 0.06),
            (HALF_W * 2 + 0.32, 0.12, 0.12), acc)

        cy = base + FLOOR_CLEAR / 2
        # back + two side walls
        box(f"WallBack_{need}", (0, -HALF_D, cy), (HALF_W * 2, 0.16, FLOOR_CLEAR), m_wall)
        box(f"WallL_{need}", (-HALF_W, 0, cy), (0.16, HALF_D * 2, FLOOR_CLEAR), m_wall)
        box(f"WallR_{need}", (HALF_W, 0, cy), (0.16, HALF_D * 2, FLOOR_CLEAR), m_wall)
        # glass front (or none in cutaway)
        if not CUTAWAY:
            box(f"Glass_{need}", (0, HALF_D, cy), (HALF_W * 2, 0.08, FLOOR_CLEAR), m_glass)

        # a simple, readable interior block per need (furniture/equipment massing)
        box(f"Fit_{need}", (-HALF_W + 3.0, -HALF_D + 2.2, base + 0.7),
            (4.5, 3.0, 1.4), acc)

        # ---- PER-FLOOR INTERIOR LIGHT (the point of this pass) ----
        ld = bpy.data.lights.new(f"Light_{need}", "POINT")
        ld.energy = 1800.0           # candela-ish; tuned for a ~3 m room
        ld.color = (1.0, 0.95, 0.85)
        ld.shadow_soft_size = 1.2
        lo = bpy.data.objects.new(f"Light_{need}", ld)
        lo.location = (0, 1.0, base + FLOOR_CLEAR * 0.8)
        COL.objects.link(lo)
        # a cool back fill so deep interior reads, not silhouettes
        fd = bpy.data.lights.new(f"Fill_{need}", "POINT")
        fd.energy = 600.0
        fd.color = (0.7, 0.8, 1.0)
        fd.shadow_soft_size = 2.0
        fo = bpy.data.objects.new(f"Fill_{need}", fd)
        fo.location = (0, -HALF_D + 1.0, base + FLOOR_CLEAR * 0.5)
        COL.objects.link(fo)

    # ---- rooftop ----
    box("Roof_Slab", (0, 0, total_h + 0.08),
        (HALF_W * 2 + 0.3, HALF_D * 2 + 0.3, 0.16), m_slab)
    m_panel = mat("Roof_Solar", (0.05, 0.09, 0.18, 1.0), rough=0.2, metal=0.6,
                  emit=(0.30, 0.66, 1.0), emit_str=0.2)
    for k in (-1, 0, 1):
        p = box(f"Solar_{k}", (-2.6 + k * 2.4, 0, total_h + 0.7), (2.0, 3.2, 0.12), m_panel)
        p.rotation_euler = (math.radians(-28), 0, 0)
    box("Reservoir", (HALF_W - 2.5, -HALF_D + 2.5, total_h + 1.2),
        (2.4, 2.4, 2.4), mat("Reservoir", (0.12, 0.36, 0.52, 1.0), rough=0.3))
    box("Mast", (HALF_W - 2.5, HALF_D - 2.0, total_h + 2.0), (0.16, 0.16, 4.0), m_steel)

    return total_h


# --------------------------------------------------------------------------- #
# World, key lights, camera, render
# --------------------------------------------------------------------------- #
def build_world():
    if SCENE.world is None:
        SCENE.world = bpy.data.worlds.new("ATLAS_World")
    w = SCENE.world
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 0.8
    sky = nt.nodes.new("ShaderNodeTexSky")
    try:
        sky.sky_type = "NISHITA"
        sky.sun_elevation = math.radians(22)
        sky.sun_rotation = math.radians(45)
    except Exception:
        pass
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def build_key_and_cam(total_h):
    sd = bpy.data.lights.new("Key_Sun", "SUN")
    sd.energy = 2.6
    sd.color = (1.0, 0.95, 0.85)
    sd.angle = math.radians(1.5)
    so = bpy.data.objects.new("Key_Sun", sd)
    so.rotation_euler = (math.radians(60), 0, math.radians(45))
    COL.objects.link(so)

    cd = bpy.data.cameras.new("Hero_Cam")
    cd.lens = 35
    cam = bpy.data.objects.new("Hero_Cam", cd)
    cam.location = (HALF_W * 3.0, -HALF_D * 5.0, total_h * 0.62)
    from mathutils import Vector
    tgt = Vector((0, 0, total_h * 0.45))
    cam.rotation_euler = (tgt - Vector(cam.location)).to_track_quat("-Z", "Y").to_euler()
    COL.objects.link(cam)
    SCENE.camera = cam


def configure_render():
    enum = {e.identifier for e in
            type(SCENE.render).bl_rna.properties["engine"].enum_items}
    for cand in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        if cand in enum:
            SCENE.render.engine = cand
            break
    if SCENE.render.engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            SCENE.eevee.taa_render_samples = 64
            SCENE.eevee.use_raytracing = True
        except Exception:
            pass
    elif SCENE.render.engine == "CYCLES":
        SCENE.cycles.samples = 96
        try:
            SCENE.cycles.device = "CPU"
        except Exception:
            pass
    looks = {v.identifier for v in
             type(SCENE.view_settings).bl_rna.properties["view_transform"].enum_items}
    SCENE.view_settings.view_transform = (
        "AgX" if "AgX" in looks else "Filmic" if "Filmic" in looks else "Standard")
    SCENE.render.resolution_x = 1600
    SCENE.render.resolution_y = 1600
    SCENE.render.resolution_percentage = 100


def main():
    print("BUILD_ATLAS_TOWER_START", bpy.app.version_string)
    total_h = build()
    build_world()
    build_key_and_cam(total_h)
    configure_render()

    headless = bpy.app.background
    if headless or SAVE_IN_GUI:
        blend = os.path.join(OUT, "atlas_tower.blend")
        bpy.ops.wm.save_as_mainfile(filepath=blend)
        print("SAVED", blend)
    SCENE.render.filepath = os.path.join(OUT, "atlas_tower.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", SCENE.render.filepath)
    print("BUILD_ATLAS_TOWER_DONE floors=%d height=%.1fm" % (len(FLOORS), total_h))


if __name__ == "__main__":
    main()
