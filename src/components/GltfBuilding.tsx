"use client";

// Optional glTF "hero" building, rendered INSIDE the R3F <Canvas> as an
// alternative to the procedural architectural Tower. This loads a
// Blender-authored asset from /public/models/atlas-01.glb when present, and
// gracefully falls back to the procedural tower when the file is missing or
// fails to decode.
//
// Authoring + binding contract: docs/ATLAS-blender-model-spec.md (collection /
// node name === Floor.key; +Y up; metric scale matching the BuildingSimulator
// constants). Full telemetry binding (emissive accent, incident pulse, presence
// heat, floor selection) is the next step once a real asset exists.

import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { needColor } from "@/lib/ui";
import type { Need } from "@/lib/types";

/** Where the Blender → glTF hero asset lives (committed via Git LFS). */
export const TWIN_MODEL_URL = "/models/atlas-01.glb";

/**
 * Initial model source, read from the public env at build time. The legacy
 * `"voxel"` value names the procedural R3F tower; it is now architectural by
 * default and remains the local-first fallback unless NEXT_PUBLIC_TWIN_MODEL=gltf
 * is set (or the user flips the in-app "Hero" toggle).
 */
export function defaultTwinModel(): "voxel" | "gltf" {
  return process.env.NEXT_PUBLIC_TWIN_MODEL === "gltf" ? "gltf" : "voxel";
}

// Temporary inline map — should sync with seed-data.ts
const FLOOR_NEED_MAP: Record<string, string> = {
  "reclamation-core": "water",
  "commons-clinic": "health",
  "power-ops-core": "energy",
  "aquaponics-bay": "food",
  "vertical-farm": "food",
  "residences-a": "shelter",
  "residences-b": "shelter",
  "residences-c": "shelter",
  "residences-d": "shelter",
  "the-lung": "air",
  "penthouses": "shelter",
  "skydeck-reservoir": "restoration",
};

function GltfScene() {
  const gltf = useGLTF(TWIN_MODEL_URL);
  const { scene } = gltf;

  // Build floor-key indexed map for telemetry binding
  const floorMap = useMemo(() => {
    const map = new Map<string, THREE.Object3D>();
    scene.traverse((child) => {
      // Match collection/group names to Floor.key
      if (child.parent === scene || (child as THREE.Group).isGroup) {
        for (const [key] of Object.entries(FLOOR_NEED_MAP)) {
          if (child.name === key || child.name.startsWith(key)) {
            map.set(key, child);
          }
        }
      }
    });
    return map;
  }, [scene]);

  // Apply need accent as emissive glow
  useEffect(() => {
    floorMap.forEach((root, key) => {
      root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          const need = FLOOR_NEED_MAP[key] as Need | undefined;
          if (need && mat.name?.includes?.("emissive")) {
            const hex = needColor[need];
            const color = new THREE.Color(hex);
            mat.emissive = color;
            mat.emissiveIntensity = 0.3;
            mat.needsUpdate = true;
          }
        }
      });
    });
  }, [floorMap]);

  return <primitive object={scene} />;
}

/**
 * Error boundary usable inside the R3F tree. When the glTF load rejects (e.g.
 * the asset is absent), it renders the provided procedural `fallback` instead of
 * crashing the scene.
 */
class ModelBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // Expected when no asset is installed yet — keep it quiet but discoverable.
    if (typeof console !== "undefined") {
      console.warn(
        `[ATLAS] Hero model not loaded from ${TWIN_MODEL_URL} — falling back to the procedural twin. ` +
          "Drop a Blender-exported atlas-01.glb in /public/models (see docs/ATLAS-blender-model-spec.md).",
      );
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Render the glTF hero building, falling back to `fallback` (the procedural Tower)
 * both while loading and on any load error.
 */
export default function GltfBuilding({ fallback }: { fallback: ReactNode }) {
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfScene />
      </Suspense>
    </ModelBoundary>
  );
}
