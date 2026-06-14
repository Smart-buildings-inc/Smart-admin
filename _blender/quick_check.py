import bpy
from mathutils import Vector
sc=bpy.context.scene; master=sc.collection
# unlink problem fleets from view
for fn in ["Fleet_Cessna Citation Longitude","Fleet_Airbus H145","Fleet_Embraer Phenom 300"]:
    c=bpy.data.collections.get(fn)
    if c and c.name in [ch.name for ch in master.children]:
        master.children.unlink(c)
bpy.context.view_layer.update()

# temp camera
cam=bpy.data.objects.get("CHK_Cam")
if not cam:
    cd=bpy.data.cameras.new("CHK_Cam"); cam=bpy.data.objects.new("CHK_Cam",cd); master.objects.link(cam)
cam.data.lens=35
cam.location=Vector((-55,-95,55))
target=Vector((10,40,3))
d=(target-cam.location); cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
sc.camera=cam

# ensure a sun exists & decent world
sun=bpy.data.objects.get("Sun_Pilatus PC")
if sun: sun.data.energy=4.0
w=bpy.data.worlds[0]; w.use_nodes=True
bg=w.node_tree.nodes.get("Background")
if bg: bg.inputs[0].default_value=(0.32,0.46,0.7,1); bg.inputs[1].default_value=1.2

sc.render.engine='BLENDER_EEVEE_NEXT'
sc.render.film_transparent=False
sc.render.resolution_x=960; sc.render.resolution_y=540; sc.render.resolution_percentage=100
try: sc.eevee.taa_render_samples=16
except: pass
sc.render.filepath='/Users/elijahroyaei/Desktop/AOS/_blender/check.png'
bpy.ops.render.render(write_still=True)
print("CHECK_RENDER_DONE")
