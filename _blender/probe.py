import bpy, json
from mathutils import Vector
sc=bpy.context.scene
cam=sc.camera
sun=bpy.data.objects.get("Sun_Pilatus PC")
# per fleet collection, compute world-space center & bbox
fleets={}
for c in bpy.data.collections:
    if c.name.startswith("Fleet_"):
        mn=Vector((1e9,)*3); mx=Vector((-1e9,)*3); n=0
        for o in c.all_objects:
            if o.type=='MESH' and len(o.data.vertices):
                n+=1
                for cc in o.bound_box:
                    w=o.matrix_world@Vector(cc)
                    for i in range(3):
                        mn[i]=min(mn[i],w[i]); mx[i]=max(mx[i],w[i])
        if n:
            fleets[c.name]={"center":[round((mn[i]+mx[i])/2,2) for i in range(3)],
                            "size":[round(mx[i]-mn[i],2) for i in range(3)],"meshes":n}
out={
 "cam":{"loc":[round(x,2) for x in cam.location],"rot_euler_deg":[round(x*57.2958,1) for x in cam.rotation_euler],
        "lens":round(cam.data.lens,1),"type":cam.data.type},
 "sun":{"rot_euler_deg":[round(x*57.2958,1) for x in sun.rotation_euler],"energy":sun.data.energy} if sun else None,
 "world": bpy.data.worlds[0].name if bpy.data.worlds else None,
 "fleets":fleets,
 "view_transform": sc.view_settings.view_transform,
 "film_transparent": sc.render.film_transparent,
}
json.dump(out,open('/Users/elijahroyaei/Desktop/AOS/_blender/probe.json','w'),indent=1)
print("PROBE_DONE", len(fleets), "fleets")
