import bpy, json, numpy as np
from mathutils import Matrix, Vector

sc=bpy.context.scene
master=sc.collection

CFG = {
 "Fleet_Embraer Phenom 300":      dict(target=16.0, pos=(-95,  0), yaw=-12, iso=True),
 "Fleet_Pilatus PC-12 NG":        dict(target=16.3, pos=(-30,  0), yaw=-8,  iso=False),
 "Fleet_Cessna Citation Longitude":dict(target=24.0,pos=( 30,  0), yaw= 8,  iso=False),
 "Fleet_Airbus H145":             dict(target=13.6, pos=( 95,  0), yaw= 12, iso=True),
 "Fleet_Gulfstream G650ER":       dict(target=30.4, pos=(-60, 70), yaw=-6,  iso=False),
 "Fleet_Bombardier Global 7500":  dict(target=33.8, pos=( 20, 70), yaw= 6,  iso=False),
 "Fleet_Jet - Generic":           dict(target=16.0, pos=( 95, 70), yaw=10,  iso=False),
}

def link_all():
    seen=set()
    def walk(c):
        seen.add(c.name)
        for ch in c.children: walk(ch)
    walk(master)
    for fn in CFG:
        c=bpy.data.collections.get(fn)
        if c and fn not in seen:
            master.children.link(c)
    bpy.context.view_layer.update()

def roots_of(col):
    s=set(col.all_objects)
    return [o for o in col.all_objects if (o.parent is None or o.parent not in s)]

def gather(col):
    objs=[o for o in col.all_objects if o.type=='MESH' and len(o.data.vertices)]
    step=max(1,len(objs)//6000)
    objs=objs[::step]
    centers=[]; corners=[]
    for o in objs:
        mw=o.matrix_world
        cs=[mw@Vector(c) for c in o.bound_box]
        corners.append(cs)
        c=sum(cs,Vector((0,0,0)))/8.0
        centers.append([c.x,c.y,c.z])
    return objs,np.array(centers),corners

def measure(col, iso):
    objs,C,corners=gather(col)
    if len(objs)==0: return None
    med=np.median(C,axis=0)
    mad=np.median(np.abs(C-med),axis=0)*1.4826
    mad=np.maximum(mad,1e-6)
    keep=np.all(np.abs(C-med)<=6*mad,axis=1)
    if iso:
        # isolate densest cluster: anchor = densest center, keep within radius
        sub=C[keep]
        # use a coarse grid vote for densest cell
        ext=sub.max(0)-sub.min(0); cell=max(ext.max()/20.0,1e-3)
        keys={}
        for p in sub:
            k=tuple((p//cell).astype(int)); keys[k]=keys.get(k,0)+1
        bestk=max(keys,key=keys.get)
        anchor=(np.array(bestk)+0.5)*cell
        R=cell*4.0
        keep=keep & (np.linalg.norm(C-anchor,axis=1)<=R)
    lo=np.array([1e18]*3); hi=np.array([-1e18]*3)
    for i,k in enumerate(keep):
        if k:
            for v in corners[i]:
                p=np.array([v.x,v.y,v.z])
                lo=np.minimum(lo,p); hi=np.maximum(hi,p)
    return lo,hi,int(keep.sum()),len(objs)

def signed_perm(up,length):
    e=np.eye(3)
    e_up=e[up]; e_len=e[length]; e_span=np.cross(e_len,e_up)
    Rm=np.array([e_span,e_len,e_up])
    if np.linalg.det(Rm)<0:
        Rm=np.array([-e_span,e_len,e_up])
    M=Matrix.Identity(4)
    for i in range(3):
        for j in range(3): M[i][j]=float(Rm[i][j])
    return M

link_all()
report={}
for fn,cfg in CFG.items():
    col=bpy.data.collections.get(fn)
    if not col: report[fn]={"err":"missing"}; continue
    m=measure(col,cfg["iso"])
    if not m: report[fn]={"err":"nomesh"}; continue
    lo,hi,nk,nt=m; ext=hi-lo
    up=int(np.argmin(ext)); horiz=[i for i in range(3) if i!=up]
    length=horiz[0] if ext[horiz[0]]>=ext[horiz[1]] else horiz[1]
    Rm=signed_perm(up,length); scale=cfg["target"]/float(ext[length])
    D1=Matrix.Diagonal((scale,scale,scale,1.0))@Rm
    rts=roots_of(col)
    for r in rts: r.matrix_world=D1@r.matrix_world
    bpy.context.view_layer.update()
    m2=measure(col,cfg["iso"]); lo2,hi2,_,_=m2
    cx=(lo2[0]+hi2[0])/2; cy=(lo2[1]+hi2[1])/2; minz=lo2[2]
    Rz=Matrix.Rotation(np.radians(cfg["yaw"]),4,'Z')
    Tc=Matrix.Translation((-cx,-cy,-minz)); Tp=Matrix.Translation((cfg["pos"][0],cfg["pos"][1],0))
    D2=Tp@Rz@Tc
    for r in rts: r.matrix_world=D2@r.matrix_world
    bpy.context.view_layer.update()
    m3=measure(col,cfg["iso"]); lo3,hi3,_,_=m3
    report[fn]={"up":up,"length":length,"scale":round(scale,4),"kept":f"{nk}/{nt}",
                "ext0":[round(float(x),2) for x in ext],
                "size":[round(float(hi3[i]-lo3[i]),2) for i in range(3)],
                "min":[round(float(x),2) for x in lo3],"max":[round(float(x),2) for x in hi3]}
json.dump(report,open('/Users/elijahroyaei/Desktop/AOS/_blender/build.json','w'),indent=1)
print("BUILD_FLEET_DONE")
