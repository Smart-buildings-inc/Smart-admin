import bpy, json, numpy as np
from mathutils import Matrix, Vector

sc=bpy.context.scene

# target footprint length (meters) per fleet + ramp position (x,y) and yaw(deg)
CFG = {
 "Fleet_Pilatus PC-12 NG":        dict(target=16.3, pos=(-30,  0), yaw=-8),
 "Fleet_Cessna Citation Longitude":dict(target=20.0, pos=( 30,  0), yaw= 8),
 "Fleet_Embraer Phenom 300":      dict(target=16.0, pos=(-90,  0), yaw=-12),
 "Fleet_Airbus H145":             dict(target=13.6, pos=( 90,  0), yaw= 12),
 "Fleet_Gulfstream G650ER":       dict(target=30.4, pos=(-60, 70), yaw=-6),
 "Fleet_Bombardier Global 7500":  dict(target=33.8, pos=( 20, 70), yaw= 6),
 "Fleet_Jet - Generic":           dict(target=16.0, pos=( 95, 70), yaw=10),
}

def roots_of(col):
    s=set(col.all_objects)
    return [o for o in col.all_objects if (o.parent is None or o.parent not in s)]

def robust_bbox(col):
    objs=[o for o in col.all_objects if o.type=='MESH' and len(o.data.vertices)]
    if not objs: return None
    step=max(1,len(objs)//4000)
    pts=[]
    for o in objs[::step]:
        mw=o.matrix_world
        for c in o.bound_box:
            pts.append(mw@Vector(c))
    a=np.array([[p.x,p.y,p.z] for p in pts])
    lo=np.percentile(a,2,axis=0); hi=np.percentile(a,98,axis=0)
    return lo,hi

def signed_perm(up,length):
    # build rotation so that local up-axis -> +Z and local length-axis -> +Y
    e={0:np.array([1,0,0.]),1:np.array([0,1,0.]),2:np.array([0,0,1.])}
    e_up=e[up]; e_len=e[length]
    e_span=np.cross(e_len,e_up)  # right-handed third
    # Rm maps (e_span,e_len,e_up) -> (X,Y,Z): Rm = [e_span e_len e_up]^T
    Rm=np.array([e_span,e_len,e_up])
    if np.linalg.det(Rm)<0:
        e_span=-e_span; Rm=np.array([e_span,e_len,e_up])
    M=Matrix.Identity(4)
    for i in range(3):
        for j in range(3):
            M[i][j]=float(Rm[i][j])
    return M

report={}
for fn,cfg in CFG.items():
    col=bpy.data.collections.get(fn)
    if not col: 
        report[fn]={"err":"missing"}; continue
    bb=robust_bbox(col)
    if bb is None:
        report[fn]={"err":"no mesh"}; continue
    lo,hi=bb; ext=hi-lo
    up=int(np.argmin(ext))
    horiz=[i for i in range(3) if i!=up]
    length=horiz[0] if ext[horiz[0]]>=ext[horiz[1]] else horiz[1]
    Rm=signed_perm(up,length)
    scale=cfg["target"]/float(ext[length])
    D1=Matrix.Diagonal((scale,scale,scale,1.0)) @ Rm
    rts=roots_of(col)
    for r in rts:
        r.matrix_world = D1 @ r.matrix_world
    bpy.context.view_layer.update()
    # recompute, then ground + place + yaw
    lo2,hi2=robust_bbox(col)
    cx=(lo2[0]+hi2[0])/2; cy=(lo2[1]+hi2[1])/2; minz=lo2[2]
    yaw=np.radians(cfg["yaw"])
    Rz=Matrix.Rotation(yaw,4,'Z')
    T=Matrix.Translation((cfg["pos"][0]-cx, cfg["pos"][1]-cy, -minz))
    # rotate about the placed center: translate to origin-xy, rotate, translate to pos
    Tc=Matrix.Translation((-cx,-cy,-minz))
    Tp=Matrix.Translation((cfg["pos"][0],cfg["pos"][1],0))
    D2=Tp @ Rz @ Tc
    for r in rts:
        r.matrix_world = D2 @ r.matrix_world
    bpy.context.view_layer.update()
    lo3,hi3=robust_bbox(col)
    report[fn]={"up":up,"length":length,"scale":round(scale,4),
                "ext_before":[round(float(x),2) for x in ext],
                "final_min":[round(float(x),2) for x in lo3],
                "final_max":[round(float(x),2) for x in hi3],
                "final_size":[round(float(hi3[i]-lo3[i]),2) for i in range(3)]}

json.dump(report,open('/Users/elijahroyaei/Desktop/AOS/_blender/normalize.json','w'),indent=1)
print("NORMALIZE_DONE")
