import bpy, json
from mathutils import Vector
sc = bpy.context.scene
master = sc.collection

# collections currently reachable in view layer
def reachable(col, acc):
    acc.add(col.name)
    for ch in col.children:
        reachable(ch, acc)
inview=set(); reachable(master, inview)

fleet_names=[c.name for c in bpy.data.collections if c.name.startswith("Fleet_")]
linked=[]
for fn in fleet_names:
    col=bpy.data.collections[fn]
    if fn not in inview:
        try:
            master.children.link(col); linked.append(fn)
        except Exception as e:
            linked.append(fn+"_ERR:"+str(e))

bpy.context.view_layer.update()

report={}
for fn in fleet_names:
    col=bpy.data.collections[fn]
    objs=[o for o in col.all_objects]
    # roots = objects whose parent is None or parent not in this collection's objects
    objset=set(objs)
    roots=[o for o in objs if (o.parent is None or o.parent not in objset)]
    mn=Vector((1e18,)*3); mx=Vector((-1e18,)*3); nv=0
    for o in objs:
        if o.type=='MESH' and len(o.data.vertices):
            nv+=1
            for cc in o.bound_box:
                w=o.matrix_world@Vector(cc)
                for i in range(3):
                    mn[i]=min(mn[i],w[i]); mx[i]=max(mx[i],w[i])
    report[fn]={
      "n_objects":len(objs),"n_mesh":nv,
      "roots":[(o.name,o.type,[round(s,4) for s in o.scale]) for o in roots],
      "ext":[round(mx[i]-mn[i],3) for i in range(3)],
      "min":[round(mn[i],3) for i in range(3)],"max":[round(mx[i],3) for i in range(3)],
    }
json.dump({"linked":linked,"report":report},open('/Users/elijahroyaei/Desktop/AOS/_blender/passA.json','w'),indent=1)
print("PASS_A_DONE linked:",len(linked))
