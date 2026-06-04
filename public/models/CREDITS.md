# 3D model credits & licenses

Bundled glTF/GLB assets in this directory and their provenance. Keep this file
in sync with `src/lib/models.ts`. We accept **CC0** (no attribution required)
and **CC-BY** (attribution required — list it here) assets.

## Whole-building asset

| File | Used for | License | Author | Source |
|---|---|---|---|---|
| `atlas-01.glb` | Whole-building "hero" tower (Simulator/viewer "Hero" toggle) | Original (this repo) | Generated procedurally in Blender by `scripts/blender/build_atlas01.py` | own work — ~6.2k tris, ~0.5 MB |

## Active bundled assets

The per-floor habitat interior modules are **original, procedurally generated**
ATLAS assets — built and exported by `_blender/build_atlas_floors.py` (Blender
4.5 Eevee Next, Principled-BSDF metallic-roughness PBR + emissive accents). They
are released **CC0-1.0**. The whole set is ~370 KB — well under the PRD's 2.5 MB
live-model budget. Rebuild/extend them with the `atlas-blender` skill.

| File | Slot (`src/lib/models.ts`) | Need / level | License | Author |
|---|---|---|---|---|
| `floor-basement.glb` | `floor-basement` | Reclamation core | CC0-1.0 | ATLAS / build_atlas_floors.py |
| `floor-water.glb` | `floor-water` | Water & waste | CC0-1.0 | ATLAS / build_atlas_floors.py |
| `floor-energy.glb` | `floor-energy` | Energy / ESS | CC0-1.0 | ATLAS / build_atlas_floors.py |
| `floor-food.glb` | `floor-food` | Vertical farm | CC0-1.0 | ATLAS / build_atlas_floors.py |
| `floor-shelter.glb` | `floor-shelter` | Dwellings | CC0-1.0 | ATLAS / build_atlas_floors.py |
| `floor-air.glb` | `floor-air` | Atrium "Lung" | CC0-1.0 | ATLAS / build_atlas_floors.py |
| `floor-health.glb` | `floor-health` | Commons / telehealth | CC0-1.0 | ATLAS / build_atlas_floors.py |
| `floor-restoration.glb` | `floor-restoration` | Skydeck / pool | CC0-1.0 | ATLAS / build_atlas_floors.py |
| `floor-rooftop.glb` | `floor-rooftop` | PV + reservoir + mast | CC0-1.0 | ATLAS / build_atlas_floors.py |

Simulator people and the Habitat Twin guide remain procedural three.js human
characters (no external GLB).

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
