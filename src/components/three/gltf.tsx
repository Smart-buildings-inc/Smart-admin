"use client";

// Shared glTF loading helpers for the 3D scenes, built to fail soft: a model
// that is disabled, missing, or errors while loading simply renders the
// procedural fallback instead of taking down the WebGL canvas. See
// src/lib/models.ts for the slot registry.

import { Suspense, Component, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { getModel, type ModelSlot } from "@/lib/models";

type Vec3 = [number, number, number];

/**
 * Catches render/load errors from a loaded model subtree and shows `fallback`
 * (the procedural geometry) instead. three.js loader errors surface here so a
 * bad/absent asset never blanks the scene.
 */
export class ModelErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // Swallowed on purpose — the procedural fallback is the recovery path.
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Clones a loaded scene (skeleton-aware, so multiple animated instances are
 * independent), normalizes it to `targetHeight` world units, and re-seats it
 * so its feet sit at y=0 and it is centered on x/z. Returns a ready-to-mount
 * Object3D. Robust to whatever native units the source asset uses.
 */
export function useNormalizedClone(
  scene: THREE.Object3D,
  targetHeight: number,
): THREE.Object3D {
  return useMemo(() => {
    const obj = skeletonClone(scene);
    const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    if (size.y > 0) obj.scale.setScalar(targetHeight / size.y);
    const box = new THREE.Box3().setFromObject(obj);
    obj.position.x -= (box.min.x + box.max.x) / 2;
    obj.position.z -= (box.min.z + box.max.z) / 2;
    obj.position.y -= box.min.y;
    return obj;
  }, [scene, targetHeight]);
}

function LoadedProp({
  path,
  targetHeight,
  rotationY = 0,
}: {
  path: string;
  targetHeight: number;
  rotationY?: number;
}) {
  const { scene } = useGLTF(path);
  const obj = useNormalizedClone(scene, targetHeight);
  return (
    <group rotation={[0, rotationY, 0]}>
      <primitive object={obj} />
    </group>
  );
}

/**
 * Additive static prop for a registry slot. Renders the GLB when the slot is
 * enabled (wrapped in Suspense + an error boundary that fall back to
 * `children`), otherwise just renders `children` (which may be nothing).
 */
export function GltfProp({
  slot,
  position = [0, 0, 0],
  children = null,
}: {
  slot: ModelSlot;
  position?: Vec3;
  children?: ReactNode;
}) {
  const asset = getModel(slot);
  if (!asset.enabled) return <>{children}</>;
  return (
    <group position={position}>
      <ModelErrorBoundary fallback={<>{children}</>}>
        <Suspense fallback={<>{children}</>}>
          <LoadedProp
            path={asset.path}
            targetHeight={asset.targetHeight}
            rotationY={asset.rotationY}
          />
        </Suspense>
      </ModelErrorBoundary>
    </group>
  );
}

/** Preload an enabled slot's asset to avoid pop-in. No-op when disabled. */
export function preloadModel(slot: ModelSlot) {
  const asset = getModel(slot);
  if (asset.enabled) useGLTF.preload(asset.path);
}
