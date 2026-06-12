"use client";

// Paradigm 7 — One magical hero moment.
//
// When timeOfDay crosses the dusk threshold, floor lights turn on in a
// cascading sequence from bottom to top. Each floor's accent colour glows
// briefly, then settles into a warm night-time window glow.
// The entire cascade takes ~4 seconds.

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sceneStore } from "@/lib/scene-store";
import { needColor } from "@/lib/ui";
import type { Floor, Need } from "@/lib/types";

// Constants matching BuildingSimulator.tsx
const FLOOR_H = 1.5;
const SLAB_T = 0.16;
const STEP = FLOOR_H + SLAB_T;

interface CascadeLight {
  y: number;
  colour: string;
  intensity: number;   // 0–1, ramps up then decays to 0.2 (night glow)
  phase: number;       // stagger offset
}

export default function SunsetCascade({ floors }: { floors: Floor[] }) {
  const lightsRef = useRef<CascadeLight[]>([]);
  const cascadeStartRef = useRef<number | null>(null);
  const prevDuskRef = useRef(false);

  // Initialise per-floor lights
  useEffect(() => {
    lightsRef.current = floors.map((f, i) => ({
      y: i * STEP + FLOOR_H / 2,
      colour: needColor[f.need as Need] || "#4ea8ff",
      intensity: 0,
      phase: i * 0.25, // 250ms stagger between floors
    }));
  }, [floors]);

  useFrame((state) => {
    const { timeOfDay, cascadeActive } = sceneStore.getState();
    const isDusk = timeOfDay >= 0.65 && timeOfDay < 0.78;

    // Detect new cascade trigger
    if (isDusk && cascadeActive) {
      if (cascadeStartRef.current === null) {
        cascadeStartRef.current = state.clock.elapsedTime;
      }
    } else {
      cascadeStartRef.current = null;
    }

    const elapsed = cascadeStartRef.current !== null
      ? state.clock.elapsedTime - cascadeStartRef.current
      : 999;

    // Animate each floor light
    for (const light of lightsRef.current) {
      const localT = Math.max(0, elapsed - light.phase);

      if (isDusk && cascadeStartRef.current !== null && localT < 4) {
        // Cascade: ramp up over 0.5s, hold for 0.3s, settle to night glow
        if (localT < 0.5) {
          light.intensity = localT / 0.5; // 0→1
        } else if (localT < 1.2) {
          light.intensity = 1.0; // hold
        } else {
          // Decay to night glow
          light.intensity = 0.2 + 0.8 * Math.max(0, 1 - (localT - 1.2) / 2.5);
        }
      } else if (isDusk) {
        // Still dusk but cascade done → steady night glow
        light.intensity = 0.2;
      } else {
        light.intensity = 0;
      }
    }
  });

  return (
    <group>
      {floors.map((f, i) => (
        <CascadeFloorGlow
          key={f.key}
          light={lightsRef.current[i] || { y: i * STEP + FLOOR_H / 2, colour: "#4ea8ff", intensity: 0, phase: 0 }}
        />
      ))}
    </group>
  );
}

function CascadeFloorGlow({ light }: { light: CascadeLight }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetIntensity = useRef(0);

  useFrame(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    // Smooth interpolation
    targetIntensity.current += (light.intensity - targetIntensity.current) * 0.15;
    const intensity = targetIntensity.current;

    mat.opacity = intensity * 0.25;
    if (intensity > 0.01) {
      mat.color.set(light.colour);
    }
    meshRef.current.scale.y = 0.2 + intensity * 0.8;
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, light.y, 3.62]}
      scale={[10, 0.2, 0.1]}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        color={light.colour}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
