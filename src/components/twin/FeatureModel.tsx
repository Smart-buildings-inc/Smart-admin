"use client";

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { type FeatureModel as FeatureModelConfig, featureModelUrls } from "./floorModels";

// Warm the GLTF cache so feature models pop in without a visible stall. These
// are plain (non-Draco) GLBs, so no decoder configuration is required.
featureModelUrls.forEach((url) => useGLTF.preload(url, false));

/** Case-insensitive fuzzy match of a desired clip against the GLB's clip names. */
function matchClip(names: string[], desired?: string): string | undefined {
  if (!names.length) return undefined;
  if (!desired) return names[0];
  const want = desired.toLowerCase();
  return (
    names.find((n) => n.toLowerCase() === want) ??
    names.find((n) => n.toLowerCase().includes(want)) ??
    names[0]
  );
}

function ModelInner({
  model,
  active,
  onPress,
}: {
  model: FeatureModelConfig;
  active: boolean;
  onPress: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(model.url, false);

  // Clone per-instance so multiple floors using the same asset animate
  // independently (SkeletonUtils preserves the skinned-mesh ↔ bone bindings).
  const cloned = useMemo(() => cloneSkinned(scene), [scene]);
  const { actions, names, mixer } = useAnimations(animations, groupRef);

  // Normalize: fit the longest dimension to targetSize and rest the model on
  // the platform (grounded) or centre it (airborne).
  const { fitScale, fitOffset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = model.targetSize / maxDim;
    const offset: [number, number, number] = model.fly
      ? [-center.x * s, -center.y * s, -center.z * s]
      : [-center.x * s, -box.min.y * s, -center.z * s];
    return { fitScale: s, fitOffset: offset };
  }, [cloned, model]);

  const idleName = useMemo(() => matchClip(names, model.idleClip), [names, model.idleClip]);
  const emoteName = useMemo(
    () => (model.emoteClip ? matchClip(names, model.emoteClip) : undefined),
    [names, model.emoteClip],
  );

  // Keep the model perpetually "alive" with its looping idle clip.
  useEffect(() => {
    const idle = idleName ? actions[idleName] : null;
    if (idle) idle.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.3).play();
    return () => {
      mixer.stopAllAction();
    };
  }, [actions, idleName, mixer]);

  // Click-to-play: fire the one-shot emote, then ease back to idle.
  const playEmote = useCallback(() => {
    const idle = idleName ? actions[idleName] : null;
    const emote = emoteName ? actions[emoteName] : null;
    if (!emote) {
      if (idle) idle.reset().fadeIn(0.2).play();
      return;
    }
    emote.reset();
    emote.enabled = true;
    emote.clampWhenFinished = true;
    emote.setLoop(THREE.LoopOnce, 1);
    if (idle) emote.crossFadeFrom(idle, 0.25, true);
    emote.play();
  }, [actions, idleName, emoteName]);

  // When the emote finishes, blend back to the idle loop and undo any root drift.
  useEffect(() => {
    const onFinished = () => {
      const idle = idleName ? actions[idleName] : null;
      const emote = emoteName ? actions[emoteName] : null;
      if (idle) {
        idle.reset().play();
        if (emote) idle.crossFadeFrom(emote, 0.3, true);
      }
      cloned.position.set(0, 0, 0);
    };
    mixer.addEventListener("finished", onFinished);
    return () => mixer.removeEventListener("finished", onFinished);
  }, [mixer, actions, idleName, emoteName, cloned]);

  // Replay the emote on the rising edge of selection (e.g. picked from the feed).
  const prevActive = useRef(false);
  useEffect(() => {
    if (active && !prevActive.current) playEmote();
    prevActive.current = active;
  }, [active, playEmote]);

  // Airborne bio-indicators orbit the floor centre; grounded models stand still.
  useFrame((state) => {
    const g = groupRef.current;
    if (!g || !model.fly) return;
    const f = model.fly;
    const t = state.clock.elapsedTime * f.speed;
    g.position.set(
      Math.cos(t) * f.radius,
      f.height + Math.sin(t * 2) * f.bob,
      Math.sin(t) * f.radius,
    );
    g.rotation.y = -t;
  });

  return (
    <group
      ref={groupRef}
      position={model.position}
      rotation={[0, model.rotationY ?? 0, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onPress();
        playEmote();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <group scale={fitScale} position={fitOffset}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}

/** Swallows GLB load/parse failures so a flaky CDN never breaks the scene. */
class ModelErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* procedural rig already renders beneath — silently degrade */
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * A real animated GLB feature model for a floor. Loads lazily under Suspense and
 * degrades to nothing (the procedural rig stays) if the asset can't be fetched.
 */
export default function FeatureModel({
  model,
  active,
  onPress,
}: {
  model: FeatureModelConfig;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <ModelErrorBoundary>
      <Suspense fallback={null}>
        <ModelInner model={model} active={active} onPress={onPress} />
      </Suspense>
    </ModelErrorBoundary>
  );
}
