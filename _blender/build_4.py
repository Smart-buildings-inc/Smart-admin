import bpy, numpy as np
from mathutils import Matrix, Vector
sc=bpy.context.scene; master=sc.collection

CFG = {
 "Fleet_Pilatus PC-12 NG":       dict(target=16.3, pos=(-20, 0),  yaw=-5),
 "Fleet_Gulfstream G650ER":      dict(target=30.4, pos=(-38,55),  yaw=-8),
 "Fleet_Bombardier Global 7500": dict(target=33.8, pos=( 30,60),  yaw= 9),
 "Fleet_Jet - Generic":          dict(target=16.0, pos=( 12, 2),  yaw= 6),
}

def link_all():
    seen=set()
    def walk(c):
        seen.add(c.name)
        for ch in c.children: walk(ch)
    walk(master)
    for fn in CFG:
        c=bpy.data.collections.get(fn)
        if c and fn not in seen: master.children.link(c)
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
        corners.append(cs); cc=sum(cs,Vector((0,0,0)))/8; C.append([cc.x,cc.y,cc.z])
    C=np.array(C); lo_c=np.percentile(C,1,0); hi_c=np.percentile(C,99,0)
    keep=np.all((C>=lo_c)&(C<=hi_c),1)
    if keep.sum()<8: keep=np.ones(len(objs),bool)
    lo=np.array([1e18]*3); hi=np.array([-1e18]*3)
    for i,k in enumerate(keep):
        if k:
            for v in corners[i]:
                p=np.array([v.x,v.y,v.z]); lo=np.minimum(lo,p); hi=np.maximum(hi,p)
    return lo,hi

def mat4(R3):
    M=Matrix.Identity(4)
    for i in range(3):
        for j in range(3): M[i][j]=float(R3[i][j])
    return M

link_all()
for fn,cfg in CFG.items():
    col=bpy.data.collections.get(fn)
    lo,hi=corners_bbox(col); ext=hi-lo
    up=int(np.argmin(ext)); horiz=[i for i in range(3) if i!=up]
    length=horiz[0] if ext[horiz[0]]>=ext[horiz[1]] else horiz[1]
    e=np.eye(3); e_up=e[up]; e_len=e[length]; e_span=np.cross(e_len,e_up)
    Rm=np.array([e_span,e_len,e_up])
    if np.linalg.det(Rm)<0: Rm=np.array([-e_span,e_len,e_up])
    scale=cfg["target"]/float(ext[length])
    D1=Matrix.Diagonal((scale,scale,scale,1.0))@mat4(Rm)
    rts=roots_of(col)
    for r in rts: r.matrix_world=D1@r.matrix_world
    bpy.context.view_layer.update()
    lo2,hi2=corners_bbox(col)
    cx=(lo2[0]+hi2[0])/2; cy=(lo2[1]+hi2[1])/2; minz=lo2[2]
    Rz=Matrix.Rotation(np.radians(cfg["yaw"]),4,'Z')
    Tc=Matrix.Translation((-cx,-cy,-minz)); Tp=Matrix.Translation((cfg["pos"][0],cfg["pos"][1],0))
    for r in rts: r.matrix_world=(Tp@Rz@Tc)@r.matrix_world
    bpy.context.view_layer.update()
print("BUILD_4_DONE")
