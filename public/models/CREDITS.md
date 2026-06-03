# 3D model credits & licenses

Bundled glTF/GLB assets in this directory and their provenance. Keep this file
in sync with `src/lib/models.ts`. We accept **CC0** (no attribution required)
and **CC-BY** (attribution required — list it here) assets.

| File        | Used for        | License | Author                                              | Source |
|-------------|-----------------|---------|-----------------------------------------------------|--------|
| `robot.glb` | Simulator residents (`resident`) + Habitat Twin mascot (`twinCrown`) | CC0 1.0 | Tomás Laulhé ([Quaternius](https://quaternius.com/)); modifications by Don McCurdy | three.js examples — [RobotExpressive](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive) |
| `atlas-01.glb` | Whole-building "hero" tower (Simulator/viewer "Hero" toggle) | Original (this repo) | Generated procedurally in Blender by `scripts/blender/build_atlas01.py` | own work — ~6.2k tris, ~0.5 MB |

## Adding more assets

1. Drop the `.glb` into this folder (prefer **Draco/meshopt-compressed** or
   low-poly files; keep individual assets lean for the web).
2. Point a slot at it in `src/lib/models.ts` and set `enabled: true`.
3. Add a row above with the license + author. For CC-BY assets the attribution
   here is required; for CC0 it is courtesy.

## Recommended free sources

- **Kenney** — https://kenney.nl (CC0, low-poly kits; on-style with the voxel twin)
- **Quaternius** — https://quaternius.com (CC0, often rigged/animated)
- **Khronos glTF-Sample-Assets** — https://github.com/KhronosGroup/glTF-Sample-Assets (per-model CC0 / CC-BY)
- **Poly Pizza** — https://poly.pizza (CC-BY, large low-poly catalog)
