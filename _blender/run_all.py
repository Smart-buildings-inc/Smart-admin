import bpy
print("RUN_ALL_START")
exec(open('/Users/elijahroyaei/Desktop/AOS/_blender/build_4.py').read())
exec(open('/Users/elijahroyaei/Desktop/AOS/_blender/scene_finish.py').read())
try:
    bpy.ops.wm.save_as_mainfile(filepath='/Users/elijahroyaei/Desktop/Client_Projects/TRIFORCE/public/models/triforce_fleet_SCENE.blend', copy=True)
    print("SCENE_SAVED")
except Exception as e:
    print("SAVE_ERR", e)
print("RUN_ALL_DONE")
