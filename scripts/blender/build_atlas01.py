#!/usr/bin/env python3
"""
build_atlas01.py — ARCHITECTURAL hero tower for ATLAS-01
=========================================================

Curtain-wall frame, expressed structure, balcony/terrace bands, richer interior
detail, better context, and a stronger rooftop PV/pool plant — while staying
lightweight enough for the browser.

Run:
    pip install bpy
    python3 scripts/blender/build_atlas01.py
"""

import math
import os
import bpy

# --- layout ----------------------------------------------------------------
FLOOR_H = 1.5
SLAB_T = 0.16
STEP = FLOOR_H + SLAB_T
HALF_W = 5.0
HALF_D = 3.5
CORE_X = 3.4
CORE_Z = -1.9
CORE_Z2 = -0.1
CORE_Z3 = 1.7
STAIR_X = -3.5
FACADE_MULLIONS = [-4.35, -3.35, -2.35, -1.35, -0.35, 0.65, 1.65, 2.65, 3.65, 4.45]
SIDE_MULLIONS = [-2.65, -1.55, -0.45, 0.65, 1.75, 2.85]

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
LIGHT  = lambda: material("mat.light", "d0d4d8", roughness=0.7)
PURPLE = lambda: material("mat.purple.nonpotable", "9b5de5", emission=0.6)
WATERM = lambda: material("mat.water", "3aa0ff", emission=0.4, alpha=0.7)
PV = lambda: material("mat.pv", "1b2a4a", metallic=0.6, roughness=0.25)
BEACON = lambda: material("mat.beacon", "ff3333", emission=2.5)
FIN = lambda: material("mat.fin", "526370", metallic=0.65, roughness=0.3)
SPANDREL = lambda: material("mat.spandrel", "111c25", metallic=0.15, roughness=0.6)

def accent(need, strength=1.4):
    return material(f"mat.need.{need}", NEED_HEX[need], emission=strength)


# --- build -----------------------------------------------------------------
def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def build_floor(i, key, need, coll):
    y = i * STEP
    cy = y + FLOOR_H / 2.0
    acc = accent(need)

    # slab with bevel
    box(f"{key}.shell.slab", (HALF_W * 2 + 0.3, SLAB_T, HALF_D * 2 + 0.3),
        (0, y - SLAB_T / 2, 0), DARK(), coll, bevel=0.02)
    # floor-edge trim
    box(f"{key}.trim", (HALF_W * 2 + 0.2, 0.06, HALF_D * 2 + 0.2),
        (0, y + 0.02, 0), METAL(), coll, bevel=0.01)

    # back + side walls
    box(f"{key}.shell.back", (HALF_W * 2, FLOOR_H, 0.16),
        (0, cy, -HALF_D), CONCRETE(), coll, bevel=0.015)
    box(f"{key}.shell.left", (0.16, FLOOR_H, HALF_D * 2),
        (-HALF_W, cy, 0), CONCRETE(), coll, bevel=0.015)
    box(f"{key}.shell.right", (0.16, FLOOR_H, HALF_D * 2),
        (HALF_W, cy, 0), CONCRETE(), coll, bevel=0.015)

    # glazed front
    box(f"{key}.shell.front", (HALF_W * 2, FLOOR_H, 0.06),
        (0, cy, HALF_D), GLASS(), coll)

    # Emissive sill band (floor accent color)
    box(f"{key}.emissive.sill", (HALF_W * 2 - 0.2, 0.1, 0.05),
        (0, y + 0.12, HALF_D - 0.02), acc, coll)
    # Interior glow column
    box(f"{key}.emissive.core", (0.3, FLOOR_H * 0.7, 0.3),
        (-HALF_W + 1.2, cy, -HALF_D + 1.0), acc, coll)

    # ---- ARCHITECTURAL FACADE ENHANCEMENTS ----
    # Balcony slab (except rooftop level)
    if key != "skydeck-reservoir":
        box(f"{key}.balcony", (HALF_W * 2 - 0.6, 0.06, 0.5),
            (0, y + 0.04, HALF_D + 0.25), CONCRETE(), coll, bevel=0.01)
        # Balcony railing posts
        post = box(f"{key}.balc.post", (0.04, 0.20, 0.04),
                   (-HALF_W + 0.3, y + 0.2, HALF_D + 0.32), METAL(), coll)
        arrayed(post, 12, (0.78, 0, 0))
        # Balcony rail
        box(f"{key}.balc.rail", (HALF_W * 2 - 0.8, 0.02, 0.04),
            (0, y + 0.2, HALF_D + 0.32), METAL(), coll)

    # Spandrel panel between floors
    if i > 0:
        box(f"{key}.spandrel", (HALF_W * 2 - 0.4, 0.06, 0.12),
            (0, y, HALF_D - 0.06), SPANDREL(), coll, bevel=0.01)

    # Back and side curtain-wall reads so the tower has architecture from every orbit angle.
    box(f"{key}.rear.glass", (HALF_W * 2 - 0.8, FLOOR_H * 0.62, 0.04),
        (0, cy, -HALF_D - 0.10), GLASS(), coll)
    box(f"{key}.rear.spandrel", (HALF_W * 2 - 0.6, 0.18, 0.06),
        (0, y + 0.28, -HALF_D - 0.14), SPANDREL(), coll)
    for x in FACADE_MULLIONS:
        box(f"{key}.rear.mullion.{x}", (0.045, FLOOR_H * 0.82, 0.055),
            (x, cy, -HALF_D - 0.16), METAL(), coll)
    for side in (-1, 1):
        box(f"{key}.side.glass.{side}", (0.04, FLOOR_H * 0.62, HALF_D * 2 - 1.0),
            (side * (HALF_W + 0.1), cy, 0), GLASS(), coll)
        for z in SIDE_MULLIONS:
            box(f"{key}.side.mullion.{side}.{z}", (0.055, FLOOR_H * 0.78, 0.04),
                (side * (HALF_W + 0.14), cy, z), METAL(), coll)

    # Window mullions (front facade)
    mull = box(f"{key}.mullion", (0.07, FLOOR_H, 0.07),
               (-HALF_W + 0.5, cy, HALF_D - 0.02), METAL(), coll)
    arrayed(mull, 10, (1.0, 0, 0))

    # Horizontal window transoms
    for t in range(2):
        box(f"{key}.transom{t}", (HALF_W * 2 - 0.6, 0.04, 0.04),
            (0, y + 0.4 + t * 0.7, HALF_D - 0.02), METAL(), coll)

    # Occupied/green floors get a projecting terrace with planters, not just a flat face.
    if need in ("shelter", "air", "restoration") or key == "vertical-farm":
        width = HALF_W * 2 - (1.2 if need == "shelter" else 2.4)
        box(f"{key}.terrace.slab", (width, 0.08, 0.68),
            (0, y + 0.08, HALF_D + 0.34), CONCRETE(), coll, bevel=0.015)
        box(f"{key}.terrace.rail", (width - 0.24, 0.06, 0.04),
            (0, y + 0.46, HALF_D + 0.66), GLASS(), coll)
        for n, x in enumerate((-3.8, -1.3, 1.3, 3.8) if need == "shelter" else (-2.8, 0, 2.8)):
            box(f"{key}.terrace.planter.{n}", (0.62, 0.2, 0.24),
                (x, y + 0.22, HALF_D + 0.48), DARK(), coll, bevel=0.02)
            box(f"{key}.terrace.green.{n}", (0.48, 0.16, 0.18),
                (x, y + 0.40, HALF_D + 0.48),
                material("mat.terrace.green", "5ddc7a", emission=0.3), coll, bevel=0.03)

    # --- per-need interior detail ---
    if key == "reclamation-core":
        # Basement bulk reservoir + greywater tanks
        box(f"{key}.reservoir", (3.6, 1.1, 0.6), (0, y + 0.55, -1.9), WATERM(), coll, bevel=0.04)
        for n, x in enumerate((-1.4, 0.0, 1.4)):
            box(f"{key}.tank.{n}", (0.8, 1.15, 0.8), (x, y + 0.6, -1.4),
                material("mat.tank", "1d4e6b", emission=0.5), coll, bevel=0.05)
        # Pipe risers
        for p in range(4):
            box(f"{key}.riser.{p}", (0.08, 1.3, 0.08), (-3.0 + p * 2.0, y + 0.7, -2.5),
                PURPLE(), coll)
    elif key == "commons-clinic":
        # Treatment beds
        for b in range(2):
            box(f"{key}.bed.{b}", (0.7, 0.5, 0.4), (-1.2 + b * 2.4, y + 0.5, -2.0),
                LIGHT(), coll, bevel=0.03)
        box(f"{key}.screen", (0.04, 0.8, 0.6), (-0.3, y + 0.6, -1.2),
            material("mat.screen", "88ccff", alpha=0.4), coll)
    elif key == "power-ops-core":
        # ESS cabinets array
        ess = box(f"{key}.ess.cabinet", (0.5, 1.2, 0.7), (-1.7, y + 0.6, -1.5), METAL(), coll, bevel=0.02)
        arrayed(ess, 5, (0.62, 0, 0))
        box(f"{key}.ess.led", (0.42, 0.9, 0.04), (-1.7, y + 0.6, -1.12), acc, coll)
        arrayed(box(f"{key}.ess.led2", (0.42, 0.9, 0.04), (-1.7, y + 0.6, -1.12), acc, coll), 5, (0.62, 0, 0))
        # Transformer
        box(f"{key}.xfmr", (0.8, 0.8, 0.6), (0.5, y + 0.5, -2.2), DARK(), coll, bevel=0.04)
    elif key in ("vertical-farm", "aquaponics-bay"):
        # Tiered grow racks
        for t, gy in enumerate((0.45, 0.9, 1.3)):
            rack = box(f"{key}.rack.{t}", (1.2, 0.06, 1.6), (-1.5, y + gy, -0.4),
                       material("mat.grow", "5ddc7a", emission=1.2), coll)
            arrayed(rack, 3, (1.5, 0, 0))
        # Nutrient lines
        for n in range(3):
            box(f"{key}.nutr.{n}", (0.04, 0.04, 0.8), (-2.2 + n * 2.2, y + 0.8, 0.6),
                material("mat.nutr", "2d8a4e", emission=0.3), coll)
    elif key.startswith("residences"):
        # Residential units: beds + partitions
        for u in range(3):
            box(f"{key}.bed.{u}", (0.6, 0.5, 0.3), (-2.0 + u * 2.0, y + 0.45, -1.5),
                LIGHT(), coll, bevel=0.02)
            box(f"{key}.part.{u}", (0.04, 0.8, 1.6), (-1.35 + u * 2.0, y + 0.6, -0.5),
                material("mat.part", "a09080", roughness=0.8), coll)
        # Desk
        box(f"{key}.desk", (1.0, 0.04, 0.6), (0.0, y + 0.7, -2.5),
            material("mat.desk", "8a7a6a", roughness=0.7), coll)
    elif key == "the-lung":
        # Central biofilter column
        box(f"{key}.biofilter", (0.9, FLOOR_H * 0.92, 0.9), (0, cy, 0),
            material("mat.bio", "7fe7e0", emission=0.9, alpha=0.85), coll, bevel=0.06)
        # Scrubber units
        for s in range(2):
            box(f"{key}.scrub.{s}", (0.5, 0.7, 0.5), (-2.0 + s * 4.0, y + 0.6, 1.5),
                material("mat.scrub", "4a9e9a", emission=0.5, roughness=0.4), coll, bevel=0.03)
    elif key == "penthouses":
        # Larger residential units
        for u in range(2):
            box(f"{key}.bed.{u}", (0.8, 0.5, 0.4), (-1.2 + u * 2.4, y + 0.45, -1.8),
                LIGHT(), coll, bevel=0.03)
            box(f"{key}.cabinet.{u}", (0.5, 0.6, 0.5), (-1.2 + u * 2.4, y + 0.5, 0.5),
                material("mat.cab", "6a5a4a", roughness=0.6), coll, bevel=0.02)
    elif key == "skydeck-reservoir":
        # POOL + PV + parapet railing
        ry = y + FLOOR_H
        box(f"{key}.pool.coping", (3.0, 0.18, 3.0), (1.6, ry + 0.09, -1.0), METAL(), coll, bevel=0.03)
        box(f"{key}.pool.surface", (2.7, 0.06, 2.7), (1.6, ry + 0.2, -1.0), WATERM(), coll)
        # PV array
        pv = box(f"{key}.pv.panel", (1.6, 0.05, 0.9), (-2.6, ry + 0.35, -1.6), PV(), coll)
        pv.rotation_euler = (math.radians(-18), 0, 0)
        arrayed(pv, 3, (0.0, 0, 1.5))
        # Mechanical cabinet
        box(f"{key}.mech", (0.8, 0.6, 0.6), (2.5, ry + 0.35, 2.2), METAL(), coll, bevel=0.03)
        # Antenna
        box(f"{key}.antenna", (0.04, 0.8, 0.04), (-4.0, ry + 0.5, 2.5), METAL(), coll)
        # Parapet posts
        post = box(f"{key}.parapet.post", (0.06, 0.5, 0.06),
                   (-HALF_W + 0.2, ry + 0.25, -HALF_D + 0.2), METAL(), coll)
        arrayed(post, 12, (0.85, 0, 0))
        # Beacon
        box(f"{key}.beacon", (0.2, 0.1, 0.2), (0, ry + 0.65, -HALF_D + 0.3), BEACON(), coll)


def build_cores(n_floors):
    coll = new_collection("sys.vertical-transport")
    h = n_floors * STEP
    cy = h / 2.0

    for name, z in (("a", CORE_Z), ("b", CORE_Z2), ("ff", CORE_Z3)):
        box(f"elevator.{name}.shaft", (1.0, h, 1.0), (CORE_X, cy, z), GLASS(), coll, bevel=0.02)
        box(f"elevator.{name}.rail", (0.08, h, 0.08), (CORE_X, cy, z), METAL(), coll)
        car_h = FLOOR_H * 0.86
        box(f"elevator.{name}.car", (0.8, car_h, 0.8),
            (CORE_X, (n_floors // 2) * STEP + car_h / 2, z),
            material(f"mat.car.{name}", "ffcf4d" if name != "ff" else "ff5d5d", emission=0.5), coll, bevel=0.03)
        # Door openings at each floor
        for f in range(n_floors):
            dy = f * STEP + FLOOR_H * 0.5
            box(f"elevator.{name}.door.{f}", (0.5, 0.04, 0.4),
                (CORE_X, dy, z), DARK(), coll)
    # Stair towers
    for name, z in (("1", -1.6), ("2", 1.6)):
        box(f"stair.{name}.shaft", (1.4, h, 1.2), (STAIR_X, cy, z), CONCRETE(), coll, bevel=0.02)
        fl = box(f"stair.{name}.flight", (1.2, 0.08, 0.5), (STAIR_X, 0.2, z - 0.3), METAL(), coll)
        arrayed(fl, max(4, n_floors), (0, STEP / 2, 0))
        # Stair landing every 2 floors
        for f in range(0, n_floors, 2):
            box(f"stair.{name}.landing.{f}", (1.2, 0.06, 0.5),
                (STAIR_X, f * STEP + FLOOR_H * 0.8, z - 0.3), CONCRETE(), coll)


def build_architectural_exoskeleton(n_floors):
    coll = new_collection("sys.architectural-envelope")
    h = n_floors * STEP
    cy = h / 2.0

    # Expressed perimeter frame: columns + floor-level beams, readable from orbit.
    for x in (-HALF_W - 0.28, HALF_W + 0.28):
        for z in (-HALF_D - 0.28, HALF_D + 0.28):
            box(f"exo.column.{x}.{z}", (0.26, h + 0.7, 0.26), (x, cy, z),
                CONCRETE(), coll, bevel=0.025)

    for f in range(n_floors + 1):
        y = f * STEP + 0.02
        box(f"exo.front.beam.{f}", (HALF_W * 2 + 0.74, 0.10, 0.12),
            (0, y, HALF_D + 0.28), METAL(), coll, bevel=0.01)
        box(f"exo.back.beam.{f}", (HALF_W * 2 + 0.74, 0.10, 0.12),
            (0, y, -HALF_D - 0.28), METAL(), coll, bevel=0.01)
        box(f"exo.left.beam.{f}", (0.12, 0.10, HALF_D * 2 + 0.74),
            (-HALF_W - 0.28, y, 0), METAL(), coll, bevel=0.01)
        box(f"exo.right.beam.{f}", (0.12, 0.10, HALF_D * 2 + 0.74),
            (HALF_W + 0.28, y, 0), METAL(), coll, bevel=0.01)

    for n, x in enumerate((-3.9, -2.6, -1.3, 0.0, 1.3, 2.6, 3.9)):
        box(f"exo.solar.fin.{n}", (0.08, h * 0.82, 0.36),
            (x, cy, HALF_D + 0.50), FIN(), coll, bevel=0.012)

    brace_a = box("exo.diagonal.brace.a", (0.11, h * 0.74, 0.12),
                  (-2.8, h * 0.43, HALF_D + 0.62), METAL(), coll, bevel=0.015)
    brace_a.rotation_euler = (0, 0, math.radians(12))
    brace_b = box("exo.diagonal.brace.b", (0.11, h * 0.74, 0.12),
                  (2.8, h * 0.43, HALF_D + 0.62), METAL(), coll, bevel=0.015)
    brace_b.rotation_euler = (0, 0, math.radians(-12))


def build_context(n_floors):
    coll = new_collection("env")
    h = n_floors * STEP

    # Ground podium
    box("env.podium", (HALF_W * 2 + 4.5, 0.5, HALF_D * 2 + 4.4),
        (0, -SLAB_T - 0.25, 0), DARK(), coll, bevel=0.1)

    # Ground plane
    box("env.ground", (40, 0.1, 40), (0, -SLAB_T - 0.55, 0),
        material("mat.ground", "101a24", roughness=1.0), coll)

    # Entrance canopy
    box("env.canopy", (5.0, 0.10, 1.08), (0, -SLAB_T + 0.08, HALF_D + 0.92),
        METAL(), coll, bevel=0.03)
    box("env.canopy.glass", (4.6, 0.06, 1.0), (0, -SLAB_T + 0.68, HALF_D + 0.82),
        GLASS(), coll, bevel=0.02)
    # Canopy supports
    for s in (-1.5, 1.5):
        box(f"env.canopy.col.{s}", (0.06, 0.3, 0.06), (s, -SLAB_T - 0.3, HALF_D + 0.7),
            METAL(), coll)
    # Entrance path
    box("env.path", (2.0, 0.04, 2.5), (0, -SLAB_T - 0.25, HALF_D + 2.0),
        material("mat.path", "2a2a2a", roughness=0.9), coll)
    for n, x in enumerate((-8.3, -6.4, 6.4, 8.3)):
        box(f"env.bioswale.base.{n}", (1.0, 0.18, 5.2), (x, -SLAB_T - 0.08, 2.8),
            material("mat.bioswale.base", "14261d", roughness=0.8), coll, bevel=0.04)
        box(f"env.bioswale.green.{n}", (0.78, 0.16, 4.5), (x, -SLAB_T + 0.10, 2.8),
            material("mat.bioswale.green", "5ddc7a", emission=0.25), coll, bevel=0.04)
    # Path lights
    for p in (-1.0, 1.0):
        box(f"env.pathlight.{p}", (0.08, 0.3, 0.08), (p, -SLAB_T - 0.15, HALF_D + 2.8),
            METAL(), coll)
        box(f"env.pathlight.head.{p}", (0.15, 0.05, 0.15), (p, -SLAB_T - 0.05, HALF_D + 2.8),
            material("mat.plight", "ffeecc", emission=0.8), coll)
    # Trees / planting (simple cylinders)
    for tx, tz in [(-6, 3.5), (6, 3.5), (-6, -3.5), (6, -3.5)]:
        box(f"env.planter.{tx}.{tz}", (0.6, 0.3, 0.6), (tx, -SLAB_T - 0.1, tz),
            DARK(), coll, bevel=0.04)
        box(f"env.trunk.{tx}.{tz}", (0.08, 0.8, 0.08), (tx, -SLAB_T + 0.3, tz),
            material("mat.trunk", "3a2a1a", roughness=0.9), coll)
        box(f"env.crown.{tx}.{tz}", (0.6, 0.4, 0.6), (tx, -SLAB_T + 0.8, tz),
            material("mat.crown", "1a4a2a", roughness=0.8), coll)
    # Perimeter lights on building
    for p in range(4):
        box(f"env.perim.light.{p}", (0.05, 0.05, 0.3),
            (-HALF_W - 0.2 + p * 3.4, -SLAB_T + 0.05, -HALF_D - 0.2),
            material("mat.perim", "ffddaa", emission=0.6), coll)


def optimize_and_export():
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.select_set(True)
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
        bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB")


def main():
    clear_scene()
    for i, (key, need) in enumerate(FLOORS):
        coll = new_collection(key)
        build_floor(i, key, need, coll)
    build_architectural_exoskeleton(len(FLOORS))
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
