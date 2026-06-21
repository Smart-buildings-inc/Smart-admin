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
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { needColor } from "@/lib/ui";
import type { Floor, Incident, Need } from "@/lib/types";

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

const HERO_STEP = 1.66;
const HERO_CAR_HALF_HEIGHT = (1.5 * 0.86) / 2;

type HeroSceneProps = {
  cutaway: boolean;
  elevatorFloor: number;
  floors: Floor[];
  incidents: Incident[];
  onSelect: (key: string | null) => void;
  selectedKey: string | null;
};

function materialsFor(mesh: THREE.Mesh): THREE.MeshStandardMaterial[] {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.filter(
    (material): material is THREE.MeshStandardMaterial =>
      material instanceof THREE.MeshStandardMaterial,
  );
}

function GltfScene({
  cutaway,
  elevatorFloor,
  floors,
  incidents,
  onSelect,
  selectedKey,
}: HeroSceneProps) {
  const gltf = useGLTF(TWIN_MODEL_URL);
  const { scene } = gltf;

  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((material) => material.clone())
        : mesh.material.clone();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return clone;
  }, [scene]);

  const floorNeedMap = useMemo(
    () => new Map(floors.map((floor) => [floor.key, floor.need])),
    [floors],
  );
  const floorMap = useMemo(() => {
    const map = new Map<string, THREE.Object3D>();
    for (const floor of floors) {
      const root = model.getObjectByName(floor.key);
      if (root) map.set(floor.key, root);
    }
    return map;
  }, [floors, model]);

  useEffect(() => {
    const incidentKeys = new Set(
      incidents
        .filter((incident) => incident.severity === "warn" || incident.severity === "crit")
        .map((incident) => incident.floorKey)
        .filter((key): key is string => Boolean(key)),
    );

    floorMap.forEach((root, key) => {
      root.userData.floorKey = key;
      const front = root.getObjectByName(`${key}.shell.front`);
      if (front) front.visible = !cutaway;
      root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const need = floorNeedMap.get(key) as Need | undefined;
        if (!need) return;
        for (const mat of materialsFor(mesh)) {
          if (mat.name.startsWith("mat.need.")) {
            mat.emissive.set(incidentKeys.has(key) ? "#ff5d5d" : needColor[need]);
            mat.emissiveIntensity =
              key === selectedKey ? 0.85 : incidentKeys.has(key) ? 0.65 : 0.22;
            mat.needsUpdate = true;
          }
        }
      });
    });
  }, [cutaway, floorMap, floorNeedMap, incidents, selectedKey]);

  useFrame((state, delta) => {
    const targetY = elevatorFloor * HERO_STEP + HERO_CAR_HALF_HEIGHT;
    for (const name of ["car.a", "car.b", "car.ff"]) {
      const car = model.getObjectByName(name);
      if (car) car.position.y = THREE.MathUtils.damp(car.position.y, targetY, 5, delta);
    }

    const incidentKeys = new Set(
      incidents
        .filter((incident) => incident.severity === "warn" || incident.severity === "crit")
        .map((incident) => incident.floorKey),
    );
    const pulse = 0.58 + Math.sin(state.clock.elapsedTime * 4.2) * 0.2;
    for (const key of incidentKeys) {
      const root = key ? floorMap.get(key) : undefined;
      root?.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const material of materialsFor(mesh)) {
          if (material.name.startsWith("mat.need.")) {
            material.emissiveIntensity = pulse;
          }
        }
      });
    }
  });

  const floorKeyForEvent = (event: ThreeEvent<MouseEvent>) => {
    let object: THREE.Object3D | null = event.object;
    while (object && object !== model) {
      if (floorNeedMap.has(object.name)) return object.name;
      object = object.parent;
    }
    return null;
  };

  return (
    <primitive
      object={model}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect(floorKeyForEvent(event));
      }}
      onPointerOver={(event: ThreeEvent<PointerEvent>) => {
        if (floorKeyForEvent(event as unknown as ThreeEvent<MouseEvent>)) {
          document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    />
  );
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
export default function GltfBuilding({
  fallback,
  ...sceneProps
}: { fallback: ReactNode } & HeroSceneProps) {
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfScene {...sceneProps} />
      </Suspense>
    </ModelBoundary>
  );
}
