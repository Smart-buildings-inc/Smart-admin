#!/usr/bin/env python3
"""
Procedurally build the ATLAS-01 "hero" tower in Blender and export a detailed-
but-lightweight glTF (.glb) to public/models/atlas-01.glb.

Run headless with Blender-as-a-module (no GUI needed):

    pip install bpy            # Blender 5.x for Python 3.11
    python3 scripts/blender/build_atlas01.py

Design contract (must match src/components/BuildingSimulator.tsx +
docs/ATLAS-blender-model-spec.md):
  • metric, +Y up on export, origin at grade centre
  • FLOOR_H 1.5, SLAB_T 0.16, STEP 1.66, HALF_W 5, HALF_D 3.5
  • one Blender collection + root object per floor, named === Floor.key
  • emissive per-need accents (hexes mirror src/lib/ui.ts)
  • right-sized geometry: basement reservoir, pool-only roof, dual passenger
    elevators + a firefighter car, two stair cores, ESS room
Lightweight technique: simple boxes + Array modifiers for repetition (windows,
PV, railings, ESS cabinets), a single-segment bevel for premium edges, then
modifiers applied + merge-by-distance on export. No textures (vertex/material
colour only) so the .glb stays small.
"""

import math
import os
import bpy

# --- layout constants (world units; mirror the app) ------------------------
FLOOR_H = 1.5
SLAB_T = 0.16
STEP = FLOOR_H + SLAB_T
HALF_W = 5.0
HALF_D = 3.5
CORE_X = 3.4
CORE_Z = -1.9
CORE_Z2 = -0.1          # second passenger shaft
CORE_Z3 = 1.7           # firefighter elevator
STAIR_X = -3.5

# floor stack (bottom -> top), keys + needs mirror src/lib/db/seed-data.ts
FLOORS = [
    ("reclamation-core", "water"),
    ("commons-clinic", "health"),
    ("power-ops-core", "energy"),
    ("aquaponics-bay", "food"),
    ("vertical-farm", "food"),
    ("residences-a", "shelter"),
    ("residences-b", "shelter"),
    ("residences-c", "shelter"),
    ("residences-d", "shelter"),
    ("the-lung", "air"),
    ("penthouses", "shelter"),
    ("skydeck-reservoir", "restoration"),
]

NEED_HEX = {
    "water": "3aa0ff", "energy": "ffcf4d", "food": "5ddc7a",
    "shelter": "c0a4ff", "air": "7fe7e0", "health": "ff8fb1",
    "restoration": "ffd9a0",
}

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "models", "atlas-01.glb")


# --- helpers ---------------------------------------------------------------
def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_lin(h):
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


_mats = {}


def material(name, hex_col, *, emission=0.0, metallic=0.0, roughness=0.6, alpha=1.0):
    key = (name, hex_col, emission, metallic, round(roughness, 2), alpha)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    col = hex_lin(hex_col)
    bsdf.inputs["Base Color"].default_value = (col[0], col[1], col[2], alpha)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha
    if emission > 0:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (col[0], col[1], col[2], 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission
    if alpha < 1.0:
        try:
            m.blend_method = "BLEND"
        except Exception:
            pass
    _mats[key] = m
    return m


def box(name, size, loc, mat, coll, *, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[1], size[2])
    o.data.materials.append(mat)
    if bevel > 0:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        mod.limit_method = "ANGLE"
    # link into the target collection (unlink from scene default)
    for c in list(o.users_collection):
        c.objects.unlink(o)
    coll.objects.link(o)
    return o


def arrayed(o, count, offset):
    mod = o.modifiers.new("array", "ARRAY")
    mod.count = count
    mod.use_relative_offset = False
    mod.use_constant_offset = True
    mod.constant_offset_displace = offset
    return o


def new_collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


# --- materials -------------------------------------------------------------
CONCRETE = lambda: material("mat.concrete", "1a2832", roughness=0.85)
DARK = lambda: material("mat.concrete.dark", "0d161e", roughness=0.9)
METAL = lambda: material("mat.metal", "47525c", metallic=0.9, roughness=0.35)
GLASS = lambda: material("mat.glass.cutaway", "9fc7e8", metallic=0.0, roughness=0.1, alpha=0.28)
PURPLE = lambda: material("mat.purple.nonpotable", "9b5de5", emission=0.6)
WATERM = lambda: material("mat.water", "3aa0ff", emission=0.4, alpha=0.7)
PV = lambda: material("mat.pv", "1b2a4a", metallic=0.6, roughness=0.25)


def accent(need, strength=1.4):
    return material(f"mat.need.{need}", NEED_HEX[need], emission=strength)


# --- build -----------------------------------------------------------------
def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def build_floor(i, key, need, coll):
    y = i * STEP                      # slab top sits near here
    cy = y + FLOOR_H / 2.0
    acc = accent(need)
    # slab
    box(f"{key}.shell.slab", (HALF_W * 2 + 0.3, SLAB_T, HALF_D * 2 + 0.3),
        (0, y - SLAB_T / 2, 0), DARK(), coll, bevel=0.02)
    # 3 solid walls (back + sides) in concrete
    box(f"{key}.shell.back", (HALF_W * 2, FLOOR_H, 0.16),
        (0, cy, -HALF_D), CONCRETE(), coll, bevel=0.015)
    box(f"{key}.shell.left", (0.16, FLOOR_H, HALF_D * 2),
        (-HALF_W, cy, 0), CONCRETE(), coll, bevel=0.015)
    box(f"{key}.shell.right", (0.16, FLOOR_H, HALF_D * 2),
        (HALF_W, cy, 0), CONCRETE(), coll, bevel=0.015)
    # glazed front (cut-away face) — the *.shell.front the app can hide
    box(f"{key}.shell.front", (HALF_W * 2, FLOOR_H, 0.06),
        (0, cy, HALF_D), GLASS(), coll)
    # emissive sill band (the lit floor accent) + interior glow strip
    box(f"{key}.emissive.sill", (HALF_W * 2 - 0.2, 0.1, 0.05),
        (0, y + 0.12, HALF_D - 0.02), acc, coll)
    box(f"{key}.emissive.core", (0.3, FLOOR_H * 0.7, 0.3),
        (-HALF_W + 1.2, cy, -HALF_D + 1.0), acc, coll)
    # front mullions (Array) — premium facade detail, cheap source mesh
    mull = box(f"{key}.mullion", (0.07, FLOOR_H, 0.07),
               (-HALF_W + 0.6, cy, HALF_D - 0.02), METAL(), coll)
    arrayed(mull, 10, (0.97, 0, 0))
    # floor-edge trim
    box(f"{key}.trim", (HALF_W * 2 + 0.2, 0.06, HALF_D * 2 + 0.2),
        (0, y + 0.02, 0), METAL(), coll, bevel=0.01)

    # --- per-need interior detail ---
    if key == "reclamation-core":
        # basement bulk reservoir cistern + greywater tanks + purple riser
        box(f"{key}.reservoir", (3.6, 1.1, 0.6), (0, y + 0.55, -1.9), WATERM(), coll, bevel=0.04)
        for n, x in enumerate((-1.4, 0.0, 1.4)):
            box(f"{key}.tank.{n}", (0.8, 1.15, 0.8), (x, y + 0.6, -1.4),
                material("mat.tank", "1d4e6b", emission=0.5), coll, bevel=0.05)
    elif key == "power-ops-core":
        # ESS in a fire-rated room: cabinets (Array) + emissive faces
        ess = box(f"{key}.ess.cabinet", (0.5, 1.2, 0.7), (-1.7, y + 0.6, -1.5), METAL(), coll, bevel=0.02)
        arrayed(ess, 5, (0.62, 0, 0))
        face = box(f"{key}.ess.led", (0.42, 0.9, 0.04), (-1.7, y + 0.6, -1.12), acc, coll)
        arrayed(face, 5, (0.62, 0, 0))
    elif key in ("vertical-farm", "aquaponics-bay"):
        # tiered grow racks (Array up) glowing green
        for t, gy in enumerate((0.45, 0.9, 1.3)):
            rack = box(f"{key}.rack.{t}", (1.2, 0.06, 1.6), (-1.5, y + gy, -0.4),
                       material("mat.grow", "5ddc7a", emission=1.2), coll)
            arrayed(rack, 3, (1.5, 0, 0))
    elif key == "the-lung":
        # central biofilter column
        box(f"{key}.biofilter", (0.9, FLOOR_H * 0.92, 0.9), (0, cy, 0),
            material("mat.bio", "7fe7e0", emission=0.9, alpha=0.85), coll, bevel=0.06)
    elif key == "skydeck-reservoir":
        # rooftop: POOL ONLY + parapet railing + PV array (above this floor)
        ry = y + FLOOR_H
        box(f"{key}.pool.coping", (3.0, 0.18, 3.0), (1.6, ry + 0.09, -1.0), METAL(), coll, bevel=0.03)
        box(f"{key}.pool.surface", (2.7, 0.06, 2.7), (1.6, ry + 0.2, -1.0), WATERM(), coll)
        # PV array
        pv = box(f"{key}.pv.panel", (1.6, 0.05, 0.9), (-2.6, ry + 0.35, -1.6), PV(), coll)
        pv.rotation_euler = (math.radians(-18), 0, 0)
        arrayed(pv, 3, (0.0, 0, 1.5))
        # parapet posts
        post = box(f"{key}.parapet.post", (0.06, 0.5, 0.06), (-HALF_W + 0.2, ry + 0.25, -HALF_D + 0.2), METAL(), coll)
        arrayed(post, 12, (0.85, 0, 0))


def build_cores(n_floors):
    coll = new_collection("sys.vertical-transport")
    h = n_floors * STEP
    cy = h / 2.0
    # three elevator shafts (A, B, firefighter) — glass with metal rails
    for name, z in (("a", CORE_Z), ("b", CORE_Z2), ("ff", CORE_Z3)):
        box(f"elevator.{name}.shaft", (1.0, h, 1.0), (CORE_X, cy, z), GLASS(), coll, bevel=0.02)
        box(f"elevator.{name}.rail", (0.08, h, 0.08), (CORE_X, cy, z), METAL(), coll)
        # a parked car
        box(f"elevator.{name}.car", (0.8, CAR := FLOOR_H * 0.86, 0.8),
            (CORE_X, (n_floors // 2) * STEP + CAR / 2, z),
            material(f"mat.car.{name}", "ffcf4d" if name != "ff" else "ff5d5d", emission=0.5), coll, bevel=0.03)
    # two pressurized exit stairs on the -x side
    for name, z in (("1", -1.6), ("2", 1.6)):
        box(f"stair.{name}.shaft", (1.4, h, 1.2), (STAIR_X, cy, z), CONCRETE(), coll, bevel=0.02)
        # switchback flights hint (Array up)
        fl = box(f"stair.{name}.flight", (1.2, 0.08, 0.5), (STAIR_X, 0.2, z - 0.3), METAL(), coll)
        arrayed(fl, max(4, n_floors), (0, STEP / 2, 0))


def build_context(n_floors):
    coll = new_collection("env")
    box("env.podium", (HALF_W * 2 + 3, 0.5, HALF_D * 2 + 3), (0, -SLAB_T - 0.25, 0), DARK(), coll, bevel=0.1)
    box("env.ground", (40, 0.1, 40), (0, -SLAB_T - 0.55, 0),
        material("mat.ground", "101a24", roughness=1.0), coll)


def optimize_and_export():
    # join nothing (keep names), but clean each mesh: recalc + merge doubles
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.select_set(True)
    # export (applies modifiers, +Y up). No Draco -> no decoder needed; geometry
    # is already low-poly so the .glb stays small.
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    kwargs = dict(
        filepath=os.path.abspath(OUT),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        use_selection=False,
        export_cameras=False,
        export_lights=False,
    )
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except TypeError:
        # older/newer signatures — fall back to the minimal stable set
        bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB")


def main():
    clear_scene()
    for i, (key, need) in enumerate(FLOORS):
        coll = new_collection(key)
        build_floor(i, key, need, coll)
    build_cores(len(FLOORS))
    build_context(len(FLOORS))

    tris = sum(
        sum(len(p.vertices) - 2 for p in o.data.polygons)
        for o in bpy.data.objects if o.type == "MESH"
    )
    print(f"[atlas] objects={len([o for o in bpy.data.objects if o.type=='MESH'])} "
          f"source-tris≈{tris} (pre-modifier)")
    optimize_and_export()
    size = os.path.getsize(OUT) / 1024.0
    print(f"[atlas] wrote {OUT} ({size:.0f} KB)")


if __name__ == "__main__":
    main()
