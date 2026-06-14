import bpy, math
from mathutils import Vector
sc=bpy.context.scene

# cleaner sky
w=bpy.data.worlds[0]
for n in w.node_tree.nodes:
    if n.bl_idname=='ShaderNodeTexSky':
        n.air_density=1.0; n.dust_density=0.8; n.sun_elevation=math.radians(16); n.sun_rotation=math.radians(50)
    if n.bl_idname=='ShaderNodeBackground':
        n.inputs['Strength'].default_value=1.0

# match sun to sky
sun=bpy.data.objects.get("Sun_Pilatus PC") or bpy.data.objects.get("Sun_Key")
if sun:
    sun.data.energy=5.5; sun.data.color=(1.0,0.93,0.80)
    sun.rotation_euler=(math.radians(90)-math.radians(16),0,math.radians(50))

# low hero camera, more level -> sky visible
cam=bpy.data.objects.get("ENV_HeroCam")
cam.data.lens=50
cam.location=Vector((-66,-128,13))
tgt=Vector((10,34,7))
cam.rotation_euler=(tgt-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.dof.use_dof=True
cam.data.dof.focus_distance=(tgt-cam.location).length
cam.data.dof.aperture_fstop=7.0
sc.camera=cam

sc.render.resolution_percentage=50
sc.render.filepath='/Users/elijahroyaei/Desktop/AOS/_blender/fleet_render.png'
bpy.ops.render.render(write_still=True)
print("REFRAME_DONE")
