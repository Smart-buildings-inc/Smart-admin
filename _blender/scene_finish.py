import bpy, math
from mathutils import Vector
sc=bpy.context.scene; master=sc.collection

for fn in ["Fleet_Cessna Citation Longitude","Fleet_Airbus H145","Fleet_Embraer Phenom 300"]:
    c=bpy.data.collections.get(fn)
    if c and c.name in [ch.name for ch in master.children]:
        master.children.unlink(c)

env=bpy.data.collections.get("ENV")
if not env:
    env=bpy.data.collections.new("ENV"); master.children.link(env)

def to_env(o):
    for c in o.users_collection: c.objects.unlink(o)
    env.objects.link(o)

# ---------- procedural PBR asphalt ----------
def tarmac_mat():
    m=bpy.data.materials.get("ENV_Tarmac")
    if m: bpy.data.materials.remove(m)
    m=bpy.data.materials.new("ENV_Tarmac"); m.use_nodes=True
    nt=m.node_tree; nt.nodes.clear(); n=nt.nodes.new; lk=nt.links.new
    out=n('ShaderNodeOutputMaterial'); out.location=(900,0)
    bsdf=n('ShaderNodeBsdfPrincipled'); bsdf.location=(560,0)
    tc=n('ShaderNodeTexCoord'); tc.location=(-1100,0)
    mp=n('ShaderNodeMapping'); mp.location=(-900,0); mp.inputs['Scale'].default_value=(1,1,1)
    lk(tc.outputs['Object'], mp.inputs['Vector'])
    vor=n('ShaderNodeTexVoronoi'); vor.location=(-650,200); vor.inputs['Scale'].default_value=140.0
    lk(mp.outputs['Vector'], vor.inputs['Vector'])
    agg=n('ShaderNodeValToRGB'); agg.location=(-430,260)
    agg.color_ramp.elements[0].position=0.4; agg.color_ramp.elements[0].color=(0.040,0.040,0.043,1)
    agg.color_ramp.elements[1].position=0.85; agg.color_ramp.elements[1].color=(0.085,0.083,0.078,1)
    lk(vor.outputs['Distance'], agg.inputs['Fac'])
    noise=n('ShaderNodeTexNoise'); noise.location=(-650,-60); noise.inputs['Scale'].default_value=2.5; noise.inputs['Detail'].default_value=8.0
    lk(mp.outputs['Vector'], noise.inputs['Vector'])
    stain=n('ShaderNodeValToRGB'); stain.location=(-430,-40)
    stain.color_ramp.elements[0].position=0.3; stain.color_ramp.elements[0].color=(0.05,0.05,0.052,1)
    stain.color_ramp.elements[1].position=0.75; stain.color_ramp.elements[1].color=(0.085,0.085,0.082,1)
    lk(noise.outputs['Fac'], stain.inputs['Fac'])
    mix=n('ShaderNodeMixRGB'); mix.location=(-150,120); mix.blend_type='MULTIPLY'; mix.inputs['Fac'].default_value=0.5
    lk(stain.outputs['Color'], mix.inputs['Color1']); lk(agg.outputs['Color'], mix.inputs['Color2'])
    lk(mix.outputs['Color'], bsdf.inputs['Base Color'])
    rn=n('ShaderNodeTexNoise'); rn.location=(-650,-320); rn.inputs['Scale'].default_value=10.0
    rr=n('ShaderNodeValToRGB'); rr.location=(-430,-320)
    rr.color_ramp.elements[0].position=0.3; rr.color_ramp.elements[0].color=(0.55,0.55,0.55,1)
    rr.color_ramp.elements[1].position=0.85; rr.color_ramp.elements[1].color=(0.82,0.82,0.82,1)
    lk(mp.outputs['Vector'], rn.inputs['Vector']); lk(rn.outputs['Fac'], rr.inputs['Fac'])
    lk(rr.outputs['Color'], bsdf.inputs['Roughness'])
    cr=n('ShaderNodeTexVoronoi'); cr.location=(-650,-560); cr.inputs['Scale'].default_value=7.0; cr.feature='DISTANCE_TO_EDGE'
    lk(mp.outputs['Vector'], cr.inputs['Vector'])
    crr=n('ShaderNodeValToRGB'); crr.location=(-430,-560)
    crr.color_ramp.elements[0].position=0.0; crr.color_ramp.elements[0].color=(0,0,0,1)
    crr.color_ramp.elements[1].position=0.05; crr.color_ramp.elements[1].color=(1,1,1,1)
    lk(cr.outputs['Distance'], crr.inputs['Fac'])
    bm=n('ShaderNodeMixRGB'); bm.location=(-150,-360); bm.blend_type='MULTIPLY'; bm.inputs['Fac'].default_value=1.0
    lk(agg.outputs['Color'], bm.inputs['Color1']); lk(crr.outputs['Color'], bm.inputs['Color2'])
    bump=n('ShaderNodeBump'); bump.location=(250,-300); bump.inputs['Strength'].default_value=0.15
    lk(bm.outputs['Color'], bump.inputs['Height']); lk(bump.outputs['Normal'], bsdf.inputs['Normal'])
    lk(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m

# ground + taxi line
g=bpy.data.objects.get("ENV_Ground")
if not g:
    bpy.ops.mesh.primitive_plane_add(size=1400, location=(6,35,0))
    g=bpy.context.active_object; g.name="ENV_Ground"; to_env(g)
g.data.materials.clear(); g.data.materials.append(tarmac_mat())
if not bpy.data.objects.get("ENV_TaxiLine"):
    ym=bpy.data.materials.new("ENV_TaxiLine"); ym.use_nodes=True
    yb=ym.node_tree.nodes.get("Principled BSDF"); yb.inputs['Base Color'].default_value=(0.5,0.36,0.02,1); yb.inputs['Roughness'].default_value=0.45
    bpy.ops.mesh.primitive_plane_add(size=1,location=(6,35,0.02))
    s=bpy.context.active_object; s.name="ENV_TaxiLine"; s.scale=(0.5,190,1); to_env(s); s.data.materials.append(ym)
print("FINISH_GROUND_DONE")

# ---------- world / sky (on ACTIVE world) ----------
if sc.world is None: sc.world=bpy.data.worlds.new("World")
w=sc.world; w.use_nodes=True; nt=w.node_tree; nt.nodes.clear()
wo=nt.nodes.new('ShaderNodeOutputWorld'); wo.location=(300,0)
bg=nt.nodes.new('ShaderNodeBackground'); bg.location=(100,0); bg.inputs['Strength'].default_value=0.9
sky=nt.nodes.new('ShaderNodeTexSky'); sky.location=(-200,0); sky.sky_type='NISHITA'
sky.sun_elevation=math.radians(15); sky.sun_rotation=math.radians(52)
sky.air_density=1.0; sky.dust_density=0.7; sky.ozone_density=1.2
nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
nt.links.new(bg.outputs['Background'], wo.inputs['Surface'])

# ---------- sun key + cool fill ----------
sun=bpy.data.objects.get("Sun_Pilatus PC") or bpy.data.objects.get("Sun_Key")
if not sun:
    sd=bpy.data.lights.new("Sun_Key",'SUN'); sun=bpy.data.objects.new("Sun_Key",sd); master.objects.link(sun)
sun.data.type='SUN'; sun.data.energy=2.4; sun.data.color=(1.0,0.92,0.78); sun.data.angle=math.radians(1.2)
sun.rotation_euler=(math.radians(90)-math.radians(15),0,math.radians(52))
fill=bpy.data.objects.get("ENV_Fill")
if not fill:
    fd=bpy.data.lights.new("ENV_Fill",'AREA'); fill=bpy.data.objects.new("ENV_Fill",fd); master.objects.link(fill)
fill.data.type='AREA'; fill.data.shape='RECTANGLE'; fill.data.size=120; fill.data.size_y=120
fill.data.energy=5000; fill.data.color=(0.62,0.74,1.0); fill.location=(130,-30,70)
fill.rotation_euler=(Vector((6,35,4))-fill.location).to_track_quat('-Z','Y').to_euler()

# ---------- hero camera ----------
cam=bpy.data.objects.get("ENV_HeroCam")
if not cam:
    cd=bpy.data.cameras.new("ENV_HeroCam"); cam=bpy.data.objects.new("ENV_HeroCam",cd); master.objects.link(cam)
cam.data.lens=40; cam.data.dof.use_dof=True
cam.location=Vector((-60,-72,23)); tgt=Vector((-4,28,6))
cam.rotation_euler=(tgt-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.dof.focus_distance=(tgt-cam.location).length; cam.data.dof.aperture_fstop=8.0
sc.camera=cam

# ---------- EEVEE Next (conservative to avoid crash) ----------
sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.film_transparent=False
ee=sc.eevee
for a,v in [("taa_render_samples",64),("use_raytracing",True)]:
    try: setattr(ee,a,v)
    except: pass
try: ee.ray_tracing_options.use_denoise=True
except: pass
sc.view_settings.view_transform='AgX'; sc.view_settings.exposure=-2.2
try: sc.view_settings.look='AgX - Medium High Contrast'
except: pass

# ---------- compositor glare ----------
sc.use_nodes=True; cn=sc.node_tree; cn.nodes.clear()
rl=cn.nodes.new('CompositorNodeRLayers'); rl.location=(0,0)
gl=cn.nodes.new('CompositorNodeGlare'); gl.location=(300,0)
try: gl.glare_type='BLOOM'
except: gl.glare_type='FOG_GLOW'
gl.mix=-0.78; gl.threshold=1.0
try: gl.size=7
except: pass
cp=cn.nodes.new('CompositorNodeComposite'); cp.location=(600,0)
cn.links.new(rl.outputs['Image'], gl.inputs['Image']); cn.links.new(gl.outputs['Image'], cp.inputs['Image'])

# ---------- cull stray meshes (safe: iterate scene objects only) ----------
hidden=0
for o in list(sc.objects):
    if o.type!='MESH' or not o.data or not len(o.data.vertices): continue
    try:
        c=sum((o.matrix_world@Vector(v) for v in o.bound_box),Vector())/8
    except: continue
    if c.z>14 or c.z<-3 or abs(c.x)>180 or c.y<-50 or c.y>140:
        o.hide_render=True; hidden+=1

sc.render.resolution_x=1920; sc.render.resolution_y=1080; sc.render.resolution_percentage=100
sc.render.filepath='/Users/elijahroyaei/Desktop/AOS/_blender/fleet_render.png'
bpy.ops.render.render(write_still=True)
print("SCENE_FINISH_DONE hidden",hidden)
