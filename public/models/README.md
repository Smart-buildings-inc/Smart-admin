# ATLAS-01 hero model drop-zone

Drop the Blender-exported **`atlas-01.glb`** here. The app looks for it at
`/models/atlas-01.glb` (see `src/components/GltfBuilding.tsx`, `TWIN_MODEL_URL`).

- Until a `.glb` is present, the simulator renders the **procedural voxel twin**
  (default). Flipping the **"Hero"** toggle, or setting `NEXT_PUBLIC_TWIN_MODEL=gltf`,
  attempts the glTF model and **falls back to voxel** if it is missing or fails to load —
  so nothing breaks.
- Authoring + binding contract (scale, +Y up, collection/node name === `Floor.key`,
  materials, export settings): **`docs/ATLAS-blender-model-spec.md`**.
- Commit the binary `.glb` via **Git LFS**. If it is Draco/meshopt-compressed, also add
  the decoder (e.g. `public/draco/`) and pass its path to `useGLTF` in `GltfBuilding.tsx`.
