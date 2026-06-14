"""
build_atlas_floors.py — HEAVILY ENHANCED per-floor ATLAS-01 model + PBR GLB export
==================================================================================

Each floor module is now a dense, believable interior with:
  - 2-3× more equipment items per floor
  - richer PBR material palette (5-7 materials per floor)
  - interior floor finishes, ceiling detail, structural elements
  - emissive control panels, status lights, signage strips

Binding contract (council meeting 2026-06-12):
  FLOOR_KEY_MAP bridges the 12 data-model Floor.key values (seed-data.ts)
  to the 9 Blender builder functions below.  Multiple data-model floors
  can share one builder (e.g. all five shelter floors reuse f_shelter).
  The GLB export loop produces one file per FLOOR_KEY_MAP entry so the
  WebGL twin can index every floor by its canonical key.

Everything else (helpers, export, render) unchanged from the original.
Budget target: ~150-200 KB per floor, total well under 2.5 MB.
"""

import bpy
import math
import os
import subprocess
import sys

# --------------------------------------------------------------------------- #
# CONFIG
# --------------------------------------------------------------------------- #
FLOOR_CLEAR = 3.2
SLAB_T = 0.30
HALF_W = 8.0
HALF_D = 5.5
STEP = FLOOR_CLEAR + SLAB_T

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.normpath(os.path.join(HERE, "..", "public", "models"))
RENDERS_DIR = os.path.join(HERE, "renders")
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(RENDERS_DIR, exist_ok=True)

FLOORS = [
    ("basement",    "Reclamation Core", (0.45, 0.40, 0.55)),
    ("water",       "Water & Waste",    (0.18, 0.55, 1.00)),
    ("energy",      "Energy",           (1.00, 0.78, 0.20)),
    ("food",        "Food",             (0.32, 0.84, 0.42)),
    ("shelter",     "Shelter",          (1.00, 0.62, 0.42)),
    ("air",         "Air / Lung",       (0.40, 0.90, 0.86)),
    ("health",      "Health",           (1.00, 0.32, 0.32)),
    ("restoration", "Restoration",      (0.70, 0.58, 1.00)),
    ("rooftop",     "Rooftop",          (0.30, 0.66, 1.00)),
]

# Binding contract: maps each data-model Floor.key to a Blender module builder key.
# Multiple data-model floors can share one builder (e.g., residences-a/b/c/d all use "shelter").
# The GLB export creates one file per Floor.key, reusing the builder geometry.
# Sync this with seed-data.ts and models.ts.
FLOOR_KEY_MAP = {
    "reclamation-core": "basement",
    "commons-clinic":   "health",
    "power-ops-core":   "energy",
    "aquaponics-bay":   "food",
    "vertical-farm":    "food",
    "residences-a":     "shelter",
    "residences-b":     "shelter",
    "residences-c":     "shelter",
    "residences-d":     "shelter",
    "the-lung":         "air",
    "penthouses":       "shelter",
    "skydeck-reservoir":"restoration",
    # Legacy keys — no direct data-model equivalent, kept for procedural-twin compatibility
    "basement":         "basement",
    "rooftop":          "rooftop",
}

# Archive: the original FLOORS tuple keys still drive the per-builder functions.
# FLOOR_KEY_MAP is the canonical bridge to the data model.

WALL = (0.05, 0.07, 0.10, 1.0)
SLABC = (0.10, 0.12, 0.15, 1.0)
FLOOR_C = (0.12, 0.14, 0.18, 1.0)

_mats = {}


# --------------------------------------------------------------------------- #
# Scene / helpers
# --------------------------------------------------------------------------- #
def fresh_scene():
    name = "ATLAS_Floors"
    if bpy.data.filepath == "" and "Camera" in bpy.data.objects:
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        sc = bpy.context.scene
        sc.name = name
    else:
        sc = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    bpy.context.window.scene = sc
    return sc


SCENE = fresh_scene()


def collection(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        SCENE.collection.children.link(c)
    return c


def mat(name, rgba, rough=0.5, metal=0.0, emit=None, emit_str=0.0, alpha=1.0,
        bump=None, rough_var=False):
    key = (name, tuple(rgba), rough, metal, emit, emit_str, alpha, bump, rough_var)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = rgba
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

    # Procedural roughness variation via noise
    if rough_var:
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = 12.0
        tex.inputs["Detail"].default_value = 3.0
        mp = nt.nodes.new("ShaderNodeMapRange")
        mp.inputs["From Min"].default_value = 0.0
        mp.inputs["From Max"].default_value = 1.0
        mp.inputs["To Min"].default_value = max(0.0, rough - 0.25)
        mp.inputs["To Max"].default_value = min(1.0, rough + 0.25)
        nt.links.new(tex.outputs["Fac"], mp.inputs["Value"])
        nt.links.new(mp.outputs["Result"], b.inputs["Roughness"])
    else:
        b.inputs["Roughness"].default_value = rough

    # Procedural bump via noise
    if bump is not None and bump > 0:
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = 8.0
        tex.inputs["Detail"].default_value = 4.0
        bump_n = nt.nodes.new("ShaderNodeBump")
        bump_n.inputs["Strength"].default_value = bump
        nt.links.new(tex.outputs["Fac"], bump_n.inputs["Height"])
        nt.links.new(bump_n.outputs["Normal"], b.inputs["Normal"])

    _mats[key] = m
    return m


def box(col, name, loc, size, material):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    for c in list(o.users_collection):
        c.objects.unlink(o)
    col.objects.link(o)
    if material:
        o.data.materials.append(material)
    return o


def cyl(col, name, loc, r, h, material, verts=20, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc)
    o = bpy.context.active_object
    o.name = name
    if rot:
        o.rotation_euler = rot
    for c in list(o.users_collection):
        c.objects.unlink(o)
    col.objects.link(o)
    if material:
        o.data.materials.append(material)
    return o


def shell(col, key, accent, cutaway=True, floorless=False):
    m_slab = mat("ATLAS_Slab", SLABC, rough=0.6, bump=0.08, rough_var=True)
    m_wall = mat("ATLAS_Wall", WALL, rough=0.75, bump=0.06, rough_var=True)
    m_steel = mat("ATLAS_Steel", (0.16, 0.20, 0.25, 1.0), rough=0.35, metal=0.85, bump=0.02, rough_var=True)
    acc = mat(f"Accent_{key}", (*accent, 1.0), rough=0.4, emit=accent, emit_str=1.2, bump=0.01)
    m_floor = mat(f"Floor_{key}", FLOOR_C, rough=0.85, bump=0.04, rough_var=True)

    if not floorless:
        box(col, f"Slab_{key}", (0, 0, -SLAB_T / 2),
            (HALF_W * 2 + 0.3, HALF_D * 2 + 0.3, SLAB_T), m_slab)
    # Interior floor surface
    box(col, f"IntFloor_{key}", (0, 0, 0.02),
        (HALF_W * 2 - 0.8, HALF_D * 2 - 0.8, 0.04), m_floor)

    # Accent reveal at slab edge
    box(col, f"Reveal_{key}", (0, HALF_D, 0.06),
        (HALF_W * 2 + 0.32, 0.12, 0.14), acc)

    cy = FLOOR_CLEAR / 2
    box(col, f"WallBack_{key}", (0, -HALF_D, cy), (HALF_W * 2, 0.16, FLOOR_CLEAR), m_wall)
    box(col, f"WallL_{key}", (-HALF_W, 0, cy), (0.16, HALF_D * 2, FLOOR_CLEAR), m_wall)
    box(col, f"WallR_{key}", (HALF_W, 0, cy), (0.16, HALF_D * 2, FLOOR_CLEAR), m_wall)

    # Wall base trim
    trim = mat(f"Trim_{key}", (0.08, 0.10, 0.13, 1.0), rough=0.5, metal=0.3, bump=0.02)
    box(col, f"BaseTrimBack_{key}", (0, -HALF_D + 0.08, 0.08),
        (HALF_W * 2 - 0.4, 0.02, 0.08), trim)
    box(col, f"BaseTrimL_{key}", (-HALF_W + 0.08, 0, 0.08),
        (0.02, HALF_D * 2 - 0.8, 0.08), trim)
    box(col, f"BaseTrimR_{key}", (HALF_W - 0.08, 0, 0.08),
        (0.02, HALF_D * 2 - 0.8, 0.08), trim)

    # Ceiling grid T-bar outline
    grid = mat(f"CeilGrid_{key}", (0.06, 0.08, 0.11, 1.0), rough=0.6, metal=0.2, bump=0.015)
    box(col, f"CGridX1_{key}", (0, 0, FLOOR_CLEAR - 0.01),
        (HALF_W * 2 - 1.0, 0.04, 0.02), grid)
    box(col, f"CGridX2_{key}", (-3.5, 0, FLOOR_CLEAR - 0.01),
        (0.04, HALF_D * 2 - 1.0, 0.02), grid)
    box(col, f"CGridX3_{key}", (3.5, 0, FLOOR_CLEAR - 0.01),
        (0.04, HALF_D * 2 - 1.0, 0.02), grid)
    box(col, f"CGridY1_{key}", (0, -3.0, FLOOR_CLEAR - 0.01),
        (HALF_W * 2 - 1.0, 0.04, 0.02), grid)
    box(col, f"CGridY2_{key}", (0, 3.0, FLOOR_CLEAR - 0.01),
        (HALF_W * 2 - 1.0, 0.04, 0.02), grid)

    # Steel corner posts
    for sx in (-1, 1):
        box(col, f"Post_{key}_{sx}", (sx * (HALF_W - 0.2), -HALF_D + 0.3, cy),
            (0.4, 0.4, FLOOR_CLEAR), m_steel)

    # Ceiling light strip — emissive with subtle bump
    box(col, f"LightStrip_{key}", (0, 0, FLOOR_CLEAR - 0.12),
        (HALF_W * 1.4, 0.5, 0.06), mat(f"Strip_{key}", (1, 1, 1, 1), emit=(1, 0.96, 0.9), emit_str=3.0, bump=0.005))


# --------------------------------------------------------------------------- #
# Per-floor interiors — HEAVILY ENHANCED
# --------------------------------------------------------------------------- #
def f_basement(col, acc):
    steel = mat("b_steel", (0.30, 0.34, 0.40, 1.0), rough=0.3, metal=0.9, bump=0.015, rough_var=True)
    water = mat("b_water", (0.10, 0.30, 0.45, 1.0), rough=0.15, alpha=0.85, bump=0.005)
    pipe = mat("b_pipe", (*acc, 1.0), rough=0.4, metal=0.5, emit=acc, emit_str=0.4, bump=0.01)
    panel = mat("b_panel", (0.08, 0.12, 0.18, 1.0), rough=0.3, metal=0.6,
                emit=(0.0, 0.4, 0.6), emit_str=0.8, bump=0.02, rough_var=True)
    grating = mat("b_grate", (0.15, 0.18, 0.22, 1.0), rough=0.5, metal=0.7, bump=0.03)

    # Main reservoir
    cyl(col, "Reservoir", (-3.5, 0, 1.3), 2.2, 2.6, steel, verts=28)
    cyl(col, "ReservoirWater", (-3.5, 0, 1.2), 2.0, 2.2, water, verts=28)
    # Reservoir ladder
    box(col, "ResLadderL", (-5.4, 0.6, 1.3), (0.06, 0.06, 2.6), steel)
    box(col, "ResLadderR", (-5.4, -0.6, 1.3), (0.06, 0.06, 2.6), steel)
    for r in range(6):
        box(col, f"ResRung_{r}", (-5.4, 0, 0.3 + r * 0.45), (0.04, 1.2, 0.04), steel)
    # Digester
    cyl(col, "Digester", (3.0, -1.5, 1.4), 1.6, 2.8, steel, verts=24)
    box(col, "DigesterDome", (3.0, -1.5, 2.8), (3.0, 3.0, 0.08), steel)
    # Treatment skid
    box(col, "TreatSkid", (3.5, 2.2, 0.7), (3.0, 2.4, 1.4), steel)
    box(col, "TreatPanel", (3.5, 3.4, 1.4), (1.6, 0.06, 0.4), panel)
    # Control panel
    box(col, "ControlPanel", (-6.0, 4.0, 1.6), (1.2, 0.6, 1.2), panel)
    for s in range(4):
        box(col, f"CtlLED_{s}", (-6.3 + s * 0.5, 4.3, 2.1), (0.08, 0.02, 0.02),
            mat(f"b_led{s}", (0.0, 0.8, 0.2, 1) if s < 3 else (1, 0.2, 0.2, 1),
                emit=(0, 0.8, 0.2) if s < 3 else (1, 0.2, 0.2), emit_str=2.0))
    # Pipe manifold
    for k in range(4):
        cyl(col, f"Riser{k}", (-7 + k * 0.6, -HALF_D + 1.0, 1.5), 0.12, 3.0, pipe, verts=10)
    box(col, "ManifoldPipe", (0, -HALF_D + 1.0, 2.6), (12, 0.24, 0.24), pipe)
    for v in range(6):
        cyl(col, f"Valve{v}", (-5.5 + v * 2.0, -HALF_D + 0.8, 2.7), 0.2, 0.3, steel, verts=12,
            rot=(math.radians(90), 0, 0))
    # Floor sump / drain channels
    box(col, "Sump", (0, -2.5, 0.1), (0.6, 1.0, 0.2), steel)
    box(col, "SumpGrate", (0, -2.5, 0.15), (0.5, 0.9, 0.04), grating)
    for d in range(3):
        box(col, f"DrainChan{d}", (-4 + d * 4, 0, 0.03), (0.12, HALF_D * 2 - 2, 0.04), grating)
    # Catwalk
    box(col, "Catwalk", (-1.0, -4.0, 1.2), (5.0, 0.8, 0.06), grating)
    box(col, "CatwalkRungL", (-1.0, -4.0, 2.6), (0.06, 0.06, 1.4), steel)
    box(col, "CatwalkRungR", (3.0, -4.0, 2.6), (0.06, 0.06, 1.4), steel)
    # Wall pipes
    for p in range(4):
        box(col, f"WallPipe{p}", (-HALF_W + 0.3, -2 + p * 1.4, 2.0), (0.08, 0.08, 2.5), pipe)
    # Structural columns
    for sx, sy in [(-4, -2), (4, -2), (-4, 3), (4, 3)]:
        box(col, f"StructCol_{sx}_{sy}", (sx, sy, 1.6), (0.3, 0.3, 3.2), steel)
    # DHW recirc pump
    cyl(col, "CircPump", (5.5, -4.0, 0.4), 0.3, 0.8, steel, verts=14)


def f_water(col, acc):
    tank = mat("w_tank", (0.20, 0.40, 0.55, 1.0), rough=0.25, metal=0.6, bump=0.025, rough_var=True)
    purple = mat("w_purple", (0.55, 0.30, 0.75, 1.0), rough=0.4, emit=(0.55, 0.30, 0.75), emit_str=0.6, bump=0.01)
    blue = mat("w_blue", (*acc, 1.0), rough=0.4, emit=acc, emit_str=0.6, bump=0.01)
    pump = mat("w_pump", (0.22, 0.26, 0.30, 1.0), rough=0.3, metal=0.8, bump=0.015, rough_var=True)
    filter_m = mat("w_filter", (0.35, 0.40, 0.45, 1.0), rough=0.4, metal=0.6, bump=0.02)
    chems = mat("w_chems", (0.85, 0.20, 0.20, 1.0), rough=0.5, metal=0.2,
                emit=(0.85, 0.20, 0.20), emit_str=0.3, bump=0.01)
    panel = mat("w_panel", (0.08, 0.12, 0.18, 1.0), rough=0.3, metal=0.6,
                emit=(0.0, 0.4, 0.6), emit_str=0.8, bump=0.02, rough_var=True)

    # Water tanks
    for k in range(3):
        cyl(col, f"Tank{k}", (-5 + k * 3.2, -1.0, 1.4), 1.2, 2.6, tank, verts=24)
        box(col, f"TankBase{k}", (-5 + k * 3.2, -1.0, 0.1), (1.8, 1.8, 0.12), tank)
        box(col, f"TankLabel{k}", (-5 + k * 3.2, -1.0, 2.5), (0.6, 0.02, 0.2),
            mat(f"w_label{k}", (1, 1, 1, 1), emit=(1, 1, 1), emit_str=0.3))
    # Pump array
    for p in range(4):
        box(col, f"PumpUnit{p}", (3.0 + p * 0.8, 2.8, 0.6), (0.5, 0.7, 1.0), pump)
        cyl(col, f"PumpDish{p}", (3.25 + p * 0.8, 2.8, 0.9), 0.15, 0.1, pump, verts=14,
            rot=(math.radians(90), 0, 0))
    # Filtration skid
    box(col, "FilterSkid", (3.0, -3.0, 0.7), (4.0, 1.4, 1.2), filter_m)
    for f in range(3):
        cyl(col, f"FilterCan{f}", (2.0 + f * 1.0, -3.0, 1.2), 0.35, 0.8, filter_m, verts=18)
    # Chemical dosing
    for d in range(2):
        cyl(col, f"DoseTank{d}", (-6.5 + d * 1.2, 4.0, 0.8), 0.4, 1.4, chems, verts=16)
    # Pipe manifold
    box(col, "Manifold", (0, -HALF_D + 0.8, 2.2), (12, 0.16, 0.16), pump)
    for v in range(5):
        cyl(col, f"ManifoldValve{v}", (-4.8 + v * 2.4, -HALF_D + 0.7, 2.3), 0.2, 0.25, pump, verts=12,
            rot=(math.radians(90), 0, 0))
    # Control panel wall
    box(col, "ControlPanel", (-7.0, 2.0, 1.6), (0.6, 1.6, 1.2), panel)
    for s in range(6):
        box(col, f"CPLed{s}", (-7.0, 1.2 + s * 0.4, 2.2), (0.02, 0.08, 0.02),
            mat(f"w_cpled{s}", (0, 0.8, 0.2, 1), emit=(0, 0.8, 0.2), emit_str=1.5))
    # Floor drain grid
    for d in range(3):
        box(col, f"DrainCh{d}", (-4 + d * 4, 0, 0.03), (0.15, 9.0, 0.04),
            mat("w_grate", (0.15, 0.18, 0.22, 1), rough=0.5, metal=0.7, bump=0.03))
    # Riser columns
    box(col, "PurpleRiser", (HALF_W - 0.8, 0, 1.5), (0.2, HALF_D * 1.6, 0.2), purple)
    box(col, "BlueRiser", (HALF_W - 1.3, 0, 1.5), (0.2, HALF_D * 1.6, 0.2), blue)


def f_energy(col, acc):
    rack = mat("e_rack", (0.14, 0.16, 0.20, 1.0), rough=0.4, metal=0.7, bump=0.02, rough_var=True)
    cell = mat("e_cell", (*acc, 1.0), rough=0.5, emit=acc, emit_str=0.8, bump=0.01)
    inv = mat("e_inv", (0.18, 0.20, 0.24, 1.0), rough=0.3, metal=0.85, bump=0.015, rough_var=True)
    tray = mat("e_tray", (0.20, 0.22, 0.28, 1.0), rough=0.4, metal=0.6, bump=0.02)
    hv = mat("e_hv", (0.85, 0.15, 0.15, 1.0), rough=0.4,
             emit=(0.85, 0.15, 0.15), emit_str=0.5, bump=0.01)
    cool = mat("e_cool", (0.35, 0.40, 0.48, 1.0), rough=0.25, metal=0.7, bump=0.015, rough_var=True)

    # Battery racks — 2 rows of 4
    for r in range(2):
        for c in range(4):
            x = -5.5 + c * 3.2
            y = -2.2 + r * 4.0
            box(col, f"Battery_{r}_{c}", (x, y, 1.1), (2.4, 1.0, 2.0), rack)
            box(col, f"BattLED_{r}_{c}", (x, y + 0.52, 1.6), (2.0, 0.05, 0.8), cell)
    # Battery cable trench
    for tr in range(2):
        box(col, f"BattTrench{tr}", (-3.5 + tr * 9.0, 0, 0.03), (0.6, 8.0, 0.06),
            mat("e_trench", (0.08, 0.10, 0.14, 1), rough=0.8, bump=0.04, rough_var=True))
    # Inverter cabinets
    box(col, "Inverters", (6.2, -3.0, 1.0), (2.6, 1.4, 1.8), inv)
    box(col, "InvDisplay", (6.2, -2.3, 1.8), (1.2, 0.04, 0.3),
        mat("e_display", (0.1, 0.5, 0.8, 1), emit=(0.1, 0.5, 0.8), emit_str=1.0, bump=0.005))
    # HV switchgear
    box(col, "HVPanel", (-7.0, -4.0, 1.4), (0.8, 2.0, 2.6), hv)
    for s in range(3):
        box(col, f"HVLight{s}", (-7.0, -4.8 + s * 1.0, 2.6), (0.02, 0.1, 0.02),
            mat(f"e_hvled{s}", (1, 0.8, 0.2, 1), emit=(1, 0.8, 0.2), emit_str=2.0))
    # LV distribution panel
    box(col, "LVPanel", (-7.0, 4.2, 1.2), (0.6, 1.2, 2.2),
        mat("e_lv", (0.20, 0.24, 0.30, 1), rough=0.3, metal=0.6, bump=0.015, rough_var=True))
    # Cable trays overhead
    for ct in range(3):
        box(col, f"CableTray{ct}", (-4 + ct * 4, 0, 3.0), (0.3, 9.0, 0.06), tray)
    # Cooling unit
    box(col, "CoolingUnit", (5.5, 3.5, 1.6), (1.6, 1.2, 3.0), cool)
    box(col, "CoolVent", (5.5, 3.5, 3.0), (1.2, 0.8, 0.04), tray)
    # Transformer
    box(col, "Transformer", (6.8, 1.0, 1.0), (1.2, 1.2, 1.8),
        mat("e_xfmr", (0.25, 0.30, 0.35, 1), rough=0.4, metal=0.75, bump=0.02, rough_var=True))
    for b in range(3):
        box(col, f"BusBar{b}", (-4 + b * 4, 0, 1.8), (0.6, 0.04, 0.04),
            mat("e_bus", (0.6, 0.4, 0.1, 1), metal=0.95, rough=0.2, bump=0.01, rough_var=True))


def f_food(col, acc):
    frame = mat("f_frame", (0.20, 0.24, 0.22, 1.0), rough=0.5, metal=0.4, bump=0.01, rough_var=True)
    crop = mat("f_crop", (*acc, 1.0), rough=0.6, emit=acc, emit_str=0.7, bump=0.02, rough_var=True)
    grow = mat("f_grow", (1.0, 0.4, 0.7, 1.0), emit=(1.0, 0.3, 0.7), emit_str=2.2, bump=0.005)
    nutr = mat("f_nutr", (0.10, 0.50, 0.30, 1.0), rough=0.3, metal=0.2,
               emit=(0.10, 0.50, 0.30), emit_str=0.5, bump=0.01)
    irr = mat("f_irr", (0.22, 0.26, 0.30, 1.0), rough=0.4, metal=0.7, bump=0.015, rough_var=True)
    pack = mat("f_pack", (0.50, 0.45, 0.40, 1.0), rough=0.7, bump=0.03)
    panel = mat("f_panel", (0.08, 0.12, 0.18, 1.0), rough=0.3, metal=0.6,
                emit=(0.1, 0.4, 0.2), emit_str=0.6, bump=0.02, rough_var=True)

    # Grow bays — 4 bays, 4 levels each
    for bay in range(4):
        x = -6.0 + bay * 4.0
        for lvl in range(4):
            z = 0.5 + lvl * 0.65
            box(col, f"Tray_{bay}_{lvl}", (x, 0, z), (3.0, 5.0, 0.12), frame)
            box(col, f"Crop_{bay}_{lvl}", (x, 0, z + 0.12), (2.8, 4.6, 0.14), crop)
            box(col, f"Grow_{bay}_{lvl}", (x, 0, z + 0.42), (2.6, 0.18, 0.06), grow)
    # Irrigation manifold
    box(col, "IrrManifold", (0, -HALF_D + 0.8, 2.4), (14, 0.12, 0.12), irr)
    for i in range(7):
        box(col, f"IrrLine{i}", (-6 + i * 2, -HALF_D + 0.8, 2.0), (0.04, 0.04, 0.8), irr)
    # Nutrient tanks
    for n in range(3):
        cyl(col, f"NutrTank{n}", (6.5, -2 + n * 1.8, 1.0), 0.5, 1.8, nutr, verts=18)
    # Control panel
    box(col, "EnvControl", (6.5, 3.2, 1.6), (0.8, 1.2, 1.2), panel)
    for d in range(4):
        box(col, f"EnvLED{d}", (6.5, 2.6 + d * 0.3, 2.2), (0.02, 0.06, 0.02),
            mat(f"f_envled{d}", (0, 0.8, 0.2, 1), emit=(0, 0.8, 0.2), emit_str=1.2))
    # Packing station
    box(col, "PackingTable", (6.5, -4.5, 0.5), (1.4, 0.8, 0.8), pack)
    box(col, "PackingTop", (6.5, -4.5, 0.9), (1.4, 0.8, 0.04), pack)
    # Climate unit
    box(col, "ClimateUnit", (-7.5, 0, 1.8), (0.6, 2.0, 1.2),
        mat("f_climate", (0.30, 0.35, 0.40, 1), rough=0.4, metal=0.6, bump=0.02, rough_var=True))
    box(col, "ClimateVent", (-7.5, 0, 2.8), (0.4, 1.6, 0.04),
            mat("f_vent", (0.15, 0.18, 0.22, 1), rough=0.5, metal=0.7, bump=0.015))
    # Walkway strips between bays
    for w in range(3):
        box(col, f"Walkway{w}", (-4 + w * 4, 0, 0.03),
            (0.6, 5.0, 0.04), mat("f_walk", (0.25, 0.28, 0.30, 1), rough=0.8, bump=0.03, rough_var=True))
    # Ceiling irrigation drops
    for d in range(6):
        box(col, f"IrrDrop{d}", (-4.5 + d * 1.8, -1.5 + (d % 2) * 3, 2.4),
            (0.03, 0.03, 0.6), irr)


def f_shelter(col, acc):
    part = mat("s_part", (0.70, 0.66, 0.60, 1.0), rough=0.8, bump=0.04, rough_var=True)
    bed = mat("s_bed", (*acc, 1.0), rough=0.7, emit=acc, emit_str=0.3, bump=0.03, rough_var=True)
    floor_m = mat("s_floor", (0.30, 0.26, 0.22, 1.0), rough=0.9, bump=0.06, rough_var=True)
    wood = mat("s_wood", (0.45, 0.35, 0.25, 1.0), rough=0.85, bump=0.05, rough_var=True)
    soft = mat("s_soft", (0.55, 0.50, 0.45, 1.0), rough=0.9, bump=0.02)
    storage = mat("s_store", (0.20, 0.24, 0.28, 1.0), rough=0.5, metal=0.4, bump=0.02, rough_var=True)
    light_m = mat("s_light", (1, 0.95, 0.85, 1), emit=(1, 0.9, 0.8), emit_str=1.5, bump=0.005)

    box(col, "UnitFloor", (0, 0, 0.05), (HALF_W * 2 - 1, HALF_D * 2 - 1, 0.06), floor_m)
    # 6 residential units
    for u in range(6):
        x = -6.0 + u * 2.5
        box(col, f"Partition_{u}", (x - 1.25, 0, 1.2), (0.08, HALF_D * 1.6, 2.4), part)
        # Bed
        box(col, f"Bed_{u}", (x, -2.2, 0.45), (1.6, 1.0, 0.5), bed)
        box(col, f"Pillow_{u}", (x - 0.5, -2.2, 0.7), (0.4, 0.5, 0.15), soft)
        # Desk
        box(col, f"Desk_{u}", (x, 2.5, 0.7), (1.4, 0.6, 0.06), wood)
        box(col, f"Chair_{u}", (x, 2.0, 0.45), (0.5, 0.5, 0.5), soft)
        # Storage
        box(col, f"Locker_{u}", (x, -3.8, 0.8), (0.6, 0.5, 1.5), storage)
        # Overhead light
        box(col, f"UnitLight_{u}", (x, 0, 3.15), (0.3, 0.3, 0.02), light_m)
    # End partition
    box(col, "PartitionEnd", (6.75, 0, 1.2), (0.08, HALF_D * 1.6, 2.4), part)
    # Common corridor carpet
    box(col, "Corridor", (0, -0.2, 0.07), (1.2, 10.0, 0.02),
        mat("s_carpet", (0.18, 0.14, 0.12, 1), rough=1.0, bump=0.04, rough_var=True))
    # Common table
    box(col, "CommonTable", (-0.5, -4.5, 0.55), (1.6, 1.0, 0.06), wood)
    box(col, "CommonTableLeg1", (-1.0, -5.0, 0.3), (0.06, 0.06, 0.5), wood)
    box(col, "CommonTableLeg2", (-1.0, -4.0, 0.3), (0.06, 0.06, 0.5), wood)
    box(col, "CommonTableLeg3", (0.0, -5.0, 0.3), (0.06, 0.06, 0.5), wood)
    box(col, "CommonTableLeg4", (0.0, -4.0, 0.3), (0.06, 0.06, 0.5), wood)
    # Kitchenette
    box(col, "KitchenCounter", (6.0, 3.5, 0.6), (2.0, 0.6, 1.0), wood)
    box(col, "KitchenSink", (6.0, 3.5, 1.0), (0.8, 0.5, 0.06),
        mat("s_sink", (0.35, 0.40, 0.45, 1), metal=0.9, rough=0.2, bump=0.01, rough_var=True))
    box(col, "KitchenCabinet", (5.5, 3.5, 1.6), (1.0, 0.6, 0.6), storage)
    # Notice board
    box(col, "NoticeBoard", (-6.5, 4.5, 1.6), (0.6, 0.06, 0.4),
        mat("s_notice", (0.15, 0.25, 0.15, 1), rough=0.7))


def f_air(col, acc):
    duct = mat("a_duct", (0.55, 0.60, 0.65, 1.0), rough=0.3, metal=0.8, bump=0.02, rough_var=True)
    glow = mat("a_glow", (*acc, 1.0), rough=0.2, emit=acc, emit_str=1.4, alpha=0.5, bump=0.005)
    hepa = mat("a_hepa", (0.30, 0.35, 0.42, 1.0), rough=0.4, metal=0.6, bump=0.02, rough_var=True)
    scrub = mat("a_scrub", (0.10, 0.40, 0.45, 1.0), rough=0.3, metal=0.3,
                emit=(0.10, 0.40, 0.45), emit_str=0.6, bump=0.015)
    panel = mat("a_panel", (0.08, 0.12, 0.18, 1.0), rough=0.3, metal=0.6,
                emit=(0.2, 0.6, 0.6), emit_str=0.8, bump=0.02, rough_var=True)
    fan_m = mat("a_fan", (0.18, 0.22, 0.26, 1.0), rough=0.3, metal=0.8, bump=0.015, rough_var=True)

    # Central lung column
    cyl(col, "LungCore", (0, 0, FLOOR_CLEAR / 2), 1.6, FLOOR_CLEAR, glow, verts=28)
    # Lung base ring
    cyl(col, "LungBase", (0, 0, 0.1), 1.8, 0.15, duct, verts=28)
    # Radial ducts from lung
    for a in range(6):
        ang = a * math.pi / 3
        x, y = math.cos(ang) * 4.5, math.sin(ang) * 3.0
        cyl(col, f"Duct_{a}", (x, y, 2.6), 0.35, 5.0, duct, verts=12,
            rot=(0, math.radians(90), ang))
    # Fan array wall
    for k in range(4):
        cyl(col, f"Fan_{k}", (-5.5 + k * 3.6, -HALF_D + 0.8, 2.6), 0.7, 0.4, fan_m, verts=20,
            rot=(math.radians(90), 0, 0))
        box(col, f"FanGuard{k}", (-5.5 + k * 3.6, -HALF_D + 0.8, 2.4), (0.04, 1.4, 1.4),
            mat("a_guard", (0.15, 0.18, 0.22, 1), rough=0.5, metal=0.7, bump=0.02))
    # Scrubber units
    for s in range(3):
        cyl(col, f"Scrubber{s}", (-5 + s * 5, 3.5, 1.8), 0.8, 3.2, scrub, verts=22)
        box(col, f"ScrubInlet{s}", (-5 + s * 5, 4.3, 2.2), (0.4, 0.4, 0.08), duct)
    # HEPA housings
    for h in range(3):
        box(col, f"HEPA_{h}", (3.5, -3.0 + h * 2.5, 1.6), (1.2, 0.8, 0.8), hepa)
        box(col, f"HEPAFlange{h}", (4.1, -3.0 + h * 2.5, 1.6), (0.06, 1.0, 1.0), hepa)
    # Ceiling duct grid
    for g in range(4):
        box(col, f"CnDuct{g}", (-4 + g * 2.6, 0, 3.0), (0.15, 0.15, 0.3), duct)
    # Air handler
    box(col, "AirHandler", (6.5, -1.0, 1.8), (1.6, 3.0, 1.6),
        mat("a_handler", (0.25, 0.30, 0.35, 1), metal=0.5, rough=0.4, bump=0.02, rough_var=True))
    box(col, "AHUVent", (6.5, 0.5, 2.8), (1.2, 0.8, 0.04),
            mat("a_vent", (0.15, 0.18, 0.22, 1), rough=0.5, metal=0.7, bump=0.015))
    # CO2 monitor panel
    box(col, "CO2Panel", (7.0, 4.5, 1.6), (0.4, 0.6, 0.4), panel)
    for c in range(3):
        box(col, f"CO2Led{c}", (7.0, 4.2 + c * 0.3, 1.9), (0.02, 0.06, 0.02),
            mat(f"a_co2{c}", (0, 0.8, 0.2, 1) if c < 2 else (1, 0.2, 0.2, 1),
                emit=(0, 0.8, 0.2) if c < 2 else (1, 0.2, 0.2), emit_str=1.5))


def f_health(col, acc):
    soft = mat("h_soft", (0.85, 0.86, 0.88, 1.0), rough=0.85, bump=0.03, rough_var=True)
    accm = mat("h_acc", (*acc, 1.0), rough=0.6, emit=acc, emit_str=0.4, bump=0.01)
    pod = mat("h_pod", (0.20, 0.40, 0.45, 1.0), rough=0.3, metal=0.4, bump=0.02, rough_var=True)
    steel = mat("h_steel", (0.25, 0.28, 0.32, 1.0), rough=0.3, metal=0.8, bump=0.015, rough_var=True)
    blue = mat("h_blue", (0.35, 0.55, 0.70, 1.0), rough=0.3, metal=0.3,
               emit=(0.2, 0.4, 0.6), emit_str=0.5, bump=0.01)
    panel = mat("h_panel", (0.08, 0.12, 0.18, 1.0), rough=0.3, metal=0.6,
                emit=(0.0, 0.4, 0.6), emit_str=0.8, bump=0.02, rough_var=True)
    curtain = mat("h_curtain", (0.55, 0.60, 0.65, 1.0), rough=0.8, alpha=0.3, bump=0.005)

    box(col, "CommonsFloor", (0, 0, 0.05), (HALF_W * 2 - 1, HALF_D * 2 - 1, 0.06), soft)
    # Treatment beds
    for b in range(4):
        x = -5.5 + b * 3.2
        box(col, f"Bed_{b}", (x, -2.4, 0.45), (2.2, 1.1, 0.5), soft)
        box(col, f"BedPad_{b}", (x, -2.4, 0.55), (1.8, 0.9, 0.15),
            mat(f"h_sheet{b}", (1, 1, 1, 1), rough=0.9))
        box(col, f"Monitor_{b}", (x + 0.9, -3.2, 1.4), (0.7, 0.1, 0.5), accm)
        # IV stand
        box(col, f"IVStand_{b}", (x + 1.0, -1.7, 1.6), (0.04, 0.04, 1.2), steel)
        box(col, f"IVBag_{b}", (x + 1.0, -1.7, 2.2), (0.2, 0.1, 0.2),
            mat(f"h_iv{b}", (0.85, 0.90, 0.95, 1), alpha=0.6))
    # Privacy curtain tracks (ceiling mounted)
    for c in range(4):
        box(col, f"CurtainTrk{c}", (-5.5 + c * 3.2, -2.4, 3.1), (3.0, 0.04, 0.04), steel)
        box(col, f"Curtain{c}", (-5.5 + c * 3.2, -2.4, 1.8), (2.8, 0.02, 2.6), curtain)
    # Telehealth pods
    for p in range(3):
        cyl(col, f"TelehealthPod_{p}", (-3.5 + p * 3.5, 2.6, 1.2), 1.1, 2.4, pod, verts=22)
        box(col, f"PodScreen_{p}", (-3.5 + p * 3.5, 3.7, 1.8), (0.8, 0.05, 0.6),
            mat(f"h_screen{p}", (0.1, 0.3, 0.6, 1), emit=(0.1, 0.3, 0.6), emit_str=1.2))
    # Nurse station
    box(col, "NurseStation", (-6.0, 4.5, 0.7), (2.0, 1.2, 1.2), blue)
    box(col, "NurseCounter", (-6.0, 4.5, 1.3), (2.0, 1.2, 0.04), steel)
    box(col, "NurseScreen", (-7.0, 4.5, 1.8), (0.04, 0.8, 0.5), panel)
    # Medicine cabinet
    box(col, "MedCabinet", (6.0, 4.0, 1.2), (1.2, 0.5, 1.6), steel)
    box(col, "MedDoor", (6.0, 4.3, 1.4), (0.8, 0.04, 1.0),
        mat("h_meddoor", (0.85, 0.90, 0.95, 1), metal=0.6, rough=0.2, bump=0.01, rough_var=True))
    # Wash station
    box(col, "WashStation", (6.5, -3.5, 0.8), (1.2, 1.2, 0.8), steel)
    cyl(col, "WashBasin", (6.5, -3.5, 1.2), 0.4, 0.1, steel, verts=18)
    # Clean utility
    box(col, "CleanUtility", (6.0, -5.0, 1.0), (1.8, 0.8, 1.8),
        mat("h_clean", (0.55, 0.70, 0.75, 1), rough=0.3, metal=0.3, bump=0.015, rough_var=True))
    # Access WC
    box(col, "AccessWC", (6.0, 3.0, 0.8), (3.0, 3.0, 1.6),
        mat("h_wc", (0.5, 0.55, 0.6, 1), rough=0.5))
    box(col, "WCDoor", (6.0, 1.5, 1.2), (2.4, 0.06, 2.0),
        mat("h_wcdoor", (0.70, 0.75, 0.80, 1), rough=0.5))
    # Ceiling examination light
    box(col, "ExamLight", (0, 0, 3.05), (0.3, 0.3, 0.05),
        mat("h_exam", (1, 0.95, 0.9, 1), emit=(1, 0.95, 0.9), emit_str=4.0))


def f_restoration(col, acc):
    waterm = mat("r_water", (0.20, 0.55, 0.70, 1.0), rough=0.05, metal=0.0, alpha=0.7,
                 emit=(0.1, 0.4, 0.6), emit_str=0.3, bump=0.01)
    deck = mat("r_deck", (0.45, 0.38, 0.30, 1.0), rough=0.85, bump=0.06, rough_var=True)
    plant = mat("r_plant", (*acc, 1.0), rough=0.7, emit=acc, emit_str=0.4, bump=0.03, rough_var=True)
    stone = mat("r_stone", (0.35, 0.32, 0.28, 1.0), rough=0.8, bump=0.08, rough_var=True)
    light_m = mat("r_light", (1, 0.95, 0.85, 1), emit=(1, 0.9, 0.8), emit_str=2.0, bump=0.005)
    cushion = mat("r_cushion", (0.65, 0.55, 0.45, 1.0), rough=0.9, bump=0.03, rough_var=True)
    foliage = mat("r_foliage", (0.20, 0.55, 0.25, 1.0), rough=0.8, bump=0.05, rough_var=True)

    box(col, "Deck", (0, 0, 0.05), (HALF_W * 2 - 1, HALF_D * 2 - 1, 0.06), deck)
    # Pool
    box(col, "Pool", (-2.0, 0, 0.35), (7.0, 6.0, 0.6),
        mat("r_pooledge", (0.30, 0.34, 0.38, 1), rough=0.4, metal=0.5, bump=0.03, rough_var=True))
    box(col, "PoolWater", (-2.0, 0, 0.45), (6.6, 5.6, 0.5), waterm)
    # Pool coping
    for e in range(4):
        box(col, f"PoolCoping{e}", (-4.5 + e * 1.5, -3.5, 0.38), (1.2, 0.3, 0.06), stone)
    # Path tiles around pool
    for t in range(6):
        ang = -math.pi / 4 + t * math.pi / 10
        x = 5.5 * math.cos(ang)
        y = 5.0 * math.sin(ang)
        box(col, f"PathTile{t}", (x, y, 0.1), (0.5, 0.5, 0.06), stone)
    # Lounge seating
    for k in range(3):
        x = 5.0
        y = -3.0 + k * 3.0
        box(col, f"Lounger_{k}", (x, y, 0.4), (1.0, 1.9, 0.4), deck)
        box(col, f"LoungerCushion{k}", (x, y + 0.2, 0.6), (0.8, 1.4, 0.2), cushion)
    # Planter boxes
    for k in range(2):
        box(col, f"Planter_{k}", (6.6, -2.0 + k * 4.0, 0.6), (0.8, 0.8, 0.8), plant)
        box(col, f"Foliage_{k}", (6.6, -2.0 + k * 4.0, 0.9), (0.6, 0.6, 0.4), foliage)
    # Extra planters near pool
    for k in range(2):
        box(col, f"PoolPlanter{k}", (-5.0, -1.0 + k * 2.0, 0.5), (0.6, 0.6, 0.7), plant)
        box(col, f"PoolFoliage{k}", (-5.0, -1.0 + k * 2.0, 0.8), (0.5, 0.5, 0.3), foliage)
    # Meditation circle
    for c in range(6):
        ang = c * math.pi / 3
        x = -2.0 + 4.5 * math.cos(ang)
        y = 0 + 4.0 * math.sin(ang)
        cyl(col, f"MedCushion{c}", (x, y, 0.15), 0.3, 0.2, cushion, verts=14)
    # Lighting poles
    for p in range(2):
        box(col, f"LightPole{p}", (-5 + p * 10, 4.0, 1.5), (0.1, 0.1, 3.0), stone)
        box(col, f"LightHead{p}", (-5 + p * 10, 4.0, 3.0), (0.4, 0.4, 0.15), light_m)
    # Water feature (small fountain near pool)
    cyl(col, "FountainBase", (-4.5, 2.0, 0.25), 0.6, 0.4, stone, verts=20)
    cyl(col, "FountainWater", (-4.5, 2.0, 0.4), 0.4, 0.2, waterm, verts=20)
    # Yoga mats
    for yg in range(3):
        box(col, f"YogaMat{yg}", (5.5, 3.0 + yg * 1.2, 0.08), (0.6, 1.8, 0.04),
            mat(f"r_yoga{yg}", (0.3 + yg * 0.2, 0.1 + yg * 0.15, 0.4, 1), rough=0.9))
    # Ambient accent strip
    box(col, "AccentStrip", (0, HALF_D - 0.2, 1.6), (HALF_W * 2 - 4, 0.06, 0.06), light_m)
    # Small side table
    box(col, "SideTable", (6.0, -4.5, 0.3), (0.5, 0.5, 0.5), stone)


def f_rooftop(col, acc):
    panel = mat("rf_panel", (0.05, 0.09, 0.18, 1.0), rough=0.18, metal=0.6,
                emit=(0.30, 0.66, 1.0), emit_str=0.5, bump=0.01, rough_var=True)
    steel = mat("rf_steel", (0.16, 0.20, 0.25, 1.0), rough=0.35, metal=0.85, bump=0.015, rough_var=True)
    tank = mat("rf_tank", (0.12, 0.36, 0.52, 1.0), rough=0.3, metal=0.4, bump=0.02, rough_var=True)
    grating = mat("rf_grate", (0.15, 0.18, 0.22, 1.0), rough=0.5, metal=0.7, bump=0.03)
    equip = mat("rf_equip", (0.25, 0.30, 0.35, 1.0), rough=0.4, metal=0.6, bump=0.02, rough_var=True)
    white = mat("rf_white", (0.80, 0.82, 0.85, 1.0), rough=0.6, bump=0.02, rough_var=True)

    box(col, "RoofDeck", (0, 0, -0.08), (HALF_W * 2 + 0.3, HALF_D * 2 + 0.3, 0.16),
        mat("rf_deck", SLABC, rough=0.7))
    # Walkway grating
    box(col, "WalkwayGrate", (0, 0, 0.02), (14.0, 2.0, 0.04), grating)
    # Solar panels
    for row in range(2):
        for k in range(4):
            p = box(col, f"Solar_{row}_{k}", (-5.4 + k * 3.6, -2.4 + row * 4.6, 0.7),
                    (3.2, 3.6, 0.12), panel)
            p.rotation_euler = (math.radians(-28), 0, 0)
        # Solar support frame
        box(col, f"SolarFrame{row}", (-3.6, -0.1 + row * 4.6, 0.3),
            (10.0, 0.06, 0.1), steel)
    # Additional solar row in center
    for k in range(2):
        p = box(col, f"SolarCenter_{k}", (-2.0 + k * 4.0, 0, 0.8),
                (3.6, 3.0, 0.12), panel)
        p.rotation_euler = (math.radians(-20), 0, 0)
    # Reservoir
    cyl(col, "Reservoir", (HALF_W - 2.5, -HALF_D + 2.5, 1.3), 1.6, 2.6, tank, verts=26)
    box(col, "ReservoirLid", (HALF_W - 2.5, -HALF_D + 2.5, 2.6), (3.0, 3.0, 0.08), tank)
    # Communications mast
    box(col, "Mast", (HALF_W - 2.5, HALF_D - 2.0, 2.4), (0.18, 0.18, 5.0), steel)
    box(col, "MastTip", (HALF_W - 2.5, HALF_D - 2.0, 5.0), (0.5, 0.5, 0.3),
        mat("rf_beacon", (1, 0.2, 0.2, 1), emit=(1, 0.1, 0.1), emit_str=4.0))
    # Satellite dish
    cyl(col, "DishMount", (HALF_W - 2.5, HALF_D - 2.0, 3.8), 0.06, 0.8, steel, verts=10)
    box(col, "SatDish", (HALF_W - 2.5, HALF_D - 1.5, 3.8), (0.8, 0.04, 0.6),
        mat("rf_dish", (0.85, 0.85, 0.90, 1), metal=0.9, rough=0.15, bump=0.005, rough_var=True))
    # Equipment cabinets
    for e in range(3):
        box(col, f"EquipCab{e}", (HALF_W - 1.5, -HALF_D + e * 1.2, 0.6),
            (1.0, 0.8, 1.0), equip)
        box(col, f"CabLED{e}", (HALF_W - 1.5, -HALF_D + 0.3 + e * 1.2, 1.4),
            (0.02, 0.08, 0.02),
            mat(f"rf_cabled{e}", (0, 0.8, 0.2, 1), emit=(0, 0.8, 0.2), emit_str=1.5))
    # AC unit
    box(col, "ACUnit", (-HALF_W + 2.0, HALF_D - 1.5, 0.6), (1.8, 1.4, 1.0), white)
    box(col, "ACVent", (-HALF_W + 2.0, HALF_D - 1.5, 1.0), (1.4, 0.8, 0.04), steel)
    # Edge guardrail posts
    for g in range(6):
        x = -HALF_W + 1.0 + g * 2.8
        box(col, f"GuardrailPost{g}", (x, HALF_D - 0.2, 0.5), (0.08, 0.08, 1.0), steel)
        box(col, f"GuardrailHoriz{g}", (x, HALF_D - 0.2, 0.8), (2.8, 0.05, 0.06), steel)
    # Antenna array
    for a in range(3):
        box(col, f"Antenna{a}", (HALF_W - 1.0 + a * 0.4, HALF_D - 1.0, 2.0),
            (0.04, 0.04, 1.0), steel)


BUILDERS = {
    "basement": f_basement, "water": f_water, "energy": f_energy, "food": f_food,
    "shelter": f_shelter, "air": f_air, "health": f_health,
    "restoration": f_restoration, "rooftop": f_rooftop,
}


# --------------------------------------------------------------------------- #
# Build, export, render  (unchanged)
# --------------------------------------------------------------------------- #
def build_module(key, label, accent):
    col = collection(f"Floor_{key}")
    floorless = key == "rooftop"
    cutaway = True
    shell(col, key, accent, cutaway=cutaway, floorless=floorless)
    BUILDERS[key](col, accent)
    return col


def export_glb(col, key):
    bpy.ops.object.select_all(action="DESELECT")
    for o in col.all_objects:
        o.select_set(True)
    path = os.path.join(MODELS_DIR, f"floor-{key}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True,
    )
    sz = os.path.getsize(path)
    print(f"GLB {key}: {sz/1024:.1f} KB -> {path}")
    return sz


def world_and_render_setup():
    if SCENE.world is None:
        SCENE.world = bpy.data.worlds.new("ATLAS_World")
    w = SCENE.world
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 1.0
    sky = nt.nodes.new("ShaderNodeTexSky")
    try:
        sky.sky_type = "NISHITA"
        sky.sun_elevation = math.radians(24)
        sky.sun_rotation = math.radians(50)
    except Exception:
        bg.inputs["Color"].default_value = (0.05, 0.07, 0.10, 1.0)
    else:
        nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])

    enum = {e.identifier for e in type(SCENE.render).bl_rna.properties["engine"].enum_items}
    for cand in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        if cand in enum:
            SCENE.render.engine = cand
            break
    if SCENE.render.engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            SCENE.eevee.taa_render_samples = 48
            SCENE.eevee.use_raytracing = True
        except Exception:
            pass
    looks = {v.identifier for v in
             type(SCENE.view_settings).bl_rna.properties["view_transform"].enum_items}
    SCENE.view_settings.view_transform = (
        "AgX" if "AgX" in looks else "Filmic" if "Filmic" in looks else "Standard")
    SCENE.render.film_transparent = False


def add_sun():
    sd = bpy.data.lights.new("Key_Sun", "SUN")
    sd.energy = 2.8
    sd.color = (1.0, 0.95, 0.85)
    sd.angle = math.radians(1.5)
    so = bpy.data.objects.new("Key_Sun", sd)
    so.rotation_euler = (math.radians(58), 0, math.radians(50))
    SCENE.collection.objects.link(so)
    return so


def make_cam():
    cd = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cd)
    SCENE.collection.objects.link(cam)
    SCENE.camera = cam
    return cam


def look_at(cam, loc, tgt):
    from mathutils import Vector
    cam.location = loc
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


def only_visible(active_keys):
    keys = set(active_keys)
    for col in SCENE.collection.children:
        if col.name.startswith("Floor_"):
            on = col.name.replace("Floor_", "") in keys
            col.hide_render = not on


def render_module(cam, key):
    only_visible([key])
    look_at(cam, (HALF_W * 1.7, -HALF_D * 3.2, FLOOR_CLEAR * 1.4),
            (0, 0, FLOOR_CLEAR * 0.45))
    SCENE.render.resolution_x = 1000
    SCENE.render.resolution_y = 800
    SCENE.render.filepath = os.path.join(RENDERS_DIR, f"floor-{key}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", SCENE.render.filepath)


def render_hero(cam, modules):
    for i, (key, _, _) in enumerate(modules):
        col = bpy.data.collections.get(f"Floor_{key}")
        for o in col.objects:
            o.location.z += i * STEP
    only_visible([k for k, _, _ in modules])
    total_h = len(modules) * STEP
    look_at(cam, (HALF_W * 3.0, -HALF_D * 5.2, total_h * 0.58), (0, 0, total_h * 0.45))
    SCENE.render.resolution_x = 1500
    SCENE.render.resolution_y = 1700
    SCENE.render.filepath = os.path.join(RENDERS_DIR, "atlas-tower-hero.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", SCENE.render.filepath)


def main():
    print("BUILD_ATLAS_FLOORS_START", bpy.app.version_string)
    modules = []
    total_kb = 0

    # Build each unique module once (deduplicate by builder key)
    builder_keys = set(FLOOR_KEY_MAP.values())
    builder_cols = {}
    for key, label, accent in FLOORS:
        if key in builder_keys:
            col = build_module(key, label, accent)
            builder_cols[key] = col
            modules.append((key, label, accent))

    # Export one GLB per FLOOR_KEY_MAP entry, reusing built geometry
    for dm_key, builder_key in FLOOR_KEY_MAP.items():
        if builder_key in builder_cols:
            total_kb += export_glb(builder_cols[builder_key], dm_key) / 1024
        else:
            print(f"WARNING: no builder for '{dm_key}' -> '{builder_key}'")

    print(f"GLB_TOTAL {total_kb:.1f} KB across {len(FLOOR_KEY_MAP)} exports ({len(modules)} unique modules)")

    world_and_render_setup()
    add_sun()
    cam = make_cam()
    for key, _, _ in modules:
        render_module(cam, key)
    render_hero(cam, modules)

    # Post-export budget check (inline — stdlib, no external dep)
    total_bytes = sum(os.path.getsize(os.path.join(MODELS_DIR, f))
                      for f in os.listdir(MODELS_DIR)
                      if f.startswith("floor-") and f.endswith(".glb"))
    total_mb = total_bytes / (1024 * 1024)
    print(f"\nBUDGET_CHECK: {total_bytes/1024:.1f} KB ({total_mb:.2f} MB) across {len(os.listdir(MODELS_DIR))} GLBs")
    BUDGET_MB = 2.5
    if total_mb > BUDGET_MB:
        print(f"WARNING: OVER BUDGET by {total_mb - BUDGET_MB:.2f} MB (budget: {BUDGET_MB} MB)")
    else:
        print(f"OK — {BUDGET_MB - total_mb:.2f} MB headroom remaining")

    blend = os.path.join(HERE, "atlas_floors.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    print("SAVED", blend)
    print("BUILD_ATLAS_FLOORS_DONE modules=%d total_glb_kb=%.1f" % (len(modules), total_kb))


if __name__ == "__main__":
    main()
