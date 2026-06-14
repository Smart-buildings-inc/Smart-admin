import bpy, math
from mathutils import Vector
sc=bpy.context.scene

# exposure / sky balance
sc.view_settings.exposure=-2.2
w=sc.world
for n in w.node_tree.nodes:
    if n.bl_idname=='ShaderNodeBackground': n.inputs['Strength'].default_value=0.9
sun=bpy.data.objects.get("Sun_Pilatus PC") or bpy.data.objects.get("Sun_Key")
if sun: sun.data.energy=2.2
fill=bpy.data.objects.get("ENV_Fill")
if fill: fill.data.energy=6000

# darken tarmac base ramps (undo over-bright)
m=bpy.data.materials.get("ENV_Tarmac")
if m:
    for nd in m.node_tree.nodes:
        if nd.bl_idname=='ShaderNodeValToRGB':
            for el in nd.color_ramp.elements:
                c=el.color
                if max(c[0],c[1],c[2])<0.35 and max(c[0],c[1],c[2])>0.02:
                    el.color=(c[0]*0.45,c[1]*0.45,c[2]*0.45,1)

# cull stray objects (floating high or far outside ramp)
hidden=0
for col in bpy.data.collections:
    if not col.name.startswith("Fleet_"): continue
    if col.name not in [c.name for c in sc.collection.children_recursive]: continue
    for o in col.all_objects:
        if o.type!='MESH' or not len(o.data.vertices): continue
        c=sum((o.matrix_world@Vector(v) for v in o.bound_box),Vector())/8
        if c.z>14 or c.z<-3 or abs(c.x)>160 or c.y<-40 or c.y>130:
            o.hide_render=True; hidden+=1

# keep more in focus
cam=bpy.data.objects.get("ENV_HeroCam")
cam.data.dof.aperture_fstop=11.0
print("POLISH_DONE hidden",hidden)
sc.render.resolution_percentage=50
sc.render.filepath='/Users/elijahroyaei/Desktop/AOS/_blender/fleet_render.png'
bpy.ops.render.render(write_still=True)
print("POLISH_RENDER_DONE")
