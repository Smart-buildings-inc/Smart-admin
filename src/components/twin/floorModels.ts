// Feature 3D models placed on specific floors of the Habitat Twin.
//
// These are real, animated GLB assets pulled from two open-source 3D libraries,
// served over a CORS-enabled, version-pinned CDN (jsDelivr → GitHub) so they
// load straight into the browser with no bundling or decoder setup:
//   • three.js examples models  (CC-BY / CC0, mrdoob/three.js @ r169)
//   • Khronos glTF Sample Assets (CC0, KhronosGroup/glTF-Sample-Assets)
//
// Each model is auto-fitted to `targetSize` world units at runtime (see
// FeatureModel.tsx), so the raw asset scale does not matter here. Floors not
// listed here simply render their detailed procedural rig (ProceduralRig.tsx).

/** three.js examples GLTF models, pinned to the installed three version (r169). */
const THREE_GLTF =
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/models/gltf";

/** Khronos glTF Sample Assets — canonical, permissively licensed test models. */
const KHRONOS =
  "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models";

export interface FeatureModel {
  /** Absolute GLB URL (CORS-enabled, non-Draco). */
  url: string;
  /** Short human label shown when the floor is inspected. */
  label: string;
  /** Open-source attribution (library + license). */
  source: string;
  /** Longest model dimension is fitted to this many world units. */
  targetSize: number;
  /** Local offset on the floor platform, [x, y, z] from platform-top centre. */
  position: [number, number, number];
  /** Optional fixed Y rotation (radians) for grounded models. */
  rotationY?: number;
  /**
   * Looping "alive" clip played on mount. Matched case-insensitively against
   * the GLB's clip names; falls back to the first available clip.
   */
  idleClip?: string;
  /**
   * One-shot clip played when the floor is pressed (click-to-play). Matched
   * the same way; if absent, the idle clip is simply restarted.
   */
  emoteClip?: string;
  /**
   * If set, the model flies/orbits the floor centre instead of standing on the
   * platform — used for the airborne bio-indicators (atrium + skydeck).
   */
  fly?: { radius: number; height: number; speed: number; bob: number };
}

/**
 * Floor key → feature model. Chosen to be thematically operational:
 *  - power-ops-core  : an autonomous robot that tends the energy/ops core
 *  - commons-clinic  : a roaming therapy companion (Khronos Fox, CC0)
 *  - the-lung        : a parrot circling the air-scrubbing atrium
 *  - skydeck-reservoir: a flamingo gliding over the rooftop pool
 */
export const featureModels: Record<string, FeatureModel> = {
  "power-ops-core": {
    url: `${THREE_GLTF}/RobotExpressive/RobotExpressive.glb`,
    label: "Ops-Bot — autonomous core tender",
    source: "three.js examples · RobotExpressive (CC-BY)",
    targetSize: 0.62,
    position: [1.0, 0, 0.7],
    rotationY: -0.7,
    idleClip: "Idle",
    emoteClip: "Dance",
  },
  "commons-clinic": {
    url: `${KHRONOS}/Fox/glTF-Binary/Fox.glb`,
    label: "Therapy companion — live roam",
    source: "Khronos glTF Sample Assets · Fox (CC0)",
    targetSize: 0.7,
    position: [-0.7, 0, 0.6],
    rotationY: 0.5,
    idleClip: "Survey",
    emoteClip: "Run",
  },
  "the-lung": {
    url: `${THREE_GLTF}/Parrot.glb`,
    label: "Atrium aviary — air-quality bio-indicator",
    source: "three.js examples · Parrot (CC-BY)",
    targetSize: 0.55,
    position: [0, 0, 0],
    fly: { radius: 1.05, height: 0.34, speed: 0.55, bob: 0.12 },
  },
  "skydeck-reservoir": {
    url: `${THREE_GLTF}/Flamingo.glb`,
    label: "Skydeck flyover",
    source: "three.js examples · Flamingo (CC-BY)",
    targetSize: 0.7,
    position: [0, 0, 0],
    fly: { radius: 1.3, height: 0.46, speed: 0.45, bob: 0.16 },
  },
};

/** All feature-model URLs, for preloading. */
export const featureModelUrls: string[] = Object.values(featureModels).map(
  (m) => m.url,
);
