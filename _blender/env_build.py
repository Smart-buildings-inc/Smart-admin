import bpy, math
from mathutils import Vector
sc=bpy.context.scene; master=sc.collection

# ---- 0. prune defective fleets ----
for fn in ["Fleet_Cessna Citation Longitude","Fleet_Airbus H145","Fleet_Embraer Phenom 300"]:
    c=bpy.data.collections.get(fn)
    if c and c.name in [ch.name for ch in master.children]:
        master.children.unlink(c)

# env collection
env=bpy.data.collections.get("ENV")
if not env:
    env=bpy.data.collections.new("ENV"); master.children.link(env)

def newmesh(name, me):
    o=bpy.data.objects.new(name, me); env.objects.link(o); return o

# ---- 1. procedural PBR asphalt tarmac ----
def tarmac_mat():
    m=bpy.data.materials.get("ENV_Tarmac")
    if m: return m
    m=bpy.data.materials.new("ENV_Tarmac"); m.use_nodes=True
    nt=m.node_tree; nt.nodes.clear()
    n=nt.nodes.new; lk=nt.links.new
    out=n('ShaderNodeOutputMaterial'); out.location=(900,0)
    bsdf=n('ShaderNodeBsdfPrincipled'); bsdf.location=(560,0)
    tc=n('ShaderNodeTexCoord'); tc.location=(-1100,0)
    map=n('ShaderNodeMapping'); map.location=(-900,0); map.inputs['Scale'].default_value=(1,1,1)
    lk(tc.outputs['Object'], map.inputs['Vector'])
    # aggregate voronoi
    vor=n('ShaderNodeTexVoronoi'); vor.location=(-650,200); vor.inputs['Scale'].default_value=120.0
    vor.feature='F1'
    lk(map.outputs['Vector'], vor.inputs['Vector'])
    agg_ramp=n('ShaderNodeValToRGB'); agg_ramp.location=(-430,260)
    agg_ramp.color_ramp.elements[0].position=0.45; agg_ramp.color_ramp.elements[0].color=(0.012,0.012,0.013,1)
    agg_ramp.color_ramp.elements[1].position=0.85; agg_ramp.color_ramp.elements[1].color=(0.05,0.049,0.046,1)
    lk(vor.outputs['Distance'], agg_ramp.inputs['Fac'])
    # large stain noise
    noise=n('ShaderNodeTexNoise'); noise.location=(-650,-60); noise.inputs['Scale'].default_value=3.5
    noise.inputs['Detail'].default_value=8.0
    lk(map.outputs['Vector'], noise.inputs['Vector'])
    stain=n('ShaderNodeValToRGB'); stain.location=(-430,-40)
    stain.color_ramp.elements[0].position=0.35; stain.color_ramp.elements[0].color=(0.018,0.018,0.02,1)
    stain.color_ramp.elements[1].position=0.7; stain.color_ramp.elements[1].color=(0.04,0.04,0.04,1)
    lk(noise.outputs['Fac'], stain.inputs['Fac'])
    mixc=n('ShaderNodeMixRGB'); mixc.location=(-150,120); mixc.blend_type='MULTIPLY'; mixc.inputs['Fac'].default_value=0.6
    lk(stain.outputs['Color'], mixc.inputs['Color1']); lk(agg_ramp.outputs['Color'], mixc.inputs['Color2'])
    lk(mixc.outputs['Color'], bsdf.inputs['Base Color'])
    # roughness variation
    rnoise=n('ShaderNodeTexNoise'); rnoise.location=(-650,-320); rnoise.inputs['Scale'].default_value=12.0
    rramp=n('ShaderNodeValToRGB'); rramp.location=(-430,-320)
    rramp.color_ramp.elements[0].position=0.3; rramp.color_ramp.elements[0].color=(0.55,0.55,0.55,1)
    rramp.color_ramp.elements[1].position=0.8; rramp.color_ramp.elements[1].color=(0.92,0.92,0.92,1)
    lk(map.outputs['Vector'], rnoise.inputs['Vector']); lk(rnoise.outputs['Fac'], rramp.inputs['Fac'])
    lk(rramp.outputs['Color'], bsdf.inputs['Roughness'])
    # bump: aggregate + cracks
    cr=n('ShaderNodeTexVoronoi'); cr.location=(-650,-560); cr.inputs['Scale'].default_value=8.0
    cr.feature='DISTANCE_TO_EDGE'
    lk(map.outputs['Vector'], cr.inputs['Vector'])
    crramp=n('ShaderNodeValToRGB'); crramp.location=(-430,-560)
    crramp.color_ramp.elements[0].position=0.0; crramp.color_ramp.elements[0].color=(0,0,0,1)
    crramp.color_ramp.elements[1].position=0.04; crramp.color_ramp.elements[1].color=(1,1,1,1)
    lk(cr.outputs['Distance'], crramp.inputs['Fac'])
    bumpmix=n('ShaderNodeMixRGB'); bumpmix.location=(-150,-360); bumpmix.blend_type='MULTIPLY'
    bumpmix.inputs['Fac'].default_value=1.0
    lk(agg_ramp.outputs['Color'], bumpmix.inputs['Color1']); lk(crramp.outputs['Color'], bumpmix.inputs['Color2'])
    bump=n('ShaderNodeBump'); bump.location=(200,-300); bump.inputs['Strength'].default_value=0.25
    lk(bumpmix.outputs['Color'], bump.inputs['Height']); lk(bump.outputs['Normal'], bsdf.inputs['Normal'])
    lk(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m

def paint_mat(col, name):
    m=bpy.data.materials.get(name)
    if m: return m
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes.get("Principled BSDF")
    b.inputs['Base Color'].default_value=col
    b.inputs['Roughness'].default_value=0.5
    return m

# ground
bpy.ops.mesh.primitive_plane_add(size=1200, location=(6,35,0))
ground=bpy.context.active_object; ground.name="ENV_Ground"
# move to env collection
for c in ground.users_collection: c.objects.unlink(ground)
env.objects.link(ground)
ground.data.materials.append(tarmac_mat())

# taxi centerline (thin yellow strips) along Y through the ramp
yellow=paint_mat((0.45,0.34,0.02,1),"ENV_TaxiLine")
for (px,length,wy) in [(6,180,0.5)]:
    bpy.ops.mesh.primitive_plane_add(size=1,location=(px,35,0.02))
    s=bpy.context.active_object; s.name="ENV_TaxiLine"
    s.scale=(wy,length,1)
    for c in s.users_collection: c.objects.unlink(s)
    env.objects.link(s); s.data.materials.append(yellow)

print("ENV_PART1_DONE")

# ---- 2. Sky (Nishita) world ----
w=bpy.data.worlds[0]; w.use_nodes=True
wnt=w.node_tree; wnt.nodes.clear()
wout=wnt.nodes.new('ShaderNodeOutputWorld'); wout.location=(300,0)
bg=wnt.nodes.new('ShaderNodeBackground'); bg.location=(100,0); bg.inputs['Strength'].default_value=1.0
sky=wnt.nodes.new('ShaderNodeTexSky'); sky.location=(-200,0)
sky.sky_type='NISHITA'
sky.sun_elevation=math.radians(18)
sky.sun_rotation=math.radians(40)
try: sky.sun_intensity=0.6
except: pass
sky.air_density=1.2; sky.dust_density=2.2
wnt.links.new(sky.outputs['Color'], bg.inputs['Color'])
wnt.links.new(bg.outputs['Background'], wout.inputs['Surface'])

# ---- 3. Sun key light matching sky ----
sun=bpy.data.objects.get("Sun_Pilatus PC")
if not sun:
    sd=bpy.data.lights.new("Sun_Key",'SUN'); sun=bpy.data.objects.new("Sun_Key",sd); master.objects.link(sun)
sun.data.type='SUN'
sun.data.energy=4.5
sun.data.color=(1.0,0.95,0.86)
sun.data.angle=math.radians(1.5)  # soft shadow penumbra
# point sun: elevation 18, azimuth 40 -> rotation
el=math.radians(18); az=math.radians(40)
sun.rotation_euler=(math.radians(90)-el, 0, az)

# subtle cool fill area from opposite side
fill=bpy.data.objects.get("ENV_Fill")
if not fill:
    fd=bpy.data.lights.new("ENV_Fill",'AREA'); fill=bpy.data.objects.new("ENV_Fill",fd); master.objects.link(fill)
fill.data.type='AREA'; fill.data.shape='RECTANGLE'; fill.data.size=120; fill.data.size_y=120
fill.data.energy=12000; fill.data.color=(0.6,0.72,1.0)
fill.location=(120,-40,70); 
d=(Vector((6,35,4))-fill.location); fill.rotation_euler=d.to_track_quat('-Z','Y').to_euler()

# ---- 4. Hero camera ----
cam=bpy.data.objects.get("ENV_HeroCam")
if not cam:
    cd=bpy.data.cameras.new("ENV_HeroCam"); cam=bpy.data.objects.new("ENV_HeroCam",cd); master.objects.link(cam)
cam.data.lens=42
cam.data.dof.use_dof=True
cam.data.dof.focus_distance=95
cam.data.dof.aperture_fstop=4.0
cam.location=Vector((-78,-70,30))
tgt=Vector((6,34,4))
cam.rotation_euler=(tgt-cam.location).to_track_quat('-Z','Y').to_euler()
sc.camera=cam

# ---- 5. EEVEE Next quality ----
sc.render.engine='BLENDER_EEVEE_NEXT'
sc.render.film_transparent=False
ee=sc.eevee
for attr,val in [("taa_render_samples",96),("use_raytracing",True),
                 ("use_shadow_jitter_viewport",True),("use_volumetric_lights",True)]:
    try: setattr(ee,attr,val)
    except Exception as e: pass
try:
    ee.ray_tracing_options.use_denoise=True
except: pass
# shadows soft
sc.view_settings.view_transform='AgX'
sc.view_settings.look='AgX - Medium High Contrast'

# ---- 6. Compositor glare (bloom) ----
sc.use_nodes=True
cnt=sc.node_tree; cnt.nodes.clear()
rl=cnt.nodes.new('CompositorNodeRLayers'); rl.location=(0,0)
glare=cnt.nodes.new('CompositorNodeGlare'); glare.location=(300,0)
glare.glare_type='BLOOM' if 'BLOOM' in [i[0] for i in glare.bl_rna.properties['glare_type'].enum_items] else 'FOG_GLOW'
glare.mix=-0.82; glare.threshold=1.0
try: glare.size=7
except: pass
comp=cnt.nodes.new('CompositorNodeComposite'); comp.location=(600,0)
cnt.links.new(rl.outputs['Image'], glare.inputs['Image'])
cnt.links.new(glare.outputs['Image'], comp.inputs['Image'])

# ---- 7. Render settings ----
sc.render.resolution_x=1920; sc.render.resolution_y=1080; sc.render.resolution_percentage=100
sc.render.filepath='/Users/elijahroyaei/Desktop/AOS/_blender/fleet_render.png'
print("ENV_PART2_DONE")
