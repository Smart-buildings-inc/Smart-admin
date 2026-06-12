"use client";

// Paradigm 6 — Physics, not data points.
//
// The reservoir water level rises and falls based on actual water flow metrics.
// Not a number — a *simulated volume* that responds to consumption physics.
// The reservoir tank visual becomes a living gauge.

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Floor } from "@/lib/types";
import { needColor } from "@/lib/ui";

const STEP = 1.66;

interface PhysicsWaterProps {
  floors: Floor[];
}

export default function PhysicsWater({ floors }: PhysicsWaterProps) {
  const waterRef = useRef<THREE.Mesh>(null);
  const targetFill = useRef(0.5);
  const currentFill = useRef(0.5);

  // Find the water floor
  const waterFloor = useMemo(() => floors.find((f) => f.need === "water"), [floors]);
  const y = waterFloor ? waterFloor.level * STEP : 0;

  useFrame(() => {
    if (!waterFloor) return;

    // Derive target fill from waterLph (normalised 0–1)
    const lph = waterFloor.metrics.waterLph ?? 0;
    // Assume 2000 L/h max capacity
    const rawTarget = Math.min(lph / 2000, 1);
    targetFill.current = rawTarget;

    // Smoothly interpolate
    currentFill.current += (targetFill.current - currentFill.current) * 0.04;

    if (waterRef.current) {
      // Scale Y to simulate water volume
      const fill = currentFill.current;
      // Height ranges from 0.05 (empty) to 0.5 (full)
      const waterH = 0.05 + fill * 0.45;
      waterRef.current.scale.y = waterH / 0.5;
      // Adjust Y position so water sits at the bottom of the tank
      waterRef.current.position.y = y + 0.4 + waterH / 2;
    }
  });

  if (!waterFloor) return null;
  const accent = needColor[waterFloor.need];

  return (
    <mesh
      ref={waterRef}
      position={[0, y + 0.4 + 0.25, -1.9]}
    >
      <boxGeometry args={[3.5, 0.5, 0.55]} />
      <meshStandardMaterial
        color={accent}
        emissive={accent}
        emissiveIntensity={0.3}
        transparent
        opacity={0.65}
        roughness={0.15}
        metalness={0.1}
      />
    </mesh>
  );
}
