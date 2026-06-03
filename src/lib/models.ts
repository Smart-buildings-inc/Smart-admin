// Optional detailed glTF models, with graceful procedural fallback.
//
// ATLAS renders fully on hand-authored procedural three.js geometry (voxel
// simulator, slab twin). This registry lets us *optionally* swap or augment
// individual "slots" with higher-detail glTF/GLB assets dropped into
// `/public/models`. Every slot keeps working when its asset is disabled,
// absent, or fails to load — it falls back to the original procedural
// geometry. That mirrors the DB-optional data layer: the app still runs with
// zero model binaries committed.
//
// To add detail: drop a `.glb` into /public/models, point a slot at it, flip
// `enabled: true`, and record the license in /public/models/CREDITS.md.
// Good free sources (CC0 unless noted): Kenney (kenney.nl), Quaternius
// (quaternius.com), Khronos glTF-Sample-Assets, Poly Pizza (CC-BY).

export type ModelSlot = "resident" | "rooftopProp" | "twinCrown";

export interface ModelAsset {
  /** Public path served from /public (e.g. "/models/robot.glb"). */
  path: string;
  /** When false the slot renders its procedural fallback instead. */
  enabled: boolean;
  /**
   * Target world-space height the loaded scene is normalized to (the loader
   * measures the model's bounding box and scales to fit), so a slot works
   * regardless of the asset's native units.
   */
  targetHeight: number;
  /** Y rotation (radians) applied when placed. */
  rotationY?: number;
  /** Animation clip to play, if the asset is rigged (e.g. "Walking"). */
  clip?: string;
  // Provenance — keep in sync with /public/models/CREDITS.md.
  license: string;
  author: string;
  source: string;
}

export const MODELS: Record<ModelSlot, ModelAsset> = {
  // Voxel residents → a stylized, low-poly, animated character. RobotExpressive
  // is a Quaternius CC0 model (one of the free sources we recommend), so it
  // reads in-style with the flat-shaded sim rather than clashing like a
  // photoreal human would.
  resident: {
    path: "/models/robot.glb",
    enabled: true,
    targetHeight: 1.0,
    clip: "Walking",
    license: "CC0 1.0",
    author: "Tomás Laulhé (Quaternius); modifications by Don McCurdy",
    source:
      "https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive",
  },
  // Additive rooftop detail (e.g. a detailed solar/comms array). Disabled until
  // a curated asset is dropped in — the procedural rooftop renders meanwhile.
  rooftopProp: {
    path: "/models/rooftop.glb",
    enabled: false,
    targetHeight: 1.6,
    license: "—",
    author: "—",
    source: "—",
  },
  // A detailed mascot perched atop the Habitat Twin slab tower — gives the
  // Console twin's realistic mode something detailed to show. Reuses the CC0
  // robot so no extra binary is needed.
  twinCrown: {
    path: "/models/robot.glb",
    enabled: true,
    targetHeight: 1.3,
    license: "CC0 1.0",
    author: "Tomás Laulhé (Quaternius); modifications by Don McCurdy",
    source:
      "https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive",
  },
};

export function getModel(slot: ModelSlot): ModelAsset {
  return MODELS[slot];
}
