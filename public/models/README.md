# /public/models — optional detailed 3D assets

ATLAS renders fully on hand-authored procedural three.js geometry. The scenes
can **optionally** augment individual "slots" with higher-detail glTF/GLB
models dropped here. Each slot falls back to its procedural geometry when its
asset is disabled, missing, or fails to load — so the app still runs with zero
binaries in this folder.

Simulator people are authored as procedural three.js human characters in
`src/components/three/HumanCharacter.tsx`, not as external GLB robots. Pixel
mode uses tiny block people; detailed mode swaps them for the richer human
character family.

## Slots

Defined in [`src/lib/models.ts`](../../src/lib/models.ts):

| Slot          | Scene              | Behavior               | Default |
|---------------|--------------------|------------------------|---------|
| `rooftopProp` | Building Simulator | additive rooftop detail | off |

The simulator exposes a **Pixel** toggle in its control bar to flip between
block people and detailed procedural human characters live.

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

---

## Whole-building "hero" model — `atlas-01.glb`

Distinct from the per-slot props above: this is the **entire ATLAS-01 tower** as a
single Blender-authored asset, an alternative to the procedural architectural building.

- The app looks for it at `/models/atlas-01.glb` (see
  `src/components/GltfBuilding.tsx`, `TWIN_MODEL_URL`).
- Until a `.glb` is present, the simulator renders the **procedural architectural twin**
  (default). Flipping the **"Hero"** toggle, or setting `NEXT_PUBLIC_TWIN_MODEL=gltf`,
  attempts the glTF model and **falls back to procedural geometry** if it is missing or fails to
  load — so nothing breaks.
- Authoring + binding contract (scale, app-native +Y up, root node name === `Floor.key`,
  materials, export settings): **`docs/ATLAS-blender-model-spec.md`**.
- Runtime binding requires the 13 exact floor roots, `sys.vertical-transport`,
  `car.a`, `car.b`, `car.ff`, and the `mat.need.*` material family. The export
  is rejected when these names drift, the Y extent is wrong, or the hero
  exceeds 150 primitives.
- `npm run validate:gltf` checks the binary hierarchy, bounds, materials, and
  web draw-call budget. `npm run validate:models` and
  `npm run validate:blender` check application slots and Blender naming.
- Commit the binary `.glb` via **Git LFS**. If it is Draco/meshopt-compressed, also
  add the decoder (e.g. `public/draco/`) and pass its path to `useGLTF` in
  `GltfBuilding.tsx`.

## Material pipeline

The procedural twin uses a restrained metallic-roughness PBR set: sRGB
albedo, linear roughness/normal/AO maps, compressed near-white AO, and a mild
architectural tint. AO is intentionally limited to contact variation; it does
not carry the main form shading. Storey lights are range-limited so they do
not flatten adjacent floors.
