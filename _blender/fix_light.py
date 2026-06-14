import bpy, math, json
from mathutils import Vector
sc=bpy.context.scene

# --- dump world tree ---
w=bpy.data.worlds[0]
info={"nodes":[n.bl_idname for n in w.node_tree.nodes],
      "links":[(l.from_node.bl_idname+"."+l.from_socket.name,l.to_node.bl_idname+"."+l.to_socket.name) for l in w.node_tree.links]}
sky=[n for n in w.node_tree.nodes if n.bl_idname=='ShaderNodeTexSky']
if sky:
    s=sky[0]; info["sky"]={"type":s.sky_type,"elev":round(math.degrees(s.sun_elevation),1)}
bg=[n for n in w.node_tree.nodes if n.bl_idname=='ShaderNodeBackground']
if bg: info["bg_strength"]=bg[0].inputs['Strength'].default_value
json.dump(info,open('/Users/elijahroyaei/Desktop/AOS/_blender/world.json','w'),indent=1)

# --- brighten tarmac ---
m=bpy.data.materials.get("ENV_Tarmac")
if m:
    nt=m.node_tree
    for nd in nt.nodes:
        if nd.bl_idname=='ShaderNodeValToRGB':
            for el in nd.color_ramp.elements:
                c=el.color
                # brighten only the dark base ramps (color values < 0.1)
                if max(c[0],c[1],c[2])<0.1:
                    el.color=(min(c[0]*4+0.03,1),min(c[1]*4+0.03,1),min(c[2]*4+0.03,1),1)
        if nd.bl_idname=='ShaderNodeBump':
            nd.inputs['Strength'].default_value=0.18

# --- boost sky + sun ---
if bg: bg[0].inputs['Strength'].default_value=1.3
sun=bpy.data.objects.get("Sun_Pilatus PC") or bpy.data.objects.get("Sun_Key")
if sun: sun.data.energy=5.0
# softer view look for brightness
for look in ['AgX - Medium Low Contrast','AgX - Base Contrast','None','']:
    try: sc.view_settings.look=look; break
    except: pass

sc.render.resolution_percentage=50
sc.render.filepath='/Users/elijahroyaei/Desktop/AOS/_blender/fleet_render.png'
bpy.ops.render.render(write_still=True)
print("FIX_LIGHT_DONE")
