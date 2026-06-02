# /public/models — optional detailed 3D assets

ATLAS renders fully on hand-authored procedural three.js geometry. The scenes
can **optionally** swap or augment individual "slots" with higher-detail
glTF/GLB models dropped here. Each slot falls back to its procedural geometry
when its asset is disabled, missing, or fails to load — so the app still runs
with zero binaries in this folder.

## Slots

Defined in [`src/lib/models.ts`](../../src/lib/models.ts):

| Slot          | Scene                | Behavior            | Default |
|---------------|----------------------|---------------------|---------|
| `resident`    | Building Simulator   | replaces voxel residents | **on** (`robot.glb`) |
| `rooftopProp` | Building Simulator   | additive rooftop detail  | off |
| `twinCrown`   | Habitat Twin (Console) | additive crown on the tower | off |

The simulator exposes a **Detail** toggle in its control bar to flip the
detailed residents on/off live.

## How the loader behaves

- The loader (`src/components/three/gltf.tsx`) clones the asset (skeleton-aware
  for animated models so instances are independent), measures its bounding box,
  and **normalizes it to the slot's `targetHeight`** — so an asset works no
  matter its native units. Rigged assets play the slot's `clip`.
- Loading is wrapped in `<Suspense>` + an error boundary; both fall back to the
  procedural geometry, so a bad/absent file never blanks the WebGL canvas.

## Enabling a new asset

1. Add the `.glb` here (keep it lean; compress with Draco/meshopt where you can).
2. In `src/lib/models.ts`, set the slot's `path`, `enabled: true`, and tune
   `targetHeight` / `rotationY` / `clip`.
3. Record the license in [`CREDITS.md`](./CREDITS.md).

See `CREDITS.md` for recommended free (CC0 / CC-BY) sources.
