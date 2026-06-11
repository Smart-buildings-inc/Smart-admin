// Optional additive glTF models, with graceful procedural fallback.
//
// ATLAS renders fully on hand-authored procedural three.js geometry
// (architectural simulator, slab twin, human characters). This registry lets us *optionally*
// augment individual "slots" with higher-detail glTF/GLB assets dropped into
// `/public/models`. Every slot keeps working when its asset is disabled,
// absent, or fails to load — it falls back to the original procedural geometry.
// That mirrors the DB-optional data layer: the app still runs with zero model
// binaries committed.
//
// The per-floor `floor-<need>.glb` assets are produced by the Blender pipeline
// `_blender/build_atlas_floors.py` (detailed PBR interiors, exported compact —
// the whole set is well under the PRD's 2.5 MB live-model budget). To rebuild
// or extend them, see the `atlas-blender` skill. Record licenses in
// /public/models/CREDITS.md.

import type { Need } from "@/lib/types";

export type FloorSlot = `floor-${Need}` | "floor-basement" | "floor-rooftop";
export type ModelSlot = FloorSlot | "rooftopProp";

export interface ModelAsset {
  /** Public path served from /public (e.g. "/models/floor-water.glb"). */
  path: string;
  /** When false the slot renders its procedural fallback instead. */
  enabled: boolean;
  /**
   * Target world-space size the loaded scene is normalized to. The loader
   * measures the model's bounding box and scales to fit, so a slot works
   * regardless of the asset's native units. Floor modules normalize on WIDTH
   * (they are wide, shallow interiors); props normalize on HEIGHT.
   */
  targetHeight?: number;
  targetWidth?: number;
  /** Y rotation (radians) applied when placed. */
  rotationY?: number;
  /** Animation clip to play, if the asset is rigged (e.g. "Walking"). */
  clip?: string;
  // Provenance — keep in sync with /public/models/CREDITS.md.
  license: string;
  author: string;
  source: string;
}

const FLOOR_PROVENANCE = {
  license: "CC0-1.0 (procedural, original)",
  author: "ATLAS / build_atlas_floors.py",
  source: "_blender/build_atlas_floors.py",
} as const;

/** A detailed interior module, width-normalized to sit inside a twin slab. */
function floorModule(slot: FloorSlot): ModelAsset {
  return {
    path: `/models/${slot}.glb`,
    enabled: true,
    targetWidth: 3.4, // matches FLOOR_W in the twin
    ...FLOOR_PROVENANCE,
  };
}

export const MODELS: Record<ModelSlot, ModelAsset> = {
  "floor-water": floorModule("floor-water"),
  "floor-energy": floorModule("floor-energy"),
  "floor-food": floorModule("floor-food"),
  "floor-shelter": floorModule("floor-shelter"),
  "floor-air": floorModule("floor-air"),
  "floor-health": floorModule("floor-health"),
  "floor-restoration": floorModule("floor-restoration"),
  "floor-basement": floorModule("floor-basement"),
  "floor-rooftop": floorModule("floor-rooftop"),
  // Additive rooftop detail prop (legacy slot) — disabled; procedural rooftop renders.
  rooftopProp: {
    path: "/models/rooftop.glb",
    enabled: false,
    targetHeight: 1.6,
    license: "—",
    author: "—",
    source: "—",
  },
};

export function getModel(slot: ModelSlot): ModelAsset {
  return MODELS[slot];
}

/** Resolve the detailed interior slot for a floor's need (null when none). */
export function floorSlotForNeed(need: Need): FloorSlot | null {
  const slot = `floor-${need}` as FloorSlot;
  return slot in MODELS ? slot : null;
}
