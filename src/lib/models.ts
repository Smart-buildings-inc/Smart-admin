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

/**
 * Floor slot naming follows the data model's Floor.key convention (seed-data.ts).
 * The Blender pipeline (_blender/build_atlas_floors.py) exports one GLB per key
 * via FLOOR_KEY_MAP. Legacy need-based names (floor-water, floor-energy, …) and
 * basement/rooftop are kept for backward compatibility with the procedural twin.
 *
 * Sync: FLOOR_KEY_MAP in build_atlas_floors.py  ↔  seedFloors in seed-data.ts  ↔  this type.
 */
export type FloorSlot =
  // Canonical data-model keys (13 floors)
  | "floor-parking-p1"
  | "floor-reclamation-core"
  | "floor-commons-clinic"
  | "floor-power-ops-core"
  | "floor-aquaponics-bay"
  | "floor-vertical-farm"
  | "floor-residences-a"
  | "floor-residences-b"
  | "floor-residences-c"
  | "floor-residences-d"
  | "floor-the-lung"
  | "floor-penthouses"
  | "floor-skydeck-reservoir"
  // Legacy need-based aliases (backward compat, served by the same GLB via build_atlas_floors.py)
  | `floor-${Need}`
  | "floor-basement"
  | "floor-rooftop";
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
  // Canonical data-model slots (13 floors)
  "floor-parking-p1": floorModule("floor-parking-p1"),
  "floor-reclamation-core": floorModule("floor-reclamation-core"),
  "floor-commons-clinic": floorModule("floor-commons-clinic"),
  "floor-power-ops-core": floorModule("floor-power-ops-core"),
  "floor-aquaponics-bay": floorModule("floor-aquaponics-bay"),
  "floor-vertical-farm": floorModule("floor-vertical-farm"),
  "floor-residences-a": floorModule("floor-residences-a"),
  "floor-residences-b": floorModule("floor-residences-b"),
  "floor-residences-c": floorModule("floor-residences-c"),
  "floor-residences-d": floorModule("floor-residences-d"),
  "floor-the-lung": floorModule("floor-the-lung"),
  "floor-penthouses": floorModule("floor-penthouses"),
  "floor-skydeck-reservoir": floorModule("floor-skydeck-reservoir"),
  // Legacy need-based alias slots (backward compat — same geometry via build_atlas_floors.py)
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

/**
 * Canonical floor-slot key for a data-model floor — resolves the exact slot matching
 * the floor's `key` first, then falls back to the need-based alias.
 */
export function floorSlotForKey(key: string): FloorSlot | null {
  const slot = `floor-${key}` as FloorSlot;
  return slot in MODELS ? slot : null;
}

/** Resolve the detailed interior slot for a floor's need (null when none). */
export function floorSlotForNeed(need: Need): FloorSlot | null {
  const slot = `floor-${need}` as FloorSlot;
  return slot in MODELS ? slot : null;
}
