import bpy, json, numpy as np
from mathutils import Matrix, Vector
sc=bpy.context.scene; master=sc.collection

CFG = {
 "Fleet_Pilatus PC-12 NG":         dict(target=16.3, pos=(-35, 0), yaw=-8),
 "Fleet_Cessna Citation Longitude":dict(target=24.0, pos=(  0, 0), yaw= 8),
 "Fleet_Airbus H145":              dict(target=13.6, pos=( 40, 0), yaw= 12),
 "Fleet_Gulfstream G650ER":        dict(target=30.4, pos=(-45,65), yaw=-6),
 "Fleet_Bombardier Global 7500":   dict(target=33.8, pos=( 15,65), yaw= 6),
 "Fleet_Jet - Generic":            dict(target=16.0, pos=( 70,65), yaw=10),
}
EXCLUDE=["Fleet_Embraer Phenom 300"]

def link_all():
    seen=set()
    def walk(c):
        seen.add(c.name)
        for ch in c.children: walk(ch)
    walk(master)
    for fn in list(CFG)+EXCLUDE:
        c=bpy.data.collections.get(fn)
        if c and fn not in seen: master.children.link(c)
    # unlink excluded so they don't render
    for fn in EXCLUDE:
        c=bpy.data.collections.get(fn)
        if c and c.name in [ch.name for ch in master.children]:
            master.children.unlink(c)
    bpy.context.view_layer.update()

def roots_of(col):
    s=set(col.all_objects)
    return [o for o in col.all_objects if (o.parent is None or o.parent not in s)]

def gather(col):
    objs=[o for o in col.all_objects if o.type=='MESH' and len(o.data.vertices)]
    step=max(1,len(objs)//6000); objs=objs[::step]
    centers=[]; corners=[]
    for o in objs:
        mw=o.matrix_world; cs=[mw@Vector(c) for c in o.bound_box]
        corners.append(cs); c=sum(cs,Vector((0,0,0)))/8.0
        centers.append([c.x,c.y,c.z])
    return objs,np.array(centers),corners

def measure(col):
    objs,C,corners=gather(col)
    if len(objs)==0: return None
    lo_c=np.percentile(C,1,axis=0); hi_c=np.percentile(C,99,axis=0)
    keep=np.all((C>=lo_c)&(C<=hi_c),axis=1)
    if keep.sum()<8: keep=np.ones(len(objs),bool)
    lo=np.array([1e18]*3); hi=np.array([-1e18]*3)
    for i,k in enumerate(keep):
        if k:
            for v in corners[i]:
                p=np.array([v.x,v.y,v.z]); lo=np.minimum(lo,p); hi=np.maximum(hi,p)
    return lo,hi,int(keep.sum()),len(objs)

def signed_perm(up,length):
    e=np.eye(3); e_up=e[up]; e_len=e[length]; e_span=np.cross(e_len,e_up)
    Rm=np.array([e_span,e_len,e_up])
    if np.linalg.det(Rm)<0: Rm=np.array([-e_span,e_len,e_up])
    M=Matrix.Identity(4)
    for i in range(3):
        for j in range(3): M[i][j]=float(Rm[i][j])
    return M

link_all()
report={}
for fn,cfg in CFG.items():
    col=bpy.data.collections.get(fn)
    if not col: report[fn]={"err":"missing"}; continue
    m=measure(col)
    lo,hi,nk,nt=m; ext=hi-lo
    up=int(np.argmin(ext)); horiz=[i for i in range(3) if i!=up]
    length=horiz[0] if ext[horiz[0]]>=ext[horiz[1]] else horiz[1]
    Rm=signed_perm(up,length); scale=cfg["target"]/float(ext[length])
    D1=Matrix.Diagonal((scale,scale,scale,1.0))@Rm
    rts=roots_of(col)
    for r in rts: r.matrix_world=D1@r.matrix_world
    bpy.context.view_layer.update()
    lo2,hi2,_,_=measure(col)
    cx=(lo2[0]+hi2[0])/2; cy=(lo2[1]+hi2[1])/2; minz=lo2[2]
    Rz=Matrix.Rotation(np.radians(cfg["yaw"]),4,'Z')
    Tc=Matrix.Translation((-cx,-cy,-minz)); Tp=Matrix.Translation((cfg["pos"][0],cfg["pos"][1],0))
    for r in rts: r.matrix_world=(Tp@Rz@Tc)@r.matrix_world
    bpy.context.view_layer.update()
    lo3,hi3,_,_=measure(col)
    report[fn]={"up":up,"length":length,"scale":round(scale,4),"kept":f"{nk}/{nt}",
                "ext0":[round(float(x),2) for x in ext],
                "size":[round(float(hi3[i]-lo3[i]),2) for i in range(3)]}
json.dump(report,open('/Users/elijahroyaei/Desktop/AOS/_blender/build3.json','w'),indent=1)
print("BUILD_V3_DONE")
