"use client";

// Paradigm 4 — The building breathes.
//
// Sun arc: the main directional light follows timeOfDay across the sky.
// PV glint: occasional specular shimmer on the rooftop panels as the sun
// angle changes. Also casts moon light at night.

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sceneStore } from "@/lib/scene-store";

/** Degrees above horizon at noon */
const MAX_ALTITUDE = 65;
const SUN_DISTANCE = 60;

export default function SolarAnimator() {
  const { scene } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const skyColorRef = useRef<THREE.Color>(new THREE.Color("#0a1830"));
  const bgRef = useRef<THREE.Color>(new THREE.Color("#05080c"));

  useEffect(() => {
    // Find the main directional light (brightest one)
    scene.traverse((child) => {
      if (child instanceof THREE.DirectionalLight && !sunRef.current) {
        const dl = child;
        if (dl.intensity > 0.5) sunRef.current = dl;
      }
    });
    skyColorRef.current = new THREE.Color("#0a1830");
    bgRef.current = scene.background instanceof THREE.Color ? scene.background : new THREE.Color("#05080c");
  }, [scene]);

  useFrame(() => {
    const { timeOfDay } = sceneStore.getState();
    if (!sunRef.current) return;

    // Sun orbit: azimuth sweeps 360°, altitude varies sinusoidally
    const azimuth = timeOfDay * Math.PI * 2 - Math.PI / 2;
    const altitude = Math.sin(timeOfDay * Math.PI * 2 - Math.PI / 2) * 0.6 + 0.2;
    const clampedAlt = Math.max(altitude, -0.25);

    const x = Math.cos(azimuth) * Math.cos(clampedAlt) * SUN_DISTANCE;
    const y = Math.sin(clampedAlt) * SUN_DISTANCE + 8; // base offset so it doesn't dip below
    const z = Math.sin(azimuth) * Math.cos(clampedAlt) * SUN_DISTANCE;

    sunRef.current.position.set(x, y, z);

    // Colour + intensity shift
    const isNight = timeOfDay < 0.22 || timeOfDay > 0.78;
    const isDusk = timeOfDay >= 0.65 && timeOfDay <= 0.78;
    const isDawn = timeOfDay >= 0.22 && timeOfDay <= 0.35;

    if (isNight) {
      sunRef.current.intensity = 0.35;
      sunRef.current.color.set("#9fb8ff");
    } else if (isDusk) {
      const t = (timeOfDay - 0.65) / 0.13;
      sunRef.current.intensity = 0.5 + (1 - t) * 0.6;
      const col = new THREE.Color("#ff7e40").lerp(new THREE.Color("#9fb8ff"), t);
      sunRef.current.color.copy(col);
    } else if (isDawn) {
      const t = (timeOfDay - 0.22) / 0.13;
      sunRef.current.intensity = 0.35 + t * 0.75;
      const col = new THREE.Color("#9fb8ff").lerp(new THREE.Color("#ffcc80"), t);
      sunRef.current.color.copy(col);
    } else {
      sunRef.current.intensity = 1.1;
      sunRef.current.color.set("#fff3da");
    }

    // Background colour shift
    const bg = scene.background;
    if (bg instanceof THREE.Color) {
      let target: THREE.Color;
      if (isNight) target = new THREE.Color("#05080c");
      else if (isDusk) target = new THREE.Color("#1a1420");
      else if (isDawn) target = new THREE.Color("#1a2a40");
      else target = new THREE.Color("#0b1622");
      bg.lerp(target, 0.04);
    }
  });

  return null;
}
