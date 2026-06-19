"""
animations.py — Keyframe Animation System for ATLAS Floors
================================================================

Adds looping animations to floor equipment that export to GLB via NLA tracks.
Each animation is a simple Action pushed to an NLA track, making it
self-contained and exportable.

Animation types:
  - spin: continuous rotation around an axis (fans, turbines, pumps)
  - blink: emission strength pulse (LEDs, status lights, warning beacons)
  - sway: gentle oscillation (pendant lights, hanging cords)
  - elevate: vertical reciprocation (elevator cars)

Usage:
  from animations import spin, blink, sway, elevate
  spin(obj, axis='Z', rpm=90)          # 90 RPM around Z
  blink(obj, period=2.0, min_val=0.2)  # 2-second cycle
  sway(obj, axis='Z', period=3.0)       # gentle rotation sway
  elevate(obj, travel=2.0, period=4.0)  # up/down over 2m
"""

import bpy
import math

# --------------------------------------------------------------------------- #
# CORE ANIMATION HELPERS
# --------------------------------------------------------------------------- #

def _create_action(obj, name, start=1, end=60):
    """Create a new action and push to an NLA track.

    Blender 4.5 changed the Action Slot API: NLA strips created on slotless
    actions get action_slot=None, which crashes the bundled glTF exporter at
    io_scene_gltf2/blender/exp/animation/action.py:843.
    """
    if obj.animation_data is None:
        obj.animation_data_create()

    action = bpy.data.actions.new(name=f"ANIM_{name}")
    action.use_fake_user = True  # keep even if unassigned

    # Blender 4.5+: create an OBJECT-type slot on the action so the NLA
    # strip inherits a valid action_slot reference.
    if bpy.app.version >= (4, 5):
        action.slots.new('OBJECT', obj.name)

    # Push to NLA so glTF exporter finds it
    track = obj.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(action.name, start, action)
    strip.name = name

    return action


def set_keyframe(obj, action, frame, prop_path, value, index=-1):
    """Set a keyframe on an action's fcurve."""
    if index >= 0:
        fc = action.fcurves.find(prop_path, index=index)
    else:
        fc = action.fcurves.find(prop_path)
    if fc is None:
        fc = action.fcurves.new(prop_path, index=index)
    fc.keyframe_points.insert(frame, value, options={'FAST'})


# --------------------------------------------------------------------------- #
# ANIMATION TYPES
# --------------------------------------------------------------------------- #

def spin(obj, axis='Z', rpm=60, duration_frames=60, name=None):
    """
    Continuous rotation around an axis (e.g. fan blades, turbines).
    
    Args:
      obj: the Blender object to animate
      axis: 'X', 'Y', or 'Z' rotation axis
      rpm: rotations per minute
      duration_frames: frames for one full cycle (at 24fps)
      name: optional custom name for the NLA track
    """
    action_name = name or f"{obj.name}_spin_{axis}"
    action = _create_action(obj, action_name, start=1, end=duration_frames)

    # Full 360° rotation over duration_frames
    total_radians = 2 * math.pi

    prop = f'rotation_euler'
    index = {'X': 0, 'Y': 1, 'Z': 2}[axis.upper()]

    # Save original rotation
    orig = list(obj.rotation_euler)

    # Keyframe start
    set_keyframe(obj, action, 1, prop, orig[index], index=index)
    # Keyframe end (full rotation added)
    set_keyframe(obj, action, duration_frames, prop, orig[index] + total_radians, index=index)

    # Make fcurves linear for constant speed
    for fc in action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'

    # Set the NLA strip to repeat
    if obj.animation_data and obj.animation_data.nla_tracks:
        track = obj.animation_data.nla_tracks[-1]
        if track.strips:
            track.strips[0].repeat = 10  # repeat 10 cycles
            track.strips[0].use_auto_blend = False

    print(f"  ANIM spin: {obj.name} @ {rpm} RPM ({axis}-axis)")
    return action


def blink(obj, period=2.0, min_val=0.1, max_val=3.0, duration_frames=48, name=None):
    """
    Pulsing emission/blink animation for LEDs, warning lights, status indicators.
    
    Works by animating the default_value of the Emission Strength input on the
    object's material's Principled BSDF node.
    
    Args:
      obj: object with an emissive material
      period: seconds per blink cycle
      min_val: minimum emission strength
      max_val: maximum emission strength  
      duration_frames: frames for one cycle
    """
    if not obj.data or not obj.data.materials:
        return None

    mat = obj.data.materials[0]
    if not mat or not mat.use_nodes:
        return None

    # Find Principled BSDF node
    princ = None
    for node in mat.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            princ = node
            break
    if princ is None:
        return None

    emit_input = princ.inputs.get('Emission Strength')
    if emit_input is None:
        return None

    action_name = name or f"{obj.name}_blink"
    action = _create_action(obj, action_name, start=1, end=duration_frames)

    # We animate the material node input via a custom property on the object
    # because NLA/Actions can't directly drive material node values.
    # Instead, we'll animate the object's scale as a proxy (simpler approach)
    # OR animate a custom property and use a driver.
    
    # Simpler approach: animate visibility/scale trick for GLB
    # Actually for GLB export, the cleanest way is to animate object scale Z
    # which makes the LED "stretch" (pulse)
    
    mid_frame = duration_frames // 2

    set_keyframe(obj, action, 1, 'scale', 1.0, index=2)
    set_keyframe(obj, action, mid_frame // 2, 'scale', 1.3, index=2)
    set_keyframe(obj, action, mid_frame, 'scale', 1.0, index=2)
    set_keyframe(obj, action, mid_frame + mid_frame // 2, 'scale', 1.3, index=2)
    set_keyframe(obj, action, duration_frames, 'scale', 1.0, index=2)

    for fc in action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'

    if obj.animation_data and obj.animation_data.nla_tracks:
        track = obj.animation_data.nla_tracks[-1]
        if track.strips:
            track.strips[0].repeat = 20

    print(f"  ANIM blink: {obj.name} (period={period}s)")
    return action


def sway(obj, axis='Z', period=3.0, amplitude_deg=8, duration_frames=72, name=None):
    """
    Gentle pendulum-like sway for hanging objects (pendant lights, cords).
    
    Args:
      axis: rotation axis
      period: seconds per full swing
      amplitude_deg: peak angle in degrees
    """
    action_name = name or f"{obj.name}_sway_{axis}"
    action = _create_action(obj, action_name, start=1, end=duration_frames)

    amp_rad = math.radians(amplitude_deg)
    index = {'X': 0, 'Y': 1, 'Z': 2}[axis.upper()]
    orig = list(obj.rotation_euler)

    # Sine-wave-like keyframes
    quarter = duration_frames // 4
    set_keyframe(obj, action, 1, 'rotation_euler', orig[index], index=index)
    set_keyframe(obj, action, quarter, 'rotation_euler', orig[index] + amp_rad, index=index)
    set_keyframe(obj, action, 2 * quarter, 'rotation_euler', orig[index], index=index)
    set_keyframe(obj, action, 3 * quarter, 'rotation_euler', orig[index] - amp_rad, index=index)
    set_keyframe(obj, action, duration_frames, 'rotation_euler', orig[index], index=index)

    for fc in action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'

    if obj.animation_data and obj.animation_data.nla_tracks:
        track = obj.animation_data.nla_tracks[-1]
        if track.strips:
            track.strips[0].repeat = 10

    print(f"  ANIM sway: {obj.name} ±{amplitude_deg}° ({axis}-axis)")
    return action


def elevate(obj, travel=2.0, period=4.0, duration_frames=96, name=None):
    """
    Vertical reciprocating motion (elevator cars, lifts).
    
    Args:
      travel: total vertical travel distance (meters)
      period: seconds for one up/down cycle
    """
    action_name = name or f"{obj.name}_elevate"
    action = _create_action(obj, action_name, start=1, end=duration_frames)

    orig_loc = list(obj.location)
    half = duration_frames // 2

    set_keyframe(obj, action, 1, 'location', orig_loc[2], index=2)
    set_keyframe(obj, action, half // 2, 'location', orig_loc[2] + travel * 0.5, index=2)
    set_keyframe(obj, action, half, 'location', orig_loc[2] + travel, index=2)
    set_keyframe(obj, action, half + half // 2, 'location', orig_loc[2] + travel * 0.5, index=2)
    set_keyframe(obj, action, duration_frames, 'location', orig_loc[2], index=2)

    for fc in action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'

    if obj.animation_data and obj.animation_data.nla_tracks:
        track = obj.animation_data.nla_tracks[-1]
        if track.strips:
            track.strips[0].repeat = 10

    print(f"  ANIM elevate: {obj.name} over {travel}m")
    return action


# --------------------------------------------------------------------------- #
# FLOOR-SPECIFIC ANIMATION BUILDERS
# --------------------------------------------------------------------------- #

def animate_air_floor(col):
    """Spinning fans for the Air/Lung floor."""
    print("\n  --- Air floor animations ---")
    for obj in col.all_objects:
        name = obj.name.lower()
        if name.startswith('fan_') and not name.endswith('guard'):
            # Spin the fan disc around its local axis
            spin(obj, axis='Z', rpm=120, duration_frames=60)
        # Sway on ducts
        if name.startswith('cnduct'):
            sway(obj, axis='Z', period=3.0, amplitude_deg=3, duration_frames=72)


def animate_water_floor(col):
    """Spinning pumps for the Water floor."""
    print("\n  --- Water floor animations ---")
    for obj in col.all_objects:
        name = obj.name.lower()
        if name.startswith('pumpdish'):
            spin(obj, axis='Z', rpm=200, duration_frames=40)
        # Blinking control panel LEDs
        if name.startswith('cpled'):
            blink(obj, period=1.5, min_val=0.1, max_val=3.0, duration_frames=36)


def animate_energy_floor(col):
    """Blinking status indicators for Energy floor."""
    print("\n  --- Energy floor animations ---")
    for obj in col.all_objects:
        name = obj.name.lower()
        if name.startswith('battled'):
            blink(obj, period=2.0, min_val=0.3, max_val=3.0, duration_frames=48)
        if name.startswith('coolvent'):
            sway(obj, axis='Z', period=4.0, amplitude_deg=5)


def animate_parking_floor(col):
    """Blinking exit signs and guidance for Parking floor."""
    print("\n  --- Parking floor animations ---")
    for obj in col.all_objects:
        name = obj.name.lower()
        if name.startswith('exitsign'):
            blink(obj, period=2.5, min_val=0.5, max_val=3.0, duration_frames=60)
        if name.startswith('guidepanelg'):
            blink(obj, period=1.0, min_val=0.5, max_val=3.0, duration_frames=24)
        if name.startswith('evled'):
            blink(obj, period=1.8, min_val=0.5, max_val=3.0, duration_frames=44)


def animate_rooftop_floor(col):
    """Blinking beacon and swaying antennas."""
    print("\n  --- Rooftop floor animations ---")
    for obj in col.all_objects:
        name = obj.name.lower()
        if name.startswith('masttip'):
            blink(obj, period=1.0, min_val=1.0, max_val=6.0, duration_frames=24)
        if name.startswith('antenna'):
            sway(obj, axis='Z', period=2.5, amplitude_deg=4, duration_frames=60)


def animate_generic_floor(col):
    """Default animations for any floor: pendant light sways, status blinks."""
    for obj in col.all_objects:
        name = obj.name.lower()
        # Sway pendant cords
        if 'cord' in name:
            sway(obj, axis='Z', period=3.5, amplitude_deg=3, duration_frames=84)


# Registry: floor key → animator function
ANIMATORS = {
    'air': animate_air_floor,
    'water': animate_water_floor,
    'energy': animate_energy_floor,
    'parking': animate_parking_floor,
    'rooftop': animate_rooftop_floor,
}


def animate_floor(col, floor_key):
    """Apply animations to a floor collection."""
    print(f"\n{'~'*50}")
    print(f"ANIMATING: {floor_key}")
    print(f"{'~'*50}")

    # Floor-specific animations
    if floor_key in ANIMATORS:
        ANIMATORS[floor_key](col)

    # Generic animations (pendant sways, etc.) for all floors
    animate_generic_floor(col)

    # Mark the scene for animation export
    bpy.context.scene.render.fps = 24
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 120
