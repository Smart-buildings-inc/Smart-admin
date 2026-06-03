"use client";

// Optional glTF "hero" building, rendered INSIDE the R3F <Canvas> as an
// alternative to the procedural voxel Tower. This is scaffolding: it loads a
// Blender-authored asset from /public/models/atlas-01.glb when present, and
// gracefully falls back to the voxel tower when the file is missing or fails to
// decode — so the app behaves identically until a .glb is dropped in.
//
// Authoring + binding contract: docs/ATLAS-blender-model-spec.md (collection /
// node name === Floor.key; +Y up; metric scale matching the BuildingSimulator
// constants). Full telemetry binding (emissive accent, incident pulse, presence
// heat, floor selection) is the next step once a real asset exists.

import { Component, Suspense, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";

/** Where the Blender → glTF hero asset lives (committed via Git LFS). */
export const TWIN_MODEL_URL = "/models/atlas-01.glb";

/**
 * Initial model source, read from the public env at build time. Defaults to the
 * voxel twin so production is unchanged until NEXT_PUBLIC_TWIN_MODEL=gltf is set
 * (or the user flips the in-app "Hero" toggle).
 */
export function defaultTwinModel(): "voxel" | "gltf" {
  return process.env.NEXT_PUBLIC_TWIN_MODEL === "gltf" ? "gltf" : "voxel";
}

function GltfScene() {
  // If the .glb is Draco/meshopt-compressed, pass the decoder path here, e.g.
  //   useGLTF(TWIN_MODEL_URL, "/draco/")
  // A missing decoder simply throws → the boundary below falls back to voxel.
  const { scene } = useGLTF(TWIN_MODEL_URL);
  // TODO(model-binding): traverse `scene`, index meshes by Floor.key, and drive
  // emissive accent / incident pulse / presence heat. See the spec §8.
  return <primitive object={scene} />;
}

/**
 * Error boundary usable inside the R3F tree. When the glTF load rejects (e.g.
 * the asset is absent), it renders the provided voxel `fallback` instead of
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
        `[ATLAS] Hero model not loaded from ${TWIN_MODEL_URL} — falling back to the voxel twin. ` +
          "Drop a Blender-exported atlas-01.glb in /public/models (see docs/ATLAS-blender-model-spec.md).",
      );
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Render the glTF hero building, falling back to `fallback` (the voxel Tower)
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
