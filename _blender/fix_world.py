import bpy, math, json
sc=bpy.context.scene
info={"scene_world": sc.world.name if sc.world else None,
      "all_worlds":[w.name for w in bpy.data.worlds]}
if sc.world is None:
    sc.world=bpy.data.worlds.new("World")
w=sc.world; w.use_nodes=True
nt=w.node_tree; nt.nodes.clear()
out=nt.nodes.new('ShaderNodeOutputWorld'); out.location=(300,0)
bg=nt.nodes.new('ShaderNodeBackground'); bg.location=(100,0); bg.inputs['Strength'].default_value=1.0
sky=nt.nodes.new('ShaderNodeTexSky'); sky.location=(-200,0); sky.sky_type='NISHITA'
sky.sun_elevation=math.radians(16); sky.sun_rotation=math.radians(50)
sky.air_density=1.0; sky.dust_density=0.8; sky.ozone_density=1.0
nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
json.dump(info,open('/Users/elijahroyaei/Desktop/AOS/_blender/worldcheck.json','w'),indent=1)
sc.render.resolution_percentage=50
sc.render.filepath='/Users/elijahroyaei/Desktop/AOS/_blender/fleet_render.png'
bpy.ops.render.render(write_still=True)
print("FIX_WORLD_DONE")
