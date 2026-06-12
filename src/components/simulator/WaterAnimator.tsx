"use client";

// Paradigm 4 — The building breathes: water shimmers, pool ripples.
//
// Enhances the existing pool surface with a secondary ripple layer that
// responds to time-of-day (more shimmer in direct sun). Also adds a
// subtle mist particle effect above the pool at dawn/dusk.

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sceneStore } from "@/lib/scene-store";

/** Position of the skydeck pool (matching Rooftop). */
const POOL_POS = new THREE.Vector3(2.15, 0.7, -1.25);

export default function WaterAnimator() {
  const ringRef = useRef<THREE.Mesh>(null);
  const mistRef = useRef<THREE.Points>(null);
  const { scene } = useThree();

  // Create mist particles on mount
  const mistGeo = useRef<THREE.BufferGeometry | null>(null);
  const mistPos = useRef<Float32Array | null>(null);

  if (!mistGeo.current) {
    const count = 60;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = POOL_POS.x + (Math.random() - 0.5) * 2.8;
      pos[i * 3 + 1] = POOL_POS.y + 0.3 + Math.random() * 0.5;
      pos[i * 3 + 2] = POOL_POS.z + (Math.random() - 0.5) * 2.2;
    }
    mistPos.current = pos;
    mistGeo.current = new THREE.BufferGeometry();
    mistGeo.current.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  }

  useFrame((state) => {
    const { timeOfDay } = sceneStore.getState();
    const t = state.clock.elapsedTime;

    // Animate ripple ring near pool
    if (ringRef.current) {
      const scale = 1 + Math.sin(t * 0.6) * 0.06;
      ringRef.current.scale.set(scale, scale, scale);
      ringRef.current.position.y = POOL_POS.y + 0.05 + Math.sin(t * 1.2 + 0.5) * 0.01;
    }

    // Mist particles — fade in at dawn/dusk
    if (mistRef.current && mistPos.current) {
      const isDusk = timeOfDay > 0.6 && timeOfDay < 0.8;
      const isDawn = timeOfDay > 0.2 && timeOfDay < 0.35;
      const mistAlpha = isDusk || isDawn ? 0.3 : 0.05;

      const pos = mistRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3 + 1] += Math.sin(t * 0.4 + i) * 0.002;
        if (pos[i * 3 + 1] > POOL_POS.y + 1.0) pos[i * 3 + 1] = POOL_POS.y + 0.3;
      }
      mistRef.current.geometry.attributes.position.needsUpdate = true;
      (mistRef.current.material as THREE.PointsMaterial).opacity = mistAlpha;
    }
  });

  return (
    <group>
      {/* Ripple ring */}
      <mesh ref={ringRef} position={[POOL_POS.x, POOL_POS.y + 0.05, POOL_POS.z]}>
        <ringGeometry args={[1.2, 1.8, 32]} />
        <meshBasicMaterial color="#7fe7e0" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Mist particles */}
      <points ref={mistRef}>
        <primitive object={mistGeo.current!} />
        <pointsMaterial color="#a8d8ef" size={0.08} transparent opacity={0.05} depthWrite={false} />
      </points>
    </group>
  );
}
