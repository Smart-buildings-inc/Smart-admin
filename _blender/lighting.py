"""
lighting.py — Cinematic Lighting System for ATLAS Architectural Visualization
================================================================================
Importable module providing:

  1. setup_cinematic_lighting(scene, floor_key)  — three-point lighting rig
  2. setup_hdr_environment(scene)                 — Nishita / gradient sky world
  3. create_ies_light(name, location, profile, intensity) — IES-like spot lights
  4. add_atmosphere(scene, floor_key)             — volumetric haze cube
  5. RENDER_PRESETS                                — lighting config dictionary
  6. setup_compositor(scene)                       — post-processing node tree

All functions are importable and safe to call from build_atlas_floors.py.
"""

import bpy
import math

# --------------------------------------------------------------------------- #
# SHARED CONSTANTS (mirrored from build_atlas_floors.py so this module works
# standalone; keep these in sync if the floor geometry changes)
# --------------------------------------------------------------------------- #
FLOOR_CLEAR = 3.2
SLAB_T = 0.30
HALF_W = 8.0
HALF_D = 5.5
STEP = FLOOR_CLEAR + SLAB_T

# Cache created lights so callers can clean them up later.
_CINEMATIC_LIGHTS = []
_ATMOSPHERE_OBJECTS = []


# =========================================================================== #
# COLOR TEMPERATURE UTILITY
# =========================================================================== #
def kelvin_to_rgb(kelvin):
    """Convert color temperature in Kelvin to linear sRGB (approximate).

    Uses the Tanner Helland approximation, clamped to [0, 1].  Acceptable for
    physically-plausible architectural viz (not photometric).
    """
    temp = kelvin / 100.0
    # Red
    if temp <= 66:
        r = 1.0
    else:
        r = 1.29293618606 * ((temp - 60) ** -0.1332047592)
    # Green
    if temp <= 66:
        g = 0.390081578769 * math.log(temp) - 0.631841443788 if temp > 0 else 0.0
    else:
        g = 1.1298908609 * ((temp - 60) ** -0.0755148492)
    # Blue
    if temp >= 66:
        b = 1.0
    elif temp <= 19:
        b = 0.0
    else:
        b = 1.54363673968 * math.log(temp - 10) - 4.5666403393
    return (
        max(0.0, min(1.0, r)),
        max(0.0, min(1.0, g)),
        max(0.0, min(1.0, b)),
    )


# =========================================================================== #
# 1. THREE-POINT LIGHTING RIG
# =========================================================================== #
def setup_cinematic_lighting(scene, floor_key):
    """Create a cinematic three-point lighting rig around *floor_key*.

    Returns a list of created light objects (key, fill, rim) so the caller
    can adjust or remove them after rendering.
    """
    global _CINEMATIC_LIGHTS
    _CINEMATIC_LIGHTS = []

    # ---- KEY LIGHT: warm directional area, upper-right (afternoon sun) ----
    key_color = kelvin_to_rgb(4500)
    key_data = bpy.data.lights.new(f"Cine_Key_{floor_key}", "AREA")
    key_data.energy = 350.0
    key_data.color = key_color
    key_data.shape = "RECTANGLE"
    key_data.size = 6.0
    key_data.size_y = 4.0
    key_obj = bpy.data.objects.new(f"Cine_Key_{floor_key}", key_data)
    key_obj.location = (HALF_W * 2.5, -HALF_D * 0.3, FLOOR_CLEAR * 1.6)
    key_obj.rotation_euler = (
        math.radians(-55),   # tilt down toward floor
        0,
        math.radians(-40),   # angle from right
    )
    scene.collection.objects.link(key_obj)
    _CINEMATIC_LIGHTS.append(key_obj)

    # ---- FILL LIGHT: cool soft area, open cutaway side (reduces shadows) ----
    fill_color = kelvin_to_rgb(6500)
    fill_data = bpy.data.lights.new(f"Cine_Fill_{floor_key}", "AREA")
    fill_data.energy = 120.0
    fill_data.color = fill_color
    fill_data.shape = "RECTANGLE"
    fill_data.size = 10.0
    fill_data.size_y = 6.0
    fill_obj = bpy.data.objects.new(f"Cine_Fill_{floor_key}", fill_data)
    fill_obj.location = (0, HALF_D * 2.8, FLOOR_CLEAR * 0.7)
    fill_obj.rotation_euler = (
        math.radians(-20),
        0,
        math.radians(0),
    )
    scene.collection.objects.link(fill_obj)
    _CINEMATIC_LIGHTS.append(fill_obj)

    # ---- RIM LIGHT: neutral edge light from behind/above (depth) ----
    rim_color = kelvin_to_rgb(5500)
    rim_data = bpy.data.lights.new(f"Cine_Rim_{floor_key}", "AREA")
    rim_data.energy = 200.0
    rim_data.color = rim_color
    rim_data.shape = "RECTANGLE"
    rim_data.size = 8.0
    rim_data.size_y = 3.0
    rim_obj = bpy.data.objects.new(f"Cine_Rim_{floor_key}", rim_data)
    rim_obj.location = (0, -HALF_D * 2.2, FLOOR_CLEAR * 1.3)
    rim_obj.rotation_euler = (
        math.radians(-40),
        0,
        math.radians(0),
    )
    scene.collection.objects.link(rim_obj)
    _CINEMATIC_LIGHTS.append(rim_obj)

    return _CINEMATIC_LIGHTS


def remove_cinematic_lights():
    """Remove all lights created by setup_cinematic_lighting()."""
    global _CINEMATIC_LIGHTS
    for obj in _CINEMATIC_LIGHTS:
        if obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    _CINEMATIC_LIGHTS = []


# =========================================================================== #
# 2. HDR ENVIRONMENT SYSTEM
# =========================================================================== #
def setup_hdr_environment(scene):
    """Create a realistic HDR sky world with warm horizon glow.

    Uses Nishita sky texture if available; otherwise falls back to a
    gradient-based procedural sky with sky dome + horizon gradient.
    """
    if scene.world is None:
        scene.world = bpy.data.worlds.new("ATLAS_World")
    world = scene.world
    world.use_nodes = True
    nt = world.node_tree
    for node in list(nt.nodes):
        nt.nodes.remove(node)

    out = nt.nodes.new("ShaderNodeOutputWorld")
    out.location = (600, 0)

    bg = nt.nodes.new("ShaderNodeBackground")
    bg.location = (350, 0)
    bg.inputs["Strength"].default_value = 1.0

    # Try Nishita sky first (Blender 2.8+).
    has_nishita = False
    try:
        sky_tex = nt.nodes.new("ShaderNodeTexSky")
        sky_tex.sky_type = "NISHITA"
        # Golden-hour sun: low elevation, warm directional cast.
        sky_tex.sun_elevation = math.radians(12)
        sky_tex.sun_rotation = math.radians(55)
        sky_tex.altitude = 80.0
        sky_tex.air_density = 1.0
        sky_tex.dust_density = 1.2
        sky_tex.ozone_density = 1.0
        sky_tex.location = (-200, 0)
        nt.links.new(sky_tex.outputs["Color"], bg.inputs["Color"])
        has_nishita = True
    except Exception:
        pass

    if not has_nishita:
        # ---- Gradient-based fallback sky ----
        # Sky colors: horizon glow (top ramp stop) → deep blue (bottom)
        grad = nt.nodes.new("ShaderNodeTexGradient")
        grad.gradient_type = "SPHERICAL"
        grad.location = (-400, 0)

        coord = nt.nodes.new("ShaderNodeTexCoord")
        coord.location = (-600, 0)
        nt.links.new(coord.outputs["Generated"], grad.inputs["Vector"])

        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.location = (-200, 0)
        ramp.color_ramp.interpolation = "EASE"
        ramp.color_ramp.elements[0].position = 0.0   # horizon
        ramp.color_ramp.elements[0].color = (1.0, 0.76, 0.45, 1.0)  # warm orange glow
        ramp.color_ramp.elements[1].position = 0.35  # mid sky
        ramp.color_ramp.elements[1].color = (0.35, 0.55, 0.90, 1.0)  # sky blue
        # Add a third stop if it exists (elements default to 2).
        el = ramp.color_ramp.elements
        if len(el) < 3:
            stop = el.new(0.70)
            stop.color = (0.15, 0.22, 0.45, 1.0)  # deep upper atmosphere
        nt.links.new(grad.outputs["Fac"], ramp.inputs["Fac"])

        # Mix with a subtle warm fill from the ground hemisphere
        grad2 = nt.nodes.new("ShaderNodeTexGradient")
        grad2.gradient_type = "SPHERICAL"
        grad2.location = (-400, -250)
        nt.links.new(coord.outputs["Generated"], grad2.inputs["Vector"])

        ramp2 = nt.nodes.new("ShaderNodeValToRGB")
        ramp2.location = (-200, -250)
        ramp2.color_ramp.interpolation = "EASE"
        ramp2.color_ramp.elements[0].position = 0.0
        ramp2.color_ramp.elements[0].color = (0.04, 0.05, 0.15, 1.0)  # ground bounce
        ramp2.color_ramp.elements[1].position = 0.25
        ramp2.color_ramp.elements[1].color = (0.12, 0.10, 0.08, 1.0)
        nt.links.new(grad2.outputs["Fac"], ramp2.inputs["Fac"])

        mix = nt.nodes.new("ShaderNodeMixRGB")
        mix.location = (100, 0)
        mix.blend_type = "ADD"
        mix.inputs[0].default_value = 0.4
        nt.links.new(ramp.outputs["Color"], mix.inputs[1])
        nt.links.new(ramp2.outputs["Color"], mix.inputs[2])
        nt.links.new(mix.outputs["Color"], bg.inputs["Color"])

    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])

    return has_nishita


# =========================================================================== #
# 3. IES LIGHT PROFILE SYSTEM
# =========================================================================== #
# Predefined IES-like profile configurations using Blender SPOT lights.
# Each entry is a dict of spot parameters approximating real IES distributions.
IES_PROFILES = {
    "ies_downlight": {
        "description": "Narrow 30 cone — recessed ceiling fixtures",
        "spot_size": math.radians(30),      # half-angle for 30 full cone
        "spot_blend": 0.15,                 # tight edge
    },
    "ies_wallwash": {
        "description": "Wide 90 asymmetric — wall sconces, grazing light",
        "spot_size": math.radians(90),
        "spot_blend": 0.50,                 # soft wide throw
    },
    "ies_flood": {
        "description": "60 medium spread — general area lighting",
        "spot_size": math.radians(60),
        "spot_blend": 0.35,
    },
}


def create_ies_light(name, location, profile, intensity=150.0, color=(1.0, 0.94, 0.82)):
    """Create a SPOT light that approximates an IES profile.

    Parameters:
        name      — unique object name for the light
        location  — (x, y, z) world position
        profile   — "ies_downlight" | "ies_wallwash" | "ies_flood"
        intensity — energy in Blender units (default 150 for Eevee)
        color     — RGB tuple (default warm 3200K-ish)

    Returns the created light object.
    """
    if profile not in IES_PROFILES:
        raise ValueError(
            f"Unknown IES profile '{profile}'. "
            f"Available: {', '.join(IES_PROFILES.keys())}"
        )

    cfg = IES_PROFILES[profile]
    ld = bpy.data.lights.new(name, "SPOT")
    ld.energy = intensity
    ld.color = color
    ld.spot_size = cfg["spot_size"]
    ld.spot_blend = cfg["spot_blend"]
    ld.shadow_soft_size = 0.5

    lo = bpy.data.objects.new(name, ld)
    lo.location = location

    # Angle spot downward for ceiling fixtures, tilt for wall wash
    if profile == "ies_wallwash":
        lo.rotation_euler = (math.radians(-30), 0, 0)  # slight downward tilt
    else:
        lo.rotation_euler = (math.radians(0), 0, 0)  # straight down (Z-)

    return lo


def create_ies_ceiling_grid(scene, floor_key, profile="ies_downlight",
                             count_x=3, count_y=2, intensity=120.0):
    """Place a grid of IES downlights across the ceiling of *floor_key*.

    Returns a list of created light objects.
    """
    lights = []
    spacing_x = (HALF_W * 2 - 3.0) / max(count_x - 1, 1)
    spacing_y = (HALF_D * 2 - 3.0) / max(count_y - 1, 1)
    start_x = -spacing_x * (count_x - 1) / 2.0
    start_y = -spacing_y * (count_y - 1) / 2.0

    for ix in range(count_x):
        for iy in range(count_y):
            x = start_x + ix * spacing_x
            y = start_y + iy * spacing_y
            z = FLOOR_CLEAR - 0.12
            lo = create_ies_light(
                f"IES_{floor_key}_{ix}_{iy}",
                (x, y, z),
                profile=profile,
                intensity=intensity,
            )
            scene.collection.objects.link(lo)
            lights.append(lo)

    return lights


# =========================================================================== #
# 4. VOLUMETRIC ATMOSPHERE
# =========================================================================== #
def add_atmosphere(scene, floor_key, density=0.02):
    """Add a subtle volumetric haze cube that catches light rays.

    Creates a Principled Volume material on a proxy cube that encloses the
    floor space.  Low density ensures only pendant/sconce lights cast visible
    cones and sun shafts are barely perceptible — architectural haze, not fog.

    Returns the volume object.
    """
    global _ATMOSPHERE_OBJECTS

    # ---- Volume cube geo ----
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=(0, 0, FLOOR_CLEAR / 2.0),
    )
    vol_obj = bpy.context.active_object
    vol_obj.name = f"Atmo_Vol_{floor_key}"
    vol_obj.scale = (
        HALF_W * 2 + 2.0,
        HALF_D * 2 + 2.0,
        FLOOR_CLEAR + 1.0,
    )
    # Move out of any other collection into the scene root
    for c in list(vol_obj.users_collection):
        c.objects.unlink(vol_obj)
    scene.collection.objects.link(vol_obj)
    vol_obj.display_type = "WIRE"
    vol_obj.hide_render = False

    # ---- Principled Volume material ----
    mat = bpy.data.materials.new(f"Atmo_Mat_{floor_key}")
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (400, 0)
    out.target = "EEVEE"  # volume output for Eevee

    vol_bsdf = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol_bsdf.location = (100, 0)
    vol_bsdf.inputs["Color"].default_value = (1.0, 0.96, 0.88, 1.0)  # warm tint
    vol_bsdf.inputs["Density"].default_value = density
    vol_bsdf.inputs["Anisotropy"].default_value = 0.15  # slight forward scatter

    nt.links.new(vol_bsdf.outputs["Volume"], out.inputs["Volume"])
    vol_obj.data.materials.append(mat)

    _ATMOSPHERE_OBJECTS.append(vol_obj)
    return vol_obj


def remove_atmosphere():
    """Remove all atmosphere objects created by add_atmosphere()."""
    global _ATMOSPHERE_OBJECTS
    for obj in _ATMOSPHERE_OBJECTS:
        if obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    _ATMOSPHERE_OBJECTS = []


# =========================================================================== #
# 5. RENDER PRESETS
# =========================================================================== #
RENDER_PRESETS = {
    "architectural_morning": {
        "description": "Soft neutral light, long shadows — early morning clarity.",
        "world_strength": 1.0,
        "key_intensity": 0.7,
        "fill_intensity": 0.35,
        "rim_intensity": 0.4,
        "sun_elevation": 20.0,
        "sun_rotation": 65.0,
        "color_temp_key": 5500,
        "color_temp_fill": 7500,
        "color_temp_rim": 5000,
        "atmosphere_density": 0.01,
        "exposure": 1.0,
        "contrast": "medium",
        "film_look": "neutral",
        "camera": {
            "location": (HALF_W * 1.7, -HALF_D * 3.2, FLOOR_CLEAR * 1.4),
            "target": (0, 0, FLOOR_CLEAR * 0.45),
        },
    },
    "architectural_golden": {
        "description": "Warm dramatic light, strong contrast — golden hour drama.",
        "world_strength": 0.5,
        "key_intensity": 1.2,
        "fill_intensity": 0.12,
        "rim_intensity": 0.8,
        "sun_elevation": 8.0,
        "sun_rotation": 45.0,
        "color_temp_key": 3200,
        "color_temp_fill": 6500,
        "color_temp_rim": 4500,
        "atmosphere_density": 0.03,
        "exposure": 0.85,
        "contrast": "high",
        "film_look": "warm",
        "camera": {
            "location": (HALF_W * 1.5, -HALF_D * 3.5, FLOOR_CLEAR * 1.2),
            "target": (0, 0, FLOOR_CLEAR * 0.5),
        },
    },
    "architectural_evening": {
        "description": "Cool blue ambient, warm interior glow — dusk atmosphere.",
        "world_strength": 0.25,
        "key_intensity": 0.35,
        "fill_intensity": 0.55,
        "rim_intensity": 0.25,
        "sun_elevation": -5.0,
        "sun_rotation": 270.0,
        "color_temp_key": 6500,
        "color_temp_fill": 9000,
        "color_temp_rim": 2800,
        "atmosphere_density": 0.02,
        "exposure": 0.75,
        "contrast": "medium",
        "film_look": "cool",
        "camera": {
            "location": (HALF_W * 1.8, -HALF_D * 3.0, FLOOR_CLEAR * 1.5),
            "target": (0, 0, FLOOR_CLEAR * 0.5),
        },
    },
    "marketing_hero": {
        "description": "Dramatic lighting for the tower hero shot — high impact.",
        "world_strength": 0.45,
        "key_intensity": 1.5,
        "fill_intensity": 0.18,
        "rim_intensity": 1.0,
        "sun_elevation": 12.0,
        "sun_rotation": 55.0,
        "color_temp_key": 4000,
        "color_temp_fill": 7000,
        "color_temp_rim": 5500,
        "atmosphere_density": 0.025,
        "exposure": 0.8,
        "contrast": "high",
        "film_look": "dramatic",
        "camera": {
            "location": (HALF_W * 3.0, -HALF_D * 5.2, 0),
            "target": (0, 0, 0),
        },
    },
}


def apply_preset(scene, preset_name="architectural_golden"):
    """Apply a named render preset to the scene.

    Configures world strength, Nishita sun (if available), atmosphere density,
    and returns preset metadata for downstream camera/light adjustments.
    """
    preset = RENDER_PRESETS.get(preset_name)
    if preset is None:
        available = ", ".join(RENDER_PRESETS.keys())
        raise ValueError(f"Unknown preset '{preset_name}'. Available: {available}")

    # World background strength
    if scene.world and scene.world.use_nodes:
        nt = scene.world.node_tree
        for node in nt.nodes:
            if node.type == "BACKGROUND":
                node.inputs["Strength"].default_value = preset["world_strength"]
                break

    # Nishita sky parameters (if available)
    for node in (scene.world.node_tree.nodes if scene.world else []):
        if node.type == "TEX_SKY" and getattr(node, "sky_type", "") == "NISHITA":
            node.sun_elevation = math.radians(preset["sun_elevation"])
            node.sun_rotation = math.radians(preset["sun_rotation"])
            break

    # Render exposure
    try:
        scene.view_settings.exposure = preset["exposure"] - 1.0
    except Exception:
        pass

    return preset


# =========================================================================== #
# 6. POST-PROCESSING COMPOSITOR
# =========================================================================== #
def setup_compositor(scene):
    """Build a cinematic post-processing compositor node tree.

    Applies (in order):
      1. Glare (Fog Glow) — bloom for emissive surfaces
      2. Lens Distortion — subtle 0.01 barrel
      3. Vignette — darker edges via Ellipse Mask multiply
      4. Color Balance — slight warm Lift/Gamma/Gain shift
    """
    scene.use_nodes = True
    tree = scene.node_tree
    for node in list(tree.nodes):
        tree.nodes.remove(node)

    # ---- Input ----
    rl = tree.nodes.new("CompositorNodeRLayers")
    rl.location = (0, 0)

    # ---- 1. Glare (Fog Glow) ----
    glare = tree.nodes.new("CompositorNodeGlare")
    glare.location = (300, 0)
    glare.glare_type = "FOG_GLOW"
    glare.threshold = 0.4
    glare.size = 8
    try:
        glare.quality = "HIGH"
    except Exception:
        pass
    tree.links.new(rl.outputs["Image"], glare.inputs["Image"])

    # ---- 2. Lens Distortion (very subtle) ----
    lens = tree.nodes.new("CompositorNodeLensdist")
    lens.location = (600, 0)
    lens.inputs["Distort"].default_value = 0.01
    lens.inputs["Dispersion"].default_value = 0.0
    tree.links.new(glare.outputs["Image"], lens.inputs["Image"])

    # ---- 3. Vignette — darken edges ~15% ----
    # Ellipse mask: white center, dark rim
    ellipse = tree.nodes.new("CompositorNodeEllipseMask")
    ellipse.location = (600, -250)
    ellipse.width = 0.92
    ellipse.height = 0.92

    # Blur the mask so the vignette is soft
    blur = tree.nodes.new("CompositorNodeBlur")
    blur.location = (850, -250)
    blur.size_x = 40
    blur.size_y = 40
    tree.links.new(ellipse.outputs["Mask"], blur.inputs["Image"])

    # Multiply image by mask to darken edges
    vignette = tree.nodes.new("CompositorNodeMixRGB")
    vignette.location = (900, 0)
    vignette.blend_type = "MULTIPLY"
    vignette.inputs[0].default_value = 1.0  # factor (ignored for MULTIPLY)
    # Upper socket = image, lower = mask
    tree.links.new(lens.outputs["Image"], vignette.inputs[1])
    tree.links.new(blur.outputs["Image"], vignette.inputs[2])

    # ---- 4. Color Balance — slight warm shift ----
    color_bal = tree.nodes.new("CompositorNodeColorBalance")
    color_bal.location = (1200, 0)
    color_bal.correction_method = "LIFT_GAMMA_GAIN"
    color_bal.lift = (0.005, 0.002, -0.002)   # tiny lift in red
    color_bal.gamma = (1.02, 1.00, 0.96)       # warm gamma
    color_bal.gain = (1.06, 1.01, 0.96)         # slight warm gain boost
    tree.links.new(vignette.outputs["Image"], color_bal.inputs["Image"])

    # ---- Output ----
    comp = tree.nodes.new("CompositorNodeComposite")
    comp.location = (1500, 0)
    tree.links.new(color_bal.outputs["Image"], comp.inputs["Image"])

    # ---- Enable nodes for final render ----
    scene.render.use_compositing = True
    # Eevee bloom (in-renderer) vs compositor glare — disable engine bloom
    # so compositor glare is the sole source.
    try:
        scene.eevee.use_bloom = False
    except Exception:
        pass

    return tree


# =========================================================================== #
# CONVENIENCE: FULL CINEMATIC SETUP (single call)
# =========================================================================== #
def full_cinematic_setup(scene, floor_key="", preset_name="architectural_golden",
                          with_atmosphere=True):
    """One-call cinematic lighting pipeline.

    Applies HDR environment, three-point lights, atmosphere, compositor, and
    the chosen render preset.  Returns a dict of created objects for cleanup.
    """
    result = {}

    # HDR environment
    result["hdr_nishita"] = setup_hdr_environment(scene)

    # Three-point cinematic rig
    result["lights"] = setup_cinematic_lighting(scene, floor_key)

    # Volumetric atmosphere
    if with_atmosphere:
        preset = RENDER_PRESETS.get(preset_name, {})
        density = preset.get("atmosphere_density", 0.02)
        result["atmosphere"] = add_atmosphere(scene, floor_key, density=density)
    else:
        result["atmosphere"] = None

    # Apply render preset (world settings, exposure, sun)
    result["preset"] = apply_preset(scene, preset_name)

    # Compositor post-processing
    result["compositor"] = setup_compositor(scene)

    return result
