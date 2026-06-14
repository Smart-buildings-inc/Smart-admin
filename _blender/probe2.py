import bpy, json
from mathutils import Vector
def child_report(empty_name, limit=60):
    e=bpy.data.objects.get(empty_name)
    if not e: return {"err":"no empty"}
    out=[]
    for o in e.children_recursive if hasattr(e,'children_recursive') else []:
        if o.type=='MESH' and len(o.data.vertices):
            mn=Vector((1e18,)*3);mx=Vector((-1e18,)*3)
            for cc in o.bound_box:
                w=o.matrix_world@Vector(cc)
                for i in range(3):
                    mn[i]=min(mn[i],w[i]);mx[i]=max(mx[i],w[i])
            size=max(mx[i]-mn[i] for i in range(3))
            ctr=[round((mn[i]+mx[i])/2,1) for i in range(3)]
            out.append((o.name,round(size,2),ctr))
    out.sort(key=lambda r:-r[1])
    return {"n":len(out),"biggest":out[:12],"sample_small":out[-6:]}
res={
 "Airbus": child_report("Airbus H145_Root"),
 "Embraer": child_report("Embraer Phenom 300_Root"),
}
json.dump(res,open('/Users/elijahroyaei/Desktop/AOS/_blender/probe2.json','w'),indent=1)
print("PROBE2_DONE")
