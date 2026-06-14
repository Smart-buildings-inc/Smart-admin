import bpy, math
from mathutils import Vector
sc=bpy.context.scene; master=sc.collection

# Sky world (idempotent)
w=bpy.data.worlds[0]; w.use_nodes=True
wnt=w.node_tree; wnt.nodes.clear()
wout=wnt.nodes.new('ShaderNodeOutputWorld'); wout.location=(300,0)
bg=wnt.nodes.new('ShaderNodeBackground'); bg.location=(100,0)
sky=wnt.nodes.new('ShaderNodeTexSky'); sky.location=(-200,0); sky.sky_type='NISHITA'
sky.sun_elevation=math.radians(18); sky.sun_rotation=math.radians(40)
sky.air_density=1.2; sky.dust_density=2.2
wnt.links.new(sky.outputs['Color'], bg.inputs['Color'])
wnt.links.new(bg.outputs['Background'], wout.inputs['Surface'])

# Sun
sun=bpy.data.objects.get("Sun_Pilatus PC")
if not sun:
    sd=bpy.data.lights.new("Sun_Key",'SUN'); sun=bpy.data.objects.new("Sun_Key",sd); master.objects.link(sun)
sun.data.type='SUN'; sun.data.energy=4.5; sun.data.color=(1.0,0.95,0.86); sun.data.angle=math.radians(1.5)
sun.rotation_euler=(math.radians(90)-math.radians(18),0,math.radians(40))

# Fill
fill=bpy.data.objects.get("ENV_Fill")
if not fill:
    fd=bpy.data.lights.new("ENV_Fill",'AREA'); fill=bpy.data.objects.new("ENV_Fill",fd); master.objects.link(fill)
fill.data.type='AREA'; fill.data.shape='RECTANGLE'; fill.data.size=120; fill.data.size_y=120
fill.data.energy=15000; fill.data.color=(0.6,0.72,1.0)
fill.location=(120,-40,70)
fill.rotation_euler=(Vector((6,35,4))-fill.location).to_track_quat('-Z','Y').to_euler()

# Camera
cam=bpy.data.objects.get("ENV_HeroCam")
if not cam:
    cd=bpy.data.cameras.new("ENV_HeroCam"); cam=bpy.data.objects.new("ENV_HeroCam",cd); master.objects.link(cam)
cam.data.lens=42; cam.data.dof.use_dof=True; cam.data.dof.focus_distance=95; cam.data.dof.aperture_fstop=4.0
cam.location=Vector((-78,-70,30))
cam.rotation_euler=(Vector((6,34,4))-cam.location).to_track_quat('-Z','Y').to_euler()
sc.camera=cam

# EEVEE
sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.film_transparent=False
ee=sc.eevee
for a,v in [("taa_render_samples",96),("use_raytracing",True),("use_volumetric_lights",True)]:
    try: setattr(ee,a,v)
    except: pass
try: ee.ray_tracing_options.use_denoise=True
except: pass
sc.view_settings.view_transform='AgX'
try: sc.view_settings.look='AgX - Medium High Contrast'
except: pass

# Compositor glare
sc.use_nodes=True; cnt=sc.node_tree; cnt.nodes.clear()
rl=cnt.nodes.new('CompositorNodeRLayers'); rl.location=(0,0)
glare=cnt.nodes.new('CompositorNodeGlare'); glare.location=(300,0)
try: glare.glare_type='BLOOM'
except: glare.glare_type='FOG_GLOW'
glare.mix=-0.75; glare.threshold=1.0
try: glare.size=7
except: pass
comp=cnt.nodes.new('CompositorNodeComposite'); comp.location=(600,0)
cnt.links.new(rl.outputs['Image'], glare.inputs['Image'])
cnt.links.new(glare.outputs['Image'], comp.inputs['Image'])

sc.render.resolution_x=1920; sc.render.resolution_y=1080; sc.render.resolution_percentage=50
sc.render.filepath='/Users/elijahroyaei/Desktop/AOS/_blender/fleet_render.png'
bpy.ops.render.render(write_still=True)
print("ENV_PART2_FIXED_AND_RENDERED")
