"""
build_atlas_floors.py — PBR BAKE PIPELINE + PROCEDURAL MATERIALS + ANIMATIONS
==============================================================================
TWO-PASS ARCHITECTURE:
  1. BUILD + RENDER (procedural):  All floors built with rich procedural PBR
     materials (noise bumps, roughness variation, emissive nodes).  Eevee
     renders capture this detail at full quality for marketing PNGs.
  2. BAKE + EXPORT (image-based):  Procedural materials are baked to real
     PBR texture maps (BaseColor JPEG, Normal PNG, ORM PNG, Emission JPEG)
     using Cycles.  Baked-image materials replace procedural ones, then
     GLBs are exported with embedded textures the WebGL twin can read.

  The .blend is saved TWICE: atlas_floors.blend (procedural, editable) and
  atlas_floors_baked.blend (image-based, inspectable).

Binding contract (council meeting 2026-06-12):
  FLOOR_KEY_MAP bridges the 12 data-model Floor.key values (seed-data.ts)
  to the 9 Blender builder functions below.  Multiple data-model floors
  can share one builder (e.g. all five shelter floors reuse f_shelter).
  The GLB export loop produces one file per FLOOR_KEY_MAP entry so the
  WebGL twin can index every floor by its canonical key.
"""

import bpy
import math
import os
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
sys.path.insert(0, HERE)  # so we can import bake_pipeline

MODELS_DIR = os.path.normpath(os.path.join(HERE, "..", "public", "models"))
RENDERS_DIR = os.path.join(HERE, "renders")
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(RENDERS_DIR, exist_ok=True)

# ---- BAKING CONFIG ----
BAKE_ENABLED = True           # set False to skip baking (fast dev iteration)
BAKE_DIR = os.path.join(HERE, "baked_textures")
BAKE_BUDGET_MB = 8.0          # relaxed budget for baked-texture GLBs

if BAKE_ENABLED:
    from bake_pipeline import (
        unwrap_object, unwrap_collection, BakeSession,
        clear_baked_textures,
    )
    print("BAKE PIPELINE: loaded")

# Animation system
ANIM_ENABLED = True
if ANIM_ENABLED:
    try:
        from animations import animate_floor
        print("ANIMATIONS: loaded")
    except ImportError:
        ANIM_ENABLED = False
        print("ANIMATIONS: not available")

FLOORS = [
    ("parking",     "Parking P1",       (0.55, 0.58, 0.62)),
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

FLOOR_KEY_MAP = {
    "parking-p1":       "parking",
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
    "basement":         "basement",
    "rooftop":          "rooftop",
    # Legacy need-based aliases (backward compat with models.ts)
    "water":            "water",
    "energy":           "energy",
    "food":             "food",
    "shelter":          "shelter",
    "air":              "air",
    "health":           "health",
    "restoration":      "restoration",
}

# Default color primitives
WALL   = (0.05, 0.07, 0.10, 1.0)
SLABC  = (0.10, 0.12, 0.15, 1.0)
FLOOR_C = (0.12, 0.14, 0.18, 1.0)

_mats = {}

# --------------------------------------------------------------------------- #
# ENHANCED PBR MATERIAL FUNCTION
# --------------------------------------------------------------------------- #
def mat(name, rgba, rough=0.5, metal=0.0, emit=None, emit_str=0.0, alpha=1.0,
        bump=None, rough_var=False, scale=8.0):
    """
    Full PBR Principled BSDF material.
    
    For GLTF compatibility, all inputs are flat values (no procedural textures)
    since the exporter cannot bake procedural noise into GLB. The Blender render
    pass (Eevee) evaluates the bump/noise nodes at render time for the PNGs.
    
    Parameters:
      rgba      — base colour (RGBA tuple)
      rough     — roughness (0 = mirror, 1 = diffuse)
      metal     — metallic (0 = dielectric, 1 = conductor)
      emit      — emission colour (RGB tuple, None = no emission)
      emit_str  — emission strength
      alpha     — alpha / transparency
      bump      — procedural bump strength (0 = none)
      rough_var — add noise-based roughness variation
      scale     — noise texture scale for bump / detail
    """
    # Stable cache key
    rgba_t = tuple(rgba) if hasattr(rgba, '__iter__') else (rgba,)
    key = (name, rgba_t, round(rough, 4), round(metal, 4),
           tuple(emit) if emit else None, round(emit_str, 4),
           round(alpha, 4), bump, rough_var, round(scale, 1))
    if key in _mats:
        return _mats[key]

    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (400, 0)
    princ = nt.nodes.new("ShaderNodeBsdfPrincipled")
    princ.location = (100, 0)

    # ---- BASE COLOUR (flat) ----
    princ.inputs["Base Color"].default_value = rgba

    # ---- METALLIC ----
    princ.inputs["Metallic"].default_value = metal

    # ---- ROUGHNESS (optional noise variation) ----
    if rough_var:
        n_rough = nt.nodes.new("ShaderNodeTexNoise")
        n_rough.location = (-300, -200)
        n_rough.inputs["Scale"].default_value = scale * 1.5
        n_rough.inputs["Detail"].default_value = 3.0

        rm = nt.nodes.new("ShaderNodeMapRange")
        rm.location = (-50, -200)
        rm.inputs["From Min"].default_value = 0.0
        rm.inputs["From Max"].default_value = 1.0
        rm.inputs["To Min"].default_value = max(0.0, rough - 0.20)
        rm.inputs["To Max"].default_value = min(1.0, rough + 0.20)

        nt.links.new(n_rough.outputs["Fac"], rm.inputs["Value"])
        nt.links.new(rm.outputs["Result"], princ.inputs["Roughness"])
    else:
        princ.inputs["Roughness"].default_value = rough

    # ---- NORMAL (procedural noise → bump) ----
    if bump is not None and bump > 0:
        n_norm = nt.nodes.new("ShaderNodeTexNoise")
        n_norm.location = (-300, -450)
        n_norm.inputs["Scale"].default_value = scale
        n_norm.inputs["Detail"].default_value = 4.0

        bn = nt.nodes.new("ShaderNodeBump")
        bn.location = (-50, -450)
        bn.inputs["Strength"].default_value = bump

        nt.links.new(n_norm.outputs["Fac"], bn.inputs["Height"])
        nt.links.new(bn.outputs["Normal"], princ.inputs["Normal"])

    # ---- EMISSION ----
    if emit is not None:
        princ.inputs["Emission Color"].default_value = (*emit, 1.0)
        princ.inputs["Emission Strength"].default_value = emit_str

    # ---- ALPHA ----
    if alpha < 1.0:
        princ.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"

    # ---- Final link ----
    nt.links.new(princ.outputs["BSDF"], out.inputs["Surface"])

    _mats[key] = m
    return m


# --------------------------------------------------------------------------- #
# PRIMITIVE HELPERS
# --------------------------------------------------------------------------- #
def box(col, name, loc, size, material):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.active_object
    o.name = name
    # Blender's size=1 cube has one-unit dimensions, so scale maps directly to
    # the requested dimensions. Dividing by two produced detached half-size
    # slabs and walls while cylinders retained their intended size.
    o.scale = (size[0], size[1], size[2])
    for c in list(o.users_collection):
        c.objects.unlink(o)
    col.objects.link(o)
    if material:
        o.data.materials.append(material)
    # UV unwrap for texture baking
    if BAKE_ENABLED:
        unwrap_object(o)
    return o


def cyl(col, name, loc, r, h, material, verts=14, rot=None):
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
    if BAKE_ENABLED:
        unwrap_object(o)
    return o


def sphere(col, name, loc, radius, material, segs=6):
    """Add a UV sphere (e.g. light bulb)."""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc,
                                          segments=segs, ring_count=segs // 2)
    o = bpy.context.active_object
    o.name = name
    for c in list(o.users_collection):
        c.objects.unlink(o)
    col.objects.link(o)
    if material:
        o.data.materials.append(material)
    if BAKE_ENABLED:
        unwrap_object(o)
    return o


# --------------------------------------------------------------------------- #
# HUMAN FIGURES — low-poly stylized (~12 primitives each)
# --------------------------------------------------------------------------- #
def add_human(col, name, location, rotation_z=0, height=1.75, pose="standing"):
    """
    Add a stylized low-poly human figure to the given collection.

    Poses: "standing" (arms at sides), "sitting" (legs forward, hands on lap),
           "walking" (one leg forward, opposite arm forward),
           "working" (arms extended forward, slight lean).
    """
    hx, hy, hz = location
    cos_r = math.cos(rotation_z)
    sin_r = math.sin(rotation_z)
    s = height / 1.75

    def rp(lx, ly, lz):
        wx = hx + cos_r * lx - sin_r * ly
        wy = hy + sin_r * lx + cos_r * ly
        return (wx, wy, hz + lz)

    skin = mat(f"human_skin_{name}", (0.85, 0.68, 0.55, 1.0), rough=0.75, bump=0.02)
    cloth = mat(f"human_cloth_{name}", (0.30, 0.35, 0.42, 1.0), rough=0.80, bump=0.03)
    shoe = mat(f"human_shoe_{name}", (0.08, 0.08, 0.10, 1.0), rough=0.60, bump=0.03)
    hair_m = mat(f"human_hair_{name}", (0.10, 0.08, 0.06, 1.0), rough=0.90, bump=0.05)

    # Neck and head
    cyl(col, f"{name}_neck", rp(0, 0, 1.15 * s), 0.04 * s, 0.15 * s, skin, verts=8)
    sphere(col, f"{name}_head", rp(0, 0, 1.35 * s), 0.12 * s, skin, segs=8)
    sphere(col, f"{name}_hair", rp(0, 0, 1.42 * s), 0.10 * s, hair_m, segs=6)

    # Torso
    box(col, f"{name}_torso", rp(0, 0, 0.95 * s), (0.35 * s, 0.20 * s, 0.50 * s), cloth)

    if pose == "standing":
        cyl(col, f"{name}_armL", rp(-0.22 * s, 0, 0.85 * s), 0.05 * s, 0.60 * s, skin, verts=8)
        cyl(col, f"{name}_armR", rp(0.22 * s, 0, 0.85 * s), 0.05 * s, 0.60 * s, skin, verts=8)
        sphere(col, f"{name}_handL", rp(-0.22 * s, 0, 0.42 * s), 0.05 * s, skin, segs=6)
        sphere(col, f"{name}_handR", rp(0.22 * s, 0, 0.42 * s), 0.05 * s, skin, segs=6)
        cyl(col, f"{name}_legL", rp(-0.10 * s, 0, 0.25 * s), 0.07 * s, 0.80 * s, cloth, verts=8)
        cyl(col, f"{name}_legR", rp(0.10 * s, 0, 0.25 * s), 0.07 * s, 0.80 * s, cloth, verts=8)
        box(col, f"{name}_footL", rp(-0.10 * s, 0.08 * s, 0.03 * s), (0.10 * s, 0.25 * s, 0.06 * s), shoe)
        box(col, f"{name}_footR", rp(0.10 * s, 0.08 * s, 0.03 * s), (0.10 * s, 0.25 * s, 0.06 * s), shoe)

    elif pose == "sitting":
        cyl(col, f"{name}_armL", rp(-0.22 * s, 0, 0.85 * s), 0.05 * s, 0.60 * s, skin, verts=8)
        cyl(col, f"{name}_armR", rp(0.22 * s, 0, 0.85 * s), 0.05 * s, 0.60 * s, skin, verts=8)
        sphere(col, f"{name}_handL", rp(-0.15 * s, 0.10 * s, 0.55 * s), 0.05 * s, skin, segs=6)
        sphere(col, f"{name}_handR", rp(0.15 * s, 0.10 * s, 0.55 * s), 0.05 * s, skin, segs=6)
        cyl(col, f"{name}_legL", rp(-0.10 * s, 0.30 * s, 0.50 * s), 0.07 * s, 0.70 * s, cloth, verts=8,
            rot=(math.radians(75), 0, 0))
        cyl(col, f"{name}_legR", rp(0.10 * s, 0.30 * s, 0.50 * s), 0.07 * s, 0.70 * s, cloth, verts=8,
            rot=(math.radians(75), 0, 0))
        box(col, f"{name}_footL", rp(-0.10 * s, 0.55 * s, 0.10 * s), (0.10 * s, 0.25 * s, 0.06 * s), shoe)
        box(col, f"{name}_footR", rp(0.10 * s, 0.55 * s, 0.10 * s), (0.10 * s, 0.25 * s, 0.06 * s), shoe)

    elif pose == "walking":
        cyl(col, f"{name}_armL", rp(-0.30 * s, 0.12 * s, 0.82 * s), 0.05 * s, 0.60 * s, skin, verts=8,
            rot=(math.radians(-35), 0, 0))
        cyl(col, f"{name}_armR", rp(0.28 * s, -0.10 * s, 0.82 * s), 0.05 * s, 0.60 * s, skin, verts=8,
            rot=(math.radians(30), 0, 0))
        sphere(col, f"{name}_handL", rp(-0.38 * s, 0.25 * s, 0.52 * s), 0.05 * s, skin, segs=6)
        sphere(col, f"{name}_handR", rp(0.36 * s, -0.22 * s, 0.52 * s), 0.05 * s, skin, segs=6)
        cyl(col, f"{name}_legL", rp(-0.10 * s, -0.14 * s, 0.25 * s), 0.07 * s, 0.80 * s, cloth, verts=8,
            rot=(math.radians(-18), 0, 0))
        cyl(col, f"{name}_legR", rp(0.10 * s, 0.14 * s, 0.25 * s), 0.07 * s, 0.80 * s, cloth, verts=8,
            rot=(math.radians(18), 0, 0))
        box(col, f"{name}_footL", rp(-0.10 * s, -0.24 * s, 0.03 * s), (0.10 * s, 0.25 * s, 0.06 * s), shoe)
        box(col, f"{name}_footR", rp(0.10 * s, 0.24 * s, 0.03 * s), (0.10 * s, 0.25 * s, 0.06 * s), shoe)

    elif pose == "working":
        cyl(col, f"{name}_armL", rp(-0.32 * s, 0.18 * s, 0.85 * s), 0.05 * s, 0.60 * s, skin, verts=8,
            rot=(math.radians(-50), 0, 0))
        cyl(col, f"{name}_armR", rp(0.32 * s, 0.18 * s, 0.85 * s), 0.05 * s, 0.60 * s, skin, verts=8,
            rot=(math.radians(-50), 0, 0))
        sphere(col, f"{name}_handL", rp(-0.52 * s, 0.42 * s, 0.52 * s), 0.05 * s, skin, segs=6)
        sphere(col, f"{name}_handR", rp(0.52 * s, 0.42 * s, 0.52 * s), 0.05 * s, skin, segs=6)
        cyl(col, f"{name}_legL", rp(-0.10 * s, -0.05 * s, 0.25 * s), 0.07 * s, 0.80 * s, cloth, verts=8)
        cyl(col, f"{name}_legR", rp(0.10 * s, 0.05 * s, 0.25 * s), 0.07 * s, 0.80 * s, cloth, verts=8)
        box(col, f"{name}_footL", rp(-0.10 * s, 0.03 * s, 0.03 * s), (0.10 * s, 0.25 * s, 0.06 * s), shoe)
        box(col, f"{name}_footR", rp(0.10 * s, 0.13 * s, 0.03 * s), (0.10 * s, 0.25 * s, 0.06 * s), shoe)


# --------------------------------------------------------------------------- #
# VEHICLES — simple low-poly (~15 primitives each)
# --------------------------------------------------------------------------- #
def add_vehicle(col, name, location, rotation_z=0, vehicle_type="sedan"):
    """
    Add a simple low-poly vehicle (sedan, SUV, or delivery van).

    Vehicle has body, cabin/greenhouse, 4 wheels, bumpers, and emissive lights.
    The vehicle faces -Y (front toward negative Y) by default; rotation_z
    rotates around the Z axis.
    """
    hx, hy, hz = location
    cos_r = math.cos(rotation_z)
    sin_r = math.sin(rotation_z)

    def rp(lx, ly, lz):
        wx = hx + cos_r * lx - sin_r * ly
        wy = hy + sin_r * lx + cos_r * ly
        return (wx, wy, hz + lz)

    # Choose proportions per type
    if vehicle_type == "sedan":
        body_h, cabin_h, wheel_r = 0.90, 0.50, 0.35
        body_c = (0.22, 0.28, 0.35, 1.0)
    elif vehicle_type == "suv":
        body_h, cabin_h, wheel_r = 1.00, 0.55, 0.40
        body_c = (0.18, 0.22, 0.28, 1.0)
    elif vehicle_type == "delivery_van":
        body_h, cabin_h, wheel_r = 1.20, 0.80, 0.38
        body_c = (0.88, 0.85, 0.80, 1.0)

    body_m = mat(f"vehicle_paint_{name}", body_c, rough=0.35, metal=0.15, bump=0.01)
    glass_m = mat(f"vehicle_glass_{name}", (0.40, 0.50, 0.60, 1.0), rough=0.05, alpha=0.40)
    wheel_m = mat(f"vehicle_wheel_{name}", (0.04, 0.04, 0.05, 1.0), rough=0.65, bump=0.04)
    lite_f = mat(f"vehicle_head_{name}", (1.0, 0.96, 0.88, 1.0), rough=0.10,
                 emit=(1.0, 0.96, 0.88), emit_str=0.3)
    lite_r = mat(f"vehicle_tail_{name}", (0.90, 0.10, 0.10, 1.0), rough=0.10,
                 emit=(0.90, 0.10, 0.10), emit_str=0.5)

    # Main body
    box(col, f"{name}_body", rp(0, 0, body_h / 2), (1.80, 4.50, body_h), body_m)

    # Cabin / greenhouse
    box(col, f"{name}_cabin", rp(0, -0.20, body_h + cabin_h / 2), (1.60, 2.50, cabin_h), glass_m)

    # 4 wheels (cylinders laid sideways on X axis)
    for wx, wy in [(-0.80, -1.30), (0.80, -1.30), (-0.80, 1.30), (0.80, 1.30)]:
        cyl(col, f"{name}_wh{int(wx)}{int(wy)}", rp(wx, wy, wheel_r),
            wheel_r, 0.20, wheel_m, verts=10, rot=(math.radians(90), 0, 0))

    # Bumpers
    box(col, f"{name}_bumper_f", rp(0, -2.25, 0.20), (1.60, 0.08, 0.15), body_m)
    box(col, f"{name}_bumper_r", rp(0, 2.25, 0.20), (1.60, 0.08, 0.15), body_m)

    # Headlights (front = -Y)
    box(col, f"{name}_headL", rp(-0.50, -2.30, 0.40), (0.25, 0.05, 0.12), lite_f)
    box(col, f"{name}_headR", rp(0.50, -2.30, 0.40), (0.25, 0.05, 0.12), lite_f)

    # Taillights (rear = +Y)
    box(col, f"{name}_tailL", rp(-0.50, 2.30, 0.40), (0.25, 0.05, 0.12), lite_r)
    box(col, f"{name}_tailR", rp(0.50, 2.30, 0.40), (0.25, 0.05, 0.12), lite_r)


# --------------------------------------------------------------------------- #
# REAL LIGHT BULB + FIXTURE HELPERS
# --------------------------------------------------------------------------- #
_BULB_WATTAGE = {}  # track wattages per bulb for point light creation


def light_bulb(col, name, loc, color=(1.0, 0.96, 0.88), wattage=2.0,
               radius=0.09, temp="warm"):
    """
    Create a realistic light bulb: emissive glass sphere + metallic base.
    
    Also registers the bulb so add_point_lights() can place a real Point light
    at its location for Blender Eevee renders.
    
    Parameters:
      color    — emissive colour (RGB)
      wattage  — emission strength multiplier
      radius   — bulb glass radius
      temp     — "warm" (2700K), "neutral" (4000K), or "cool" (5500K)
    """
    if temp == "warm":
        color = (1.0, 0.92, 0.78)
    elif temp == "neutral":
        color = (1.0, 0.96, 0.88)
    elif temp == "cool":
        color = (0.92, 0.95, 1.0)

    bulb_mat = mat(f"bulb_{name}", (*color, 1.0), rough=0.04, metal=0.0,
                   emit=color, emit_str=wattage * 2.5, bump=0.003)
    socket_mat = mat(f"socket_{name}", (0.12, 0.12, 0.14, 1.0),
                     rough=0.25, metal=0.8, bump=0.01, rough_var=True)

    # Metallic screw base (E27/Edison)
    cyl(col, f"{name}_base", (loc[0], loc[1], loc[2] - 0.06),
        0.04, 0.08, socket_mat, verts=12)
    # Glass bulb (emissive)
    sphere(col, f"{name}_bulb", loc, radius, bulb_mat, segs=8)

    # Register for point light creation during render setup
    _BULB_WATTAGE[name] = (*loc, wattage)

    return loc


def pendant_light(col, name, loc, color=(1.0, 0.96, 0.88), wattage=2.0,
                  cord_len=0.5, temp="warm"):
    """
    Ceiling-mounted pendant — cord + emissive bulb (2 primitives).
    """
    cord_mat = mat(f"pcord_{name}", (0.05, 0.05, 0.06, 1.0), rough=0.4, metal=0.3)
    cx, cy, cz = loc
    cyl(col, f"{name}_cord", (cx, cy, cz - cord_len / 2),
        0.012, cord_len, cord_mat, verts=6)
    bulb_loc = (cx, cy, cz - cord_len)
    light_bulb(col, f"{name}_bulb", bulb_loc,
               color=color, wattage=wattage, radius=0.055, temp=temp)
    return bulb_loc


def wall_sconce(col, name, loc, color=(1.0, 0.92, 0.78), wattage=1.0,
                temp="warm"):
    """
    Wall-mounted sconce — small mount plate + emissive bulb.
    Minimal geometry (2 primitives) for GLB budget.
    """
    mount_mat = mat(f"smount_{name}", (0.06, 0.06, 0.08, 1.0),
                    rough=0.3, metal=0.8, bump=0.01, rough_var=True)
    cx, cy, cz = loc
    box(col, f"{name}_plate", (cx, cy, cz), (0.04, 0.08, 0.04), mount_mat)
    bulb_loc = (cx, cy + 0.15, cz)
    light_bulb(col, f"{name}_bulb", bulb_loc,
               color=color, wattage=wattage, radius=0.05, temp=temp)
    return bulb_loc


def add_point_lights(scene, key):
    """
    For each registered light bulb, create a real Blender Point light at its
    location to illuminate the scene for Eevee renders.  These lights are NOT
    added to any floor collection, so they are excluded from GLB export.
    
    Returns list of created light objects.
    """
    lights = []
    for name, (lx, ly, lz, wattage) in _BULB_WATTAGE.items():
        if key not in name and not name.startswith(key):
            continue
        ld = bpy.data.lights.new(f"PL_{name}", "POINT")
        ld.energy = wattage * 150.0  # scale for Eevee
        ld.color = (1.0, 0.95, 0.88)
        ld.shadow_soft_size = 0.3
        lo = bpy.data.objects.new(f"PL_{name}", ld)
        lo.location = (lx, ly, lz)
        scene.collection.objects.link(lo)
        lights.append(lo)
    return lights


def add_ambient_lights(scene):
    """Add fill and rim lights for a more cinematic render."""
    # Key fill from the open (cutaway) side
    fill = bpy.data.lights.new("Fill_Key", "AREA")
    fill.energy = 80.0
    fill.color = (0.85, 0.90, 1.0)
    fo = bpy.data.objects.new("Fill_Key", fill)
    fo.location = (HALF_W * 2.5, 0, FLOOR_CLEAR * 0.8)
    scene.collection.objects.link(fo)
    return fo


# --------------------------------------------------------------------------- #
# FRESH SCENE / COLLECTION
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


# --------------------------------------------------------------------------- #
# SHELL — shared structural floor module
# --------------------------------------------------------------------------- #
def shell(col, key, accent, cutaway=True, floorless=False):
    """Build the shared shell: slab, walls, ceiling, trim, and LIGHTING."""
    # ---- Materials ----
    m_slab = mat("ATLAS_Slab", SLABC, rough=0.65, bump=0.10, rough_var=True)
    m_wall = mat("ATLAS_Wall", WALL, rough=0.80, bump=0.08, rough_var=True)
    m_steel = mat("ATLAS_Steel", (0.14, 0.18, 0.22, 1.0), rough=0.30, metal=0.85,
                  bump=0.03, rough_var=True)
    acc = mat(f"Accent_{key}", (*accent, 1.0), rough=0.35, emit=accent, emit_str=1.5,
              bump=0.015)
    m_floor = mat(f"Floor_{key}", FLOOR_C, rough=0.90, bump=0.06, rough_var=True)
    m_trim = mat(f"Trim_{key}", (0.06, 0.08, 0.11, 1.0), rough=0.50, metal=0.35,
                 bump=0.03, rough_var=True)
    m_grid = mat(f"CeilGrid_{key}", (0.05, 0.07, 0.10, 1.0), rough=0.55, metal=0.25,
                 bump=0.02, rough_var=True)

    # ---- Slab ----
    if not floorless:
        box(col, f"Slab_{key}", (0, 0, -SLAB_T / 2),
            (HALF_W * 2 + 0.3, HALF_D * 2 + 0.3, SLAB_T), m_slab)

    # ---- Interior floor surface ----
    box(col, f"IntFloor_{key}", (0, 0, 0.02),
        (HALF_W * 2 - 0.8, HALF_D * 2 - 0.8, 0.04), m_floor)

    # ---- Accent reveal ----
    box(col, f"Reveal_{key}", (0, HALF_D, 0.06),
        (HALF_W * 2 + 0.32, 0.12, 0.14), acc)

    # ---- Walls ----
    cy = FLOOR_CLEAR / 2
    box(col, f"WallBack_{key}", (0, -HALF_D, cy),
        (HALF_W * 2, 0.16, FLOOR_CLEAR), m_wall)
    box(col, f"WallL_{key}", (-HALF_W, 0, cy),
        (0.16, HALF_D * 2, FLOOR_CLEAR), m_wall)
    box(col, f"WallR_{key}", (HALF_W, 0, cy),
        (0.16, HALF_D * 2, FLOOR_CLEAR), m_wall)

    # ---- Wall baseboard (0.12m tall × 0.03m deep) ----
    box(col, f"BaseboardBack_{key}", (0, -HALF_D + 0.075, 0.06),
        (HALF_W * 2 - 0.4, 0.03, 0.12), m_trim)
    box(col, f"BaseboardL_{key}", (-HALF_W + 0.075, 0, 0.06),
        (0.03, HALF_D * 2 - 0.8, 0.12), m_trim)
    box(col, f"BaseboardR_{key}", (HALF_W - 0.075, 0, 0.06),
        (0.03, HALF_D * 2 - 0.8, 0.12), m_trim)

    # ---- Ceiling coffer pattern (4 recessed panels, 0.08m deep) ----
    m_coffer = mat(f"Coffer_{key}", (0.04, 0.06, 0.09, 1.0), rough=0.60, bump=0.03)
    coff_z = FLOOR_CLEAR - 0.04
    coff_w = (HALF_W * 2 - 2.0) / 2
    coff_d = (HALF_D * 2 - 2.0) / 2
    for cx in (-1, 1):
        for cy in (-1, 1):
            box(col, f"Coffer_{cx}_{cy}_{key}",
                (cx * coff_w / 2, cy * coff_d / 2, coff_z),
                (coff_w - 0.2, coff_d - 0.2, 0.08), m_coffer)

    # ---- Crown molding — classical stepped cornice at ceiling-wall junction ----
    m_crown = mat("ATLAS_Crown", (0.08, 0.10, 0.13, 1.0), rough=0.55, metal=0.3, bump=0.02)
    cr_z = FLOOR_CLEAR - 0.02
    # Three stacked bands along back wall
    box(col, f"CrownBack_0_{key}", (0, -HALF_D + 0.07, cr_z),
        (HALF_W * 2, 0.04, 0.025), m_crown)
    box(col, f"CrownBack_1_{key}", (0, -HALF_D + 0.08, cr_z - 0.03),
        (HALF_W * 2 - 0.15, 0.03, 0.025), m_crown)
    box(col, f"CrownBack_2_{key}", (0, -HALF_D + 0.09, cr_z - 0.06),
        (HALF_W * 2 - 0.3, 0.02, 0.03), m_crown)
    # Along left wall
    box(col, f"CrownL_0_{key}", (-HALF_W + 0.07, 0, cr_z),
        (0.04, HALF_D * 2, 0.025), m_crown)
    box(col, f"CrownL_1_{key}", (-HALF_W + 0.08, 0, cr_z - 0.03),
        (0.03, HALF_D * 2 - 0.15, 0.025), m_crown)
    box(col, f"CrownL_2_{key}", (-HALF_W + 0.09, 0, cr_z - 0.06),
        (0.02, HALF_D * 2 - 0.3, 0.03), m_crown)
    # Along right wall
    box(col, f"CrownR_0_{key}", (HALF_W - 0.07, 0, cr_z),
        (0.04, HALF_D * 2, 0.025), m_crown)
    box(col, f"CrownR_1_{key}", (HALF_W - 0.08, 0, cr_z - 0.03),
        (0.03, HALF_D * 2 - 0.15, 0.025), m_crown)
    box(col, f"CrownR_2_{key}", (HALF_W - 0.09, 0, cr_z - 0.06),
        (0.02, HALF_D * 2 - 0.3, 0.03), m_crown)

    # ---- Window reveal on back wall (3m wide × 2m tall, centered at z=1.2m) ----
    m_reveal = mat(f"WindowReveal_{key}", (0.02, 0.04, 0.07, 1.0), rough=0.85, bump=0.06)
    m_sill = mat(f"WindowSill_{key}", (0.12, 0.14, 0.18, 1.0), rough=0.45, metal=0.25, bump=0.02)
    m_lintel = mat(f"WindowLintel_{key}", (0.10, 0.12, 0.16, 1.0), rough=0.50, metal=0.30, bump=0.02)
    box(col, f"WinReveal_{key}", (0, -HALF_D + 0.06, 1.2),
        (3.0, 0.08, 2.0), m_reveal)
    box(col, f"WinSill_{key}", (0, -HALF_D + 0.02, 0.22),
        (3.2, 0.10, 0.04), m_sill)
    box(col, f"WinLintel_{key}", (0, -HALF_D + 0.02, 2.22),
        (3.2, 0.10, 0.06), m_lintel)

    # ---- Steel corner posts ----
    for sx in (-1, 1):
        box(col, f"Post_{key}_{sx}", (sx * (HALF_W - 0.2), -HALF_D + 0.3, cy),
            (0.4, 0.4, FLOOR_CLEAR), m_steel)

    # ---- PENDANT LIGHTS (2 warm + 1 neutral) ----
    warm = (1.0, 0.92, 0.78)
    neutral = (1.0, 0.96, 0.88)
    pendant_light(col, f"{key}_pendant_0", (-2.5, 0, FLOOR_CLEAR - 0.05),
                  color=warm, wattage=2.0, cord_len=0.4, temp="warm")
    pendant_light(col, f"{key}_pendant_1", (2.5, 0, FLOOR_CLEAR - 0.05),
                  color=neutral, wattage=2.0, cord_len=0.5, temp="neutral")
    pendant_light(col, f"{key}_pendant_b", (0, -3, FLOOR_CLEAR - 0.05),
                  color=warm, wattage=1.5, cord_len=0.35, temp="warm")

    # ---- Wall sconces removed for GLB budget ----


# --------------------------------------------------------------------------- #
# PER-FLOOR INTERIORS — ENHANCED WITH RICHER PBR + TASK LIGHTING
# --------------------------------------------------------------------------- #
def f_basement(col, acc):
    steel = mat("b_steel", (0.28, 0.32, 0.38, 1.0), rough=0.25, metal=0.90,
                bump=0.02, rough_var=True, scale=20.0)
    water = mat("b_water", (0.08, 0.28, 0.42, 1.0), rough=0.10, alpha=0.80,
                bump=0.008)
    pipe = mat("b_pipe", (*acc, 1.0), rough=0.35, metal=0.55,
               emit=acc, emit_str=0.5, bump=0.015)
    panel = mat("b_panel", (0.06, 0.10, 0.16, 1.0), rough=0.28, metal=0.65,
                emit=(0.0, 0.4, 0.6), emit_str=1.0, bump=0.025, rough_var=True)
    grating = mat("b_grate", (0.12, 0.15, 0.20, 1.0), rough=0.50, metal=0.70,
                  bump=0.04, rough_var=True)
    concrete = mat("b_concrete", (0.15, 0.17, 0.20, 1.0), rough=0.85, bump=0.08,
                   rough_var=True)

    # Concrete floor overlay
    box(col, "ConcFloor", (0, 0, 0.04), (HALF_W * 2 - 0.9, HALF_D * 2 - 0.9, 0.02), concrete)

    # Main reservoir
    cyl(col, "Reservoir", (-3.5, 0, 1.3), 2.2, 2.6, steel, verts=12)
    cyl(col, "ReservoirWater", (-3.5, 0, 1.2), 2.0, 2.2, water, verts=12)
    # Reservoir ladder
    box(col, "ResLadderL", (-5.4, 0.6, 1.3), (0.06, 0.06, 2.6), steel)
    box(col, "ResLadderR", (-5.4, -0.6, 1.3), (0.06, 0.06, 2.6), steel)
    for r in range(6):
        box(col, f"ResRung_{r}", (-5.4, 0, 0.3 + r * 0.45), (0.04, 1.2, 0.04), steel)
    # Digester
    cyl(col, "Digester", (3.0, -1.5, 1.4), 1.6, 2.8, steel, verts=16)
    box(col, "DigesterDome", (3.0, -1.5, 2.8), (3.0, 3.0, 0.08), steel)
    # Treatment skid
    box(col, "TreatSkid", (3.5, 2.2, 0.7), (3.0, 2.4, 1.4), steel)
    box(col, "TreatPanel", (3.5, 3.4, 1.4), (1.6, 0.06, 0.4), panel)
    # Control panel with status lights
    box(col, "ControlPanel", (-6.0, 4.0, 1.6), (1.2, 0.6, 1.2), panel)
    for s in range(5):
        box(col, f"CtlLED_{s}", (-6.3 + s * 0.4, 4.3, 2.1), (0.06, 0.02, 0.02),
            mat(f"b_led{s}", (0.0, 0.8, 0.2, 1) if s < 4 else (1, 0.2, 0.2, 1),
                emit=(0, 0.8, 0.2) if s < 4 else (1, 0.2, 0.2), emit_str=2.5))
    # Pipe manifold with glow accents
    for k in range(4):
        cyl(col, f"Riser{k}", (-7 + k * 0.6, -HALF_D + 1.0, 1.5), 0.12, 3.0, pipe, verts=10)
    box(col, "ManifoldPipe", (0, -HALF_D + 1.0, 2.6), (12, 0.24, 0.24), pipe)
    for v in range(6):
        cyl(col, f"Valve{v}", (-5.5 + v * 2.0, -HALF_D + 0.8, 2.7), 0.2, 0.3, steel, verts=12,
            rot=(math.radians(90), 0, 0))
    # Drain channels (2 instead of 3)
    for d in range(2):
        box(col, f"DrainChan{d}", (-3 + d * 6, 0, 0.03), (0.12, HALF_D * 2 - 2, 0.04), grating)
    # Catwalk
    box(col, "Catwalk", (-1.0, -4.0, 1.2), (5.0, 0.8, 0.06), grating)
    # Wall pipes
    for p in range(3):
        box(col, f"WallPipe{p}", (-HALF_W + 0.3, -1.5 + p * 1.8, 2.0), (0.08, 0.08, 2.5), pipe)
    # Structural columns
    for sx, sy in [(-4, -2), (4, -2), (-4, 3), (4, 3)]:
        box(col, f"StructCol_{sx}_{sy}", (sx, sy, 1.6), (0.3, 0.3, 3.2), steel)
    # DHW recirc pump
    cyl(col, "CircPump", (5.5, -4.0, 0.4), 0.3, 0.8, steel, verts=14)

    # --- PROPS: Basement furniture ---
    # Workbench with vise and tool rack
    box(col, "Workbench", (6.5, 3.5, 0.7), (2.0, 0.8, 0.06), steel)
    box(col, "BenchLegL", (5.6, 3.5, 0.3), (0.06, 0.06, 0.8), steel)
    box(col, "BenchLegR", (7.4, 3.5, 0.3), (0.06, 0.06, 0.8), steel)
    cyl(col, "Vise", (6.5, 3.5, 0.82), 0.08, 0.12, steel, verts=10)
    # Tool rack on wall above bench
    box(col, "ToolRackB", (6.5, 4.2, 1.6), (2.0, 0.04, 0.06), steel)
    for tk in range(4):
        cyl(col, f"Tool_{tk}", (6.5 - 0.6 + tk * 0.4, 4.2, 1.4),
            0.012, 0.5, steel, verts=6)
    # Warning stripes around digester (yellow/black hazard tape)
    for ws in range(6):
        box(col, f"WarnStripe_{ws}", (3.0, -1.5, 0.05),
            (2.8, 0.06, 0.01),
            mat(f"b_hazard{ws % 2}", 
                (0.95, 0.85, 0.08, 1.0) if ws % 2 == 0 else (0.05, 0.05, 0.06, 1.0),
                rough=0.35, 
                emit=(0.8, 0.7, 0.05) if ws % 2 == 0 else None, 
                emit_str=0.4 if ws % 2 == 0 else 0.0))
    # Pressure gauges on reservoir
    cyl(col, "GaugeRes", (-3.5, 2.3, 1.8), 0.08, 0.06, steel, verts=10,
        rot=(math.radians(90), 0, 0))
    sphere(col, "GaugeResDial", (-3.5, 2.35, 1.8), 0.06,
           mat("b_gauge", (0.12, 0.15, 0.20, 1.0), rough=0.18, metal=0.60, bump=0.008,
               emit=(0.1, 0.5, 0.6), emit_str=0.8), segs=8)
    # Pressure gauge on digester
    cyl(col, "GaugeDig", (3.0, -0.1, 2.2), 0.08, 0.06, steel, verts=10,
        rot=(math.radians(90), 0, 0))
    sphere(col, "GaugeDigDial", (3.0, -0.05, 2.2), 0.06,
           mat("b_gauge2", (0.12, 0.15, 0.20, 1.0), rough=0.18, metal=0.60, bump=0.008,
               emit=(0.1, 0.5, 0.6), emit_str=0.8), segs=8)
    # Spare parts bins — 4 small open-top boxes on shelving
    for sp in range(4):
        box(col, f"PartsBin_{sp}", (-7.5, -3.5 + sp * 1.0, 1.0), (0.30, 0.25, 0.20), steel)
        box(col, f"BinFill_{sp}", (-7.5, -3.5 + sp * 1.0, 1.08), (0.22, 0.18, 0.04),
            mat(f"b_binfill{sp}", (0.6 + sp * 0.1, 0.5 + sp * 0.08, 0.4, 1.0),
                rough=0.70, bump=0.02))
    # Warning sign on wall "HIGH PRESSURE"
    box(col, "HPSign", (6.5, -HALF_D + 0.12, 2.0), (1.2, 0.03, 0.5),
         mat("b_hpsign", (1.0, 0.92, 0.05, 1.0), rough=0.25,
             emit=(1.0, 0.85, 0.0), emit_str=2.0))

    # --- SCENE: worker + environmental storytelling ---
    add_human(col, "basement_worker", (-5.5, 3.5, 0.05), rotation_z=math.radians(15), pose="working")

    # Water puddle on floor near reservoir
    box(col, "Puddle", (-3.5, 0.5, 0.045), (1.8, 1.2, 0.015),
        mat("b_puddle", (0.04, 0.10, 0.18, 1.0), rough=0.05, alpha=0.40,
            emit=(0.06, 0.15, 0.25), emit_str=0.4))

    # Rust stains on digester surface
    for rs in range(3):
        box(col, f"Rust_{rs}", (3.0 + (rs - 1) * 0.6, -1.5 + (rs - 1) * 0.4, 1.6),
            (0.3, 0.25, 0.02),
            mat(f"b_rust{rs}", (0.55, 0.22, 0.08, 1.0), rough=0.90, bump=0.04))

    # "DANGER" floor marking near control panel / digester
    box(col, "DangerMark", (3.0, -3.0, 0.035), (1.6, 0.25, 0.01),
        mat("b_danger", (1.0, 0.1, 0.1, 1.0), rough=0.30,
            emit=(1.0, 0.08, 0.08), emit_str=1.5))


def f_water(col, acc):
    tank = mat("w_tank", (0.18, 0.38, 0.52, 1.0), rough=0.22, metal=0.65,
               bump=0.03, rough_var=True, scale=18.0)
    purple = mat("w_purple", (0.55, 0.30, 0.75, 1.0), rough=0.35,
                 emit=(0.55, 0.30, 0.75), emit_str=0.8, bump=0.015)
    blue = mat("w_blue", (*acc, 1.0), rough=0.35, emit=acc, emit_str=0.8, bump=0.015)
    pump = mat("w_pump", (0.20, 0.24, 0.28, 1.0), rough=0.28, metal=0.80,
               bump=0.02, rough_var=True)
    filter_m = mat("w_filter", (0.32, 0.38, 0.42, 1.0), rough=0.38, metal=0.60,
                   bump=0.025, rough_var=True)
    chems = mat("w_chems", (0.85, 0.18, 0.18, 1.0), rough=0.50, metal=0.20,
                emit=(0.85, 0.18, 0.18), emit_str=0.5, bump=0.015)
    panel = mat("w_panel", (0.06, 0.10, 0.16, 1.0), rough=0.28, metal=0.65,
                emit=(0.0, 0.4, 0.6), emit_str=1.0, bump=0.025, rough_var=True)
    tile = mat("w_tile", (0.70, 0.72, 0.75, 1.0), rough=0.40, bump=0.04)

    # Tile floor
    box(col, "TileFloor", (0, 0, 0.04), (HALF_W * 2 - 0.9, HALF_D * 2 - 0.9, 0.02), tile)

    # Water tanks
    for k in range(2):
        cyl(col, f"Tank{k}", (-4 + k * 4.5, -1.0, 1.4), 1.2, 2.6, tank, verts=12)
        box(col, f"TankBase{k}", (-4 + k * 4.5, -1.0, 0.1), (1.8, 1.8, 0.12), tank)
    # Pump array
    for p in range(3):
        box(col, f"PumpUnit{p}", (3.0 + p * 1.0, 2.8, 0.6), (0.5, 0.7, 1.0), pump)
        cyl(col, f"PumpDish{p}", (3.25 + p * 1.0, 2.8, 0.9), 0.15, 0.1, pump, verts=10,
            rot=(math.radians(90), 0, 0))
    # Filtration skid
    box(col, "FilterSkid", (3.0, -3.0, 0.7), (4.0, 1.4, 1.2), filter_m)
    for f in range(3):
        cyl(col, f"FilterCan{f}", (2.0 + f * 1.0, -3.0, 1.2), 0.35, 0.8, filter_m, verts=12)
    # Chemical dosing
    for d in range(2):
        cyl(col, f"DoseTank{d}", (-6.5 + d * 1.2, 4.0, 0.8), 0.4, 1.4, chems, verts=16)
    # Pipe manifold
    box(col, "Manifold", (0, -HALF_D + 0.8, 2.2), (12, 0.16, 0.16), pump)
    for v in range(3):
        cyl(col, f"ManifoldValve{v}", (-4 + v * 4.0, -HALF_D + 0.7, 2.3), 0.2, 0.25, pump, verts=10,
            rot=(math.radians(90), 0, 0))
    # Control panel
    box(col, "ControlPanel", (-7.0, 2.0, 1.6), (0.6, 1.6, 1.2), panel)
    for s in range(5):
        box(col, f"CPLed{s}", (-7.0, 1.2 + s * 0.4, 2.2), (0.02, 0.06, 0.02),
            mat(f"w_cpled{s}", (0, 0.8, 0.2, 1) if s % 3 != 0 else (1, 0.6, 0.1, 1),
                emit=(0, 0.8, 0.2) if s % 3 != 0 else (1, 0.6, 0.1), emit_str=2.0))
    # Riser columns
    box(col, "PurpleRiser", (HALF_W - 0.8, 0, 1.5), (0.2, HALF_D * 1.6, 0.2), purple)
    box(col, "BlueRiser", (HALF_W - 1.3, 0, 1.5), (0.2, HALF_D * 1.6, 0.2), blue)
    # Floor drain grid
    for d in range(3):
        box(col, f"DrainCh{d}", (-4 + d * 4, 0, 0.03), (0.15, 9.0, 0.04),
            mat("w_grate", (0.12, 0.15, 0.20, 1), rough=0.50, metal=0.70, bump=0.04))

    # --- PROPS: Water furniture ---
    # Pipe elbows / 90° bends
    for pe in range(3):
        ec = cyl(col, f"Elbow_{pe}", (-6.5 + pe * 2.0, -HALF_D + 1.0, 2.0),
                 0.10, 0.5, pump, verts=8)
        ec.rotation_euler = (0, math.radians(90), math.radians(30))
    # Flow meters — inline cylinder sections with small emissive display
    for fm in range(2):
        cyl(col, f"FlowMeter_{fm}", (-4.5 + fm * 7.0, -HALF_D + 0.5, 2.5),
            0.08, 0.30, pump, verts=10)
        box(col, f"FlowDisp_{fm}", (-4.5 + fm * 7.0, -HALF_D + 0.35, 2.65),
            (0.06, 0.10, 0.02),
            mat(f"w_flowdisp{fm}", (0.1, 0.5, 0.7, 1.0),
                emit=(0.05, 0.45, 0.65), emit_str=1.5))
    # Chemical barrels (4 near dosing tanks)
    for br in range(4):
        cyl(col, f"ChemBarrel_{br}", (-6.2 + br * 0.5, 4.0 + (br % 2) * 0.6, 0.35),
            0.20, 0.55,
            mat(f"w_barrel{br}", ((0.22 + br * 0.08, 0.35 + br * 0.05, 0.65, 1.0) if br < 2
                else (0.82, 0.18 + br * 0.05, 0.22, 1.0)),
                rough=0.40, metal=0.30, bump=0.02), verts=12)
    # Floor drainage grate — detailed grid
    for dg in range(5):
        box(col, f"DrainBarH_{dg}", (-2.0, -4.0 + dg * 2.0, 0.025), (1.2, 0.015, 0.015), pump)
    for dv in range(5):
        box(col, f"DrainBarV_{dv}", (-1.4 + dv * 0.6, -0.5, 0.025), (0.015, 0.8, 0.015), pump)
    # Wall-mounted safety shower
    cyl(col, "SafetyShower", (-6.0, -4.5, 2.0), 0.04, 0.8, pump, verts=8)
    cyl(col, "ShowerArm", (-6.0, -4.0, 2.4), 0.015, 0.4, pump, verts=6,
        rot=(math.radians(90), 0, 0))
    sphere(col, "ShowerHead", (-5.8, -4.0, 2.4), 0.06,
           mat("w_shower", (0.78, 0.82, 0.86, 1.0), rough=0.20, metal=0.70, bump=0.008), segs=6)
    # Clipboard/signage near control panel
    box(col, "Clipboard", (-7.0, 1.0, 1.8), (0.15, 0.22, 0.01),
        mat("w_clip", (0.72, 0.68, 0.58, 1.0), rough=0.75, bump=0.02))
    box(col, "ClipPaper", (-7.0, 1.0, 1.82), (0.12, 0.18, 0.005),
         mat("w_clippaper", (0.95, 0.93, 0.88, 1.0), rough=0.85, bump=0.01))

    # --- SCENE: technician + environmental details ---
    add_human(col, "water_tech", (3.0, 2.0, 0.05), rotation_z=math.radians(-10), pose="working")

    # Wet floor sign
    cyl(col, "WetSignPole", (0, 1.5, 0.15), 0.03, 0.60,
        mat("w_signpole", (0.12, 0.14, 0.18, 1.0), rough=0.40, metal=0.50), verts=6)
    box(col, "WetSignBoard", (0, 1.5, 0.50), (0.25, 0.02, 0.20),
        mat("w_wetsign", (1.0, 0.95, 0.05, 1.0), rough=0.30,
            emit=(1.0, 0.90, 0.0), emit_str=1.2))

    # Pipe condensation drips under cold water pipes (manifold at y=-HALF_D+0.8)
    for dd in range(3):
        cyl(col, f"CondDrip_{dd}", (-3 + dd * 3, -HALF_D + 0.68, 2.0),
            0.015, 0.08,
            mat(f"w_drip{dd}", (0.10, 0.35, 0.55, 1.0), rough=0.05, alpha=0.50,
                emit=(0.08, 0.28, 0.48), emit_str=0.3), verts=4)


def f_energy(col, acc):
    rack = mat("e_rack", (0.12, 0.14, 0.18, 1.0), rough=0.38, metal=0.70,
               bump=0.025, rough_var=True, scale=22.0)
    cell = mat("e_cell", (*acc, 1.0), rough=0.45, emit=acc, emit_str=1.0,
               bump=0.015)
    inv = mat("e_inv", (0.16, 0.18, 0.22, 1.0), rough=0.28, metal=0.85,
              bump=0.02, rough_var=True)
    tray = mat("e_tray", (0.18, 0.20, 0.25, 1.0), rough=0.38, metal=0.60,
               bump=0.025, rough_var=True)
    hv = mat("e_hv", (0.85, 0.12, 0.12, 1.0), rough=0.35,
             emit=(0.85, 0.12, 0.12), emit_str=0.8, bump=0.015)
    cool = mat("e_cool", (0.32, 0.38, 0.45, 1.0), rough=0.22, metal=0.70,
               bump=0.02, rough_var=True, scale=18.0)
    floor_m = mat("e_floor", (0.08, 0.10, 0.14, 1.0), rough=0.80, bump=0.06)
    steel = mat("e_steel", (0.18, 0.22, 0.26, 1.0), rough=0.30, metal=0.85, bump=0.02, rough_var=True)

    # ESD floor
    box(col, "ESDFloor", (0, 0, 0.04), (HALF_W * 2 - 0.9, HALF_D * 2 - 0.9, 0.02), floor_m)

    # Battery racks — 2 rows of 3
    for r in range(2):
        for c in range(3):
            x = -4.5 + c * 3.6
            y = -2.2 + r * 4.0
            box(col, f"Battery_{r}_{c}", (x, y, 1.1), (2.4, 1.0, 2.0), rack)
            box(col, f"BattLED_{r}_{c}", (x, y + 0.52, 1.6), (2.0, 0.05, 0.8), cell)
    # Battery cable trenches
    for tr in range(2):
        box(col, f"BattTrench{tr}", (-3.5 + tr * 9.0, 0, 0.03), (0.6, 8.0, 0.06),
            mat("e_trench", (0.06, 0.08, 0.12, 1), rough=0.80, bump=0.05))
    # Inverter cabinets
    box(col, "Inverters", (6.2, -3.0, 1.0), (2.6, 1.4, 1.8), inv)
    box(col, "InvDisplay", (6.2, -2.3, 1.8), (1.2, 0.04, 0.3),
        mat("e_display", (0.1, 0.5, 0.8, 1), emit=(0.1, 0.5, 0.8), emit_str=1.5, bump=0.008))
    # HV switchgear
    box(col, "HVPanel", (-7.0, -4.0, 1.4), (0.8, 2.0, 2.6), hv)

    # LV distribution
    box(col, "LVPanel", (-7.0, 4.2, 1.2), (0.6, 1.2, 2.2),
        mat("e_lv", (0.18, 0.22, 0.28, 1), rough=0.28, metal=0.60, bump=0.02, rough_var=True))
    # Cable trays
    for ct in range(3):
        box(col, f"CableTray{ct}", (-4 + ct * 4, 0, 3.0), (0.3, 9.0, 0.06), tray)
    # Cooling unit
    box(col, "CoolingUnit", (5.5, 3.5, 1.6), (1.6, 1.2, 3.0), cool)
    box(col, "CoolVent", (5.5, 3.5, 3.0), (1.2, 0.8, 0.04), tray)
    # Transformer
    box(col, "Transformer", (6.8, 1.0, 1.0), (1.2, 1.2, 1.8),
        mat("e_xfmr", (0.22, 0.28, 0.32, 1), rough=0.38, metal=0.75, bump=0.025, rough_var=True))
    for b in range(3):
        box(col, f"BusBar{b}", (-4 + b * 4, 0, 1.8), (0.6, 0.04, 0.04),
            mat("e_bus", (0.6, 0.4, 0.1, 1), metal=0.95, rough=0.18, bump=0.015))

    # --- PROPS: Energy furniture ---
    # Cable management — bundles in cable trays
    for cb in range(3):
        for cc in range(6):
            cyl(col, f"Cable_{cb}_{cc}", (-4 + cb * 4, -4.0 + cc * 1.5, 3.0),
                0.015, 8.5, mat("e_cable", (0.05, 0.07, 0.10, 1.0),
                                rough=0.75, metal=0.15), verts=6,
                rot=(0, math.radians(90), 0))
    # Busbar insulators (ceramic-colored)
    for bi in range(4):
        cyl(col, f"BusInsulator_{bi}", (-5 + bi * 3.3, 0, 1.82), 0.06, 0.08,
            mat("e_insulator", (0.82, 0.78, 0.72, 1.0), rough=0.35, bump=0.02, scale=12.0), verts=8)
    # Ventilation grilles on inverter cabinets
    for vg in range(3):
        box(col, f"InvVent_{vg}", (6.2, -3.0, 1.0 + vg * 0.5),
            (2.2, 0.03, 0.25), tray)
    # Warning labels on HV panel
    box(col, "HVWarn_0", (-7.0, -3.2, 2.4), (0.06, 0.20, 0.08),
        mat("e_warn0", (1.0, 0.75, 0.05, 1.0), emit=(1.0, 0.70, 0.0), emit_str=2.0))
    box(col, "HVWarn_1", (-7.0, -2.8, 2.4), (0.06, 0.20, 0.08),
        mat("e_warn1", (1.0, 0.75, 0.05, 1.0), emit=(1.0, 0.70, 0.0), emit_str=2.0))
    # Fire extinguisher
    cyl(col, "FireExt", (7.5, -4.5, 0.6), 0.08, 0.7,
        mat("e_firex", (0.90, 0.12, 0.08, 1.0), rough=0.25, metal=0.50,
            emit=(0.85, 0.10, 0.05), emit_str=0.3), verts=10)
    box(col, "FireExtBracket", (7.5, -4.35, 0.9), (0.10, 0.04, 0.08), steel)
    # UPS status display on wall
    box(col, "UPSDisplay", (-7.0, 4.2, 2.4), (0.4, 0.25, 0.04),
         mat("e_upsdisp", (0.1, 0.45, 0.7, 1.0), emit=(0.05, 0.4, 0.65), emit_str=1.5))

    # --- SCENE: technician + environmental details ---
    add_human(col, "energy_tech", (6.2, -2.2, 0.05), rotation_z=math.radians(20), pose="working")

    # Heat haze suggestion near transformer
    box(col, "HeatHaze", (6.8, 1.0, 1.55), (1.0, 0.8, 0.04),
        mat("e_haze", (0.75, 0.72, 0.68, 1.0), rough=0.15, alpha=0.25,
            emit=(0.80, 0.78, 0.72), emit_str=0.3))

    # Emergency stop button on wall
    cyl(col, "EmergStop", (-HALF_W + 0.12, -4.0, 1.4), 0.06, 0.08,
        mat("e_estop", (1.0, 0.05, 0.05, 1.0), rough=0.15,
            emit=(1.0, 0.05, 0.05), emit_str=2.5), verts=12,
        rot=(math.radians(90), 0, 0))


def f_food(col, acc):
    frame = mat("f_frame", (0.18, 0.22, 0.20, 1.0), rough=0.50, metal=0.40,
                bump=0.015, rough_var=True, scale=16.0)
    crop = mat("f_crop", (*acc, 1.0), rough=0.55, emit=acc, emit_str=0.9,
               bump=0.025)
    grow = mat("f_grow", (1.0, 0.35, 0.70, 1.0), emit=(1.0, 0.25, 0.65), emit_str=3.0,
               bump=0.008)
    nutr = mat("f_nutr", (0.08, 0.48, 0.28, 1.0), rough=0.28, metal=0.20,
               emit=(0.08, 0.48, 0.28), emit_str=0.7, bump=0.015)
    irr = mat("f_irr", (0.20, 0.24, 0.28, 1.0), rough=0.38, metal=0.70,
              bump=0.02, rough_var=True)
    pack = mat("f_pack", (0.48, 0.42, 0.38, 1.0), rough=0.70, bump=0.04)
    panel = mat("f_panel", (0.06, 0.10, 0.16, 1.0), rough=0.28, metal=0.65,
                emit=(0.1, 0.4, 0.2), emit_str=0.8, bump=0.025, rough_var=True)
    floor_m = mat("f_floor", (0.22, 0.20, 0.18, 1.0), rough=0.85, bump=0.05)
    steel = mat("f_steel", (0.18, 0.22, 0.26, 1.0), rough=0.30, metal=0.85, bump=0.02, rough_var=True)

    # Industrial floor
    box(col, "FoodFloor", (0, 0, 0.04), (HALF_W * 2 - 0.9, HALF_D * 2 - 0.9, 0.02), floor_m)

    # Grow bays — 3 bays, 3 levels each (reduced for GLB budget)
    for bay in range(3):
        x = -5.0 + bay * 5.0
        for lvl in range(3):
            z = 0.5 + lvl * 0.8
            box(col, f"Tray_{bay}_{lvl}", (x, 0, z), (3.0, 5.0, 0.12), frame)
            box(col, f"Crop_{bay}_{lvl}", (x, 0, z + 0.12), (2.8, 4.6, 0.14), crop)
            box(col, f"Grow_{bay}_{lvl}", (x, 0, z + 0.42), (2.6, 0.18, 0.06), grow)
    # Irrigation manifold
    box(col, "IrrManifold", (0, -HALF_D + 0.8, 2.4), (14, 0.12, 0.12), irr)
    for i in range(4):
        box(col, f"IrrLine{i}", (-4.5 + i * 3, -HALF_D + 0.8, 2.0), (0.04, 0.04, 0.8), irr)
    # Nutrient tanks
    for n in range(2):
        cyl(col, f"NutrTank{n}", (6.5, -1.5 + n * 2.5, 1.0), 0.5, 1.8, nutr, verts=10)
    # Environmental control panel
    box(col, "EnvControl", (6.5, 3.2, 1.6), (0.8, 1.2, 1.2), panel)
    for d in range(6):
        box(col, f"EnvLED{d}", (6.5, 2.4 + d * 0.25, 2.2), (0.02, 0.05, 0.02),
            mat(f"f_envled{d}", (0, 0.8, 0.2, 1) if d < 5 else (1, 0.4, 0.1, 1),
                emit=(0, 0.8, 0.2) if d < 5 else (1, 0.4, 0.1), emit_str=2.0))
    # Packing station
    box(col, "PackingTable", (6.5, -4.5, 0.7), (1.4, 0.8, 1.0), pack)
    # Climate unit
    box(col, "ClimateUnit", (-7.5, 0, 1.8), (0.6, 2.0, 1.2),
        mat("f_climate", (0.28, 0.32, 0.38, 1), rough=0.38, metal=0.60, bump=0.025, rough_var=True))
    box(col, "ClimateVent", (-7.5, 0, 2.8), (0.4, 1.6, 0.04),
        mat("f_vent", (0.12, 0.15, 0.20, 1), rough=0.50, metal=0.70, bump=0.02))
    # Walkway strips
    for w in range(3):
        box(col, f"Walkway{w}", (-4 + w * 4, 0, 0.03),
            (0.6, 5.0, 0.04), mat("f_walk", (0.22, 0.25, 0.28, 1), rough=0.80, bump=0.04))
    # Ceiling irrigation drops
    for d in range(4):
        box(col, f"IrrDrop{d}", (-4.5 + d * 2.0, -1.5 + (d % 2) * 3, 2.4),
            (0.03, 0.03, 0.6), irr)

    # --- PROPS: Food furniture ---
    # Seedling trays on lower grow levels
    for bay in range(3):
        x = -5.0 + bay * 5.0
        box(col, f"SeedTray_{bay}", (x, 3.5, 0.42), (2.0, 1.4, 0.04), frame)
        for sd in range(5):
            sx = x - 0.7 + sd * 0.35
            cyl(col, f"Seedling_{bay}_{sd}", (sx, 3.5 + (-0.4 + (sd % 2) * 0.3), 0.46),
                0.015, 0.03, mat(f"f_seed{bay}{sd}", (0.28, 0.72, 0.28, 1.0),
                                  rough=0.60, emit=(0.18, 0.55, 0.18), emit_str=0.3), verts=6)
    # Harvest baskets stacked near packing station
    for bk in range(3):
        box(col, f"Basket_{bk}", (6.5, -4.5 + bk * 0.3, 0.55 + bk * 0.28),
            (0.6, 0.5, 0.22), pack)
    # Temperature/humidity sensors on wall
    for th in range(2):
        box(col, f"THSensor_{th}", (-7.5 + th * 15.0, 1.5 + th * 2.0, 2.0), (0.08, 0.06, 0.04), panel)
        sphere(col, f"THDot_{th}", (-7.5 + th * 15.0, 1.55 + th * 2.0, 2.03),
               0.015, mat(f"f_thdot{th}", (0.1, 0.85, 0.3, 1.0),
                          emit=(0.1, 0.8, 0.2), emit_str=2.0), segs=4)
    # Irrigation drippers on irrigation lines
    for dr in range(6):
        cyl(col, f"Dripper_{dr}", (-4.5 + dr * 1.5, -HALF_D + 0.8, 2.1),
            0.008, 0.06, irr, verts=4, rot=(math.radians(90), 0, 0))
    # Tool rack (brooms/rakes leaning on wall)
    for tr in range(3):
        trc = cyl(col, f"Tool_{tr}", (7.0, -3.0 + tr * 0.5, 0.8),
                  0.015, 2.0, irr, verts=6)
        trc.rotation_euler = (0, 0, math.radians(-12))
    # Scale/weigh station
    box(col, "WeighPlatform", (7.5, -4.5, 0.35), (0.6, 0.5, 0.06), steel)
    box(col, "WeighDisplay", (7.5, -4.5, 0.45), (0.15, 0.08, 0.12),
         mat("f_weighdisp", (0.1, 0.5, 0.3, 1.0), emit=(0.05, 0.45, 0.25), emit_str=1.0))

    # --- SCENE: workers + environmental details ---
    add_human(col, "food_packer", (6.0, -4.0, 0.05), rotation_z=math.radians(10), pose="working")
    add_human(col, "food_grower", (-4.0, 1.0, 0.05), rotation_z=math.radians(-5), pose="standing")

    # Spilled seeds on floor near seedling trays
    for ss in range(8):
        sphere(col, f"SpillSeed_{ss}", (-4.8 + (ss % 4) * 0.08, 3.2 + (ss // 4) * 0.08, 0.05),
               0.015,
               mat(f"f_spill{ss}", (0.35, 0.22, 0.08, 1.0), rough=0.70, bump=0.02), segs=4)

    # Harvest calendar on wall — thin box with colored squares
    box(col, "HarvestCal", (-HALF_W + 0.1, -1.0, 1.8), (0.02, 0.6, 0.4),
        mat("f_calboard", (0.92, 0.90, 0.86, 1.0), rough=0.85, bump=0.01))
    for hc in range(5):
        box(col, f"CalBlock_{hc}", (-HALF_W + 0.12, -1.2 + hc * 0.12, 1.7 + (hc % 2) * 0.08),
            (0.01, 0.08, 0.06),
            mat(f"f_cal{hc}", ((hc % 3) * 0.4, 0.6 - (hc % 2) * 0.25, 0.4 + (hc % 2) * 0.2, 1.0),
                rough=0.50, bump=0.01))


def f_shelter(col, acc):
    part = mat("s_part", (0.68, 0.64, 0.58, 1.0), rough=0.80, bump=0.05)
    bed = mat("s_bed", (*acc, 1.0), rough=0.70, emit=acc, emit_str=0.4,
              bump=0.04)
    floor_m = mat("s_floor", (0.28, 0.24, 0.20, 1.0), rough=0.90, bump=0.06)
    wood = mat("s_wood", (0.42, 0.32, 0.22, 1.0), rough=0.85, bump=0.06)
    soft = mat("s_soft", (0.52, 0.48, 0.42, 1.0), rough=0.90, bump=0.03)
    storage = mat("s_store", (0.18, 0.22, 0.26, 1.0), rough=0.50, metal=0.40,
                  bump=0.025, rough_var=True)
    light_m = mat("s_light", (1, 0.94, 0.82, 1), emit=(1, 0.88, 0.75), emit_str=2.0,
                  bump=0.006)

    box(col, "UnitFloor", (0, 0, 0.05), (HALF_W * 2 - 1, HALF_D * 2 - 1, 0.06), floor_m)

    # 5 residential units (compact layout)
    for u in range(5):
        x = -5.5 + u * 2.8
        box(col, f"Partition_{u}", (x - 1.4, 0, 1.2), (0.08, HALF_D * 1.6, 2.4), part)
        box(col, f"Bed_{u}", (x, -2.2, 0.45), (1.6, 1.0, 0.5), bed)
        box(col, f"Desk_{u}", (x, 2.5, 0.7), (1.4, 0.6, 0.06), wood)
        box(col, f"Locker_{u}", (x, -3.8, 0.8), (0.6, 0.5, 1.5), storage)
    # 2 pendants shared between units
    for pi in range(2):
        pendant_light(col, f"s_pendant_{pi}", (-2.0 + pi * 4.0, 0, FLOOR_CLEAR - 0.05),
                      color=(1.0, 0.92, 0.78), wattage=1.8, cord_len=0.3, temp="warm")
    # Corridor
    box(col, "Corridor", (0, -0.2, 0.07), (1.2, 10.0, 0.02),
        mat("s_carpet", (0.16, 0.12, 0.10, 1), rough=1.0, bump=0.05))
    # Common table
    box(col, "CommonTable", (-0.5, -4.5, 0.55), (1.6, 1.0, 0.06), wood)
    # Kitchenette
    box(col, "KitchenCounter", (6.0, 3.5, 0.6), (2.0, 0.6, 1.0), wood)
    box(col, "KitchenSink", (6.0, 3.5, 1.0), (0.8, 0.5, 0.06),
        mat("s_sink", (0.32, 0.38, 0.42, 1), metal=0.90, rough=0.18, bump=0.015, rough_var=True))

    # ---- Door frames for each residential unit ----
    door_mat = mat("s_doorframe", (0.20, 0.22, 0.26, 1.0), rough=0.45, metal=0.40, bump=0.02)
    for u in range(5):
        x = -5.5 + u * 2.8
        box(col, f"DoorJambL_{u}", (x - 1.4, -1.2, 1.2), (0.04, 0.08, 2.4), door_mat)
        box(col, f"DoorJambR_{u}", (x - 1.4, 0.8, 1.2), (0.04, 0.08, 2.4), door_mat)
        box(col, f"DoorHeader_{u}", (x - 1.4, -0.2, 2.4), (1.0, 0.08, 0.04), door_mat)

    # ---- Window mullions / transoms on back wall for natural light ----
    mull_mat = mat("s_mullion", (0.10, 0.12, 0.16, 1.0), rough=0.40, metal=0.35, bump=0.015)
    for w in range(3):
        wx = -3.5 + w * 3.5
        box(col, f"MullionV_{w}", (wx, -HALF_D + 0.06, 1.2),
            (0.04, 0.04, 2.0), mull_mat)
        box(col, f"Transom_{w}", (wx, -HALF_D + 0.06, 2.0),
            (1.8, 0.04, 0.04), mull_mat)

    # --- PROPS: Shelter furniture ---
    # Bed pillows
    for u in range(5):
        x = -5.5 + u * 2.8
        box(col, f"Pillow_{u}", (x + 0.1, -2.4, 0.70), (0.5, 0.35, 0.06),
            mat("s_pillow", (0.92, 0.90, 0.88, 1.0), rough=0.85, bump=0.02))
    # Desk lamps
    for u in range(5):
        x = -5.5 + u * 2.8
        cyl(col, f"LampStem_{u}", (x, 2.8, 0.85), 0.012, 0.25, storage, verts=6)
        sphere(col, f"LampBulb_{u}", (x, 2.8, 0.98), 0.04,
               mat(f"s_lampbulb{u}", (1.0, 0.96, 0.85, 1.0),
                   emit=(1.0, 0.92, 0.78), emit_str=1.2), segs=6)
    # Books/shelf items on wall shelf
    for u in range(5):
        x = -5.5 + u * 2.8
        box(col, f"Bookshelf_{u}", (x, 1.0, 1.5), (1.2, 0.08, 0.02), wood)
        box(col, f"Book_{u}_0", (x - 0.3, 0.96, 1.58), (0.06, 0.04, 0.15),
            mat(f"s_bk{u}", (0.75, 0.25, 0.18, 1.0), rough=0.70, bump=0.02))
        box(col, f"Book_{u}_1", (x + 0.1, 0.96, 1.55), (0.05, 0.04, 0.18),
            mat(f"s_bk{u}b", (0.18, 0.42, 0.62, 1.0), rough=0.70, bump=0.02))
        box(col, f"Book_{u}_2", (x + 0.4, 0.96, 1.60), (0.07, 0.04, 0.12),
            mat(f"s_bk{u}c", (0.35, 0.55, 0.38, 1.0), rough=0.70, bump=0.02))
    # Wall clock
    cyl(col, "WallClock", (0, 2.0, 2.2), 0.2, 0.04,
        mat("s_clockring", (0.18, 0.22, 0.26, 1.0), rough=0.40, metal=0.60, bump=0.01), verts=16,
        rot=(math.radians(90), 0, 0))
    box(col, "ClockFace", (0, 2.18, 2.2), (0.35, 0.30, 0.02),
        mat("s_clockface", (0.95, 0.93, 0.90, 1.0), rough=0.60, bump=0.01))
    # Notice board
    box(col, "NoticeBoard", (6.5, 2.5, 1.5), (1.0, 0.04, 0.7), wood)
    box(col, "Notice_0", (6.5, 2.44, 1.4), (0.15, 0.01, 0.12),
        mat("s_notice0", (1.0, 0.92, 0.42, 1.0)))
    box(col, "Notice_1", (6.5, 2.44, 1.6), (0.12, 0.01, 0.15),
        mat("s_notice1", (0.65, 0.88, 1.0, 1.0)))
    box(col, "Notice_2", (6.5, 2.44, 1.78), (0.18, 0.01, 0.08),
        mat("s_notice2", (1.0, 0.42, 0.42, 1.0)))
    # Potted plant near common area
    cyl(col, "PotPlant", (5.0, -4.0, 0.35), 0.2, 0.4,
        mat("s_pot", (0.42, 0.28, 0.18, 1.0), rough=0.85, bump=0.04), verts=10)
    sphere(col, "PlantFoliage", (5.0, -4.0, 0.65), 0.25,
           mat("s_plantfg", (0.18, 0.55, 0.22, 1.0), rough=0.75, bump=0.04), segs=8)
    # Rug/mat at entrance to each unit
    for u in range(5):
        x = -5.5 + u * 2.8
        box(col, f"Rug_{u}", (x - 1.4, -0.2, 0.05), (0.8, 1.0, 0.015),
            mat(f"s_rug{u}", (0.42 + u * 0.08, 0.35 + u * 0.04, 0.28, 1.0), rough=0.95, bump=0.02))

    # --- SCENE: residents ---
    add_human(col, "shelter_sitter", (-5.5, -1.8, 0.50), rotation_z=math.radians(-15),
              height=1.65, pose="sitting")
    add_human(col, "shelter_stander", (-0.5, 2.0, 0.05), rotation_z=math.radians(5), pose="standing")

    # Welcome mat at building entrance (near corridor front)
    box(col, "WelcomeMat", (-0.5, HALF_D - 0.5, 0.04), (1.0, 0.6, 0.015),
        mat("s_welcome", (0.45, 0.28, 0.15, 1.0), rough=0.95, bump=0.03))

    # Family photo on desk (desk_0 is at x=-5.5, y=2.5, z=0.7)
    box(col, "FamilyPhoto", (-5.5, 2.7, 0.74), (0.15, 0.02, 0.10),
        mat("s_photoframe", (0.22, 0.18, 0.14, 1.0), rough=0.50, bump=0.02))
    box(col, "PhotoPic", (-5.5, 2.72, 0.74), (0.12, 0.005, 0.08),
        mat("s_photopic", (0.65, 0.60, 0.55, 1.0), rough=0.60, bump=0.01))

    # Laundry basket near kitchenette
    box(col, "LaundryBasket", (7.0, 3.0, 0.20), (0.50, 0.40, 0.35),
        mat("s_basket", (0.25, 0.28, 0.32, 1.0), rough=0.80, bump=0.03))
    for lc in range(3):
        box(col, f"LaundryItem_{lc}", (7.0, 3.0 + (lc - 1) * 0.06, 0.30 + lc * 0.04),
            (0.30, 0.18, 0.04),
            mat(f"s_laundry{lc}", (0.58 + lc * 0.1, 0.52, 0.48, 1.0), rough=0.90, bump=0.02))





def f_air(col, acc):
    duct = mat("a_duct", (0.52, 0.58, 0.62, 1.0), rough=0.28, metal=0.80,
               bump=0.025, rough_var=True, scale=20.0)
    glow = mat("a_glow", (*acc, 1.0), rough=0.15, emit=acc, emit_str=1.8,
               alpha=0.45, bump=0.008)
    hepa = mat("a_hepa", (0.28, 0.32, 0.40, 1.0), rough=0.38, metal=0.60,
               bump=0.025, rough_var=True)
    scrub = mat("a_scrub", (0.08, 0.38, 0.42, 1.0), rough=0.28, metal=0.30,
                emit=(0.08, 0.38, 0.42), emit_str=0.8, bump=0.02)
    panel = mat("a_panel", (0.06, 0.10, 0.16, 1.0), rough=0.28, metal=0.65,
                emit=(0.2, 0.6, 0.6), emit_str=1.0, bump=0.025, rough_var=True)
    fan_m = mat("a_fan", (0.16, 0.20, 0.24, 1.0), rough=0.28, metal=0.80,
                bump=0.02, rough_var=True)
    floor_m = mat("a_floor", (0.18, 0.20, 0.22, 1.0), rough=0.80, bump=0.05)
    steel = mat("a_steel", (0.18, 0.22, 0.26, 1.0), rough=0.30, metal=0.85, bump=0.02, rough_var=True)

    box(col, "AirFloor", (0, 0, 0.04), (HALF_W * 2 - 0.9, HALF_D * 2 - 0.9, 0.02), floor_m)

    # Central lung column
    cyl(col, "LungCore", (0, 0, FLOOR_CLEAR / 2), 1.6, FLOOR_CLEAR, glow, verts=12)
    cyl(col, "LungBase", (0, 0, 0.1), 1.8, 0.15, duct, verts=12)
    # Radial ducts (reduced geometry)
    for a in range(6):
        ang = a * math.pi / 3
        x, y = math.cos(ang) * 5.0, math.sin(ang) * 3.5
        cyl(col, f"Duct_{a}", (x, y, 2.6), 0.30, 5.5, duct, verts=8,
            rot=(0, math.radians(90), ang))
    # Fan array
    for k in range(3):
        cyl(col, f"Fan_{k}", (-5.0 + k * 4.5, -HALF_D + 0.8, 2.6), 0.7, 0.4, fan_m, verts=12,
            rot=(math.radians(90), 0, 0))
        box(col, f"FanGuard{k}", (-5.0 + k * 4.5, -HALF_D + 0.8, 2.4), (0.04, 1.4, 1.4),
            mat("a_guard", (0.12, 0.15, 0.20, 1), rough=0.50, metal=0.70, bump=0.025))
    # Scrubbers
    for s in range(2):
        cyl(col, f"Scrubber{s}", (-4 + s * 6, 3.5, 1.8), 0.8, 3.2, scrub, verts=12,
            rot=(0, 0, 0))
        box(col, f"ScrubInlet{s}", (-4 + s * 6, 4.3, 2.2), (0.4, 0.4, 0.08), duct)
    # HEPA housings
    for h in range(2):
        box(col, f"HEPA_{h}", (3.5, -2.0 + h * 4.0, 1.6), (1.2, 0.8, 0.8), hepa)
        box(col, f"HEPAFlange{h}", (4.1, -2.0 + h * 4.0, 1.6), (0.06, 1.0, 1.0), hepa)
    # Ceiling duct grid
    for g in range(3):
        box(col, f"CnDuct{g}", (-3.5 + g * 3.5, 0, 3.0), (0.15, 0.15, 0.3), duct)
    # Air handler
    box(col, "AirHandler", (6.5, -1.0, 1.8), (1.6, 3.0, 1.6),
        mat("a_handler", (0.22, 0.28, 0.32, 1), metal=0.50, rough=0.38, bump=0.025, rough_var=True))
    box(col, "AHUVent", (6.5, 0.5, 2.8), (1.2, 0.8, 0.04),
        mat("a_vent", (0.12, 0.15, 0.20, 1), rough=0.50, metal=0.70, bump=0.02))
    # CO2 monitor panel
    box(col, "CO2Panel", (7.0, 4.5, 1.6), (0.4, 0.6, 0.4), panel)

    # --- PROPS: Air/Lung furniture ---
    # Duct dampers across duct sections
    for da in range(3):
        box(col, f"DuctDamper_{da}", (-4 + da * 4, 0, 2.7), (0.5, 0.25, 0.04), duct)
    # Pressure sensors on ducts
    for ps in range(4):
        cyl(col, f"PressSensor_{ps}", (-3 + ps * 2, -2.0 + ps % 2 * 4.0, 2.8),
            0.04, 0.15, duct, verts=10)
        sphere(col, f"PressTip_{ps}", (-3 + ps * 2, -2.0 + ps % 2 * 4.0, 2.92),
               0.02, mat(f"a_presstip{ps}", (1.0, 0.3, 0.1, 1.0),
                         emit=(1.0, 0.2, 0.05), emit_str=2.0), segs=4)
    # Filter change indicator on HEPA housing
    box(col, "FilterChangeLED", (3.5, 0, 2.1), (0.06, 0.12, 0.02),
        mat("a_filterled", (1.0, 0.6, 0.05, 1.0), emit=(1.0, 0.5, 0.0), emit_str=2.5))
    # Wall louvers for intake/exhaust
    for lv in range(2):
        box(col, f"WallLouver_{lv}", (-HALF_W + 0.15 if lv == 0 else HALF_W - 0.15, -2.0 + lv * 4.0, 1.5),
            (0.06, 1.2, 1.0), duct)
        for sl in range(3):
            box(col, f"LouvSlat_{lv}_{sl}", 
                (-HALF_W + 0.15 if lv == 0 else HALF_W - 0.15, -2.0 + lv * 4.0, 1.2 + sl * 0.3),
                (0.04, 1.0, 0.04), 
                mat("a_louvslt", (0.10, 0.14, 0.20, 1.0), rough=0.45, metal=0.60, bump=0.02))
    # CO2 monitor display
    box(col, "CO2Display", (7.0, 4.5, 2.0), (0.25, 0.35, 0.04),
        mat("a_co2disp", (0.15, 0.55, 0.55, 1.0), emit=(0.1, 0.5, 0.5), emit_str=1.5))
    # Maintenance ladder on lung core
    box(col, "LungLadderL", (0, -1.8, 1.6), (0.04, 0.04, FLOOR_CLEAR), steel)
    box(col, "LungLadderR", (0, -1.2, 1.6), (0.04, 0.04, FLOOR_CLEAR), steel)
    for lr in range(8):
         box(col, f"LungRung_{lr}", (0, -1.5, 0.3 + lr * 0.4), (0.03, 0.3, 0.03), steel)

    # --- SCENE: environmental storytelling ---
    # Maintenance log book on small shelf
    box(col, "MaintLogShelf", (-HALF_W + 0.15, -3.5, 1.6), (0.20, 0.12, 0.02), steel)
    box(col, "MaintLogBook", (-HALF_W + 0.15, -3.5, 1.63), (0.14, 0.08, 0.03),
        mat("a_logbook", (0.65, 0.45, 0.18, 1.0), rough=0.85, bump=0.03))

    # CO2 warning sticker on lung core
    box(col, "CO2Sticker", (1.62, 0, 1.8), (0.02, 0.18, 0.12),
        mat("a_co2sticker", (1.0, 0.85, 0.05, 1.0), rough=0.25,
            emit=(1.0, 0.80, 0.0), emit_str=1.8))


def f_health(col, acc):
    soft = mat("h_soft", (0.82, 0.84, 0.86, 1.0), rough=0.85, bump=0.04)
    accm = mat("h_acc", (*acc, 1.0), rough=0.55, emit=acc, emit_str=0.5,
               bump=0.015)
    pod = mat("h_pod", (0.18, 0.38, 0.42, 1.0), rough=0.28, metal=0.40,
              bump=0.025, rough_var=True, scale=16.0)
    steel = mat("h_steel", (0.22, 0.26, 0.30, 1.0), rough=0.28, metal=0.80,
                bump=0.02, rough_var=True)
    blue = mat("h_blue", (0.32, 0.52, 0.68, 1.0), rough=0.28, metal=0.30,
               emit=(0.18, 0.38, 0.58), emit_str=0.7, bump=0.015)
    panel = mat("h_panel", (0.06, 0.10, 0.16, 1.0), rough=0.28, metal=0.65,
                emit=(0.0, 0.4, 0.6), emit_str=1.0, bump=0.025, rough_var=True)
    curtain = mat("h_curtain", (0.52, 0.58, 0.62, 1.0), rough=0.80, alpha=0.25,
                  bump=0.008)
    floor_m = mat("h_floor", (0.65, 0.68, 0.72, 1.0), rough=0.55, bump=0.04)

    box(col, "CommonsFloor", (0, 0, 0.05), (HALF_W * 2 - 1, HALF_D * 2 - 1, 0.06), floor_m)

    # Treatment beds
    for b in range(3):
        x = -5.5 + b * 3.8
        box(col, f"Bed_{b}", (x, -2.4, 0.45), (2.2, 1.1, 0.5), soft)
        box(col, f"BedPad_{b}", (x, -2.4, 0.55), (1.8, 0.9, 0.15),
            mat(f"h_sheet{b}", (1, 1, 1, 1), rough=0.90, bump=0.01))
        box(col, f"Monitor_{b}", (x + 0.9, -3.2, 1.4), (0.7, 0.1, 0.5), accm)
    # Curtain tracks
    for c in range(3):
        box(col, f"CurtainTrk{c}", (-5.5 + c * 3.8, -2.4, 3.1), (3.0, 0.04, 0.04), steel)
        box(col, f"Curtain{c}", (-5.5 + c * 3.8, -2.4, 1.8), (2.8, 0.02, 2.6), curtain)
    # Telehealth pods
    for p in range(2):
        cyl(col, f"TelehealthPod_{p}", (-2.5 + p * 5.0, 2.6, 1.2), 1.1, 2.4, pod, verts=12)
        box(col, f"PodScreen_{p}", (-2.5 + p * 5.0, 3.7, 1.8), (0.8, 0.05, 0.6),
            mat(f"h_screen{p}", (0.1, 0.3, 0.6, 1), emit=(0.1, 0.3, 0.6), emit_str=1.5))
    # Nurse station
    box(col, "NurseStation", (-6.0, 4.5, 0.7), (2.0, 1.2, 1.2), blue)
    box(col, "NurseCounter", (-6.0, 4.5, 1.3), (2.0, 1.2, 0.04), steel)
    box(col, "NurseScreen", (-7.0, 4.5, 1.8), (0.04, 0.8, 0.5), panel)
    # Medicine cabinet
    box(col, "MedCabinet", (6.0, 4.0, 1.2), (1.2, 0.5, 1.6), steel)
    box(col, "MedDoor", (6.0, 4.3, 1.4), (0.8, 0.04, 1.0),
        mat("h_meddoor", (0.82, 0.88, 0.92, 1), metal=0.60, rough=0.18, bump=0.015))
    # Wash station
    box(col, "WashStation", (6.5, -3.5, 0.8), (1.2, 1.2, 0.8), steel)
    cyl(col, "WashBasin", (6.5, -3.5, 1.2), 0.4, 0.1, steel, verts=12)
    # Clean utility
    box(col, "CleanUtility", (6.0, -5.0, 1.0), (1.8, 0.8, 1.8),
        mat("h_clean", (0.52, 0.68, 0.72, 1), rough=0.28, metal=0.30, bump=0.02, rough_var=True))
    # Access WC
    box(col, "AccessWC", (6.0, 3.0, 0.8), (3.0, 3.0, 1.6),
        mat("h_wc", (0.48, 0.52, 0.58, 1), rough=0.50))
    box(col, "WCDoor", (6.0, 1.5, 1.2), (2.4, 0.06, 2.0),
        mat("h_wcdoor", (0.68, 0.72, 0.78, 1), rough=0.50, bump=0.03))

    # ---- Privacy screen partitions between treatment beds ----
    screen_mat = mat("h_screenwall", (0.72, 0.74, 0.78, 1.0), rough=0.60, alpha=0.30, bump=0.005)
    for b in range(2):
        x_mid = -5.5 + (b + 0.5) * 3.8
        box(col, f"PrivacyScreen_{b}", (x_mid, -2.4, 1.2),
            (0.04, 2.0, 2.0), screen_mat)

    # ---- Handrail along main circulation path (at y ~ 2.0, along x axis) ----
    rail_mat = mat("h_rail", (0.22, 0.26, 0.30, 1.0), rough=0.30, metal=0.80, bump=0.02, rough_var=True)
    box(col, "Handrail", (0, 2.0, 1.1), (HALF_W * 2 - 2.0, 0.04, 0.04), rail_mat)
    for r in range(7):
        bx = -6.5 + r * 2.16
        box(col, f"RailBracket_{r}", (bx, 2.0, 0.9),
            (0.04, 0.15, 0.4), rail_mat)

    # --- PROPS: Health furniture ---
    # IV stands
    for iv in range(2):
        cyl(col, f"IVStand_{iv}", (-4.5 + iv * 7.0, -2.4, 0.9), 0.012, 1.6, steel, verts=6)
        box(col, f"IVBag_{iv}", (-4.5 + iv * 7.0, -1.9, 1.3), (0.12, 0.06, 0.18),
            mat("h_ivbag", (0.82, 0.86, 0.90, 1.0), rough=0.30, alpha=0.50, bump=0.005))
    # Vital signs monitor on wall near each bed
    for v in range(3):
        x = -5.5 + v * 3.8
        box(col, f"VitalsMon_{v}", (x + 0.9, -3.2, 1.8), (0.7, 0.04, 0.4),
            mat(f"h_vitals{v}", (0.08, 0.12, 0.20, 1.0), rough=0.18, metal=0.50,
                emit=(0.1, 0.5, 0.8), emit_str=1.5))
    # Examination light — articulated arm + bulb
    for el in range(2):
        ex = -5.5 + el * 7.0
        cyl(col, f"ExamArm1_{el}", (ex, -3.6, 2.0), 0.012, 0.6, steel, verts=6,
            rot=(0, math.radians(45), 0))
        cyl(col, f"ExamArm2_{el}", (ex + 0.3, -3.6, 2.2), 0.012, 0.4, steel, verts=6,
            rot=(0, math.radians(-30), 0))
        sphere(col, f"ExamBulb_{el}", (ex + 0.15, -3.6, 2.02), 0.05,
               mat(f"h_exambulb{el}", (1.0, 0.96, 0.88, 1.0),
                   emit=(1.0, 0.92, 0.82), emit_str=3.0), segs=6)
    # Supply cart
    box(col, "SupplyCart", (-6.0, 1.0, 0.4), (1.0, 0.6, 0.6), steel)
    box(col, "CartTop", (-6.0, 1.0, 0.7), (1.0, 0.6, 0.02),
        mat("h_carttop", (0.78, 0.82, 0.86, 1.0), rough=0.30, metal=0.60, bump=0.01))
    for cw in range(2):
        cyl(col, f"CartWheel_{cw}", (-5.8 + cw * 0.4, 1.0 + (-1 if cw % 2 else 1) * 0.3, 0.1),
            0.05, 0.04, steel, verts=10, rot=(math.radians(90), 0, 0))
    # Hand sanitizer dispenser
    cyl(col, "Sanitizer", (-7.0, 4.0, 1.3), 0.05, 0.20,
        mat("h_sani", (0.82, 0.86, 0.90, 1.0), rough=0.25, metal=0.40, bump=0.008), verts=10,
        rot=(math.radians(90), 0, 0))
    # Waiting area chairs (bench seating)
    for bc in range(3):
        box(col, f"WaitChair_{bc}", (5.5, 3.0 + bc * 1.0, 0.35), (0.4, 1.2, 0.35), soft)
        box(col, f"WaitSeat_{bc}", (5.5, 3.0 + bc * 1.0, 0.55), (0.3, 1.0, 0.06),
             mat(f"h_wait{b}", (0.42, 0.38, 0.52, 1.0), rough=0.80, bump=0.03))

    # --- SCENE: patients, nurse, wheelchair + environmental details ---
    add_human(col, "health_patient", (-5.5, -2.2, 0.50), rotation_z=math.radians(0),
              height=1.65, pose="sitting")
    add_human(col, "health_nurse", (-5.0, 4.0, 0.05), rotation_z=math.radians(-10), pose="working")

    # Wheelchair: small box seat + wheels
    box(col, "WheelchairSeat", (-1.0, -2.4, 0.35), (0.40, 0.35, 0.06),
        mat("h_wcseat", (0.18, 0.22, 0.28, 1.0), rough=0.40, metal=0.60, bump=0.02))
    for wc in range(2):
        cyl(col, f"Wheel_{wc}", (-1.0 + (wc - 0.5) * 0.44, -2.4, 0.18), 0.12, 0.04,
            mat("h_wcwheel", (0.06, 0.06, 0.08, 1.0), rough=0.70), verts=10,
            rot=(math.radians(90), 0, 0))
    # Person in wheelchair
    add_human(col, "health_wcuser", (-1.0, -2.4, 0.42), rotation_z=math.radians(0),
              height=1.50, pose="sitting")

    # Medical chart on wall
    box(col, "MedChart", (-HALF_W + 0.1, -3.0, 1.6), (0.02, 0.5, 0.4),
        mat("h_chart", (0.95, 0.94, 0.92, 1.0), rough=0.80, bump=0.01))
    for ml in range(4):
        box(col, f"ChartLine_{ml}", (-HALF_W + 0.12, -3.0, 1.5 + ml * 0.10),
            (0.01, 0.35, 0.015),
            mat(f"h_cline{ml}", (0.1 + ml * 0.2, 0.3, 0.3 + ml * 0.1, 1.0), rough=0.50))

    # Tissue box on nightstand
    box(col, "TissueBox", (-4.0, -3.2, 1.0), (0.12, 0.18, 0.08),
        mat("h_tissue", (0.88, 0.86, 0.82, 1.0), rough=0.70, bump=0.02))

    # "QUIET PLEASE" sign in corridor
    box(col, "QuietSign", (0, 1.8, 2.0), (0.50, 0.02, 0.15),
        mat("h_quiet", (0.55, 0.28, 0.78, 1.0), rough=0.25,
            emit=(0.50, 0.22, 0.72), emit_str=1.2))


def f_restoration(col, acc):
    waterm = mat("r_water", (0.18, 0.52, 0.68, 1.0), rough=0.04, metal=0.0, alpha=0.65,
                 emit=(0.08, 0.38, 0.58), emit_str=0.4, bump=0.012)
    deck = mat("r_deck", (0.42, 0.36, 0.28, 1.0), rough=0.85, bump=0.07)
    plant = mat("r_plant", (*acc, 1.0), rough=0.65, emit=acc, emit_str=0.5,
                bump=0.04)
    stone = mat("r_stone", (0.32, 0.30, 0.26, 1.0), rough=0.80, bump=0.10)
    light_m = mat("r_light", (1, 0.94, 0.82, 1), emit=(1, 0.88, 0.75), emit_str=2.5,
                  bump=0.006)
    cushion = mat("r_cushion", (0.62, 0.52, 0.42, 1.0), rough=0.90, bump=0.04)
    foliage = mat("r_foliage", (0.18, 0.52, 0.22, 1.0), rough=0.80, bump=0.06)
    steel = mat("r_steel", (0.14, 0.18, 0.22, 1.0), rough=0.32, metal=0.85, bump=0.02, rough_var=True)

    box(col, "Deck", (0, 0, 0.05), (HALF_W * 2 - 1, HALF_D * 2 - 1, 0.06), deck)

    # Pool
    box(col, "Pool", (-2.0, 0, 0.35), (7.0, 6.0, 0.6),
        mat("r_pooledge", (0.28, 0.32, 0.36, 1), rough=0.38, metal=0.50, bump=0.04, rough_var=True))
    box(col, "PoolWater", (-2.0, 0, 0.45), (6.6, 5.6, 0.5), waterm)
    # Path tiles
    for t in range(6):
        ang = -math.pi / 4 + t * math.pi / 10
        x = 5.5 * math.cos(ang)
        y = 5.0 * math.sin(ang)
        box(col, f"PathTile{t}", (x, y, 0.1), (0.5, 0.5, 0.06), stone)
    # Lounge seating (2 instead of 3)
    for k in range(2):
        x = 5.0
        y = -2.0 + k * 4.0
        box(col, f"Lounger_{k}", (x, y, 0.4), (1.0, 1.9, 0.4), deck)
        box(col, f"LoungerCushion{k}", (x, y + 0.2, 0.6), (0.8, 1.4, 0.2), cushion)
    # Planters
    for k in range(2):
        box(col, f"Planter_{k}", (6.6, -2.0 + k * 4.0, 0.6), (0.8, 0.8, 0.8), plant)
        box(col, f"Foliage_{k}", (6.6, -2.0 + k * 4.0, 0.9), (0.6, 0.6, 0.4), foliage)
    for k in range(2):
        box(col, f"PoolPlanter{k}", (-5.0, -1.0 + k * 2.0, 0.5), (0.6, 0.6, 0.7), plant)
        box(col, f"PoolFoliage{k}", (-5.0, -1.0 + k * 2.0, 0.8), (0.5, 0.5, 0.3), foliage)
    # Meditation circle
    for c in range(4):
        ang = c * math.pi / 2
        x = -2.0 + 4.0 * math.cos(ang)
        y = 0 + 4.0 * math.sin(ang)
        cyl(col, f"MedCushion{c}", (x, y, 0.15), 0.3, 0.2, cushion, verts=14)
    # Lighting poles
    for p in range(2):
        box(col, f"LightPole{p}", (-5 + p * 10, 4.0, 1.5), (0.1, 0.1, 3.0), stone)
        light_bulb(col, f"r_pole{p}", (-5 + p * 10, 4.0, 3.0),
                   color=(1.0, 0.92, 0.78), wattage=3.0, radius=0.12, temp="warm")
    # Water feature
    cyl(col, "FountainBase", (-4.5, 2.0, 0.25), 0.6, 0.4, stone, verts=14)
    cyl(col, "FountainWater", (-4.5, 2.0, 0.4), 0.4, 0.2, waterm, verts=14)
    # Yoga mats
    for yg in range(3):
        box(col, f"YogaMat{yg}", (5.5, 3.0 + yg * 1.2, 0.08), (0.6, 1.8, 0.04),
            mat(f"r_yoga{yg}", (0.3 + yg * 0.2, 0.1 + yg * 0.15, 0.4, 1), rough=0.90, bump=0.02))
    # Ambient accent strip
    box(col, "AccentStrip", (0, HALF_D - 0.2, 1.6), (HALF_W * 2 - 4, 0.06, 0.06),
        mat("r_accent_glow", (*acc, 1.0), emit=acc, emit_str=1.0, bump=0.008))

    # --- PROPS: Restoration furniture ---
    # Pool ladder
    box(col, "PoolLadderL", (-5.2, 2.2, 0.50), (0.04, 0.04, 0.8), stone)
    box(col, "PoolLadderR", (-5.2, 1.4, 0.50), (0.04, 0.04, 0.8), stone)
    for rn in range(3):
        box(col, f"PoolRung_{rn}", (-5.2, 1.8, 0.35 + rn * 0.25), (0.03, 0.4, 0.03), steel)
    # Pool floats
    for pf in range(2):
        pf_cyl = cyl(col, f"PoolFloat_{pf}", (-1.0 + pf * 2.0, 1.0 + pf * 1.0, 0.72),
                     0.35, 0.06, mat(f"r_float{pf}", (0.2 + pf * 0.5, 0.5, 0.8 - pf * 0.4, 1.0),
                                       rough=0.30, bump=0.01), verts=16)
        pf_cyl.scale = (1.0, 0.55, 1.0)
    # Towel rack
    cyl(col, "TowelRack", (5.5, 1.5, 1.3), 0.02, 2.0, steel, verts=6,
        rot=(math.radians(90), 0, 0))
    box(col, "Towel_0", (4.8, 1.5, 1.3), (0.04, 0.5, 0.3),
        mat("r_towel", (0.88, 0.82, 0.78, 1.0), rough=0.90, bump=0.02))
    box(col, "Towel_1", (5.2, 1.5, 1.3), (0.04, 0.5, 0.3),
        mat("r_towelb", (0.62, 0.58, 0.72, 1.0), rough=0.90, bump=0.02))
    # Meditation cushions (extra near yoga mats)
    for mc in range(3):
        cyl(col, f"ExtraCushion_{mc}", (5.8, 2.0 + mc * 1.4, 0.15), 0.25, 0.12, cushion, verts=12)
    # Water fountain
    cyl(col, "FountBasin", (-5.5, 3.8, 0.35), 0.35, 0.30, stone, verts=12)
    cyl(col, "FountPipe", (-5.5, 3.8, 0.65), 0.02, 0.3, steel, verts=6)
    sphere(col, "FountNozzle", (-5.5, 3.8, 0.80), 0.03,
           mat("r_fountnoz", (0.75, 0.78, 0.82, 1.0), rough=0.15, metal=0.80, bump=0.005), segs=6)
    # Planter boxes with succulents
    for pb in range(2):
        box(col, f"BigPlanter_{pb}", (-6.5, -3.0 + pb * 3.5, 0.5), (1.0, 0.7, 0.5), plant)
        for sc in range(3):
            sx = -6.5 + (sc - 1) * 0.25
            sy = -3.0 + pb * 3.5 + (sc % 2) * 0.2 - 0.2
            sphere(col, f"Succ_{pb}_{sc}", (sx, sy, 0.78),
                   0.06, mat(f"r_succ{pb}{sc}", (0.3 + sc * 0.15, 0.6 + sc * 0.08, 0.22, 1.0),
                             rough=0.70, bump=0.02), segs=6)
    # String lights between light poles
    for sl in range(3):
        cyl(col, f"StrLightWire_{sl}", (-5 + sl * 5, 4.0, 2.5), 0.008, 10.0, steel, verts=6,
            rot=(0, math.radians(90), 0))
        cyl(col, f"StrLightDrop_{sl}", (-5 + sl * 5, 4.0, 2.4), 0.01, 0.3, steel, verts=4)
        sphere(col, f"StrLightBulb_{sl}", (-5 + sl * 5, 4.0, 2.25), 0.04,
               mat(f"r_strbulb_{sl}", (1.0, 0.92, 0.78, 1.0),
                    emit=(1.0, 0.88, 0.70), emit_str=1.5), segs=6)

    # --- SCENE: people + environmental details ---
    add_human(col, "rest_lounger", (5.0, -2.0, 0.45), rotation_z=math.radians(0), pose="sitting")
    add_human(col, "rest_yoga", (5.5, 3.6, 0.12), rotation_z=math.radians(90),
              height=1.60, pose="sitting")
    add_human(col, "rest_poolside", (-2.0, 3.0, 0.05), rotation_z=math.radians(15), pose="standing")

    # Sunscreen bottle near lounger
    cyl(col, "Sunscreen", (5.5, -2.5, 0.45), 0.04, 0.10,
        mat("r_sunscreen", (1.0, 0.82, 0.22, 1.0), rough=0.35, bump=0.02), verts=8)

    # Pool rules sign
    box(col, "PoolRules", (-2.0, -3.0, 1.2), (0.35, 0.02, 0.25),
        mat("r_rulesboard", (0.92, 0.90, 0.86, 1.0), rough=0.80, bump=0.01))
    for pr in range(3):
        box(col, f"RuleLine_{pr}", (-2.0, -2.98, 1.35 - pr * 0.08), (0.25, 0.01, 0.015),
            mat(f"r_rule{pr}", (0.12, 0.18, 0.28, 1.0), rough=0.50))

    # Scattered leaves near planters
    for sl in range(6):
        sphere(col, f"Leaf_{sl}", (6.6 + (sl % 2) * 0.1 - 0.05, -2.0 + (sl // 2) * 0.15, 0.08),
               0.025,
               mat(f"r_leaf{sl}", (0.2 + (sl % 2) * 0.35, 0.5 + (sl % 2) * 0.15, 0.15, 1.0),
                   rough=0.90, bump=0.03), segs=4)


def f_rooftop(col, acc):
    panel = mat("rf_panel", (0.04, 0.08, 0.16, 1.0), rough=0.15, metal=0.65,
                emit=(0.30, 0.66, 1.0), emit_str=0.7, bump=0.015, rough_var=True, scale=22.0)
    steel = mat("rf_steel", (0.14, 0.18, 0.22, 1.0), rough=0.32, metal=0.85,
                bump=0.02, rough_var=True)
    tank = mat("rf_tank", (0.10, 0.34, 0.50, 1.0), rough=0.28, metal=0.40,
               bump=0.025, rough_var=True, scale=18.0)
    grating = mat("rf_grate", (0.12, 0.15, 0.20, 1.0), rough=0.50, metal=0.70,
                  bump=0.04, rough_var=True)
    equip = mat("rf_equip", (0.22, 0.28, 0.32, 1.0), rough=0.38, metal=0.60,
                bump=0.025, rough_var=True)
    white = mat("rf_white", (0.78, 0.80, 0.82, 1.0), rough=0.55, bump=0.03)
    deck_mat = mat("rf_deck", SLABC, rough=0.70, bump=0.06)

    box(col, "RoofDeck", (0, 0, -0.08), (HALF_W * 2 + 0.3, HALF_D * 2 + 0.3, 0.16), deck_mat)
    # Walkway grating
    box(col, "WalkwayGrate", (0, 0, 0.02), (14.0, 2.0, 0.04), grating)

    # Solar panels (4 per row × 2 rows + 2 center)
    for row in range(2):
        for k in range(4):
            p = box(col, f"Solar_{row}_{k}", (-5.4 + k * 3.6, -2.4 + row * 4.6, 0.7),
                    (3.2, 3.6, 0.12), panel)
            p.rotation_euler = (math.radians(-28), 0, 0)
        box(col, f"SolarFrame{row}", (-3.6, -0.1 + row * 4.6, 0.3),
            (10.0, 0.06, 0.1), steel)
    for k in range(2):
        p = box(col, f"SolarCenter_{k}", (-2.0 + k * 4.0, 0, 0.8),
                (3.6, 3.0, 0.12), panel)
        p.rotation_euler = (math.radians(-20), 0, 0)

    # Reservoir
    cyl(col, "Reservoir", (HALF_W - 2.5, -HALF_D + 2.5, 1.3), 1.6, 2.6, tank, verts=16)
    box(col, "ReservoirLid", (HALF_W - 2.5, -HALF_D + 2.5, 2.6), (3.0, 3.0, 0.08), tank)

    # Communications mast
    box(col, "Mast", (HALF_W - 2.5, HALF_D - 2.0, 2.4), (0.18, 0.18, 5.0), steel)
    box(col, "MastTip", (HALF_W - 2.5, HALF_D - 2.0, 5.0), (0.5, 0.5, 0.3),
        mat("rf_beacon", (1, 0.2, 0.2, 1), emit=(1, 0.1, 0.1), emit_str=6.0))
    # Satellite dish
    cyl(col, "DishMount", (HALF_W - 2.5, HALF_D - 2.0, 3.8), 0.06, 0.8, steel, verts=10)
    box(col, "SatDish", (HALF_W - 2.5, HALF_D - 1.5, 3.8), (0.8, 0.04, 0.6),
        mat("rf_dish", (0.82, 0.82, 0.88, 1), metal=0.90, rough=0.12, bump=0.008))

    # Equipment cabinets
    for e in range(3):
        box(col, f"EquipCab{e}", (HALF_W - 1.5, -HALF_D + e * 1.2, 0.6),
            (1.0, 0.8, 1.0), equip)
        box(col, f"CabLED{e}", (HALF_W - 1.5, -HALF_D + 0.3 + e * 1.2, 1.4),
            (0.02, 0.08, 0.02),
            mat(f"rf_cabled{e}", (0, 0.8, 0.2, 1), emit=(0, 0.8, 0.2), emit_str=2.0))
    # AC unit
    box(col, "ACUnit", (-HALF_W + 2.0, HALF_D - 1.5, 0.6), (1.8, 1.4, 1.0), white)
    box(col, "ACVent", (-HALF_W + 2.0, HALF_D - 1.5, 1.0), (1.4, 0.8, 0.04), steel)
    # Guardrail posts
    for g in range(6):
        x = -HALF_W + 1.0 + g * 2.8
        box(col, f"GuardrailPost{g}", (x, HALF_D - 0.2, 0.5), (0.08, 0.08, 1.0), steel)
        box(col, f"GuardrailHoriz{g}", (x, HALF_D - 0.2, 0.8), (2.8, 0.05, 0.06), steel)
    # Antenna array
    for a in range(3):
        box(col, f"Antenna{a}", (HALF_W - 1.0 + a * 0.4, HALF_D - 1.0, 2.0),
            (0.04, 0.04, 1.0), steel)
    # Rooftop light poles
    for p in range(2):
        light_bulb(col, f"rf_pole{p}", (-3 + p * 6, HALF_D - 1.0, 2.5),
                   color=(1.0, 0.96, 0.88), wattage=4.0, radius=0.10, temp="neutral")

    # ---- Parapet wall around perimeter (0.6m tall, 0.2m thick) ----
    parapet_mat = mat("rf_parapet", (0.12, 0.14, 0.18, 1.0), rough=0.60, bump=0.05, rough_var=True)
    pp_h = 0.6
    pp_z = pp_h / 2
    box(col, "ParapetFront", (0, HALF_D - 0.1, pp_z),
        (HALF_W * 2, 0.20, pp_h), parapet_mat)
    box(col, "ParapetBack", (0, -HALF_D + 0.1, pp_z),
        (HALF_W * 2, 0.20, pp_h), parapet_mat)
    box(col, "ParapetL", (-HALF_W + 0.1, 0, pp_z),
        (0.20, HALF_D * 2, pp_h), parapet_mat)
    box(col, "ParapetR", (HALF_W - 0.1, 0, pp_z),
        (0.20, HALF_D * 2, pp_h), parapet_mat)
    cap_mat = mat("rf_coping", (0.08, 0.10, 0.14, 1.0), rough=0.40, metal=0.35, bump=0.02)
    box(col, "ParapetCapBack", (0, -HALF_D + 0.1, pp_h),
        (HALF_W * 2 + 0.2, 0.26, 0.04), cap_mat)
    box(col, "ParapetCapL", (-HALF_W + 0.1, 0, pp_h),
        (0.26, HALF_D * 2, 0.04), cap_mat)
    box(col, "ParapetCapR", (HALF_W - 0.1, 0, pp_h),
        (0.26, HALF_D * 2, 0.04), cap_mat)

    # ---- Roof access hatch / stair bulkhead ----
    hatch_mat = mat("rf_hatch", (0.14, 0.18, 0.22, 1.0), rough=0.45, metal=0.70, bump=0.025, rough_var=True)
    box(col, "RoofHatchBase", (HALF_W - 2.5, -HALF_D + 1.5, 0.5),
        (1.8, 1.2, 0.8), hatch_mat)
    box(col, "RoofHatchLid", (HALF_W - 2.5, -HALF_D + 1.5, 0.9),
        (2.0, 1.4, 0.06), steel)
    hatch_door = box(col, "RoofHatchDoor", (HALF_W - 2.5, -HALF_D + 2.2, 0.7),
                     (1.6, 0.06, 1.0), steel)
    hatch_door.rotation_euler = (math.radians(30), 0, 0)

    # ---- Mechanical equipment screening louvers ----
    louver_mat = mat("rf_louver", (0.10, 0.14, 0.20, 1.0), rough=0.50, metal=0.60, bump=0.025)
    box(col, "MechScreenBack", (-HALF_W + 2.0, HALF_D - 2.0, 0.5),
        (3.6, 0.06, 0.8), louver_mat)
    box(col, "MechScreenSide", (-HALF_W + 0.2, HALF_D - 2.0, 0.5),
        (0.06, 2.0, 0.8), louver_mat)
    for ls in range(4):
        box(col, f"LouverSlat{ls}", (-HALF_W + 2.0, HALF_D - 2.0, 0.25 + ls * 0.18),
            (3.2, 0.04, 0.04), louver_mat)

    # --- PROPS: Rooftop furniture ---
    # Solar panel mounting rails
    for mr in range(5):
        box(col, f"SolarRail_{mr}", (-3.6 + mr * 2.4, -2.4, 0.20), (0.04, 3.6, 0.04), steel)
        box(col, f"SolarRailB_{mr}", (-3.6 + mr * 2.4, 2.2, 0.20), (0.04, 3.6, 0.04), steel)
    # Cable conduits from panels to equipment
    for c in range(3):
        cyl(col, f"Conduit_{c}", (-HALF_W + 2.0 + c * 1.5, 1.5, 0.35), 0.03, 3.0, steel, verts=6,
            rot=(math.radians(90), 0, 0))
    # Lightning rod on mast
    cyl(col, "LightningRod", (HALF_W - 2.5, HALF_D - 2.0, 4.8), 0.02, 1.2, steel, verts=8)
    sphere(col, "LightningTip", (HALF_W - 2.5, HALF_D - 2.0, 5.4), 0.06, steel, segs=6)
    # Roof drain
    cyl(col, "RoofDrain", (2.0, -HALF_D + 0.5, 0.02), 0.10, 0.06, steel, verts=8)
    box(col, "DrainGrate", (2.0, -HALF_D + 0.5, 0.05), (0.18, 0.18, 0.02), grating)
    # Safety tie-off points at roof edge
    for t in range(4):
        tx = -HALF_W + 1.5 + t * 4.0
        cyl(col, f"TieOff_{t}", (tx, HALF_D - 0.15, 0.25), 0.04, 0.20, steel, verts=8)
    # Wind sock
    cyl(col, "WindSockPole", (HALF_W - 3.5, HALF_D - 1.0, 1.4), 0.02, 2.8, steel, verts=8)
    ws = cyl(col, "WindSock", (HALF_W - 3.5, HALF_D - 1.0, 2.8), 0.08, 0.6, 
             mat("rf_sock", (1.0, 0.42, 0.08, 1.0), rough=0.80, bump=0.02), verts=12)
    ws.scale = (0.5, 0.5, 1.0)

    # --- SCENE: person + environmental details ---
    add_human(col, "rooftop_worker", (-5.4, -2.4, 0.05), rotation_z=math.radians(20), pose="standing")

    # Bird on parapet
    sphere(col, "BirdBody", (3.0, HALF_D - 0.12, 0.45), 0.04,
           mat("rf_bird", (0.35, 0.38, 0.42, 1.0), rough=0.60, bump=0.02), segs=6)
    box(col, "BirdWingL", (2.92, HALF_D - 0.08, 0.45), (0.03, 0.06, 0.01),
        mat("rf_birdwing", (0.30, 0.33, 0.38, 1.0), rough=0.60, bump=0.02))
    box(col, "BirdWingR", (3.08, HALF_D - 0.08, 0.45), (0.03, 0.06, 0.01),
        mat("rf_birdwing", (0.30, 0.33, 0.38, 1.0), rough=0.60, bump=0.02))

    # Maintenance tag on equipment cabinet
    box(col, "MaintTag", (HALF_W - 1.5, -HALF_D + 0.4, 1.2), (0.06, 0.01, 0.08),
        mat("rf_mtag", (1.0, 0.6, 0.08, 1.0), rough=0.40, emit=(1.0, 0.5, 0.0), emit_str=1.0))


def f_parking(col, acc):
    concrete = mat("p_conc", (0.18, 0.20, 0.22, 1.0), rough=0.85, bump=0.08, rough_var=True)
    line = mat("p_line", (0.88, 0.85, 0.72, 1.0), rough=0.30, emit=(0.88, 0.85, 0.72), emit_str=0.6,
               bump=0.005)
    column_m = mat("p_col", (0.22, 0.26, 0.30, 1.0), rough=0.45, metal=0.30, bump=0.03,
                   rough_var=True, scale=14.0)
    ev_charger = mat("p_ev", (*acc, 1.0), rough=0.35, emit=acc, emit_str=1.0, bump=0.015)
    duct = mat("p_duct", (0.38, 0.42, 0.46, 1.0), rough=0.30, metal=0.70, bump=0.025,
                rough_var=True, scale=18.0)
    vent = mat("p_vent", (0.12, 0.15, 0.20, 1.0), rough=0.50, metal=0.70, bump=0.025)
    ramp = mat("p_ramp", (0.15, 0.17, 0.19, 1.0), rough=0.80, bump=0.07)
    steel = mat("p_steel", (0.14, 0.18, 0.22, 1.0), rough=0.30, metal=0.85, bump=0.02,
                rough_var=True)
    arrow = mat("p_arrow", (1.0, 0.82, 0.08, 1.0), rough=0.28, emit=(1.0, 0.82, 0.08),
                emit_str=0.9, bump=0.005)

    # Concrete floor overlay
    box(col, "ParkFloor", (0, 0, 0.04), (HALF_W * 2 - 0.9, HALF_D * 2 - 0.9, 0.02), concrete)

    # ---- Structural columns (4 × 2 grid) ----
    for cx in range(4):
        for cy in range(2):
            x = -5.0 + cx * 3.3
            y = -2.5 + cy * 5.0
            box(col, f"PCol_{cx}_{cy}", (x, y, 1.6), (0.4, 0.4, 3.2), column_m)

    # ---- Rear parking bays (6 stalls along back wall, 2.4 m wide each) ----
    for s in range(6):
        cx = -6.8 + s * 2.4
        box(col, f"Stall_{s}", (cx + 1.2, -3.0, 0.03), (2.2, 0.08, 0.015), line)
        if s < 5:
            box(col, f"StallDiv_{s}", (cx + 2.4, -3.0, 0.03), (0.06, 5.0, 0.015), line)
        # Wheel stops
        box(col, f"WheelStop_{s}", (cx + 1.2, -0.6, 0.05), (1.8, 0.10, 0.06), column_m)

    # ---- EV chargers along rear wall (every other stall) ----
    for e in range(3):
        x = -5.4 + e * 4.8
        box(col, f"EVUnit_{e}", (x, -HALF_D + 0.55, 0.8), (0.4, 0.18, 1.4), ev_charger)
        box(col, f"EVLED_{e}", (x, -HALF_D + 0.46, 1.5), (0.06, 0.04, 0.06),
            mat(f"p_evled{e}", (0.0, 0.9, 0.3, 1), emit=(0.0, 0.9, 0.3), emit_str=3.0))

    # ---- Front visitor parking (4 compact stalls) ----
    for s in range(4):
        cx = -4.5 + s * 3.0
        box(col, f"FrontStall_{s}", (cx + 1.5, 3.2, 0.03), (2.6, 0.08, 0.015), line)
        if s < 3:
            box(col, f"FrontDiv_{s}", (cx + 3.0, 3.2, 0.03), (0.06, 4.0, 0.015), line)

    # ---- Access ramp (sloped entry on right side) ----
    box(col, "RampFloor", (HALF_W - 1.8, 0.5, -0.15), (1.8, 3.0, 0.30), ramp)
    box(col, "RampRail_L", (HALF_W - 2.7, 0.5, 0.2), (0.06, 3.0, 0.5), steel)
    box(col, "RampRail_R", (HALF_W - 0.9, 0.5, 0.2), (0.06, 3.0, 0.5), steel)

    # ---- Overhead ventilation main trunk ----
    box(col, "VentTrunk", (0, 0, 2.95), (12.0, 0.45, 0.20), duct)
    for d in range(3):
        box(col, f"VentBranch_{d}", (-4.0 + d * 4.0, 0, 2.88), (0.6, 0.35, 0.12), duct)
    # Vent grilles
    for g in range(4):
        box(col, f"VentGrille_{g}", (-4.0 + g * 2.7, 0, 3.04), (0.55, 0.35, 0.03), vent)

    # ---- Lane direction arrows (central aisle) ----
    box(col, "Arrow_L", (-3.5, 0.8, 0.035), (1.4, 0.5, 0.01), arrow)
    box(col, "Arrow_R", (3.5, -0.8, 0.035), (1.4, 0.5, 0.01), arrow)

    # ---- Fire safety cabinet ----
    box(col, "FireCabinet", (HALF_W - 0.5, -HALF_D + 0.35, 1.0), (0.3, 0.2, 0.6),
        mat("p_fire", (0.85, 0.15, 0.15, 1.0), rough=0.35, metal=0.40,
            emit=(0.85, 0.15, 0.15), emit_str=0.3))

    # ---- Exit sign (emissive) ----
    box(col, "ExitSign", (HALF_W - 0.2, HALF_D - 0.15, 2.6), (0.02, 0.4, 0.2),
        mat("p_exit", (0.1, 0.85, 0.3, 1.0), emit=(0.1, 0.85, 0.3), emit_str=2.5))

    # ---- Parking attendant booth ----
    box(col, "Booth", (-HALF_W + 1.5, 0, 0.65), (1.4, 1.2, 1.1),
        mat("p_booth", (0.42, 0.46, 0.52, 1.0), rough=0.50, metal=0.30, bump=0.03,
            rough_var=True))
    box(col, "BoothWindow", (-HALF_W + 0.85, 0.8, 0.95), (0.02, 1.0, 0.45),
        mat("p_boothwin", (0.70, 0.82, 0.88, 1.0), rough=0.10, alpha=0.35,
            emit=(0.6, 0.7, 0.8), emit_str=0.3))
    # Booth roof accent
    box(col, "BoothRoof", (-HALF_W + 1.5, 0, 1.2), (1.6, 1.4, 0.04),
        mat("p_boothrf", (*acc, 1.0), rough=0.28, emit=acc, emit_str=0.7, bump=0.01))

    # ---- Bollards (protective posts at ramp entry) ----
    for b in range(2):
        cyl(col, f"Bollard_{b}", (HALF_W - 2.1, -0.5 + b * 2.0, 0.2), 0.08, 0.4, steel, verts=10)

    # ---- Parking guidance display panel ----
    box(col, "GuidePanel", (-HALF_W + 0.3, HALF_D - 0.3, 2.0), (0.04, 0.6, 0.4),
        mat("p_guide", (0.08, 0.35, 0.55, 1.0), rough=0.15, metal=0.40,
            emit=(0.08, 0.35, 0.55), emit_str=1.2))
    box(col, "GuidePanelG1", (-HALF_W + 0.1, HALF_D - 0.15, 2.15), (0.02, 0.05, 0.05),
        mat("p_guideg", (1.0, 0.85, 0.1, 1.0), emit=(1.0, 0.85, 0.1), emit_str=2.0))

    # --- PROPS: Parking furniture ---
    # Speed bump across entrance lane
    box(col, "SpeedBump", (HALF_W - 3.0, 0.5, 0.06), (2.2, 0.40, 0.04),
        mat("p_bump", (0.88, 0.85, 0.18, 1.0), rough=0.70, bump=0.03,
            emit=(0.85, 0.82, 0.12), emit_str=0.3))
    # Wall-mounted tire stop at stall ends
    ts = box(col, "TireStop", (HALF_W - 1.4, -3.0, 0.08), (1.0, 0.12, 0.06), column_m)
    ts.rotation_euler = (math.radians(-15), 0, 0)
    # Directional arrows (4 more emissive floor arrows)
    for a in range(4):
        ax = -3.5 + a * 2.3
        box(col, f"DirArrow_{a}", (ax, -0.4 if a % 2 == 0 else 1.2, 0.035),
            (1.0, 0.35, 0.01), arrow)
    # Fire sprinkler heads on ceiling
    for s in range(6):
        sx = -5.0 + s * 2.0
        cyl(col, f"Sprinkler_{s}", (sx, -2.0 if s % 2 == 0 else 2.0, FLOOR_CLEAR - 0.06),
            0.04, 0.06, steel, verts=8)
    # Parking meter / pay station
    box(col, "PayStation", (-HALF_W + 3.0, 0, 0.6), (0.25, 0.20, 1.0), column_m)
    box(col, "PayDisplay", (-HALF_W + 3.0, 0.1, 1.0), (0.15, 0.04, 0.12),
        mat("p_paydisp", (0.1, 0.4, 0.7, 1.0), emit=(0.1, 0.4, 0.7), emit_str=1.2))
    # Wheel chocks (small wedges)
    for w in range(2):
        wc = box(col, f"WheelChock_{w}", (-3.0 + w * 6.0, -1.0 + w * 2.0, 0.05),
                 (0.30, 0.10, 0.06), column_m)
        wc.rotation_euler = (0, 0, math.radians(25 * (-1 if w % 2 else 1)))

    # --- SCENE: people, vehicles, environmental details ---
    add_human(col, "parking_evuser", (-5.4, -5.0, 0.05), rotation_z=math.radians(0), pose="standing")
    add_human(col, "parking_walker", (HALF_W - 1.0, 1.5, 0.05),
              rotation_z=math.radians(-15), pose="walking")

    # Vehicles: 3 sedans in rear stalls (every other stall)
    add_vehicle(col, "sedan_0", (-5.6, -1.5, 0.05), rotation_z=0, vehicle_type="sedan")
    add_vehicle(col, "sedan_1", (-2.0, -1.5, 0.05), rotation_z=0, vehicle_type="sedan")
    add_vehicle(col, "sedan_2", (3.2, -1.5, 0.05), rotation_z=0, vehicle_type="sedan")

    # 1 SUV in a front visitor stall
    add_vehicle(col, "suv_0", (-2.5, 2.0, 0.05), rotation_z=0, vehicle_type="suv")

    # 1 delivery van near ramp entrance
    add_vehicle(col, "delivery_van", (HALF_W - 2.5, 1.5, 0.05), rotation_z=math.radians(45),
                vehicle_type="delivery_van")

    # Shopping cart near entrance
    cyl(col, "CartHandle", (-HALF_W + 1.0, 0.8, 0.40), 0.015, 0.55,
        mat("p_cartwire", (0.55, 0.58, 0.62, 1.0), rough=0.25, metal=0.85), verts=6)
    box(col, "CartBasket", (-HALF_W + 1.0, 0.8, 0.15), (0.30, 0.45, 0.30),
        mat("p_cartmesh", (0.50, 0.52, 0.55, 1.0), rough=0.22, metal=0.80, alpha=0.30))
    for cw in range(2):
        cyl(col, f"CartWheel_{cw}", (-HALF_W + 1.0, 1.0 + cw * (-0.35), 0.10),
            0.06, 0.03,
            mat("p_cartwh", (0.08, 0.08, 0.10, 1.0), rough=0.70), verts=8,
            rot=(math.radians(90), 0, 0))

    # Oil stain on parking spot
    box(col, "OilStain", (-4.0, -2.0, 0.035), (1.2, 0.8, 0.01),
        mat("p_oil", (0.06, 0.05, 0.08, 1.0), rough=0.15, alpha=0.55))

    # "RESERVED" sign on wall near front stalls
    box(col, "ReservedSign", (-HALF_W + 0.12, HALF_D - 1.0, 1.6), (0.02, 0.40, 0.15),
        mat("p_reserved", (0.12, 0.25, 0.45, 1.0), rough=0.25,
            emit=(0.10, 0.22, 0.42), emit_str=1.0))


BUILDERS = {
    "basement": f_basement, "water": f_water, "energy": f_energy, "food": f_food,
    "shelter": f_shelter, "air": f_air, "health": f_health,
    "restoration": f_restoration, "rooftop": f_rooftop, "parking": f_parking,
}


# --------------------------------------------------------------------------- #
# BUILD, EXPORT, RENDER
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
        export_animations=False,  # Blender 4.5 NLA slot API changed; fix pending
    )
    sz = os.path.getsize(path)
    print(f"GLB {key}: {sz/1024:.1f} KB -> {path}")
    return sz


def world_and_render_setup():
    """Setup world with Nishita sky, Eevee Next engine, and AgX view transform."""
    if SCENE.world is None:
        SCENE.world = bpy.data.worlds.new("ATLAS_World")
    w = SCENE.world
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 1.2
    sky = nt.nodes.new("ShaderNodeTexSky")
    try:
        sky.sky_type = "NISHITA"
        sky.sun_elevation = math.radians(20)
        sky.sun_rotation = math.radians(65)
    except Exception:
        bg.inputs["Color"].default_value = (0.04, 0.06, 0.10, 1.0)
    else:
        nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])

    # Engine: Eevee Next → Eevee → Cycles
    enum = {e.identifier for e in type(SCENE.render).bl_rna.properties["engine"].enum_items}
    for cand in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        if cand in enum:
            SCENE.render.engine = cand
            break
    if SCENE.render.engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            SCENE.eevee.taa_render_samples = 32
            SCENE.eevee.use_raytracing = False
        except Exception:
            pass

    # View transform: AgX → Filmic → Standard
    looks = {v.identifier for v in
             type(SCENE.view_settings).bl_rna.properties["view_transform"].enum_items}
    SCENE.view_settings.view_transform = (
        "AgX" if "AgX" in looks else "Filmic" if "Filmic" in looks else "Standard")
    SCENE.render.film_transparent = False


def add_sun():
    """Primary sun light for scene."""
    sd = bpy.data.lights.new("Key_Sun", "SUN")
    sd.energy = 3.5
    sd.color = (1.0, 0.94, 0.82)
    sd.angle = math.radians(1.2)
    so = bpy.data.objects.new("Key_Sun", sd)
    so.rotation_euler = (math.radians(52), 0, math.radians(65))
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
    """Render a single floor module with point lights."""
    only_visible([key])
    floor_lights = add_point_lights(SCENE, key)

    look_at(cam, (HALF_W * 1.7, -HALF_D * 3.2, FLOOR_CLEAR * 1.4),
            (0, 0, FLOOR_CLEAR * 0.45))
    SCENE.render.resolution_x = 1000
    SCENE.render.resolution_y = 800
    SCENE.render.filepath = os.path.join(RENDERS_DIR, f"floor-{key}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", SCENE.render.filepath)

    # Clean up point lights after render
    for lo in floor_lights:
        bpy.data.objects.remove(lo, do_unlink=True)


def render_hero(cam, modules):
    """Render the full assembled tower with all point lights."""
    global _BULB_WATTAGE
    for i, (key, _, _) in enumerate(modules):
        col = bpy.data.collections.get(f"Floor_{key}")
        if col:
            for o in col.objects:
                o.location.z += i * STEP
    only_visible([k for k, _, _ in modules])

    # Add point lights for all floors
    all_lights = []
    for key, _, _ in modules:
        all_lights.extend(add_point_lights(SCENE, key))

    total_h = len(modules) * STEP
    look_at(cam, (HALF_W * 3.0, -HALF_D * 5.2, total_h * 0.58), (0, 0, total_h * 0.45))
    SCENE.render.resolution_x = 1500
    SCENE.render.resolution_y = 1700
    SCENE.render.filepath = os.path.join(RENDERS_DIR, "atlas-tower-hero.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", SCENE.render.filepath)

    # Clean up lights
    for lo in all_lights:
        bpy.data.objects.remove(lo, do_unlink=True)
    # Reset bulb registry between renders
    _BULB_WATTAGE = {}


def main():
    print("BUILD_ATLAS_FLOORS_START", bpy.app.version_string)
    if BAKE_ENABLED:
        print(f"BAKE: enabled (auto-tiered: 128-512px)")
        clear_baked_textures(BAKE_DIR)
    modules = []
    total_kb = 0

    # =====================================================================
    # PASS 1: BUILD — procedural materials (for renders + editing)
    # =====================================================================
    builder_keys = set(FLOOR_KEY_MAP.values())
    builder_cols = {}
    for key, label, accent in FLOORS:
        if key in builder_keys:
            col = build_module(key, label, accent)
            builder_cols[key] = col
            modules.append((key, label, accent))

    # ---- Animation pass (before render — adds NLA tracks) ----
    if ANIM_ENABLED:
        print("\n" + "~"*60)
        print("ANIMATION PASS")
        print("~"*60)
        for key, _, _ in modules:
            animate_floor(builder_cols[key], key)

    # ---- Render pass (procedural, Eevee) ----
    world_and_render_setup()
    add_sun()
    cam = make_cam()
    for key, _, _ in modules:
        render_module(cam, key)
    render_hero(cam, modules)

    # ---- Save procedural .blend (editable) ----
    blend_proc = os.path.join(HERE, "atlas_floors.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_proc)
    print("SAVED (procedural)", blend_proc)

    # =====================================================================
    # PASS 2: BAKE — Cycles bakes procedural → real PBR image textures
    # =====================================================================
    if BAKE_ENABLED:
        print("\n" + "="*70)
        print("PASS 2: BAKING PBR TEXTURES (Cycles)")
        print("="*70)
        for key, _, _ in modules:
            col = builder_cols[key]
            session = BakeSession(output_dir=BAKE_DIR)
            session.bake_floor(col)
            session.replace_materials_with_baked(col)
            total_kb += session.total_size_kb
        print(f"\nTOTAL BAKED TEXTURE DATA: {total_kb:.1f} KB")

        # ---- Save baked .blend (inspectable) ----
        blend_baked = os.path.join(HERE, "atlas_floors_baked.blend")
        bpy.ops.wm.save_as_mainfile(filepath=blend_baked)
        print("SAVED (baked)", blend_baked)

    # =====================================================================
    # PASS 3: EXPORT — GLBs with embedded textures (or flat mats if no bake)
    # =====================================================================
    print("\n" + "="*70)
    print("PASS 3: EXPORTING GLBs")
    print("="*70)
    glb_kb = 0
    for dm_key, builder_key in FLOOR_KEY_MAP.items():
        if builder_key in builder_cols:
            glb_kb += export_glb(builder_cols[builder_key], dm_key) / 1024
        else:
            print(f"WARNING: no builder for '{dm_key}' -> '{builder_key}'")

    print(f"GLB_TOTAL {glb_kb:.1f} KB across {len(FLOOR_KEY_MAP)} exports "
          f"({len(modules)} unique modules)")

    # ---- Budget check ----
    total_bytes = sum(os.path.getsize(os.path.join(MODELS_DIR, f))
                      for f in os.listdir(MODELS_DIR)
                      if f.startswith("floor-") and f.endswith(".glb"))
    total_mb = total_bytes / (1024 * 1024)
    print(f"\nBUDGET_CHECK: {total_bytes/1024:.1f} KB ({total_mb:.2f} MB) "
          f"across floor GLBs")
    budget = BAKE_BUDGET_MB if BAKE_ENABLED else 2.5
    if total_mb > budget:
        print(f"WARNING: OVER BUDGET by {total_mb - budget:.2f} MB "
              f"(budget: {budget} MB)")
    else:
        print(f"OK — {budget - total_mb:.2f} MB headroom remaining")

    print("BUILD_ATLAS_FLOORS_DONE modules=%d total_glb_kb=%.1f" % (len(modules), glb_kb))


if __name__ == "__main__":
    main()
