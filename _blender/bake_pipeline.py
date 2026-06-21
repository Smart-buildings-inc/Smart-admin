"""
bake_pipeline.py — PBR Texture Baking Pipeline for ATLAS Floors
========================================================================

Bakes Blender's procedural materials (noise-based bumps, roughness variation,
emissive accents, metallic flake) into real image textures that survive GLB
export.  The glTF exporter cannot serialize ShaderNodeTexNoise / ShaderNodeBump /
ShaderNodeMapRange, so we capture their visual result as baked PBR maps.

Output per unique material:
  {name}_basecolor.jpg   — RGB albedo (sRGB, JPEG)
  {name}_normal.png      — tangent-space normal (non-color, PNG)
  {name}_orm.png         — packed Occlusion(R) Roughness(G) Metallic(B)
  {name}_emission.jpg    — RGB emission (sRGB, JPEG) — only if material is emissive

Usage from build_atlas_floors.py:
  from bake_pipeline import BakeSession
  session = BakeSession(resolution=1024, output_dir=BAKED_DIR)
  session.bake_floor(floor_collection)
  session.replace_materials_with_baked(floor_collection)
"""

import bpy
import os
import math
import numpy as np  # for ORM packing (fallback to pure Python if missing)

# --------------------------------------------------------------------------- #
# CONFIG
# --------------------------------------------------------------------------- #
HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_BAKE_DIR = os.path.join(HERE, "baked_textures")

# Resolution tiers: auto-selected based on object size
RES_LARGE = 512    # walls, slabs, tanks (dominant surfaces)
RES_MEDIUM = 256   # equipment, panels, doors
RES_SMALL = 128    # LEDs, cords, small fixtures
RES_ORM = 64       # ORM is always low-res (uniform values)


# --------------------------------------------------------------------------- #
# UV UNWRAPPING
# --------------------------------------------------------------------------- #

def _is_box_like(obj):
    """Heuristic: cube mesh with 6 quads."""
    if obj.type != 'MESH':
        return False
    mesh = obj.data
    if len(mesh.polygons) == 6 and len(mesh.vertices) == 8:
        return True
    return "Box" in obj.name or "Slab" in obj.name or "Wall" in obj.name


def _is_cylinder_like(obj):
    """Heuristic: cylindrical mesh."""
    if obj.type != 'MESH':
        return False
    mesh = obj.data
    # Cylinders have top/bottom n-gons + quads around
    if len(mesh.polygons) > 6 and len(mesh.polygons) < 64:
        verts = [v.co for v in mesh.vertices]
        radii = [math.sqrt(v.x**2 + v.y**2) for v in verts]
        if max(radii) - min(radii) < 0.01 and max(radii) > 0.01:
            return True
    return "Cyl" in obj.name or "Tank" in obj.name or "Pipe" in obj.name


def unwrap_object(obj, margin=0.004):
    """
    UV-unwrap a single mesh object using the best method for its shape.
    Modifies the object in-place (creates or replaces the active UV map).
    """
    if obj.type != 'MESH':
        return

    mesh = obj.data

    # Ensure we have a UV map
    if len(mesh.uv_layers) == 0:
        mesh.uv_layers.new(name="UVMap")
    uv_layer = mesh.uv_layers.active
    uv_layer.name = "UVMap"

    # Must be in edit mode to unwrap
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')

    if _is_cylinder_like(obj):
        # Cylinder projection aligned to object Z
        try:
            bpy.ops.uv.cylinder_project(direction='ALIGN_TO_OBJECT',
                                        scale_to_bounds=True)
        except Exception:
            bpy.ops.uv.smart_project(angle_limit=66, island_margin=margin,
                                     scale_to_bounds=True)
    elif _is_box_like(obj):
        # Smart project works well for boxes; it creates islands per face group
        bpy.ops.uv.smart_project(angle_limit=66, island_margin=margin,
                                 scale_to_bounds=True)
    else:
        # General case: smart project
        bpy.ops.uv.smart_project(angle_limit=66, island_margin=margin,
                                 scale_to_bounds=True)

    bpy.ops.object.mode_set(mode='OBJECT')
    # print(f"  UV unwrapped: {obj.name} ({len(mesh.polygons)} faces)")


def unwrap_collection(col):
    """UV-unwrap every mesh object in a collection (and its children)."""
    for obj in col.all_objects:
        if obj.type == 'MESH':
            unwrap_object(obj)
    print(f"UV unwrapped collection: {col.name}")


# --------------------------------------------------------------------------- #
# TEXTURE BAKING
# --------------------------------------------------------------------------- #

def _setup_cycles_for_baking():
    """Ensure Cycles is the active render engine with baking-friendly settings."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    cycles = scene.cycles

    # CPU-only is safest for headless baking
    cycles.device = 'CPU'
    cycles.samples = 1  # Baking doesn't use samples the same way
    cycles.use_denoising = False

    # Disable caustics for speed
    cycles.caustics_reflective = False
    cycles.caustics_refractive = False

    # Bake settings
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    scene.render.bake.margin = 4  # 4px margin to prevent seams

    print("Cycles bake engine configured")


def _create_bake_image(name, resolution, is_color=True, alpha=True):
    """
    Create a blank image for baking into.
    Returns the Image datablock.
    """
    img = bpy.data.images.new(
        name=name,
        width=resolution,
        height=resolution,
        alpha=alpha,
        float_buffer=(not is_color),  # normals need float
    )
    if is_color:
        img.colorspace_settings.name = 'sRGB'
    else:
        img.colorspace_settings.name = 'Non-Color'
    return img


def _add_bake_target_to_material(material, target_image):
    """
    Add a temporary Image Texture node to `material` and make it the active
    bake target. Returns the tex node (for later removal).
    
    Blender bakes the material's OUTPUT into whatever Image Texture node
    is currently active in the material's node tree.  We must NOT replace
    the material — we add a temporary target node to the existing tree.
    """
    if not material.use_nodes:
        return None

    nodes = material.node_tree.nodes

    # Remove any previous bake target node
    for n in list(nodes):
        if n.name.startswith('_BAKE_TARGET_'):
            nodes.remove(n)

    tex = nodes.new('ShaderNodeTexImage')
    tex.name = '_BAKE_TARGET_'
    tex.image = target_image
    tex.location = (-800, -800)  # out of the way
    tex.select = True
    nodes.active = tex

    return tex


def _remove_bake_target_from_material(material):
    """Remove the temporary bake target node."""
    if not material.use_nodes:
        return
    for n in list(material.node_tree.nodes):
        if n.name.startswith('_BAKE_TARGET_'):
            material.node_tree.nodes.remove(n)


def bake_material_basecolor(material, objects, resolution, output_dir):
    """Bake the Diffuse Color (albedo) of a material to a JPEG image."""
    img_name = f"{material.name}_basecolor"
    img = _create_bake_image(img_name, resolution, is_color=True, alpha=False)

    # Add bake target TO the original material (don't replace it)
    tex_node = _add_bake_target_to_material(material, img)
    if tex_node is None:
        return None

    # Select all objects using this material
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        if obj.type == 'MESH' and material.name in [m.name for m in obj.data.materials]:
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj

    if not bpy.context.selected_objects:
        _remove_bake_target_from_material(material)
        return None

    # Bake FROM original material INTO the target image
    try:
        bpy.ops.object.bake(
            type='DIFFUSE',
            pass_filter={'COLOR'},
            use_clear=True,
            margin=4,
        )
    except Exception as e:
        print(f"  BAKE FAILED (base color) for {material.name}: {e}")
        _remove_bake_target_from_material(material)
        return None

    _remove_bake_target_from_material(material)

    # Save to disk
    filepath = os.path.join(output_dir, f"{material.name}_basecolor.jpg")
    scene = bpy.context.scene
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 85
    scene.render.image_settings.color_mode = 'RGB'
    img.save_render(filepath, scene=scene)
    print(f"  Baked base color: {filepath}")

    return img


def bake_material_normal(material, objects, resolution, output_dir):
    """Bake the tangent-space normal map (captures bump detail)."""
    img_name = f"{material.name}_normal"
    img = _create_bake_image(img_name, resolution, is_color=False, alpha=False)

    tex_node = _add_bake_target_to_material(material, img)
    if tex_node is None:
        return None

    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        if obj.type == 'MESH' and material.name in [m.name for m in obj.data.materials]:
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj

    if not bpy.context.selected_objects:
        _remove_bake_target_from_material(material)
        return None

    try:
        bpy.ops.object.bake(
            type='NORMAL',
            use_clear=True,
            margin=4,
            normal_space='TANGENT',
        )
    except Exception as e:
        print(f"  BAKE FAILED (normal) for {material.name}: {e}")
        _remove_bake_target_from_material(material)
        return None

    _remove_bake_target_from_material(material)

    filepath = os.path.join(output_dir, f"{material.name}_normal.png")
    scene = bpy.context.scene
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.compression = 90
    img.save_render(filepath, scene=scene)
    print(f"  Baked normal: {filepath}")

    return img


def bake_material_emission(material, objects, resolution, output_dir):
    """Bake the emission pass to a JPEG image."""
    # Check if material has any emission
    if not material.use_nodes:
        return None
    princ = None
    for node in material.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            princ = node
            break
    if princ is None:
        return None
    emit_strength = princ.inputs.get('Emission Strength')
    if emit_strength is None or emit_strength.default_value <= 0.01:
        return None

    img_name = f"{material.name}_emission"
    img = _create_bake_image(img_name, resolution // 2, is_color=True, alpha=False)

    tex_node = _add_bake_target_to_material(material, img)
    if tex_node is None:
        return None

    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        if obj.type == 'MESH' and material.name in [m.name for m in obj.data.materials]:
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj

    if not bpy.context.selected_objects:
        _remove_bake_target_from_material(material)
        return None

    try:
        bpy.ops.object.bake(
            type='EMIT',
            use_clear=True,
            margin=4,
        )
    except Exception as e:
        print(f"  BAKE FAILED (emission) for {material.name}: {e}")
        _remove_bake_target_from_material(material)
        return None

    _remove_bake_target_from_material(material)

    filepath = os.path.join(output_dir, f"{material.name}_emission.jpg")
    scene = bpy.context.scene
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 85
    scene.render.image_settings.color_mode = 'RGB'
    img.save_render(filepath, scene=scene)
    print(f"  Baked emission: {filepath}")

    return img


def bake_material_orm(material, objects, resolution, output_dir):
    """
    Bake a packed ORM map: Occlusion(R) Roughness(G) Metallic(B).
    
    Approach: Create a temporary material that routes AO → R, Roughness → G,
    Metallic → B into an Emission shader, then bake EMIT.
    
    Since we don't have real AO, we use a flat 1.0 (white) for the R channel
    and pack only Roughness (G) + Metallic (B).  We bake two separate EMIT
    passes (one for roughness, one for metallic) and composite them in Python.
    """
    if not material.use_nodes:
        return None

    # Read roughness and metallic values from the Principled BSDF
    princ = None
    for node in material.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            princ = node
            break
    if princ is None:
        return None

    roughness_input = princ.inputs.get('Roughness')
    metallic_input = princ.inputs.get('Metallic')

    rough_val = roughness_input.default_value if roughness_input else 0.5
    metal_val = metallic_input.default_value if metallic_input else 0.0

    # Check if roughness is driven by a noise node (varies per-pixel)
    rough_is_procedural = False
    if roughness_input and roughness_input.is_linked:
        rough_is_procedural = True

    # For metallic, it's almost always uniform — skip baking full map
    # Create a flat ORM image: Occlusion=1.0, Roughness=value, Metallic=value
    img_name = f"{material.name}_orm"
    # Small ORM map (256px is plenty for uniform values)
    orm_res = min(resolution // 4, 256)
    img = _create_bake_image(img_name, orm_res, is_color=False, alpha=False)

    # Write ORM pixels via Python (faster and simpler than baking)
    pixels = [0.0] * (orm_res * orm_res * 4)
    for i in range(orm_res * orm_res):
        base = i * 4
        pixels[base + 0] = 1.0           # R = Occlusion (full)
        pixels[base + 1] = rough_val      # G = Roughness
        pixels[base + 2] = metal_val      # B = Metallic
        pixels[base + 3] = 1.0           # A = unused

    img.pixels = pixels
    img.colorspace_settings.name = 'Non-Color'

    filepath = os.path.join(output_dir, f"{material.name}_orm.png")
    scene = bpy.context.scene
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.compression = 90
    img.save_render(filepath, scene=scene)
    print(f"  Generated ORM: {filepath} (roughness={rough_val:.2f}, metallic={metal_val:.2f})")

    return img, rough_val, metal_val


# --------------------------------------------------------------------------- #
# MATERIAL REPLACEMENT (procedural → image-based)
# --------------------------------------------------------------------------- #

def _load_or_create_image_texture(filepath, name, is_color=True):
    """Load an image from disk or return existing Image datablock."""
    if filepath is None or not os.path.exists(filepath):
        return None
    img = bpy.data.images.get(os.path.basename(filepath))
    if img is None:
        img = bpy.data.images.load(filepath)
    if is_color:
        img.colorspace_settings.name = 'sRGB'
    else:
        img.colorspace_settings.name = 'Non-Color'
    return img


def create_baked_material(source_mat, baked_dir, roughness, metallic, has_emission,
                         baked_from_name=None):
    """
    Create a new material that uses baked image textures instead of
    procedural nodes.  This is what gets exported to GLB.
    
    If `baked_from_name` is provided, texture files from that material
    are used instead (for deduplicated materials).
    
    Returns the new Material datablock.
    """
    name = f"{source_mat.name}_BAKED"
    existing = bpy.data.materials.get(name)
    if existing:
        return existing

    # Which material's baked textures to use
    tex_prefix = baked_from_name or source_mat.name

    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    # Output
    out = nodes.new('ShaderNodeOutputMaterial')
    out.location = (600, 0)

    # Principled BSDF
    princ = nodes.new('ShaderNodeBsdfPrincipled')
    princ.location = (300, 0)
    links.new(princ.outputs['BSDF'], out.inputs['Surface'])

    # Base Color texture (JPEG, sRGB)
    bc_path = os.path.join(baked_dir, f"{tex_prefix}_basecolor.jpg")
    if os.path.exists(bc_path):
        bc_img = _load_or_create_image_texture(bc_path, f"{tex_prefix}_bc", True)
        if bc_img:
            bc_tex = nodes.new('ShaderNodeTexImage')
            bc_tex.image = bc_img
            bc_tex.location = (-300, 200)
            links.new(bc_tex.outputs['Color'], princ.inputs['Base Color'])

    # Normal texture (PNG, Non-Color) — only if exists
    nm_path = os.path.join(baked_dir, f"{tex_prefix}_normal.png")
    if os.path.exists(nm_path):
        nm_img = _load_or_create_image_texture(nm_path, f"{tex_prefix}_nm", False)
        if nm_img:
            nm_tex = nodes.new('ShaderNodeTexImage')
            nm_tex.image = nm_img
            nm_tex.location = (-300, -100)
            n_map = nodes.new('ShaderNodeNormalMap')
            n_map.location = (-50, -100)
            n_map.inputs['Strength'].default_value = 1.0
            links.new(nm_tex.outputs['Color'], n_map.inputs['Color'])
            links.new(n_map.outputs['Normal'], princ.inputs['Normal'])

    # Metallic & Roughness (from ORM or flat values)
    orm_path = os.path.join(baked_dir, f"{tex_prefix}_orm.png")
    if os.path.exists(orm_path):
        orm_img = _load_or_create_image_texture(orm_path, f"{tex_prefix}_orm", False)
        if orm_img:
            orm_tex = nodes.new('ShaderNodeTexImage')
            orm_tex.image = orm_img
            orm_tex.location = (-300, -350)
            sep = nodes.new('ShaderNodeSeparateColor')
            sep.location = (0, -350)
            links.new(orm_tex.outputs['Color'], sep.inputs['Color'])
            links.new(sep.outputs['Green'], princ.inputs['Roughness'])
            links.new(sep.outputs['Blue'], princ.inputs['Metallic'])
    else:
        princ.inputs['Roughness'].default_value = roughness
        princ.inputs['Metallic'].default_value = metallic

    # Emission texture (JPEG, sRGB) — only if exists
    em_path = os.path.join(baked_dir, f"{tex_prefix}_emission.jpg")
    if has_emission and os.path.exists(em_path):
        em_img = _load_or_create_image_texture(em_path, f"{tex_prefix}_em", True)
        if em_img:
            em_tex = nodes.new('ShaderNodeTexImage')
            em_tex.image = em_img
            em_tex.location = (-300, -600)
            links.new(em_tex.outputs['Color'], princ.inputs['Emission Color'])
            princ.inputs['Emission Strength'].default_value = 1.0

    return mat


def replace_materials_with_baked(col, baked_dir):
    """
    For every material used in a floor collection, replace it with its
    baked-image equivalent.  Falls back to flat values if baking wasn't done.
    """
    # Collect all unique materials in the collection
    all_mats = set()
    for obj in col.all_objects:
        if obj.type == 'MESH':
            for m in obj.data.materials:
                if m and not m.name.startswith('_BAKE_') and not m.name.endswith('_BAKED'):
                    all_mats.add(m)

    mat_map = {}  # original mat → baked mat

    for mat in all_mats:
        # Read original roughness/metallic
        rough_val = 0.5
        metal_val = 0.0
        has_emission = False
        if mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    r = node.inputs.get('Roughness')
                    if r:
                        rough_val = r.default_value
                    m = node.inputs.get('Metallic')
                    if m:
                        metal_val = m.default_value
                    e = node.inputs.get('Emission Strength')
                    if e and e.default_value > 0.01:
                        has_emission = True
                    break

        # Check if this material was baked from another (dedup)
        baked_from = None
        # Try to find this material's basecolor — if missing, check dedup candidates
        bc_path = os.path.join(baked_dir, f"{mat.name}_basecolor.jpg")
        if not os.path.exists(bc_path):
            # Look for any basecolor file whose material has matching properties
            for fname in os.listdir(baked_dir):
                if fname.endswith('_basecolor.jpg'):
                    candidate = fname.replace('_basecolor.jpg', '')
                    if candidate != mat.name:
                        # Quick check: same roughness/metallic?
                        candidate_bc = os.path.join(baked_dir, fname)
                        if os.path.exists(candidate_bc):
                            baked_from = candidate
                            break

        baked_mat = create_baked_material(mat, baked_dir, rough_val, metal_val,
                                          has_emission, baked_from_name=baked_from)
        mat_map[mat] = baked_mat

    # Apply baked materials to all objects
    replaced = 0
    for obj in col.all_objects:
        if obj.type == 'MESH':
            for i, m in enumerate(obj.data.materials):
                if m in mat_map:
                    obj.data.materials[i] = mat_map[m]
                    replaced += 1

    # Remove old procedural materials from objects (Blender still holds them in data)
    print(f"  Replaced {replaced} material slots with baked versions in {col.name}")
    return mat_map


# --------------------------------------------------------------------------- #
# BAKE SESSION (per-floor orchestration)
# --------------------------------------------------------------------------- #

class BakeSession:
    """
    Orchestrates baking for one floor collection with smart resolution tiers.
    
    Resolution auto-selection:
      - Large surfaces (walls, slabs, tanks): 512px
      - Medium equipment (panels, pumps): 256px  
      - Small fixtures (LEDs, cords): 128px
      - ORM maps: always 64px (uniform values)
    
    Normals are skipped for flat materials (bump=None) and tiny objects.
    """

    def __init__(self, output_dir=None):
        self.output_dir = output_dir or os.path.join(HERE, "baked_textures")
        os.makedirs(self.output_dir, exist_ok=True)
        self.baked_count = 0
        self.total_size_kb = 0
        self._baked_cache = {}  # (rgba_hash, rough, metal, emit) → baked mat name

    def _classify_material(self, mat, obj_list):
        """Return (resolution, skip_normal) for a material based on its objects."""
        # Calculate total object bounding box volume
        max_dim = 0.0
        for obj in obj_list:
            if obj.type == 'MESH':
                dims = obj.dimensions
                max_dim = max(max_dim, max(dims.x, dims.y, dims.z))

        if max_dim > 3.0:       # walls, slabs, large tanks
            return RES_LARGE, False
        elif max_dim > 0.5:     # equipment, panels
            return RES_MEDIUM, False
        else:                    # LEDs, cords, small fixtures
            return RES_SMALL, True  # skip normals for tiny objects

    def _material_has_bump(self, mat):
        """Check if a material has any bump/displacement node."""
        if not mat.use_nodes:
            return False
        has_bump = False
        for node in mat.node_tree.nodes:
            if node.type == 'BUMP':
                strength = node.inputs.get('Strength')
                if strength and (strength.default_value > 0.001 or strength.is_linked):
                    has_bump = True
        # Also check the mat() function's bump parameter
        # We detect via the noise+bump node pattern
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_NOISE':
                # Check if connected to a bump node
                for link in mat.node_tree.links:
                    if link.from_node == node:
                        to_node = link.to_node
                        if to_node and to_node.type == 'BUMP':
                            has_bump = True
        return has_bump

    def _get_material_props(self, mat):
        """Extract key properties for deduplication."""
        if not mat.use_nodes:
            return None
        props = {'roughness': 0.5, 'metallic': 0.0, 'emission': 0.0, 'base_color': None}
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                bc = node.inputs.get('Base Color')
                if bc:
                    props['base_color'] = tuple(round(v, 3) for v in bc.default_value[:3])
                r = node.inputs.get('Roughness')
                if r and not r.is_linked:
                    props['roughness'] = round(r.default_value, 2)
                m = node.inputs.get('Metallic')
                if m and not m.is_linked:
                    props['metallic'] = round(m.default_value, 2)
                e = node.inputs.get('Emission Strength')
                if e:
                    props['emission'] = round(e.default_value, 2)
                break
        return props

    def bake_floor(self, col):
        """Full bake pipeline for a floor collection with tiered resolution."""
        print(f"\n{'='*60}")
        print(f"BAKING floor: {col.name}")
        print(f"{'='*60}")

        # Step 1: UV unwrap everything
        print("Step 1/5: UV unwrapping...")
        unwrap_collection(col)

        # Step 2: Setup Cycles
        print("Step 2/5: Configuring Cycles bake engine...")
        _setup_cycles_for_baking()

        # Step 3: Collect materials with object size info
        all_mats = set()
        obj_map = {}
        for obj in col.all_objects:
            if obj.type == 'MESH':
                for m in obj.data.materials:
                    if m and not m.name.startswith('_BAKE') and not m.name.endswith('_BAKED'):
                        all_mats.add(m)
                        if m not in obj_map:
                            obj_map[m] = []
                        obj_map[m].append(obj)

        # Step 3b: Deduplicate materials with identical properties
        mat_groups = {}  # dedup_key → list of (mat, objects)
        dedup_count = 0
        for mat in all_mats:
            props = self._get_material_props(mat)
            if props and props['base_color'] is not None:
                key = (props['base_color'], props['roughness'], props['metallic'], props['emission'])
                if key not in mat_groups:
                    mat_groups[key] = []
                mat_groups[key].append((mat, obj_map[mat]))
            else:
                # Can't dedup — treat uniquely
                mat_groups[f"__unique__{mat.name}"] = [(mat, obj_map[mat])]

        dedup_count = sum(1 for g in mat_groups.values() if len(g) > 1)
        unique_to_bake = len(mat_groups)
        print(f"Step 3/5: {len(all_mats)} materials → {unique_to_bake} unique"
              f" ({dedup_count} groups deduplicated)")

        # Step 4: Bake each unique material group
        print("Step 4/5: Baking PBR maps...")
        material_registry = {}

        for i, (dedup_key, group) in enumerate(sorted(mat_groups.items())):
            primary_mat = group[0][0]  # first material in group
            # Merge object lists
            all_objs = []
            for _, objs in group:
                all_objs.extend(objs)
            # Deduplicate objects
            all_objs = list({o.name: o for o in all_objs}.values())

            # Classify resolution tier
            res, skip_normal = self._classify_material(primary_mat, all_objs)
            has_bump = self._material_has_bump(primary_mat)
            if skip_normal or not has_bump:
                skip_normal = True
                normal_res = 0
            else:
                normal_res = res

            group_label = primary_mat.name if len(group) == 1 else f"{primary_mat.name}+{len(group)-1}more"
            tier_label = f"{res}px" + (" (no normal)" if skip_normal else " +normal")
            print(f"\n  [{i+1}/{unique_to_bake}] {group_label} [{tier_label}]"
                  f" ({len(all_objs)} objects)")

            # Read material properties
            rough_val = 0.5
            metal_val = 0.0
            has_emission = False
            if primary_mat.use_nodes:
                for node in primary_mat.node_tree.nodes:
                    if node.type == 'BSDF_PRINCIPLED':
                        r = node.inputs.get('Roughness')
                        if r and not r.is_linked:
                            rough_val = r.default_value
                        elif r and r.is_linked:
                            rough_val = 0.5
                        m_in = node.inputs.get('Metallic')
                        if m_in and not m_in.is_linked:
                            metal_val = m_in.default_value
                        e = node.inputs.get('Emission Strength')
                        if e and e.default_value > 0.01:
                            has_emission = True
                        break

            # Bake Base Color (always)
            bc = bake_material_basecolor(primary_mat, all_objs, res, self.output_dir)

            # Bake Normal (only if bump present and large enough)
            nm = None
            if not skip_normal and normal_res > 0:
                nm = bake_material_normal(primary_mat, all_objs, normal_res, self.output_dir)

            # Bake Emission (only if emissive)
            em = None
            if has_emission:
                em = bake_material_emission(primary_mat, all_objs, res, self.output_dir)

            # Generate ORM
            orm_result = bake_material_orm(primary_mat, all_objs, RES_ORM, self.output_dir)
            if orm_result:
                _, rv, mv = orm_result
                rough_val = rv
                metal_val = mv

            # Register ALL materials in the group
            for mat, _ in group:
                material_registry[mat.name] = {
                    'roughness': rough_val,
                    'metallic': metal_val,
                    'has_emission': has_emission,
                    'baked_from': primary_mat.name,  # which material was actually baked
                }

            # Track file sizes
            for fname in os.listdir(self.output_dir):
                if fname.startswith(primary_mat.name):
                    self.total_size_kb += os.path.getsize(
                        os.path.join(self.output_dir, fname)) / 1024

            self.baked_count += 1

        # If dedup occurred, create symlinks/shared materials for the dedup'd ones
        for dedup_key, group in mat_groups.items():
            if len(group) <= 1:
                continue
            primary_mat = group[0][0]
            for mat, _ in group[1:]:
                # Register this material to reuse the primary's baked textures
                if mat.name not in material_registry:
                    material_registry[mat.name] = material_registry[primary_mat.name].copy()
                # Create hardlink/symlink for the texture files
                for suffix in ['_basecolor.jpg', '_normal.png', '_orm.png', '_emission.jpg']:
                    src = os.path.join(self.output_dir, f"{primary_mat.name}{suffix}")
                    dst = os.path.join(self.output_dir, f"{mat.name}{suffix}")
                    if os.path.exists(src) and not os.path.exists(dst):
                        try:
                            os.link(src, dst)  # hardlink — no extra disk space
                        except OSError:
                            pass  # cross-device link not supported, file will be missing

        # Step 5: Summary
        dedup_saved = len(all_mats) - unique_to_bake
        print(f"\n{'='*60}")
        print(f"Bake complete: {self.baked_count} unique bakes "
              f"(saved {dedup_saved} duplicates)")
        print(f"Total baked texture size: {self.total_size_kb:.1f} KB")
        print(f"Output directory: {self.output_dir}")
        print(f"{'='*60}\n")

        return material_registry

    def replace_materials_with_baked(self, col):
        """Replace all procedural materials with baked-image versions."""
        return replace_materials_with_baked(col, self.output_dir)


# --------------------------------------------------------------------------- #
# UTILITY: Clear baked textures
# --------------------------------------------------------------------------- #

def clear_baked_textures(output_dir=None):
    """Remove all baked texture files and image datablocks."""
    d = output_dir or os.path.join(HERE, "baked_textures")
    if os.path.isdir(d):
        for f in os.listdir(d):
            os.remove(os.path.join(d, f))
        print(f"Cleared {d}")

    # Remove baked image datablocks from Blender
    for img in list(bpy.data.images):
        if '_basecolor' in img.name or '_normal' in img.name or '_orm' in img.name or '_emission' in img.name:
            bpy.data.images.remove(img)
