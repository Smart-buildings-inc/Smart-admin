import bpy, json
from mathutils import Vector
scene = bpy.context.scene
objs = list(scene.objects)
by_type = {}
for o in objs:
    by_type[o.type] = by_type.get(o.type,0)+1
mins = Vector((1e9,1e9,1e9)); maxs = Vector((-1e9,-1e9,-1e9))
for o in objs:
    if o.type=='MESH' and len(o.data.vertices)>0:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3):
                mins[i]=min(mins[i],w[i]); maxs[i]=max(maxs[i],w[i])
roots = [o.name for o in objs if o.parent is None]
data = {
 "total": len(objs), "by_type": by_type,
 "bounds_min":[round(x,2) for x in mins], "bounds_max":[round(x,2) for x in maxs],
 "size":[round(maxs[i]-mins[i],2) for i in range(3)],
 "unit_system": scene.unit_settings.system,
 "scale_length": scene.unit_settings.scale_length,
 "engine": scene.render.engine,
 "active_camera": scene.camera.name if scene.camera else None,
 "materials":[m.name for m in bpy.data.materials],
 "lights":[(o.name,o.data.type,round(o.data.energy,1)) for o in objs if o.type=='LIGHT'],
 "cameras":[o.name for o in objs if o.type=='CAMERA'],
 "collections":[c.name for c in bpy.data.collections],
 "roots": roots[:40], "num_roots": len(roots),
}
with open('/Users/elijahroyaei/Desktop/AOS/_blender/scene_info.json','w') as f:
    json.dump(data,f,indent=1)
print("INSPECT_DONE", data["total"], "objects")
