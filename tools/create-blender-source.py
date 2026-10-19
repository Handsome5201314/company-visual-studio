"""Create an editable furniture library from shipped GLBs. Does not reconstruct original author files.
Run in background Blender: blender -b --python tools/create-blender-source.py -- OUTPUT.blend
"""
import bpy, pathlib, sys
root = pathlib.Path(__file__).resolve().parents[1]
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
target = pathlib.Path(args[0]).resolve() if args else root / 'source/blender/furniture-library.blend'
if target.exists():
    raise RuntimeError('Output already exists; choose a new path to preserve your work')
bpy.ops.wm.read_factory_settings(use_empty=True)
for i, file in enumerate(sorted((root / 'public/furniture').glob('*.glb'))):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(file))
    objects = set(bpy.data.objects) - before
    collection = bpy.data.collections.new(file.stem)
    bpy.context.scene.collection.children.link(collection)
    for obj in objects:
        for old in list(obj.users_collection): old.objects.unlink(obj)
        collection.objects.link(obj)
        if obj.parent not in objects:
            obj.location.x += (i % 5) * 4
            obj.location.y += (i // 5) * 4
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.scale_length = 1
target.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('Editable GLB-derived furniture library:', target)
