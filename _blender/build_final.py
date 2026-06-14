import bpy, json, numpy as np
from mathutils import Matrix, Vector
sc=bpy.context.scene; master=sc.collection

# method: 'bbox' (clean) or 'pca' (diagonal/scattered source)
CFG = {
 "Fleet_Pilatus PC-12 NG":         dict(target=16.3, pos=(-38, 0), yaw=-6, method='bbox'),
 "Fleet_Gulfstream G650ER":        dict(target=30.4, pos=( 0,  0), yaw= 5, method='bbox'),
 "Fleet_Cessna Citation Longitude":dict(target=24.0, pos=( 48, 2), yaw=10, method='pca'),
 "Fleet_Bombardier Global 7500":   dict(target=33.8, pos=(-12,68), yaw=-5, method='bbox'),
 "Fleet_Jet - Generic":            dict(target=16.0, pos=( 50,66), yaw=12, method='bbox'),
 "Fleet_Airbus H145":              dict(target=13.6, pos=( 92, 4), yaw= 8, method='pca'),
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
    for fn in EXCLUDE:
        c=bpy.data.collections.get(fn)
        if c and c.name in [ch.name for ch in master.children]: master.children.unlink(c)
    bpy.context.view_layer.update()

def roots_of(col):
    s=set(col.all_objects)
    return [o for o in col.all_objects if (o.parent is None or o.parent not in s)]

def corners_bbox(col):
    objs=[o for o in col.all_objects if o.type=='MESH' and len(o.data.vertices)]
    step=max(1,len(objs)//6000); objs=objs[::step]
    C=[]; corners=[]
    for o in objs:
        mw=o.matrix_world; cs=[mw@Vector(c) for c in o.bound_box]
        corners.append(cs); cc=sum(cs,Vector((0,0,0)))/8
        C.append([cc.x,cc.y,cc.z])
    C=np.array(C)
    lo_c=np.percentile(C,1,0); hi_c=np.percentile(C,99,0)
    keep=np.all((C>=lo_c)&(C<=hi_c),1)
    if keep.sum()<8: keep=np.ones(len(objs),bool)
    lo=np.array([1e18]*3); hi=np.array([-1e18]*3)
    for i,k in enumerate(keep):
        if k:
            for v in corners[i]:
                p=np.array([v.x,v.y,v.z]); lo=np.minimum(lo,p); hi=np.maximum(hi,p)
    return lo,hi

def sample_verts(col,cap=30000):
    objs=[o for o in col.all_objects if o.type=='MESH' and len(o.data.vertices)]
    tot=sum(len(o.data.vertices) for o in objs)
    vstep=max(1,tot//cap)
    V=[]
    for o in objs:
        mw=o.matrix_world; vs=o.data.vertices
        for i in range(0,len(vs),vstep):
            co=mw@vs[i].co; V.append((co.x,co.y,co.z))
    return np.array(V)

def mat4(R3):
    M=Matrix.Identity(4)
    for i in range(3):
        for j in range(3): M[i][j]=float(R3[i][j])
    return M

def stage1_bbox(col,target):
    lo,hi=corners_bbox(col); ext=hi-lo
    up=int(np.argmin(ext)); horiz=[i for i in range(3) if i!=up]
    length=horiz[0] if ext[horiz[0]]>=ext[horiz[1]] else horiz[1]
    e=np.eye(3); e_up=e[up]; e_len=e[length]; e_span=np.cross(e_len,e_up)
    Rm=np.array([e_span,e_len,e_up])
    if np.linalg.det(Rm)<0: Rm=np.array([-e_span,e_len,e_up])
    scale=target/float(ext[length])
    return Matrix.Diagonal((scale,scale,scale,1.0))@mat4(Rm)

def stage1_pca(col,target):
    V=sample_verts(col)
    lo=np.percentile(V,0.5,0); hi=np.percentile(V,99.5,0)
    m=np.all((V>=lo)&(V<=hi),1); Vt=V[m]
    mean=Vt.mean(0); X=Vt-mean
    cov=X.T@X/len(X); w,Q=np.linalg.eigh(cov)  # ascending
    e_up=Q[:,0]; e_len=Q[:,2]; e_span=np.cross(e_len,e_up)
    Rm=np.array([e_span,e_len,e_up])
    if np.linalg.det(Rm)<0: e_span=-e_span; Rm=np.array([e_span,e_len,e_up])
    ext_len=float((X@e_len).max()-(X@e_len).min())
    scale=target/ext_len
    return Matrix.Diagonal((scale,scale,scale,1.0))@mat4(Rm)

link_all()
report={}
for fn,cfg in CFG.items():
    col=bpy.data.collections.get(fn)
    if not col: report[fn]={"err":"missing"}; continue
    D1 = stage1_pca(col,cfg["target"]) if cfg["method"]=='pca' else stage1_bbox(col,cfg["target"])
    rts=roots_of(col)
    for r in rts: r.matrix_world=D1@r.matrix_world
    bpy.context.view_layer.update()
    lo2,hi2=corners_bbox(col)
    cx=(lo2[0]+hi2[0])/2; cy=(lo2[1]+hi2[1])/2; minz=lo2[2]
    Rz=Matrix.Rotation(np.radians(cfg["yaw"]),4,'Z')
    Tc=Matrix.Translation((-cx,-cy,-minz)); Tp=Matrix.Translation((cfg["pos"][0],cfg["pos"][1],0))
    for r in rts: r.matrix_world=(Tp@Rz@Tc)@r.matrix_world
    bpy.context.view_layer.update()
    lo3,hi3=corners_bbox(col)
    report[fn]={"method":cfg["method"],"size":[round(float(hi3[i]-lo3[i]),2) for i in range(3)],
                "minz":round(float(lo3[2]),2)}
json.dump(report,open('/Users/elijahroyaei/Desktop/AOS/_blender/final.json','w'),indent=1)
print("BUILD_FINAL_DONE")
